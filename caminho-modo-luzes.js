// Dois caminhos — fase "a ordem das luzes" (modo "luzes").
// Cada ilha tem três luzes no chão, cada uma com a sua cor e a sua nota.
// Primeiro as luzes acendem numa ordem (só se olha); depois os dois repetem a
// ordem pisando nelas, cada um nas luzes da sua ilha (troca-se de personagem).
// Errou? Sem bronca: a ordem aparece de novo. O botão de pular também mostra de novo.
// Ao acertar a rodada, o Rafo ganha a flor e a Lulu a foto. São três rodadas.
//
// As luzes ficam nos cantos: os meios das beiradas são chão comum, então
// sempre dá para chegar em qualquer luz sem pisar em outra no caminho.
(window.CAMINHO_MODOS ||= {}).luzes = kit => {
  const { THREE, D, bodies, part, mat, own, GEO, slab, shade, glow, say, chime, burst } = kit;
  // luzes de cada ilha: casa [cx, cy] (cy = 0 é a fileira da frente), cor e nota (pentatônica de dó)
  const PADS = {
    r0: { who: 'rafo', cell: [0, 2], color: '#ff9ec4', note: 523.25 },  // rosa · dó
    r1: { who: 'rafo', cell: [2, 2], color: '#ffb877', note: 659.25 },  // laranja · mi
    r2: { who: 'rafo', cell: [0, 0], color: '#c9a6ff', note: 880 },     // lilás · lá
    l0: { who: 'lulu', cell: [2, 2], color: '#ffe680', note: 587.33 },  // amarelo · ré
    l1: { who: 'lulu', cell: [0, 0], color: '#8fc8ff', note: 783.99 },  // azul · sol
    l2: { who: 'lulu', cell: [2, 0], color: '#8ff0d2', note: 1046.5 }   // verde-menta · dó agudo
  };
  // a ordem de cada rodada (sempre a mesma), misturando as duas ilhas
  const ROUNDS = [
    ['r0', 'l1', 'r2'],
    ['l0', 'r1', 'l2', 'r0'],
    ['r2', 'l0', 'l0', 'r1', 'l2']
  ];
  const SIZE = 3, CENTER = 1;
  const ON = .55, BEAT = .8; // cada luz fica acesa 0,55 s, com um respiro até a próxima
  let L, T, round = 0, stage = 'watch', watchT = 0, shown = -1, progress = 0, won = 0, done = false, toldRepeat = false;
  let pads = {}; // id -> { ...PADS[id], mesh, disc, halo, orb, orbGlow, flash, hold, got }

  function makePad(color) {
    const g = new THREE.Group();
    g.add(part(GEO.cyl, mat('#fff3df'), 0, .02, 0, .4, .05, .4)); // beiradinha creme
    const disc = part(GEO.cyl, own(new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: .15 })), 0, .05, 0, .32, .04, .32);
    g.add(disc);
    const halo = glow(color, 1.6, 0);
    halo.position.y = .18;
    g.add(halo);
    // lanterninha que sobe um tiquinho quando a luz acende
    const orb = part(GEO.sphere, own(new THREE.MeshBasicMaterial({ color: '#fffaf0', transparent: true, opacity: 0 })), 0, .3, 0, .07);
    const orbGlow = glow(color, .6, 0);
    orb.add(orbGlow);
    orbGlow.scale.setScalar(.6 / .07);
    g.add(orb);
    shade(g, false, true);
    Object.assign(g.userData, { disc, halo, orb, orbGlow });
    return g;
  }

  function setRound(n) {
    round = n;
    won = 0;
    T.clear();
    T.layout();
    L.flowers = [];
    L.photos = [];
    pads = {};
    for (const [id, spec] of Object.entries(PADS)) {
      const mesh = T.add(makePad(spec.color), T.boards[spec.who], spec.cell[0], spec.cell[1]);
      pads[id] = { ...spec, id, mesh, ...mesh.userData, flash: 0, hold: 0, got: false };
    }
    bodies.forEach((body, i) => T.place(body, T.boards[i ? 'lulu' : 'rafo'], CENTER, CENTER));
    startWatch(1);
    kit.hud();
  }

  // mostra a ordem de novo, do começo (lead: segundos de espera antes da primeira luz)
  function startWatch(lead) {
    stage = 'watch';
    watchT = -lead;
    shown = -1;
    progress = 0;
    for (const pad of Object.values(pads)) pad.got = false;
    kit.hud();
  }

  function light(pad, time) {
    pad.flash = 1;
    pad.hold = time;
    chime([pad.note], .05, .09, 'sine');
  }

  const padAt = body => Object.values(pads).find(pad => pad.who === body.who && pad.cell[0] === body.cell[0] && pad.cell[1] === body.cell[1]);

  function tryMove(dir) {
    const body = bodies[kit.active()];
    const [dx, dy] = T.dirs[dir];
    const to = [body.cell[0] + dx, body.cell[1] + dy];
    if (!T.inside(body.board, to[0], to[1])) {
      chime([130], .05, .05, 'sine');
      T.move([{ body, kind: 'bump', dir }]);
      return;
    }
    chime([392, 494], .04, .03, 'sine');
    T.move([{ body, kind: 'hop', to }], () => afterHop(body));
  }

  function afterHop(body) {
    const pad = padAt(body);
    if (!pad || stage !== 'repeat') return;
    const seq = ROUNDS[round];
    if (pad.id !== seq[progress]) {
      // errou: um sonzinho grave e a ordem aparece de novo
      pad.flash = .5;
      pad.hold = .1;
      body.squash = -.2;
      chime([196, 174.61], .14, .05, 'sine');
      say('quase! olha de novo…', 2200);
      startWatch(1.4);
      return;
    }
    light(pad, .3);
    pad.got = true;
    progress++;
    body.cheer = .5;
    if (progress === seq.length) winRound();
    kit.hud();
  }

  function winRound() {
    stage = 'won';
    won = .001;
    const [rafo, lulu] = bodies;
    for (const body of bodies) { body.cheer = 1.2; burst(body.x, T.top + 1, body.z, 22); }
    chime([523.25, 659.25, 783.99, 1046.5], .1, .12);
    kit.flower(rafo.x, T.top, rafo.z);
    kit.photo(lulu.x, T.top, lulu.z, D.fases[L.index].fotos[round]);
  }

  // Fim da última rodada: todas as luzes acesas e uma pontezinha para os dois se encontrarem.
  function finish() {
    done = true;
    for (const pad of Object.values(pads)) pad.got = true;
    const bridge = part(slab(T.wide ? 2.6 : 1.7, T.wide ? 1.7 : 2.6, .2, .2), mat('#e2ad73'), 0, T.top + .02, 0);
    bridge.rotation.y = Math.PI / 4;
    shade(bridge, true, true);
    T.content.add(bridge);
    kit.finish();
  }

  return {
    hello: 'as luzes acendem numa ordem: olhem e depois repitam. o botão de pular mostra de novo.',
    actionLabel: 'ver a ordem de novo',
    extraControls: [['pisar numa luz', 'acender']],
    setup(level) {
      L = level;
      T = kit.tiles(L, [{ id: 'rafo', cols: SIZE, rows: SIZE }, { id: 'lulu', cols: SIZE, rows: SIZE }]);
      done = false;
      toldRepeat = false;
      setRound(0);
    },
    step(dt) {
      for (const pad of Object.values(pads)) {
        if (pad.hold > 0) pad.hold -= dt;
        else pad.flash = Math.max(0, pad.flash - dt * 4);
      }
      if (done) return;
      if (stage === 'won') {
        won += dt;
        if (won > 1.3) {
          if (round + 1 < ROUNDS.length) { setRound(round + 1); say(D.recados.rodada(round + 1, ROUNDS.length), 2400); }
          else finish();
        }
        return;
      }
      if (stage === 'watch') {
        T.readDir(dt); // só se olha: o comando é ignorado
        const seq = ROUNDS[round];
        watchT += dt;
        const i = Math.floor(watchT / BEAT);
        if (watchT >= 0 && i < seq.length && i > shown) { shown = i; light(pads[seq[i]], ON); }
        if (watchT >= seq.length * BEAT) {
          stage = 'repeat';
          chime([783.99, 1046.5], .07, .05);
          if (!toldRepeat) { toldRepeat = true; say(`agora repete: ${D.rafo.nome} nas luzes da ilha dele, ${D.lulu.nome} nas da dela.`, 3600); }
          kit.hud();
        }
        return;
      }
      if (T.anim) return;
      const dir = T.readDir(dt);
      if (dir) tryMove(dir);
    },
    animate() {
      const time = kit.clock();
      for (const pad of Object.values(pads)) {
        // apagada, acesa de leve (já pisada certo nesta tentativa) ou no clarão
        const base = pad.got ? .45 + Math.sin(time * 3 + pad.note) * .06 : stage === 'watch' ? .08 : .16;
        const k = Math.max(base, pad.flash);
        pad.disc.material.emissiveIntensity = .1 + k * 1.1;
        pad.disc.scale.y = .04 + pad.flash * .02;
        pad.halo.material.opacity = k * .75;
        pad.halo.scale.setScalar(1.3 + pad.flash * .6);
        pad.orb.material.opacity = pad.flash;
        pad.orbGlow.material.opacity = pad.flash * .8;
        pad.orb.position.y = .22 + pad.flash * .3;
      }
    },
    action(body) {
      if (stage === 'repeat' && !T.anim) { say('olha de novo…', 1600); body.squash = .15; startWatch(.5); }
      else if (stage === 'watch') say('olha a ordem das luzes…', 1600);
    },
    hud() {
      const n = ROUNDS[round].length;
      const hint = stage === 'watch' ? '✦ olha a ordem…' : stage === 'repeat' ? '♥ agora repete · pular: ver de novo' : '♥ ✦ isso!';
      return {
        lines: [
          { text: `rodada ${round + 1}/${ROUNDS.length} · luz ${progress}/${n}` },
          { text: hint, done: stage === 'won' }
        ]
      };
    },
    // ganchos para teste
    debugSequence: () => ROUNDS[round].map(id => ({ who: PADS[id].who, cell: [...PADS[id].cell] })),
    debugStage: () => stage
  };
};
