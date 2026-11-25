'use strict';

const noteAccess = (() => {
  const api = 'https://presentes-lulu-e-rafo.rafaelmarascamartins.chatgpt.site';
  const key = 'lulu.bilhetinhos.session';
  const app = document.getElementById('notes-app');
  const gate = document.getElementById('note-gate');
  const login = document.getElementById('note-login');
  const status = document.getElementById('gate-status');
  let session = '', draftKey, expiryTimer;
  try { session = sessionStorage.getItem(key) || ''; } catch {}
  function lock() {
    session = '';
    try { sessionStorage.removeItem(key); } catch {}
    app.hidden = true;
    gate.hidden = false;
    document.querySelector('dialog[open]')?.close();
    location.reload();
  }
  async function request(path, options = {}) {
    const headers = new Headers(options.headers);
    if (session) headers.set('X-Gift-Session', session);
    let response;
    try { response = await fetch(api + path, {...options, headers, credentials:'omit', cache:'no-store'}); }
    catch { throw new Error('Confira sua conexão e tente novamente.'); }
    if (!response.ok) {
      if (session && response.status === 401) lock();
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Não foi possível acessar os bilhetinhos.');
    }
    return response;
  }
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Recarregue a página para abrir o editor.'));
      document.head.append(script);
    });
  }
  async function enter(password) {
    login.inert = true;
    status.textContent = 'Abrindo os bilhetinhos…';
    try {
      if (password !== undefined) {
        const response = await request('/unlock', {method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({scope:'bilhetinhos', code:password})});
        session = (await response.json()).session;
      }
      const {draftKey:hex} = await (await request('/bilhetinhos/acesso')).json();
      draftKey = await crypto.subtle.importKey('raw', Uint8Array.from(hex.match(/../g), part => parseInt(part, 16)),
        'AES-GCM', false, ['encrypt', 'decrypt']);
      try { sessionStorage.setItem(key, session); } catch {}
      const expires = Number(session.split('.')[0]);
      expiryTimer = setTimeout(lock, Math.max(0, expires - Date.now()));
      const checkExpiry = () => { if (Date.now() >= expires) lock(); };
      window.addEventListener('pageshow', event => {
        if (event.persisted) location.reload();
        else checkExpiry();
      });
      document.addEventListener('visibilitychange', checkExpiry);
      login.reset();
      app.replaceChildren(document.getElementById('notes-template').content.cloneNode(true));
      app.querySelector('#lock-notes').onclick = lock;
      await loadScript('./bilhetinhos.js?v=13');
      await loadScript('./bilhetinhos-salvos.js?v=2');
      gate.hidden = true;
      app.hidden = false;
      document.getElementById(location.hash === '#editor' ? 'editor-title' : 'collection-title').focus();
    } catch (error) {
      clearTimeout(expiryTimer);
      status.textContent = error.message;
      if (app.childElementCount) {
        login.hidden = true;
        const retry = document.createElement('button');
        retry.textContent = 'Recarregar'; retry.onclick = () => location.reload();
        gate.append(retry);
      }
    } finally { login.inert = false; }
  }
  const fields = Array.from(login.querySelectorAll('.note-words input'));
  function distribute(value, index) {
    const words = value.trim().split(/\s+/u).filter(Boolean);
    const start = words.length === fields.length ? 0 : index;
    if (start + words.length > fields.length || words.join(' ').length > 160) {
      status.textContent = 'Digite cinco palavras, uma em cada campo.';
      return;
    }
    words.forEach((word, offset) => { fields[start + offset].value = word; });
    if (words.length) fields[Math.min(start + words.length, fields.length - 1)].focus();
  }
  fields.forEach((field, index) => {
    field.onpaste = event => {
      const pasted = event.clipboardData?.getData('text/plain') || '';
      if (/\s/u.test(pasted)) {
        event.preventDefault();
        status.textContent = '';
        distribute(pasted, index);
      }
    };
    field.oninput = event => {
      status.textContent = '';
      if (!event.isComposing && /\s/u.test(field.value)) distribute(field.value, index);
    };
    field.onkeydown = event => {
      if (event.isComposing) return;
      if ((event.key === ' ' || event.key === 'Enter') && index < fields.length - 1) {
        event.preventDefault();
        if (field.value.trim()) fields[index + 1].focus();
      } else if (event.key === 'Backspace' && !field.value && index > 0) {
        event.preventDefault();
        fields[index - 1].focus();
      }
    };
  });
  login.onsubmit = event => {
    event.preventDefault();
    if (login.inert) return;
    const words = fields.map(field => field.value.trim());
    const code = words.join(' ');
    if (words.some(word => !/^\S+$/u.test(word)) || code.length > 160) {
      status.textContent = 'Digite cinco palavras, uma em cada campo.';
      return;
    }
    enter(code);
  };
  if (session) enter();
  return {request, get draftKey() { return draftKey; }};
})();
