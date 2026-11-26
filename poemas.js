'use strict';

// Índice dos poemas em cima, a página do poema escolhido logo abaixo.
// Os poemas de poemas-data.js aparecem na hora; os escritos aqui vêm do servidor.
(() => {
  const byId = id => document.getElementById(id);
  const list = byId('poem-list');
  const search = byId('poem-search');
  const page = byId('leitura');
  const editor = byId('poem-editor');
  const form = byId('poem-form');
  const fields = {title: byId('poem-title-input'), date: byId('poem-date-input'), body: byId('poem-body-input')};
  const DRAFT = 'lulu.poemas.rascunho';

  const fixed = (window.POEMS || []).map(poem => ({...poem, fixed: true, created: 0}));
  let written = [];
  let serverReady = null; // null = ainda carregando; false = servidor sem poemas
  let current = null;
  let editing = null;
  let picked = false; // a pessoa já escolheu um poema antes do servidor responder

  // ---------- utilidades ----------
  const fold = value => String(value).normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR');
  const dateOf = iso => new Date(iso + 'T12:00:00Z');
  const longDate = iso => new Intl.DateTimeFormat('pt-BR', {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'}).format(dateOf(iso));
  const shortMonth = iso => new Intl.DateTimeFormat('pt-BR', {month: 'short', timeZone: 'UTC'}).format(dateOf(iso)).replace('.', '');
  const today = () => new Intl.DateTimeFormat('sv-SE', {timeZone: 'America/Sao_Paulo'}).format(new Date());
  const stanzas = body => String(body).split(/\n\s*\n/).map(part => part.trim()).filter(Boolean);
  const words = body => (String(body).match(/\S+/g) || []).length;
  const minutes = body => Math.max(1, Math.round(words(body) / 180));
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  // Mais recente primeiro; no mesmo dia, o escrito por último primeiro.
  const all = () => [...fixed, ...written].sort((a, b) => b.date.localeCompare(a.date) || (b.created || 0) - (a.created || 0));
  const request = (path, options) => siteAccess.request(path, options, 'bilhetinhos');

  // ---------- índice ----------
  function renderIndex() {
    const poems = all();
    const query = fold(search.value.trim());
    const shown = query ? poems.filter(poem => fold(poem.title + ' ' + poem.body + ' ' + longDate(poem.date)).includes(query)) : poems;
    byId('index-count').textContent = shown.length === poems.length
      ? `${poems.length} ${poems.length === 1 ? 'poema' : 'poemas'}`
      : `${shown.length} de ${poems.length}`;
    byId('index-empty').hidden = shown.length > 0;
    const latest = poems[0];
    list.replaceChildren(...shown.map(poem => {
      const item = el('li');
      const button = el('button', 'poem-card');
      button.type = 'button';
      button.dataset.id = poem.id;
      if (poem === current) button.setAttribute('aria-current', 'true');
      const tile = el('span', 'day-tile');
      tile.setAttribute('aria-hidden', 'true');
      tile.append(el('b', '', String(dateOf(poem.date).getUTCDate())), el('small', '', shortMonth(poem.date)));
      const text = el('span', 'card-text');
      const first = stanzas(poem.body)[0] || '';
      text.append(el('span', 'card-title', poem.title), el('span', 'card-excerpt', first.replace(/\s*\n\s*/g, ' / ')),
        el('span', 'card-meta', `${minutes(poem.body)} min de leitura`));
      button.setAttribute('aria-label', `${poem.title}, ${longDate(poem.date)}`);
      button.append(tile, text);
      if (poem === latest) button.append(el('span', 'card-badge', 'novo'));
      button.onclick = () => { picked = true; open(poem, {scroll: true}); };
      item.append(button);
      return item;
    }));
  }

  // ---------- página ----------
  function renderPage() {
    const poems = all();
    if (!current) return;
    const index = poems.indexOf(current);
    const kicker = byId('poem-kicker');
    kicker.textContent = index === 0 ? 'o mais recente' : `poema ${poems.length - index} de ${poems.length}`;
    kicker.classList.toggle('is-latest', index === 0);
    byId('poem-title').textContent = current.title;
    const date = byId('poem-date');
    date.dateTime = current.date;
    date.textContent = longDate(current.date);
    byId('poem-reading').textContent = `${minutes(current.body)} min de leitura`;
    byId('poem-body').replaceChildren(...stanzas(current.body).map(part => {
      const p = el('p');
      part.split('\n').forEach((line, i) => { if (i) p.append(el('br')); p.append(line.trim()); });
      return p;
    }));
    const older = poems[index + 1], newer = poems[index - 1];
    const step = (button, poem, label) => {
      button.disabled = !poem;
      button.title = poem ? `${label}: ${poem.title}` : label;
      button.setAttribute('aria-label', button.title);
    };
    step(byId('older-poem'), older, 'Poema anterior');
    step(byId('newer-poem'), newer, 'Próximo poema');
    byId('edit-poem').hidden = byId('delete-poem').hidden = current.fixed;
    byId('poem-status').textContent = '';
    document.title = `${current.title} · Poemas`;
  }

  function open(poem, {scroll = false, push = true} = {}) {
    if (!poem) return;
    const changed = poem !== current;
    current = poem;
    renderPage();
    renderIndex();
    if (push && location.hash !== '#' + poem.id) history.pushState(null, '', '#' + poem.id);
    if (changed) {
      page.classList.remove('is-turning');
      void page.offsetWidth;
      page.classList.add('is-turning');
    }
    if (scroll) {
      page.scrollIntoView({block: 'start'});
      page.focus({preventScroll: true});
    }
  }
  const fromHash = () => all().find(poem => poem.id === decodeURIComponent(location.hash.slice(1)));
  window.addEventListener('popstate', () => open(fromHash() || all()[0], {push: false, scroll: !!fromHash()}));

  function stepBy(offset) {
    const poems = all();
    picked = true;
    open(poems[poems.indexOf(current) + offset], {scroll: true});
  }
  byId('older-poem').onclick = () => stepBy(1);
  byId('newer-poem').onclick = () => stepBy(-1);
  document.addEventListener('keydown', event => {
    if (editor.open || event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input, textarea, select')) return;
    if (event.key === 'ArrowLeft' && !byId('older-poem').disabled) stepBy(1);
    if (event.key === 'ArrowRight' && !byId('newer-poem').disabled) stepBy(-1);
  });

  search.oninput = renderIndex;
  byId('clear-search').onclick = () => { search.value = ''; renderIndex(); search.focus(); };

  byId('copy-poem-link').onclick = async () => {
    const link = location.origin + location.pathname + '#' + current.id;
    try {
      await navigator.clipboard.writeText(link);
      byId('poem-status').textContent = 'Link copiado.';
    } catch {
      byId('poem-status').textContent = link;
    }
  };

  // ---------- servidor ----------
  async function load() {
    await siteAccess.ready;
    try {
      const response = await siteAccess.request('/poemas', {}, 'bilhetinhos').catch(error => {
        if (error.status === 404) return null;
        throw error;
      });
      serverReady = !!response;
      written = response ? (await response.json()).items.map(poem => ({...poem, fixed: false})) : [];
    } catch (error) {
      serverReady = false;
      byId('server-status').textContent = 'Não deu para buscar os poemas escritos aqui. ' + error.message;
      return;
    }
    const wanted = decodeURIComponent(location.hash.slice(1));
    const target = all().find(poem => poem.id === wanted);
    if (target && target !== current) open(target, {push: false, scroll: true});
    else if (!target && !location.hash && !picked) open(all()[0], {push: false});
    else { renderIndex(); renderPage(); }
  }

  // ---------- editor ----------
  function readDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT)) || null; } catch { return null; }
  }
  function saveDraft() {
    if (editing) return;
    try { localStorage.setItem(DRAFT, JSON.stringify({title: fields.title.value, date: fields.date.value, body: fields.body.value})); } catch {}
  }
  const clearDraft = () => { try { localStorage.removeItem(DRAFT); } catch {} };
  const setStatus = (message, error = false) => {
    byId('editor-status').textContent = message;
    byId('editor-status').classList.toggle('is-error', error);
  };

  function openEditor(poem = null) {
    editing = poem;
    const draft = poem ? null : readDraft();
    fields.title.value = poem?.title ?? draft?.title ?? '';
    fields.date.value = poem?.date ?? draft?.date ?? today();
    fields.body.value = poem?.body ?? draft?.body ?? '';
    byId('editor-title').textContent = poem ? 'Editar poema' : 'Um poema novo';
    byId('save-poem').textContent = poem ? 'Salvar alterações' : 'Publicar poema';
    setStatus(!poem && draft?.body ? 'Rascunho recuperado.' : '');
    if (serverReady === false && !byId('server-status').textContent)
      setStatus('O servidor ainda não aceita poemas. Publique a nova versão do worker.js (veja backend/LEIA-ME.md).', true);
    editor.showModal();
    (fields.title.value ? fields.body : fields.title).focus();
  }
  function closeEditor() {
    if (editing && (fields.title.value !== editing.title || fields.body.value !== editing.body || fields.date.value !== editing.date)
      && !confirm('Descartar as alterações deste poema?')) return;
    editor.close();
  }
  byId('write-poem').onclick = () => openEditor();
  byId('edit-poem').onclick = () => openEditor(current);
  byId('close-editor').onclick = byId('cancel-editor').onclick = closeEditor;
  editor.addEventListener('cancel', event => { event.preventDefault(); closeEditor(); });
  editor.addEventListener('close', () => { editing = null; });
  form.addEventListener('input', saveDraft);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const payload = {title: fields.title.value.trim(), date: fields.date.value, body: fields.body.value.trim()};
    if (!payload.title) { setStatus('Dê um título ao poema.', true); fields.title.focus(); return; }
    if (!payload.date) { setStatus('Escolha a data do poema.', true); fields.date.focus(); return; }
    if (!payload.body) { setStatus('Escreva o poema.', true); fields.body.focus(); return; }
    const save = byId('save-poem');
    save.disabled = true;
    setStatus(editing ? 'Salvando…' : 'Publicando…');
    try {
      const headers = {'Content-Type': 'application/json'};
      if (editing) headers['X-Gift-Version'] = editing.version;
      const response = await request(editing ? '/poemas/' + encodeURIComponent(editing.id) : '/poemas',
        {method: editing ? 'PUT' : 'POST', headers, body: JSON.stringify(payload)});
      const saved = {...(await response.json()), fixed: false};
      written = written.filter(poem => poem.id !== saved.id).concat(saved);
      if (!editing) { clearDraft(); form.reset(); }
      serverReady = true;
      editing = null;
      editor.close();
      open(saved, {scroll: true});
      byId('poem-status').textContent = 'Poema publicado.';
    } catch (error) {
      setStatus(error.status === 404
        ? 'O servidor ainda não aceita poemas. Publique a nova versão do worker.js (veja backend/LEIA-ME.md). O rascunho continua guardado.'
        : error.message, true);
    } finally {
      save.disabled = false;
    }
  });

  byId('delete-poem').onclick = async () => {
    const poem = current;
    if (poem.fixed || !confirm(`Excluir “${poem.title}”? Não dá para desfazer.`)) return;
    try {
      await request('/poemas/' + encodeURIComponent(poem.id), {method: 'DELETE', headers: {'X-Gift-Version': poem.version}});
      written = written.filter(item => item !== poem);
      open(all()[0], {push: false});
      history.replaceState(null, '', location.pathname);
      byId('poem-status').textContent = 'Poema excluído.';
    } catch (error) {
      byId('poem-status').textContent = error.message;
    }
  };

  // ---------- início ----------
  open(fromHash() || all()[0], {push: false, scroll: !!fromHash()});
  load();
})();
