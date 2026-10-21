(() => {
  'use strict';

  const game = document.getElementById('moonlander-game');
  const canvas = document.getElementById('moonlander-canvas');
  const start = document.getElementById('moonlander-start');
  const pauseButton = document.getElementById('moonlander-pause');
  const status = document.getElementById('moonlander-status');
  const altitude = document.getElementById('moonlander-altitude');
  const speed = document.getElementById('moonlander-speed');
  const fuel = document.getElementById('moonlander-fuel');
  if (!game || !canvas || !start || !pauseButton || !status || !altitude || !speed || !fuel) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    status.textContent = 'Essa navinha precisa de um navegador com canvas. O carinho continua aqui. ♡';
    start.disabled = true;
    return;
  }

  const WIDTH = 720;
  const HEIGHT = 820;
  const STEP = 1 / 120;
  const MAX_DELTA = .05;
  const GRAVITY = 13;
  const THRUST = 48;
  const LATERAL = 42;
  const FOOT = 34;
  const RADIUS = 62;
  const WALL_RADIUS = 76;
  const PAD = {x: 425, y: 690, width: 225};
  const SAFE_VERTICAL = 78;
  const SAFE_HORIZONTAL = 80;
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const buttons = [...game.querySelectorAll('[data-lander-control]')];
  const keys = new Set();
  const pointers = new Map();
  const pulses = new Map();
  const keyMap = {ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'thrust', w: 'thrust', ' ': 'thrust'};
  const stars = Array.from({length: 52}, (_, i) => ({x: (i * 137 + 31) % WIDTH, y: (i * 83 + 49) % 610, r: i % 5 === 0 ? 1.8 : 1}));
  const confetti = Array.from({length: 20}, (_, i) => ({angle: i * 2.399, reach: 45 + (i * 31) % 160, symbol: i % 4 === 0 ? '♡' : i % 2 ? '✧' : '✦'}));
  const sprites = {ship: null, couple: null};
  let spritesRequested = false;
  let ship;
  let state = 'idle';
  let elapsed = 0;
  let effectAge = 0;
  let effectActive = false;
  let raf = null;
  let lastFrame = null;
  let accumulator = 0;
  let fallbackRaf = null;
  let visible = onScreen();
  let guidance = '';

  canvas.setAttribute('aria-describedby', 'moonlander-status');
  buttons.forEach(button => button.setAttribute('aria-pressed', 'false'));

  function onScreen() {
    const rect = canvas.getBoundingClientRect();
    return rect.width > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
  }

  function held(name) {
    return keys.has(name) || [...pointers.values()].some(pointer => pointer.control === name) || (pulses.get(name) || 0) > elapsed;
  }

  function markButtons() {
    buttons.forEach(button => button.setAttribute('aria-pressed', String(held(button.dataset.landerControl))));
  }

  function clearInputs() {
    keys.clear();
    pulses.clear();
    const previous = [...pointers.entries()];
    pointers.clear();
    previous.forEach(([id, pointer]) => {
      try {
        if (pointer.button.hasPointerCapture(id)) pointer.button.releasePointerCapture(id);
      } catch { /* Um gesto já cancelado não precisa de outra ação. */ }
    });
    markButtons();
  }

  function stopLoop() {
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
    lastFrame = null;
    accumulator = 0;
  }

  function updateState(next) {
    state = next;
    game.dataset.landerState = state;
    pauseButton.disabled = state !== 'flying' && state !== 'paused';
    pauseButton.textContent = state === 'paused' ? 'continuar' : 'pausar';
    pauseButton.setAttribute('aria-label', state === 'paused' ? 'Continuar missão' : 'Pausar missão');
    start.textContent = state === 'paused' ? 'continuar nossa viagem ☾' : state === 'landed' ? 'repetir nossa viagem ☾' : state === 'crashed' ? 'tentar um pousinho de novo ♡' : state === 'flying' ? 'recomeçar devagar ♡' : 'embarcar com você ♡';
  }

  function reset() {
    stopLoop();
    clearInputs();
    elapsed = 0;
    effectAge = 0;
    effectActive = false;
    guidance = '';
    ship = {x: 220, y: 155, vx: 0, vy: 6, tilt: 0, fuel: 100};
  }

  function queueFrame() {
    if (raf === null) raf = requestAnimationFrame(frame);
  }

  function startMission(focus = true) {
    visible = onScreen();
    if (document.hidden || !visible) return false;
    reset();
    loadSprites();
    updateState('flying');
    status.textContent = 'Vem pra faixa iluminada. Segure impulso para frear e solte as setinhas para chegar com calma. ♡';
    draw();
    queueFrame();
    if (focus) canvas.focus({preventScroll: true});
    return true;
  }

  function resume(focus = true) {
    visible = onScreen();
    if (state !== 'paused' || document.hidden || !visible) return false;
    clearInputs();
    lastFrame = null;
    accumulator = 0;
    updateState('flying');
    status.textContent = 'Continuamos daqui. Vai devagarinho: tem amor a bordo. ♡';
    queueFrame();
    if (focus) canvas.focus({preventScroll: true});
    return true;
  }

  function pause(message = 'Uma pausinha. A Lua espera pela gente. ♡') {
    clearInputs();
    stopLoop();
    if (state === 'flying') {
      updateState('paused');
      status.textContent = message;
    }
    if (effectActive) {
      effectAge = 2;
      effectActive = false;
    }
    draw();
  }

  function canControl() {
    if (state === 'paused') return false;
    if (state === 'flying') return true;
    return startMission(false);
  }

  function outcome(success) {
    clearInputs();
    ship.vx = 0;
    ship.vy = 0;
    ship.tilt = 0;
    effectAge = media.matches ? 2 : 0;
    effectActive = !media.matches;
    updateState(success ? 'landed' : 'crashed');
    status.textContent = success ? 'pousamos. agora é só ficar juntinhos. ♡' : 'ops, pousamos no susto. mais uma? ♡';
    guidance = '';
    updateHud();
  }

  function terrain(x) {
    const plain = 733 + Math.sin(x * .011) * 11 + Math.cos(x * .027) * 5;
    if (x < PAD.x - 45 || x > PAD.x + PAD.width + 45) return plain;
    const outside = Math.max(PAD.x - x, x - PAD.x - PAD.width, 0);
    return Math.min(plain, PAD.y + 13 + outside * .55);
  }

  function physics(dt) {
    if (state !== 'flying') return;
    elapsed += dt;
    const steering = Number(held('right')) - Number(held('left'));
    const thrusting = held('thrust') && ship.fuel > 0;
    ship.fuel = thrusting ? Math.max(0, ship.fuel - 8 * dt) : held('thrust') ? ship.fuel : Math.min(100, ship.fuel + 3.5 * dt);
    ship.vx = Math.max(-95, Math.min(95, (ship.vx + steering * LATERAL * dt) * Math.exp(-.48 * dt)));
    ship.vy = Math.max(-95, Math.min(150, ship.vy + (GRAVITY - (thrusting ? THRUST : 0)) * dt));
    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;
    ship.tilt += (steering * .24 - ship.tilt) * Math.min(1, dt * 5);
    if (ship.x < WALL_RADIUS) { ship.x = WALL_RADIUS; ship.vx = Math.abs(ship.vx) * .2; }
    if (ship.x > WIDTH - WALL_RADIUS) { ship.x = WIDTH - WALL_RADIUS; ship.vx = -Math.abs(ship.vx) * .2; }
    if (ship.y < 120) { ship.y = 120; ship.vy = Math.max(0, ship.vy); }

    const foot = ship.y + FOOT;
    const touchesPad = ship.x + RADIUS > PAD.x && ship.x - RADIUS < PAD.x + PAD.width;
    if (touchesPad && foot >= PAD.y) {
      const inside = ship.x - RADIUS >= PAD.x + 5 && ship.x + RADIUS <= PAD.x + PAD.width - 5;
      const gentle = ship.vy >= 0 && ship.vy <= SAFE_VERTICAL && Math.abs(ship.vx) <= SAFE_HORIZONTAL;
      ship.y = PAD.y - FOOT;
      outcome(inside && gentle);
      return;
    }
    if (foot >= terrain(ship.x)) {
      ship.y = terrain(ship.x) - FOOT;
      outcome(false);
    }
  }

  function frame(timestamp) {
    raf = null;
    if (document.hidden || !visible) {
      pause('Guardei nossa navinha aqui. Continua quando quiser. ♡');
      return;
    }
    const dt = lastFrame === null ? 0 : Math.min(MAX_DELTA, Math.max(0, (timestamp - lastFrame) / 1000));
    lastFrame = timestamp;
    if (state === 'flying') {
      accumulator += dt;
      while (accumulator >= STEP && state === 'flying') {
        physics(STEP);
        accumulator -= STEP;
      }
      updateHud();
    }
    if (effectActive) {
      effectAge = Math.min(2, effectAge + dt);
      if (effectAge >= (state === 'landed' ? 1.8 : .75)) effectActive = false;
    }
    draw();
    if (state === 'flying' || effectActive) queueFrame();
    else { lastFrame = null; accumulator = 0; }
  }

  function updateHud() {
    const height = Math.max(0, Math.round((PAD.y - ship.y - FOOT) * .2));
    const velocity = Math.round(Math.hypot(ship.vx, ship.vy) * .2);
    altitude.textContent = `${height} m`;
    speed.textContent = `${velocity} m/s`;
    fuel.textContent = `${Math.round(ship.fuel)}%`;
    const calm = ship.vy <= SAFE_VERTICAL && Math.abs(ship.vx) <= SAFE_HORIZONTAL;
    game.dataset.landerSpeed = calm ? 'calm' : 'fast';
    game.dataset.landerFuel = ship.fuel < 20 ? 'low' : 'full';
    markButtons();
    if (state !== 'flying') return;
    const next = ship.fuel <= 0 ? 'fuel' : height < 45 && !calm ? 'brake' : height < 40 ? 'approach' : '';
    if (next === guidance) return;
    guidance = next;
    if (next === 'fuel') status.textContent = 'Solta o impulso um pouquinho: nosso carinho recarrega. ♡';
    else if (next === 'brake') status.textContent = 'Estamos chegando. Segura o impulso para frear e procura o meio da faixa iluminada. ♡';
    else if (next === 'approach') status.textContent = 'Isso, bem devagarinho. A faixa iluminada é nosso cantinho. ♡';
  }

  function cropSprite(image) {
    try {
      const scale = Math.min(1, 160 / Math.max(image.naturalWidth, image.naturalHeight));
      const sample = document.createElement('canvas');
      sample.width = Math.max(1, Math.round(image.naturalWidth * scale));
      sample.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const sampleContext = sample.getContext('2d', {willReadFrequently: true});
      sampleContext.drawImage(image, 0, 0, sample.width, sample.height);
      const pixels = sampleContext.getImageData(0, 0, sample.width, sample.height).data;
      let left = sample.width, top = sample.height, right = -1, bottom = -1;
      for (let y = 0; y < sample.height; y++) {
        for (let x = 0; x < sample.width; x++) {
          if (pixels[(y * sample.width + x) * 4 + 3] < 12) continue;
          left = Math.min(left, x); right = Math.max(right, x);
          top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
      }
      if (right >= left && bottom >= top) return {image, x: left / scale, y: top / scale, width: (right - left + 1) / scale, height: (bottom - top + 1) / scale};
    } catch { /* A nave vetorial continua funcionando se o recorte não estiver disponível. */ }
    return {image, x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight};
  }

  function loadSprites() {
    if (spritesRequested) return;
    spritesRequested = true;
    [
      ['ship', './assets/moonlander/nave-lulu-rafo.webp'],
      ['couple', './assets/moonlander/astronautas-lulu-rafo.webp']
    ].forEach(([key, path]) => {
      const image = new Image();
      image.decoding = 'async';
      image.addEventListener('load', () => {
        if (image.naturalWidth > 0 && image.naturalHeight > 0) sprites[key] = cropSprite(image);
        draw();
      }, {once: true});
      image.addEventListener('error', () => { sprites[key] = null; draw(); }, {once: true});
      image.src = path;
    });
  }

  function rounded(x, y, width, height, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath(); ctx.fill();
  }

  function circle(x, y, radius, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
  }

  function print(text, x, y, size, color = '#e8d8a9', family = 'Georgia, serif') {
    ctx.font = `${size}px ${family}`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }

  function spriteAt(sprite, x, baseline, maxWidth, maxHeight) {
    const ratio = Math.min(maxWidth / sprite.width, maxHeight / sprite.height);
    const width = sprite.width * ratio, height = sprite.height * ratio;
    ctx.drawImage(sprite.image, sprite.x, sprite.y, sprite.width, sprite.height, x - width / 2, baseline - height, width, height);
  }

  function drawShip() {
    const bounce = state === 'crashed' && !media.matches ? -Math.sin(Math.min(1, effectAge / .75) * Math.PI) * 13 : 0;
    ctx.save();
    ctx.translate(ship.x, ship.y + bounce);
    ctx.rotate(ship.tilt);
    if (state === 'flying' && held('thrust') && ship.fuel > 0) {
      const length = media.matches ? 26 : 23 + Math.sin(elapsed * 37) * 6;
      ctx.fillStyle = '#e9bc8066';
      ctx.beginPath(); ctx.moveTo(-12, FOOT - 4); ctx.lineTo(0, FOOT + length); ctx.lineTo(12, FOOT - 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff2b8';
      ctx.beginPath(); ctx.moveTo(-5, FOOT - 4); ctx.lineTo(0, FOOT + length * .7); ctx.lineTo(5, FOOT - 4); ctx.closePath(); ctx.fill();
    }
    if (sprites.ship) spriteAt(sprites.ship, 0, FOOT, 148, 160);
    else {
      ctx.strokeStyle = '#d7d5b4'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-23, 17); ctx.lineTo(-33, FOOT); ctx.lineTo(-42, FOOT); ctx.moveTo(23, 17); ctx.lineTo(33, FOOT); ctx.lineTo(42, FOOT); ctx.stroke();
      rounded(-39, -26, 78, 52, 20, '#b8c5ac');
      rounded(-28, -42, 56, 30, 14, '#d9decb');
      circle(-14, -8, 13, '#304c5d'); circle(14, -8, 13, '#304c5d');
      circle(-17, -12, 3, '#afc7c888'); circle(11, -12, 3, '#afc7c888');
      print('L + R', 0, 15, 11, '#405548', '"Courier New", monospace');
    }
    ctx.restore();
  }

  function draw() {
    if (!ship) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, '#0c1722'); sky.addColorStop(.68, '#1d303d'); sky.addColorStop(1, '#314149');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    stars.forEach(star => circle(star.x, star.y, star.r, '#e7ddbb88'));
    circle(95, 143, 35, '#739eac');
    ctx.save(); ctx.beginPath(); ctx.arc(95, 143, 35, 0, Math.PI * 2); ctx.clip();
    circle(79, 128, 20, '#a9b896'); circle(109, 159, 19, '#adbda0');
    ctx.fillStyle = '#d4e2dd55'; ctx.fillRect(60, 134, 70, 6); ctx.restore();
    circle(626, 87, 27, '#e8d8a9'); circle(637, 78, 24, '#10202d');

    ctx.fillStyle = '#35464b'; ctx.beginPath(); ctx.moveTo(0, HEIGHT);
    for (let x = 0; x <= WIDTH; x += 8) ctx.lineTo(x, terrain(x));
    ctx.lineTo(WIDTH, HEIGHT); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#a9b89a55'; ctx.lineWidth = 2; ctx.beginPath();
    for (let x = 0; x <= WIDTH; x += 8) { if (x === 0) ctx.moveTo(x, terrain(x)); else ctx.lineTo(x, terrain(x)); }
    ctx.stroke();
    [[72, 777, 31, 9], [238, 754, 42, 11], [377, 794, 26, 7], [637, 775, 29, 8]].forEach(([x, y, rx, ry]) => {
      ctx.fillStyle = '#24383f'; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, -.12, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#667a6d55'; ctx.lineWidth = 2; ctx.stroke();
    });
    [35, 126, 194, 319, 391, 677].forEach((x, i) => {
      const y = terrain(x) - 5;
      ctx.strokeStyle = '#8ea98a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y + 7); ctx.lineTo(x, y - 11); ctx.stroke();
      for (let n = 0; n < 5; n++) circle(x + Math.cos(n * 1.257) * 4, y - 12 + Math.sin(n * 1.257) * 4, 3, i % 2 ? '#d8b2ac' : '#dcd5ad');
      circle(x, y - 12, 2, '#d5b877');
    });
    const glow = ctx.createRadialGradient(PAD.x + PAD.width / 2, PAD.y, 1, PAD.x + PAD.width / 2, PAD.y, 155);
    glow.addColorStop(0, '#e8d8a925'); glow.addColorStop(1, '#e8d8a900'); ctx.fillStyle = glow; ctx.fillRect(PAD.x - 55, PAD.y - 130, PAD.width + 110, 180);
    rounded(PAD.x, PAD.y, PAD.width, 12, 5, '#b9c4ab');
    rounded(PAD.x + 5, PAD.y, PAD.width - 10, 3, 1, '#f0dfae');
    [PAD.x + 13, PAD.x + PAD.width - 13].forEach(x => { ctx.strokeStyle = '#b9c4ab'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, PAD.y); ctx.lineTo(x, PAD.y - 27); ctx.stroke(); circle(x, PAD.y - 28, 4, '#f3e3b4'); });
    print('NOSSO CANTINHO', PAD.x + PAD.width / 2, PAD.y + 30, 11, '#c4cbb7', '"Courier New", monospace');

    if (state === 'landed') {
      const progress = media.matches ? 1 : Math.min(1, effectAge / .7);
      ctx.save(); ctx.globalAlpha = progress;
      if (sprites.couple) spriteAt(sprites.couple, PAD.x + PAD.width / 2, PAD.y - 4, 195, 200);
      else { print('♡', PAD.x + PAD.width / 2 - 25, PAD.y - 55, 54, '#e5bdb3'); print('♡', PAD.x + PAD.width / 2 + 25, PAD.y - 72, 48, '#e8d8a9'); print('Lulu + Rafo', PAD.x + PAD.width / 2, PAD.y - 22, 17, '#e8d8a9'); }
      ctx.restore();
      if (!media.matches && effectAge < 1.8) {
        const phase = effectAge / 1.8;
        confetti.forEach(spark => {
          ctx.save(); ctx.globalAlpha = Math.max(0, 1 - phase);
          print(spark.symbol, PAD.x + PAD.width / 2 + Math.cos(spark.angle) * spark.reach * phase, PAD.y - 110 + Math.sin(spark.angle) * spark.reach * phase - Math.sin(phase * Math.PI) * 80, 21, spark.symbol === '♡' ? '#e5bdb3' : '#e8d8a9');
          ctx.restore();
        });
      }
    } else drawShip();

    if (state === 'idle') {
      print('um pousinho a dois.', WIDTH / 2, 333, 35);
      print('a faixa iluminada é nosso destino. ♡', WIDTH / 2, 378, 14, '#bdc8ba', '"Courier New", monospace');
      print('↓', PAD.x + PAD.width / 2, PAD.y - 65, 29, '#e8d8a9');
    } else if (state === 'paused') {
      ctx.fillStyle = '#0b1721b8'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
      print('a Lua sabe esperar.', WIDTH / 2, 355, 36);
      print('continua quando quiser. ♡', WIDTH / 2, 405, 17, '#bdc8ba', '"Courier New", monospace');
    } else if (state === 'landed') {
      print('chegamos, meu amor.', WIDTH / 2, 310, 37);
      print('agora é só ficar juntinhos. ♡', WIDTH / 2, 355, 17, '#bdc8ba', '"Courier New", monospace');
    } else if (state === 'crashed') {
      print('um pousinho com emoção.', WIDTH / 2, 330, 32);
      print('vamos tentar mais devagar? ♡', WIDTH / 2, 375, 16, '#bdc8ba', '"Courier New", monospace');
      print('♡', ship.x + 45, ship.y - 75, 25, '#ddbbb0');
    }
  }

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const scale = ((canvas.getBoundingClientRect().width || WIDTH) / WIDTH) * ratio;
    canvas.width = Math.round(WIDTH * scale);
    canvas.height = Math.round(HEIGHT * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    draw();
  }

  start.addEventListener('click', () => { if (state === 'paused') resume(); else startMission(); });
  pauseButton.addEventListener('click', () => { if (state === 'paused') resume(); else pause(); });
  canvas.addEventListener('pointerdown', () => canvas.focus({preventScroll: true}));

  game.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape') { event.preventDefault(); pause(); return; }
    if (event.target === start || event.target === pauseButton) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const control = keyMap[key];
    if (!control) return;
    event.preventDefault();
    if (event.repeat && state !== 'flying') return;
    if (!canControl()) return;
    keys.add(control);
    markButtons();
  });
  window.addEventListener('keyup', event => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (keyMap[key]) { keys.delete(keyMap[key]); markButtons(); }
  });

  buttons.forEach(button => {
    const control = button.dataset.landerControl;
    button.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      if (!canControl()) return;
      pointers.set(event.pointerId, {control, button});
      try { button.setPointerCapture(event.pointerId); } catch { /* O cancelamento do gesto solta o controle. */ }
      markButtons();
    });
    const release = event => { pointers.delete(event.pointerId); markButtons(); };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
    button.addEventListener('keydown', event => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      event.preventDefault(); event.stopPropagation();
      if (event.repeat && state !== 'flying') return;
      if (canControl()) { keys.add(control); markButtons(); }
    });
    button.addEventListener('keyup', event => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      event.preventDefault(); keys.delete(control); markButtons();
    });
    button.addEventListener('click', event => {
      if (event.detail > 0 || event.pointerType) return;
      if (canControl()) { pulses.set(control, elapsed + .3); markButtons(); }
    });
  });

  game.addEventListener('focusout', event => {
    if (!game.contains(event.relatedTarget)) pause('Nossa navinha ficou esperando aqui. Continua quando quiser. ♡');
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause('Guardei nossa navinha aqui. Continua quando quiser. ♡'); });
  window.addEventListener('blur', () => pause());
  window.addEventListener('pagehide', () => {
    pause();
    if (fallbackRaf !== null) cancelAnimationFrame(fallbackRaf);
    fallbackRaf = null;
  });
  window.addEventListener('resize', resize, {passive: true});
  media.addEventListener('change', () => {
    if (media.matches && effectActive) { effectAge = 2; effectActive = false; if (state !== 'flying') stopLoop(); }
    draw();
  });

  reset(); updateState('idle'); updateHud(); resize();
  if ('IntersectionObserver' in window) {
    const visibility = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (!visible) pause('Nossa navinha ficou esperando aqui. Continua quando quiser. ♡');
    }, {threshold: 0});
    visibility.observe(canvas);
    const loader = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { loadSprites(); loader.disconnect(); }
    }, {rootMargin: '400px 0px', threshold: 0});
    loader.observe(canvas);
  } else {
    window.addEventListener('scroll', () => {
      if (fallbackRaf !== null) return;
      fallbackRaf = requestAnimationFrame(() => {
        fallbackRaf = null;
        visible = onScreen();
        if (visible) loadSprites(); else pause();
      });
    }, {passive: true});
    if (visible) loadSprites();
  }
})();
