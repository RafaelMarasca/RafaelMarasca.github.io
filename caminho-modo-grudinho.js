// Dois caminhos — fase "grudadinhos" (modo "grudinho").
// Um comando só move os dois, uma casa por vez, cada um no seu tabuleiro.
// A moita segura quem bate nela; o chiclete no chão prende por uma jogada.
// Em cada rodada o Rafo pega a flor e a Lulu a foto; aí as marcas acendem e os
// dois têm que estar nelas ao mesmo tempo. São três rodadas.
//
// Cada tabuleiro é desenhado de cima para baixo, como aparece na tela:
//   .  chão      #  moita      o  chiclete
//   S  começo    *  flor/foto  X  marca
// Todas as rodadas foram conferidas por computador (têm solução):
// rodada 1 em 9 jogadas, rodada 2 em 14, rodada 3 em 17.
(window.CAMINHO_MODOS ||= {}).grudinho = kit => {
  const { THREE, D, bodies, part, mat, flat, PROPS, BLOOMS, makeFlower, makePolaroid, makePlate, slab, shade, say, chime, burst, puff, puffTexture } = kit;
  const ROUNDS = [
    {
      rafo: ['. . . . X', '. . * # #', '. # . . .', '. . . . .', 'S . . . .'],
      lulu: ['. . . * X', '. # . . .', '# . . . .', '. . # . .', 'S . . . .']
    },
    {
      rafo: ['X . . # .', '. # . . .', '. . o . *', '. # . . .', '. . . S .'],
      lulu: ['. . * . X', '. . # . .', '# . . . .', '. . o # .', '. S . . .']
    },
    {
      rafo: ['. * # . X', '. . . o .', '# . # . .', '. o . . #', 'S . . . .'],
      lulu: ['X . . . #', '. # o . .', '. . . # *', '. # . . .', '. . . o S']
    }
  ];
  const SIZE = 5;
  let L, T, round = 0, won = 0, open = false, done = false, toldGum = false;
  const side = { rafo: {}, lulu: {} }; // por tabuleiro: cells, exit, item, plate, got, stuck, gums

  function makeGum() {
    const g = new THREE.Group();
    g.add(part(kit.GEO.sphere, mat('#ff8fb8'), 0, .02, 0, .44, .06, .44));
    g.add(part(kit.GEO.sphere, mat('#ffb3cf'), .1, .07, -.06, .2, .1, .2));
    g.add(part(kit.GEO.sphere, flat('#ffffff'), .16, .13, -.02, .04, .025, .04));
    return shade(g, false, true);
  }

  function setRound(n) {
    round = n;
    won = 0;
    open = false;
    T.clear();
    T.layout();
    L.flowers = [];
    L.photos = [];
    ['rafo', 'lulu'].forEach((who, i) => {
      const board = T.boards[who], me = side[who];
      const rows = ROUNDS[n][who].map(row => row.split(' '));
      Object.assign(me, { cells: rows, got: false, stuck: false, gums: [] });
      for (let r = 0; r < SIZE; r++) for (let cx = 0; cx < SIZE; cx++) {
        const cy = SIZE - 1 - r, kind = rows[r][cx];
        if (kind === '#') T.add(PROPS.bush(), board, cx, cy).scale.setScalar(1.2);
        else if (kind === 'o') me.gums.push(T.add(makeGum(), board, cx, cy));
        else if (kind === 'X') { me.exit = [cx, cy]; me.plate = T.add(makePlate(who), board, cx, cy); }
        else if (kind === 'S') T.place(bodies[i], board, cx, cy);
        else if (kind === '*') {
          me.item = [cx, cy];
          const spot = T.spot(board, cx, cy);
          if (who === 'rafo') {
            const color = BLOOMS[n % BLOOMS.length];
            L.flowers.push({ x: spot.x, y: T.top, z: spot.z, mesh: T.add(makeFlower(color), board, cx, cy), taken: false, fly: 0, color });
          } else {
            const id = D.fases[L.index].fotos[n];
            L.photos.push({ x: spot.x, y: T.top, z: spot.z, id, mesh: T.add(makePolaroid(id), board, cx, cy, T.top + 1), taken: false, fly: 0 });
          }
        }
      }
    });
    kit.hud();
  }

  const kindAt = (who, [cx, cy]) => side[who].cells[SIZE - 1 - cy][cx];

  function tryMove(dir) {
    const [dx, dy] = T.dirs[dir];
    const steps = bodies.map(body => {
      const who = body.who, me = side[who];
      if (me.stuck) { me.stuck = false; return { body, kind: 'stay' }; }
      const to = [body.cell[0] + dx, body.cell[1] + dy];
      if (!T.inside(body.board, to[0], to[1]) || kindAt(who, to) === '#') return { body, kind: 'bump', dir };
      return { body, kind: 'hop', to };
    });
    const kinds = steps.map(step => step.kind);
    if (kinds.includes('hop')) chime([392, 494], .04, .04, 'sine');
    if (kinds.includes('bump')) chime([130], .05, .05, 'sine');
    if (kinds.includes('stay')) chime([247, 220], .06, .05);
    T.move(steps, () => afterMove(steps));
  }

  function afterMove(steps) {
    for (const step of steps) {
      if (step.kind !== 'hop') continue;
      const body = step.body, who = body.who, me = side[who];
      const kind = kindAt(who, body.cell);
      if (kind === 'o') {
        me.stuck = true;
        body.squash = -.28;
        puff(puffTexture, body.x, T.top + .2, body.z, { size: .5, life: .5, rise: .3, grow: 1.4, color: '#ff9fc0' });
        if (!toldGum) { toldGum = true; say(D.recados.presa, 3200); }
      }
      if (kind === '*' && !me.got) {
        me.got = true;
        if (who === 'rafo') { L.flowers[0].taken = true; kit.flower(body.x, T.top, body.z); }
        else { L.photos[0].taken = true; kit.photo(body.x, T.top, body.z, L.photos[0].id); }
      }
    }
    if (!open && side.rafo.got && side.lulu.got) {
      open = true;
      chime([659.25, 880], .08, .08);
      for (const who of ['rafo', 'lulu']) burst(side[who].plate.position.x, T.top + .6, side[who].plate.position.z, 14);
    }
    const onExit = bodies.every(body => body.cell[0] === side[body.who].exit[0] && body.cell[1] === side[body.who].exit[1]);
    if (open && onExit) {
      won = .001;
      for (const body of bodies) { body.cheer = 1.2; burst(body.x, T.top + 1, body.z, 22); }
      chime([523.25, 659.25, 783.99, 1046.5], .1, .12);
    } else if (!open && onExit) say(round === 0 ? 'falta pegar a flor e a foto.' : 'ainda falta a flor ou a foto.', 2400);
    kit.hud();
  }

  // Fim da última rodada: some o que atrapalha, aparece uma pontezinha e os dois se encontram.
  function finish() {
    done = true;
    T.clear();
    const bridge = part(slab(T.wide ? 2.6 : 1.7, T.wide ? 1.7 : 2.6, .2, .2), mat('#e2ad73'), 0, T.top + .02, 0);
    bridge.rotation.y = Math.PI / 4;
    shade(bridge, true, true);
    T.content.add(bridge);
    kit.finish();
  }

  return {
    glued: true,
    gum: true,
    hello: D.recados.grudados,
    extraControls: [['moita', 'segura quem bate nela'], ['chiclete', 'prende por uma jogada']],
    setup(level) {
      L = level;
      T = kit.tiles(L, [{ id: 'rafo', cols: SIZE, rows: SIZE }, { id: 'lulu', cols: SIZE, rows: SIZE }]);
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
      const time = kit.clock();
      for (const who of ['rafo', 'lulu']) {
        const me = side[who];
        if (!me.plate || done) continue;
        // marcas apagadas até a flor e a foto serem pegas
        const data = me.plate.userData;
        data.symbol.material.opacity = open ? .75 + .25 * Math.sin(time * 4) : .28;
        data.halo.material.opacity = open ? .4 : 0;
        me.gums.forEach((gum, i) => gum.scale.setScalar(1 + Math.sin(time * 2.2 + i) * .04));
        if (me.stuck) bodies[who === 'rafo' ? 0 : 1].squash = -.12 + Math.sin(time * 12) * .04;
      }
    },
    hud() {
      return {
        lines: [
          { text: `rodada ${round + 1}/${ROUNDS.length} · ✿ ${L.gotFlowers}/${ROUNDS.length} · ▢ ${L.gotPhotos}/${ROUNDS.length}` },
          { text: open ? '♥ ✦ agora os dois nas marcas, juntos' : '♥ ✦ peguem a flor e a foto', done: !!won }
        ]
      };
    }
  };
};
