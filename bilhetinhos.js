'use strict';

const message = document.querySelector('#message');
const card = document.querySelector('#card');
const preview = card.getContext('2d');
const download = document.querySelector('#download');
const statusText = document.querySelector('#status');
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

function paint(ctx, style, palette, height, lines, size, leading) {
  const firstY = 222 + (height - 327 - lines.length * leading) / 2 + size;
  style.draw(ctx, palette, height, firstY, leading);
  ctx.fillStyle = palette.ink;
  ctx.font = size + 'px Manuscrita, cursive';
  lines.forEach((line, i) => ctx.fillText(line, style.left, firstY + i * leading));
  ctx.fillStyle = style.footer || palette.stamp;
  ctx.font = '22px monospace';
  ctx.fillText('☾  uma lua para lulu', style.left, height - (style.footer ? 40 : 65));
}

function selectedPalette() {
  return palettes[document.querySelector('input[name="paper"]:checked').value];
}

function drawChoices() {
  document.querySelectorAll('.styles input').forEach(input => {
    const miniature = input.nextElementSibling;
    const pen = miniature.getContext('2d');
    pen.setTransform(miniature.width / 1080, 0, 0, miniature.height / 744, 0, 0);
    paint(pen, styles[input.value], selectedPalette(), 744, sample.split('\n'), 78, 96);
  });
}

function renderCard() {
  const raw = message.value;
  const hasMessage = Boolean(raw.trim());
  const text = hasMessage ? raw : sample;
  const input = document.querySelector('input[name="style"]:checked');
  const style = styles[input.value];
  let size = 78;
  let lines;
  do {
    preview.font = size + 'px Manuscrita, cursive';
    lines = wrapText(preview, text, style.width);
    if (lines.length * size * 1.22 <= 350 || size <= 42) break;
    size -= 6;
  } while (true);
  const leading = Math.ceil(size * 1.22);
  card.height = Math.max(744, 365 + lines.length * leading);
  paint(preview, style, selectedPalette(), card.height, lines, size, leading);
  card.setAttribute('aria-label', input.labels[0].textContent.trim() + '. ' + (hasMessage ? '' : 'Exemplo. ') + text);
  document.querySelector('#count').textContent = raw.length + ' / 280';
  download.disabled = !hasMessage;
  statusText.textContent = '';
}

function refreshPaper() {
  drawChoices();
  renderCard();
}

message.addEventListener('input', renderCard);
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
