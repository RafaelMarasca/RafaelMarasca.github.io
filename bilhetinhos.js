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
const sizePanel = document.querySelector('#size-panel');
const sizeInput = document.querySelector('#photo-size');
const photoTop = 220;
const paperWidth = 1080;
let paperHeight = 744;
let selectedPhoto = null;
let gesture = null;
let draggedHandle = null;
let loadingPhotos = false;
const sample = 'Vi a lua hoje\ne lembrei de você.';
const palettes = {
  creme: { paper: '#f6ead0', ink: '#393a35', stamp: '#646e55' },
  rosa: { paper: '#f6deda', ink: '#462f35', stamp: '#98656d' },
  azul: { paper: '#dceaf1', ink: '#263946', stamp: '#516f83' }
};
const segmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter('pt-BR', { granularity: 'grapheme' }) : null;

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
  antigo: { draw: drawAntigo, left: 125, width: 830 },
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

const textLayer = document.querySelector('#text-layer');
const exclusions = document.createElement('div');
exclusions.style.display = 'contents';
exclusions.setAttribute('aria-hidden', 'true');
textLayer.prepend(exclusions);
let lastBands = '';

function arrangeEditor(style, palette, frames, scale) {
  textLayer.style.left = style.left * scale + 'px';
  textLayer.style.top = photoTop * scale + 'px';
  textLayer.style.width = style.width + 'px';
  textLayer.style.transform = 'scale(' + scale + ')';
  message.style.color = palette.ink;

  // Paired floats let the browser wrap editable text and selections around photos.
  const edges = [...new Set([photoTop, ...frames.flatMap(frame =>
    [Math.max(photoTop, frame.y - 18), frame.y + frame.height + 18])])].sort((a, b) => a - b);
  const bands = edges.slice(1).map((edge, i) => {
    const column = freeColumn(style, frames, edges[i], edge);
    const left = column.width < 145 ? style.width : column.x - style.left;
    const right = column.width < 145 ? 0 : style.width - left - column.width;
    return [edge - edges[i], left, Math.max(0, right)];
  });
  const signature = JSON.stringify(bands);
  if (signature === lastBands) return;
  lastBands = signature;
  const floats = document.createDocumentFragment();
  for (const [height, left, right] of bands) {
    for (const [side, width] of [['left', left], ['right', right]]) {
      const spacer = document.createElement('div');
      spacer.style.cssFloat = side;
      spacer.style.clear = side === 'left' ? 'both' : 'none';
      spacer.style.width = Math.floor(width * 64) / 64 + 'px';
      spacer.style.height = height + 'px';
      spacer.style.pointerEvents = 'none';
      floats.append(spacer);
    }
  }
  exclusions.replaceChildren(floats);
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
  const raw = editorText();
  const hasContent = Boolean(raw.trim()) || photos.length > 0;
  const style = currentStyle();
  const palette = selectedPalette();
  const frames = photos.map(photo => frameFor(photo, style));
  const scale = card.getBoundingClientRect().width / paperWidth;
  message.dataset.empty = String(!raw && !photos.length);
  arrangeEditor(style, palette, frames, scale);
  const bottom = Math.max(photoTop + message.offsetHeight, ...frames.map(frame => frame.y + frame.height));
  paperHeight = Math.ceil(Math.max(744, bottom + 136, gesture?.cardHeight ?? 0));
  // Keep very tall notes exportable on mobile canvases.
  const resolution = Math.min(1, 12000 / paperHeight);
  const width = Math.round(paperWidth * resolution), height = Math.round(paperHeight * resolution);
  if (card.width !== width) card.width = width;
  if (card.height !== height) card.height = height;
  card.style.aspectRatio = paperWidth + ' / ' + paperHeight;
  preview.setTransform(width / paperWidth, 0, 0, height / paperHeight, 0, 0);
  paint(preview, style, palette, paperHeight, [], 56, 68, frames);
  document.querySelector('#gesture-help').hidden = !frames.length;
  if (!selectedPhoto) sizePanel.hidden = true;
  frames.forEach((frame, index) => {
    const place = placements.get(frame.photo);
    const box = place.box;
    box.style.left = frame.x / paperWidth * 100 + '%';
    box.style.top = frame.y / paperHeight * 100 + '%';
    box.style.width = frame.width / paperWidth * 100 + '%';
    box.style.height = frame.height / paperHeight * 100 + '%';
    box.style.zIndex = index + 1;
    box.classList.toggle('selected', frame.photo === selectedPhoto);
    box.classList.toggle('handle-left', place.handleLeft);
    const expanded = !sizePanel.hidden && frame.photo === selectedPhoto;
    box.lastElementChild.setAttribute('aria-expanded', String(expanded));
    if (expanded) {
      sizeInput.max = Math.floor(maxPhotoSize(frame, style));
      sizeInput.value = Math.round(Math.max(frame.width - 20, frame.height - 30));
    }
  });
  document.querySelector('#count').textContent = raw.length + ' / 280';
  download.disabled = !hasContent || loadingPhotos;
  addPhotos.disabled = loadingPhotos || photos.length >= maxPhotos;
  statusText.textContent = '';
}

function refreshPaper() {
  drawChoices();
  renderCard();
}

function editorText() {
  const text = message.innerText.replace(/\r/g, '');
  return text === '\n' && !message.textContent ? '' : text;
}

const fontControl = document.querySelector('#text-font');
const sizeControl = document.querySelector('#text-size');
const colorControl = document.querySelector('#text-color');
const titleButton = document.querySelector('#text-title');
let savedRange = null;
let acceptedHTML = '';
let typingFormat = null;

function atTypingCaret(range) {
  return typingFormat && range.collapsed && range.startContainer === typingFormat.node &&
    range.startOffset === typingFormat.offset;
}

function rememberSelection() {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (!message.contains(range.commonAncestorContainer)) return;
  if (!atTypingCaret(range)) typingFormat = null;
  savedRange = range.cloneRange();
  let node = selection.focusNode;
  if (node.nodeType !== Node.ELEMENT_NODE) node = node.parentElement;
  const css = getComputedStyle(node);
  const font = css.fontFamily.split(',')[0].replace(/["']/g, '').trim();
  if ([...fontControl.options].some(option => option.value === font)) fontControl.value = font;
  const size = [...sizeControl.options].find(option => Number(option.text) === Math.round(parseFloat(css.fontSize)));
  if (size) sizeControl.value = size.value;
  const rgb = css.color.match(/\d+/g);
  if (rgb?.length >= 3) colorControl.value = '#' + rgb.slice(0, 3).map(v => Number(v).toString(16).padStart(2, '0')).join('');
  if (typingFormat) {
    const settings = typingFormat.settings;
    if (settings.has('fontName')) fontControl.value = settings.get('fontName');
    if (settings.has('fontSize')) sizeControl.value = settings.get('fontSize');
    if (settings.has('foreColor')) colorControl.value = settings.get('foreColor');
  }
}

function formatSelection(commands) {
  const range = savedRange && message.contains(savedRange.commonAncestorContainer) ? savedRange.cloneRange() : document.createRange();
  if (!message.contains(range.commonAncestorContainer)) {
    range.selectNodeContents(message);
    range.collapse(false);
  }
  const settings = new Map(atTypingCaret(range) ? typingFormat.settings : []);
  for (const [command, value] of commands) settings.set(command, value);
  message.focus({ preventScroll: true });
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  // Native inline formatting keeps the caret, mobile selection and undo history.
  document.execCommand('styleWithCSS', false, false);
  for (const [command, value] of settings) document.execCommand(command, false, value);
  typingFormat = selection.isCollapsed ? { node: selection.focusNode, offset: selection.focusOffset, settings } : null;
  rememberSelection();
  renderCard();
}

document.addEventListener('selectionchange', rememberSelection);
document.querySelector('.text-tools').addEventListener('pointerdown', rememberSelection);
fontControl.addEventListener('change', () => formatSelection([['fontName', fontControl.value]]));
sizeControl.addEventListener('change', () => formatSelection([['fontSize', sizeControl.value]]));
colorControl.addEventListener('change', () => formatSelection([['foreColor', colorControl.value]]));
titleButton.addEventListener('click', () => formatSelection([['fontName', 'Carta'], ['fontSize', '6']]));
document.querySelector('#text-body').addEventListener('click', () =>
  formatSelection([['fontName', 'Manuscrita'], ['fontSize', '3'], ['foreColor', selectedPalette().ink]]));
card.addEventListener('click', () => message.focus({ preventScroll: true }));

function remainingCharacters() {
  const selection = window.getSelection();
  const selected = selection.rangeCount && message.contains(selection.getRangeAt(0).commonAncestorContainer)
    ? selection.toString().length : 0;
  return 280 - editorText().length + selected;
}
message.addEventListener('beforeinput', event => {
  if (event.isComposing || !event.inputType.startsWith('insert')) return;
  const length = event.data?.length ?? (['insertParagraph', 'insertLineBreak'].includes(event.inputType) ? 1 : 0);
  if (length > remainingCharacters()) event.preventDefault();
});
message.addEventListener('paste', event => {
  event.preventDefault();
  const text = event.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n');
  const room = remainingCharacters();
  let inserted = '';
  for (const part of segmenter ? segmenter.segment(text) : Array.from(text)) {
    const char = part.segment ?? part;
    if (inserted.length + char.length > room) break;
    inserted += char;
  }
  if (inserted) document.execCommand('insertText', false, inserted);
});
message.addEventListener('drop', event => event.preventDefault());
function acceptEdit() {
  if (editorText().length > 280) {
    message.innerHTML = acceptedHTML;
    const range = document.createRange();
    range.selectNodeContents(message);
    range.collapse(false);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  }
  acceptedHTML = message.innerHTML;
  renderCard();
}
message.addEventListener('input', event => {
  if (event.isComposing) renderCard();
  else acceptEdit();
});
message.addEventListener('compositionend', acceptEdit);

let editorWidth = 0;
new ResizeObserver(() => {
  const width = card.getBoundingClientRect().width;
  if (width === editorWidth) return;
  editorWidth = width;
  renderCard();
}).observe(card);


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
  sizePanel.hidden = true;
  selectedPhoto = photo;
  photos.splice(photos.indexOf(photo), 1);
  photos.push(photo);
  renderCard();
}

function maxPhotoSize(frame, style) {
  const w = frame.width - 20, h = frame.height - 30;
  const availableWidth = placements.get(frame.photo).handleLeft
    ? frame.x + frame.width - style.left : style.left + style.width - frame.x;
  return Math.min((availableWidth - 20) / w, 760 / h) * Math.max(w, h);
}

function resizePhoto(start, size, style) {
  const place = placements.get(start.photo);
  place.size = Math.min(maxPhotoSize(start, style), Math.max(85, size));
  const width = frameFor(start.photo, style).width;
  place.x = start.x - style.left + (place.handleLeft ? start.width - width : 0);
}

function changeFrame(photo, start, resize, dx, dy, cardHeight) {
  const place = placements.get(photo);
  const style = currentStyle();
  if (resize) {
    const w = start.width - 20, h = start.height - 30;
    const outward = place.handleLeft ? -dx : dx;
    const factor = 1 + (outward * w + dy * h) / (w * w + h * h);
    resizePhoto(start, Math.max(w, h) * factor, style);
  } else {
    place.x = Math.max(0, Math.min(style.width - start.width, start.x - style.left + dx));
    place.y = Math.max(photoTop, Math.min(cardHeight - 136 - start.height, start.y + dy));
    place.handleLeft = place.x + start.width / 2 > style.width / 2;
  }
  renderCard();
}

function makeHandle(photo, resize) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = resize ? 'size-photo' : 'move-photo';
  if (resize) {
    button.setAttribute('aria-controls', 'size-panel');
    button.addEventListener('click', event => {
      if (event.detail && draggedHandle === button) return;
      selectPhoto(photo);
      sizePanel.hidden = !sizePanel.hidden;
      renderCard();
      if (!sizePanel.hidden) sizeInput.focus();
    });
  }
  button.setAttribute('aria-label', (resize ? 'Redimensionar ' : 'Mover ') + photo.getAttribute('aria-label'));
  button.setAttribute('aria-describedby', 'gesture-help');
  button.addEventListener('focus', () => selectPhoto(photo));
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0 || gesture) return;
    event.preventDefault();
    button.focus({ preventScroll: true });
    selectPhoto(photo);
    draggedHandle = null;
    gesture = { id: event.pointerId, photo, resize, button, start: frameFor(photo, currentStyle()),
      x: event.clientX, y: event.clientY, scale: paperWidth / card.getBoundingClientRect().width, cardHeight: paperHeight };
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener('keydown', event => {
    const steps = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!Object.hasOwn(steps, event.key)) return;
    event.preventDefault();
    const [dx, dy] = steps[event.key];
    const step = event.shiftKey ? 30 : 10;
    const style = currentStyle();
    const start = frameFor(photo, style);
    if (resize) {
      resizePhoto(start, Math.max(start.width - 20, start.height - 30) + step * (dx + dy), style);
      renderCard();
    } else {
      changeFrame(photo, start, false, step * dx, step * dy, paperHeight);
    }
  });
  return button;
}

function updateGesture(event) {
  if (gesture?.id !== event.pointerId) return;
  if (!draggedHandle && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 3) return;
  draggedHandle = gesture.button;
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

sizeInput.addEventListener('input', () => {
  if (!selectedPhoto) return;
  const style = currentStyle();
  resizePhoto(frameFor(selectedPhoto, style), sizeInput.valueAsNumber, style);
  renderCard();
});

function addPhotoFrame(photo) {
  const style = currentStyle();
  const existing = photos.map(other => frameFor(other, style));
  const box = document.createElement('div');
  box.className = 'photo-box';
  const place = { box, size: 265, x: 0, y: photoTop, handleLeft: false };
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
  place.handleLeft = place.x + width / 2 > style.width / 2;
  sizePanel.hidden = true;
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
function exportCard() {
  const result = document.createElement('canvas');
  result.width = card.width;
  result.height = card.height;
  const ctx = result.getContext('2d');
  ctx.drawImage(card, 0, 0);
  ctx.setTransform(result.width / paperWidth, 0, 0, result.height / paperHeight, 0, 0);
  const paper = card.getBoundingClientRect();
  const scale = paper.width / paperWidth;
  const walker = document.createTreeWalker(message, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const css = getComputedStyle(node.parentElement);
    ctx.font = [css.fontStyle, css.fontWeight, css.fontSize, css.fontFamily].join(' ');
    ctx.fillStyle = css.color;
    ctx.direction = css.direction;
    const metrics = ctx.measureText('Mg');
    // A DOM range includes the font's ascent and descent, including for mixed sizes.
    const baselineOffset = (metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2;
    let run = null;
    function drawRun() {
      if (!run) return;
      const x = (run.left - paper.left) / scale;
      const baseline = (run.middle - paper.top) / scale + baselineOffset;
      ctx.textAlign = 'left';
      ctx.fillText(run.text, x, baseline);
      run = null;
    }
    let offset = 0;
    const chars = segmenter ? segmenter.segment(node.data) : Array.from(node.data);
    for (const part of chars) {
      const char = part.segment ?? part;
      range.setStart(node, offset);
      offset += char.length;
      range.setEnd(node, offset);
      const rect = range.getBoundingClientRect();
      if (char === '\n' || !rect.width) { drawRun(); continue; }
      const middle = (rect.top + rect.bottom) / 2;
      if (run && Math.abs(run.middle - middle) > .5 * scale) drawRun();
      if (!run) run = { left: rect.left, middle, text: '' };
      run.left = Math.min(run.left, rect.left);
      run.text += char;
    }
    drawRun();
  }
  return result;
}

download.addEventListener('click', async () => {
  const link = document.createElement('a');
  link.download = 'meu-bilhetinho.png';
  try {
    if (document.fonts.status === 'loading') await document.fonts.ready;
    renderCard();
    link.href = exportCard().toDataURL('image/png');
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
Promise.all([document.fonts.load('56px Manuscrita'), document.fonts.load('96px Carta')]).then(refreshPaper, refreshPaper);
