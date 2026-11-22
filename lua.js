'use strict';
const config = window.SITE_CONFIG || {};
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Só anima transform e opacity; a página permanece legível sem JavaScript.
if ('IntersectionObserver' in window && !reduceMotion.matches) {
  document.documentElement.classList.add('motion-ready');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, {threshold:.08, rootMargin:'0px 0px 15px 0px'});
  document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
  reduceMotion.addEventListener('change', event => {
    if (event.matches) {
      document.documentElement.classList.remove('motion-ready');
      observer.disconnect();
    }
  });
}

function scatterStars(rect, count = 12, symbols = ['♡','✦','✧','✦'], spread = 80) {
  if (reduceMotion.matches) return [];
  const layer = document.getElementById('stardust');
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const particles = [];
  for (let i = 0; i < count; i++) {
    const star = document.createElement('span');
    const angle = (Math.PI * 2 * i) / count;
    const distance = 55 + Math.random() * spread;
    star.className = 'particle';
    star.textContent = symbols[i % symbols.length];
    if (star.textContent === '☾' || star.textContent === '☽') star.classList.add('moon-particle');
    star.style.left = `${centerX}px`;
    star.style.top = `${centerY}px`;
    star.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
    star.style.setProperty('--dy', `${Math.sin(angle) * distance - 35}px`);
    star.style.setProperty('--turn', `${Math.random() * 90 - 45}deg`);
    layer.append(star);
    particles.push(star);
    star.addEventListener('animationend', () => star.remove(), {once:true});
  }
  return particles;
}

// O details mantém a carta utilizável por toque, teclado e sem JavaScript.
const lunarLetter = document.getElementById('lunar-letter');
const letterTrigger = document.getElementById('letter-trigger');
const letterContent = document.getElementById('letter-content');
const letterHint = document.getElementById('letter-hint');
let letterTimers = [];
let letterParticles = [];
let letterOpening = 0;
let letterHasOpened = false;

function clearLetterEffects() {
  letterTimers.forEach(clearTimeout);
  letterTimers = [];
  letterParticles.forEach(particle => particle.remove());
  letterParticles = [];
}

lunarLetter.addEventListener('toggle', () => {
  clearLetterEffects();
  const opening = ++letterOpening;
  letterHint.textContent = lunarLetter.open ? 'toque para fechar' : letterHasOpened ? 'toque para abrir de novo' : 'toque para abrir';
  if (!lunarLetter.open) return;
  letterHasOpened = true;
  const startScroll = window.scrollY;
  const focusAtOpen = document.activeElement;

  function showLetter() {
    if (!lunarLetter.open || opening !== letterOpening) return;
    const rect = letterTrigger.getBoundingClientRect();
    if (rect.bottom < 40 || rect.top > window.innerHeight - 40) return;
    if (Math.abs(window.scrollY - startScroll) > 40) return;
    if (document.activeElement !== focusAtOpen && !letterTrigger.contains(document.activeElement)) return;
    letterContent.focus({preventScroll:true});
    const contentRect = letterContent.getBoundingClientRect();
    if (!reduceMotion.matches || contentRect.top > window.innerHeight * .7 || contentRect.top < 0) {
      letterContent.scrollIntoView({behavior:reduceMotion.matches ? 'auto' : 'smooth', block:'start'});
    }
  }

  if (reduceMotion.matches) {
    showLetter();
    return;
  }
  letterTimers.push(setTimeout(() => {
    if (!lunarLetter.open || opening !== letterOpening || reduceMotion.matches) return;
    letterParticles = scatterStars(document.querySelector('.envelope-stage').getBoundingClientRect(), 32, ['☾','✦','✧','♡','☽','✦'], 175);
  }, 330));
  letterTimers.push(setTimeout(showLetter, 1050));
});

document.getElementById('fold-letter').addEventListener('click', () => {
  clearLetterEffects();
  ++letterOpening;
  lunarLetter.open = false;
  letterTrigger.focus({preventScroll:true});
  letterTrigger.scrollIntoView({behavior:reduceMotion.matches ? 'auto' : 'smooth', block:'center'});
});

const moon = document.getElementById('moon-wish');
const moonMessages = [
  'Lulu, essa lua é só uma desculpa pra falar de você. ♡',
  'Tem um pouquinho de saudade brilhando por aqui.',
  'Eu colocaria uma lua no seu céu. Comecei por esta.',
  'Tá vendo? Mais um toque seu e eu já fico todo estrelado.'
];
let wish = 0;
let lastMoonTouch = 0;
moon.addEventListener('click', () => {
  if (Date.now() - lastMoonTouch < 600) return;
  lastMoonTouch = Date.now();
  document.getElementById('moon-message').textContent = moonMessages[wish++ % moonMessages.length];
  scatterStars(moon.getBoundingClientRect(), 18);
  moon.classList.remove('pulse');
  requestAnimationFrame(() => moon.classList.add('pulse'));
});
moon.addEventListener('animationend', event => {
  if (event.animationName === 'moon-pulse') moon.classList.remove('pulse');
});

const photoAlts = {retrato:'Ilustração de Lulu sorrindo com flores e uma lua dourada.', cabelo:'Ilustração de Lulu fazendo uma carinha de brava, com uma margarida na mão.', nosDois:'Ilustração de Lulu e Rafo abraçadinhos, com flores ao luar.'};
document.querySelectorAll('[data-photo]').forEach(slot => {
  const key = slot.dataset.photo;
  if (!config.fotos?.[key]) return;
  if (slot.querySelector('img')?.getAttribute('src') === config.fotos[key]) return;
  const photo = new Image();
  photo.alt = photoAlts[key];
  photo.decoding = 'async';
  photo.addEventListener('load', () => {
    slot.replaceChildren(photo);
    slot.classList.add('has-photo');
  }, {once:true});
  photo.src = config.fotos[key];
});

// A trilha toca em loop. Quando o navegador pede um gesto, o primeiro toque
// ou tecla tenta iniciá-la; não há botão de play.
const audio = document.getElementById('love-song');
const mute = document.getElementById('mute-music');
const musicStatus = document.getElementById('music-status');
let playPending = false;
let musicReady = false;
let musicStarted = false;
async function startMusic() {
  if (!musicReady || musicStarted || playPending) return;
  playPending = true;
  try {
    await audio.play();
    musicStarted = true;
    mute.hidden = false;
    musicStatus.textContent = 'TOCANDO EM LOOP, COM CARINHO';
    document.querySelector('.music-icon').classList.add('playing');
    document.removeEventListener('click', startMusic);
    document.removeEventListener('keydown', startMusic);
  } catch {
    // Mantém os listeners para a próxima interação permitida pelo navegador.
  } finally {
    playPending = false;
  }
}
if (config.musica) {
  musicReady = true;
  audio.volume = .35;
  audio.src = config.musica;
  audio.addEventListener('canplay', startMusic, {once:true});
  audio.addEventListener('error', () => {
    musicReady = false;
    musicStarted = false;
    mute.hidden = true;
    musicStatus.textContent = 'A TRILHA DESTA CARTINHA';
    document.querySelector('.music-icon').classList.remove('playing');
  });
  audio.load();
  startMusic();
}
document.addEventListener('click', startMusic);
document.addEventListener('keydown', startMusic);
mute.addEventListener('click', () => {
  audio.muted = !audio.muted;
  mute.textContent = audio.muted ? 'som desligado ↗' : 'som ligado ↗';
  mute.setAttribute('aria-label', audio.muted ? 'Ativar som da música' : 'Silenciar música');
  musicStatus.textContent = audio.muted ? 'UM POUQUINHO DE SILÊNCIO' : 'TOCANDO EM LOOP, COM CARINHO';
  document.querySelector('.music-icon').classList.toggle('playing', !audio.muted);
});
