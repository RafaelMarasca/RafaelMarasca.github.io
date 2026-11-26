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

  // ---------- papel "Luar antigo" ----------
  // O mesmo desenho do primeiro estilo de bilhetinho (drawAntigo em bilhetinhos.js):
  // céu noturno com lua cheia, lua crescente e constelações em volta de uma folha
  // bege lisa de borda irregular.
  (function paintPaper() {
    const speckle = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
    const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
    const circle = (ctx, x, y, r, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
    function star(ctx, x, y, r, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.quadraticCurveTo(x + r * .14, y - r * .12, x + r * .82, y);
      ctx.quadraticCurveTo(x + r * .14, y + r * .12, x, y + r);
      ctx.quadraticCurveTo(x - r * .14, y + r * .12, x - r * .82, y);
      ctx.quadraticCurveTo(x - r * .14, y - r * .12, x, y - r);
      ctx.fill();
    }
    function crescent(ctx, x, y, r, color) {
      ctx.save(); ctx.translate(x, y); ctx.scale(r, r); ctx.fillStyle = color; ctx.beginPath();
      ctx.moveTo(.35, -.98);
      ctx.bezierCurveTo(-1.05, -1.02, -1.35, .72, -.08, .98);
      ctx.bezierCurveTo(.39, 1.1, .78, .82, .96, .48);
      ctx.bezierCurveTo(-.15, .85, -.56, -.45, .35, -.98);
      ctx.fill(); ctx.restore();
    }
    function constellation(ctx, points, color) {
      ctx.strokeStyle = color; ctx.lineWidth = 1.3; ctx.beginPath();
      ctx.moveTo(...points[0]);
      for (const point of points.slice(1)) ctx.lineTo(...point);
      ctx.stroke();
      points.forEach(([x, y], i) => star(ctx, x, y, i % 3 === 0 ? 11 : 5, color));
    }
    const gold = '#e8d8a9';
    // Céu estrelado que se repete em volta da folha.
    const [sky, s] = canvas(540, 540);
    for (let i = 0; i < 60; i++) {
      const x = speckle(i, 4) * 540, y = speckle(i, 5) * 540;
      if (i % 13 === 0) star(s, x, y, 4 + speckle(i, 6) * 5, gold);
      else circle(s, x, y, .7 + speckle(i, 7) * 1.8, '#a6ab9e');
    }
    // Faixa de cima: constelação, lua cheia com crateras, lua crescente e estrela.
    const [top, t] = canvas(1080, 170);
    constellation(t, [[95, 106], [137, 62], [201, 81], [244, 42], [310, 64]], '#b2ae93');
    circle(t, 878, 88, 58, gold);
    t.save(); t.beginPath(); t.arc(878, 88, 58, 0, Math.PI * 2); t.clip();
    for (let i = 0; i < 125; i++) circle(t, 817 + speckle(i, 1) * 120, 27 + speckle(i, 2) * 120, 2 + speckle(i, 3) * 8, 'rgba(102,99,75,.13)');
    t.restore();
    crescent(t, 748, 78, 18, '#d8cba7');
    star(t, 974, 63, 14, gold);
    // Faixa de baixo: a constelação do canto.
    const [bottom, b] = canvas(1080, 90);
    constellation(b, [[768, 45], [825, 23], [866, 47], [927, 36]], '#c7ba97');

    const url = c => `url(${c.toDataURL()})`;
    page.style.setProperty('--sky', url(sky));
    page.style.setProperty('--sky-top', url(top));
    page.style.setProperty('--sky-bottom', url(bottom));

    // Borda irregular da folha, com os mesmos tremidos do bilhetinho.
    const px = n => n.toFixed(1) + 'px';
    const points = [];
    // Na tela o bilhetinho aparece reduzido, então os tremidos ficam menores aqui.
    const N = 90, M = 60;
    for (let i = 0; i <= N; i++) points.push(`${(i / N * 100).toFixed(2)}% ${px(Math.sin(i / 3.5) * 1.8 + 2 + speckle(i * 8, 4) * 4.5)}`);
    for (let i = 1; i < M; i++) points.push(`calc(100% - ${px(speckle(i * 10, 5) * 3.5)}) ${(i / M * 100).toFixed(2)}%`);
    for (let i = N; i >= 0; i--) points.push(`${(i / N * 100).toFixed(2)}% calc(100% - ${px(Math.sin(i / 2.3) * 1.8 + 2 + speckle(i * 8, 6) * 5.5)})`);
    for (let i = M - 1; i > 0; i--) points.push(`${px(speckle(i * 10, 7) * 3.5)} ${(i / M * 100).toFixed(2)}%`);
    page.querySelector('.poem-sheet').style.clipPath = `polygon(${points.join(',')})`;
  })();

  // ---------- índice ----------
  // Um sumário curto, agrupado por mês. Cada mês abre e fecha; ao abrir a
  // página ficam abertos o mês mais recente e o do poema escolhido.
  const monthOpen = new Map();
  const monthKey = iso => iso.slice(0, 7);
  const monthName = iso => {
    const name = new Intl.DateTimeFormat('pt-BR', {month: 'long', year: 'numeric', timeZone: 'UTC'}).format(dateOf(iso));
    return name.charAt(0).toUpperCase() + name.slice(1);
  };
  function renderIndex() {
    const poems = all();
    const query = fold(search.value.trim());
    const shown = query ? poems.filter(poem => fold(poem.title + ' ' + poem.body + ' ' + longDate(poem.date)).includes(query)) : poems;
    byId('index-count').textContent = shown.length === poems.length
      ? `${poems.length} ${poems.length === 1 ? 'poema' : 'poemas'}`
      : `${shown.length} de ${poems.length}`;
    byId('index-empty').hidden = shown.length > 0;
    const latest = poems[0];
    const groups = new Map();
    for (const poem of shown) {
      const key = monthKey(poem.date);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(poem);
    }
    list.replaceChildren(...[...groups].map(([key, items]) => {
      const group = el('details', 'index-month');
      const wanted = monthOpen.get(key);
      group.open = query ? true : wanted ?? (key === monthKey(latest.date) || key === monthKey(current?.date || ''));
      const summary = el('summary');
      // Só os cliques da pessoa contam: abrir pelo código também dispara "toggle".
      summary.onclick = () => { if (!query) monthOpen.set(key, !group.open); };
      summary.append(el('span', 'month-name', monthName(items[0].date)), el('span', 'month-count', String(items.length)));
      const rows = el('ol');
      rows.append(...items.map(poem => {
        const item = el('li');
        const button = el('button', 'index-row');
        button.type = 'button';
        button.dataset.id = poem.id;
        if (poem === current) button.setAttribute('aria-current', 'true');
        const day = el('span', 'row-day', String(dateOf(poem.date).getUTCDate()).padStart(2, '0'));
        day.setAttribute('aria-hidden', 'true');
        const title = el('span', 'row-title', poem.title);
        if (poem === latest) title.append(el('span', 'row-badge', 'novo'));
        button.append(day, title, el('span', 'row-leader'), el('span', 'row-time', `${minutes(poem.body)} min`));
        button.setAttribute('aria-label', `${poem.title}, ${longDate(poem.date)}, ${minutes(poem.body)} min de leitura`);
        button.onclick = () => { picked = true; open(poem, {scroll: true}); };
        item.append(button);
        return item;
      }));
      group.append(summary, rows);
      return group;
    }));
  }

  // O sumário inteiro abre e fecha; a página sempre começa com ele fechado.
  const indexToggle = byId('toggle-index');
  const indexPanel = byId('index-panel');
  function showIndex(show) {
    indexPanel.hidden = !show;
    indexToggle.setAttribute('aria-expanded', String(show));
    byId('toggle-search').hidden = !show;
  }
  indexToggle.onclick = () => showIndex(indexPanel.hidden);
  try { localStorage.removeItem('lulu.poemas.sumario'); } catch {} // escolha guardada por versões antigas
  // Sem mudar o endereço: um #index-title faria a página voltar ao poema mais recente.
  document.querySelector('.back-to-index').addEventListener('click', event => {
    event.preventDefault();
    showIndex(true);
    byId('index-title').scrollIntoView({block: 'start'});
    indexToggle.focus({preventScroll: true});
  });

  // A busca fica recolhida atrás da lupa.
  const searchToggle = byId('toggle-search');
  const searchBox = byId('search-box');
  function showSearch(show) {
    searchBox.hidden = !show;
    searchToggle.setAttribute('aria-expanded', String(show));
    if (show) search.focus();
    else if (search.value) { search.value = ''; renderIndex(); }
  }
  searchToggle.onclick = () => showSearch(searchBox.hidden);
  search.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); showSearch(false); searchToggle.focus(); }
  });

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
