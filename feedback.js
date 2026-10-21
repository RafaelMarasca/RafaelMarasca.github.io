(() => {
  'use strict';

  const arena = document.getElementById('no-return-arena');
  const noButton = document.getElementById('no-return');
  const caption = document.getElementById('no-return-caption');
  const yesOption = document.querySelector('[name="lulu-feedback"][value="beijinhos"]');
  const reply = document.getElementById('feedback-reply');
  const replyText = document.getElementById('feedback-text');
  const reset = document.getElementById('reset-feedback');
  if (!arena || !noButton || !caption || !yesOption || !reply || !replyText || !reset) return;

  const PAD = 12;
  const CAPTION_SPACE = 52;
  const FIRST_CAPTION = 'tem um botão meio tímido por aqui…';
  const captions = [
    'foi ali buscar coragem…',
    'ele ficou todo sem jeito. ♡',
    'até o botão quer mais um beijinho.',
    'voltou? não, foi dar uma voltinha.',
    'acho que ele está com saudade também.'
  ];
  let attempts = 0;
  let position = {x: 0, y: 0};
  let lastPointerDown = -Infinity;
  let initialized = false;

  function bounds() {
    const width = arena.clientWidth;
    const height = arena.clientHeight;
    const buttonWidth = noButton.offsetWidth;
    const buttonHeight = noButton.offsetHeight;
    return {
      width: buttonWidth,
      height: buttonHeight,
      minX: PAD,
      minY: PAD,
      maxX: Math.max(PAD, width - buttonWidth - PAD),
      maxY: Math.max(PAD, height - buttonHeight - CAPTION_SPACE - PAD)
    };
  }

  function place(next, limits = bounds()) {
    position = {
      x: Math.max(limits.minX, Math.min(limits.maxX, next.x)),
      y: Math.max(limits.minY, Math.min(limits.maxY, next.y))
    };
    noButton.style.transform = `translate(${Math.round(position.x)}px, ${Math.round(position.y)}px)`;
  }

  function initialPosition() {
    const limits = bounds();
    place({x: (limits.minX + limits.maxX) / 2, y: Math.min(28, limits.maxY)}, limits);
  }

  function distanceFromButton(point, candidate, limits) {
    const dx = Math.max(candidate.x - point.x, 0, point.x - candidate.x - limits.width);
    const dy = Math.max(candidate.y - point.y, 0, point.y - candidate.y - limits.height);
    return Math.hypot(dx, dy);
  }

  function evade(event) {
    const limits = bounds();
    const rect = arena.getBoundingClientRect();
    const pointer = {
      x: event.clientX - rect.left - arena.clientLeft,
      y: event.clientY - rect.top - arena.clientTop
    };
    const middleX = (limits.minX + limits.maxX) / 2;
    const middleY = (limits.minY + limits.maxY) / 2;
    const candidates = [
      {x: limits.minX, y: limits.minY},
      {x: limits.maxX, y: limits.maxY},
      {x: limits.maxX, y: limits.minY},
      {x: limits.minX, y: limits.maxY},
      {x: middleX, y: limits.minY},
      {x: middleX, y: limits.maxY},
      {x: limits.minX, y: middleY},
      {x: limits.maxX, y: middleY}
    ];
    // Primeiro sai de perto do dedo; a distância da posição atual desempata.
    const start = attempts % candidates.length;
    let destination = candidates[start];
    let bestScore = -Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[(start + i) % candidates.length];
      const distance = distanceFromButton(pointer, candidate, limits);
      const movement = Math.hypot(candidate.x - position.x, candidate.y - position.y);
      const score = distance * 4 + movement;
      if (score > bestScore) {
        destination = candidate;
        bestScore = score;
      }
    }
    place(destination, limits);
    caption.textContent = captions[attempts % captions.length];
    attempts += 1;
  }

  function showReply(text) {
    replyText.textContent = text;
    reply.hidden = false;
    reset.hidden = false;
  }

  yesOption.addEventListener('change', () => {
    if (!yesOption.checked) return;
    showReply('Combinado. Eu fico bem na direção dos seus beijinhos. Sem desviar, sem gracinha na última hora. E devolvo uns bem demorados. ♡');
    if (typeof window.scatterStars === 'function') {
      window.scatterStars(yesOption.closest('label').getBoundingClientRect(), 7);
    }
  });

  noButton.addEventListener('pointerenter', event => {
    // O toque já é tratado no pointerdown: assim cada toque provoca uma fuga.
    if (event.pointerType === 'touch' || event.pointerType === 'pen') return;
    evade(event);
  });

  noButton.addEventListener('pointerdown', event => {
    if (event.isPrimary === false || (event.button !== undefined && event.button !== 0)) return;
    lastPointerDown = Date.now();
    event.preventDefault();
    evade(event);
  });

  noButton.addEventListener('click', event => {
    const pointerClick = event.detail > 0 || ['mouse', 'touch', 'pen'].includes(event.pointerType);
    if (pointerClick) {
      event.preventDefault();
      // Algumas plataformas ainda emitem click depois de um pointerdown cancelado.
      if (Date.now() - lastPointerDown > 1000) evade(event);
      return;
    }
    // Enter, espaço e tecnologias assistivas mantêm a escolha de verdade.
    yesOption.checked = false;
    caption.textContent = 'o carinho continua respeitando seu espaço. ♡';
    showReply('Tudo bem, Lulu. Obrigado por ter aberto esse cantinho. A escolha é sua, e eu respeito o que você sente. ♡');
  }, {capture: true});

  reset.addEventListener('click', () => {
    yesOption.checked = false;
    reply.hidden = true;
    replyText.textContent = '';
    reset.hidden = true;
    attempts = 0;
    lastPointerDown = -Infinity;
    caption.textContent = FIRST_CAPTION;
    initialPosition();
    yesOption.focus({preventScroll: true});
  });

  arena.classList.add('is-evasive');
  initialPosition();
  initialized = true;
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(() => {
      if (!initialized) return;
      if (attempts === 0) initialPosition();
      else place(position);
    });
    observer.observe(arena);
    observer.observe(noButton);
  } else {
    window.addEventListener('resize', () => {
      if (attempts === 0) initialPosition();
      else place(position);
    }, {passive: true});
  }
})();
