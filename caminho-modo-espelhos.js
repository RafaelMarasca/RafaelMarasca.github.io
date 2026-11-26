// Dois caminhos — fase "espelhos de luar" (modo "espelhos"), a última do jogo.
// Duas ilhas, uma em cima da outra: a do Rafo (em cima, mais longe) e a da Lulu
// (embaixo). Cada um anda só na sua ilha e só gira os espelhos de lá.
// A lanterna de lua, na beirada de trás da ilha do Rafo, solta um raio de luar que
// anda de casa em casa. Os espelhos (na diagonal, '/' ou '\') desviam o raio; andar
// contra um espelho faz ele girar. Quando o raio sai da fileira da frente da ilha do
// Rafo, atravessa o vão e entra na fileira de trás da ilha da Lulu, na mesma coluna
// (e o contrário, se subir). Saindo por qualquer outra beirada, ele acaba.
// O raio para nas pedras, no portão fechado e em quem estiver na frente (quem fica na
// frente do raio faz sombra). Chegando num botão de flor de lua (na ilha da Lulu), ela
// abre. Com todas abertas ao mesmo tempo, a rodada acaba. São três rodadas.
//
// Cada ilha é desenhada de cima para baixo, como aparece na tela:
//   .  chão        #  pedra          v  lanterna (o raio sai para baixo)
//   /  espelho     \  espelho        *  botão de flor de lua
//   o  botão       +  portão: segura o luar, menos quando o outro está no botão
//                     (ninguém passa pelo portão; ele é só para o luar)
//   r  começo do Rafo                l  começo da Lulu
// Para escrever '\' numa string de JavaScript é preciso dobrar: '\'.
// Casas (cx, cy) de cada ilha: cx da esquerda para a direita, cy = 0 na fileira da frente.
// Todas as rodadas foram conferidas por computador (ver os comentários de cada uma).
(window.CAMINHO_MODOS ||= {}).espelhos = kit => {
  const { THREE, D, bodies, part, mat, flat, glowMat, own, shade, glow, decal, textTexture, GEO, FACE_CAMERA, say, chime, burst } = kit;
  const ROUNDS = [
    // rodada 1 — ensina a esbarrar nos espelhos.
    // Solução (3 giros, única): Rafo gira (1,1) '/' -> '\' e (3,1) '/' -> '\' (o raio desce
    // pela coluna 3 até a ilha da Lulu); Lulu gira (3,2) '\' -> '/' e o raio chega na flor.
    {
      rafo: [
        '. v . . .',
        '. . . . .',
        '. / . / .',
        'r . . . .'
      ],
      lulu: [
        '. . . . .',
        '. * . \\ .',
        '. . . . .',
        '. . . . l'
      ]
    },
    // rodada 2 — mais comprida, com pedras.
    // Solução (5 giros, única): Rafo gira (3,2) '\' -> '/' e (1,2) '\' -> '/'; Lulu gira
    // (1,2) '/' -> '\', (3,2) '/' -> '\' e (3,0) '\' -> '/'.
    // O Rafo começa em (1,1), bem no caminho certo do raio: no fim ele tem que sair da frente.
    {
      rafo: [
        '. # . v .',
        '. \\ . \\ .',
        '# r . . .',
        '. . . # .'
      ],
      lulu: [
        '. . # . .',
        '. / . / #',
        'l . . . .',
        '. * . \\ .'
      ]
    },
    // rodada 3 — os dois juntos: um portão na ilha do Rafo e o botão na ilha da Lulu.
    // Solução (4 giros, única): Rafo gira (1,2) '/' -> '\' e (3,2) '/' -> '\'; Lulu gira
    // (3,2) '\' -> '/' e (1,2) '\' -> '/'. Aí a Lulu fica no botão (4,0) — fora do raio —
    // para o portão (2,2) deixar o luar passar, e o Rafo sai da frente.
    // Sem o portão aberto não há solução.
    {
      rafo: [
        '. v . # .',
        '. / + / .',
        '. . . . .',
        'r . # . .'
      ],
      lulu: [
        '. . . . .',
        '# \\ . \\ .',
        '. . . . .',
        'l * . . o'
      ]
    }
  ];
  const COLS = 5, ROWS = 4, WHO = ['rafo', 'lulu'];
  const LAMPS = { v: 'D', '^': 'U', '<': 'L', '>': 'R' };
  // como cada espelho desvia o raio
  const BOUNCE = { '/': { R: 'U', U: 'R', L: 'D', D: 'L' }, '\\': { R: 'D', D: 'R', L: 'U', U: 'L' } };
  const MOON = '#fff6d8', PALE = '#dfe6ff', FRAME = '#8f99c8';
  const BEAM_H = .3; // altura do raio acima das casas
  const LILAC = new THREE.Color('#d9d2ff'), WARM = new THREE.Color('#fff2c0'); // botão fechado / flor acesa
  let L, T, round = 0, won = 0, gotPhoto = false, done = false, finale = 0, finished = false, litTime = 0;
  let cells = {}, mirrors = [], buds = [], lamps = [], button = null, gate = null, gateOpen = false;
  let told = {}, beam = null, trace = { segs: [], glows: [] };

  // ---------- peças ----------
  function makeRock(seed) {
    const g = new THREE.Group();
    g.add(part(GEO.sphere, mat('#cfc8b0'), 0, .17, 0, .38, .27, .35));
    g.add(part(GEO.sphere, mat('#bdb7a2'), seed % 2 ? .22 : -.2, .1, .14, .2, .15, .2));
    g.add(part(GEO.sphere, mat('#e4dec8'), -.06, .36, -.04, .16, .07, .15));
    for (const [x, z, r] of [[.12, .2, .07], [-.14, .16, .05]]) g.add(part(GEO.sphere, mat('#b3ad97'), x, .3, z, r, .02, r));
    g.rotation.y = seed * 1.7;
    return shade(g, true, true);
  }
  function makeLamp(dir) {
    const g = new THREE.Group();
    g.add(part(GEO.cyl, mat('#cfc8b0'), 0, .06, 0, .34, .12, .34));
    g.add(part(GEO.cyl, mat('#b9b3cc'), 0, .2, 0, .24, .16, .24));
    g.add(part(GEO.cyl, mat(FRAME), 0, .55, 0, .06, .6, .06));
    g.add(part(GEO.sphere, mat(FRAME), 0, .87, 0, .14, .05, .14));
    g.add(part(GEO.sphere, glowMat('#fff3c4', 1), 0, 1, 0, .17));
    // chapeuzinho da lanterna, com uma luazinha na ponta
    g.add(part(GEO.cone, mat(FRAME), 0, 1.24, 0, .2, .16, .2));
    g.add(part(GEO.sphere, glowMat('#fff0b3', .8), 0, 1.36, 0, .05));
    shade(g, true);
    // biquinho de onde sai o raio, na altura do raio
    const [dx, dy] = T.dirs[dir];
    const out = new THREE.Vector3().addScaledVector(T.right, dx).addScaledVector(T.up, dy).multiplyScalar(.28);
    g.add(part(GEO.sphere, glowMat('#fff6d8', 1), out.x, BEAM_H, out.z, .09));
    const halo = glow('#ffe9a8', 2.4, .32);
    halo.position.y = 1;
    const spout = glow('#fff2c4', .9, .5);
    spout.position.set(out.x, BEAM_H, out.z);
    g.add(halo, spout);
    g.userData = { halo };
    return g;
  }
  // Espelho baixinho: uma placa clara na diagonal, com moldura, e um risco no chão embaixo.
  // O "pivot" gira; sem girar, a placa fica ao longo do x do mundo, que é o '\' do tabuleiro.
  function makeMirror() {
    const g = new THREE.Group();
    g.add(part(GEO.cyl, mat('#b9b3cc'), 0, .03, 0, .3, .06, .3));
    const pivot = new THREE.Group();
    const line = part(GEO.box, flat('#7d8bc2'), 0, .004, 0, 1.34, .012, .075);
    pivot.add(line);
    for (const x of [-.66, .66]) pivot.add(part(GEO.sphere, flat('#7d8bc2'), x, .004, 0, .06, .01, .06));
    pivot.add(part(GEO.box, mat(PALE, { emissive: '#b8c7ff', emissiveIntensity: .45 }), 0, .3, 0, .96, .38, .08));
    const shine = part(GEO.box, flat('#ffffff'), -.12, .33, 0, .5, .035, .086);
    shine.rotation.z = .28;
    pivot.add(shine);
    pivot.add(part(GEO.box, flat('#ffffff'), .28, .25, 0, .18, .025, .086)).rotation.z = .28;
    const rail = part(GEO.cyl, mat(FRAME), 0, .5, 0, .04, 1.02, .04);
    rail.rotation.z = Math.PI / 2;
    pivot.add(rail);
    pivot.add(part(GEO.box, mat(FRAME), 0, .1, 0, 1, .05, .1));
    for (const x of [-.5, .5]) {
      pivot.add(part(GEO.cyl, mat(FRAME), x, .27, 0, .05, .5, .05));
      pivot.add(part(GEO.sphere, glowMat('#fff0b3', .7), x, .54, 0, .06));
    }
    shade(pivot, true);
    line.castShadow = false;
    g.add(pivot);
    shade(g.children[0], true, true);
    g.userData = { pivot };
    return g;
  }
  // Botão de flor de lua: fechadinho; com o luar, as pétalas abrem e acende o halo.
  function makeBud() {
    const g = new THREE.Group();
    const green = mat('#9cc7a0');
    g.add(part(GEO.cyl, green, 0, .2, 0, .028, .4, .028));
    for (const side of [-1, 1]) {
      const leaf = part(GEO.sphere, green, side * .1, .12 + side * .03, 0, .11, .03, .06);
      leaf.rotation.z = side * .55;
      g.add(leaf);
    }
    g.add(part(GEO.cyl, mat('#cfc8b0'), 0, .03, 0, .2, .06, .2));
    shade(g, true);
    const head = new THREE.Group();
    head.position.y = .46;
    head.quaternion.copy(FACE_CAMERA);
    const petal = own(new THREE.MeshLambertMaterial({ color: '#f4f0ff', emissive: '#d9d2ff', emissiveIntensity: .25 }));
    const core = own(new THREE.MeshLambertMaterial({ color: '#f6e7b8', emissive: '#ffd970', emissiveIntensity: .1 }));
    const hinges = [];
    for (let i = 0; i < 7; i++) {
      const pivot = new THREE.Group();
      pivot.rotation.y = i / 7 * Math.PI * 2;
      const hinge = new THREE.Group();
      hinge.position.z = .03;
      hinge.add(part(GEO.sphere, petal, 0, 0, .13, .085, .03, .14));
      pivot.add(hinge);
      head.add(pivot);
      hinges.push(hinge);
    }
    head.add(part(GEO.sphere, core, 0, .03, 0, .08, .06, .08));
    g.add(head);
    const halo = glow(MOON, 1.8, 0);
    halo.position.y = .46;
    const ringMat = own(new THREE.MeshBasicMaterial({ color: '#fff0b3', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    const ring = part(GEO.ring, ringMat, 0, .012, 0, .48);
    ring.rotation.x = -Math.PI / 2;
    g.add(halo, ring);
    g.scale.setScalar(1.45);
    g.userData = { head, hinges, petal, core, halo, ring };
    return g;
  }
  function makeButton() {
    const g = new THREE.Group();
    g.add(shade(part(GEO.cyl, mat('#ebe6f6'), 0, .025, 0, .48, .05, .48), false, true));
    const cap = part(GEO.cyl, own(new THREE.MeshLambertMaterial({ color: '#b9c4ff', emissive: '#b9c4ff', emissiveIntensity: .12 })), 0, .085, 0, .36, .09, .36);
    g.add(shade(cap, false, true));
    const symbol = decal(own(textTexture('☾', '#fff0b3')), .5, .9);
    symbol.position.y = .136;
    g.add(symbol);
    const halo = glow('#cdd6ff', 2.2, 0);
    halo.position.y = .3;
    g.add(halo);
    g.userData = { cap, symbol, halo };
    return g;
  }
  // Portão: dois postes e uma grade que afunda no chão quando abre.
  function makeGate(across) {
    const g = new THREE.Group();
    for (const x of [-.52, .52]) {
      g.add(part(GEO.cyl, mat(FRAME), x, .34, 0, .07, .68, .07));
      g.add(part(GEO.sphere, glowMat('#fff0b3', .7), x, .72, 0, .08));
    }
    shade(g, true);
    const panel = new THREE.Group();
    const bar = mat('#c9cff0');
    for (const y of [.14, .56]) panel.add(part(GEO.box, bar, 0, y, 0, .96, .06, .06));
    for (let i = 0; i < 5; i++) panel.add(part(GEO.cyl, bar, -.36 + i * .18, .35, 0, .028, .46, .028));
    const moon = part(GEO.crescent, glowMat('#fff0b3', .6), 0, .36, .04, .36);
    moon.rotation.z = 2.4;
    panel.add(moon);
    shade(panel, true);
    g.add(panel);
    g.rotation.y = across ? -Math.PI / 4 : Math.PI / 4;
    g.userData = { panel, k: 0 };
    return g;
  }

  // ---------- rodadas ----------
  const kindAt = (who, cx, cy) => cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS ? cells[who][cy][cx] : 'out';
  const mirrorAt = (who, cx, cy) => mirrors.find(m => m.who === who && m.cx === cx && m.cy === cy);
  const bodyAt = (who, cx, cy) => bodies.find(body => body.who === who && body.cell && body.cell[0] === cx && body.cell[1] === cy);
  const other = who => who === 'rafo' ? 'lulu' : 'rafo';
  const nome = who => `${who === 'rafo' ? 'o' : 'a'} ${D[who].nome}`;

  function setRound(n) {
    round = n;
    won = 0;
    gotPhoto = false;
    litTime = 0;
    T.clear();
    T.layout();
    L.flowers = [];
    L.photos = [];
    cells = {}; mirrors = []; buds = []; lamps = []; button = gate = null; gateOpen = false;
    for (const who of WHO) {
      const board = T.boards[who], grid = cells[who] = [];
      const rows = ROUNDS[n][who].map(row => row.split(' '));
      for (let cy = 0; cy < ROWS; cy++) grid.push([]);
      for (let r = 0; r < ROWS; r++) for (let cx = 0; cx < COLS; cx++) {
        const cy = ROWS - 1 - r, ch = rows[r][cx];
        let kind = '.';
        if (ch === '#') { kind = '#'; T.add(makeRock(cx * 7 + cy * 3 + n + (who === 'lulu' ? 5 : 0)), board, cx, cy); }
        else if (LAMPS[ch]) { kind = 'lamp'; lamps.push({ who, cx, cy, dir: LAMPS[ch], mesh: T.add(makeLamp(LAMPS[ch]), board, cx, cy) }); }
        else if (ch === '/' || ch === '\\') {
          kind = 'mirror';
          const mesh = T.add(makeMirror(), board, cx, cy);
          const angle = ch === '/' ? Math.PI / 2 : 0;
          mesh.userData.pivot.rotation.y = angle;
          mirrors.push({ who, cx, cy, kind: ch, mesh, angle, target: angle, pop: 0 });
        } else if (ch === '*') {
          kind = 'bud';
          const spot = T.spot(board, cx, cy);
          buds.push({ who, cx, cy, x: spot.x, z: spot.z, mesh: T.add(makeBud(), board, cx, cy), lit: false, k: 0 });
        } else if (ch === 'o') { kind = 'button'; button = { who, cx, cy, mesh: T.add(makeButton(), board, cx, cy) }; }
        else if (ch === '+') { kind = 'gate'; gate = { who, cx, cy, mesh: null }; }
        else if (ch === 'r') T.place(bodies[0], board, cx, cy);
        else if (ch === 'l') T.place(bodies[1], board, cx, cy);
        grid[cy][cx] = kind;
      }
    }
    if (gate) {
      // a grade fica atravessada no caminho: de lado a lado se a passagem é para a esquerda/direita
      const open = cx => !['#', 'out'].includes(kindAt(gate.who, cx, gate.cy));
      gate.mesh = T.add(makeGate(open(gate.cx - 1) && open(gate.cx + 1)), T.boards[gate.who], gate.cx, gate.cy);
    }
    refresh(false);
    kit.hud();
  }

  // ---------- o raio ----------
  // Anda de casa em casa a partir de cada lanterna e devolve os pedaços, os brilhos e as flores acesas.
  // Saindo pela frente da ilha do Rafo, passa o vão e entra por trás na ilha da Lulu (e vice-versa).
  function at(who, cx, cy, dir, off, out = new THREE.Vector3()) {
    T.spot(T.boards[who], cx, cy, out);
    if (dir) {
      const [dx, dy] = T.dirs[dir];
      out.addScaledVector(T.right, dx * off * T.cell).addScaledVector(T.up, dy * off * T.cell);
    }
    out.y = T.top + BEAM_H;
    return out;
  }
  function traceBeam() {
    const segs = [], glows = [], lit = new Set(), shadow = new Set();
    for (const lamp of lamps) {
      let who = lamp.who, x = lamp.cx, y = lamp.cy, dir = lamp.dir;
      let from = at(who, x, y, dir, .28);
      const seen = new Set();
      const end = (point, size = .9) => { segs.push([from, point]); glows.push([point, size]); };
      for (;;) {
        const [dx, dy] = T.dirs[dir];
        let nx = x + dx, ny = y + dy, nwho = who;
        if (who === 'rafo' && dir === 'D' && ny < 0) { nwho = 'lulu'; ny = ROWS - 1; }
        else if (who === 'lulu' && dir === 'U' && ny >= ROWS) { nwho = 'rafo'; ny = 0; }
        const kind = kindAt(nwho, nx, ny);
        if (kind === 'out') { end(at(who, x, y, dir, .58), .45); break; }
        const key = nwho + nx + ',' + ny + dir;
        if (seen.has(key)) { end(at(nwho, nx, ny)); break; } // deu a volta: para por aqui
        seen.add(key);
        if (nwho !== who) glows.push([at(who, x, y, dir, .5), .5], [at(nwho, nx, ny, dir, -.5), .5]); // as beiradas do vão
        const body = bodyAt(nwho, nx, ny);
        if (body) { end(at(nwho, nx, ny, dir, -.2), 1.1); shadow.add(body); break; }
        if (kind === 'bud') { end(at(nwho, nx, ny), 1.3); lit.add(buds.findIndex(bud => bud.who === nwho && bud.cx === nx && bud.cy === ny)); break; }
        if (kind === 'mirror') {
          const point = at(nwho, nx, ny);
          segs.push([from, point]);
          glows.push([point, 1]);
          from = point;
          dir = BOUNCE[mirrorAt(nwho, nx, ny).kind][dir];
          who = nwho; x = nx; y = ny;
          continue;
        }
        if (kind === '#' || kind === 'lamp') { end(at(nwho, nx, ny, dir, -.38), .8); break; }
        if (kind === 'gate' && !gateOpen) { end(at(nwho, nx, ny, dir, -.1), .9); break; }
        who = nwho; x = nx; y = ny;
      }
      glows.push([at(lamp.who, lamp.cx, lamp.cy, lamp.dir, .28), .8]);
    }
    return { segs, glows, lit, shadow };
  }
  // Recalcula portão, raio e flores depois de cada passo ou giro.
  function refresh(sound = true) {
    const open = !!gate && !!button && !!bodyAt(button.who, button.cx, button.cy);
    if (gate && open !== gateOpen && sound) chime(open ? [392, 523.25] : [523.25, 392], .07, .07);
    gateOpen = open;
    trace = traceBeam();
    buds.forEach((bud, i) => {
      const lit = trace.lit.has(i);
      if (lit && !bud.lit && sound) { chime([783.99, 1046.5], .07, .06, 'sine'); burst(bud.x, T.top + .7, bud.z, 8); }
      bud.lit = lit;
    });
    if (sound && trace.shadow.size && !told.shadow) {
      told.shadow = true;
      say(`${nome([...trace.shadow][0].who)} está fazendo sombra no luar.`, 3200);
    }
    drawBeam();
    kit.hud();
  }
  // Os pedaços do raio são reaproveitados (não se cria nada novo a cada passo).
  function piece(list, i, make) {
    if (!list[i]) { list[i] = make(); beam.add(list[i].mesh || list[i]); }
    return list[i];
  }
  const segPool = [], glowPool = [], motePool = [];
  function drawBeam() {
    const { segs, glows } = trace;
    const mid = new THREE.Vector3();
    segs.forEach(([a, b], i) => {
      const seg = piece(segPool, i, () => {
        const mesh = new THREE.Group();
        const inner = part(GEO.cyl, beam.userData.inner);
        const outer = part(GEO.cyl, beam.userData.outer);
        inner.rotation.z = outer.rotation.z = Math.PI / 2;
        mesh.add(outer, inner);
        return { mesh, inner, outer };
      });
      const length = a.distanceTo(b);
      seg.mesh.visible = length > .01;
      seg.mesh.position.copy(mid.addVectors(a, b).multiplyScalar(.5));
      seg.mesh.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
      seg.inner.scale.set(.035, length, .035);
      seg.outer.scale.set(.085, length + .04, .085);
      seg.a = a; seg.b = b; seg.length = length;
    });
    for (let i = segs.length; i < segPool.length; i++) segPool[i].mesh.visible = false;
    glows.forEach(([point, size], i) => {
      const sprite = piece(glowPool, i, () => glow('#fff2c4', 1, .55));
      sprite.visible = true;
      sprite.position.copy(point);
      sprite.userData.size = size;
    });
    for (let i = glows.length; i < glowPool.length; i++) glowPool[i].visible = false;
    // pontinhos de luz que viajam pelo raio
    let n = 0;
    for (const seg of segPool.slice(0, segs.length)) {
      const count = Math.max(1, Math.round(seg.length / 1.3));
      for (let j = 0; j < count; j++) {
        const mote = piece(motePool, n++, () => glow('#ffffff', .26, .9));
        mote.visible = true;
        mote.userData.seg = seg;
        mote.userData.offset = j / count;
      }
    }
    for (let i = n; i < motePool.length; i++) motePool[i].visible = false;
  }

  // ---------- jogadas ----------
  function flip(who, cx, cy) {
    const mirror = mirrorAt(who, cx, cy);
    if (!mirror) return false;
    mirror.kind = mirror.kind === '/' ? '\\' : '/';
    mirror.target += Math.PI / 2;
    mirror.pop = 1;
    chime([1174.66, 1567.98], .035, .05);
    refresh();
    return true;
  }
  function hint(key, text) {
    if (told[key]) return;
    told[key] = true;
    say(text, 3400);
  }
  // Cada um anda só na sua ilha; esbarrar num espelho de lá faz ele girar.
  function tryMove(dir) {
    const body = bodies[kit.active()], who = body.who;
    const [dx, dy] = T.dirs[dir];
    const to = [body.cell[0] + dx, body.cell[1] + dy];
    const kind = kindAt(who, to[0], to[1]);
    if (kind !== '.' && kind !== 'button') {
      chime([130], .05, .05, 'sine');
      T.move([{ body, kind: 'bump', dir }], () => refresh());
      if (kind === 'mirror') flip(who, to[0], to[1]);
      else if (kind === 'gate') hint('gate', `esse portão só deixa o luar passar quando ${nome(other(who))} fica no botão ☾.`);
      else if (kind === 'bud') hint('bud', 'a flor de lua só abre com o luar.');
      else if (kind === 'out' && dir === (who === 'rafo' ? 'D' : 'U')) hint('ilha', 'cada um anda na sua ilha: troque de personagem para mexer na outra.');
      return;
    }
    chime([392, 494], .04, .04, 'sine');
    T.move([{ body, kind: 'hop', to }], () => refresh());
  }
  function win() {
    won = .001;
    const bud = buds[0];
    kit.flower(bud.x, T.top, bud.z);
    for (const body of bodies) body.cheer = 1.2;
    for (const item of buds) burst(item.x, T.top + .9, item.z, 18);
  }
  // Fim do jogo: as flores ficam abertas, crescem e brilham mais, e os dois se encontram.
  function startFinale() {
    done = true;
    finale = .001;
    chime([523.25, 659.25, 783.99, 1046.5, 1318.5], .12, .12);
    for (const bud of buds) burst(bud.x, T.top + 1, bud.z, 30);
    for (const seg of segPool.slice(0, trace.segs.length)) burst(seg.b.x, seg.b.y + .3, seg.b.z, 6);
    for (const body of bodies) { body.cheer = 1.6; burst(body.x, T.top + 1.2, body.z, 14); }
  }

  return {
    hello: 'cada um gira os espelhos da sua ilha: levem o luar até a flor de lua. ✦',
    extraControls: [['andar contra o espelho', 'girar'], ['ficar na frente do raio', 'faz sombra']],
    setup(level) {
      L = level;
      T = kit.tiles(L, [{ id: 'rafo', cols: COLS, rows: ROWS }, { id: 'lulu', cols: COLS, rows: ROWS }], { layout: 'tall' });
      // o raio fica fora de T.content, para não sumir a cada rodada
      beam = new THREE.Group();
      beam.userData.inner = own(new THREE.MeshBasicMaterial({ color: '#fffbe8', transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending }));
      beam.userData.outer = own(new THREE.MeshBasicMaterial({ color: '#ffe7a3', transparent: true, opacity: .2, depthWrite: false, blending: THREE.AdditiveBlending }));
      L.group.add(beam);
      told = {};
      setRound(0);
    },
    step(dt) {
      if (finale) {
        finale += dt;
        if (finale > 1.8 && !finished) { finished = true; kit.finish(); }
        return;
      }
      if (won) {
        won += dt;
        if (!gotPhoto && won > .5) { gotPhoto = true; const lulu = bodies[1]; kit.photo(lulu.x, T.top, lulu.z); }
        if (won > 1.4) {
          if (round + 1 < ROUNDS.length) {
            setRound(round + 1);
            say(D.recados.rodada(round + 1, ROUNDS.length) + (gate ? ` · o portão abre quando ${nome(button.who)} fica no botão ☾` : ''), 3600);
          } else startFinale();
        }
        return;
      }
      if (buds.length && buds.every(bud => bud.lit)) {
        litTime += dt;
        if (litTime >= .5) { win(); return; }
      } else litTime = 0;
      if (T.anim) return;
      const dir = T.readDir(dt);
      if (dir) tryMove(dir);
    },
    animate(dt) {
      if (!T) return;
      const time = kit.clock(), ease = rate => Math.min(1, dt * rate);
      for (const mirror of mirrors) {
        mirror.angle += (mirror.target - mirror.angle) * ease(14);
        mirror.pop = Math.max(0, mirror.pop - dt * 4);
        const pivot = mirror.mesh.userData.pivot;
        pivot.rotation.y = mirror.angle;
        pivot.position.y = Math.sin(mirror.pop * Math.PI) * .08;
      }
      buds.forEach((bud, i) => {
        const want = bud.lit || won || done ? 1 : 0;
        bud.k += (want - bud.k) * ease(want ? 3.2 : 4.5);
        const k = bud.k, data = bud.mesh.userData, big = finale ? Math.min(1, finale * 1.5) : 0;
        data.hinges.forEach((hinge, j) => { hinge.rotation.x = -1.32 + k * (1.18 + Math.sin(time * 2 + j) * .04); });
        data.head.scale.setScalar(.8 + k * .4 + big * .2);
        data.head.quaternion.copy(FACE_CAMERA);
        data.head.rotateOnWorldAxis(kit.CAM_DIR, Math.sin(time * 1.4 + i * 2) * .08 * (1 - k * .5));
        data.petal.emissiveIntensity = .25 + k * .55;
        data.petal.emissive.lerpColors(LILAC, WARM, k);
        data.core.emissiveIntensity = .1 + k * .8;
        data.halo.material.opacity = k * (.45 + Math.sin(time * 3 + i) * .1) + big * .25;
        data.halo.scale.setScalar(1.8 + k * .6 + big * (2.2 + Math.sin(time * 2) * .3));
        data.ring.material.opacity = k * (.35 + Math.sin(time * 2.4 + i) * .12) + big * .2;
        data.ring.scale.setScalar(.48 + k * .1 + big * .25);
      });
      if (gate) {
        const data = gate.mesh.userData;
        data.k += ((gateOpen ? 1 : 0) - data.k) * ease(8);
        data.panel.position.y = -data.k * .7;
        data.panel.visible = data.k < .97;
      }
      if (button) {
        const data = button.mesh.userData, on = !!bodyAt(button.who, button.cx, button.cy);
        data.cap.position.y += ((on ? .045 : .085) - data.cap.position.y) * ease(18);
        data.cap.material.emissiveIntensity = on ? .7 : .12 + Math.sin(time * 2.5) * .06;
        data.halo.material.opacity += ((on ? .5 : 0) - data.halo.material.opacity) * ease(8);
      }
      for (const lamp of lamps) lamp.mesh.userData.halo.material.opacity = .3 + Math.sin(time * 2.2 + lamp.cx) * .06;
      // o luar tremeluz de levinho
      if (beam) {
        beam.userData.inner.opacity = .82 + Math.sin(time * 7) * .08;
        beam.userData.outer.opacity = .2 + Math.sin(time * 3.1) * .05 + (finale ? .1 : 0);
        glowPool.forEach((sprite, i) => { if (sprite.visible) sprite.scale.setScalar(sprite.userData.size * (1 + Math.sin(time * 4 + i * 1.3) * .12)); });
        for (const mote of motePool) {
          if (!mote.visible) continue;
          const { seg, offset } = mote.userData;
          const t = (time * .9 / Math.max(.4, seg.length) + offset) % 1;
          mote.position.lerpVectors(seg.a, seg.b, t);
          mote.material.opacity = Math.sin(t * Math.PI) * .9;
        }
      }
    },
    hud() {
      const lit = buds.filter(bud => bud.lit).length;
      const second = gate
        ? (gateOpen ? '☾ o portão deixou o luar passar' : `☾ o portão abre com ${nome(button.who)} no botão`)
        : '✦ cada um gira os espelhos da sua ilha';
      return {
        lines: [
          { text: `rodada ${round + 1}/${ROUNDS.length} · flores acesas ${lit}/${buds.length}`, done: !!won },
          { text: won ? '✿ a flor de lua abriu' : second, done: !!won }
        ]
      };
    },
    // ganchos para testes: estado das peças e girar um espelho como quem esbarra nele
    debugState() {
      return {
        round, rounds: ROUNDS.length, won: !!won, done, gateOpen,
        lit: buds.filter(bud => bud.lit).length, buds: buds.length,
        mirrors: mirrors.map(m => ({ board: m.who, cell: [m.cx, m.cy], kind: m.kind }))
      };
    },
    debugFlip(board, cx, cy) { return flip(board, cx, cy); }
  };
};
