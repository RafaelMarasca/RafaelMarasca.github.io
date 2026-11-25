'use strict';

const textBoxes = [];
const boxList = document.querySelector('#box-list');
let boxSerial = 0;
let activeBox;
let message;
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

const textFrame = document.querySelector('#text-frame');
const rotateText = document.querySelector('#rotate-text');
function poseFor(left, top, width, height, angle, bounds) {
  const radians = angle * Math.PI / 180;
  const cos = Math.abs(Math.cos(radians)), sin = Math.abs(Math.sin(radians));
  const rotatedWidth = width * cos + height * sin;
  const fit = Math.min(1, (bounds.right - bounds.left) / rotatedWidth);
  const w = rotatedWidth * fit, h = (width * sin + height * cos) * fit;
  const cx = Math.max(bounds.left + w / 2, Math.min(bounds.right - w / 2, left + width / 2));
  const cy = Math.max(bounds.top + h / 2, top + height / 2);
  return { cx, cy, fit, radians, angle, bounds: { x: cx - w / 2, y: cy - h / 2, width: w, height: h } };
}

function photoPose(frame, style) {
  return poseFor(frame.x, frame.y, frame.width, frame.height, placements.get(frame.photo).angle, textBounds(style));
}

function placeOutline(element, pose, width, height) {
  const w = width * pose.fit, h = height * pose.fit;
  element.style.left = (pose.cx - w / 2) / paperWidth * 100 + '%';
  element.style.top = (pose.cy - h / 2) / paperHeight * 100 + '%';
  element.style.width = w / paperWidth * 100 + '%';
  element.style.height = h / paperHeight * 100 + '%';
  element.style.transform = 'rotate(' + pose.angle + 'deg)';
}

function textBounds(style) {
  return style === styles.antigo ? { left: 76, right: 1004, top: 182 } : { left: 38, right: 1042, top: 38 };
}

function textBoxFor(style, textPlacement = activeBox) {
  const bounds = textBounds(style);
  const width = Math.min(textPlacement.width ?? style.width, bounds.right - bounds.left);
  const left = Math.max(bounds.left, Math.min(textPlacement.left ?? style.left, bounds.right - width));
  return { left, width, top: Math.max(bounds.top, textPlacement.top), minHeight: textPlacement.minHeight };
}

function arrangeEditor(item, box, palette, frames, scale) {
  const { layer: textLayer, editor: message, exclusions } = item;
  textLayer.style.left = box.left * scale + 'px';
  textLayer.style.top = box.top * scale + 'px';
  textLayer.style.width = box.width + 'px';
  textLayer.style.transform = 'scale(' + scale + ')';
  message.style.minHeight = box.minHeight + 'px';
  message.style.color = palette.ink;

  // Paired floats let the browser wrap editable text and selections around photos.
  const intersecting = frames.filter(frame => frame.x - 20 < box.left + box.width &&
    frame.x + frame.width + 20 > box.left && frame.y + frame.height + 18 > box.top);
  const edges = [...new Set([box.top, ...intersecting.flatMap(frame =>
    [Math.max(box.top, frame.y - 18), frame.y + frame.height + 18])])].sort((a, b) => a - b);
  const bands = edges.slice(1).map((edge, i) => {
    const column = freeColumn(box, intersecting, edges[i], edge);
    const left = column.width < 145 ? box.width : column.x - box.left;
    const right = column.width < 145 ? 0 : box.width - left - column.width;
    return [edge - edges[i], left, Math.max(0, right)];
  });
  const signature = JSON.stringify(bands);
  if (signature === item.lastBands) return;
  item.lastBands = signature;
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
    const pose = frame.pose;
    ctx.translate(pose.cx, pose.cy);
    ctx.rotate(pose.radians);
    ctx.scale(pose.fit, pose.fit);
    ctx.translate(-frame.width / 2, -frame.height / 2);
    ctx.save();
    ctx.shadowColor = 'rgba(57,42,30,.25)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#fffcf4';
    ctx.fillRect(0, 0, frame.width, frame.height);
    ctx.restore();
    ctx.drawImage(frame.photo, 10, 10, frame.width - 20, frame.height - 30);
    ctx.restore();
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
  const style = currentStyle();
  const palette = selectedPalette();
  const frames = photos.map(photo => frameFor(photo, style));
  for (const frame of frames) frame.pose = photoPose(frame, style);
  const obstacles = frames.map(frame => frame.pose.bounds);
  const scale = card.getBoundingClientRect().width / paperWidth;
  let bottom = Math.max(0, ...obstacles.map(frame => frame.y + frame.height));
  let hasContent = photos.length > 0;
  for (const item of textBoxes) {
    const raw = editorText(item.editor);
    hasContent ||= Boolean(raw.trim());
    item.editor.dataset.empty = String(!raw && item === activeBox && !photos.length);
    const box = textBoxFor(style, item);
    arrangeEditor(item, box, palette, item.angle ? [] : obstacles, scale);
    const height = item.editor.offsetHeight;
    const pose = poseFor(box.left, box.top, box.width, height, item.angle, textBounds(style));
    item.layout = { ...box, height, pose };
    item.layer.style.left = (pose.cx - box.width * pose.fit / 2) * scale + 'px';
    item.layer.style.top = (pose.cy - height * pose.fit / 2) * scale + 'px';
    item.layer.style.transform = 'scale(' + scale * pose.fit + ') translate(' + box.width / 2 + 'px,' + height / 2 +
      'px) rotate(' + pose.angle + 'deg) translate(' + -box.width / 2 + 'px,' + -height / 2 + 'px)';
    bottom = Math.max(bottom, pose.bounds.y + pose.bounds.height);
  }
  paperHeight = Math.ceil(Math.max(744, bottom + 136, gesture?.cardHeight ?? 0));
  // Keep very tall notes exportable on mobile canvases.
  const resolution = Math.min(1, 12000 / paperHeight);
  const width = Math.round(paperWidth * resolution), height = Math.round(paperHeight * resolution);
  if (card.width !== width) card.width = width;
  if (card.height !== height) card.height = height;
  card.style.aspectRatio = paperWidth + ' / ' + paperHeight;
  preview.setTransform(width / paperWidth, 0, 0, height / paperHeight, 0, 0);
  paint(preview, style, palette, paperHeight, [], 56, 68, frames);
  placeOutline(textFrame, activeBox.layout.pose, activeBox.layout.width, activeBox.layout.height);
  rotateText.setAttribute('aria-label', 'Girar caixa de texto, ' + activeBox.angle + ' graus');
  document.querySelector('#photo-rotation').hidden = !selectedPhoto;
  if (selectedPhoto) showAngle('photo-angle', placements.get(selectedPhoto).angle);
  document.querySelector('#gesture-help').hidden = !frames.length;
  if (!selectedPhoto) sizePanel.hidden = true;
  frames.forEach((frame, index) => {
    const place = placements.get(frame.photo);
    const box = place.box;
    placeOutline(box, frame.pose, frame.width, frame.height);
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
  document.querySelector('#count').textContent = editorText().length + ' / 280';
  download.disabled = !hasContent || loadingPhotos;
  addPhotos.disabled = loadingPhotos || photos.length >= maxPhotos;
  statusText.textContent = '';
}

function refreshPaper() {
  drawChoices();
  renderCard();
}

function editorText(editor = message) {
  const text = editor.innerText.replace(/\r/g, '');
  return text === '\n' && !editor.textContent ? '' : text;
}

const fontControl = document.querySelector('#text-font');
const sizeControl = document.querySelector('#text-size');
const colorControl = document.querySelector('#text-color');
let savedRange = null;
let typingFormat = null;

function activateBox(item) {
  textFrame.hidden = false;
  if (item === activeBox) return;
  if (activeBox) activeBox.range = savedRange;
  if (gesture?.kind === 'text') gesture = null;
  activeBox = item;
  message = item.editor;
  savedRange = item.range ?? null;
  typingFormat = null;
  boxList.value = String(item.id);
  document.querySelector('#remove-box').disabled = textBoxes.length < 2;
  renderCard();
}

function addTextBox(focus = true) {
  const id = ++boxSerial;
  const layer = document.createElement('div');
  layer.className = 'text-layer';
  const exclusions = document.createElement('div');
  exclusions.style.display = 'contents';
  exclusions.setAttribute('aria-hidden', 'true');
  const editor = document.createElement('div');
  editor.className = 'note-text';
  editor.contentEditable = 'true';
  editor.setAttribute('role', 'textbox');
  editor.setAttribute('aria-label', 'Texto da caixa ' + id);
  editor.setAttribute('aria-multiline', 'true');
  editor.setAttribute('aria-describedby', 'text-help');
  editor.dataset.hint = 'Escreva aqui…';
  layer.append(exclusions, editor);
  document.querySelector('#text-layers').append(layer);
  const bottom = Math.max(photoTop - 24, ...textBoxes.map(box => box.layout.pose.bounds.y + box.layout.pose.bounds.height));
  const item = { id, layer, editor, exclusions, left: null, top: bottom + 24, width: textBoxes.length ? 575 : null,
    minHeight: 150, angle: 0, lastBands: '' };
  textBoxes.push(item);
  boxList.add(new Option('Caixa ' + id, String(id)));
  bindEditor(item);
  activateBox(item);
  if (focus) editor.focus();
}

boxList.addEventListener('change', () => {
  const box = textBoxes.find(item => String(item.id) === boxList.value);
  activateBox(box);
  box.editor.focus({ preventScroll: true });
});
document.querySelector('#add-box').addEventListener('click', () => addTextBox());
document.querySelector('#remove-box').addEventListener('click', () => {
  if (textBoxes.length < 2) return;
  const index = textBoxes.indexOf(activeBox);
  activeBox.layer.remove();
  boxList.remove(index);
  textBoxes.splice(index, 1);
  activateBox(textBoxes[Math.min(index, textBoxes.length - 1)]);
  message.focus({ preventScroll: true });
});

function showAngle(id, angle) {
  const input = document.getElementById(id);
  input.value = angle;
  input.nextElementSibling.value = angle + '°';
}
function rotateActiveBox(degrees) {
  activeBox.angle = ((Math.round(degrees) + 540) % 360) - 180;
  renderCard();
}
document.querySelector('#photo-angle').addEventListener('input', event => {
  if (!selectedPhoto) return;
  placements.get(selectedPhoto).angle = event.target.valueAsNumber;
  renderCard();
});

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
for (const tools of document.querySelectorAll('.text-tools')) tools.addEventListener('pointerdown', rememberSelection);
fontControl.addEventListener('change', () => formatSelection([['fontName', fontControl.value]]));
sizeControl.addEventListener('change', () => formatSelection([['fontSize', sizeControl.value]]));
colorControl.addEventListener('change', () => formatSelection([['foreColor', colorControl.value]]));
document.querySelector('#text-body').addEventListener('click', () =>
  formatSelection([['fontName', 'Manuscrita'], ['fontSize', '3'], ['foreColor', selectedPalette().ink]]));
card.addEventListener('click', () => message.focus({ preventScroll: true }));

function remainingCharacters() {
  const selection = window.getSelection();
  const selected = selection.rangeCount && message.contains(selection.getRangeAt(0).commonAncestorContainer)
    ? selection.toString().length : 0;
  return 280 - editorText().length + selected;
}
function bindEditor(item) {
  const editor = item.editor;
  let acceptedHTML = editor.innerHTML;
  editor.addEventListener('focus', () => {
    activateBox(item);
  });
  editor.addEventListener('beforeinput', event => {
    if (event.isComposing || !event.inputType.startsWith('insert')) return;
    const length = event.data?.length ?? (['insertParagraph', 'insertLineBreak'].includes(event.inputType) ? 1 : 0);
    if (length > remainingCharacters()) event.preventDefault();
  });
  editor.addEventListener('paste', event => {
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
  editor.addEventListener('drop', event => event.preventDefault());
  function acceptEdit() {
    if (editorText(editor).length > 280) {
      editor.innerHTML = acceptedHTML;
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
    }
    acceptedHTML = editor.innerHTML;
    renderCard();
  }
  editor.addEventListener('input', event => {
    if (event.isComposing) renderCard();
    else acceptEdit();
  });
  editor.addEventListener('compositionend', acceptEdit);
}

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
  textFrame.hidden = true;
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

// Keep the opposite corner fixed when the local axes are rotated.
function resizeOffset(dw, dh, angle, leftHandle) {
  const radians = angle * Math.PI / 180;
  const dx = leftHandle ? -dw : dw;
  return { x: (dx * Math.cos(radians) - dh * Math.sin(radians) - dw) / 2,
    y: (dx * Math.sin(radians) + dh * Math.cos(radians) - dh) / 2 };
}

function resizePhoto(start, size, style) {
  const place = placements.get(start.photo);
  place.size = Math.min(maxPhotoSize(start, style), Math.max(85, size));
  const next = frameFor(start.photo, style);
  const offset = resizeOffset(next.width - start.width, next.height - start.height, place.angle, place.handleLeft);
  place.x = start.x - style.left + offset.x;
  place.y = Math.max(photoTop, start.y + offset.y);
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

const arrowSteps = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

function beginGesture(event, button, target) {
  draggedHandle = null;
  gesture = { ...target, id: event.pointerId, button, x: event.clientX, y: event.clientY,
    scale: paperWidth / card.getBoundingClientRect().width, cardHeight: paperHeight };
  button.setPointerCapture(event.pointerId);
}

function changeTextBox(start, resize, dx, dy, startPaperHeight) {
  const bounds = textBounds(currentStyle());
  const textPlacement = activeBox;
  if (resize) {
    textPlacement.left = start.left;
    textPlacement.width = Math.max(160, Math.min(bounds.right - start.left, start.width + dx));
    textPlacement.minHeight = dy === 0 ? start.minHeight : Math.max(82, start.height + dy);
  } else {
    textPlacement.left = Math.max(bounds.left, Math.min(bounds.right - start.width, start.left + dx));
    textPlacement.top = Math.max(bounds.top, Math.min(startPaperHeight - 136, start.top + dy));
  }
  if (resize && activeBox.angle) {
    renderCard();
    const offset = resizeOffset(activeBox.layout.width - start.width,
      activeBox.layout.height - start.height, activeBox.angle, false);
    activeBox.left = start.left + offset.x;
    activeBox.top = start.top + offset.y;
  }
  renderCard();
}

rotateText.addEventListener('click', event => {
  if (!event.detail || draggedHandle !== rotateText) rotateActiveBox(activeBox.angle + 15);
});

for (const button of textFrame.querySelectorAll('button:not(#remove-box)')) {
  const resize = button.id === 'resize-text';
  const startBox = () => ({ ...textBoxFor(currentStyle()), height: message.offsetHeight });
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0 || gesture) return;
    event.preventDefault();
    button.focus({ preventScroll: true });
    const pose = activeBox.layout.pose;
    if (button === rotateText) {
      const paper = card.getBoundingClientRect();
      const scale = paper.width / paperWidth;
      const cx = paper.left + pose.cx * scale, cy = paper.top + pose.cy * scale;
      beginGesture(event, button, { kind: 'text', rotate: true, cx, cy, angle: activeBox.angle,
        pointerAngle: Math.atan2(event.clientY - cy, event.clientX - cx) });
    } else {
      beginGesture(event, button, { kind: 'text', resize, start: startBox(), pose });
    }
  });
  button.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      message.focus({ preventScroll: true });
      return;
    }
    if (!Object.hasOwn(arrowSteps, event.key)) return;
    event.preventDefault();
    const [dx, dy] = arrowSteps[event.key];
    const step = event.shiftKey ? 30 : 10;
    if (button === rotateText) rotateActiveBox(activeBox.angle + (dx + dy) * (event.shiftKey ? 15 : 1));
    else changeTextBox(startBox(), resize, step * dx, step * dy, paperHeight);
  });
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
    const start = frameFor(photo, currentStyle());
    beginGesture(event, button, { kind: 'photo', photo, resize, start, pose: photoPose(start, currentStyle()) });
  });
  button.addEventListener('keydown', event => {
    if (!Object.hasOwn(arrowSteps, event.key)) return;
    event.preventDefault();
    const [dx, dy] = arrowSteps[event.key];
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
  if (gesture.rotate) {
    const angle = Math.atan2(event.clientY - gesture.cy, event.clientX - gesture.cx);
    rotateActiveBox(gesture.angle + (angle - gesture.pointerAngle) * 180 / Math.PI);
    return;
  }
  let dx = (event.clientX - gesture.x) * gesture.scale, dy = (event.clientY - gesture.y) * gesture.scale;
  if (gesture.resize && gesture.pose) {
    const { radians, fit } = gesture.pose;
    const cos = Math.cos(radians), sin = Math.sin(radians);
    [dx, dy] = [(dx * cos + dy * sin) / fit, (dy * cos - dx * sin) / fit];
  }
  if (gesture.kind === 'text') changeTextBox(gesture.start, gesture.resize, dx, dy, gesture.cardHeight);
  else changeFrame(gesture.photo, gesture.start, gesture.resize, dx, dy, gesture.cardHeight);
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
  const place = { box, size: 265, x: 0, y: photoTop, handleLeft: false, angle: 0 };
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
  for (const item of textBoxes) {
    const { width, height, pose } = item.layout;
    const transform = item.layer.style.transform;
    ctx.save();
    try {
      item.layer.style.transform = 'scale(' + scale * pose.fit + ')';
      const origin = item.layer.getBoundingClientRect();
      ctx.translate(pose.cx, pose.cy);
      ctx.rotate(pose.radians);
      ctx.scale(pose.fit, pose.fit);
      ctx.translate(-width / 2, -height / 2);
      drawTextRuns(ctx, item.editor, origin, scale * pose.fit);
    } finally {
      item.layer.style.transform = transform;
      ctx.restore();
    }
  }
  return result;
}

function drawTextRuns(ctx, editor, paper, scale) {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
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
addTextBox(false);
refreshPaper();
Promise.all([document.fonts.load('56px Manuscrita'), document.fonts.load('96px Carta')]).then(refreshPaper, refreshPaper);
