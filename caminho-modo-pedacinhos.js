// Dois caminhos — fase "pedacinhos" (modo "pedacinhos").
// Um quebra-cabeça de foto, de arrastar com o dedo ou o mouse. O tabuleiro 3D é
// só o cenário: o Rafo e a Lulu ficam ali do lado do cavalete, torcendo.
// O jogo de verdade é uma camada de HTML (kit.mini) com a moldura e os pedaços.
// Cada pedaço tem o seu lugar; solto perto o bastante dele, encaixa e gruda.
// Uma rodada por foto da lista de caminho-data.js (6, 9, 12 e 16 pedaços). Ao completar, o Rafo ganha a flor e a Lulu a foto
// inteira (o cartão da foto); quando o cartão fecha, vem a próxima rodada.
// As fotos seguem a ordem de caminho-data.js. O botão "escolher foto" abre todas as
// fotos do jogo (o álbum e as extras) para trocar a da rodada; lá também dá para sortear.
(window.CAMINHO_MODOS ||= {}).pedacinhos = kit => {
  const { THREE, D, bodies, part, mat, shade, GEO, chime, burst, el } = kit;
  // colunas x linhas por rodada, conforme a foto é em pé ou deitada
  // ("strip" é para foto bem comprida, como a da chamada de vídeo)
  const GRIDS = { tall: [[2, 3], [3, 3], [3, 4], [4, 4]], wide: [[3, 2], [3, 3], [4, 3], [4, 4]], strip: [[3, 2], [4, 2], [5, 2], [6, 2]] };
  let ROUNDS = 3; // quantas fotos a fase tem em caminho-data.js
  const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
  const M = 10;     // folga em volta da moldura (o passe-partout é desenhado por fora)
  const G = 14;     // vão entre a moldura e os pedaços soltos
  const SP = 1.08;  // espaço de cada pedaço solto, em tamanhos de pedaço
  const SNAP = .42; // encaixa se o centro estiver a menos disto (em casas) do lugar
  let L, T, round = 0, phase = 'start', wait = 0;
  // da rodada aberta: raiz, moldura, pedaços, foto, plano da tela e quem está sendo arrastado
  let cur = null, drag = null, held = null, observer = null;

  // Sorteia uma foto diferente da que está na tela.
  function randomPhoto() {
    const pool = [...kit.album.keys()].filter(id => kit.album.get(id)?.src && id !== cur?.id);
    return pool[Math.floor(Math.random() * pool.length)] || cur?.id;
  }
  // Abre a escolha de fotos por cima do quebra-cabeça.
  function openPicker() {
    if ((phase !== 'puzzle' && phase !== 'loading') || cur.root.querySelector('.cm-jig-picker')) return;
    if (drag) letGo(drag.piece, false);
    if (held) letGo(held, false);
    const panel = el('div', 'cm-jig-picker');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'escolher a foto');
    const grid = el('div', 'cm-jig-grid');
    for (const [id, page] of kit.album) {
      if (!page.src) continue;
      const thumb = el('button', id === cur.id ? 'cm-jig-thumb is-current' : 'cm-jig-thumb');
      thumb.type = 'button';
      thumb.style.backgroundImage = `url("${page.src}")`;
      thumb.setAttribute('aria-label', page.alt || id);
      thumb.addEventListener('click', () => openRound(round, id));
      grid.append(thumb);
    }
    const row = el('div', 'cm-jig-picker-row');
    const lucky = el('button', 'cm-jig-pill', 'sortear uma ↻');
    lucky.type = 'button';
    lucky.addEventListener('click', () => openRound(round, randomPhoto()));
    const back = el('button', 'cm-jig-pill is-quiet', 'voltar');
    back.type = 'button';
    back.addEventListener('click', () => panel.remove());
    row.append(lucky, back);
    panel.append(el('p', 'cm-jig-picker-title', 'qual foto vamos montar?'), grid, row);
    cur.root.append(panel);
    back.focus({ preventScroll: true });
  }

  function injectStyle() {
    if (document.getElementById('cm-pedacinhos-style')) return;
    const style = document.createElement('style');
    style.id = 'cm-pedacinhos-style';
    style.textContent = `
.cm-mini:has(> .cm-jig) { pointer-events: none; }
.cm-jig { position: relative; width: 100%; height: 100%; align-self: stretch; justify-self: stretch; pointer-events: auto; touch-action: none; }
.cm-jig-frame { position: absolute; left: 0; top: 0; border-radius: 6px; background: #fff8e6f2; box-shadow: 0 0 0 7px var(--cm-cream), 0 0 0 9px #e9cf9a, 0 10px 26px 4px #6b4a3a47; }
.cm-jig-ghost { position: absolute; inset: 0; border-radius: 6px; background-repeat: no-repeat; opacity: .14; filter: saturate(.5); }
.cm-jig-slot { position: absolute; box-sizing: border-box; border: 1.5px dashed #6b4a3a38; border-radius: 6px; }
.cm-jig-piece { position: absolute; left: 0; top: 0; margin: 0; padding: 0; border: 0; border-radius: 9px; background-color: #e6dfcd; background-repeat: no-repeat; box-shadow: 0 0 0 2px #fffaf0, 0 6px 14px #3b28204d; cursor: grab; touch-action: none; -webkit-tap-highlight-color: transparent; transition: transform .2s ease, box-shadow .2s, border-radius .3s; }
.cm-jig-piece.is-held { cursor: grabbing; scale: 1.05; box-shadow: 0 0 0 2px #fffaf0, 0 16px 28px #3b282066; transition: box-shadow .15s, scale .15s; }
.cm-jig-piece.is-locked { cursor: default; border-radius: 3px; box-shadow: 0 0 0 .5px #fff8e699; }
.cm-jig-piece.is-snap { animation: cm-jig-pop .36s ease-out; }
.cm-jig-piece:focus-visible { outline: 3px solid var(--cm-gold); outline-offset: 3px; }
.cm-jig.is-still .cm-jig-piece { transition: none; }
.cm-jig.is-done .cm-jig-piece { border-radius: 0; box-shadow: none; }
.cm-jig.is-done .cm-jig-frame { animation: cm-jig-glow .9s ease-in-out; }
.cm-jig-wait { position: absolute; inset: 0; display: grid; place-items: center; }
.cm-jig-swap, .cm-jig-pill { min-height: 40px; padding: 0 14px; border: 0; border-radius: 999px; background: var(--cm-gold); color: var(--cm-brown); font: 12px var(--mono); box-shadow: 0 3px 0 #b98a3a; cursor: pointer; white-space: nowrap; touch-action: manipulation; }
.cm-jig-swap { position: absolute; z-index: 900; right: 0; top: 0; }
.cm-jig-swap:active, .cm-jig-pill:active { translate: 0 2px; box-shadow: 0 1px 0 #b98a3a; }
.cm-jig-pill.is-quiet { background: #fff8e626; color: #fbf5e6; box-shadow: none; }
.cm-jig.is-done .cm-jig-swap { display: none; }
.cm-jig-picker { position: absolute; inset: 0; z-index: 950; display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 4px 6px 14px; border-radius: 18px; background: #1b2147f2; overflow-y: auto; touch-action: pan-y; }
.cm-jig-picker-title { margin: 30px 0 0; color: var(--cm-gold); font: italic 22px/1.2 var(--serif); text-align: center; }
.cm-jig-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 10px; width: min(640px, 100%); touch-action: pan-y; }
.cm-jig-thumb { aspect-ratio: 1; border: 0; border-radius: 10px; background-color: #e6dfcd; background-size: cover; background-position: center; box-shadow: 0 0 0 3px #fffaf0, 0 5px 12px #05081366; cursor: pointer; touch-action: pan-y; }
.cm-jig-thumb.is-current { box-shadow: 0 0 0 4px var(--cm-gold), 0 5px 12px #05081366; }
.cm-jig-thumb:focus-visible, .cm-jig-pill:focus-visible, .cm-jig-swap:focus-visible { outline: 3px solid var(--cm-gold); outline-offset: 3px; }
.cm-jig-picker-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
.cm-jig-wait span { padding: 8px 16px; border-radius: 999px; background: var(--cm-cream); color: var(--cm-brown); font: 13px var(--mono); box-shadow: 0 3px 0 #6b4a3a33; }
@keyframes cm-jig-pop { 40% { scale: 1.08; filter: brightness(1.12); } }
@keyframes cm-jig-glow { 50% { box-shadow: 0 0 0 7px var(--cm-gold), 0 0 0 9px #e9b94a, 0 0 48px 16px #ffe08acc; } }
@media (prefers-reduced-motion: reduce) { .cm-jig-piece, .cm-jig-piece.is-held { transition: none; } .cm-jig-piece.is-snap, .cm-jig.is-done .cm-jig-frame { animation: none; } }
`;
    document.head.append(style);
  }

  // Cavalete atrás dos dois, com quatro quadradinhos coloridos na tela.
  function makeEasel() {
    const g = new THREE.Group();
    const wood = mat('#c98f5a'), dark = mat('#a8703f');
    const left = part(GEO.box, wood, -.3, .56, .06, .07, 1.14, .07);
    left.rotation.z = -.12;
    const right = part(GEO.box, wood, .3, .56, .06, .07, 1.14, .07);
    right.rotation.z = .12;
    const back = part(GEO.box, dark, 0, .5, -.24, .06, 1.04, .06);
    back.rotation.x = -.34;
    g.add(left, right, back, part(GEO.box, dark, 0, .5, .12, .82, .06, .16));
    const panel = new THREE.Group();
    panel.position.set(0, .94, .1);
    panel.rotation.x = -.1;
    panel.add(part(GEO.box, mat('#fff8e6'), 0, 0, 0, .86, .68, .04));
    ['#f7a8b8', '#ffd98a', '#a8d8c0', '#b8c4f0'].forEach((color, i) => {
      panel.add(part(GEO.box, mat(color), (i % 2 - .5) * .32, (.5 - (i >> 1)) * .26, .03, .28, .22, .02));
    });
    g.add(panel);
    g.rotation.y = Math.PI / 4;
    return shade(g, true, false);
  }

  // ---------- Montagem da tela ----------
  const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  // Caixas do quadro de missões e dos botões do alto, no espaço da raiz: nada de pedaço por baixo delas.
  function obstacles(box) {
    const list = [];
    for (const node of kit.stage.querySelectorAll('.cm-hud:not([hidden]) .cm-missions, .cm-hud:not([hidden]) .cm-tools > *')) {
      const r = node.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const o = { x: r.left - box.left - 6, y: r.top - box.top - 6, w: r.width + 12, h: r.height + 12 };
      if (o.y + o.h > 0 && o.x + o.w > 0 && o.x < box.width && o.y < box.height) list.push(o);
    }
    // o botão "escolher foto" fica logo abaixo dos botões do alto, à direita, e também não é coberto
    if (cur?.swap) {
      const tools = kit.stage.querySelector('.cm-hud:not([hidden]) .cm-tools')?.getBoundingClientRect();
      const top = tools ? Math.max(0, tools.bottom - box.top + 8) : 0, right = tools ? Math.max(0, box.right - tools.right) : 0;
      Object.assign(cur.swap.style, { top: top + 'px', right: right + 'px' });
      const r = cur.swap.getBoundingClientRect();
      list.push({ x: r.left - box.left - 6, y: r.top - box.top - 6, w: r.width + 12, h: r.height + 12 });
    }
    return list;
  }

  // Um jeito de arrumar a tela com pedaços de altura s. Devolve null se não couber.
  function tryPlan(kind, s, W, H, obst) {
    const { cols, rows, ca } = cur;
    const cw = s * ca, ch = s, fw = cols * cw, fh = rows * ch;
    let fx = kind === 'right' ? M : (W - fw) / 2;
    let fy = kind === 'below' ? M : (H - fh) / 2;
    // a moldura desce até sair de baixo do quadro de missões
    for (let k = 0; k < 4; k++) {
      const hit = obst.find(o => overlap({ x: fx - M, y: fy - M, w: fw + 2 * M, h: fh + 2 * M }, o));
      if (!hit) break;
      fy = hit.y + hit.h + M + 1;
    }
    if (fx < M - .5 || fy < M - .5 || fx + fw + M > W + .5 || fy + fh + M > H + .5) return null;
    const trays = [];
    if (kind === 'below') trays.push({ x: 0, y: fy + fh + M + G, w: W, h: H - (fy + fh + M + G) });
    if (kind === 'sides') trays.push({ x: 0, y: 0, w: fx - M - G, h: H }, { x: fx + fw + M + G, y: 0, w: W - (fx + fw + M + G), h: H });
    if (kind === 'right') trays.push({ x: fx + fw + M + G, y: 0, w: W - (fx + fw + M + G), h: H });
    if (kind === 'split') trays.push({ x: 0, y: 0, w: W, h: fy - M - G }, { x: 0, y: fy + fh + M + G, w: W, h: H - (fy + fh + M + G) });
    const slots = [];
    for (const tray of trays) {
      const nx = Math.floor(tray.w / (cw * SP)), ny = Math.floor(tray.h / (ch * SP));
      if (nx < 1 || ny < 1) continue;
      const px = tray.w / nx, py = tray.h / ny;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const x = tray.x + (i + .5) * px, y = tray.y + (j + .5) * py;
        if (obst.some(o => overlap({ x: x - cw / 2, y: y - ch / 2, w: cw, h: ch }, o))) continue;
        slots.push({ x, y, px, py });
      }
    }
    if (slots.length < cols * rows) return null;
    return { kind, s, cw, ch, fx, fy, fw, fh, slots };
  }

  // O maior tamanho de pedaço que cabe, entre as arrumações possíveis.
  function plan(W, H, obst) {
    const order = W >= H ? ['sides', 'right', 'below', 'split'] : ['below', 'split', 'sides', 'right'];
    const found = [];
    for (const kind of order) {
      let lo = 20, hi = Math.min(180, H), got = null;
      for (let k = 0; k < 16; k++) {
        const s = (lo + hi) / 2, p = tryPlan(kind, s, W, H, obst);
        if (p) { got = p; lo = s; } else hi = s;
      }
      if (got) found.push(got);
    }
    // a arrumação preferida, se não perder muito tamanho de pedaço
    const top = Math.max(0, ...found.map(p => p.s));
    const best = found.find(p => p.s >= top * .9);
    if (best) return best;
    // tela minúscula: pedaços pequenos, empilhados como der
    const s = 20, cw = s * cur.ca, fw = cur.cols * cw, fh = cur.rows * s;
    const slots = [];
    for (let i = 0; i < cur.cols * cur.rows; i++) slots.push({ x: Math.random() * W, y: fh + 2 * M + Math.random() * Math.max(1, H - fh - 2 * M), px: cw, py: s });
    return { kind: 'tiny', s, cw, ch: s, fx: (W - fw) / 2, fy: M, fw, fh, slots };
  }

  const clampPiece = piece => {
    const { W, H, p } = cur;
    piece.x = Math.max(0, Math.min(W - p.cw, piece.x));
    piece.y = Math.max(0, Math.min(H - p.ch, piece.y));
  };
  const render = piece => {
    piece.node.style.transform = `translate(${piece.x.toFixed(1)}px, ${piece.y.toFixed(1)}px) rotate(${piece.rot.toFixed(1)}deg)`;
    piece.node.style.zIndex = piece.z;
  };
  const home = piece => ({ x: cur.p.fx + piece.c * cur.p.cw, y: cur.p.fy + piece.r * cur.p.ch });
  const tilt = () => (Math.random() < .5 ? -1 : 1) * (2.5 + Math.random() * 5.5);

  // Mede a raiz e arruma tudo; os soltos são espalhados de novo, os encaixados continuam no lugar.
  function relayout(force) {
    if (!cur?.pieces) return;
    const box = cur.root.getBoundingClientRect();
    const W = Math.round(box.width), H = Math.round(box.height);
    if (W < 40 || H < 40) return;
    if (!force && W === cur.W && H === cur.H) return;
    if (drag) letGo(drag.piece, false);
    if (held) letGo(held, false);
    cur.W = W; cur.H = H;
    cur.root.classList.add('is-still'); // arruma sem deslizar
    const p = cur.p = plan(W, H, obstacles(box));
    // recorte "cover" da foto na proporção da moldura
    const scale = Math.max(p.fw / cur.iw, p.fh / cur.ih);
    const bw = cur.iw * scale, bh = cur.ih * scale, ox = (p.fw - bw) / 2, oy = (p.fh - bh) / 2;
    Object.assign(cur.frame.style, { width: p.fw + 'px', height: p.fh + 'px', transform: `translate(${p.fx}px, ${p.fy}px)` });
    Object.assign(cur.ghost.style, { backgroundSize: `${bw}px ${bh}px`, backgroundPosition: `${ox}px ${oy}px` });
    cur.slots.forEach((slot, i) => {
      const c = i % cur.cols, r = Math.floor(i / cur.cols);
      Object.assign(slot.style, { left: c * p.cw + 'px', top: r * p.ch + 'px', width: p.cw + 'px', height: p.ch + 'px' });
    });
    const free = [...p.slots].sort(() => Math.random() - .5);
    let n = 0;
    for (const piece of cur.pieces) {
      Object.assign(piece.node.style, {
        width: p.cw + 'px', height: p.ch + 'px',
        backgroundSize: `${bw}px ${bh}px`,
        backgroundPosition: `${ox - piece.c * p.cw}px ${oy - piece.r * p.ch}px`
      });
      if (piece.locked) Object.assign(piece, home(piece));
      else {
        const spot = free[n++ % free.length];
        piece.x = spot.x - p.cw / 2 + (Math.random() * 2 - 1) * Math.max(0, spot.px - p.cw) * .35;
        piece.y = spot.y - p.ch / 2 + (Math.random() * 2 - 1) * Math.max(0, spot.py - p.ch) * .35;
        clampPiece(piece);
      }
      render(piece);
    }
    void cur.root.offsetWidth;
    cur.root.classList.remove('is-still');
  }

  // ---------- Pedaços ----------
  const lockedCount = () => cur?.pieces ? cur.pieces.filter(piece => piece.locked).length : 0;

  function pickUp(piece) {
    piece.rot = 0;
    piece.z = ++cur.top;
    piece.node.classList.add('is-held');
    render(piece);
  }
  // Solta o pedaço: se estiver perto do lugar dele, encaixa.
  function letGo(piece, tryFit = true) {
    if (drag?.piece === piece) drag = null;
    if (held === piece) held = null;
    piece.node.classList.remove('is-held');
    if (piece.locked) return;
    const spot = home(piece), p = cur.p;
    if (tryFit && Math.hypot(piece.x - spot.x, piece.y - spot.y) < SNAP * Math.min(p.cw, p.ch)) lock(piece);
    else { piece.rot = tilt(); render(piece); }
  }
  function lock(piece, quiet) {
    if (piece.locked) return;
    Object.assign(piece, home(piece), { locked: true, rot: 0, z: 1 });
    piece.node.classList.remove('is-held');
    piece.node.classList.add('is-locked');
    piece.node.tabIndex = -1;
    piece.node.setAttribute('aria-disabled', 'true');
    piece.node.setAttribute('aria-label', `pedaço ${piece.i + 1}, no lugar`);
    render(piece);
    const count = lockedCount();
    if (!quiet) {
      piece.node.classList.remove('is-snap');
      void piece.node.offsetWidth;
      piece.node.classList.add('is-snap');
      chime([NOTES[(count - 1) % NOTES.length]], .04, .05, 'sine');
      bodies[count % 2].cheer = .7;
    }
    kit.hud();
    if (count === cur.pieces.length && phase === 'puzzle') {
      phase = 'cheer';
      wait = 0;
      cur.root.classList.add('is-done');
      chime([523.25, 659.25, 783.99, 1046.5], .09, .1);
      for (const body of bodies) body.cheer = 1.2;
    }
  }

  function makePiece(i) {
    const node = el('button', 'cm-jig-piece');
    node.type = 'button';
    node.setAttribute('aria-label', `pedaço ${i + 1}`);
    node.style.backgroundImage = `url("${cur.src}")`;
    const piece = { i, c: i % cur.cols, r: Math.floor(i / cur.cols), x: 0, y: 0, rot: tilt(), z: 2 + i, locked: false, node };
    node.addEventListener('pointerdown', event => {
      if (piece.locked || drag || phase !== 'puzzle' || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault();
      if (held) letGo(held);
      const box = cur.root.getBoundingClientRect();
      drag = { piece, id: event.pointerId, ox: box.left, oy: box.top, dx: event.clientX - box.left - piece.x, dy: event.clientY - box.top - piece.y };
      try { node.setPointerCapture(event.pointerId); } catch {}
      pickUp(piece);
    });
    node.addEventListener('pointermove', event => {
      if (drag?.piece !== piece || event.pointerId !== drag.id) return;
      piece.x = event.clientX - drag.ox - drag.dx;
      piece.y = event.clientY - drag.oy - drag.dy;
      clampPiece(piece);
      render(piece);
    });
    const up = event => { if (drag?.piece === piece && event.pointerId === drag.id) letGo(piece); };
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', up);
    node.addEventListener('lostpointercapture', up);
    // teclado: Enter/espaço pega e solta, setas movem
    node.addEventListener('keydown', event => {
      const key = event.key;
      if (key === 'Tab') { event.stopPropagation(); return; } // o Tab do jogo troca de personagem; aqui ele passa de pedaço
      if (piece.locked || phase !== 'puzzle') return;
      if (key === 'Enter' || key === ' ') {
        event.preventDefault(); event.stopPropagation();
        if (event.repeat) return;
        if (held === piece) letGo(piece);
        else { if (held) letGo(held); held = piece; pickUp(piece); }
        return;
      }
      const move = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
      if (!move) return;
      event.preventDefault(); event.stopPropagation();
      if (held !== piece) { if (held) letGo(held); held = piece; pickUp(piece); }
      const stepPx = Math.max(8, Math.min(cur.p.cw, cur.p.ch) / 4);
      piece.x += move[0] * stepPx;
      piece.y += move[1] * stepPx;
      clampPiece(piece);
      render(piece);
    });
    node.addEventListener('blur', () => { if (held === piece) letGo(piece); });
    return piece;
  }

  // ---------- Rodadas ----------
  function openRound(n, chosen) {
    round = n;
    phase = 'loading';
    drag = held = null;
    const id = chosen || D.fases[L.index].fotos[n]; // a da sequência, a não ser que tenham escolhido outra
    const root = el('div', 'cm-jig');
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', 'quebra-cabeça da foto');
    const loading = el('div', 'cm-jig-wait');
    loading.append(el('span', '', 'espalhando os pedacinhos…'));
    root.append(loading);
    const swap = el('button', 'cm-jig-swap', 'escolher foto ▢');
    swap.type = 'button';
    swap.setAttribute('aria-label', 'escolher outra foto para montar');
    swap.addEventListener('click', openPicker);
    root.append(swap);
    cur = { id, root, swap, src: kit.album.get(id)?.src || '', W: 0, H: 0, top: 50 };
    kit.mini.open(root);
    kit.hud();
    const image = new Image();
    const ready = () => {
      if (cur?.root !== root) return; // a rodada já mudou
      const iw = image.naturalWidth || 4, ih = image.naturalHeight || 3;
      const grids = GRIDS[iw > ih * 2 ? 'strip' : ih > iw * 1.02 ? 'tall' : 'wide'];
      const [cols, rows] = grids[Math.min(n, grids.length - 1)];
      const ratio = cols / rows, aspect = Math.max(ratio * .8, Math.min(ratio * 1.25, iw / ih));
      Object.assign(cur, { iw, ih, cols, rows, ca: aspect / ratio });
      const frame = el('div', 'cm-jig-frame'), ghost = el('div', 'cm-jig-ghost');
      ghost.style.backgroundImage = `url("${cur.src}")`;
      frame.append(ghost);
      cur.slots = [];
      for (let i = 0; i < cols * rows; i++) { const slot = el('div', 'cm-jig-slot'); cur.slots.push(slot); frame.append(slot); }
      cur.frame = frame;
      cur.ghost = ghost;
      cur.pieces = Array.from({ length: cols * rows }, (_, i) => makePiece(i));
      root.replaceChildren(frame, ...cur.pieces.map(piece => piece.node), swap);
      phase = 'puzzle';
      kit.hud(); // antes de medir: o quadro de missões muda de tamanho com o texto novo
      relayout(true);
      observer?.disconnect();
      observer = new ResizeObserver(() => relayout(false));
      observer.observe(root);
    };
    image.onload = ready;
    image.onerror = ready; // sem a imagem, ainda dá para jogar pelas marcas
    image.src = cur.src;
  }

  function closeRound() {
    observer?.disconnect();
    observer = null;
    drag = held = null;
    kit.mini.close();
  }

  return {
    hello: 'cada pedacinho tem o seu lugar. vamos montar?',
    // legenda dos controles (aqui não se anda: é só arrastar)
    controls: touch => touch
      ? [['arrastar com o dedo', 'levar cada pedaço ao lugar'], ['soltar perto', 'o pedaço gruda'], ['botão "escolher foto"', 'troca a foto']]
      : [['arrastar com o mouse', 'levar cada pedaço ao lugar'], ['soltar perto', 'o pedaço gruda'], ['botão "escolher foto"', 'troca a foto'], ['Enter e setas', 'pegar e mover pelo teclado']],
    setup(level) {
      L = level;
      ROUNDS = D.fases[L.index].fotos.length;
      injectStyle();
      T = kit.tiles(L, [{ id: 'meio', cols: 4, rows: 2 }]);
      const board = T.boards.meio;
      T.place(bodies[0], board, 0, 0);
      T.place(bodies[1], board, 3, 0);
      T.add(makeEasel(), board, 1.5, 1);
      round = 0;
      phase = 'start';
      wait = 0;
      kit.hud();
    },
    // Só roda enquanto se joga: espera sozinho o cartão da foto fechar.
    step(dt) {
      wait += dt;
      if (phase === 'start' && wait > .5) openRound(0);
      else if (phase === 'cheer' && wait > .9) {
        closeRound();
        phase = 'card';
        const [rafo, lulu] = bodies;
        kit.flower(rafo.x, T.top, rafo.z);
        kit.photo(lulu.x, T.top, lulu.z, cur.id);
        wait = 0;
      } else if (phase === 'card') {
        // o cartão já fechou (step só roda em 'play'); um respiro e segue
        phase = 'gap';
        wait = 0;
      } else if (phase === 'gap' && wait > .6) {
        if (round + 1 < ROUNDS) { openRound(round + 1); kit.say(D.recados.rodada?.(round + 1, ROUNDS) || `foto ${round + 1} de ${ROUNDS}`, 2200); }
        else { phase = 'done'; kit.finish(); }
      }
    },
    action() {}, // nesta fase o botão de pular não faz nada
    hud() {
      const total = cur?.pieces?.length || 0, got = lockedCount();
      const after = phase === 'card' || phase === 'gap' || phase === 'done';
      return {
        lines: [
          { text: total ? `foto ${round + 1}/${ROUNDS} · pedaços ${after ? total : got}/${total}` : `foto ${round + 1}/${ROUNDS}`, done: phase === 'cheer' || after },
          { text: `✿ ${L.gotFlowers}/${ROUNDS} · ▢ ${L.gotPhotos}/${ROUNDS}` }
        ]
      };
    },
    dispose() {
      closeRound();
      cur = null;
      phase = 'gone';
    },
    // ganchos de teste
    debugSolve() { if (phase === 'puzzle') for (const piece of cur.pieces) lock(piece, true); },
    debugPieces: () => ({ total: cur?.pieces?.length || 0, locked: lockedCount() }),
    debugPhoto: () => cur?.id,
    debugPicker: openPicker
  };
};
