(() => {
  'use strict';

  function initAlbum() {
    const book = document.getElementById('album-book') || document.getElementById('album-root');
    const current = document.getElementById('album-current');
    if (!book || !current || book.dataset.albumInitialized === 'true') return;
    book.dataset.albumInitialized = 'true';

    const pages = Array.isArray(window.ALBUM_PAGES)
      ? window.ALBUM_PAGES.map((page) => page && typeof page === 'object' ? page : {})
      : [];
    const cover = document.getElementById('album-cover');
    const turnLayer = document.getElementById('album-turn-layer');
    const openButton = document.getElementById('album-open');
    const previousButton = document.getElementById('album-prev');
    const nextButton = document.getElementById('album-next');
    const progress = document.getElementById('album-progress');
    const progressFill = document.getElementById('album-progress-fill');
    const counter = document.getElementById('album-counter');
    const chapterLabel = document.getElementById('album-chapter');
    const status = document.getElementById('album-status');
    const audio = document.getElementById('album-audio');
    const musicButton = document.getElementById('album-music-button');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointers = new Set();
    const interactive = 'button, a, input, textarea, select, [contenteditable]:not([contenteditable="false"]), [data-no-swipe]';

    let index = -1;
    let turning = false;
    let finishTurn = null;
    let gesture = null;
    let preload = null;
    let preloadSource = '';
    let musicWanted = true;
    let musicAttempt = null;

    function element(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = String(text);
      return node;
    }

    function text(value, fallback = '') {
      return value === undefined || value === null ? fallback : String(value);
    }

    function pageNumber(value) {
      return String(value + 1).padStart(2, '0');
    }

    function announce(message) {
      if (status) status.textContent = message;
    }

    function pageAnnouncement() {
      if (index < 0) return pages.length ? `Álbum fechado. ${pages.length} páginas de Lulu e Rafo.` : 'As nossas memórias estão chegando.';
      const caption = text(pages[index].caption);
      return `Página ${index + 1} de ${pages.length}.${caption ? ` ${caption}` : ''}`;
    }

    function createPage(page, pageIndex) {
      const data = page && typeof page === 'object' ? page : {};
      const isFuture = data.kind === 'future';
      const width = Number(data.width);
      const height = Number(data.height);
      const article = element('article', `album-page ${width > height ? 'landscape' : 'portrait'}`);
      if (isFuture) article.classList.add('future-page');
      article.dataset.photoId = text(data.id, pageNumber(pageIndex));
      article.tabIndex = -1;

      const topline = element('div', 'page-topline');
      topline.append(element('span', 'page-chapter', text(data.chapter, 'Lulu & Rafo')));

      const figure = element('figure', 'memory');
      const mount = element('div', isFuture ? 'photo-mount future-mount' : 'photo-mount is-loading');
      let startImage = null;
      if (isFuture) {
        const placeholder = element('div', 'future-placeholder');
        placeholder.setAttribute('role', 'img');
        placeholder.setAttribute('aria-label', 'Um espaço vazio no álbum, reservado para as próximas lembranças.');
        const futureMoon = element('span', 'future-moon', '☾');
        futureMoon.setAttribute('aria-hidden', 'true');
        const futureNote = element('span', 'future-placeholder-note', 'essa foto a gente ainda vai tirar');
        const futureStars = element('span', 'future-stars', '✧  ♡  ✦');
        futureStars.setAttribute('aria-hidden', 'true');
        placeholder.append(futureMoon, futureNote, futureStars);
        mount.append(placeholder);
      } else {
        const image = element('img');
        image.classList.add('is-loading');
        image.alt = text(data.alt, text(data.caption, 'Uma lembrança de Lulu e Rafo.'));
        image.decoding = 'async';
        image.loading = 'eager';
        image.draggable = false;
        if (Number.isFinite(width) && width > 0) image.width = Math.round(width);
        if (Number.isFinite(height) && height > 0) image.height = Math.round(height);

        function imageReady() {
          mount.classList.remove('is-loading');
          mount.classList.add('is-loaded');
          image.classList.remove('is-loading');
          image.classList.add('is-loaded');
        }

        function imageFailed() {
          mount.classList.remove('is-loading');
          mount.classList.add('is-unavailable');
          image.classList.remove('is-loading');
          image.hidden = true;
          if (!mount.querySelector('.photo-fallback')) {
            const fallback = element('p', 'photo-fallback', 'Essa foto não carregou. Você pode tentar abrir esta página de novo. ♡');
            fallback.setAttribute('role', 'img');
            fallback.setAttribute('aria-label', `${image.alt} Fotografia indisponível no momento.`);
            mount.append(fallback);
          }
          if (index === pageIndex && current.contains(article)) {
            announce(`${pageAnnouncement()} A fotografia não carregou.`);
          }
        }

        image.addEventListener('load', imageReady, { once: true });
        image.addEventListener('error', imageFailed, { once: true });
        mount.append(image);
        const dateParts = text(data.date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (dateParts) {
          const [, year, month, day] = dateParts;
          const photoDate = element('time', 'photo-date', `${day}.${month}.${year}`);
          photoDate.dateTime = dateParts[0];
          if (data.dateSource === 'filename') {
            photoDate.title = 'Data do arquivo (sem data de captura disponível)';
            photoDate.setAttribute('aria-label', `Data do arquivo: ${day}/${month}/${year}`);
          } else {
            photoDate.setAttribute('aria-label', `Data da foto: ${day}/${month}/${year}`);
          }
          mount.classList.add('has-date');
          mount.append(photoDate);
        }
        startImage = () => {
          const source = text(data.src).trim();
          if (source) image.src = source;
          else imageFailed();
          if (image.complete && image.naturalWidth > 0) imageReady();
        };
      }
      for (const position of ['tl', 'tr', 'bl', 'br']) {
        const corner = element('i', `photo-corner ${position}`);
        corner.setAttribute('aria-hidden', 'true');
        mount.append(corner);
      }
      figure.append(mount, element('figcaption', 'photo-caption', text(data.caption)));
      const bottomline = element('div', 'page-bottomline');
      bottomline.append(element('span', 'page-note', text(data.note) || 'Lulu & Rafo'));
      const moon = element('span', 'page-symbol', '☾');
      moon.setAttribute('aria-hidden', 'true');
      bottomline.append(moon);
      article.append(topline, figure, bottomline);
      if (startImage) startImage();
      return article;
    }

    function preloadNext() {
      const next = index + 1;
      const source = next < pages.length ? text(pages[next] && pages[next].src).trim() : '';
      if (source === preloadSource) return;
      if (preload) preload.removeAttribute('src');
      preload = null;
      preloadSource = source;
      if (!source) return;
      preload = new Image();
      preload.decoding = 'async';
      preload.fetchPriority = 'low';
      preload.src = source;
    }

    function updateControls() {
      book.dataset.pageIndex = String(index);
      book.dataset.state = turning ? 'turning' : index < 0 ? 'cover' : 'open';
      book.classList.toggle('is-open', index >= 0);
      current.setAttribute('aria-busy', String(turning));
      if (previousButton) {
        previousButton.disabled = turning || index < 0;
        previousButton.setAttribute('aria-label', index === 0 ? 'Voltar à capa' : 'Página anterior');
      }
      if (nextButton) {
        nextButton.disabled = turning || !pages.length || index >= pages.length - 1;
        nextButton.setAttribute('aria-label', index < 0 ? 'Abrir álbum' : 'Próxima página');
      }
      if (openButton) openButton.disabled = turning || !pages.length;
      if (counter) {
        counter.hidden = index < 0;
        counter.textContent = index < 0 ? '' : `${index + 1} / ${pages.length}`;
      }
      if (chapterLabel) chapterLabel.textContent = index < 0 ? 'Lulu & Rafo' : text(pages[index].chapter, 'Lulu & Rafo');
      const percent = pages.length ? ((index + 1) / pages.length) * 100 : 0;
      book.style.setProperty('--album-progress', `${percent}%`);
      if (progress) {
        progress.setAttribute('role', 'progressbar');
        if (!progress.hasAttribute('aria-label') && !progress.hasAttribute('aria-labelledby')) progress.setAttribute('aria-label', 'Progresso do álbum');
        progress.setAttribute('aria-valuemin', '0');
        progress.setAttribute('aria-valuemax', String(Math.max(1, pages.length)));
        progress.setAttribute('aria-valuenow', String(index + 1));
        progress.setAttribute('aria-valuetext', index < 0 ? 'Álbum fechado' : `Página ${index + 1} de ${pages.length}`);
        progress.style.setProperty('--album-progress', `${percent}%`);
        if (progress.tagName === 'PROGRESS') {
          progress.max = Math.max(1, pages.length);
          progress.value = index + 1;
        }
      }
      if (progressFill) progressFill.style.width = `${percent}%`;
    }

    function renderDestination() {
      if (cover) cover.hidden = index >= 0;
      current.hidden = index < 0;
      current.replaceChildren(...(index < 0 ? [] : [createPage(pages[index], index)]));
      updateControls();
      preloadNext();
    }

    function cloneSheet(node, isCover) {
      if (!node) return null;
      const clone = node.cloneNode(true);
      clone.classList.add('turn-sheet');
      if (isCover) clone.classList.add('turn-cover');
      clone.removeAttribute('id');
      clone.hidden = false;
      clone.inert = true;
      clone.setAttribute('inert', '');
      clone.setAttribute('aria-hidden', 'true');
      clone.removeAttribute('tabindex');
      for (const child of clone.querySelectorAll('[id]')) child.removeAttribute('id');
      for (const child of clone.querySelectorAll('button, a, input, textarea, select, [tabindex]')) child.setAttribute('tabindex', '-1');
      return clone;
    }

    function goTo(requested, focusPage = false) {
      if (turning || !pages.length) return false;
      const destination = Math.max(-1, Math.min(pages.length - 1, requested));
      if (destination === index) return false;
      const oldIndex = index;
      const direction = destination > oldIndex ? 'forward' : 'backward';
      const oldPage = oldIndex < 0 ? cover : current.firstElementChild;
      const sheet = turnLayer ? cloneSheet(oldPage, oldIndex < 0) : null;
      const animate = Boolean(sheet && turnLayer && !reducedMotion.matches && !document.hidden);
      index = destination;
      turning = animate;
      if (turnLayer) {
        turnLayer.setAttribute('aria-hidden', 'true');
        turnLayer.replaceChildren(...(animate ? [sheet] : []));
      }
      renderDestination();
      if (!animate) {
        announce(pageAnnouncement());
        if (focusPage) (index < 0 ? openButton : current.firstElementChild)?.focus({ preventScroll: true });
        return true;
      }

      let done = false;
      let firstFrame = 0;
      let secondFrame = 0;
      let timeout = 0;
      const directionClass = `is-turning-${direction}`;

      function finish(allowFocus = true) {
        if (done) return;
        done = true;
        cancelAnimationFrame(firstFrame);
        cancelAnimationFrame(secondFrame);
        clearTimeout(timeout);
        sheet.removeEventListener('transitionend', onEnd);
        sheet.removeEventListener('animationend', onEnd);
        turnLayer.replaceChildren();
        book.classList.remove('is-turning-forward', 'is-turning-backward');
        turning = false;
        finishTurn = null;
        updateControls();
        announce(pageAnnouncement());
        if (focusPage && allowFocus && !document.hidden) (index < 0 ? openButton : current.firstElementChild)?.focus({ preventScroll: true });
      }

      function onEnd(event) {
        if (event.target !== sheet) return;
        if (event.type === 'transitionend' && event.propertyName && event.propertyName !== 'transform' && event.propertyName !== 'rotate') return;
        finish();
      }

      finishTurn = finish;
      sheet.addEventListener('transitionend', onEnd);
      sheet.addEventListener('animationend', onEnd);
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => {
          if (done) return;
          book.classList.add(directionClass);
          sheet.classList.add(directionClass);
          timeout = window.setTimeout(finish, 850);
        });
      });
      return true;
    }

    let musicLabel = musicButton?.querySelector('[data-music-label]');
    if (musicButton && !musicLabel) {
      musicLabel = element('span');
      musicLabel.setAttribute('data-music-label', '');
      musicButton.append(musicLabel);
    }

    function syncMusic() {
      if (!musicButton) return;
      musicButton.disabled = !audio;
      const playing = Boolean(audio && !audio.paused && !audio.muted && musicWanted);
      const unavailable = !audio || Boolean(audio.error);
      musicButton.setAttribute('aria-pressed', String(playing));
      musicButton.setAttribute('aria-label', playing ? 'Silenciar música' : 'Ativar música');
      musicButton.classList.toggle('is-muted', !playing);
      musicButton.dataset.playing = String(playing);
      if (musicLabel) musicLabel.textContent = unavailable ? 'música indisponível' : playing ? 'som ligado' : 'ativar música';
    }

    function attemptMusic() {
      if (!audio || !musicWanted || musicAttempt) return;
      audio.muted = false;
      if (!audio.paused) {
        syncMusic();
        return;
      }
      try {
        const attempt = audio.play();
        if (attempt && typeof attempt.then === 'function') {
          musicAttempt = attempt;
          attempt.then(syncMusic, syncMusic).finally(() => { musicAttempt = null; });
        } else syncMusic();
      } catch (_) {
        syncMusic();
      }
    }

    if (audio) {
      audio.loop = true;
      audio.volume = 0.28;
      for (const event of ['play', 'pause', 'volumechange', 'error']) audio.addEventListener(event, syncMusic);
    }
    if (musicButton) musicButton.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!audio) return;
      if (!audio.paused && !audio.muted && musicWanted) {
        musicWanted = false;
        audio.muted = true;
      } else {
        musicWanted = true;
        if (audio.error) audio.load();
        attemptMusic();
      }
      syncMusic();
    });

    openButton?.addEventListener('click', (event) => {
      attemptMusic();
      goTo(0, event.detail === 0);
    });
    previousButton?.addEventListener('click', () => { attemptMusic(); goTo(index - 1); });
    nextButton?.addEventListener('click', () => { attemptMusic(); goTo(index + 1); });

    document.addEventListener('keydown', (event) => {
      const target = event.target;
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), #album-music-button')) return;
      attemptMusic();
      let destination;
      if (event.key === 'ArrowLeft') destination = index - 1;
      else if (event.key === 'ArrowRight') destination = index + 1;
      else if (event.key === 'Home') destination = 0;
      else if (event.key === 'End') destination = pages.length - 1;
      else return;
      event.preventDefault();
      goTo(destination, true);
    });

    document.addEventListener('pointerdown', (event) => {
      pointers.add(event.pointerId);
      if (pointers.size > 1) gesture = null;
      if (!(event.target instanceof Element && event.target.closest('#album-music-button'))) attemptMusic();
    }, { capture: true, passive: true });
    book.addEventListener('pointerdown', (event) => {
      if (turning || pointers.size !== 1 || event.isPrimary === false || (event.button !== undefined && event.button !== 0)) return;
      if (event.target instanceof Element && event.target.closest(interactive)) return;
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, vertical: false };
    }, { passive: true });
    document.addEventListener('pointermove', (event) => {
      if (!gesture || event.pointerId !== gesture.id) return;
      const x = Math.abs(event.clientX - gesture.x);
      const y = Math.abs(event.clientY - gesture.y);
      if (y > 40 && y > x) gesture.vertical = true;
    }, { passive: true });
    document.addEventListener('pointerup', (event) => {
      const swipe = gesture;
      if (swipe && swipe.id === event.pointerId) gesture = null;
      pointers.delete(event.pointerId);
      if (!swipe || swipe.id !== event.pointerId || swipe.vertical || pointers.size) return;
      const x = event.clientX - swipe.x;
      const y = event.clientY - swipe.y;
      if (Math.abs(x) >= 60 && Math.abs(y) < 80 && Math.abs(x) > Math.abs(y) * 1.2) goTo(index + (x < 0 ? 1 : -1));
    }, { passive: true });
    document.addEventListener('pointercancel', (event) => {
      pointers.delete(event.pointerId);
      gesture = null;
    }, { passive: true });

    function settleWhenAway() {
      gesture = null;
      pointers.clear();
      if (finishTurn) finishTurn(false);
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) settleWhenAway(); });
    window.addEventListener('pagehide', settleWhenAway);
    window.addEventListener('blur', () => { gesture = null; pointers.clear(); });
    function motionChanged() { if (reducedMotion.matches && finishTurn) finishTurn(); }
    if (typeof reducedMotion.addEventListener === 'function') reducedMotion.addEventListener('change', motionChanged);
    else if (typeof reducedMotion.addListener === 'function') reducedMotion.addListener(motionChanged);

    renderDestination();
    announce(pageAnnouncement());
    syncMusic();
    attemptMusic();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAlbum, { once: true });
  else initAlbum();
})();
