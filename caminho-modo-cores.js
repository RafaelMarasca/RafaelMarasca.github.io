// Dois caminhos — fase "as cores da Lulu" (modo "cores").
// O Rafo escolhe a tinta pisando nos potes do tabuleiro dele; cada casa em que a
// Lulu pisa fica da cor da tinta escolhida (pode pintar por cima). A placa no
// fundo do tabuleiro da Lulu mostra o desenho: quando o chão fica igual, o Rafo
// ganha a flor e a Lulu a foto. São três rodadas.
//
// Os desenhos são escritos de cima para baixo, como aparecem na tela:
//   R  rosa      A  amarelo      Z  azul
// O Rafo começa no meio do fundo do tabuleiro dele, sem tinta nenhuma; a Lulu
// começa no canto da frente, à esquerda, numa casa ainda sem pintar.
// Potes do Rafo (casa cx, cy): rosa (0, 1), amarelo (1, 0), azul (2, 1).
//
// Uma solução para cada rodada (conferida por computador, simulando as regras;
// U D L R = cima, baixo, esquerda, direita na tela):
//   rodada 1 (céu e areia), 16 passos da Lulu e 2 tintas:
//     rafo: D (amarelo) · lulu: U D R U R D R U ·
//     rafo: R U (azul) · lulu: U U L D L U L D
//   rodada 2 (pôr do sol), 16 passos da Lulu e 3 tintas:
//     rafo: R (azul) · lulu: U D R R R U · rafo: L L (rosa) · lulu: U U L L L D ·
//     rafo: D R (amarelo) · lulu: R D R U
//   rodada 3 (a lua com uma estrelinha), 28 passos da Lulu e 4 tintas:
//     rafo: R (azul) · lulu: U U U R R R D D D L L L ·
//     rafo: D L (amarelo) · lulu: R R U L L U R U R D · rafo: L U (rosa) · lulu: R ·
//     rafo: R R (azul) · lulu: D L L U R
// Como dá para pintar por cima, nenhuma rodada trava.
(window.CAMINHO_MODOS ||= {}).cores = kit => {
  const { THREE, D, bodies, part, mat, own, slab, shade, glow, GEO, FACE_CAMERA, say, chime, burst, puff, puffTexture } = kit;
  const PAINT = {
    R: { nome: 'rosa', cor: '#ff9fc0' },
    A: { nome: 'amarelo', cor: '#ffd95e' },
    Z: { nome: 'azul', cor: '#8fc8f0' }
  };
  const ROUNDS = [
    ['Z Z Z Z', 'Z Z Z Z', 'A A A A', 'A A A A'],
    ['R R R R', 'R A A R', 'Z A A Z', 'Z Z Z Z'],
    ['Z A A Z', 'A Z Z R', 'A Z Z Z', 'Z A A Z']
  ];
  const POTS = [{ k: 'R', cell: [0, 1] }, { k: 'A', cell: [1, 0] }, { k: 'Z', cell: [2, 1] }];
  const RAFO = { cols: 3, rows: 2, start: [1, 1] };
  const SIZE = 4, LULU_START = [0, 0];
  const BLANK = ['#e6e2db', '#d9d4cc']; // chão ainda sem tinta: cinzinha
  let L, T, round = 0, won = 0, done = false, brush = '', toldDry = false;
  let target = [], paint = [], pots = [], drop = null, right = 0;

  // Potinho de tinta: lata clarinha, faixa e tampa de tinta da cor, um pingo escorrendo.
  function makePot(color) {
    const g = new THREE.Group();
    g.add(part(GEO.cyl, mat('#f4ead2'), 0, .17, 0, .27, .34, .27));
    g.add(part(GEO.cyl, mat(color), 0, .16, 0, .275, .1, .275));
    g.add(part(GEO.cyl, mat('#e6d9bd'), 0, .345, 0, .29, .03, .29));
    g.add(part(GEO.cyl, mat(color, { emissive: color, emissiveIntensity: .3 }), 0, .36, 0, .24, .02, .24));
    g.add(part(GEO.sphere, mat(color), .2, .3, .14, .06, .09, .06));
    const handle = part(GEO.hoop, mat('#b9b2a4'), 0, .36, 0, .24);
    handle.rotation.y = Math.PI / 4;
    g.add(handle);
    shade(g, true);
    const halo = glow(color, 1.7, 0);
    halo.position.y = .4;
    g.add(halo);
    g.userData.halo = halo;
    return g;
  }

  // Pingo de tinta que flutua ao lado da Lulu, na cor do pincel.
  function makeDrop() {
    const g = new THREE.Group();
    const paintMat = own(new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: .35 }));
    g.add(part(GEO.sphere, paintMat, 0, 0, 0, .13, .13, .13));
    g.add(part(GEO.cone, paintMat, 0, .15, 0, .095, .2, .095));
    g.add(part(GEO.sphere, mat('#ffffff'), -.04, .04, .07, .03));
    const halo = glow('#ffffff', .9, .45);
    g.add(halo);
    g.userData = { paintMat, halo };
    g.visible = false;
    return g;
  }

  // A placa com o desenho, de frente para a tela, apoiada no fundo da ilha da Lulu.
  function makeSign(rows) {
    const g = new THREE.Group();
    const side = 2.3, half = side / 2;
    const up = T.up.clone().applyQuaternion(FACE_CAMERA); // "para cima" da placa, no mundo
    const face = new THREE.Group();
    face.quaternion.copy(FACE_CAMERA);
    face.position.copy(up).multiplyScalar(half).setY(up.y * half + .16);
    const inner = new THREE.Group();
    inner.rotation.y = Math.PI / 4; // aqui dentro: x é a direita da tela, -z é o alto
    face.add(inner);
    inner.add(part(slab(side, side, .12, .22), mat('#e2ad73')));
    inner.add(part(slab(side - .24, side - .24, .05, .16, .02), mat('#fbf6e9'), 0, .03, 0));
    const square = slab(.46, .46, .05, .08, .02), step = .5;
    rows.forEach((row, r) => row.split(' ').forEach((k, cx) => {
      const cy = SIZE - 1 - r, color = PAINT[k].cor;
      inner.add(part(square, mat(color, { emissive: color, emissiveIntensity: .25 }), (cx - 1.5) * step, .09, -(cy - 1.5) * step));
    }));
    g.add(face);
    shade(face, true);
    // pezinhos onde a placa encosta no chão
    for (const s of [-1, 1]) {
      const foot = part(GEO.sphere, mat('#c58a52'), 0, .08, 0, .16, .1, .16);
      foot.position.addScaledVector(T.right, s * (half - .35));
      g.add(shade(foot, true));
    }
    return g;
  }

  const lulu = () => T.boards.lulu;
  const count = () => {
    let n = 0;
    for (let cy = 0; cy < SIZE; cy++) for (let cx = 0; cx < SIZE; cx++) if (paint[cy][cx] === target[cy][cx]) n++;
    return n;
  };

  // Lado a lado, o Rafo fica à esquerda (embaixo do quadro de missões); um acima do
  // outro, a Lulu fica em cima. Assim a placa no fundo da ilha dela nunca tapa nada.
  function layout() {
    T.layout();
    const { rafo, lulu: lu } = T.boards;
    T.list.splice(0, 2, ...(T.wide ? [rafo, lu] : [lu, rafo]));
    T.layout();
    // a placa fica acima da ilha da Lulu: abre espaço para ela no alto da tela
    const room = T.wide ? 1 : 3.6, shift = room / 2 / .577;
    T.needH += room;
    T.focus = [T.focus[0] + T.up.x * shift, T.focus[1] + T.up.z * shift];
  }

  function setRound(n) {
    round = n;
    won = 0;
    brush = '';
    T.clear();
    layout();
    L.flowers = [];
    L.photos = [];
    target = [];
    ROUNDS[n].forEach((row, r) => { target[SIZE - 1 - r] = row.split(' '); });
    paint = Array.from({ length: SIZE }, () => Array(SIZE).fill(''));
    for (let cy = 0; cy < SIZE; cy++) for (let cx = 0; cx < SIZE; cx++) T.tile(lulu(), cx, cy).material = mat(BLANK[(cx + cy) % 2]);
    T.place(bodies[0], T.boards.rafo, ...RAFO.start);
    T.place(bodies[1], lulu(), ...LULU_START);
    pots = POTS.map(pot => ({ ...pot, mesh: T.add(makePot(PAINT[pot.k].cor), T.boards.rafo, ...pot.cell) }));
    T.add(makeSign(ROUNDS[n]), lulu(), (SIZE - 1) / 2, SIZE - 1 + .62);
    drop = T.add(makeDrop(), lulu(), ...LULU_START);
    right = count();
    kit.hud();
  }

  function choose(k) {
    if (brush === k) { chime([523.25], .05, .05, 'sine'); return; }
    brush = k;
    const pot = pots.find(item => item.k === k), { cor, nome } = PAINT[k];
    const data = drop.userData;
    data.paintMat.color.set(cor);
    data.paintMat.emissive.set(cor);
    data.halo.material.color.set(cor);
    drop.visible = true;
    bodies[0].cheer = .7;
    burst(pot.mesh.position.x, T.top + .6, pot.mesh.position.z, 10);
    chime([587.33, 783.99], .06, .07);
    say(`tinta ${nome} no pincel da ${D.lulu.nome}.`, 2200);
  }

  function paintAt(cx, cy) {
    if (!brush) {
      if (!toldDry) { toldDry = true; say(`o pincel está sequinho: o ${D.rafo.nome} escolhe a tinta pisando num pote.`, 3600); }
      return;
    }
    const was = paint[cy][cx] === target[cy][cx];
    paint[cy][cx] = brush;
    const color = PAINT[brush].cor, spot = T.spot(lulu(), cx, cy);
    T.tile(lulu(), cx, cy).material = mat(color);
    puff(puffTexture, spot.x, T.top + .12, spot.z, { size: .7, life: .45, rise: .15, grow: 1.3, color });
    const now = paint[cy][cx] === target[cy][cx];
    if (now && !was) chime([659.25, 987.77], .05, .06, 'sine');
    right = count();
    if (right === SIZE * SIZE) win();
  }

  function win() {
    won = .001;
    const [rafo, lu] = bodies;
    for (const body of bodies) body.cheer = 1.2;
    burst(lu.x, T.top + 1, lu.z, 26);
    const sign = T.spot(lulu(), (SIZE - 1) / 2, SIZE - 1 + 1.2);
    burst(sign.x, 1.6, sign.z, 22);
    chime([523.25, 659.25, 783.99, 1046.5], .1, .12);
    kit.flower(rafo.x, T.top, rafo.z);
    kit.photo(lu.x, T.top, lu.z);
  }

  function tryMove(dir) {
    const body = bodies[kit.active()];
    const [dx, dy] = T.dirs[dir];
    const to = [body.cell[0] + dx, body.cell[1] + dy];
    if (!T.inside(body.board, to[0], to[1])) {
      chime([130], .05, .05, 'sine');
      T.move([{ body, kind: 'bump', dir }]);
      return;
    }
    chime([392, 494], .04, .04, 'sine');
    T.move([{ body, kind: 'hop', to }], () => {
      if (body.who === 'rafo') {
        const pot = pots.find(item => item.cell[0] === to[0] && item.cell[1] === to[1]);
        if (pot) choose(pot.k);
      } else paintAt(to[0], to[1]);
      kit.hud();
    });
  }

  // Fim da última rodada: uma pontezinha entre as ilhas, e os dois se encontram.
  function finish() {
    done = true;
    const [rafo, lu] = bodies;
    // cada um vai para a beirada que dá para a outra ilha
    if (T.wide) { T.place(lu, lulu(), 0, 1); T.place(rafo, T.boards.rafo, RAFO.cols - 1, 0); }
    else { T.place(lu, lulu(), 1, 0); T.place(rafo, T.boards.rafo, 1, 1); }
    for (const body of bodies) puff(puffTexture, body.x, T.top + .3, body.z, { size: .6, life: .5, rise: .3, grow: 1.4 });
    const dx = lu.x - rafo.x, dz = lu.z - rafo.z, length = Math.hypot(dx, dz) - .9;
    const bridge = part(slab(length, 1.1, .2, .2), mat('#e2ad73'), (rafo.x + lu.x) / 2, T.top + .02, (rafo.z + lu.z) / 2);
    bridge.rotation.y = Math.atan2(-dz, dx);
    shade(bridge, true, true);
    T.content.add(bridge);
    drop.visible = false;
    kit.finish();
  }

  return {
    hello: `você começa com o ${D.rafo.nome}: pise num pote para escolher a tinta.`,
    extraControls: [[`${D.rafo.nome} pisa num pote`, 'escolhe a tinta'], [`${D.lulu.nome} pisa numa casa`, 'pinta dessa cor']],
    setup(level) {
      L = level;
      T = kit.tiles(L, [{ id: 'rafo', cols: RAFO.cols, rows: RAFO.rows }, { id: 'lulu', cols: SIZE, rows: SIZE }]);
      setRound(0);
    },
    step(dt) {
      if (done) return;
      if (won) {
        won += dt;
        if (won > 1.3) {
          if (round + 1 < ROUNDS.length) { setRound(round + 1); say(D.recados.rodada(round + 1, ROUNDS.length), 2400); }
          else finish();
        }
        return;
      }
      if (T.anim) return;
      const dir = T.readDir(dt);
      if (dir) tryMove(dir);
    },
    animate() {
      if (!T || done) return;
      const time = kit.clock();
      pots.forEach((pot, i) => {
        const on = pot.k === brush;
        pot.mesh.userData.halo.material.opacity = on ? .5 + .15 * Math.sin(time * 4) : 0;
        pot.mesh.scale.setScalar(on ? 1.08 + Math.sin(time * 3 + i) * .03 : 1);
      });
      if (drop?.visible) {
        const lu = bodies[1];
        drop.position.set(lu.x, lu.y + 1.3 + Math.sin(time * 2.6) * .06, lu.z).addScaledVector(T.right, .5);
        drop.rotation.y = Math.sin(time * 1.8) * .4;
      }
    },
    switched(i) {
      if (i === 1 && !brush && !won) say(`o pincel ainda está sequinho: primeiro o ${D.rafo.nome} pisa num pote.`, 2600);
    },
    hud() {
      return {
        lines: [
          { text: `rodada ${round + 1}/${ROUNDS.length} · casas certas ${right}/${SIZE * SIZE}`, done: !!won },
          { text: brush ? `✦ tinta: ${PAINT[brush].nome}` : `✦ tinta: nenhuma, o ${D.rafo.nome} escolhe no pote` }
        ]
      };
    },
    // para testes: pinta o chão igual à placa de uma vez
    debugSolve() {
      if (won || done) return;
      for (let cy = 0; cy < SIZE; cy++) for (let cx = 0; cx < SIZE; cx++) {
        paint[cy][cx] = target[cy][cx];
        T.tile(lulu(), cx, cy).material = mat(PAINT[target[cy][cx]].cor);
      }
      right = count();
      kit.hud();
      win();
    }
  };
};
