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
  login.onsubmit = event => {
    event.preventDefault();
    if (!login.inert) enter(document.getElementById('note-password').value);
  };
  if (session) enter();
  return {request, get draftKey() { return draftKey; }};
})();
