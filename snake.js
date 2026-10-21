(() => {
  'use strict';

  const game = document.getElementById('snake-game');
  const canvas = document.getElementById('snake-canvas');
  const scoreLabel = document.getElementById('snake-score');
  const status = document.getElementById('snake-status');
  const startButton = document.getElementById('snake-start');
  const finale = document.getElementById('snake-finale');
  if (!game || !canvas || !scoreLabel || !status || !startButton) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    status.textContent = 'Essa cobrinha precisa de um navegador com canvas. O carinho continua valendo. ♡';
    startButton.disabled = true;
    return;
  }

  const CELLS = 16;
  const SIZE = 384;
  const CELL = SIZE / CELLS;
  const STEP_MS = 185;
  const DIRECTIONS = {
    up: {x: 0, y: -1},
    right: {x: 1, y: 0},
    down: {x: 0, y: 1},
    left: {x: -1, y: 0}
  };
  const KEYS = {
    ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left',
    w: 'up', d: 'right', s: 'down', a: 'left'
  };
  const TREATS = ['💛', '🍕', '🌙'];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let snake;
  let direction;
  let queuedDirection = null;
  let food;
  let score = 0;
  let state = 'idle';
  let ending = '';
  let timer = null;
  let finaleTimer = null;
  let pointerStart = null;
  let fallbackFrame = null;
  let inViewport = onScreen();

  canvas.setAttribute('aria-describedby', 'snake-status');
  const controls = game.querySelector('.snake-controls');
  if (controls) controls.setAttribute('role', 'group');

  function onScreen() {
    const rect = canvas.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
  }

  function canRun() {
    return !document.hidden && inViewport;
  }

  function clearTimer() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function clearFinaleTimer() {
    if (finaleTimer !== null) clearTimeout(finaleTimer);
    finaleTimer = null;
  }

  function updateFinaleGeometry() {
    if (!finale) return;
    const boardSize = canvas.getBoundingClientRect().width;
    finale.style.setProperty('--snatch-x', `${boardSize * .28}px`);
    finale.style.setProperty('--snatch-y', `${boardSize * -.23}px`);
    finale.style.setProperty('--moon-drop', `${boardSize * .07}px`);
  }

  function hideFinale() {
    clearFinaleTimer();
    if (finale) finale.hidden = true;
    game.classList.remove('finale-active', 'finale-complete');
  }

  function updateState(nextState) {
    state = nextState;
    game.dataset.snakeState = state;
    startButton.disabled = state === 'ending';
    if (state === 'ending') startButton.textContent = 'pera… a Lua está aprontando ☾';
    else if (state === 'running') startButton.textContent = 'pausar um pouquinho';
    else if (state === 'paused') startButton.textContent = 'continuar com o Rafo ☾';
    else if (state === 'over') startButton.textContent = 'tentar mais uma vez ♡';
    else startButton.textContent = 'jogar com o Rafo ☾';
  }

  function resetBoard() {
    clearTimer();
    hideFinale();
    snake = [{x: 5, y: 8}, {x: 4, y: 8}, {x: 3, y: 8}];
    direction = DIRECTIONS.right;
    queuedDirection = null;
    score = 0;
    ending = '';
    food = {x: 9, y: 8, emoji: '💛'};
    scoreLabel.textContent = '0 / 10';
    updateState('idle');
  }

  function scheduleStep() {
    clearTimer();
    if (state === 'running') timer = setTimeout(step, STEP_MS);
  }

  function resume() {
    if (state === 'ending') return;
    inViewport = onScreen();
    if (!canRun()) return;
    updateState('running');
    status.textContent = 'Valendo, Lulu. Vai buscar os corações, as pizzas e as luas. ♡';
    draw();
    scheduleStep();
  }

  function pause(message = 'Uma pausinha para respirar. A cobrinha espera por você. ♡') {
    if (state !== 'running') return;
    clearTimer();
    updateState('paused');
    status.textContent = message;
    draw();
  }

  function finish(reason) {
    clearTimer();
    if (reason === 'moon') {
      beginMoonFinale();
      return;
    }
    ending = reason;
    updateState('over');
    status.textContent = `Fim de jogo: ${score} ${score === 1 ? 'ponto' : 'pontos'}. Ainda bem que beijo não precisa de recorde. ♡`;
    draw();
  }

  function settleFinale() {
    if (state !== 'ending' || ending !== 'moon') return;
    clearFinaleTimer();
    game.classList.add('finale-complete');
    updateState('over');
    status.textContent = 'Quase, Lulu… O 10 fugiu pra Lua. ☾';
    draw();
  }

  function beginMoonFinale() {
    clearTimer();
    clearFinaleTimer();
    ending = 'moon';
    queuedDirection = null;
    pointerStart = null;
    updateState('ending');
    status.textContent = 'Quase, Lulu… a Lua está aprontando. ☾';
    updateFinaleGeometry();
    if (finale) finale.hidden = false;
    game.classList.remove('finale-complete');
    game.classList.add('finale-active');
    draw();
    if (reducedMotion.matches || !canRun() || !finale) settleFinale();
    else finaleTimer = setTimeout(settleFinale, 2700);
  }

  function pauseForAbsence(message) {
    if (state === 'ending') settleFinale();
    else pause(message);
  }

  function spawnFood() {
    const empty = [];
    const farEnough = [];
    const head = snake[0];
    for (let y = 0; y < CELLS; y++) {
      for (let x = 0; x < CELLS; x++) {
        if (snake.some(part => part.x === x && part.y === y)) continue;
        const cell = {x, y};
        empty.push(cell);
        if (Math.abs(head.x - x) + Math.abs(head.y - y) >= 3) farEnough.push(cell);
      }
    }
    const choices = farEnough.length ? farEnough : empty;
    const cell = choices[Math.floor(Math.random() * choices.length)];
    food = {...cell, emoji: TREATS[Math.floor(Math.random() * TREATS.length)]};
  }

  function step() {
    timer = null;
    if (state !== 'running') return;
    if (!canRun()) {
      pause('Deixei a cobrinha quietinha. Quando voltar, é só continuar. ♡');
      return;
    }
    if (queuedDirection) direction = queuedDirection;
    queuedDirection = null;
    const next = {x: snake[0].x + direction.x, y: snake[0].y + direction.y};
    if (next.x < 0 || next.x >= CELLS || next.y < 0 || next.y >= CELLS) {
      finish('wall');
      return;
    }
    const eating = next.x === food.x && next.y === food.y;
    // A última célula da cauda fica livre no mesmo passo em que a cabeça avança.
    const occupied = eating ? snake : snake.slice(0, -1);
    if (occupied.some(part => part.x === next.x && part.y === next.y)) {
      finish('hug');
      return;
    }
    snake.unshift(next);
    if (eating) {
      score += 1;
      scoreLabel.textContent = `${score} / 10`;
      if (score === 9) {
        // A surpresa é de propósito: a Lua fica com o décimo ponto.
        food = null;
        finish('moon');
        return;
      }
      status.textContent = `${score} ${score === 1 ? 'pontinho de carinho' : 'pontinhos de carinho'}. Continua, Lulu. ♡`;
      spawnFood();
    } else snake.pop();
    draw();
    scheduleStep();
  }

  function requestDirection(name) {
    if (!DIRECTIONS[name] || state === 'ending') return;
    if (state === 'idle' || state === 'over') {
      resetBoard();
      resume();
    } else if (state === 'paused') resume();
    if (state !== 'running' || queuedDirection) return;
    const next = DIRECTIONS[name];
    if (next.x === -direction.x && next.y === -direction.y) return;
    // Uma mudança por passo evita duas teclas rápidas virarem uma meia-volta.
    if (next.x !== direction.x || next.y !== direction.y) queuedDirection = next;
  }

  function roundedBox(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
    ctx.fill();
  }

  function draw() {
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = '#111c24';
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.strokeStyle = 'rgba(232,216,169,.055)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < CELLS; i++) {
      const position = i * CELL + .5;
      ctx.moveTo(position, 0);
      ctx.lineTo(position, SIZE);
      ctx.moveTo(0, position);
      ctx.lineTo(SIZE, position);
    }
    ctx.stroke();

    if (food) {
      ctx.fillStyle = '#263038';
      ctx.beginPath();
      ctx.arc((food.x + .5) * CELL, (food.y + .5) * CELL, CELL * .46, 0, Math.PI * 2);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '19px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      ctx.fillText(food.emoji, (food.x + .5) * CELL, (food.y + .53) * CELL);
    }

    for (let i = snake.length - 1; i >= 0; i--) {
      const part = snake[i];
      ctx.fillStyle = i === 0 ? '#e8d8a9' : '#aebea2';
      roundedBox(part.x * CELL + 2, part.y * CELL + 2, CELL - 4, CELL - 4, i === 0 ? 6 : 4);
    }
    const head = snake[0];
    const eyeX = head.x * CELL + CELL / 2 + direction.x * 5;
    const eyeY = head.y * CELL + CELL / 2 + direction.y * 5;
    ctx.fillStyle = '#23343a';
    for (const offset of [-4, 4]) {
      ctx.beginPath();
      ctx.arc(eyeX + (direction.y ? offset : 0), eyeY + (direction.x ? offset : 0), 1.7, 0, Math.PI * 2);
      ctx.fill();
    }

    if (state !== 'running') {
      ctx.fillStyle = 'rgba(10,18,25,.79)';
      ctx.fillRect(0, 0, SIZE, SIZE);
      // A cena lunar é HTML/CSS, com status acessível fora do canvas.
      if (ending === 'moon') return;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#e8d8a9';
      ctx.font = '33px Georgia, serif';
      ctx.fillText(state === 'idle' ? 'uma cobrinha pra Lulu. ☾' : state === 'paused' ? 'pausinha pro carinho.' : 'fim de jogo. ♡', SIZE / 2, 167, SIZE - 35);
      ctx.font = '12px "Courier New", monospace';
      ctx.fillStyle = '#b9c4ab';
      ctx.fillText(state === 'over' ? `${score} ${score === 1 ? 'ponto' : 'pontos'}. mais uma?` : state === 'paused' ? 'ela espera você continuar.' : 'corações, pizzas e luas pela frente.', SIZE / 2, 213, SIZE - 32);
    }
  }

  function resizeCanvas() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(SIZE * pixelRatio);
    canvas.height = Math.round(SIZE * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    updateFinaleGeometry();
    draw();
  }

  startButton.addEventListener('click', () => {
    if (state === 'ending') return;
    if (state === 'running') pause();
    else {
      if (state === 'idle' || state === 'over') resetBoard();
      resume();
    }
    canvas.focus({preventScroll: true});
  });

  game.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (KEYS[key]) {
      event.preventDefault();
      requestDirection(KEYS[key]);
    } else if (event.key === 'Escape') pause();
  });

  game.querySelectorAll('[data-snake-direction]').forEach(button => {
    button.addEventListener('click', () => requestDirection(button.dataset.snakeDirection));
  });

  canvas.addEventListener('pointerdown', event => {
    if (state === 'ending') return;
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    pointerStart = {x: event.clientX, y: event.clientY, id: event.pointerId};
    canvas.focus({preventScroll: true});
    try { canvas.setPointerCapture(event.pointerId); } catch { /* Um gesto cancelado não interrompe o jogo. */ }
  });
  canvas.addEventListener('pointerup', event => {
    if (state === 'ending') {
      pointerStart = null;
      return;
    }
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    pointerStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= 12) {
      requestDirection(Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up');
    } else if (state !== 'running') {
      if (state === 'idle' || state === 'over') resetBoard();
      resume();
    }
  });
  canvas.addEventListener('pointercancel', () => { pointerStart = null; });
  canvas.addEventListener('lostpointercapture', () => { pointerStart = null; });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseForAbsence('Deixei a cobrinha quietinha. Quando voltar, é só continuar. ♡');
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      inViewport = entries[0].isIntersecting;
      if (!inViewport) pauseForAbsence('A cobrinha ficou te esperando aqui. Continua quando quiser. ♡');
    }, {threshold: 0});
    observer.observe(canvas);
  } else {
    window.addEventListener('scroll', () => {
      if (fallbackFrame !== null) return;
      fallbackFrame = requestAnimationFrame(() => {
        fallbackFrame = null;
        inViewport = onScreen();
        if (!inViewport) pauseForAbsence('A cobrinha ficou te esperando aqui. Continua quando quiser. ♡');
      });
    }, {passive: true});
  }
  window.addEventListener('resize', resizeCanvas, {passive: true});
  window.addEventListener('pagehide', () => {
    pauseForAbsence();
    clearTimer();
    clearFinaleTimer();
    if (fallbackFrame !== null) cancelAnimationFrame(fallbackFrame);
    fallbackFrame = null;
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches && state === 'ending') settleFinale();
    else draw();
  });
  resetBoard();
  resizeCanvas();
})();
