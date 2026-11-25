'use strict';

// A frase do site (site-acesso.js) já abre os bilhetinhos; aqui só buscamos a
// chave dos rascunhos e carregamos o editor.
const noteAccess = (() => {
  const app = document.getElementById('notes-app');
  const status = document.getElementById('notes-loading');
  const request = (path, options) => siteAccess.request(path, options, 'bilhetinhos');
  let draftKey;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Recarregue a página para abrir os bilhetinhos.'));
      document.head.append(script);
    });
  }
  async function start() {
    await siteAccess.ready;
    try {
      const {draftKey:hex} = await (await request('/bilhetinhos/acesso')).json();
      draftKey = await crypto.subtle.importKey('raw', Uint8Array.from(hex.match(/../g), part => parseInt(part, 16)),
        'AES-GCM', false, ['encrypt', 'decrypt']);
      app.replaceChildren(document.getElementById('notes-template').content.cloneNode(true));
      await loadScript('./bilhetinhos.js?v=14');
      await loadScript('./bilhetinhos-salvos.js?v=4');
      status.hidden = true;
      app.hidden = false;
      document.getElementById(location.hash === '#editor' ? 'editor-title' : 'collection-title').focus({preventScroll:true});
    } catch (error) {
      status.textContent = error.message || 'Não foi possível abrir os bilhetinhos.';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = 'Tentar de novo';
      retry.onclick = () => location.reload();
      status.after(retry);
    }
  }
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
  start();
  return {request, get draftKey() { return draftKey; }};
})();
