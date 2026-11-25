// Backend do site "Uma lua para Lulu": lista de presentes e bilhetinhos.
// Cloudflare Worker em um arquivo só, sem dependências. Precisa de:
//   DB              banco D1 (as tabelas são criadas sozinhas na primeira chamada)
//   PHRASE_HASH     segredo gerado por gerar-segredos.html (a frase nunca vai para a Cloudflare)
//   SESSION_SECRET  segredo gerado por gerar-segredos.html
//   ALLOWED_ORIGINS opcional; padrão https://rafaelmarasca.github.io (separe vários por vírgula)

const SCHEMA = `
CREATE TABLE IF NOT EXISTS gifts (id TEXT PRIMARY KEY, title TEXT NOT NULL, link TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', for_whom TEXT NOT NULL, priority TEXT NOT NULL, bought INTEGER NOT NULL DEFAULT 0, photo TEXT NOT NULL DEFAULT '', updated INTEGER NOT NULL, version TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, date TEXT NOT NULL, title TEXT NOT NULL, mime TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL, version TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS notes_by_date ON notes (date, created);
CREATE TABLE IF NOT EXISTS note_images (note_id TEXT NOT NULL, part INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (note_id, part));
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS attempts (ip TEXT PRIMARY KEY, count INTEGER NOT NULL, since INTEGER NOT NULL);
`;

const DAY = 864e5;
const SESSION_SHORT = DAY / 2;       // sem "lembrar": 12 horas
const SESSION_LONG = 30 * DAY;       // com "lembrar": 30 dias (o site renova sozinho)
const MAX_ATTEMPTS = 10;             // tentativas erradas por IP...
const ATTEMPT_WINDOW = 15 * 60e3;    // ...a cada 15 minutos
const CHUNK = 900_000;               // D1 guarda até 2 MB por linha; imagens são divididas
const MAX_NOTE_IMAGE = 12_000_000;   // em caracteres base64 (~9 MB)
const MAX_GIFT_PHOTO = 1_200_000;
const PEOPLE = ['Lulu', 'Rafo', 'Nós dois'];
const PRIORITIES = ['Alta', 'Média', 'Baixa'];

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new HttpError(status, message); };

// ---------- utilidades ----------
const encoder = new TextEncoder();
const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = text => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const hex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
const newVersion = () => crypto.randomUUID();
const today = () => new Intl.DateTimeFormat('sv-SE', {timeZone: 'America/Sao_Paulo'}).format(new Date());
const isDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + 'T12:00:00Z'));
export const normalizePhrase = code => String(code || '').normalize('NFC').trim().split(/\s+/u).join(' ').toLocaleLowerCase('pt-BR');

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// PHRASE_HASH = "sha256$<sal em base64url>$<hash em base64url>"
export async function hashPhrase(code, salt) {
  const data = encoder.encode(b64url(salt) + ':' + normalizePhrase(code));
  return 'sha256$' + b64url(salt) + '$' + b64url(await crypto.subtle.digest('SHA-256', data));
}
async function phraseMatches(code, stored) {
  const [kind, salt] = String(stored || '').split('$');
  if (kind !== 'sha256' || !salt) fail(500, 'O servidor ainda não foi configurado (PHRASE_HASH).');
  const candidate = await hashPhrase(code, fromB64(salt));
  return timingSafeEqual(encoder.encode(candidate), encoder.encode(stored));
}

async function signingKey(env) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) fail(500, 'O servidor ainda não foi configurado (SESSION_SECRET).');
  return crypto.subtle.importKey('raw', encoder.encode(env.SESSION_SECRET), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign', 'verify']);
}
// Sessão = "<expira em ms>.<L ou S><aleatório>.<assinatura>". O site lê o número do começo.
// L = lembrar o aparelho (30 dias, renovável); S = só esta visita (12 horas).
async function createSession(env, remember) {
  const body = (Date.now() + (remember ? SESSION_LONG : SESSION_SHORT)) + '.' + (remember ? 'L' : 'S') +
    b64url(crypto.getRandomValues(new Uint8Array(12)));
  const signature = await crypto.subtle.sign('HMAC', await signingKey(env), encoder.encode(body));
  return body + '.' + b64url(signature);
}
async function readSession(env, token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3 || !(Number(parts[0]) > Date.now())) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await signingKey(env), fromB64(parts[2]), encoder.encode(parts[0] + '.' + parts[1]));
    return ok ? {remember: parts[1].startsWith('L')} : null;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    return null;
  }
}

function parseDataUrl(value, limit, label) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(value || ''));
  if (!match) fail(400, label + ' precisa ser uma imagem JPG, PNG ou WebP.');
  if (match[2].length > limit) fail(413, label + ' é grande demais.');
  return {mime: match[1], data: match[2]};
}
function text(value, max, label, {required = false} = {}) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (required && !result) fail(400, 'Informe ' + label + '.');
  if (result.length > max) fail(400, label.charAt(0).toUpperCase() + label.slice(1) + ' é longo demais.');
  return result;
}
async function readJson(request) {
  try { return await request.json(); } catch { fail(400, 'Pedido inválido.'); }
}

// ---------- banco ----------
let schemaReady = null;
function ensureSchema(env) {
  if (!env.DB) fail(500, 'O servidor ainda não foi configurado (banco DB).');
  // exec() runs one statement per line.
  schemaReady ||= env.DB.exec(SCHEMA.trim()).catch(error => { schemaReady = null; throw error; });
  return schemaReady;
}
const first = (env, sql, ...args) => env.DB.prepare(sql).bind(...args).first();
const all = async (env, sql, ...args) => (await env.DB.prepare(sql).bind(...args).all()).results || [];
const run = (env, sql, ...args) => env.DB.prepare(sql).bind(...args).run();
const changed = result => (result?.meta?.changes ?? 0) > 0;

// ---------- entrada ----------
async function unlock(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const now = Date.now();
  const attempt = await first(env, 'SELECT count, since FROM attempts WHERE ip = ?', ip);
  if (attempt && now - attempt.since < ATTEMPT_WINDOW && attempt.count >= MAX_ATTEMPTS)
    fail(429, 'Muitas tentativas. Espere alguns minutos e tente de novo.');
  const body = await readJson(request);
  if (!(await phraseMatches(body.code, env.PHRASE_HASH))) {
    if (attempt && now - attempt.since < ATTEMPT_WINDOW) await run(env, 'UPDATE attempts SET count = count + 1 WHERE ip = ?', ip);
    else await run(env, 'INSERT OR REPLACE INTO attempts (ip, count, since) VALUES (?, 1, ?)', ip, now);
    fail(403, 'Frase incorreta. Confira as palavras e a ordem.');
  }
  if (attempt) await run(env, 'DELETE FROM attempts WHERE ip = ?', ip);
  return {session: await createSession(env, body.remember === true)};
}

// ---------- presentes ----------
const giftSummary = row => ({id: row.id, title: row.title, forWhom: row.for_whom, priority: row.priority,
  bought: !!row.bought, updated: row.updated, version: row.version});
const giftRecord = row => ({...giftSummary(row), link: row.link, description: row.description, photo: row.photo});

async function listGifts(env) {
  const rows = await all(env, 'SELECT id, title, for_whom, priority, bought, updated, version FROM gifts ORDER BY updated DESC');
  return {items: rows.map(giftSummary)};
}
async function readGift(env, id) {
  const row = await first(env, 'SELECT * FROM gifts WHERE id = ?', id);
  if (!row) fail(404, 'Este presente não existe mais.');
  return giftRecord(row);
}
async function saveGift(request, env, id) {
  const expected = request.headers.get('X-Gift-Version');
  if (!expected) fail(428, 'Atualize a lista e tente de novo.');
  const body = await readJson(request);
  const link = text(body.link, 2048, 'o link');
  if (link && !/^https?:\/\//i.test(link)) fail(400, 'Use um link que comece com http ou https.');
  const photo = body.photo ? parseDataUrl(body.photo, MAX_GIFT_PHOTO, 'A foto') && body.photo : '';
  const gift = {
    title: text(body.title, 100, 'o nome do presente', {required: true}),
    link, description: text(body.description, 2000, 'a descrição'),
    forWhom: PEOPLE.includes(body.forWhom) ? body.forWhom : fail(400, 'Escolha para quem é o presente.'),
    priority: PRIORITIES.includes(body.priority) ? body.priority : fail(400, 'Escolha a prioridade.'),
    bought: body.bought === true ? 1 : 0, photo
  };
  const version = newVersion();
  // Na importação vale a data original; nos demais casos, agora.
  const updated = expected === 'new' && Number.isInteger(body.updated) && body.updated > 0 && body.updated <= Date.now() ? body.updated : Date.now();
  if (expected === 'new') {
    try {
      await run(env, 'INSERT INTO gifts (id, title, link, description, for_whom, priority, bought, photo, updated, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        id, gift.title, gift.link, gift.description, gift.forWhom, gift.priority, gift.bought, gift.photo, updated, version);
    } catch { fail(409, 'Já existe um presente com este código. Atualize a lista.'); }
  } else {
    const result = await run(env, 'UPDATE gifts SET title = ?, link = ?, description = ?, for_whom = ?, priority = ?, bought = ?, photo = ?, updated = ?, version = ? WHERE id = ? AND version = ?',
      gift.title, gift.link, gift.description, gift.forWhom, gift.priority, gift.bought, gift.photo, updated, version, id, expected);
    if (!changed(result)) fail(409, 'Este presente mudou em outro aparelho. Atualize a lista e tente de novo.');
  }
  return {version};
}
async function deleteGift(request, env, id) {
  const result = await run(env, 'DELETE FROM gifts WHERE id = ? AND version = ?', id, request.headers.get('X-Gift-Version') || '');
  if (!changed(result)) fail(409, 'Este presente mudou em outro aparelho. Atualize a lista e tente de novo.');
  return {ok: true};
}

// ---------- bilhetinhos ----------
async function draftKey(env) {
  const row = await first(env, "SELECT value FROM settings WHERE key = 'draftKey'");
  if (row) return {draftKey: row.value};
  const value = hex(crypto.getRandomValues(new Uint8Array(32)));
  await run(env, "INSERT OR IGNORE INTO settings (key, value) VALUES ('draftKey', ?)", value);
  return {draftKey: (await first(env, "SELECT value FROM settings WHERE key = 'draftKey'")).value};
}
// Só na migração: traz a chave antiga para os rascunhos já guardados continuarem abrindo.
async function importDraftKey(request, env) {
  const {draftKey: value} = await readJson(request);
  if (!/^[0-9a-f]{64}$/.test(String(value))) fail(400, 'Chave inválida.');
  const result = await run(env, "INSERT OR IGNORE INTO settings (key, value) VALUES ('draftKey', ?)", value);
  if (!changed(result)) {
    const current = await first(env, "SELECT value FROM settings WHERE key = 'draftKey'");
    if (current.value !== value) fail(409, 'A chave dos rascunhos já foi definida neste servidor.');
  }
  return {ok: true};
}

const noteSummary = (row, now) => {
  const locked = row.date > now;
  // Bilhetinhos agendados aparecem na lista, mas o conteúdo fica guardado até o dia.
  return {id: row.id, date: row.date, title: locked ? '' : row.title, locked, created: row.created, version: row.version};
};
async function listNotes(env) {
  const now = today();
  const rows = await all(env, 'SELECT id, date, title, created, version FROM notes ORDER BY date DESC, created DESC');
  return {today: now, items: rows.map(row => noteSummary(row, now))};
}
async function noteRow(env, id) {
  const row = await first(env, 'SELECT * FROM notes WHERE id = ?', id);
  if (!row) fail(404, 'Este bilhetinho não existe mais.');
  return row;
}
async function noteImage(env, id) {
  const row = await noteRow(env, id);
  if (row.date > today()) fail(403, 'Este bilhetinho ainda não abriu.');
  const parts = await all(env, 'SELECT data FROM note_images WHERE note_id = ? ORDER BY part', id);
  // Sent back as the data URL it was saved as: decoding megabytes of base64 here
  // would eat the free plan's CPU time, and the page can show a data URL directly.
  return new Response('data:' + row.mime + ';base64,' + parts.map(part => part.data).join(''),
    {headers: {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'private, no-store'}});
}
function noteInput(body) {
  if (!isDate(body.date)) fail(400, 'Escolha uma data válida.');
  return {date: body.date, title: text(body.title, 120, 'o título'), image: parseDataUrl(body.image, MAX_NOTE_IMAGE, 'A imagem do bilhetinho')};
}
const imageStatements = (env, id, image) => {
  const statements = [env.DB.prepare('DELETE FROM note_images WHERE note_id = ?').bind(id)];
  for (let i = 0; i * CHUNK < image.data.length; i++)
    statements.push(env.DB.prepare('INSERT INTO note_images (note_id, part, data) VALUES (?, ?, ?)').bind(id, i, image.data.slice(i * CHUNK, (i + 1) * CHUNK)));
  return statements;
};
async function createNote(request, env) {
  const body = await readJson(request);
  const note = noteInput(body);
  const id = crypto.randomUUID(), version = newVersion(), now = Date.now();
  const created = Number.isInteger(body.created) && body.created > 0 && body.created <= now ? body.created : now;
  await env.DB.batch([
    env.DB.prepare('INSERT INTO notes (id, date, title, mime, created, updated, version) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, note.date, note.title || 'Bilhetinho', note.image.mime, created, now, version),
    ...imageStatements(env, id, note.image)
  ]);
  return {id, version};
}
async function updateNote(request, env, id) {
  const expected = request.headers.get('X-Gift-Version') || '';
  const note = noteInput(await readJson(request));
  const current = await noteRow(env, id);
  if (current.version !== expected) fail(409, 'Este bilhetinho mudou em outro aparelho. Atualize a página e tente de novo.');
  const version = newVersion();
  // O lote é uma transação: se a versão mudou no meio, nada é gravado.
  const results = await env.DB.batch([
    env.DB.prepare('UPDATE notes SET date = ?, title = ?, mime = ?, updated = ?, version = ? WHERE id = ? AND version = ?')
      .bind(note.date, note.title || 'Bilhetinho', note.image.mime, Date.now(), version, id, expected),
    ...imageStatements(env, id, note.image)
  ]);
  if (!changed(results[0])) fail(409, 'Este bilhetinho mudou em outro aparelho. Atualize a página e tente de novo.');
  return {id, version};
}
async function deleteNote(request, env, id) {
  const expected = request.headers.get('X-Gift-Version') || '';
  const current = await noteRow(env, id);
  if (current.version !== expected) fail(409, 'Este bilhetinho mudou em outro aparelho. Atualize a página e tente de novo.');
  await env.DB.batch([
    env.DB.prepare('DELETE FROM note_images WHERE note_id = ?').bind(id),
    env.DB.prepare('DELETE FROM notes WHERE id = ? AND version = ?').bind(id, expected)
  ]);
  return {ok: true};
}

// ---------- rotas ----------
async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = request.method;
  await ensureSchema(env);

  if (path === '/unlock' && method === 'POST') return unlock(request, env);
  const session = await readSession(env, request.headers.get('X-Gift-Session'));
  if (!session) fail(401, 'Sua entrada terminou. Digite a frase novamente.');
  // A remembered device trades its still-valid login for a fresh 30-day one,
  // so it never needs to keep the phrase itself.
  if (path === '/session/renew' && method === 'POST') {
    if (!session.remember) fail(403, 'Esta entrada não foi lembrada neste aparelho.');
    return {session: await createSession(env, true)};
  }

  if (path === '/gifts' && method === 'GET') return listGifts(env);
  let match = /^\/gifts\/([\w-]{1,64})$/.exec(path);
  if (match) {
    if (method === 'GET') return readGift(env, match[1]);
    if (method === 'PUT') return saveGift(request, env, match[1]);
    if (method === 'DELETE') return deleteGift(request, env, match[1]);
  }

  if (path === '/bilhetinhos/acesso') {
    if (method === 'GET') return draftKey(env);
    if (method === 'PUT') return importDraftKey(request, env);
  }
  if (path === '/bilhetinhos') {
    if (method === 'GET') return listNotes(env);
    if (method === 'POST') return createNote(request, env);
  }
  match = /^\/bilhetinhos\/([\w-]{1,64})(\/imagem)?$/.exec(path);
  if (match && isDate(match[1])) fail(410, 'Atualize a página: os bilhetinhos agora têm endereço próprio.');
  if (match && match[2]) { if (method === 'GET') return noteImage(env, match[1]); }
  else if (match) {
    if (method === 'GET') { const row = await noteRow(env, match[1]); return noteSummary(row, today()); }
    if (method === 'PUT') return updateNote(request, env, match[1]);
    if (method === 'DELETE') return deleteNote(request, env, match[1]);
  }
  fail(404, 'Caminho não encontrado.');
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = String(env.ALLOWED_ORIGINS || 'https://rafaelmarasca.github.io').split(',').map(item => item.trim());
  const headers = {
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Gift-Session, X-Gift-Version',
    'Access-Control-Max-Age': '86400'
  };
  if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers: cors});
    let response;
    try {
      const result = await route(request, env);
      response = result instanceof Response ? result : Response.json(result);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (status === 500 && !(error instanceof HttpError)) console.error(error);
      response = Response.json({error: error instanceof HttpError ? error.message : 'Algo deu errado no servidor. Tente de novo.'}, {status});
    }
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(cors)) headers.set(key, value);
    headers.set('X-Content-Type-Options', 'nosniff');
    if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-store');
    return new Response(response.body, {status: response.status, headers});
  }
};
