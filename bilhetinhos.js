'use strict';

const message = document.querySelector('#message');
const card = document.querySelector('#card');
const preview = card.getContext('2d');
const download = document.querySelector('#download');
const statusText = document.querySelector('#status');
const filesInput = document.querySelector('#photo-files');
const addPhotos = document.querySelector('#add-photos');
const photoList = document.querySelector('#photo-list');
const photoStatus = document.querySelector('#photo-status');
const photos = [];
const maxPhotos = 4;
const placements = new Map();
const controls = document.querySelector('#photo-controls');
const photoTop = 220;
let selectedPhoto = null;
let gesture = null;
let loadingPhotos = false;
const sample = 'Vi a lua hoje\ne lembrei de você.';
const palettes = {
  creme: { paper: '#f6ead0', ink: '#393a35', stamp: '#646e55' },
  rosa: { paper: '#f6deda', ink: '#462f35', stamp: '#98656d' },
  azul: { paper: '#dceaf1', ink: '#263946', stamp: '#516f83' }
};
const segmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter('pt-BR', { granularity: 'grapheme' }) : null;

function wrapText(ctx, text, maxWidth) {
  const lines = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const token of paragraph.match(/\s+|\S+/gu) || []) {
      if (line && token.trim() && ctx.measureText(line + token).width > maxWidth) {
        lines.push(line.trimEnd());
        line = '';
      }
      if (ctx.measureText(line + token).width <= maxWidth) {
        line += token;
        continue;
      }
      const chars = segmenter
        ? Array.from(segmenter.segment(token), part => part.segment) : Array.from(token);
      for (const char of chars) {
        if (line && ctx.measureText(line + char).width > maxWidth) {
          lines.push(line);
          line = '';
        }
        line += char;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

function circle(ctx, x, y, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawStamp(ctx, { paper, stamp }) {
  ctx.save();
  ctx.translate(846, 50);
  ctx.rotate(.055);
  ctx.fillStyle = stamp;
  ctx.fillRect(0, 0, 154, 166);
  for (let x = 5; x < 154; x += 12) {
    circle(ctx, x, 0, 3, paper);
    circle(ctx, x, 166, 3, paper);
  }
  for (let y = 5; y < 166; y += 12) {
    circle(ctx, 0, y, 3, paper);
    circle(ctx, 154, y, 3, paper);
  }
  ctx.strokeStyle = paper;
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 12, 130, 142);
  circle(ctx, 78, 68, 32, paper);
  circle(ctx, 91, 58, 31, stamp);
  for (const [x, y] of [[37, 37], [111, 31], [120, 85], [46, 101]]) {
    circle(ctx, x, y, 2.5, paper);
  }
  ctx.font = '18px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = paper;
  ctx.fillText('L U A', 77, 136);
  ctx.restore();
  ctx.strokeStyle = stamp;
  ctx.lineWidth = 2.5;
  for (const y of [132, 145, 158]) {
    ctx.beginPath();
    ctx.moveTo(741, y);
    ctx.bezierCurveTo(785, y - 23, 811, y + 23, 862, y);
    ctx.stroke();
  }
}

function star(ctx, x, y, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - radius);
  ctx.quadraticCurveTo(x + radius * .14, y - radius * .12, x + radius * .82, y);
  ctx.quadraticCurveTo(x + radius * .14, y + radius * .12, x, y + radius);
  ctx.quadraticCurveTo(x - radius * .14, y + radius * .12, x - radius * .82, y);
  ctx.quadraticCurveTo(x - radius * .14, y - radius * .12, x, y - radius);
  ctx.fill();
}

function crescent(ctx, x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(r, r);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(.35, -.98);
  ctx.bezierCurveTo(-1.05, -1.02, -1.35, .72, -.08, .98);
  ctx.bezierCurveTo(.39, 1.1, .78, .82, .96, .48);
  ctx.bezierCurveTo(-.15, .85, -.56, -.45, .35, -.98);
  ctx.fill();
  ctx.restore();
}

function speckle(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function paperTexture() {
  const tile = document.createElement('canvas');
  tile.width = tile.height = 192;
  const pen = tile.getContext('2d');
  for (let i = 0; i < 3100; i++) {
    const x = speckle(i, 1) * tile.width;
    const y = speckle(i, 2) * tile.height;
    pen.fillStyle = i % 3 ? 'rgba(84,54,31,.095)' : 'rgba(255,255,245,.45)';
    pen.fillRect(x, y, 1 + speckle(i, 3) * 3, 1);
  }
  return tile;
}
const grain = paperTexture();

function constellation(ctx, points, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.stroke();
  points.forEach(([x, y], i) => star(ctx, x, y, i % 3 === 0 ? 11 : 5, color));
}

function drawAntigo(ctx, palette, height) {
  ctx.fillStyle = '#141d26';
  ctx.fillRect(0, 0, 1080, height);
  const gold = '#e8d8a9';
  for (let i = 0; i < 185; i++) {
    const x = speckle(i, 4) * 1080;
    const y = speckle(i, 5) * height;
    if (i % 13 === 0) star(ctx, x, y, 4 + speckle(i, 6) * 5, gold);
    else circle(ctx, x, y, .7 + speckle(i, 7) * 1.8, '#a6ab9e');
  }
  constellation(ctx, [[95,106],[137,62],[201,81],[244,42],[310,64]], '#b2ae93');
  circle(ctx, 878, 88, 58, gold);
  ctx.save();
  ctx.beginPath();
  ctx.arc(878, 88, 58, 0, Math.PI * 2);
  ctx.clip();
  for (let i = 0; i < 125; i++) {
    circle(ctx, 817 + speckle(i, 1) * 120, 27 + speckle(i, 2) * 120,
      2 + speckle(i, 3) * 8, 'rgba(102,99,75,.13)');
  }
  ctx.restore();
  crescent(ctx, 748, 78, 18, '#d8cba7');
  star(ctx, 974, 63, 14, gold);
  // An irregular outline keeps the paper edge visible against the night sky.
  const top = 164, bottom = height - 93;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(62, top);
  for (let x = 62; x < 1016; x += 8) ctx.lineTo(x, top + Math.sin(x / 63) * 4 + speckle(x, 4) * 9);
  for (let y = top; y < bottom; y += 10) ctx.lineTo(1012 + speckle(y, 5) * 6, y);
  for (let x = 1015; x > 62; x -= 8) ctx.lineTo(x, bottom + Math.sin(x / 41) * 4 - speckle(x, 6) * 11);
  for (let y = bottom; y > top; y -= 10) ctx.lineTo(60 + speckle(y, 7) * 6, y);
  ctx.closePath();
  ctx.fillStyle = palette.paper;
  ctx.fill();
  ctx.clip();
  const patina = ctx.createRadialGradient(530, (top + bottom) / 2, 60, 530, (top + bottom) / 2, 650);
  patina.addColorStop(0, 'rgba(122,83,43,0)');
  patina.addColorStop(.65, 'rgba(153,108,60,.13)');
  patina.addColorStop(1, 'rgba(112,66,29,.46)');
  ctx.fillStyle = patina;
  ctx.fillRect(55, top, 970, bottom - top + 16);
  ctx.fillStyle = ctx.createPattern(grain, 'repeat');
  ctx.fillRect(55, top, 970, bottom - top + 16);
  const fold = ctx.createLinearGradient(585, 0, 609, 0);
  fold.addColorStop(0, 'transparent');
  fold.addColorStop(.7, 'rgba(106,72,35,.10)');
  fold.addColorStop(.74, 'rgba(255,255,245,.28)');
  fold.addColorStop(1, 'transparent');
  ctx.fillStyle = fold;
  ctx.fillRect(585, top, 24, bottom - top + 12);
  ctx.restore();
  constellation(ctx, [[768,height-45],[825,height-67],[866,height-43],[927,height-54]], '#c7ba97');
}

function drawPostal(ctx, palette, height) {
  ctx.fillStyle = palette.paper;
  ctx.fillRect(0, 0, 1080, height);
  ctx.strokeStyle = palette.stamp;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(24, 24, 1032, height - 48);
  drawStamp(ctx, palette);
  ctx.fillStyle = palette.stamp;
  ctx.font = '23px monospace';
  ctx.fillText('C O R R E I O   L U N A R', 76, 99);
  ctx.fillRect(77, 120, 70, 2);
  for (const [x, y, r] of [[494,86,11],[540,60,5],[634,94,7],[985,height-99,9],[818,height-76,5]]) {
    star(ctx, x, y, r, palette.stamp);
  }
  crescent(ctx, 909, height - 83, 23, palette.stamp);
}

function drawCaderno(ctx, palette, height, firstY, leading) {
  ctx.fillStyle = palette.paper;
  ctx.fillRect(0, 0, 1080, height);
  ctx.fillStyle = ctx.createPattern(grain, 'repeat');
  ctx.fillRect(0, 0, 1080, height);
  ctx.fillStyle = '#19232b';
  ctx.fillRect(0, 0, 30, height);
  for (let y = 53; y < height; y += 82) {
    circle(ctx, 59, y, 12, '#19232b');
    ctx.fillStyle = '#19232b';
    ctx.fillRect(29, y - 3, 30, 6);
  }
  ctx.fillStyle = 'rgba(155,79,81,.4)';
  ctx.fillRect(113, 0, 2, height);
  ctx.strokeStyle = palette.stamp;
  ctx.globalAlpha = .28;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (let y = firstY + 9 - Math.floor((firstY - 135) / leading) * leading; y < height - 103; y += leading) {
    ctx.moveTo(32, y);
    ctx.lineTo(1050, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  constellation(ctx, [[694,104],[764,63],[815,92],[872,52],[945,76]], palette.stamp);
  crescent(ctx, 197, 77, 29, palette.stamp);
  star(ctx, 248, 80, 10, palette.stamp);
  star(ctx, 274, 56, 5, palette.stamp);
  crescent(ctx, 932, height - 72, 18, palette.stamp);
  star(ctx, 977, height - 92, 8, palette.stamp);
}

const styles = {
  antigo: { draw: drawAntigo, left: 125, width: 830, footer: '#e8d8a9' },
  postal: { draw: drawPostal, left: 108, width: 864 },
  caderno: { draw: drawCaderno, left: 145, width: 824 }
};

function currentStyle() {
  return styles[document.querySelector('input[name="style"]:checked').value];
}

function frameFor(photo, style) {
  const place = placements.get(photo);
  const scale = Math.min(place.size / Math.max(photo.width, photo.height), (style.width - 20) / photo.width);
  const width = photo.width * scale + 20;
  const height = photo.height * scale + 30;
  return { photo, x: style.left + Math.max(0, Math.min(place.x, style.width - width)), y: place.y, width, height };
}

function freeColumn(style, frames, top, bottom) {
  const right = style.left + style.width;
  const blocks = frames.filter(frame => frame.y - 18 < bottom && frame.y + frame.height + 18 > top)
    .sort((a, b) => a.x - b.x);
  let x = style.left;
  let best = { x, width: 0 };
  for (const frame of blocks) {
    const width = frame.x - 20 - x;
    if (width > best.width) best = { x, width };
    x = Math.max(x, frame.x + frame.width + 20);
  }
  return right - x > best.width ? { x, width: right - x } : best;
}

// Give each line the widest clear stretch of paper at its actual height.
function flowText(ctx, text, style, frames, size, leading) {
  const lines = [];
  let top = photoTop;
  for (const paragraph of text.split('\n')) {
    let chars = segmenter ? Array.from(segmenter.segment(paragraph), item => item.segment) : Array.from(paragraph);
    if (!chars.length) top += leading;
    while (chars.length) {
      const column = freeColumn(style, frames, top - 4, top + leading + 4);
      if (column.width < size * 3) {
        top += leading;
        continue;
      }
      let count = 0;
      let space = 0;
      while (count < chars.length && ctx.measureText(chars.slice(0, count + 1).join('')).width <= column.width) {
        if (/\s/u.test(chars[count])) space = count + 1;
        count++;
      }
      const take = count < chars.length && space ? space : Math.max(1, count);
      lines.push({ text: chars.slice(0, take).join('').trimEnd(), x: column.x, y: top + size });
      chars = chars.slice(take);
      top += leading;
    }
  }
  return { lines, bottom: top };
}

function paint(ctx, style, palette, height, lines, size, leading, frames = []) {
  const firstY = lines[0]?.y ?? photoTop + size;
  style.draw(ctx, palette, height, firstY, leading);
  ctx.fillStyle = palette.ink;
  ctx.font = size + 'px Manuscrita, cursive';
  for (const line of lines) ctx.fillText(line.text, line.x, line.y);
  for (const frame of frames) {
    ctx.save();
    ctx.shadowColor = 'rgba(57,42,30,.25)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#fffcf4';
    ctx.fillRect(frame.x, frame.y, frame.width, frame.height);
    ctx.restore();
    ctx.drawImage(frame.photo, frame.x + 10, frame.y + 10, frame.width - 20, frame.height - 30);
  }
  ctx.fillStyle = style.footer || palette.stamp;
  ctx.font = '22px monospace';
  ctx.fillText('☾  uma lua para lulu', style.left, height - (style.footer ? 40 : 65));
}

function centeredLines(texts, style, height, size, leading) {
  const top = 222 + (height - 327 - texts.length * leading) / 2;
  return texts.map((text, i) => ({ text, x: style.left, y: top + size + i * leading }));
}

function selectedPalette() {
  return palettes[document.querySelector('input[name="paper"]:checked').value];
}

function drawChoices() {
  document.querySelectorAll('.styles input').forEach(input => {
    const miniature = input.nextElementSibling;
    const pen = miniature.getContext('2d');
    pen.setTransform(miniature.width / 1080, 0, 0, miniature.height / 744, 0, 0);
    const style = styles[input.value];
    paint(pen, style, selectedPalette(), 744, centeredLines(sample.split('\n'), style, 744, 78, 96), 78, 96);
  });
}

function renderCard() {
  const raw = message.value;
  const hasMessage = Boolean(raw.trim());
  const hasContent = hasMessage || photos.length > 0;
  const text = hasMessage ? raw : (hasContent ? '' : sample);
  const input = document.querySelector('input[name="style"]:checked');
  const style = styles[input.value];
  let size = 78;
  let lines;
  do {
    preview.font = size + 'px Manuscrita, cursive';
    lines = text ? wrapText(preview, text, style.width) : [];
    if (lines.length * size * 1.22 <= 350 || size <= 42) break;
    size -= 6;
  } while (true);
  const leading = Math.ceil(size * 1.22);
  const frames = photos.map(photo => frameFor(photo, style));
  if (frames.length) {
    const flow = flowText(preview, text, style, frames, size, leading);
    const bottom = Math.max(flow.bottom, ...frames.map(frame => frame.y + frame.height));
    card.height = Math.ceil(Math.max(744, bottom + 136, gesture?.cardHeight ?? 0));
    lines = flow.lines;
  } else {
    card.height = Math.ceil(Math.max(744, 365 + lines.length * leading));
    lines = centeredLines(lines, style, card.height, size, leading);
  }
  paint(preview, style, selectedPalette(), card.height, lines, size, leading, frames);
  document.querySelector('#gesture-help').hidden = !frames.length;
  frames.forEach((frame, index) => {
    const box = placements.get(frame.photo).box;
    box.style.left = frame.x / card.width * 100 + '%';
    box.style.top = frame.y / card.height * 100 + '%';
    box.style.width = frame.width / card.width * 100 + '%';
    box.style.height = frame.height / card.height * 100 + '%';
    box.style.zIndex = index + 1;
    box.classList.toggle('selected', frame.photo === selectedPhoto);
  });
  const photoNames = photos.map(photo => photo.getAttribute('aria-label'));
  card.setAttribute('aria-label', [input.labels[0].textContent.trim(), hasContent ? text : 'Exemplo. ' + text, ...photoNames].filter(Boolean).join('. '));
  document.querySelector('#count').textContent = raw.length + ' / 280';
  download.disabled = !hasContent || loadingPhotos;
  addPhotos.disabled = loadingPhotos || photos.length >= maxPhotos;
  statusText.textContent = '';
}

function refreshPaper() {
  drawChoices();
  renderCard();
}

message.addEventListener('input', renderCard);
async function readPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 900 / Math.max(image.naturalWidth, image.naturalHeight));
    const photo = document.createElement('canvas');
    photo.width = Math.max(1, Math.round(image.naturalWidth * scale));
    photo.height = Math.max(1, Math.round(image.naturalHeight * scale));
    photo.setAttribute('role', 'img');
    photo.setAttribute('aria-label', file.name);
    photo.getContext('2d').drawImage(image, 0, 0, photo.width, photo.height);
    return photo;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function selectPhoto(photo) {
  if (selectedPhoto === photo) return;
  selectedPhoto = photo;
  photos.splice(photos.indexOf(photo), 1);
  photos.push(photo);
  renderCard();
}

function changeFrame(photo, start, resize, dx, dy, cardHeight) {
  const place = placements.get(photo);
  const style = currentStyle();
  if (resize) {
    const w = start.width - 20, h = start.height - 30;
    const factor = 1 + (dx * w + dy * h) / (w * w + h * h);
    const limit = Math.min((style.width - 20) / w, 760 / h) * Math.max(w, h);
    place.size = Math.min(limit, Math.max(85, Math.max(w, h) * factor));
    place.x = Math.min(start.x - style.left, style.width - frameFor(photo, style).width);
  } else {
    place.x = Math.max(0, Math.min(style.width - start.width, start.x - style.left + dx));
    place.y = Math.max(photoTop, Math.min(cardHeight - 136 - start.height, start.y + dy));
  }
  renderCard();
}

function makeHandle(photo, resize) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = resize ? 'size-photo' : 'move-photo';
  button.textContent = resize ? '⤡' : '';
  button.setAttribute('aria-label', (resize ? 'Redimensionar ' : 'Mover ') + photo.getAttribute('aria-label'));
  button.setAttribute('aria-describedby', 'gesture-help');
  button.addEventListener('focus', () => selectPhoto(photo));
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0 || gesture) return;
    event.preventDefault();
    button.focus({ preventScroll: true });
    selectPhoto(photo);
    gesture = { id: event.pointerId, photo, resize, start: frameFor(photo, currentStyle()),
      x: event.clientX, y: event.clientY, scale: card.width / card.getBoundingClientRect().width, cardHeight: card.height };
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener('keydown', event => {
    const steps = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!Object.hasOwn(steps, event.key)) return;
    event.preventDefault();
    const [dx, dy] = steps[event.key];
    const step = event.shiftKey ? 30 : 10;
    const change = step * (dx + dy);
    changeFrame(photo, frameFor(photo, currentStyle()), resize, resize ? change : step * dx,
      resize ? change : step * dy, card.height);
  });
  return button;
}

function updateGesture(event) {
  if (gesture?.id !== event.pointerId) return;
  changeFrame(gesture.photo, gesture.start, gesture.resize, (event.clientX - gesture.x) * gesture.scale,
    (event.clientY - gesture.y) * gesture.scale, gesture.cardHeight);
}

function endGesture(event) {
  if (!gesture || (event.pointerId !== undefined && event.pointerId !== gesture.id)) return;
  gesture = null;
  renderCard();
}

window.addEventListener('pointermove', updateGesture);
window.addEventListener('pointerup', event => {
  updateGesture(event);
  endGesture(event);
});
window.addEventListener('pointercancel', endGesture);
window.addEventListener('lostpointercapture', endGesture);
window.addEventListener('blur', endGesture);

function addPhotoFrame(photo) {
  const style = currentStyle();
  const existing = photos.map(other => frameFor(other, style));
  const box = document.createElement('div');
  box.className = 'photo-box';
  const place = { box, size: 265, x: 0, y: photoTop };
  placements.set(photo, place);
  const { width, height } = frameFor(photo, style);
  // Alternate sides and start a new row once both spaces are occupied.
  for (const y of [photoTop, ...existing.map(f => f.y + f.height + 24).sort((a, b) => a - b)]) {
    const x = [style.width - width, 0].find(offset => existing.every(f =>
      y >= f.y + f.height + 20 || y + height + 20 <= f.y ||
      style.left + offset >= f.x + f.width + 20 || style.left + offset + width + 20 <= f.x));
    if (x !== undefined) {
      place.x = x;
      place.y = y;
      break;
    }
  }
  box.append(makeHandle(photo, false), makeHandle(photo, true));
  controls.append(box);
  selectedPhoto = photo;
}

function appendPhoto(photo) {
  addPhotoFrame(photo);
  photos.push(photo);
  const item = document.createElement('li');
  const select = document.createElement('button');
  select.type = 'button';
  select.className = 'select-photo';
  select.setAttribute('aria-label', 'Selecionar ' + photo.getAttribute('aria-label'));
  select.addEventListener('click', () => placements.get(photo).box.firstElementChild.focus());
  select.append(photo);
  const remove = document.createElement('button');
  const name = photo.getAttribute('aria-label');
  remove.type = 'button';
  remove.textContent = '×';
  remove.setAttribute('aria-label', 'Remover ' + name);
  remove.addEventListener('click', () => {
    if (gesture?.photo === photo) gesture = null;
    photos.splice(photos.indexOf(photo), 1);
    placements.get(photo).box.remove();
    placements.delete(photo);
    if (selectedPhoto === photo) selectedPhoto = photos.at(-1) ?? null;
    item.remove();
    renderCard();
    photoStatus.textContent = 'Imagem removida: ' + name;
    if (!loadingPhotos) addPhotos.focus();
  });
  item.append(select, remove);
  photoList.append(item);
}

addPhotos.addEventListener('click', () => filesInput.click());
filesInput.addEventListener('change', async () => {
  const files = Array.from(filesInput.files);
  filesInput.value = '';
  if (!files.length || loadingPhotos) return;
  loadingPhotos = true;
  renderCard();
  photoStatus.textContent = 'Preparando imagens…';
  const notices = [];
  try {
    for (const file of files) {
      if (photos.length >= maxPhotos) {
        notices.push('O bilhetinho comporta até 4 imagens.');
        break;
      }
      try {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
            && (file.type || !/\.(jpe?g|png|webp)$/i.test(file.name))) throw new Error('Formato');
        appendPhoto(await readPhoto(file));
      } catch {
        notices.push('Não foi possível abrir “' + file.name + '”. Use JPG, PNG ou WebP.');
      }
    }
  } finally {
    loadingPhotos = false;
    renderCard();
    photoStatus.textContent = notices.join(' ') || (photos.length === 1 ? '1 imagem no bilhetinho.' : photos.length + ' imagens no bilhetinho.');
  }
});
document.querySelectorAll('input[name="style"]').forEach(input => input.addEventListener('change', renderCard));
document.querySelectorAll('input[name="paper"]').forEach(input => input.addEventListener('change', refreshPaper));
download.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'meu-bilhetinho.png';
  try {
    link.href = card.toDataURL('image/png');
    if (link.href === 'data:,') throw new Error('Imagem indisponível');
    document.body.append(link);
    link.click();
    statusText.textContent = 'Bilhetinho pronto para baixar.';
  } catch {
    statusText.textContent = 'Não foi possível salvar a imagem. Tente novamente.';
  } finally {
    link.remove();
  }
});
refreshPaper();
document.fonts.load('78px Manuscrita').then(refreshPaper, refreshPaper);
