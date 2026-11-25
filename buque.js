'use strict';
// Buquê "flor de lua": as flores sobem de dentro do papel e desabrocham ao toque.
// Depois de aberto, uma das flores esconde um beijinho para a Lulu procurar.
// O SVG é montado aqui para manter o HTML enxuto; sem JavaScript, a seção continua legível.
(() => {
  const stage = document.getElementById('bouquet');
  if (!stage) return;
  const svg = stage.querySelector('svg');
  const status = document.getElementById('bouquet-status');
  const hint = document.getElementById('bouquet-hint');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const BASE = {x: 200, y: 470};
  const f = n => Math.round(n * 10) / 10;

  // Formatos de pétala: a base fica na origem e a ponta aponta para cima.
  const shapes = {
    pointed: s => `M0 0C${f(s*.5)} ${f(-s*.22)} ${f(s*.46)} ${f(-s*.78)} 0 ${f(-s)}C${f(-s*.46)} ${f(-s*.78)} ${f(-s*.5)} ${f(-s*.22)} 0 0Z`,
    slim: s => `M0 0C${f(s*.17)} ${f(-s*.3)} ${f(s*.16)} ${f(-s*.88)} 0 ${f(-s)}C${f(-s*.16)} ${f(-s*.88)} ${f(-s*.17)} ${f(-s*.3)} 0 0Z`,
    round: s => `M0 0C${f(s*.78)} ${f(-s*.12)} ${f(s*.72)} ${f(-s)} 0 ${f(-s)}C${f(-s*.72)} ${f(-s)} ${f(-s*.78)} ${f(-s*.12)} 0 0Z`,
    leaf: s => `M0 0C${f(s*.34)} ${f(-s*.2)} ${f(s*.3)} ${f(-s*.76)} 0 ${f(-s)}C${f(-s*.3)} ${f(-s*.76)} ${f(-s*.34)} ${f(-s*.2)} 0 0Z`,
    tepal: wide => s => `M0 0C${f(s*wide)} ${f(-s*.18)} ${f(s*wide*1.15)} ${f(-s*.6)} 0 ${f(-s)}C${f(-s*wide*1.15)} ${f(-s*.6)} ${f(-s*wide)} ${f(-s*.18)} 0 0Z`
  };

  let petalIndex = 0;
  const pop = body => `<g class="pop" style="--pi:${petalIndex++}">${body}</g>`;
  const shade = radius => `<circle class="shade" cx="${f(radius*.05)}" cy="${f(radius*.14)}" r="${f(radius)}" fill="url(#bq-shade)"/>`;
  function ring(count, size, shape, fill, {offset = 0, stroke = 'none', extra} = {}) {
    const d = (typeof shape === 'function' ? shape : shapes[shape])(size);
    let out = '';
    for (let i = 0; i < count; i++) {
      out += `<g transform="rotate(${f(offset + (360 / count) * i)})"><g class="petal" style="--pi:${petalIndex++}"><path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width=".7"/>${extra ? extra(size) : ''}</g></g>`;
    }
    return out;
  }

  const heads = {
    moonflower: s => shade(s * .95)
      + ring(5, s, 'pointed', 'url(#bq-moonpetal)', {stroke: '#cdbf98', extra: size => `<path d="M0 -3Q1.5 ${f(-size*.5)} 0 ${f(-size*.84)}" fill="none" stroke="#cdbf98" stroke-width=".8" opacity=".6"/><path d="M0 ${f(-size*.2)}Q${f(size*.16)} ${f(-size*.5)} ${f(size*.1)} ${f(-size*.74)}M0 ${f(-size*.2)}Q${f(-size*.16)} ${f(-size*.5)} ${f(-size*.1)} ${f(-size*.74)}" fill="none" stroke="#d8cca8" stroke-width=".6" opacity=".5"/>`})
      + ring(5, s * .6, 'pointed', 'url(#bq-mooninner)', {offset: 36, stroke: '#d9cfae'})
      + pop(`<circle r="${f(s*.2)}" fill="#e8d08a" filter="url(#bq-glow)"/><path d="M0 ${f(-s*.17)}l${f(s*.05)} ${f(s*.12)} ${f(s*.12)} ${f(s*.05)}-${f(s*.12)} ${f(s*.05)}-${f(s*.05)} ${f(s*.12)}-${f(s*.05)}-${f(s*.12)}-${f(s*.12)}-${f(s*.05)} ${f(s*.12)}-${f(s*.05)}z" fill="#fff6d8"/>`),
    lily: s => {
      // Veio central e pintinhas na garganta de cada pétala.
      const marks = size => `<path d="M0 ${f(-size*.1)}Q${f(size*.03)} ${f(-size*.5)} 0 ${f(-size*.88)}" fill="none" stroke="#d49f93" stroke-width="1.1" opacity=".7" stroke-linecap="round"/>`
        + [[-.07, -.24], [.08, -.3], [-.03, -.36], [.1, -.43], [-.1, -.45], [.02, -.51]].map(([x, y]) => `<circle cx="${f(x*size)}" cy="${f(y*size)}" r="${f(size*.022)}" fill="#a9605a" opacity=".7"/>`).join('');
      let stamens = '';
      for (let i = 0; i < 6; i++) {
        stamens += `<g transform="rotate(${i * 60 + 30})"><path d="M0 0Q${f(s*.05)} ${f(-s*.22)} 0 ${f(-s*.42)}" fill="none" stroke="#d9dfbd" stroke-width="1.1"/><ellipse cx="0" cy="${f(-s*.44)}" rx="${f(s*.09)}" ry="${f(s*.034)}" fill="#a65a2e" transform="rotate(${i % 2 ? 20 : -20} 0 ${f(-s*.44)})"/></g>`;
      }
      return shade(s * .9)
        + ring(3, s, shapes.tepal(.25), 'url(#bq-lily-back)', {stroke: '#d3bdae', extra: marks})
        + ring(3, s * .97, shapes.tepal(.33), 'url(#bq-lily)', {offset: 60, stroke: '#d9c5b6', extra: marks})
        + pop(`<circle r="${f(s*.11)}" fill="#c9d3a8"/>${stamens}<circle r="${f(s*.05)}" fill="#8fa26f"/>`);
    },
    lilybud: s => `<g class="leaf"><path d="M0 5C${f(s*.3)} ${f(-s*.08)} ${f(s*.22)} ${f(-s*.8)} 0 ${f(-s)}C${f(-s*.22)} ${f(-s*.8)} ${f(-s*.3)} ${f(-s*.08)} 0 5Z" fill="url(#bq-bud)" stroke="#8c9c7c" stroke-width=".7"/><path d="M${f(s*.08)} 0Q${f(s*.14)} ${f(-s*.5)} 0 ${f(-s*.97)}M${f(-s*.08)} 0Q${f(-s*.14)} ${f(-s*.5)} 0 ${f(-s*.97)}" fill="none" stroke="#b9a98c" stroke-width=".7" opacity=".7"/></g>`,
    daisy: s => shade(s * .9)
      + ring(13, s, 'slim', '#dcd5c1', {offset: 14, stroke: '#c5beaa'})
      + ring(13, s * .93, 'slim', 'url(#bq-daisy)', {stroke: '#d3cdba'})
      + pop(`<circle r="${f(s*.27)}" fill="url(#bq-daisy-eye)"/><circle r="${f(s*.2)}" fill="none" stroke="#b08a3c" stroke-width="${f(s*.09)}" stroke-dasharray="1.2 2.2" opacity=".75"/><circle r="${f(s*.09)}" fill="none" stroke="#f6e3a6" stroke-width="${f(s*.07)}" stroke-dasharray="1 1.8"/>`),
    rose: s => shade(s * .98)
      + ring(5, s, 'round', 'url(#bq-rose-out)', {stroke: '#a16a65'})
      + ring(5, s * .75, 'round', 'url(#bq-rose-mid)', {offset: 36, stroke: '#ad7670'})
      + ring(4, s * .52, 'round', 'url(#bq-rose-in)', {offset: 12, stroke: '#b9837c'})
      + ring(3, s * .32, 'round', '#f0cfc5', {offset: 45, stroke: '#c4918a'})
      + pop(`<path d="M0 0c${f(s*.1)} ${f(-s*.03)} ${f(s*.1)} ${f(s*.11)} 0 ${f(s*.11)}c${f(-s*.16)} 0 ${f(-s*.17)} ${f(-s*.2)} 0 ${f(-s*.21)}c${f(s*.22)} 0 ${f(s*.23)} ${f(s*.28)} 0 ${f(s*.29)}" fill="none" stroke="#a46c67" stroke-width="1.4" stroke-linecap="round"/>`),
    star: s => shade(s * .95)
      + ring(5, s, 'round', 'url(#bq-gold)', {stroke: '#bfa468'})
      + pop(`<circle r="${f(s*.26)}" fill="#b98f43"/><circle r="${f(s*.14)}" fill="#e7cd86"/>`),
    crescent: s => pop(`<path d="M0 ${-s}A${s} ${s} 0 1 0 0 ${s}A${f(s*1.25)} ${f(s*1.25)} 0 0 1 0 ${-s}Z" fill="#f1e2b0" filter="url(#bq-glow)" transform="rotate(-20)"/>`)
      + pop(`<path d="M${f(s*1.3)} ${f(-s*1.25)}l1.6 3.6 3.6 1.6-3.6 1.6-1.6 3.6-1.6-3.6-3.6-1.6 3.6-1.6z" fill="#e8d8a9"/>`),
    breath: s => {
      let out = '';
      const twigs = [[-.9, -.5], [-.45, -1], [0, -.62], [.5, -.95], [.92, -.42], [-.2, -1.25], [.28, -1.35]];
      twigs.forEach(([x, y]) => {
        const tx = f(x * s), ty = f(y * s);
        out += `<path d="M0 0Q${f(tx*.3)} ${f(ty*.6)} ${tx} ${ty}" fill="none" stroke="#8a9a7c" stroke-width=".9"/>`;
        out += `<g transform="translate(${tx} ${ty})">${pop('<circle r="3.1" fill="#f4efe2"/><circle cx="3" cy="2" r="2.2" fill="#e6dfcc"/><circle cx="-2.6" cy="1.8" r="1.8" fill="#f8f4ea"/>')}</g>`;
      });
      return out;
    }
  };

  function leaf(x, y, angle, size, fill = 'url(#bq-leaf)', round = false) {
    const d = round ? `M0 0C${f(size*.62)} ${f(-size*.05)} ${f(size*.62)} ${f(-size*.95)} 0 ${f(-size)}C${f(-size*.62)} ${f(-size*.95)} ${f(-size*.62)} ${f(-size*.05)} 0 0Z` : shapes.leaf(size);
    const rib = round
      ? `<path d="M0 -1V${f(-size*.8)}" fill="none" stroke="#6b7d63" stroke-width=".6" opacity=".5"/>`
      : `<path d="M0 -1Q${f(size*.06)} ${f(-size*.5)} 0 ${f(-size*.9)}M0 ${f(-size*.3)}L${f(size*.14)} ${f(-size*.46)}M0 ${f(-size*.3)}L${f(-size*.14)} ${f(-size*.46)}M0 ${f(-size*.52)}L${f(size*.12)} ${f(-size*.66)}M0 ${f(-size*.52)}L${f(-size*.12)} ${f(-size*.66)}" fill="none" stroke="#5f7258" stroke-width=".7" opacity=".55"/>`;
    return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(angle)})"><g class="leaf"><path d="${d}" fill="${fill}" stroke="#62755a" stroke-width=".6"/>${rib}</g></g>`;
  }

  function onCurve(p0, c, p1, t) {
    const u = 1 - t;
    return {
      x: u*u*p0.x + 2*u*t*c.x + t*t*p1.x,
      y: u*u*p0.y + 2*u*t*c.y + t*t*p1.y,
      angle: Math.atan2(2*u*(c.y-p0.y) + 2*t*(p1.y-c.y), 2*u*(c.x-p0.x) + 2*t*(p1.x-c.x)) * 180 / Math.PI
    };
  }

  // Cada haste: tipo, posição final da flor, tamanho, curvatura, folhas e quanto ela afunda no papel.
  // A ordem define quem fica na frente; "tissue" marca onde entra o papel de seda.
  const stems = [
    {type: 'sprig', x: 44, y: 192, bend: -30, sink: 150},
    {type: 'sprig', x: 358, y: 170, bend: 34, sink: 150},
    {type: 'leafy', x: 98, y: 236, bend: -14, sink: 120, leaves: [[.86, -1, 40], [.97, 1, 34], [.78, 1, 30]]},
    {type: 'leafy', x: 302, y: 230, bend: 14, sink: 120, leaves: [[.86, 1, 40], [.97, -1, 34], [.78, -1, 30]]},
    {type: 'leafy', x: 200, y: 222, bend: 0, sink: 120, leaves: [[.95, -1, 38], [.95, 1, 38]]},
    {type: 'breath', x: 64, y: 114, s: 24, bend: -18, sink: 118},
    {type: 'breath', x: 340, y: 102, s: 24, bend: 20, sink: 118},
    {type: 'breath', x: 222, y: 74, s: 18, bend: 6, sink: 118},
    {type: 'crescent', x: 262, y: 44, s: 15, bend: 10, sink: 128, wire: true},
    {type: 'lilybud', x: 166, y: 70, s: 34, bend: -8, sink: 136, tilt: -9},
    {type: 'daisy', x: 60, y: 192, s: 27, bend: -16, sink: 120},
    {type: 'daisy', x: 342, y: 188, s: 26, bend: 18, sink: 120},
    {type: 'lily', x: 120, y: 130, s: 47, bend: -12, sink: 150, tilt: -16, leaves: [[.5, 1, 32]]},
    {type: 'lily', x: 290, y: 122, s: 45, bend: 14, sink: 150, tilt: 22, leaves: [[.52, -1, 32]]},
    {type: 'rose', x: 132, y: 224, s: 36, bend: -8, sink: 135, leaves: [[.42, -1, 30], [.5, 1, 24]]},
    {type: 'rose', x: 276, y: 214, s: 34, bend: 10, sink: 135, leaves: [[.45, 1, 30]]},
    {type: 'moonflower', x: 204, y: 168, s: 54, bend: 4, sink: 175, leaves: [[.62, -1, 32], [.7, 1, 28]]},
    {type: 'tissue'},
    {type: 'star', x: 82, y: 252, s: 14, bend: -10, sink: 120},
    {type: 'star', x: 326, y: 254, s: 13, bend: 10, sink: 120},
    {type: 'daisy', x: 230, y: 266, s: 25, bend: 6, sink: 120},
    {type: 'star', x: 178, y: 274, s: 14, bend: -4, sink: 110}
  ];
  const tappable = ['moonflower', 'lily', 'daisy', 'rose', 'star', 'crescent'];

  const tissue = `<g class="tissue"><path d="M200 506 56 276 76 262 92 280 110 270 124 290 142 282 156 302 174 296 186 316 200 310 214 320 228 300 244 308 258 286 276 294 290 272 308 280 322 260 344 270Z" fill="url(#bq-tissue)" stroke="#d3dcc6" stroke-width=".8" stroke-linejoin="round"/><path d="M92 280 150 420M124 290 168 430M156 302 184 440M244 308 216 440M276 294 232 430M308 280 250 420" fill="none" stroke="#6f8266" stroke-width=".6" opacity=".35"/></g>`;

  function buildStem(stem, order) {
    if (stem.type === 'tissue') return tissue;
    petalIndex = 0;
    const p0 = {x: BASE.x + (stem.x - BASE.x) * .08, y: BASE.y};
    const p1 = {x: stem.x, y: stem.y};
    const c = {x: (p0.x + p1.x) / 2 + stem.bend, y: (p0.y + p1.y) / 2 + 20};
    const width = stem.type === 'moonflower' || stem.type === 'lily' ? 3.2 : stem.wire ? 1.4 : 2.4;
    const color = stem.wire ? '#cdb878' : order % 2 ? '#7d9071' : '#72866a';
    let body = `<path d="M${f(p0.x)} ${f(p0.y)}Q${f(c.x)} ${f(c.y)} ${p1.x} ${p1.y}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;

    if (stem.type === 'sprig') {
      // Raminho de eucalipto: folhas redondas alternadas ao longo da haste.
      for (let i = 0; i < 6; i++) {
        const point = onCurve(p0, c, p1, .45 + i * .1);
        const side = i % 2 ? 1 : -1;
        body += leaf(point.x, point.y, point.angle + 90 + side * 62, 14 - i * .9, i % 2 ? '#93a48a' : '#a5b39a', true);
      }
    }
    (stem.leaves || []).forEach(([t, side, size]) => {
      const point = onCurve(p0, c, p1, t);
      body += leaf(point.x, point.y, point.angle + 90 + side * 52, size);
    });
    if (heads[stem.type]) {
      const tilt = stem.tilt ?? f((stem.x - BASE.x) * .12);
      const mark = tappable.includes(stem.type) ? ` data-flower="${order}"` : '';
      body += `<g transform="translate(${p1.x} ${p1.y}) rotate(${tilt})"><g class="head"${mark}>${heads[stem.type](stem.s)}</g></g>`;
    }
    const sway = (1.1 + (order % 4) * .4).toFixed(2);
    const swayTime = (5 + (order % 5) * .7).toFixed(2);
    return `<g class="sway" style="--sw:${sway}deg;--st:${swayTime}s;--sd:${(-order * .63).toFixed(2)}s"><g class="rise" style="--d:${(order * .07).toFixed(3)}s;--sink:${stem.sink}px">${body}</g></g>`;
  }

  const up = (id, from, to, mid) => `<linearGradient id="${id}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${from}"/>${mid ? `<stop offset=".5" stop-color="${mid}"/>` : ''}<stop offset="1" stop-color="${to}"/></linearGradient>`;
  const defs = `<defs>
    <radialGradient id="bq-halo"><stop offset="0" stop-color="#e8d8a9" stop-opacity=".3"/><stop offset=".55" stop-color="#e8d8a9" stop-opacity=".08"/><stop offset="1" stop-color="#e8d8a9" stop-opacity="0"/></radialGradient>
    <radialGradient id="bq-moon" cx="36%" cy="29%" r="78%"><stop offset="0" stop-color="#fff6d8" stop-opacity=".2"/><stop offset=".55" stop-color="#ded4b3" stop-opacity=".12"/><stop offset="1" stop-color="#9d9b87" stop-opacity=".06"/></radialGradient>
    <radialGradient id="bq-shade"><stop offset="0" stop-color="#05090d" stop-opacity=".5"/><stop offset=".6" stop-color="#05090d" stop-opacity=".3"/><stop offset="1" stop-color="#05090d" stop-opacity="0"/></radialGradient>
    <radialGradient id="bq-daisy-eye" cx="40%" cy="36%" r="70%"><stop offset="0" stop-color="#f6df9c"/><stop offset=".6" stop-color="#e0bb62"/><stop offset="1" stop-color="#bf9542"/></radialGradient>
    ${up('bq-moonpetal', '#dccb97', '#fffdf6', '#f6efdc')}
    ${up('bq-mooninner', '#eadfb9', '#ffffff')}
    ${up('bq-lily', '#dba99d', '#fffaf3', '#f7ebe1')}
    ${up('bq-lily-back', '#cf9d92', '#f3ebe0', '#ecdcd0')}
    ${up('bq-bud', '#8fa37f', '#efe6d2', '#c5cfae')}
    ${up('bq-daisy', '#d9d2be', '#fdfbf5')}
    ${up('bq-rose-out', '#a36a66', '#d49d95')}
    ${up('bq-rose-mid', '#b47973', '#e0ada4')}
    ${up('bq-rose-in', '#c38880', '#ecc3b9')}
    ${up('bq-gold', '#c4a65e', '#f3e7bf')}
    ${up('bq-leaf', '#667a5e', '#a6b697')}
    ${up('bq-tissue', '#74866b', '#c5cfb7')}
    <linearGradient id="bq-wrap-left" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0ebdc"/><stop offset=".55" stop-color="#e2dac6"/><stop offset="1" stop-color="#c9bfa5"/></linearGradient>
    <linearGradient id="bq-wrap-right" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f2e7"/><stop offset=".5" stop-color="#e9e2d0"/><stop offset="1" stop-color="#cfc5ab"/></linearGradient>
    <linearGradient id="bq-wrap-back" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8d8870"/><stop offset=".5" stop-color="#5b594b"/><stop offset="1" stop-color="#3b3b33"/></linearGradient>
    <linearGradient id="bq-ribbon" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6ebc6"/><stop offset=".5" stop-color="#e3cd8c"/><stop offset="1" stop-color="#c0a45d"/></linearGradient>
    <linearGradient id="bq-lip" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1e4b9"/><stop offset="1" stop-color="#cdb675"/></linearGradient>
    <filter id="bq-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <clipPath id="bq-cone"><path d="M-80 -120H480V238L348 244 200 506 52 244-80 238Z"/></clipPath>
  </defs>`;

  // Lua pálida atrás do buquê, no mesmo traço da lua do topo da página.
  const moon = `<g class="bq-moon"><circle cx="200" cy="172" r="156" fill="url(#bq-moon)"/><g fill="#0d141b" opacity=".1"><path d="M118 70c-4 22 34 25 32 43-1 16-26 12-35 28-10 18 1 25 26 31 26 7 17 34 33 45 19 13 42 0 53-20 15-26 4-49-14-62-16-12-5-35-31-45-23-9-30-32-64-20Z"/><ellipse cx="282" cy="118" rx="30" ry="20"/><ellipse cx="96" cy="212" rx="22" ry="30"/><circle cx="292" cy="226" r="17"/></g><circle cx="200" cy="172" r="156" fill="none" stroke="#e8d8a9" stroke-opacity=".2"/></g>`;
  const wrapBack = `<g class="wrap-back"><path d="M200 506 52 244C82 226 112 236 138 230 162 224 182 236 200 228 222 236 244 222 266 230 292 236 318 224 348 244Z" fill="url(#bq-wrap-back)" stroke="#a8a085" stroke-width="1"/><path d="M52 244C82 226 112 236 138 230 162 224 182 236 200 228 222 236 244 222 266 230 292 236 318 224 348 244" fill="none" stroke="#d8cfb6" stroke-width="1.6" opacity=".7"/></g>`;
  const wrapFront = `<g class="wrap-front">
    <path d="M200 506 70 282C112 290 150 310 216 352Z" fill="url(#bq-wrap-left)" stroke="#b3ac95" stroke-width="1"/>
    <path d="M200 506 118 296M200 506 160 318M200 506 96 322" fill="none" stroke="#a79f86" stroke-width=".7" opacity=".4"/>
    <path d="M70 282C112 290 150 310 216 352L210 363C150 324 112 304 77 295Z" fill="url(#bq-lip)" stroke="#b39853" stroke-width=".6"/>
    <path d="M200 506 184 362 164 346Z" fill="#1a1c17" opacity=".16"/>
    <path d="M200 506 332 276C284 296 236 322 184 362Z" fill="url(#bq-wrap-right)" stroke="#b3ac95" stroke-width="1"/>
    <path d="M200 506 286 302M200 506 240 326M200 506 306 318" fill="none" stroke="#a79f86" stroke-width=".7" opacity=".4"/>
    <path d="M332 276C284 296 236 322 184 362L190 374C238 336 286 310 325 289Z" fill="url(#bq-lip)" stroke="#b39853" stroke-width=".6"/>
    <g fill="#b3a57c" opacity=".6" font-family="Georgia,serif" font-size="11"><text x="126" y="376">✦</text><text x="252" y="358">☾</text><text x="234" y="456" font-size="8">✧</text><text x="150" y="450" font-size="8">♡</text><text x="282" y="330" font-size="8">✦</text><text x="104" y="336" font-size="8">✧</text></g>
    <ellipse cx="200" cy="420" rx="56" ry="12" fill="#1a1c17" opacity=".13"/>
  </g>`;
  const ribbon = `<g transform="translate(200 410)"><g class="ribbon">
    <path d="M-4 4C-14 26-24 46-38 66L-29 63-24 73C-12 50-3 28 4 6Z" fill="url(#bq-ribbon)" stroke="#b39853" stroke-width=".7"/>
    <path d="M4 4C14 24 26 42 42 60L33 59 30 69C16 48 6 28-4 6Z" fill="url(#bq-ribbon)" stroke="#b39853" stroke-width=".7"/>
    <g class="bow-left"><path d="M0 0C-26-32-64-20-52 4-42 21-16 10 0 0Z" fill="url(#bq-ribbon)" stroke="#b39853" stroke-width=".8"/><path d="M-7-2C-22-17-42-15-45-3-36-10-20-9-7-2Z" fill="#a3863f" opacity=".5"/><path d="M-14-16C-26-22-40-19-46-10" fill="none" stroke="#fff6d8" stroke-width="1.2" opacity=".6" stroke-linecap="round"/></g>
    <g class="bow-right"><path d="M0 0C26-32 64-20 52 4 42 21 16 10 0 0Z" fill="url(#bq-ribbon)" stroke="#b39853" stroke-width=".8"/><path d="M7-2C22-17 42-15 45-3 36-10 20-9 7-2Z" fill="#a3863f" opacity=".5"/><path d="M14-16C26-22 40-19 46-10" fill="none" stroke="#fff6d8" stroke-width="1.2" opacity=".6" stroke-linecap="round"/></g>
    <rect x="-9" y="-8" width="18" height="17" rx="6" fill="#e9d595" stroke="#b39853" stroke-width=".8"/><path d="M-4-5Q-1 0-4 6M3-5Q5 0 3 6" fill="none" stroke="#b39853" stroke-width=".7" opacity=".6"/>
    <g class="tag"><path d="M4 6Q22 26 34 40" fill="none" stroke="#cdb878" stroke-width="1"/>
      <g transform="translate(34 40) rotate(-14)"><path d="M-6-4H58L66 9 58 22H-6Z" fill="#eee8d8" stroke="#b9b3a0"/><circle cx="56" cy="9" r="2.3" fill="#111820" opacity=".55"/><text x="-1" y="14" font-family="'Segoe Print','Comic Sans MS',cursive" font-size="10.5" fill="#56604d">para Lulu ♡</text></g></g>
  </g></g>`;
  const sparkles = [[30, 96, 13], [372, 60, 15], [120, 30, 10], [376, 300, 11], [26, 300, 9], [318, 22, 9]]
    .map(([x, y, size], i) => `<text class="bq-sparkle" x="${x}" y="${y}" font-size="${size}" style="--i:${i}">${i % 2 ? '✧' : '✦'}</text>`).join('');

  svg.innerHTML = defs
    + `<circle class="bq-halo" cx="200" cy="180" r="200" fill="url(#bq-halo)"/>${moon}`
    + `<g class="bouquet-art">${wrapBack}<g clip-path="url(#bq-cone)">${stems.map(buildStem).join('')}</g>${wrapFront}${ribbon}</g>`
    + `<g fill="#e8d8a9">${sparkles}</g>`;

  const flowers = stems.map((stem, order) => ({...stem, head: svg.querySelector(`[data-flower="${order}"]`)})).filter(flower => flower.head);
  const kissable = flowers.filter(flower => flower.type !== 'crescent');
  const flowerColors = {
    moonflower: ['#fbf6e8', '#e8d8a9'], lily: ['#f7ebe1', '#dba99d'], daisy: ['#f4efe2', '#e0bb62'],
    rose: ['#d9a39b', '#e9c2b8'], star: ['#e8d8a9', '#f3e7bf'], crescent: ['#f1e2b0', '#e8d8a9']
  };

  // Partículas em HTML por cima do SVG; as posições são em pixels dentro do palco.
  function spawn(className, x, y, styles, life, text) {
    const element = document.createElement('span');
    element.className = className;
    element.style.left = `${f(x)}px`;
    element.style.top = `${f(y)}px`;
    if (text) element.textContent = text;
    Object.entries(styles).forEach(([key, value]) => element.style.setProperty(key, value));
    stage.append(element);
    setTimeout(() => element.remove(), life);
  }
  function scatter(count, x, y, {colors, className = 'bq-petal', reach = 130, text, jitter = 10}) {
    if (reduceMotion.matches) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = reach * (.45 + Math.random() * .55);
      spawn(className, x + (Math.random() - .5) * jitter, y + (Math.random() - .5) * jitter, {
        '--dx': `${f(Math.cos(angle) * distance)}px`, '--up': `${f(-30 - Math.random() * reach * .7)}px`,
        '--fall': `${f(reach * (.7 + Math.random() * 1.2))}px`, '--turn': `${f(Math.random() * 720 - 360)}deg`,
        '--t': `${f(1.8 + Math.random() * 1.4)}s`, '--c': colors[i % colors.length],
        '--size': `${f(7 + Math.random() * 6)}px`
      }, 3400, text && text[i % text.length]);
    }
  }
  const allColors = ['#f4efe2', '#e9c2b8', '#d9a39b', '#e8d8a9', '#fbf6e8'];
  function firefly() {
    if (reduceMotion.matches || document.hidden) return;
    const box = stage.getBoundingClientRect();
    spawn('bq-firefly', box.width * (.14 + Math.random() * .72), box.height * (.16 + Math.random() * .44), {
      '--dx': `${f(Math.random() * 60 - 30)}px`, '--dy': `${f(-70 - Math.random() * 90)}px`,
      '--t': `${f(3.2 + Math.random() * 2.6)}s`
    }, 6000);
  }

  const messages = [
    'Lírios, margaridas, rosinhas e uma flor de lua. Tudo seu. ♡',
    'Tem um beijinho escondido numa dessas flores. Pode procurar.',
    'Essas não murcham. Igual ao que eu sinto por você.',
    'Se eu pudesse, entregava pessoalmente. Com um abraço junto.',
    'Escolhi uma por uma. Nenhuma é tão linda quanto você.'
  ];
  const warmMessages = ['Tá quente! O beijinho tá pertinho.', 'Quentinho, quentinho… é logo ali.', 'Quase! Tenta a florzinha do lado.'];
  const coldMessages = ['Tá frio… procura mais longe.', 'Aqui não. Esse beijinho sabe se esconder.', 'Friozinho. Tenta do outro lado do buquê.'];
  const foundMessages = [
    'Achou! Esse beijinho era pra você. Smack. ♡',
    'Achou de novo! Pode ficar com todos.',
    'Mais um beijinho pra coleção. ♡',
    'Você é boa nisso. Ainda bem: tenho muitos guardados.'
  ];
  let state = 'closed';
  let fireflyTimer = 0;
  let visible = true;
  let lastTap = 0;
  let turn = {message: 0, warm: 0, cold: 0, keyboard: 0};
  let found = 0;
  let kiss = null;

  function hideKiss(previous) {
    const options = kissable.filter(flower => flower !== previous);
    kiss = options[Math.floor(Math.random() * options.length)];
  }
  hideKiss();

  function startFireflies() {
    clearInterval(fireflyTimer);
    if (state === 'closed' || !visible || reduceMotion.matches) return;
    fireflyTimer = setInterval(firefly, 650);
  }
  function replay(element, className) {
    element.classList.remove(className);
    void element.getBoundingClientRect();
    element.classList.add(className);
  }
  function centerOf(flower) {
    const box = flower.head.getBoundingClientRect();
    const stageBox = stage.getBoundingClientRect();
    return {x: box.left + box.width / 2 - stageBox.left, y: box.top + box.height / 2 - stageBox.top, radius: Math.max(box.width, box.height) / 2};
  }
  // A flor mais à frente cujo miolo esteja perto do toque.
  function flowerAt(clientX, clientY) {
    const stageBox = stage.getBoundingClientRect();
    for (let i = flowers.length - 1; i >= 0; i--) {
      const point = centerOf(flowers[i]);
      const reach = Math.max(point.radius * .82, 20);
      if (Math.hypot(clientX - stageBox.left - point.x, clientY - stageBox.top - point.y) <= reach) return flowers[i];
    }
    return null;
  }

  function touchFlower(flower) {
    const point = centerOf(flower);
    if (flower.type === 'crescent') {
      replay(flower.head, 'nudge');
      status.textContent = 'A lua é só enfeite. O beijinho tá numa flor. ♡';
      return;
    }
    if (flower === kiss) {
      found++;
      replay(flower.head, 'kissed');
      status.textContent = foundMessages[Math.min(found, foundMessages.length) - 1];
      hint.textContent = `${found === 1 ? '1 beijinho achado' : `${found} beijinhos achados`} ♡ escondi outro…`;
      scatter(14, point.x, point.y, {className: 'bq-heart', colors: ['#e9a9a0', '#e8d8a9', '#f3c9c0'], text: ['♥', '♡', '♥'], reach: 110});
      if (!reduceMotion.matches) spawn('bq-smack', point.x, point.y, {}, 1900, 'smack ♡');
      hideKiss(flower);
      return;
    }
    replay(flower.head, 'nudge');
    scatter(5, point.x, point.y, {colors: flowerColors[flower.type], reach: 60});
    const warm = Math.hypot(flower.x - kiss.x, flower.y - kiss.y) < 115;
    status.textContent = warm ? warmMessages[turn.warm++ % warmMessages.length] : coldMessages[turn.cold++ % coldMessages.length];
  }

  stage.addEventListener('click', event => {
    if (Date.now() - lastTap < 280) return;
    lastTap = Date.now();
    if (state === 'closed') {
      state = 'opening';
      stage.dataset.state = 'open';
      stage.setAttribute('aria-label', 'Buquê aberto. Toque nas flores para procurar o beijinho escondido.');
      replay(stage, 'pop');
      status.textContent = 'pra você, Lulu. com todo o meu carinho. ♡';
      hint.textContent = 'tem um beijinho escondido numa flor. procura ✿';
      if (reduceMotion.matches) {
        state = 'open';
        stage.classList.add('settled');
        return;
      }
      setTimeout(() => {
        const box = stage.getBoundingClientRect();
        scatter(28, box.width / 2, box.height * .4, {colors: allColors, reach: 150, jitter: 60});
      }, 900);
      setTimeout(() => { state = 'open'; stage.classList.add('settled'); startFireflies(); }, 3000);
      return;
    }
    if (state !== 'open') return;
    // Pelo teclado não há ponto de toque: cada Enter visita a próxima flor.
    const flower = event.detail === 0 ? kissable[turn.keyboard++ % kissable.length] : flowerAt(event.clientX, event.clientY);
    if (flower) {
      touchFlower(flower);
      return;
    }
    status.textContent = messages[turn.message++ % messages.length];
    replay(stage, 'rustle');
    const box = stage.getBoundingClientRect();
    scatter(10, box.width / 2, box.height * .34, {colors: allColors, reach: 110, jitter: 50});
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      stage.classList.toggle('is-paused', !visible);
      if (visible) startFireflies(); else clearInterval(fireflyTimer);
    }).observe(stage);
  }
  reduceMotion.addEventListener('change', () => { if (reduceMotion.matches) clearInterval(fireflyTimer); else startFireflies(); });
})();
