'use strict';

const message = document.querySelector('#message');
const card = document.querySelector('#card');
const ctx = card.getContext('2d');
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

function wrapText(text, maxWidth) {
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

function circle(x, y, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawStamp({ paper, stamp }) {
  ctx.save();
  ctx.translate(846, 50);
  ctx.rotate(.055);
  ctx.fillStyle = stamp;
  ctx.fillRect(0, 0, 154, 166);
  for (let x = 5; x < 154; x += 12) {
    circle(x, 0, 3, paper);
    circle(x, 166, 3, paper);
  }
  for (let y = 5; y < 166; y += 12) {
    circle(0, y, 3, paper);
    circle(154, y, 3, paper);
  }
  ctx.strokeStyle = paper;
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 12, 130, 142);
  circle(78, 68, 32, paper);
  circle(91, 58, 31, stamp);
  for (const [x, y] of [[37, 37], [111, 31], [120, 85], [46, 101]]) {
    circle(x, y, 2.5, paper);
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

function renderCard() {
  const raw = message.value;
  const hasMessage = Boolean(raw.trim());
  const text = hasMessage ? raw : sample;
  const palette = palettes[document.querySelector('input[name="paper"]:checked').value];
  let size = 78;
  let lines;
  do {
    ctx.font = size + 'px Manuscrita, cursive';
    lines = wrapText(text, 864);
    if (lines.length * size * 1.22 <= 350 || size <= 42) break;
    size -= 6;
  } while (true);
  const leading = Math.ceil(size * 1.22);
  card.height = Math.max(744, 365 + lines.length * leading);
  ctx.fillStyle = palette.paper;
  ctx.fillRect(0, 0, card.width, card.height);
  ctx.strokeStyle = palette.stamp;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(24, 24, card.width - 48, card.height - 48);
  drawStamp(palette);
  ctx.fillStyle = palette.stamp;
  ctx.font = '23px monospace';
  ctx.fillText('C O R R E I O   L U N A R', 76, 99);
  ctx.fillRect(77, 120, 70, 2);
  ctx.fillStyle = palette.ink;
  ctx.font = size + 'px Manuscrita, cursive';
  const firstY = 222 + (card.height - 327 - lines.length * leading) / 2 + size;
  lines.forEach((line, i) => ctx.fillText(line, 108, firstY + i * leading));
  ctx.fillStyle = palette.stamp;
  ctx.font = '22px monospace';
  ctx.fillText('☾  uma lua para lulu', 76, card.height - 65);
  card.setAttribute('aria-label', (hasMessage ? 'Seu bilhetinho. ' : 'Exemplo. ') + text);
  document.querySelector('#count').textContent = raw.length + ' / 280';
  download.disabled = !hasMessage;
  statusText.textContent = '';
}

message.addEventListener('input', renderCard);
document.querySelectorAll('input[name="paper"]').forEach(input => {
  input.addEventListener('change', renderCard);
});
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
renderCard();
document.fonts.load('78px Manuscrita').then(renderCard, renderCard);
