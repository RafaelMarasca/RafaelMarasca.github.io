'use strict';

// Uma única frase abre o site inteiro. Carregado no <head> de cada página, sem
// defer, para esconder o conteúdo antes da primeira pintura.
window.siteAccess = (() => {
  // Endereço do Worker na Cloudflare (veja backend/LEIA-ME.md).
  const api = 'https://lulu-e-rafo-api.rafaelmartinsmarasca.workers.dev';
  const key = 'lulu.site.acesso';
  const root = document.documentElement;
  // Uma sessão vale para todas as áreas; os nomes ficam para ler entradas já salvas.
  const scopes = ['presentes', 'bilhetinhos'];

  function read(storage) {
    try { return JSON.parse(window[storage].getItem(key)) || null; } catch { return null; }
  }
  function write(state) {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
      if (state) (state.remember ? localStorage : sessionStorage).setItem(key, JSON.stringify(state));
      return !state || !state.remember || localStorage.getItem(key) !== null;
    } catch { return false; }
  }
  const expired = token => {
    const expires = Number(String(token || '').split('.')[0]);
    return !token || (Number.isFinite(expires) && expires > 1e12 && Date.now() >= expires);
  };

  // As frases antigas ficavam guardadas por página; agora vale uma só entrada.
  try {
    localStorage.removeItem('lulu.gifts.session');
    sessionStorage.removeItem('lulu.gifts.session');
    sessionStorage.removeItem('lulu.bilhetinhos.session');
  } catch {}

  let state = read('localStorage') || read('sessionStorage');
  // Entradas antigas guardavam a frase; ela é usada uma última vez para trocar por uma sessão.
  const legacyCode = state?.code;
  const usable = state && (legacyCode || scopes.every(scope => !expired(state.sessions?.[scope])));
  if (!usable) { state = null; write(null); }

  let resolveReady;
  const ready = new Promise(resolve => { resolveReady = resolve; });

  async function call(path, options = {}, token) {
    const headers = new Headers(options.headers);
    if (token) headers.set('X-Gift-Session', token);
    let response;
    try {
      response = await fetch(api + path, {...options, headers, credentials:'omit', cache:'no-store', referrerPolicy:'no-referrer'});
    } catch { throw new Error('Não foi possível conectar. Confira sua conexão e tente de novo.'); }
    return response;
  }
  async function failure(response, fallback) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.error || fallback);
    error.status = response.status;
    return error;
  }
  async function signIn(code, remember) {
    const response = await call('/unlock', {method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({code, remember})});
    if (!response.ok) throw await failure(response, 'Não foi possível entrar.');
    const {session} = await response.json();
    return withSession(session, remember);
  }
  const withSession = (session, remember) => ({sessions: Object.fromEntries(scopes.map(scope => [scope, session])), remember});

  // A remembered device swaps its login for a fresh 30-day one about once a day,
  // so it stays signed in while it's used, without ever storing the phrase.
  const DAY = 864e5;
  let renewing = null;
  function renew() {
    renewing ||= (async () => {
      const response = await call('/session/renew', {method:'POST'}, state?.sessions?.presentes);
      if (!response.ok) throw await failure(response, 'Sua entrada terminou. Digite a frase novamente.');
      state = withSession((await response.json()).session, true);
      write(state);
    })().finally(() => { renewing = null; });
    return renewing;
  }
  const remaining = () => Number(String(state?.sessions?.presentes || '').split('.')[0]) - Date.now();

  function lock(message) {
    state = null;
    write(null);
    try { if (message) sessionStorage.setItem(key + '.aviso', message); } catch {}
    location.reload();
  }
  // Sair em uma aba fecha as outras também.
  window.addEventListener('storage', event => {
    if (event.key === key && event.oldValue && !event.newValue) location.reload();
  });

  async function request(path, options = {}, scope = 'presentes') {
    await ready;
    const response = await call(path, options, state?.sessions?.[scope]);
    if (!response.ok) {
      if (response.status === 401) lock('Sua entrada terminou. Digite a frase novamente.');
      throw await failure(response, 'Não foi possível concluir.');
    }
    return response;
  }

  // ---------- Portão ----------
  const style = document.createElement('style');
  style.textContent = 'html.site-locked body>:not(#site-gate){display:none!important}';
  document.head.append(style);

  function addExit() {
    for (const nav of document.querySelectorAll('.site-navigation')) {
      if (nav.querySelector('.site-exit')) continue;
      const exit = document.createElement('button');
      exit.type = 'button';
      exit.className = 'site-exit';
      exit.textContent = 'sair';
      exit.title = 'Sair do site neste aparelho';
      exit.onclick = () => lock();
      nav.append(exit);
    }
  }

  function buildGate() {
    const gate = document.createElement('section');
    gate.id = 'site-gate';
    gate.setAttribute('aria-labelledby', 'site-gate-title');
    gate.innerHTML = `
      <div class="gate-card">
        <span class="gate-moon" aria-hidden="true">☾</span>
        <h1 id="site-gate-title">Uma lua para <em>Lulu</em></h1>
        <p class="gate-lead">Este cantinho é só nosso. Digite a frase para entrar.</p>
        <form id="site-login" novalidate>
          <fieldset>
            <legend>Frase de acesso</legend>
            <p id="site-gate-hint">Cinco palavras, na mesma ordem. Você também pode colar a frase inteira.</p>
            <div class="gate-words">
              ${[1, 2, 3, 4, 5].map(n => `<label><span>${n}ª palavra</span><input type="password" required maxlength="160" autocomplete="off" autocapitalize="none" spellcheck="false" enterkeyhint="${n < 5 ? 'next' : 'go'}" aria-describedby="site-gate-hint"></label>`).join('')}
            </div>
          </fieldset>
          <label class="gate-remember"><input type="checkbox" id="site-remember"><span>Lembrar neste aparelho</span></label>
          <p id="site-gate-status" role="status"></p>
          <button type="submit">Entrar</button>
        </form>
      </div>`;

    // O conteúdo atrás do portão não deve reagir a teclas ou toques (jogos, música).
    for (const type of ['keydown', 'keyup', 'click', 'pointerdown', 'pointerup', 'touchstart'])
      gate.addEventListener(type, event => event.stopPropagation());

    const form = gate.querySelector('form');
    const status = gate.querySelector('#site-gate-status');
    const fields = Array.from(gate.querySelectorAll('.gate-words input'));
    try {
      status.textContent = sessionStorage.getItem(key + '.aviso') || '';
      sessionStorage.removeItem(key + '.aviso');
    } catch {}

    function distribute(value, index) {
      const words = value.trim().split(/\s+/u).filter(Boolean);
      const start = words.length === fields.length ? 0 : index;
      if (start + words.length > fields.length || words.join(' ').length > 160) {
        status.textContent = 'A frase tem cinco palavras, uma em cada campo.';
        return;
      }
      words.forEach((word, offset) => { fields[start + offset].value = word; });
      if (words.length) fields[Math.min(start + words.length, fields.length - 1)].focus();
    }
    fields.forEach((field, index) => {
      field.addEventListener('paste', event => {
        const pasted = event.clipboardData?.getData('text/plain') || '';
        if (!/\s/u.test(pasted.trim())) return;
        event.preventDefault();
        status.textContent = '';
        distribute(pasted, index);
      });
      field.addEventListener('input', event => {
        status.textContent = '';
        if (!event.isComposing && /\s/u.test(field.value)) {
          const value = field.value;
          field.value = '';
          distribute(value, index);
        }
      });
      field.addEventListener('keydown', event => {
        if (event.isComposing) return;
        if ((event.key === ' ' || event.key === 'Enter') && index < fields.length - 1) {
          event.preventDefault();
          if (field.value.trim()) fields[index + 1].focus();
        } else if (event.key === 'Backspace' && !field.value && index > 0) {
          event.preventDefault();
          fields[index - 1].focus();
        }
      });
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (form.inert) return;
      const words = fields.map(field => field.value.trim());
      const empty = words.findIndex(word => !word);
      if (empty !== -1 || words.some(word => /\s/u.test(word))) {
        status.textContent = 'Digite as cinco palavras, uma em cada campo.';
        fields[empty === -1 ? 0 : empty].focus();
        return;
      }
      const remember = gate.querySelector('#site-remember').checked;
      form.inert = true;
      gate.classList.add('is-busy');
      status.textContent = 'Abrindo…';
      try {
        state = await signIn(words.join(' '), remember);
        const saved = write(state);
        form.reset();
        open();
        if (!saved) console.warn('O navegador não permitiu lembrar este aparelho.');
      } catch (error) {
        status.textContent = error.message;
        if (error.status === 403) { fields.forEach(field => { field.value = ''; }); fields[0].focus(); }
      } finally {
        form.inert = false;
        gate.classList.remove('is-busy');
      }
    });
    return gate;
  }

  // Enquanto o portão estiver fechado, nenhuma música começa a tocar.
  const play = HTMLMediaElement.prototype.play;
  function holdMedia() {
    HTMLMediaElement.prototype.play = function () {
      return Promise.reject(new DOMException('Site bloqueado', 'NotAllowedError'));
    };
  }

  let gate;
  function open() {
    HTMLMediaElement.prototype.play = play;
    root.classList.remove('site-locked');
    gate?.remove();
    gate = null;
    addExit();
    resolveReady();
    const target = document.querySelector('main h1, h1');
    if (target && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target?.focus({preventScroll:true});
  }
  function whenBody(run) {
    if (document.body) run();
    else document.addEventListener('DOMContentLoaded', run, {once:true});
  }

  if (state) {
    whenBody(addExit);
    if (legacyCode) {
      signIn(legacyCode, true).then(next => { state = next; write(state); resolveReady(); },
        () => lock('Digite a frase novamente para continuar.'));
    } else {
      resolveReady();
      if (state.remember && remaining() < 29 * DAY) {
        renew().catch(error => { if (error.status === 401 || error.status === 403) lock('Digite a frase novamente para continuar.'); });
      }
    }
  } else {
    root.classList.add('site-locked');
    holdMedia();
    whenBody(() => {
      gate = buildGate();
      document.body.prepend(gate);
      gate.querySelector('input').focus();
    });
  }

  return {ready, request, lock};
})();
