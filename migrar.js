'use strict';

// Cópia única do servidor antigo (ChatGPT) para o novo (Cloudflare Worker).
// Precisa rodar em rafaelmarasca.github.io: o servidor antigo só aceita esse endereço.
(() => {
  const OLD = 'https://presentes-lulu-e-rafo.rafaelmarascamartins.chatgpt.site';
  const form = document.getElementById('form');
  const log = document.getElementById('log');
  const summary = document.getElementById('summary');
  const target = document.getElementById('target');
  try { target.value = localStorage.getItem('lulu.migracao.destino') || ''; } catch {}

  function say(message, kind = 'ok') {
    const item = document.createElement('li');
    item.className = kind;
    item.textContent = message;
    log.append(item);
    item.scrollIntoView({block: 'nearest'});
  }

  async function call(base, path, {session, method = 'GET', body, version, as = 'json'} = {}) {
    const headers = {};
    if (session) headers['X-Gift-Session'] = session;
    if (version) headers['X-Gift-Version'] = version;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let response;
    try {
      response = await fetch(base + path, {method, headers, body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer'});
    } catch {
      throw new Error('Sem conexão com ' + (base === OLD ? 'o servidor antigo' : 'o novo servidor') + '.');
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const error = new Error(data.error || 'Erro ' + response.status + ' em ' + path);
      error.status = response.status;
      throw error;
    }
    return as === 'blob' ? response.blob() : response.json();
  }
  const asDataUrl = blob => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

  async function migrate(code, NEW) {
    say('Entrando nos dois servidores…', 'skip');
    // The old server refuses a second login while another is in progress,
    // so log in one at a time and retry briefly if it's still busy.
    async function login(base, body) {
      for (let attempt = 1; ; attempt++) {
        try { return await call(base, '/unlock', {method: 'POST', body}); }
        catch (error) {
          if (error.status === 403 || error.status === 401 || attempt === 4) throw error;
          await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
        }
      }
    }
    let oldGifts, oldNotes, fresh;
    try {
      oldGifts = await login(OLD, {code});
      oldNotes = await login(OLD, {scope: 'bilhetinhos', code});
      fresh = await login(NEW, {code});
    } catch (error) { throw new Error('Não deu para entrar: ' + error.message); }
    const giftSession = oldGifts.session, noteSession = oldNotes.session, session = fresh.session;
    const totals = {gifts: 0, giftsSkipped: 0, notes: 0, notesSkipped: 0, problems: 0};

    // 1. A chave dos rascunhos vem primeiro: sem ela, rascunhos já salvos não abririam.
    const {draftKey} = await call(OLD, '/bilhetinhos/acesso', {session: noteSession});
    try {
      await call(NEW, '/bilhetinhos/acesso', {session, method: 'PUT', body: {draftKey}});
      say('Chave dos rascunhos copiada.');
    } catch (error) {
      if (error.status === 409) throw new Error('O novo servidor já tem outra chave de rascunhos. Pare aqui e veja o LEIA-ME (seção “Começar do zero”).');
      throw error;
    }

    // 2. Presentes, com o mesmo código e a data original.
    const {items: gifts} = await call(OLD, '/gifts', {session: giftSession});
    say(gifts.length + ' presentes no servidor antigo.', 'skip');
    for (const item of gifts) {
      try {
        const record = await call(OLD, '/gifts/' + item.id, {session: giftSession});
        await call(NEW, '/gifts/' + item.id, {session, method: 'PUT', version: 'new', body: {
          title: record.title, link: record.link || '', description: record.description || '',
          forWhom: record.forWhom, priority: record.priority, bought: !!record.bought,
          photo: record.photo || '', updated: Number(item.updated) || undefined
        }});
        totals.gifts++;
        say('Presente: ' + record.title);
      } catch (error) {
        if (error.status === 409) { totals.giftsSkipped++; say('Presente já copiado: ' + item.title, 'skip'); }
        else { totals.problems++; say('Presente “' + item.title + '”: ' + error.message, 'error'); }
      }
    }

    // 3. Bilhetinhos publicados (um por data no servidor antigo).
    const oldList = await call(OLD, '/bilhetinhos', {session: noteSession});
    const newList = await call(NEW, '/bilhetinhos', {session});
    const already = new Set(newList.items.map(note => note.date + '|' + note.title));
    say(oldList.items.length + ' bilhetinhos no servidor antigo.', 'skip');
    for (const item of oldList.items) {
      const label = item.date + (item.title ? ' (' + item.title.slice(0, 40) + ')' : '');
      if (already.has(item.date + '|' + (item.title || 'Bilhetinho'))) { totals.notesSkipped++; say('Bilhetinho já copiado: ' + label, 'skip'); continue; }
      try {
        const blob = await call(OLD, '/bilhetinhos/' + item.date, {session: noteSession, as: 'blob'});
        if (!/^image\/(jpeg|png|webp)$/.test(blob.type)) throw new Error('o servidor antigo não mandou uma imagem (' + (blob.type || 'sem tipo') + ').');
        const created = Number(item.created || item.updated) || undefined;
        await call(NEW, '/bilhetinhos', {session, method: 'POST', body: {date: item.date, title: item.title || '', image: await asDataUrl(blob), created}});
        totals.notes++;
        say('Bilhetinho: ' + label);
      } catch (error) {
        totals.problems++;
        say('Bilhetinho ' + label + ': ' + (error.status === 403 || error.status === 404
          ? 'o servidor antigo não liberou a imagem (agendado para o futuro?). Publique de novo depois da mudança.'
          : error.message), error.status === 403 ? 'warn' : 'error');
      }
    }
    return totals;
  }

  form.onsubmit = async event => {
    event.preventDefault();
    const button = document.getElementById('start');
    const NEW = target.value.trim().replace(/\/+$/, '');
    if (!/^https:\/\/[^/]+$/.test(NEW)) { say('Use o endereço completo do Worker, começando com https://', 'error'); return; }
    try { localStorage.setItem('lulu.migracao.destino', NEW); } catch {}
    const code = document.getElementById('phrase').value.trim().split(/\s+/).join(' ');
    button.disabled = true;
    log.replaceChildren();
    summary.hidden = true;
    try {
      const t = await migrate(code, NEW);
      summary.textContent = 'Pronto. Presentes: ' + t.gifts + ' copiados, ' + t.giftsSkipped + ' já estavam lá. Bilhetinhos: ' +
        t.notes + ' copiados, ' + t.notesSkipped + ' já estavam lá.' + (t.problems ? ' ' + t.problems + ' item(ns) com problema: veja a lista abaixo e rode de novo se for algo passageiro.' : ' Nada ficou para trás.');
      summary.hidden = false;
      document.getElementById('phrase').value = '';
    } catch (error) {
      say(error.message, 'error');
    } finally { button.disabled = false; }
  };
})();
