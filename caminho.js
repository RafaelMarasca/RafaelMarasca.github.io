// Dois caminhos — joguinho isométrico em three.js (caminho.html).
// Dois personagens, cada um do seu lado: o Rafo colhe flores, a Lulu acha
// fotos, e um abre o caminho do outro (caixas nas marcas, botões que seguram
// pontes). No fim de cada fase os dois se encontram. Textos em caminho-data.js.

const D = window.CAMINHO;
const album = new Map([...(window.ALBUM_PAGES || []), ...(D.fotosExtras || [])].map(page => [page.id, page]));
const $ = id => document.getElementById(id);
const stage = $('caminho');
const canvas = $('caminho-canvas');
const card = $('cm-card');
const hud = $('cm-hud');
const caption = $('cm-caption');
const fade = $('cm-fade');
const stickEl = $('cm-stick');
const touchEl = $('cm-touch');
const switchButton = $('cm-switch');
const swapButton = $('cm-swap');
const jumpButton = $('cm-jump');
const music = $('cm-music');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touchDevice = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const TAU = Math.PI * 2;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

let THREE;
try {
  THREE = await import('three');
} catch (error) {
  card.hidden = false;
  card.replaceChildren(el('p', 'eyebrow', 'OPA'), el('h2', '', 'o jogo não carregou.'), el('p', 'cm-card-text', 'Confira a conexão e recarregue a página.'));
  throw error;
}

// ---------- Cena, luz e sombras ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 200);
const CAM_DIR = new THREE.Vector3(1, 1, 1).normalize();
const CAM_OFFSET = CAM_DIR.clone().multiplyScalar(60);
const camTarget = new THREE.Vector3();
const hemi = new THREE.HemisphereLight(0xffffff, 0x9fb38a, 2);
const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
const SUN_OFFSET = new THREE.Vector3(5, 16, 9);
sun.castShadow = true;
sun.shadow.mapSize.set(touchDevice ? 1024 : 2048, touchDevice ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 60 });
sun.shadow.bias = -.0006;
sun.shadow.normalBias = .03;
scene.add(hemi, sun, sun.target);

function resize() {
  const width = stage.clientWidth, height = stage.clientHeight;
  if (!width || !height) return;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  const aspect = width / height;
  let viewHeight = 10;
  if (viewHeight * aspect < 7.4) viewHeight = 7.4 / aspect;
  camera.left = -viewHeight * aspect / 2;
  camera.right = viewHeight * aspect / 2;
  camera.top = viewHeight / 2;
  camera.bottom = -viewHeight / 2;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);

// ---------- Materiais e formas (tudo arredondado e macio) ----------
const materials = new Map();
function mat(color, extra) {
  const key = color + (extra ? JSON.stringify(extra) : '');
  let material = materials.get(key);
  if (!material) {
    material = new THREE.MeshLambertMaterial({ color, ...extra });
    materials.set(key, material);
  }
  return material;
}
function flat(color) {
  const key = 'flat' + color;
  if (!materials.has(key)) materials.set(key, new THREE.MeshBasicMaterial({ color }));
  return materials.get(key);
}
const glowMat = (color, intensity = .9) => mat(color, { emissive: color, emissiveIntensity: intensity });
const own = thing => { thing.userData.own = true; return thing; }; // feito só para a fase: é descartado junto com ela

const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(1, 20, 14),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
  cone: new THREE.ConeGeometry(1, 1, 12),
  circle: new THREE.CircleGeometry(1, 28),
  ring: new THREE.RingGeometry(.82, 1, 36),
  plane: new THREE.PlaneGeometry(1, 1),
  crescent: new THREE.TorusGeometry(.42, .085, 8, 24, Math.PI * 1.25),
  capsule: new THREE.CapsuleGeometry(1, 1, 5, 12),
  hair: new THREE.SphereGeometry(1, 20, 12, 0, TAU, 0, Math.PI * .55),
  smile: new THREE.TorusGeometry(1, .2, 6, 12, Math.PI),
  hoop: new THREE.TorusGeometry(1, .09, 6, 24),
  chain: new THREE.TorusGeometry(1, .035, 6, 28),
  body: new THREE.LatheGeometry([[0, 0], [.13, .01], [.19, .07], [.205, .17], [.18, .29], [.13, .39], [.07, .44], [0, .45]].map(([x, y]) => new THREE.Vector2(x, y)), 18)
};
function part(geometry, material, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  return mesh;
}
// Placa de cantos redondos com o topo em y = 0.
function slab(w, d, height, radius, bevel = .05) {
  const r = Math.min(radius, w / 2 - .01, d / 2 - .01);
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 + r, -d / 2);
  shape.lineTo(w / 2 - r, -d / 2);
  shape.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
  shape.lineTo(w / 2, d / 2 - r);
  shape.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
  shape.lineTo(-w / 2 + r, d / 2);
  shape.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
  shape.lineTo(-w / 2, -d / 2 + r);
  shape.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: Math.max(.01, height - bevel * 2), bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 8 });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -height + bevel, 0);
  return own(geometry);
}
function shade(object, cast = true, receive = false) {
  object.traverse(node => {
    if (!node.isMesh || node.material.isMeshBasicMaterial) return;
    node.castShadow = cast;
    node.receiveShadow = receive;
  });
  return object;
}
// Números "aleatórios" que se repetem: o enfeite de cada ilha é sempre o mesmo.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 0x6d2b79f5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
const glowTexture = canvasTexture(64, (ctx, s) => {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(.35, 'rgba(255,255,255,.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
});
const puffTexture = canvasTexture(64, (ctx, s) => {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,.9)');
  g.addColorStop(.7, 'rgba(255,255,255,.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
});
function textTexture(text, color, font = '170px Georgia, serif') {
  return canvasTexture(256, (ctx, s) => {
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 14;
    ctx.strokeStyle = 'rgba(70,45,30,.55)';
    ctx.strokeText(text, s / 2, s / 2 + 8);
    ctx.fillStyle = color;
    ctx.fillText(text, s / 2, s / 2 + 8);
  });
}
const SYMBOLS = { rafo: textTexture('♥', '#f58aa0'), lulu: textTexture('✦', '#fff0b3', '190px Georgia, serif') };
const shared = new Set([glowTexture, puffTexture, SYMBOLS.rafo, SYMBOLS.lulu]);
function glow(color, size, opacity = .5) {
  const sprite = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: glowTexture, color, opacity, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  sprite.scale.setScalar(size);
  return sprite;
}
function decal(texture, size, opacity = 1) {
  const mesh = part(GEO.plane, own(new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity, depthWrite: false })), 0, 0, 0, size);
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = Math.PI / 4; // de pé na tela
  return mesh;
}
// Vira o "de cima" de uma peça para a câmera (que nunca gira).
const FACE_CAMERA = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), CAM_DIR);

// ---------- Bonequinhos, no traço das ilustrações: cor chapada e contorno escuro ----------
// Os bonequinhos têm luz própria, sempre a mesma: a do entardecer (a da fase 2).
// Assim eles ficam com a mesma cor em todas as fases; só o cenário muda com a luz
// de cada fase. Para trocar o tom, mexa em PERSON_LIGHT.
const PERSON_LIGHT = {
  sun: new THREE.Color(0xffcfa3).multiplyScalar(2.3),    // luz do sol baixo, quente
  sky: new THREE.Color(0xdcd3ff).multiplyScalar(2),      // claridade que vem de cima
  ground: new THREE.Color(0x8a80a8).multiplyScalar(2)    // claridade que vem do chão
};
// A câmera nunca gira, então as direções da luz podem ficar fixas "do ponto de vista da câmera".
const personView = new THREE.PerspectiveCamera();
personView.position.copy(CAM_OFFSET);
personView.lookAt(0, 0, 0);
personView.updateMatrixWorld();
const PERSON_SUN = SUN_OFFSET.clone().transformDirection(personView.matrixWorldInverse);
const PERSON_UP = new THREE.Vector3(0, 1, 0).transformDirection(personView.matrixWorldInverse);
function tone(color) {
  const key = 'tone' + color;
  if (!materials.has(key)) materials.set(key, new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(color) },
      sunDir: { value: PERSON_SUN }, upDir: { value: PERSON_UP },
      sunColor: { value: PERSON_LIGHT.sun }, skyColor: { value: PERSON_LIGHT.sky }, groundColor: { value: PERSON_LIGHT.ground }
    },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    // dois tons chapados (lado da luz e lado da sombra), como no desenho
    fragmentShader: `
      uniform vec3 color, sunDir, upDir, sunColor, skyColor, groundColor;
      varying vec3 vNormal;
      void main() {
        vec3 n = normalize(vNormal);
        float lit = dot(n, sunDir) >= 0.0 ? 1.0 : 0.8157;
        vec3 light = sunColor * lit + mix(groundColor, skyColor, 0.5 * dot(n, upDir) + 0.5);
        gl_FragColor = vec4(color * light * 0.31830988618, 1.0);
        #include <colorspace_fragment>
      }`
  }));
  return materials.get(key);
}
// Contorno: a mesma peça virada do avesso, um tiquinho maior e toda escura.
const INK = new THREE.MeshBasicMaterial({ color: '#3a251d', side: THREE.BackSide });
const inkSize = new THREE.Vector3(), inkCentre = new THREE.Vector3();
function ink(mesh, thick = .017) {
  const geometry = mesh.geometry;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  geometry.boundingBox.getSize(inkSize);
  geometry.boundingBox.getCenter(inkCentre);
  const outline = new THREE.Mesh(geometry, INK);
  const sx = 1 + 2 * thick / Math.max(.001, inkSize.x * Math.abs(mesh.scale.x));
  const sy = 1 + 2 * thick / Math.max(.001, inkSize.y * Math.abs(mesh.scale.y));
  const sz = 1 + 2 * thick / Math.max(.001, inkSize.z * Math.abs(mesh.scale.z));
  outline.scale.set(sx, sy, sz);
  outline.position.set(inkCentre.x * (1 - sx), inkCentre.y * (1 - sy), inkCentre.z * (1 - sz));
  mesh.add(outline);
  return mesh;
}
function makePerson(colors, isLulu) {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const rig = new THREE.Group();
  rig.scale.setScalar(1.15);
  g.add(rig);
  const skin = tone(colors.pele), cloth = tone(colors.roupa), hair = tone(colors.cabelo);
  const pants = tone(isLulu ? '#4d5a85' : '#3d4a6b'), shoe = tone('#f7f1e3'), silver = flat('#e9edf3');

  const legs = [-1, 1].map(side => {
    const hip = new THREE.Group();
    hip.position.set(side * .088, .21, 0);
    hip.add(ink(part(GEO.cyl, pants, 0, -.08, 0, .064, .17, .064)));
    hip.add(ink(part(GEO.sphere, shoe, 0, -.165, .03, .085, .06, .12)));
    rig.add(hip);
    return hip;
  });
  rig.add(ink(part(GEO.body, cloth, 0, .17, 0, isLulu ? .96 : 1.02, 1, isLulu ? .92 : .96)));
  const arms = [-1, 1].map(side => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * .19, .545, 0);
    if (isLulu) shoulder.add(ink(part(GEO.capsule, cloth, 0, -.11, 0, .054, .095, .054)));
    else {
      shoulder.add(ink(part(GEO.capsule, skin, 0, -.14, 0, .048, .07, .048)));
      shoulder.add(ink(part(GEO.sphere, cloth, 0, -.03, 0, .075)));
    }
    shoulder.add(ink(part(GEO.sphere, skin, 0, -.255, 0, .062)));
    shoulder.rotation.z = side * .26;
    rig.add(shoulder);
    return shoulder;
  });
  // colar prateado: plaquinha no Rafo, coraçãozinho na Lulu
  const chain = part(GEO.chain, silver, 0, .6, .03, .1);
  chain.rotation.x = Math.PI / 2 - .32;
  rig.add(chain);
  rig.add(part(isLulu ? GEO.sphere : GEO.box, silver, 0, .5, .165, isLulu ? .022 : .026, isLulu ? .022 : .042, .012));

  const head = new THREE.Group();
  head.position.y = .95;
  head.rotation.x = -.22; // rosto um pouco para cima, para aparecer bem visto de cima
  const HX = .35, HY = .305, HZ = .315;
  head.add(ink(part(GEO.sphere, skin, 0, 0, 0, HX, HY, HZ), .02));
  const face = (x, y) => HZ * Math.sqrt(Math.max(0, 1 - (x / HX) ** 2 - (y / HY) ** 2)); // z na curva do rosto
  const black = flat('#2a1b18'), white = flat('#ffffff');
  const eyes = [];
  for (const side of [-1, 1]) {
    const eye = part(GEO.sphere, black, side * .128, -.045, face(.128, -.045) - .004, .05, .076, .02);
    const shine = part(GEO.sphere, white, side * .128 + .019, -.016, face(.128, -.02) + .014, .02);
    head.add(eye, shine);
    eyes.push(eye, shine);
    head.add(part(GEO.sphere, flat('#f8b1b3'), side * .205, -.125, face(.205, -.125) - .003, .056, .038, .012));
    // sobrancelha: grossa e escura no Rafo, fininha na Lulu
    const brow = part(GEO.capsule, flat(isLulu ? '#8a5f33' : '#3f2a1e'), side * .13, .068, face(.13, .068) + .004, isLulu ? .008 : .016, isLulu ? .024 : .028, .008);
    brow.rotation.z = Math.PI / 2 + side * (isLulu ? .14 : .2);
    head.add(brow);
    if (isLulu) {
      for (const [dy, tilt] of [[.012, -.75], [-.02, -1.25]]) {
        const lash = part(GEO.capsule, black, side * .182, -.03 + dy, face(.182, -.03 + dy) + .002, .0055, .011, .005);
        lash.rotation.z = side * tilt;
        head.add(lash);
      }
    } else head.add(ink(part(GEO.sphere, skin, side * .34, -.04, 0, .05, .07, .04)));
  }
  const nose = part(GEO.smile, flat('#dba48c'), .008, -.088, face(.008, -.088) + .004, .016);
  nose.rotation.z = -Math.PI / 2;
  head.add(nose);
  const smile = part(GEO.smile, flat('#8a3d30'), 0, -.143, face(0, -.143) + .003, .05);
  smile.rotation.z = Math.PI;
  head.add(smile);
  if (isLulu) head.add(part(GEO.hoop, silver, .03, -.1, face(.03, -.1) + .006, .015));
  else {
    // barbinha por fazer: pontinhos em volta da boca e no queixo
    for (let i = 0; i < 15; i++) {
      const x = -.175 + i * .025, y = -.19 - .04 * Math.cos(x * 8.5) + (i % 2) * .02;
      head.add(part(GEO.sphere, flat('#cfa893'), x, y, face(x, y) + .001, .0075));
    }
  }

  // cabelo
  const cap = ink(part(GEO.hair, hair, 0, .03, -.03, HX + .022, HY + .045, HZ + .04), .02);
  cap.rotation.x = isLulu ? -.56 : -.5;
  head.add(cap);
  const blob = (x, y, z, sx, sy, sz, rz = 0) => {
    const mesh = ink(part(GEO.sphere, hair, x, y, z, sx, sy, sz));
    mesh.rotation.z = rz;
    head.add(mesh);
  };
  const a = new THREE.Vector3(), b = new THREE.Vector3(), xAxis = new THREE.Vector3(), yAxis = new THREE.Vector3(), zAxis = new THREE.Vector3(), basis = new THREE.Matrix4();
  // mecha pontuda e achatada, da raiz (b) até a ponta (t), deitada sobre a cabeça
  const lock = (bx, by, bz, tx, ty, tz, width, depth = .5) => {
    a.set(bx, by, bz); b.set(tx, ty, tz);
    yAxis.subVectors(b, a);
    const length = yAxis.length();
    yAxis.normalize();
    zAxis.addVectors(a, b).normalize();           // para fora da cabeça
    xAxis.crossVectors(yAxis, zAxis);
    if (xAxis.lengthSq() < .02) xAxis.crossVectors(yAxis, zAxis.set(.3, .2, 1).normalize()); // mecha que sai reta para fora
    xAxis.normalize();
    zAxis.crossVectors(xAxis, yAxis);
    const mesh = part(GEO.cone, hair, (bx + tx) / 2, (by + ty) / 2, (bz + tz) / 2, width, length, width * depth);
    mesh.quaternion.setFromRotationMatrix(basis.makeBasis(xAxis, yAxis, zAxis));
    head.add(ink(mesh, .015));
  };
  if (isLulu) {
    // comprido, liso e repartido no meio
    blob(0, -.32, -.2, .32, .54, .17);                          // cabelão nas costas
    for (const side of [-1, 1]) {
      blob(side * .2, .12, face(.2, .12) + .02, .115, .25, .075, side * .62); // cortina que desce da risca
      blob(side * .305, -.24, .03, .088, .4, .125);                // mecha comprida sobre o ombro
      blob(side * .29, -.6, .07, .075, .09, .1);                  // pontinha virada
    }
  } else {
    // cheio e bagunçado: volume atrás, mechas pontudas para cima e franja caindo de lado
    blob(0, .1, -.1, .345, .29, .31);
    const scalp = (ux, uy, uz) => [ux * HX, uy * HY + .04, uz * HZ - .03];
    const spike = (ux, uy, uz, dx, dy, dz, length, width) => {
      const [x, y, z] = scalp(ux, uy, uz);
      const n = Math.hypot(dx, dy, dz);
      lock(x - dx / n * .05, y - dy / n * .05, z - dz / n * .05, x + dx / n * length, y + dy / n * length, z + dz / n * length, width, .8);
    };
    spike(.05, 1, .12, .2, 1, .2, .2, .16); spike(.52, .84, .02, .65, .85, .1, .2, .15); spike(-.48, .86, .02, -.6, .9, .05, .18, .15);
    spike(.25, .86, -.42, .35, .9, -.5, .2, .15); spike(-.25, .86, -.42, -.4, .9, -.5, .18, .14); spike(0, .96, -.26, -.1, 1, -.35, .19, .15);
    spike(.92, .38, -.08, 1, .45, -.1, .15, .13); spike(-.92, .38, -.08, -1, .45, -.1, .15, .13);
    spike(.56, .44, -.7, .7, .4, -.8, .16, .14); spike(-.56, .44, -.7, -.7, .4, -.8, .16, .14); spike(0, .5, -.87, 0, .45, -1, .17, .15);
    // franja: quatro mechas grossas caindo para o mesmo lado, até perto das sobrancelhas
    const fringe = (bx, by, tx, ty, width) => lock(bx, by, face(bx, by) + .075, tx, ty, face(tx, ty) + .035, width, .42);
    fringe(.24, .2, .12, .1, .1); fringe(.13, .27, -.005, .105, .125); fringe(-.01, .285, -.125, .11, .125); fringe(-.15, .25, -.245, .115, .105);
    fringe(.31, .12, .3, -.015, .07); fringe(-.27, .17, -.31, .02, .07);
  }
  rig.add(head);
  // o que cada um carrega: buquê (Rafo) ou fotos (Lulu), preso ao braço direito
  const hand = new THREE.Group();
  const home = { parent: arms[1], position: new THREE.Vector3(.02, -.27, .07), rotation: .75 };
  g.userData = { rig, legs, arms, head, hand, home, eyes, eyeOpen: .076, held: 0, blinkAt: 2 + Math.random() * 3 };
  restHand(g);
  return shade(g, true, false);
}
function restHand(person) {
  const { hand, home } = person.userData;
  home.parent.add(hand);
  hand.position.copy(home.position);
  hand.rotation.set(home.rotation, 0, 0);
}
const BLOOMS = ['#fffaf0', '#ffd95e', '#ffb3c7'];
function addBloom(person, color) {
  const data = person.userData;
  if (!data.held) {
    const wrap = part(GEO.cone, mat('#f4ead2'), 0, -.02, 0, .085, .22, .085);
    wrap.rotation.x = Math.PI;
    data.hand.add(wrap);
  }
  const i = data.held++;
  const radius = Math.min(.14, .058 * Math.sqrt(i)), angle = i * 2.4;
  const bloom = new THREE.Group();
  bloom.position.set(Math.cos(angle) * radius, .14 - radius * .25, Math.sin(angle) * radius);
  bloom.add(part(GEO.sphere, mat(color), 0, 0, 0, .068, .045, .068));
  bloom.add(part(GEO.sphere, flat('#f2a93a'), 0, .03, 0, .028, .02, .028));
  data.hand.add(shade(bloom, true));
}
function addSnapshot(person) {
  const data = person.userData;
  const i = data.held++;
  if (i >= 6) return;
  const snap = part(GEO.box, mat('#fbf6e9'), 0, .05 + i * .01, 0, .17, .2, .012);
  snap.rotation.set(-.3, 0, (i - 1) * .2);
  snap.add(part(GEO.plane, flat(['#f7a4a4', '#9fc8ee', '#ffd95e'][i % 3]), 0, .08, .55, .78, .7, 1));
  data.hand.add(shade(snap, true));
}

// ---------- Peças do cenário ----------
function makeIsland(w, d, grass, theme) {
  const g = new THREE.Group();
  g.add(part(slab(w, d, .28, .55), mat(grass)));
  g.add(part(slab(w - .22, d - .22, .5, .5), mat(theme.dirt), 0, -.22, 0));
  g.add(part(GEO.sphere, mat(theme.under), 0, -.72, 0, w / 2 - .3, .62, d / 2 - .3));
  return shade(g, true, true);
}
function makeLedge(w, d, height, grass, theme) {
  const g = new THREE.Group();
  g.add(part(slab(w, d, .28, .4), mat(grass)));
  g.add(part(slab(w - .12, d - .12, height - .2, .36, .03), mat(theme.dirt), 0, -.2, 0));
  return shade(g, true, true);
}
function makeFlower(color) {
  const g = new THREE.Group();
  const green = mat('#7fb56a');
  g.add(part(GEO.cyl, green, 0, .26, 0, .03, .52, .03));
  for (const side of [-1, 1]) {
    const leaf = part(GEO.sphere, green, side * .11, .17 + side * .04, 0, .12, .035, .07);
    leaf.rotation.z = side * .55;
    g.add(leaf);
  }
  shade(g, true);
  // a flor em si fica sempre de frente para a câmera
  const head = new THREE.Group();
  head.position.y = .58;
  head.quaternion.copy(FACE_CAMERA);
  const petal = mat(color, { emissive: color, emissiveIntensity: .18 });
  for (let i = 0; i < 6; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = i / 6 * TAU;
    pivot.add(part(GEO.sphere, petal, 0, 0, .17, .105, .045, .14));
    head.add(pivot);
  }
  head.add(part(GEO.sphere, mat('#f2a93a', { emissive: '#f2a93a', emissiveIntensity: .2 }), 0, .04, 0, .1, .07, .1));
  g.add(head);
  const halo = glow('#fff6d6', 1.5, .32);
  halo.position.y = .58;
  g.add(halo);
  g.scale.setScalar(1.3);
  return g;
}
function makePolaroid(id) {
  const g = new THREE.Group();
  g.add(part(GEO.box, mat('#fbf6e9', { emissive: '#fbf6e9', emissiveIntensity: .22 }), 0, 0, 0, .64, .76, .035));
  const texture = new THREE.TextureLoader().load(album.get(id)?.src || '', loaded => {
    const aspect = loaded.image.width / loaded.image.height;
    if (aspect > 1) { loaded.repeat.set(1 / aspect, 1); loaded.offset.set((1 - 1 / aspect) / 2, 0); }
    else { loaded.repeat.set(1, aspect); loaded.offset.set(0, (1 - aspect) / 2); }
  });
  texture.colorSpace = THREE.SRGBColorSpace;
  const picture = own(new THREE.MeshBasicMaterial({ map: texture }));
  g.add(part(GEO.plane, picture, 0, .05, .019, .53));
  g.add(part(GEO.plane, picture, 0, .05, -.019, .53)).rotation.y = Math.PI;
  g.add(glow('#fff1c9', 2, .3));
  return g;
}
function makeCrate(owner) {
  const g = new THREE.Group();
  g.add(part(slab(.9, .9, .8, .1, .04), mat('#e2ad73'), 0, .8, 0));
  const trim = mat('#c58a52');
  for (const x of [-.4, .4]) for (const z of [-.4, .4]) g.add(part(GEO.box, trim, x, .4, z, .13, .74, .13));
  g.add(part(slab(.74, .74, .05, .08, .02), mat('#f0c48e'), 0, .825, 0));
  shade(g, true, true);
  if (owner) {
    const symbol = decal(SYMBOLS[owner], .58);
    symbol.position.y = .835;
    g.add(symbol);
  }
  return g;
}
function makePlate(owner) {
  const g = new THREE.Group();
  const pad = own(new THREE.MeshLambertMaterial({ color: owner === 'rafo' ? '#f9c6cf' : '#fbeeb4' }));
  g.add(shade(part(slab(1.02, 1.02, .05, .16, .02), pad, 0, .03, 0), false, true));
  const symbol = decal(SYMBOLS[owner], .62, .7);
  symbol.position.y = .04;
  g.add(symbol);
  const halo = glow(owner === 'rafo' ? '#f58aa0' : '#fff0b3', 2.6, 0);
  halo.position.y = .3;
  g.add(halo);
  g.userData = { symbol, halo };
  return g;
}
function makeButton() {
  const g = new THREE.Group();
  g.add(shade(part(GEO.cyl, mat('#f4ead2'), 0, .025, 0, .52, .05, .52), false, true));
  const cap = part(GEO.cyl, own(new THREE.MeshLambertMaterial({ color: '#f58a7a', emissive: '#f58a7a', emissiveIntensity: .1 })), 0, .085, 0, .38, .09, .38);
  g.add(shade(cap, false, true));
  const halo = glow('#ffb09f', 2.4, 0);
  halo.position.y = .3;
  g.add(halo);
  g.userData = { cap, halo };
  return g;
}
function makeBridge(length, depth) {
  const g = new THREE.Group();
  const count = Math.round(length / .78);
  const planks = [];
  for (let i = 0; i < count; i++) {
    const plank = part(slab(length / count - .07, depth, .18, .07, .03), mat(i % 2 ? '#e2ad73' : '#d59b62'), -length / 2 + (i + .5) * length / count, 0, 0);
    plank.visible = false;
    g.add(plank);
    planks.push(plank);
  }
  shade(g, true, true);
  const ghost = part(GEO.box, own(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .13, depthWrite: false })), 0, -.09, 0, length, .18, depth);
  g.add(ghost);
  g.userData = { planks, ghost };
  return g;
}
const PROPS = {
  lamp() {
    const g = new THREE.Group();
    g.add(part(GEO.cyl, mat('#5b6384'), 0, .8, 0, .045, 1.6, .045));
    g.add(part(GEO.cyl, mat('#5b6384'), 0, .04, 0, .13, .08, .13));
    g.add(part(GEO.sphere, glowMat('#fff0b8'), 0, 1.7, 0, .16));
    shade(g, true);
    const halo = glow('#ffe7a3', 3, .34);
    halo.position.y = 1.7;
    g.add(halo);
    return g;
  },
  sign() {
    const g = new THREE.Group();
    g.add(part(GEO.cyl, mat('#5b6384'), 0, .7, 0, .045, 1.4, .045));
    g.add(part(slab(.6, .08, .44, .03, .02), mat('#ffd166'), 0, 1.55, 0));
    g.add(part(GEO.box, flat('#3d4a6b'), 0, 1.33, .045, .36, .2, .01));
    g.rotation.y = Math.PI / 4;
    return shade(g, true);
  },
  bench() {
    const g = new THREE.Group(), wood = mat('#d59b62');
    g.add(part(slab(1.1, .38, .08, .08, .02), wood, 0, .34, 0));
    g.add(part(slab(1.1, .08, .34, .03, .02), wood, 0, .76, -.17));
    for (const x of [-.42, .42]) g.add(part(GEO.box, mat('#5b6384'), x, .15, 0, .07, .3, .32));
    return shade(g, true);
  },
  tree() {
    const g = new THREE.Group(), leaves = mat('#6fbf73');
    g.add(part(GEO.cyl, mat('#a97452'), 0, .3, 0, .11, .6, .11));
    g.add(part(GEO.sphere, leaves, 0, 1.05, 0, .62, .55, .62));
    g.add(part(GEO.sphere, leaves, .32, .85, .12, .38, .34, .38));
    g.add(part(GEO.sphere, leaves, -.3, .9, -.1, .4, .36, .4));
    g.add(part(GEO.sphere, mat('#86d089'), .08, 1.45, .04, .38, .34, .38));
    for (const [x, y, z] of [[.42, 1.02, .34], [-.2, 1.3, .44], [.1, .78, .55], [-.5, .95, .2]]) g.add(part(GEO.sphere, mat('#ff8a8a'), x, y, z, .075));
    return shade(g, true);
  },
  bush() {
    const g = new THREE.Group(), leaves = mat('#79c47c');
    g.add(part(GEO.sphere, leaves, 0, .24, 0, .36, .28, .36));
    g.add(part(GEO.sphere, leaves, .26, .2, .05, .26, .22, .26));
    g.add(part(GEO.sphere, mat('#8fd491'), -.2, .22, .12, .24, .2, .24));
    return shade(g, true);
  },
  desk() {
    // cantinho de designer da Lulu
    const g = new THREE.Group();
    g.add(part(slab(1.15, .66, .08, .08, .02), mat('#fbf1dc'), 0, .5, 0));
    for (const x of [-.48, .48]) for (const z of [-.25, .25]) g.add(part(GEO.cyl, mat('#d59b62'), x, .21, z, .035, .42, .035));
    g.add(part(slab(.6, .05, .4, .03, .02), mat('#4a4f6b'), .12, .94, -.2));
    g.add(part(GEO.box, glowMat('#aad4f5', .6), .12, .74, -.172, .52, .3, .01));
    ['#ff8a8a', '#ffd166', '#7cc0f0', '#8fd491'].forEach((color, i) => {
      const pen = part(GEO.capsule, mat(color), -.42 + i * .075, .525, .12, .022, .1, .022);
      pen.rotation.set(Math.PI / 2, 0, .25 * (i - 1.5));
      g.add(pen);
    });
    g.rotation.y = Math.PI / 4;
    return shade(g, true);
  },
  ship() {
    const g = new THREE.Group();
    g.add(part(GEO.capsule, mat('#fbf6e9'), 0, .8, 0, .34, .34, .34));
    g.add(part(GEO.cone, mat('#ff8a8a'), 0, 1.5, 0, .3, .5, .3));
    g.add(part(GEO.sphere, glowMat('#aad4f5', .5), .22, .88, .24, .13));
    for (let i = 0; i < 3; i++) {
      const leg = part(GEO.capsule, mat('#b9c0d6'), Math.cos(i * TAU / 3) * .4, .18, Math.sin(i * TAU / 3) * .4, .035, .2, .035);
      leg.rotation.set(Math.sin(i * TAU / 3) * .5, 0, -Math.cos(i * TAU / 3) * .5);
      g.add(leg);
    }
    return shade(g, true);
  },
  ten() {
    // o 10 que fugiu pra Lua
    const g = new THREE.Group();
    const sprite = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: own(textTexture('10', '#ffe08a', 'italic 700 150px Georgia, serif')), transparent: true, depthWrite: false })));
    sprite.scale.setScalar(1.4);
    const halo = glow('#ffe08a', 2.4, .3);
    g.add(halo, sprite);
    g.userData.tick = time => { sprite.position.y = halo.position.y = 1.1 + Math.sin(time * 1.4) * .12; };
    return g;
  }
};
function makeGoal() {
  const g = new THREE.Group();
  const ringMat = own(new THREE.MeshBasicMaterial({ color: '#fff0b3', transparent: true, opacity: .25, side: THREE.DoubleSide, depthWrite: false }));
  const ring = part(GEO.ring, ringMat, 0, .03, 0, 1.05);
  ring.rotation.x = -Math.PI / 2;
  const moonMat = own(new THREE.MeshBasicMaterial({ color: '#fff0b3', transparent: true, opacity: .3 }));
  const moon = part(GEO.crescent, moonMat, 0, 2.3, 0);
  moon.quaternion.copy(FACE_CAMERA).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 2.4)));
  const halo = glow('#ffe9a8', 3.6, 0);
  halo.position.y = 2.3;
  g.add(ring, moon, halo);
  g.userData = { ring, moon, halo, ringMat, moonMat };
  return g;
}
// Matinhos, pedrinhas, florzinhas e cogumelos espalhados pela ilha.
function decorate(block, theme, reserved, group) {
  const random = seeded(Math.round(block.x * 31 + block.z * 17 + block.w * 7) + 99);
  const free = (x, z, r) => reserved.every(([rx, rz, rr]) => Math.hypot(x - rx, z - rz) > r + rr);
  const spot = margin => [block.x + (random() - .5) * (block.w - margin * 2), block.z + (random() - .5) * (block.d - margin * 2)];
  const area = block.w * block.d;
  const moon = theme.kind === 'moon';
  const deco = new THREE.Group();
  for (let i = 0; i < (block.side === 'meio' ? 0 : area * .2); i++) {
    const r = .28 + random() * .42;
    const [x, z] = spot(r + .25);
    const squash = .7 + random() * .3;
    const patch = part(GEO.circle, mat(i % 2 ? theme.patchA : theme.patchB), x, block.y + .004 + i * .0004, z, r, r * squash, 1);
    patch.rotation.x = -Math.PI / 2;
    patch.receiveShadow = true;
    deco.add(patch);
    if (moon) {
      const rim = part(GEO.ring, mat(theme.patchB, { side: THREE.DoubleSide }), x, block.y + .014, z, r * 1.1, r * 1.1 * squash, 1);
      rim.rotation.x = -Math.PI / 2;
      deco.add(rim);
    }
  }
  for (let i = 0; i < area * .32; i++) {
    const [x, z] = spot(.35);
    if (!free(x, z, .3)) continue;
    const kind = random();
    const item = new THREE.Group();
    item.position.set(x, block.y, z);
    if (moon || kind < .2) {
      item.add(part(GEO.sphere, mat(moon ? '#cfc8b0' : '#c9c4c9'), 0, .06, 0, .1 + random() * .08, .08, .1));
    } else if (kind < .62) {
      for (let n = 0; n < 3; n++) {
        const blade = part(GEO.cone, mat(theme.tuft), (n - 1) * .06, .1, (random() - .5) * .05, .04, .2 + random() * .08, .04);
        blade.rotation.z = (n - 1) * -.3;
        item.add(blade);
      }
    } else if (kind < .9) {
      const tiny = new THREE.Group();
      tiny.position.y = .16;
      tiny.quaternion.copy(FACE_CAMERA);
      const color = ['#ffffff', '#ffd95e', '#ffb3c7', '#c7b8ff'][Math.floor(random() * 4)];
      for (let n = 0; n < 5; n++) {
        const pivot = new THREE.Group();
        pivot.rotation.y = n / 5 * TAU;
        pivot.add(part(GEO.sphere, mat(color), 0, 0, .05, .035, .016, .045));
        tiny.add(pivot);
      }
      tiny.add(part(GEO.sphere, mat('#f2a93a'), 0, .012, 0, .03, .022, .03));
      item.add(part(GEO.cyl, mat('#7fb56a'), 0, .08, 0, .012, .16, .012), tiny);
    } else {
      item.add(part(GEO.cyl, mat('#fbf1dc'), 0, .07, 0, .04, .14, .04));
      item.add(part(GEO.sphere, mat('#ff7a7a'), 0, .15, 0, .1, .07, .1));
    }
    deco.add(shade(item, true));
  }
  group.add(deco);
}

// ---------- Partículas, poeirinha, corações e vagalumes ----------
const SPARKS = 80;
const sparkPos = new Float32Array(SPARKS * 3).fill(-999);
const sparkVel = new Float32Array(SPARKS * 3);
const sparkLife = new Float32Array(SPARKS);
const sparkGeo = new THREE.BufferGeometry();
sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ size: 12, sizeAttenuation: false, map: glowTexture, color: 0xfff0b3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
sparks.frustumCulled = false;
scene.add(sparks);
let sparkNext = 0;
function burst(x, y, z, count = 16) {
  if (reduceMotion) count = Math.min(count, 5);
  for (let n = 0; n < count; n++) {
    const i = sparkNext = (sparkNext + 1) % SPARKS;
    const angle = Math.random() * TAU, speed = .8 + Math.random() * 1.8;
    sparkPos.set([x, y, z], i * 3);
    sparkVel.set([Math.cos(angle) * speed, 1.5 + Math.random() * 2.5, Math.sin(angle) * speed], i * 3);
    sparkLife[i] = .6 + Math.random() * .6;
  }
}
function tickSparks(dt) {
  for (let i = 0; i < SPARKS; i++) {
    if (sparkLife[i] <= 0) continue;
    sparkLife[i] -= dt;
    const o = i * 3;
    if (sparkLife[i] <= 0) { sparkPos[o + 1] = -999; continue; }
    sparkVel[o + 1] -= 4 * dt;
    sparkPos[o] += sparkVel[o] * dt;
    sparkPos[o + 1] += sparkVel[o + 1] * dt;
    sparkPos[o + 2] += sparkVel[o + 2] * dt;
  }
  sparkGeo.attributes.position.needsUpdate = true;
}
const puffs = [];
function puff(texture, x, y, z, { size = .4, life = 1, rise = .9, grow = 0, color = '#ffffff', spread = 0 } = {}) {
  if (reduceMotion && puffs.length > 6) return;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, color, transparent: true, depthWrite: false }));
  sprite.position.set(x + (Math.random() - .5) * spread, y, z + (Math.random() - .5) * spread);
  sprite.scale.setScalar(size);
  scene.add(sprite);
  puffs.push({ sprite, life, max: life, rise, grow, size, drift: (Math.random() - .5) * .5 });
}
const dust = (x, y, z) => { for (let i = 0; i < 3; i++) puff(puffTexture, x, y + .1, z, { size: .3, life: .5, rise: .5, grow: 1.6, color: '#fff7e6', spread: .5 }); };
const heart = (x, y, z) => puff(SYMBOLS.rafo, x, y, z, { size: .34 + Math.random() * .28, life: 2.2, rise: .9, spread: 1.1 });
function tickPuffs(dt) {
  for (let i = puffs.length - 1; i >= 0; i--) {
    const p = puffs[i];
    p.life -= dt;
    p.sprite.position.y += dt * p.rise;
    p.sprite.position.x += dt * p.drift;
    p.sprite.scale.setScalar(p.size * (1 + p.grow * (1 - p.life / p.max)));
    p.sprite.material.opacity = clamp(p.life / p.max * 1.6, 0, 1);
    if (p.life <= 0) {
      scene.remove(p.sprite);
      p.sprite.material.dispose();
      puffs.splice(i, 1);
    }
  }
}
const fireflies = [];
for (let i = 0; i < 26; i++) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: '#fff6c9', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sprite.scale.setScalar(.3);
  scene.add(sprite);
  fireflies.push({ sprite, x: 0, y: 0, z: 0, phase: Math.random() * TAU, speed: .4 + Math.random() * .6 });
}

// ---------- Som ----------
let muted = false;
let audioContext = null;
function chime(notes, gap = .08, volume = .1, type = 'triangle') {
  if (muted) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    notes.forEach((frequency, i) => {
      const start = audioContext.currentTime + i * gap;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + .015);
      gain.gain.exponentialRampToValueAtTime(.0001, start + .7);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + .75);
    });
  } catch {}
}
function startMusic() {
  if (!music || muted) return;
  if (!music.getAttribute('src')) {
    const source = window.SITE_CONFIG?.musica;
    if (!source) return;
    music.src = source;
    music.volume = .28;
  }
  music.play().catch(() => {});
}
function setMuted(next) {
  muted = next;
  $('cm-mute').textContent = touchDevice ? (muted ? 'mudo' : 'som') : (muted ? 'som desligado' : 'som ligado');
  $('cm-mute').setAttribute('aria-label', muted ? 'som desligado: ligar' : 'som ligado: desligar');
  $('cm-mute').setAttribute('aria-pressed', String(muted));
  if (muted) music?.pause(); else startMusic();
}

// ---------- Fases ----------
// O chão fica no plano x/z e a câmera olha de (+x, +y, +z): quanto maior x + z,
// mais perto da câmera. Na tela, -x sobe para a esquerda e -z sobe para a direita.
// Cada lado é desenhado no "molde" do Rafo (ilhas para o lado -x); o da Lulu é
// o mesmo molde espelhado na tela (x e z trocados). Assim os dois lados ficam
// iguais para quem joga, e o que aparece de um lado aparece do outro.
// Regra do molde: tudo o que é alto (degraus, árvores, postes) fica na borda do
// fundo (x e z menores), para nunca esconder uma caixa.
const THEMES = {
  tarde: { sky: ['#8fcdea', '#fde6c4'], hemi: [0xffffff, 0xa9c08f, 2.1], sun: [0xfff3da, 2.5], grass: { rafo: '#a5d683', lulu: '#b0dc8a', meio: '#f7e9bd' }, patchA: '#98cd78', patchB: '#b6e091', tuft: '#7fbf68', dirt: '#d2a374', under: '#b0835d', fire: '#fffbe0', fireAlpha: .35, kind: 'grass' },
  entardecer: { sky: ['#5553a0', '#f7b29a'], hemi: [0xdcd3ff, 0x8a80a8, 2], sun: [0xffcfa3, 2.3], grass: { rafo: '#93cc8d', lulu: '#9fd192', meio: '#f5e2b6' }, patchA: '#86c282', patchB: '#a8d99b', tuft: '#6fb474', dirt: '#c4946f', under: '#9c735c', fire: '#fff0b0', fireAlpha: .7, kind: 'grass' },
  chiclete: { sky: ['#f9a9c8', '#ffe6bf'], hemi: [0xfff1f6, 0xb9c9a0, 2.1], sun: [0xfff0e0, 2.4], grass: { rafo: '#a9dfb0', lulu: '#b4e4b6', meio: '#fbe3ee' }, patchA: '#9bd6a5', patchB: '#c1ecc2', tuft: '#84c891', dirt: '#e0a98a', under: '#bd8870', fire: '#fff4fa', fireAlpha: .45, kind: 'grass' },
  lua: { sky: ['#0d1230', '#222b5c'], hemi: [0xc9d3ff, 0x4b5078, 2], sun: [0xe6ecff, 1.9], grass: { rafo: '#e9e2c9', lulu: '#eee7ce', meio: '#f9efcb' }, patchA: '#d9d2b8', patchB: '#f4eed8', tuft: '#d9d2b8', dirt: '#bdb7a2', under: '#96927f', fire: '#ffffff', fireAlpha: .8, kind: 'moon' }
};
const other = who => who === 'rafo' ? 'lulu' : 'rafo';
const FACES_CAMERA = new Set(['sign', 'desk']);
function sideOf(B, who) {
  const flip = who === 'lulu';
  const at = (x, z) => flip ? [z, x] : [x, z];
  return {
    who, other: other(who),
    floor: (x, z, w, d) => flip ? B.floor(who, z, x, d, w) : B.floor(who, x, z, w, d),
    ledge: (x, z, w, d, top) => flip ? B.ledge(who, z, x, d, w, top) : B.ledge(who, x, z, w, d, top),
    bridge: (id, x, z, length, axis) => B.bridge(id, ...at(x, z), length, flip ? (axis === 'x' ? 'z' : 'x') : axis),
    crate: (owner, x, z) => B.crate(owner, ...at(x, z)),
    plate: (x, z, bridge) => B.plate(who, ...at(x, z), bridge),
    button: (x, z, bridge) => B.button(...at(x, z), bridge),
    item: (x, z, y = 0) => B.item(who, ...at(x, z), y),
    prop: (kind, x, z, rot = 0) => B.prop(kind, ...at(x, z), 0, !flip ? rot : FACES_CAMERA.has(kind) ? -rot : Math.PI / 2 - rot),
    spawn: (x, z) => B.spawn(who, ...at(x, z))
  };
}
const LEVELS = [
  // 1 · cada um com a sua caixa: a caixa de um ergue a ponte do outro.
  {
    theme: 'tarde', gravity: 1,
    build(B) {
      B.meet(B.floor('meio', 0, 0, 3, 3));
      for (const who of ['rafo', 'lulu']) {
        const S = sideOf(B, who);
        S.floor(-11.5, 0, 7, 7);
        S.ledge(-14, -2.5, 2, 2, .9);              // degrau no canto do fundo
        S.bridge(who, -4.75, 0, 6.5, 'x');
        S.crate(who, -12, 1);
        S.plate(-9, -2, S.other);
        S.item(-14, 2.6);
        S.item(-9, 2.6);
        S.item(-14, -2.5, .9);
        S.spawn(-11.5, -.5);
        S.prop('tree', -11.6, -3);
        S.prop('lamp', -10.2, -3.1);
        if (who === 'rafo') { S.prop('sign', -14.5, -.7); S.prop('bench', -14.4, .8, Math.PI / 2); }
        else { S.prop('desk', -14.3, .2); S.prop('bush', -14.6, 1.5); }
      }
    }
  },
  // 2 · um segura o botão para o outro atravessar; caixa de degrau para o que é alto.
  {
    theme: 'entardecer', gravity: 1,
    build(B) {
      B.meet(B.floor('meio', 0, 0, 3, 3));
      for (const who of ['rafo', 'lulu']) {
        const S = sideOf(B, who);
        S.floor(-12, 0, 7, 7);                      // ilha principal
        S.floor(-12, 10.5, 5, 5);                   // ilhota
        S.ledge(-13.5, 9, 2, 2, 1.9);               // alto demais para um pulo só
        S.bridge(who, -5, 0, 7, 'x');               // até o meio
        S.bridge(who + '2', -11.5, 5.75, 4.5, 'z'); // até a ilhota
        S.crate(who, -13, 1);
        S.plate(-10, -2, S.other);
        S.button(-14, 2, S.other + '2');            // segura a ponte da ilhota do outro
        S.crate(null, -11, 11.5);                   // caixa-degrau
        S.item(-14.8, -2.8);
        S.item(-10.2, 12.3);
        S.item(-13.5, 9, 1.9);
        S.spawn(-12, -.5);
        S.prop('lamp', -12.2, -3.1);
        S.prop('tree', -9.7, -3);
        S.prop('bush', -10.2, 8.5);
        if (who === 'rafo') S.prop('bench', -15, -.6, Math.PI / 2); else S.prop('desk', -14.9, -.5);
      }
    }
  },
  // 3 · a lua: uma caixa serve de degrau e depois segura o botão.
  {
    theme: 'lua', gravity: .85,
    build(B) {
      B.meet(B.floor('meio', 0, 0, 4, 4));
      B.prop('bench', -1.1, -1.1, 0, Math.PI / 4);
      for (const who of ['rafo', 'lulu']) {
        const S = sideOf(B, who);
        S.floor(-21.5, 0, 5, 5);                    // onde cada um pousa
        S.floor(-10.5, 0, 7, 7);
        S.ledge(-13, -2.5, 2, 2, 2.2);
        S.bridge(who + '2', -16.5, 0, 5, 'x');
        S.bridge(who, -4.5, 0, 5, 'x');
        S.crate(who, -22.5, 1);
        S.plate(-20.5, -1, S.other + '2');
        S.crate(null, -10.5, -2);
        S.button(-9.5, 1, S.other);
        S.item(-23.4, 1.9);
        S.item(-8, 2.7);
        S.item(-13, -2.5, 2.2);
        S.spawn(-21.5, -.3);
        S.prop('ship', -23.3, -1.8);
        S.prop('lamp', -10, -3.1);
      }
    }
  },
  // Daqui em diante, fases de quebra-cabeça: as regras de cada uma ficam em caminho-modo-<nome>.js.
  { theme: 'chiclete', mode: 'grudinho' },   // 4 · um comando só move os dois
  { theme: 'tarde', mode: 'cores' },         // 5 · o Rafo escolhe a tinta, a Lulu pinta
  { theme: 'entardecer', mode: 'luzes' },    // 6 · repetir a ordem em que as luzes acendem
  { theme: 'chiclete', mode: 'pedacinhos' }, // 7 · montar a foto em pedaços
  { theme: 'lua', mode: 'espelhos' }         // 8 · levar o luar até a flor de lua
];

// ---------- Estado ----------
const R = .28, H = 1.3;
let state = 'title'; // title | play | card | ending
let level = null;
let clock = 0;
let active = 0;
let cut = 0;         // câmera mostrando uma ponte que subiu
const cutAt = new THREE.Vector3();
const input = { keys: new Set(), stick: null, sx: 0, sy: 0, step: '', swipe: null };
const people = { rafo: makePerson(D.rafo, false), lulu: makePerson(D.lulu, true) };
const bodies = ['rafo', 'lulu'].map(who => ({
  who, mesh: people[who], x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, ground: null, coyote: 0, buffer: 0,
  face: 0, walk: 0, squash: 0, frozen: 0, lastGroundY: 0, spawn: { x: 0, y: 0, z: 0 }, falls: 0,
  pushLast: null, pushTime: 0, pushedAt: -9, pushStreak: -9, noStick: 0, pushK: 0, cheer: 0, shadow: null
}));
for (const body of bodies) {
  scene.add(body.mesh);
  body.shadow = part(GEO.circle, new THREE.MeshBasicMaterial({ color: 0x1a1430, transparent: true, opacity: .25, depthWrite: false }), 0, 0, 0, .32);
  body.shadow.rotation.x = -Math.PI / 2;
  scene.add(body.shadow);
}
const markers = bodies.map(() => { // setinha em cima de quem está jogando
  const marker = part(GEO.cone, flat('#ffe08a'), 0, 0, 0, .11, .17, .11);
  marker.rotation.x = Math.PI;
  scene.add(marker);
  return marker;
});
// fio de chiclete entre os dois, enquanto estão grudadinhos
const gum = Array.from({ length: 16 }, () => {
  const dot = part(GEO.sphere, flat('#ff9fc0'), 0, 0, 0, .07);
  dot.visible = false;
  scene.add(dot);
  return dot;
});

const SAVE_KEY = 'lulu.caminho.v2';
const save = (() => {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY)) || {};
    return { fase: clamp(Number(data.fase) || 0, 0, LEVELS.length), fotos: Array.isArray(data.fotos) ? data.fotos.filter(id => album.has(id)) : [] };
  } catch { return { fase: 0, fotos: [] }; }
})();
const writeSave = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {} };

function unloadLevel() {
  if (!level) return;
  level.mode?.dispose?.();
  kit.mini.close();
  level.tiles?.tileGeo.dispose();
  scene.remove(level.group);
  level.group.traverse(node => {
    if (node.geometry?.userData.own) node.geometry.dispose();
    const material = node.material;
    if (material?.userData.own) {
      if (material.map && !shared.has(material.map)) material.map.dispose();
      material.dispose();
    }
  });
  level = null;
}
function buildLevel(index) {
  unloadLevel();
  const def = LEVELS[index], theme = THEMES[def.theme];
  const group = new THREE.Group();
  const L = {
    index, theme, group, blocks: [], crates: [], plates: [], buttons: [], bridges: {}, flowers: [], photos: [], props: [], reserved: [],
    meet: null, gravity: 22 * (def.gravity || 1), gotFlowers: 0, gotPhotos: 0, hintAt: -10, gotPhotoIds: [], glued: false, mode: null, tiles: null
  };
  const solid = (kind, x, z, w, d, top, th, mesh) => {
    const block = { kind, x, z, w, d, y: top, th, px: x, py: top, pz: z, mx: 0, my: 0, mz: 0, solid: true, mesh };
    if (mesh) { mesh.position.set(x, top, z); group.add(mesh); }
    L.blocks.push(block);
    return block;
  };
  const B = {
    floor(side, x, z, w, d, y = 0) {
      const block = solid('floor', x, z, w, d, y, .7, makeIsland(w, d, theme.grass[side], theme));
      block.side = side;
      return block;
    },
    ledge(side, x, z, w, d, top, base = 0) {
      L.reserved.push([x, z, Math.max(w, d) / 2 + .2]);
      return solid('ledge', x, z, w, d, top, top - base, makeLedge(w, d, top - base, theme.grass[side], theme));
    },
    bridge(id, x, z, length, axis, y = 0) {
      const mesh = makeBridge(length, 1.8);
      if (axis === 'z') mesh.rotation.y = Math.PI / 2;
      const block = solid('bridge', x, z, axis === 'x' ? length : 1.8, axis === 'x' ? 1.8 : length, y, .3, mesh);
      Object.assign(block, { solid: false, k: 0, locked: false, shown: false });
      L.bridges[id] = block;
      const dx = axis === 'x' ? length / 2 + .8 : 0, dz = axis === 'z' ? length / 2 + .8 : 0;
      L.reserved.push([x - dx, z - dz, 1], [x + dx, z + dz, 1]);
    },
    crate(owner, x, z, y = 0) {
      const mesh = makeCrate(owner);
      mesh.position.set(x, y, z);
      group.add(mesh);
      const block = solid('crate', x, z, .9, .9, y + .8, .8, null);
      const floor = L.blocks.find(b => b.kind === 'floor' && Math.abs(b.y - y) < .01 && Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2);
      block.crate = { owner, block, mesh, floor, base: y, slide: null, locked: false, shake: 0, lean: 0, bump: 0, dirX: 0, dirZ: 0 };
      L.crates.push(block.crate);
      L.reserved.push([x, z, .7]);
    },
    plate(owner, x, z, bridge, y = 0) {
      const mesh = makePlate(owner);
      mesh.position.set(x, y, z);
      group.add(mesh);
      L.plates.push({ owner, x, y, z, bridge, mesh, locked: false });
      L.reserved.push([x, z, .8]);
    },
    button(x, z, bridge, y = 0) {
      const mesh = makeButton();
      mesh.position.set(x, y, z);
      group.add(mesh);
      L.buttons.push({ x, y, z, bridge, mesh, hold: 0, on: false });
      L.reserved.push([x, z, .8]);
    },
    item(who, x, z, y = 0) {
      L.reserved.push([x, z, .6]);
      if (who === 'rafo') {
        const color = BLOOMS[L.flowers.length % BLOOMS.length];
        const mesh = makeFlower(color);
        mesh.position.set(x, y, z);
        group.add(mesh);
        L.flowers.push({ x, y, z, mesh, taken: false, fly: 0, color });
      } else {
        const id = D.fases[index].fotos[L.photos.length];
        const mesh = makePolaroid(id);
        mesh.position.set(x, y + 1, z);
        group.add(mesh);
        L.photos.push({ x, y, z, id, mesh, taken: false, fly: 0 });
      }
    },
    prop(kind, x, z, y = 0, rot = 0) {
      const mesh = PROPS[kind]();
      mesh.position.set(x, y, z);
      mesh.rotation.y += rot;
      group.add(mesh);
      L.props.push(mesh);
      L.reserved.push([x, z, .9]);
    },
    spawn(who, x, z, y = 0) {
      const body = bodies[who === 'rafo' ? 0 : 1];
      Object.assign(body, { x, y, z, vx: 0, vy: 0, vz: 0, ground: null, coyote: 0, buffer: 0, frozen: 0, lastGroundY: y, pushLast: null, pushTime: 0, pushK: 0, cheer: 0, falls: 0, walk: 0, squash: 0 });
      body.face = Math.atan2(-x, -z);
      body.spawn = { x, y, z };
      L.reserved.push([x, z, .7]);
    },
    meet(block) { L.meet = block; L.reserved.push([block.x, block.z, 1.2]); }
  };
  if (def.mode) {
    // fase de quebra-cabeça: quem monta é o modo, logo abaixo
    L.mode = (MODES[def.mode] || missingMode(def.mode))(kit);
    L.glued = !!L.mode.glued;
    L.gravity = 22;
    L.meet = { x: 0, y: .06, z: 0 };
  } else {
    def.build(B);
    L.goalMesh = makeGoal();
    L.goalMesh.position.set(L.meet.x, L.meet.y, L.meet.z);
    group.add(L.goalMesh);
  }
  for (const block of L.blocks) if (block.kind === 'floor') decorate(block, theme, L.reserved, group);
  scene.add(group);

  // céu, luz e vagalumes do tema
  stage.style.setProperty('--cm-sky-a', theme.sky[0]);
  stage.style.setProperty('--cm-sky-b', theme.sky[1]);
  stage.dataset.tema = def.theme;
  hemi.color.setHex(theme.hemi[0]); hemi.groundColor.setHex(theme.hemi[1]); hemi.intensity = theme.hemi[2];
  sun.color.setHex(theme.sun[0]); sun.intensity = theme.sun[1];
  const xs = L.blocks.length ? L.blocks.map(b => b.x) : [-6, 6], zs = L.blocks.length ? L.blocks.map(b => b.z) : [-6, 6];
  const minX = Math.min(...xs) - 4, maxX = Math.max(...xs) + 4, minZ = Math.min(...zs) - 5, maxZ = Math.max(...zs) + 5;
  const random = seeded(index + 7);
  fireflies.forEach(fly => {
    fly.x = minX + random() * (maxX - minX);
    fly.z = minZ + random() * (maxZ - minZ);
    fly.y = .5 + random() * 2.4;
    fly.sprite.material.color.set(theme.fire);
  });

  // o que cada um já juntou nas fases anteriores continua na mão
  for (const who of ['rafo', 'lulu']) {
    const data = people[who].userData;
    data.hand.clear();
    data.held = 0;
    restHand(people[who]);
    const before = D.fases.slice(0, index).reduce((sum, fase) => sum + (who === 'rafo' ? fase.flores : fase.fotos).length, 0);
    for (let i = 0; i < before; i++) who === 'rafo' ? addBloom(people.rafo, BLOOMS[i % BLOOMS.length]) : addSnapshot(people.lulu);
  }
  level = L;
  active = 0;
  cut = 0;
  if (L.mode) {
    for (const body of bodies) Object.assign(body, { vx: 0, vy: 0, vz: 0, frozen: 0, pushLast: null, pushTime: 0, pushK: 0, cheer: 0, falls: 0, walk: 0, squash: 0 });
    L.mode.setup(L);
  }
  camTarget.set(L.tiles ? L.tiles.focus[0] : bodies[0].x, .6, L.tiles ? L.tiles.focus[1] : bodies[0].z);
  stage.classList.toggle('is-tiles', !!L.tiles);
  releaseStick();
  updateHud();
}

// ---------- Fases de quebra-cabeça (caminho-modo-*.js) ----------
// Cada arquivo caminho-modo-*.js registra um modo: window.CAMINHO_MODOS[nome] = kit => ({ ... }).
// O modo recebe o "kit" (mais abaixo) e devolve um objeto com:
//   setup(L)      monta a fase dentro de L.group e põe os bonecos no lugar
//   step(dt)      regras, a cada passo fixo de 1/60 s, enquanto se joga
//   animate(dt)   (opcional) enfeites a cada quadro
//   hud()         (opcional) { name, lines: [{ text, done }] } para o quadro de missões
//   action(body)  (opcional) o que o botão de pular faz nesta fase
//   switched(i)   (opcional) avisado quando se troca de personagem
//   dispose()     (opcional) limpeza ao sair da fase
//   glued         (opcional) true: os dois são comandados juntos e não se troca de personagem
//   hello         (opcional) recadinho mostrado ao começar
//   actionLabel   (opcional) o que o botão de pular faz aqui, para a legenda dos controles
//   extraControls (opcional) linhas a mais na legenda: [[tecla, o que faz], ...]
//   controls      (opcional) troca a legenda inteira: [[tecla, o que faz], ...] ou função(noCelular)
const MODES = (window.CAMINHO_MODOS ||= {}); // o mesmo objeto em que os arquivos de modo se registram
const T_RIGHT = new THREE.Vector3(Math.SQRT1_2, 0, -Math.SQRT1_2); // direita da tela, no chão
const T_UP = new THREE.Vector3(-Math.SQRT1_2, 0, -Math.SQRT1_2);   // "para cima" da tela, no chão
const T_DIRS = { U: [0, 1], D: [0, -1], L: [-1, 0], R: [1, 0] };
const TILE_FLOOR = { kind: 'tile', solid: true, mx: 0, my: 0, mz: 0, py: .06, w: 0, d: 0 };
function discard(object) {
  object.traverse(node => {
    if (node.geometry?.userData.own) node.geometry.dispose();
    const material = node.material;
    if (material?.userData.own) {
      if (material.map && !shared.has(material.map)) material.map.dispose();
      material.dispose();
    }
  });
  object.removeFromParent();
}
// Tabuleiros de casas, virados para a tela: "direita" e "cima" das casas são a
// direita e o alto da tela. specs: [{ id, cols, rows, grass?, colors? }], um ou dois.
// Casa (cx, cy): cx cresce para a direita; cy = 0 é a fileira mais perto de quem joga.
// Opções: cell (tamanho da casa), gap (vão entre os tabuleiros) e layout: 'wide' (sempre lado a
// lado) ou 'tall' (sempre o primeiro em cima, mais longe, e o segundo embaixo); sem layout, escolhe
// o que couber melhor na tela.
function makeTiles(L, specs, { cell = 1.15, gap = 1.1, layout = '' } = {}) {
  const T = { cell, top: .06, boards: {}, list: [], content: new THREE.Group(), anim: null, focus: [0, 0], needW: 8, needH: 8, wide: true, dirs: T_DIRS, right: T_RIGHT, up: T_UP, held: '', holdTime: 0 };
  L.group.add(T.content);
  const tileGeo = slab(cell - .1, cell - .1, .06, .16, .02);
  tileGeo.userData.own = false; // é de todas as casas: só some com a fase
  T.tileGeo = tileGeo;
  for (const spec of specs) {
    const { id, cols, rows } = spec;
    const colors = spec.colors || [L.theme.patchA, L.theme.patchB];
    const base = makeIsland(cols * cell + .7, rows * cell + .7, spec.grass || L.theme.grass[id] || L.theme.grass.meio, L.theme);
    base.rotation.y = Math.PI / 4;
    L.group.add(base);
    const board = { id, cols, rows, base, origin: new THREE.Vector3(), tiles: [], width: cols * cell + .7, depth: rows * cell + .7 };
    for (let cy = 0; cy < rows; cy++) {
      board.tiles.push([]);
      for (let cx = 0; cx < cols; cx++) {
        const tile = part(tileGeo, mat(colors[(cx + cy) % 2]));
        tile.rotation.y = Math.PI / 4;
        tile.receiveShadow = true;
        L.group.add(tile);
        board.tiles[cy].push(tile);
      }
    }
    T.boards[id] = board;
    T.list.push(board);
  }
  // centro da casa, no mundo
  T.spot = (board, cx, cy, out = new THREE.Vector3()) => out.copy(board.origin)
    .addScaledVector(T_RIGHT, (cx - (board.cols - 1) / 2) * cell)
    .addScaledVector(T_UP, (cy - (board.rows - 1) / 2) * cell).setY(T.top);
  T.inside = (board, cx, cy) => cx >= 0 && cy >= 0 && cx < board.cols && cy < board.rows;
  T.tile = (board, cx, cy) => board.tiles[cy][cx];
  // Escolhe, para o tamanho da tela, se os dois tabuleiros ficam lado a lado ou um acima do outro.
  T.layout = () => {
    const viewW = camera.right - camera.left, viewH = camera.top - camera.bottom;
    const [a, b] = T.list;
    if (!b) {
      a.origin.set(0, 0, 0);
      T.needW = a.width + 1.2; T.needH = a.depth * .58 + 4.4; T.wide = true; T.focus = [0, 0];
    } else {
      const across = a.width + gap + b.width, deep = a.depth + gap + b.depth;
      const wide = { w: across + 1.2, h: Math.max(a.depth, b.depth) * .58 + 4.4 };
      const tall = { w: Math.max(a.width, b.width) + .8, h: deep * .58 + 5.2 };
      T.wide = layout ? layout === 'wide' : Math.min(viewW / wide.w, viewH / wide.h) >= Math.min(viewW / tall.w, viewH / tall.h);
      if (T.wide) {
        a.origin.copy(T_RIGHT).multiplyScalar(-across / 2 + a.width / 2);
        b.origin.copy(T_RIGHT).multiplyScalar(across / 2 - b.width / 2);
        T.needW = wide.w; T.needH = wide.h; T.focus = [0, 0];
      } else {
        a.origin.copy(T_UP).multiplyScalar(deep / 2 - a.depth / 2);
        b.origin.copy(T_UP).multiplyScalar(-deep / 2 + b.depth / 2);
        T.needW = tall.w; T.needH = tall.h; T.focus = [1.05, 1.05]; // um pouco para cima, para sobrar lugar para os botões
      }
    }
    for (const board of T.list) {
      board.base.position.copy(board.origin);
      for (let cy = 0; cy < board.rows; cy++) for (let cx = 0; cx < board.cols; cx++) T.spot(board, cx, cy, board.tiles[cy][cx].position);
    }
  };
  // põe um boneco numa casa, de uma vez
  T.place = (body, board, cx, cy, face = Math.PI / 4) => {
    const spot = T.spot(board, cx, cy);
    Object.assign(body, { x: spot.x, y: T.top, z: spot.z, vx: 0, vy: 0, vz: 0, ground: TILE_FLOOR, lastGroundY: T.top, face, cell: [cx, cy], board, squash: .15 });
  };
  // põe uma peça da rodada numa casa (some com T.clear())
  T.add = (mesh, board, cx, cy, y = T.top) => {
    T.spot(board, cx, cy, mesh.position);
    mesh.position.y = y;
    T.content.add(mesh);
    return mesh;
  };
  T.clear = () => { for (const child of [...T.content.children]) discard(child); };
  // Passinhos animados, todos ao mesmo tempo. Cada passo é um destes:
  //   { body, kind: 'hop', to: [cx, cy], board? }   pula para a casa
  //   { body, kind: 'bump', dir: 'U'|'D'|'L'|'R' }  bate e volta
  //   { body, kind: 'stay' }                         fica (dá uma tremidinha)
  // done() é chamado quando todos terminam. Enquanto isso, T.anim não é nulo.
  T.move = (steps, done) => {
    for (const step of steps) {
      const body = step.body, board = step.board || body.board;
      step.from = new THREE.Vector3(body.x, T.top, body.z);
      if (step.kind === 'hop') step.target = T.spot(board, step.to[0], step.to[1]);
      else if (step.kind === 'bump') {
        const [dx, dy] = T_DIRS[step.dir];
        step.target = step.from.clone().addScaledVector(T_RIGHT, dx * cell * .22).addScaledVector(T_UP, dy * cell * .22);
      } else step.target = step.from;
      const dx = step.target.x - step.from.x, dz = step.target.z - step.from.z;
      if (dx || dz) body.face = Math.atan2(dx, dz);
    }
    T.anim = { t: 0, steps, done };
  };
  T.tick = dt => {
    const anim = T.anim;
    if (!anim) return;
    anim.t = Math.min(1, anim.t + dt / .2);
    const t = anim.t, arc = Math.sin(t * Math.PI);
    for (const step of anim.steps) {
      const body = step.body;
      if (step.kind === 'hop') {
        body.x = mix(step.from.x, step.target.x, t);
        body.z = mix(step.from.z, step.target.z, t);
        body.y = T.top + arc * .34;
        body.vx = (step.target.x - step.from.x) * 3;
        body.vz = (step.target.z - step.from.z) * 3;
      } else if (step.kind === 'bump') {
        body.x = mix(step.from.x, step.target.x, arc);
        body.z = mix(step.from.z, step.target.z, arc);
        body.y = T.top + arc * .08;
      } else body.squash = -.16 * arc;
    }
    if (t < 1) return;
    for (const step of anim.steps) {
      const body = step.body;
      body.vx = body.vz = 0;
      body.y = T.top;
      if (step.kind === 'hop') {
        body.cell = step.to;
        if (step.board) body.board = step.board;
        body.squash = -.14;
      } else { body.x = step.from.x; body.z = step.from.z; }
    }
    T.anim = null;
    anim.done?.();
  };
  // Direção pedida pelo teclado ou pela alavanca: 'U', 'D', 'L', 'R' ou ''.
  // Devolve uma vez por toque; segurando, repete devagar.
  T.readDir = dt => {
    // um passo guardado (toque rápido numa seta, deslizar o dedo, tecla): vale mesmo se veio durante o pulo anterior
    if (input.step) { const dir = input.step; input.step = ''; T.held = dir; T.holdTime = 0; return dir; }
    let ix = input.sx, iy = input.sy;
    if (input.keys.has('left')) ix -= 1;
    if (input.keys.has('right')) ix += 1;
    if (input.keys.has('up')) iy += 1;
    if (input.keys.has('down')) iy -= 1;
    let dir = '';
    if (Math.abs(ix) > .5 || Math.abs(iy) > .5) {
      if (Math.abs(ix) > Math.abs(iy) + .15) dir = ix > 0 ? 'R' : 'L';
      else if (Math.abs(iy) > Math.abs(ix) + .15) dir = iy > 0 ? 'U' : 'D';
    }
    if (!dir) { T.held = ''; T.holdTime = 0; return ''; }
    if (dir !== T.held) { T.held = dir; T.holdTime = 0; return dir; }
    T.holdTime += dt;
    if (T.holdTime > .32) { T.holdTime = .08; return dir; }
    return '';
  };
  T.layout();
  L.tiles = T;
  return T;
}
const mini = $('cm-mini');
const kit = {
  THREE, D, stage, camera, bodies, people, input, album, reduceMotion, touchDevice,
  GEO, SYMBOLS, BLOOMS, PROPS, FACE_CAMERA, CAM_DIR,
  part, mat, flat, tone, glowMat, own, slab, shade, glow, decal, ink, clamp, seeded, el, discard, textTexture,
  makeIsland, makeFlower, makePolaroid, makePlate,
  level: () => level, active: () => active, state: () => state, clock: () => clock,
  say, chime, burst, dust, heart, puff, puffTexture,
  tiles: makeTiles,
  // O Rafo ganha a próxima flor da fase (mostra a próxima frase de caminho-data.js).
  flower(x, y, z) {
    const line = D.fases[level.index].flores[level.gotFlowers] || '';
    level.gotFlowers++;
    addBloom(people.rafo, BLOOMS[(level.gotFlowers - 1) % BLOOMS.length]);
    bodies[0].cheer = 1;
    burst(x, y + .8, z);
    chime([[523.25, 659.25], [587.33, 783.99], [659.25, 1046.5]][(level.gotFlowers - 1) % 3]);
    if (line) say(line, Math.max(5200, line.length * 75));
    updateHud();
  },
  // A Lulu ganha a próxima foto da fase (abre o cartão da foto, que pausa o jogo).
  photo(x, y, z, id = D.fases[level.index].fotos[level.gotPhotos]) {
    level.gotPhotos++;
    if (id) {
      level.gotPhotoIds.push(id);
      if (!save.fotos.includes(id)) { save.fotos.push(id); writeSave(); }
    }
    addSnapshot(people.lulu);
    bodies[1].cheer = 1;
    burst(x, y + 1, z, 22);
    chime([659.25, 783.99, 1046.5], .09);
    updateHud();
    if (id) showPhoto(id);
  },
  // Fim da fase: os dois vão um até o outro e aparece o cartão de fim.
  finish() { if (state === 'play') startMeeting(); },
  hud: () => updateHud(),
  // Camada de HTML por cima do jogo, para quebra-cabeças de arrastar.
  mini: {
    open(node) { mini.replaceChildren(node); mini.hidden = false; stage.classList.add('is-mini'); },
    close() { mini.hidden = true; mini.replaceChildren(); stage.classList.remove('is-mini'); }
  }
};
// Se o arquivo de um modo não carregou, a fase não trava: avisa e segue adiante.
const missingMode = name => () => {
  let time = 0;
  return {
    setup(L) {
      const T = makeTiles(L, [{ id: 'meio', cols: 4, rows: 2 }]);
      T.place(bodies[0], T.boards.meio, 0, 0);
      T.place(bodies[1], T.boards.meio, 3, 0);
      console.warn(`Modo "${name}" não encontrado: confira o <script> de caminho-modo-${name}.js.`);
    },
    step(dt) {
      time += dt;
      if (time > .8 && time - dt <= .8) say('essa fase ainda está sendo feita…', 2600);
      if (time > 3) kit.finish();
    }
  };
};

// ---------- Física ----------
const allDone = () => !level.glued && level.gotFlowers === level.flowers.length && level.gotPhotos === level.photos.length && level.plates.every(plate => plate.locked);
function showBridge(bridge) {
  if (bridge.shown) return;
  bridge.shown = true;
  cut = 2.3;
  cutAt.set(bridge.x, .6, bridge.z);
}
function moveBlocks(dt) {
  for (const crate of level.crates) {
    const block = crate.block;
    let x = block.x, z = block.z;
    if (crate.slide) {
      crate.slide.t = Math.min(1, crate.slide.t + dt / .22);
      const k = crate.slide.t;
      x = crate.slide.fx + (block.x - crate.slide.fx) * k;
      z = crate.slide.fz + (block.z - crate.slide.fz) * k;
      if (k === 1) { crate.slide = null; crate.bump = .14; landCrate(crate); }
    }
    block.mx = x - block.px; block.mz = z - block.pz;
    block.px = x; block.pz = z;
    crate.shake = Math.max(0, crate.shake - dt);
    crate.lean += ((crate.slide ? .09 : 0) - crate.lean) * Math.min(1, dt * 14);
    crate.bump = Math.max(0, crate.bump - dt * .7);
    crate.mesh.position.set(x, crate.base, z);
    crate.mesh.rotation.set(crate.dirZ * crate.lean, 0, -crate.dirX * crate.lean + (crate.shake ? Math.sin(crate.shake * 60) * .05 : 0));
    crate.mesh.scale.set(1 + crate.bump * .5, 1 - crate.bump, 1 + crate.bump * .5);
  }
  // botões redondos: ficam apertados enquanto alguém (ou uma caixa) está em cima
  for (const button of level.buttons) {
    let pressed = false;
    for (const body of bodies) if (body.ground && Math.abs(body.x - button.x) < .62 && Math.abs(body.z - button.z) < .62 && Math.abs(body.y - button.y) < .15) pressed = true;
    for (const crate of level.crates) if (!crate.slide && Math.abs(crate.block.x - button.x) < .2 && Math.abs(crate.block.z - button.z) < .2 && Math.abs(crate.base - button.y) < .1) pressed = true;
    button.hold = pressed ? .3 : Math.max(0, button.hold - dt);
    const on = button.hold > 0;
    if (on && !button.on) {
      chime([392, 523.25], .07, .08);
      const bridge = level.bridges[button.bridge];
      if (!bridge.shown) { say(D.recados.botao, 3600); showBridge(bridge); }
    }
    button.on = on;
    const data = button.mesh.userData;
    data.cap.position.y += ((on ? .04 : .085) - data.cap.position.y) * Math.min(1, dt * 18);
    data.cap.material.emissiveIntensity = on ? .7 : .1;
    data.halo.material.opacity += ((on ? .5 : 0) - data.halo.material.opacity) * Math.min(1, dt * 8);
  }
  for (const bridge of Object.values(level.bridges)) {
    const want = bridge.locked || level.buttons.some(button => button.on && level.bridges[button.bridge] === bridge);
    bridge.k = clamp(bridge.k + (want ? dt : -dt) / .9, 0, 1);
    const data = bridge.mesh.userData, count = data.planks.length;
    data.planks.forEach((plank, i) => {
      const k = clamp(bridge.k * (1 + count * .12) - i * .12, 0, 1);
      plank.visible = k > 0;
      plank.position.y = -(1 - k * (2 - k)) * 2.6;
    });
    data.ghost.visible = bridge.k < .05;
    bridge.solid = bridge.k > .8;
  }
}
function landCrate(crate) {
  const block = crate.block;
  dust(block.x, crate.base, block.z);
  chime([147], .05, .06, 'sine');
  if (!crate.owner) return;
  const plate = level.plates.find(item => !item.locked && item.owner === crate.owner && Math.abs(block.x - item.x) < .1 && Math.abs(block.z - item.z) < .1);
  if (!plate) return;
  plate.locked = crate.locked = true;
  const bridge = level.bridges[plate.bridge];
  bridge.locked = true;
  plate.mesh.userData.halo.material.opacity = .55;
  plate.mesh.userData.symbol.material.opacity = 1;
  burst(block.x, 1, block.z, 26);
  chime([523.25, 659.25, 783.99, 1046.5], .1, .12);
  say(crate.owner === 'rafo' ? D.recados.caixaRafo : D.recados.caixaLulu, 4200);
  showBridge(bridge);
  bodies[crate.owner === 'rafo' ? 0 : 1].cheer = 1;
  updateHud();
}
function tryPush(crate, axis, dir, pusher) {
  if (crate.locked || crate.slide) return false;
  const block = crate.block, floor = crate.floor;
  const nx = block.x + (axis === 'x' ? dir : 0), nz = block.z + (axis === 'z' ? dir : 0);
  // fica sempre a um passo da beirada, para dar para dar a volta e empurrar de novo
  let free = !!floor && Math.abs(nx - floor.x) <= floor.w / 2 - 1 + .01 && Math.abs(nz - floor.z) <= floor.d / 2 - 1 + .01;
  for (const item of level.blocks) {
    if (!free) break;
    if (item === block || item.kind === 'floor' || item.kind === 'bridge') continue;
    if (Math.abs(nx - item.px) < .45 + item.w / 2 - .02 && Math.abs(nz - item.pz) < .45 + item.d / 2 - .02) free = false;
  }
  for (const body of bodies)
    if (body !== pusher && body.y < crate.base + .8 && Math.abs(body.x - nx) < .45 + R && Math.abs(body.z - nz) < .45 + R) free = false;
  if (!free) {
    if (!crate.shake) { crate.shake = .25; say(D.recados.caixaPresa, 1800); chime([110], .05, .05, 'sine'); }
    pusher.noStick = clock + .8; // solta da caixa, para dar para contornar
    return false;
  }
  crate.slide = { fx: block.x, fz: block.z, t: 0 };
  crate.dirX = axis === 'x' ? dir : 0;
  crate.dirZ = axis === 'z' ? dir : 0;
  dust(block.x - crate.dirX * .5, crate.base, block.z - crate.dirZ * .5);
  block.x = nx; block.z = nz;
  chime([196], .05, .05, 'sine');
  return true;
}
function collideSide(body, axis, wantX, wantZ) {
  const cross = axis === 'x' ? 'z' : 'x';
  for (const block of level.blocks) {
    if (!block.solid) continue;
    const half = (axis === 'x' ? block.w : block.d) / 2 + R;
    const halfCross = (axis === 'x' ? block.d : block.w) / 2 + R - .02;
    const centre = axis === 'x' ? block.px : block.pz;
    const centreCross = axis === 'x' ? block.pz : block.px;
    if (Math.abs(body[cross] - centreCross) >= halfCross || Math.abs(body[axis] - centre) >= half) continue;
    if (body.y >= block.py - .02 || body.y + H <= block.py - block.th + .02) continue;
    if (block.py - body.y <= .34 && body.vy <= .5) { body.y = block.py; body.vy = 0; continue; } // degrauzinho
    const sign = body[axis] >= centre ? 1 : -1;
    body[axis] = centre + sign * half;
    body[axis === 'x' ? 'vx' : 'vz'] = 0;
    const want = axis === 'x' ? wantX : wantZ;
    if (block.crate && !block.crate.locked && clock >= body.noStick && body.ground && -sign * want > .5 && Math.abs(body[cross] - centreCross) < .52)
      body.pushNow = { crate: block.crate, axis, dir: -sign };
  }
}
function stepBody(body, dt, controlled) {
  if (body.frozen > 0) { body.frozen -= dt; return; }
  if (body.ground?.solid) { body.x += body.ground.mx; body.z += body.ground.mz; }

  // direção na tela -> direção no chão (câmera isométrica)
  let ix = 0, iy = 0;
  if (controlled) {
    ix = input.sx; iy = input.sy;
    if (input.keys.has('left')) ix -= 1;
    if (input.keys.has('right')) ix += 1;
    if (input.keys.has('up')) iy += 1;
    if (input.keys.has('down')) iy -= 1;
    const length = Math.hypot(ix, iy);
    if (length > 1) { ix /= length; iy /= length; }
  }
  let wantX = (ix - iy) * Math.SQRT1_2, wantZ = (-ix - iy) * Math.SQRT1_2;
  // encostado numa caixa, empurra reto em vez de escorregar para o lado
  if (body.pushLast) { if (body.pushLast.axis === 'x') wantZ *= .1; else wantX *= .1; }
  const SPEED = 3.5; // velocidade de andar (era 4.2)
  const rate = Math.min(1, (body.ground ? 16 : 8) * dt);
  body.vx += (wantX * SPEED - body.vx) * rate;
  body.vz += (wantZ * SPEED - body.vz) * rate;

  body.coyote = body.ground ? .1 : body.coyote - dt;
  body.buffer -= dt;
  if (controlled && body.buffer > 0 && body.coyote > 0) {
    body.vy = 7.6;
    body.coyote = 0; body.buffer = 0; body.ground = null; body.squash = .22;
    chime([330, 440], .04, .035, 'sine');
  }

  body.pushNow = null;
  body.x += body.vx * dt; collideSide(body, 'x', wantX, wantZ);
  body.z += body.vz * dt; collideSide(body, 'z', wantX, wantZ);
  const push = body.pushNow, lastPush = body.pushLast;
  if (push && lastPush && push.crate === lastPush.crate && push.axis === lastPush.axis && push.dir === lastPush.dir) body.pushTime += dt;
  else body.pushTime = 0;
  body.pushLast = push;
  if (push) {
    body.pushedAt = clock;
    body.face = Math.atan2(push.axis === 'x' ? push.dir : 0, push.axis === 'z' ? push.dir : 0);
    // quem já vem empurrando continua sem esperar de novo
    if (body.pushTime > (clock - body.pushStreak < .6 ? .03 : .16)) {
      body.pushTime = 0;
      if (tryPush(push.crate, push.axis, push.dir, body)) body.pushStreak = clock;
    }
  }
  if (body.pushLast?.crate.slide || (clock - body.pushStreak < .3 && level.crates.some(crate => crate.slide))) body.pushedAt = clock;

  const before = body.y;
  body.vy = Math.max(-20, body.vy - level.gravity * dt);
  body.y += body.vy * dt;
  let ground = null;
  for (const block of level.blocks) {
    if (!block.solid) continue;
    if (Math.abs(body.x - block.px) >= block.w / 2 + R - .04 || Math.abs(body.z - block.pz) >= block.d / 2 + R - .04) continue;
    const top = block.py, bottom = top - block.th;
    if (body.vy <= 0 && before >= top - .36 && body.y <= top) {
      if (!ground || top > ground.py) ground = block;
    } else if (body.vy > 0 && before + H <= bottom + .12 && body.y + H > bottom) {
      body.y = bottom - H; body.vy = 0;
    }
  }
  if (ground) {
    if (!body.ground && body.vy < -5) { body.squash = -.24; dust(body.x, ground.py, body.z); }
    body.y = ground.py; body.vy = 0;
    body.lastGroundY = ground.py;
    if (ground.kind === 'floor') body.spawn = { x: clamp(body.x, ground.x - ground.w / 2 + .8, ground.x + ground.w / 2 - .8), y: ground.y, z: clamp(body.z, ground.z - ground.d / 2 + .8, ground.z + ground.d / 2 - .8) };
  }
  body.ground = ground;

  if (body.y < -9) {
    body.falls++;
    Object.assign(body, { x: body.spawn.x, y: body.spawn.y + 1.4, z: body.spawn.z, vx: 0, vy: 0, vz: 0, ground: null, frozen: .3 });
    if (controlled) {
      fade.classList.remove('is-flash');
      void fade.offsetWidth;
      fade.classList.add('is-flash');
      say(D.recados.caiu[(body.falls - 1) % D.recados.caiu.length], 2600);
    }
  }
}
function step(dt) {
  if (level.mode) { level.tiles?.tick(dt); level.mode.step?.(dt); return; }
  moveBlocks(dt);
  if (cut > 0) {
    cut -= dt;
    if (cut <= 0 && pendingSwitch) { pendingSwitch = false; switchPlayer(); }
    return;
  }
  bodies.forEach((body, i) => stepBody(body, dt, i === active));
  collect();
}

function collect() {
  const [rafo, lulu] = bodies;
  const story = D.fases[level.index];
  const near = (body, thing, reach) => Math.hypot(body.x - thing.x, body.z - thing.z) < reach && Math.abs(body.y - thing.y) < 1.3;
  const hint = text => { if (clock - level.hintAt > 3.5) { level.hintAt = clock; say(text, 2600); } };
  for (const flower of level.flowers) {
    if (flower.taken) continue;
    if (near(lulu, flower, .7) && active === 1 && !level.glued) hint(D.recados.florDoRafo);
    if (!near(rafo, flower, .8)) continue;
    flower.taken = true;
    const line = story.flores[level.gotFlowers] || '';
    level.gotFlowers++;
    addBloom(people.rafo, flower.color);
    rafo.cheer = 1;
    burst(flower.x, flower.y + .8, flower.z);
    chime([[523.25, 659.25], [587.33, 783.99], [659.25, 1046.5]][(level.gotFlowers - 1) % 3]);
    if (line) say(line, Math.max(5200, line.length * 75));
    updateHud();
  }
  for (const photo of level.photos) {
    if (photo.taken) continue;
    if (near(rafo, photo, .7) && active === 0 && !level.glued) hint(D.recados.fotoDaLulu);
    if (!near(lulu, photo, .85)) continue;
    photo.taken = true;
    level.gotPhotos++;
    level.gotPhotoIds.push(photo.id);
    if (!save.fotos.includes(photo.id)) { save.fotos.push(photo.id); writeSave(); }
    addSnapshot(people.lulu);
    lulu.cheer = 1;
    burst(photo.x, photo.y + 1, photo.z, 22);
    chime([659.25, 783.99, 1046.5], .09);
    updateHud();
    showPhoto(photo.id);
    return;
  }
  // o encontro
  const onMeet = bodies.map(body => body.ground === level.meet);
  if (onMeet[0] && onMeet[1] && allDone() && state === 'play') return startMeeting();
  if (onMeet[active]) {
    if (!allDone()) hint(D.recados.faltaAlgo);
    else if (!onMeet[1 - active]) hint(active === 0 ? D.recados.tragaLulu : D.recados.tragaRafo);
  }
}

// ---------- Tela: legenda, missões e cartões ----------
let captionTimer = 0;
function say(text, duration = 4000) {
  clearTimeout(captionTimer);
  if (!hud.hidden) {
    // no celular o recado fica logo abaixo do quadro de missões, que muda de altura a cada fase
    const box = hud.querySelector('.cm-missions').getBoundingClientRect();
    stage.style.setProperty('--cm-hud-end', Math.round(box.bottom - stage.getBoundingClientRect().top) + 'px');
  }
  caption.textContent = text;
  caption.classList.add('is-on');
  captionTimer = setTimeout(() => caption.classList.remove('is-on'), duration);
}
function updateHud() {
  if (!level) return;
  const who = bodies[active].who;
  $('cm-phase').textContent = `fase ${level.index + 1}/${LEVELS.length}`;
  const first = $('cm-m1'), second = $('cm-m2');
  stage.classList.toggle('is-glued', level.glued);
  if (level.mode) {
    // fase de quebra-cabeça: o modo diz o que mostrar
    const info = level.mode.hud?.() || {};
    const total = D.fases[level.index];
    const lines = info.lines || [{ text: `✿ ${level.gotFlowers}/${total.flores.length} · ▢ ${level.gotPhotos}/${total.fotos.length}` }];
    $('cm-name').textContent = info.name || (level.glued ? `${D.rafo.nome} + ${D.lulu.nome}` : D[who].nome);
    hud.dataset.who = level.glued ? 'juntos' : who;
    [first, second].forEach((node, i) => {
      node.textContent = lines[i]?.text || '';
      node.classList.toggle('is-done', !!lines[i]?.done);
      node.hidden = !lines[i];
    });
    switchButton.textContent = who === 'rafo' ? `jogar com a ${D.lulu.nome} ⇄` : `jogar com o ${D.rafo.nome} ⇄`;
    swapLabel(D[other(who)].nome);
    return;
  }
  first.hidden = false;
  $('cm-name').textContent = D[who].nome;
  hud.dataset.who = who;
  const got = who === 'rafo' ? level.gotFlowers : level.gotPhotos;
  const total = who === 'rafo' ? level.flowers.length : level.photos.length;
  first.textContent = `${who === 'rafo' ? '✿ flores' : '▢ fotos'} ${got}/${total}`;
  first.classList.toggle('is-done', got === total);
  const plates = level.plates.filter(plate => plate.owner === who);
  const locked = plates.filter(plate => plate.locked).length;
  second.textContent = `${who === 'rafo' ? '♥' : '✦'} caixa na marca${locked === plates.length ? ' ✓' : ''}`;
  second.classList.toggle('is-done', locked === plates.length);
  second.hidden = !plates.length;
  switchButton.textContent = who === 'rafo' ? `jogar com a ${D.lulu.nome} ⇄` : `jogar com o ${D.rafo.nome} ⇄`;
  swapLabel(D[other(who)].nome);
}
let pendingSwitch = false;
// Botão de trocar (celular): diz "trocar" e para quem.
function swapLabel(name) {
  if (swapButton.dataset.name === name) return;
  swapButton.dataset.name = name;
  swapButton.replaceChildren(el('small', '', 'trocar'), el('b', '', name));
  swapButton.setAttribute('aria-label', `Trocar para ${name}`);
}
function switchPlayer() {
  if (state !== 'play') return;
  if (level.glued) return say(D.recados.grudados, 2600);
  if (cut > 0) { pendingSwitch = true; return; } // a câmera está mostrando uma ponte: troca quando ela voltar
  active = 1 - active;
  const body = bodies[active];
  body.squash = .2;
  body.cheer = .7;
  input.keys.clear();
  chime([active ? 880 : 659.25, active ? 1046.5 : 783.99], .06, .06);
  level.mode?.switched?.(active);
  updateHud();
}
function polaroid(id, small) {
  const page = album.get(id);
  const figure = el('figure', small ? 'cm-polaroid is-small' : 'cm-polaroid');
  const image = el('img');
  image.src = page?.src || '';
  image.alt = page?.alt || '';
  image.decoding = 'async';
  figure.append(image);
  if (!small) figure.append(el('figcaption', '', page?.note || ''));
  return figure;
}
function showCard({ kind = '', eyebrow, title, text, extra = [], buttons = [] }) {
  if (state !== 'title') state = 'card';
  input.keys.clear();
  releaseStick();
  card.className = 'cm-card' + (kind ? ' is-' + kind : '');
  const nodes = [];
  if (eyebrow) nodes.push(el('p', 'eyebrow', eyebrow));
  if (title) nodes.push(el('h2', '', title));
  if (text) nodes.push(el('p', 'cm-card-text', text));
  nodes.push(...extra);
  const row = el('div', 'cm-actions');
  buttons.forEach((button, i) => {
    const node = el('button', i ? 'cm-button is-quiet' : 'cm-button', button.label);
    node.type = 'button';
    node.addEventListener('click', button.run);
    row.append(node);
  });
  nodes.push(row);
  card.replaceChildren(...nodes);
  card.hidden = false;
  stage.classList.remove('is-playing');
  card.scrollTop = 0;
  row.firstElementChild?.focus({ preventScroll: true });
}
function play() {
  card.hidden = true;
  hud.hidden = false;
  stage.classList.add('is-playing');
  state = 'play';
  canvas.focus({ preventScroll: true });
}
// Legenda dos controles da fase atual (aparece no começo de cada fase e na pausa).
// Um modo pode trocar a lista inteira com "controls" ([[tecla, o que faz], ...] ou
// uma função que recebe true no celular) ou só dizer o que o botão de pular faz ("actionLabel").
function controlsLegend() {
  const mode = level?.mode;
  let rows = typeof mode?.controls === 'function' ? mode.controls(touchDevice) : mode?.controls;
  if (!rows) {
    rows = [];
    if (touchDevice) {
      if (mode) rows.push(['setas na tela', 'andar: um toque, uma casa'], ['deslizar o dedo', 'também anda uma casa']);
      else rows.push(['alavanca', 'andar']);
      if (!mode) rows.push(['pular', 'pular'], ['andar contra a caixa', 'empurrar']);
      else if (mode.actionLabel) rows.push(['pular', mode.actionLabel]);
      if (!level?.glued) rows.push([`botão ${D.lulu.nome} / ${D.rafo.nome}`, 'trocar de personagem']);
    } else {
      rows.push(['setas ou WASD', mode ? 'andar: um toque, uma casa' : 'andar']);
      if (!mode) rows.push(['espaço', 'pular'], ['andar contra a caixa', 'empurrar']);
      else if (mode.actionLabel) rows.push(['espaço', mode.actionLabel]);
      if (!level?.glued) rows.push(['Tab ou Q', 'trocar de personagem']);
    }
    if (level?.glued) rows.push(['grudadinhos', 'um comando move os dois']);
    if (mode?.extraControls) rows.push(...mode.extraControls);
  }
  if (!touchDevice) rows.push(['Esc ou P', 'pausa']);
  const list = el('dl', 'cm-keys');
  list.setAttribute('aria-label', 'Controles');
  for (const [key, text] of rows) list.append(el('dt', '', key), el('dd', '', text));
  return list;
}
function showTitle() {
  state = 'title';
  hud.hidden = true;
  const missions = el('ul', 'cm-list');
  missions.append(
    el('li', '', `${D.rafo.nome} colhe as flores. ${D.lulu.nome} acha as fotos.`),
    el('li', '', 'Cada um empurra a sua caixa até a marca: ela ergue a ponte do outro.'),
    el('li', '', 'No fim, os dois se encontram no meio.')
  );
  const help = el('p', 'cm-help', touchDevice
    ? 'arraste o dedo do lado esquerdo para andar · botões à direita para pular e trocar de personagem · ande contra a caixa para empurrar'
    : 'setas ou WASD para andar · espaço para pular · Tab troca de personagem · ande contra a caixa para empurrar');
  const extra = [missions, help];
  {
    // todas as fases ficam liberadas desde o começo; as já vencidas aparecem marcadas
    const picker = el('div', 'cm-chapters');
    picker.setAttribute('role', 'group');
    picker.setAttribute('aria-label', 'Escolher fase');
    for (let i = 0; i < LEVELS.length; i++) {
      const chip = el('button', i < save.fase ? 'cm-chip is-won' : 'cm-chip', String(i + 1));
      chip.type = 'button';
      chip.title = D.fases[i].nome;
      chip.setAttribute('aria-label', `Fase ${i + 1}: ${D.fases[i].nome}${i < save.fase ? ' (já vencida)' : ''}`);
      chip.addEventListener('click', () => begin(i));
      picker.append(chip);
    }
    extra.push(el('p', 'cm-chapters-label', 'ou escolha uma fase'), picker);
  }
  const resume = Math.min(save.fase, LEVELS.length - 1);
  const buttons = save.fase > 0 && save.fase < LEVELS.length
    ? [{ label: `continuar · fase ${resume + 1} ☾`, run: () => begin(resume) }, { label: 'do início', run: () => begin(0) }]
    : [{ label: save.fase ? 'jogar de novo ☾' : 'começar ☾', run: () => begin(0) }];
  showCard({ kind: 'title', eyebrow: 'UM JOGUINHO PRA LULU', title: D.titulo + '.', text: D.abertura, extra, buttons });
}
function begin(index) {
  if (window.innerWidth < 760 || touchDevice) setFull(true);
  startMusic();
  startPhase(index);
}
function startPhase(index) {
  buildLevel(index);
  resize();
  hud.hidden = true;
  const story = D.fases[index];
  caption.classList.remove('is-on');
  showCard({
    kind: 'chapter', eyebrow: `FASE ${index + 1} DE ${LEVELS.length}`, title: story.nome + '.', text: story.abre,
    extra: [...(story.dica ? [el('p', 'cm-help', story.dica)] : []), controlsLegend()],
    buttons: [{ label: 'vamos ☾', run: () => { play(); say(level.mode?.hello || D.recados.comeca, 3200); } }]
  });
}
function showPhoto(id) {
  const page = album.get(id);
  showCard({
    kind: 'photo', eyebrow: 'UMA FOTO NOSSA',
    extra: [polaroid(id), el('p', 'cm-card-text', page?.caption || '')],
    buttons: [{ label: 'guardar ♡', run: play }]
  });
}
let meetTime = 0;
function startMeeting() {
  state = 'ending';
  meetTime = 0;
  input.keys.clear();
  releaseStick();
  stage.classList.remove('is-playing');
  hud.hidden = true;
  for (const body of bodies) body.vx = body.vz = 0;
  save.fase = Math.max(save.fase, level.index + 1);
  writeSave();
  chime([523.25, 659.25, 783.99, 1046.5, 1318.5], .14, .12);
  caption.classList.remove('is-on');
}
function tickMeeting(dt) {
  const before = meetTime;
  meetTime += dt;
  const last = level.index === LEVELS.length - 1;
  const [rafo, lulu] = bodies;
  // chegam pertinho um do outro
  const dx = lulu.x - rafo.x, dz = lulu.z - rafo.z, gap = Math.hypot(dx, dz) || 1;
  const walking = gap > .72;
  if (walking) {
    const move = Math.min((gap - .72) / 2, dt * 1.6);
    rafo.x += dx / gap * move; rafo.z += dz / gap * move;
    lulu.x -= dx / gap * move; lulu.z -= dz / gap * move;
    rafo.walk += dt * 9; lulu.walk += dt * 9;
  }
  rafo.vx = lulu.vx = walking ? 2.4 : 0;
  rafo.vz = lulu.vz = 0;
  const toLulu = Math.atan2(dx, dz);
  rafo.face = turn(rafo.face, toLulu, dt * 7);
  lulu.face = turn(lulu.face, toLulu + Math.PI, dt * 7);
  if (last && before < 1.3 && meetTime >= 1.3) {
    // o Rafo entrega o buquê
    const hand = people.rafo.userData.hand;
    people.lulu.userData.arms[0].add(hand);
    hand.position.set(-.02, -.27, .07);
    burst((rafo.x + lulu.x) / 2, 1.2, (rafo.z + lulu.z) / 2, 36);
  }
  if (before < 1 && meetTime >= 1) { rafo.cheer = lulu.cheer = 1.6; rafo.squash = lulu.squash = .2; }
  if (meetTime > 1 && meetTime < (last ? 4 : 2.6) && Math.floor(before * 5) !== Math.floor(meetTime * 5) && !reduceMotion)
    heart((rafo.x + lulu.x) / 2, 1.6, (rafo.z + lulu.z) / 2);
  const end = last ? 4.2 : 2.9;
  if (before < end && meetTime >= end) last ? showEnding() : showPhaseEnd();
}
function showPhaseEnd() {
  const story = D.fases[level.index];
  const strip = el('div', 'cm-strip');
  level.gotPhotoIds.forEach(id => strip.append(polaroid(id, true)));
  const next = level.index + 1;
  showCard({
    kind: 'done', eyebrow: `FIM DA FASE ${level.index + 1}`, title: story.nome + '.', text: story.fecha,
    extra: [el('p', 'cm-tally', `✿ ${D.fases.slice(0, level.index + 1).reduce((sum, fase) => sum + fase.flores.length, 0)} flores no buquê · ▢ ${save.fotos.length} fotos guardadas`), strip],
    buttons: [{ label: 'próxima fase ☾', run: () => startPhase(next) }]
  });
}
function showEnding() {
  const extra = [];
  const hug = window.SITE_CONFIG?.fotos?.nosDois;
  if (hug) {
    const figure = el('figure', 'cm-polaroid is-hug');
    const image = el('img');
    image.src = hug;
    image.alt = 'Ilustração de Lulu e Rafo abraçadinhos, com flores ao luar.';
    figure.append(image);
    extra.push(figure);
  }
  const strip = el('div', 'cm-strip');
  save.fotos.forEach(id => strip.append(polaroid(id, true)));
  extra.push(strip, el('p', 'cm-who handwritten', D.final.recado));
  showCard({
    kind: 'ending', eyebrow: 'A LUA / PARA A LULU', title: D.final.titulo, text: D.final.texto, extra,
    buttons: [
      { label: 'jogar de novo', run: () => { setFull(false); buildLevel(0); showTitle(); } }
    ]
  });
}
function pause() {
  if (state !== 'play') return;
  const index = level.index;
  showCard({
    kind: 'pause', eyebrow: 'PAUSA', title: 'um respiro.', text: 'Eu espero o tempo que for.',
    extra: [controlsLegend()],
    buttons: [
      { label: 'continuar ☾', run: play },
      { label: 'recomeçar a fase', run: () => { buildLevel(index); play(); } },
      { label: 'sair do jogo', run: () => { setFull(false); buildLevel(index); showTitle(); } }
    ]
  });
}
function setFull(on) {
  stage.classList.toggle('is-full', on);
  document.documentElement.classList.toggle('cm-lock', on);
  $('cm-full').textContent = touchDevice ? 'tela' : (on ? 'tela menor' : 'tela cheia');
  $('cm-full').setAttribute('aria-label', on ? 'sair da tela cheia' : 'tela cheia');
  fitFull();
}
// Em tela cheia o palco acompanha a área realmente visível. No Safari do iPhone as
// barras do navegador (e o zoom da página) mudam essa área, e só o CSS deixava o jogo cortado.
function fitFull() {
  const view = window.visualViewport;
  if (stage.classList.contains('is-full') && view) {
    Object.assign(stage.style, { left: view.offsetLeft + 'px', top: view.offsetTop + 'px', width: view.width + 'px', height: view.height + 'px' });
  } else stage.style.left = stage.style.top = stage.style.width = stage.style.height = '';
  resize();
}
window.visualViewport?.addEventListener('resize', fitFull);
window.visualViewport?.addEventListener('scroll', fitFull);
window.addEventListener('orientationchange', () => setTimeout(fitFull, 300));
// O Safari do iPhone dá zoom com dois dedos mesmo em jogo: aqui não.
stage.addEventListener('gesturestart', event => event.preventDefault());

// ---------- Controles ----------
const KEYS = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down' };
const locked = () => document.documentElement.classList.contains('site-locked');
window.addEventListener('keydown', event => {
  if (locked() || event.ctrlKey || event.metaKey || event.altKey || state !== 'play') return;
  const key = event.key.toLowerCase();
  if (KEYS[key]) {
    input.keys.add(KEYS[key]);
    if (level?.tiles && !event.repeat) input.step = STEP_OF[KEYS[key]];
    event.preventDefault();
  }
  else if (event.code === 'Space') { if (!event.repeat) jump(); event.preventDefault(); }
  else if (key === 'tab' || key === 'q' || key === 'e' || key === 'shift') { if (!event.repeat) switchPlayer(); event.preventDefault(); }
  else if (key === 'escape' || key === 'p') pause();
});
window.addEventListener('keyup', event => { input.keys.delete(KEYS[event.key.toLowerCase()]); });
window.addEventListener('blur', () => { input.keys.clear(); releaseStick(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

const STEP_OF = { up: 'U', down: 'D', left: 'L', right: 'R' };
const dpad = $('cm-dpad');
function releaseStick() {
  input.stick = null;
  input.swipe = null;
  input.step = '';
  input.sx = input.sy = 0;
  for (const button of dpad.children) button.classList.remove('is-down');
  stickEl.classList.remove('is-on');
  stickEl.style.left = stickEl.style.top = '';
  stickEl.style.setProperty('--kx', '0px');
  stickEl.style.setProperty('--ky', '0px');
}
function jump() {
  if (state !== 'play') return;
  if (level.mode) return level.mode.action ? level.mode.action(bodies[active]) : say(D.recados.semPulo, 2200);
  bodies[active].buffer = .15;
  jumpButton.classList.remove('is-tap');
  void jumpButton.offsetWidth;
  jumpButton.classList.add('is-tap');
}
canvas.addEventListener('pointerdown', event => {
  if (state !== 'play' || event.pointerType === 'mouse') return;
  event.preventDefault();
  touchEl.hidden = false;
  stage.classList.add('is-touch');
  const box = stage.getBoundingClientRect();
  if (level?.tiles) {
    // tabuleiro: deslizar o dedo em qualquer lugar anda uma casa; um toque parado, do lado direito, é o botão de ação
    if (!input.swipe) {
      input.swipe = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, right: event.clientX - box.left >= box.width * .55 };
      try { canvas.setPointerCapture(event.pointerId); } catch {}
    }
    return;
  }
  if (event.clientX - box.left < box.width * .55 && !input.stick) {
    input.stick = { id: event.pointerId, x: event.clientX, y: event.clientY };
    stickEl.style.left = event.clientX - box.left + 'px';
    stickEl.style.top = event.clientY - box.top + 'px';
    stickEl.classList.add('is-on');
    try { canvas.setPointerCapture(event.pointerId); } catch {}
  } else jump();
});
canvas.addEventListener('pointermove', event => {
  const swipe = input.swipe;
  if (swipe && event.pointerId === swipe.id) {
    const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y;
    const far = swipe.moved ? 44 : 26; // o primeiro passo sai logo; os seguintes, a cada 44 px
    if (Math.abs(dx) > far && Math.abs(dx) > Math.abs(dy) * 1.3) input.step = dx > 0 ? 'R' : 'L';
    else if (Math.abs(dy) > far && Math.abs(dy) > Math.abs(dx) * 1.3) input.step = dy > 0 ? 'D' : 'U';
    else return;
    Object.assign(swipe, { x: event.clientX, y: event.clientY, moved: true });
    return;
  }
  if (!input.stick || event.pointerId !== input.stick.id) return;
  const reach = 48;
  let dx = (event.clientX - input.stick.x) / reach, dy = (event.clientY - input.stick.y) / reach;
  const length = Math.hypot(dx, dy);
  if (length > 1) { dx /= length; dy /= length; }
  stickEl.style.setProperty('--kx', dx * reach + 'px');
  stickEl.style.setProperty('--ky', dy * reach + 'px');
  if (Math.min(length, 1) < .2) { input.sx = input.sy = 0; return; }
  // encaixa em 8 direções, para dar para empurrar a caixa reto
  const angle = Math.round(Math.atan2(-dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  const amount = Math.min(1, length * 1.25);
  input.sx = Math.cos(angle) * amount;
  input.sy = Math.sin(angle) * amount;
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
  canvas.addEventListener(type, event => {
    if (input.swipe && event.pointerId === input.swipe.id) {
      const tap = !input.swipe.moved && input.swipe.right && type === 'pointerup';
      input.swipe = null;
      if (tap) jump();
    }
    if (input.stick && event.pointerId === input.stick.id) releaseStick();
  });
// Setas na tela (fases de tabuleiro): tocar dá um passo, segurar repete.
for (const button of dpad.children) {
  const name = button.dataset.dir;
  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    if (state !== 'play') return;
    input.keys.add(name);
    input.step = STEP_OF[name];
    button.classList.add('is-down');
    try { button.setPointerCapture(event.pointerId); } catch {}
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
    button.addEventListener(type, () => { input.keys.delete(name); button.classList.remove('is-down'); });
  button.addEventListener('click', event => { if (event.detail === 0 && state === 'play') input.step = STEP_OF[name]; }); // teclado e leitores de tela
  button.addEventListener('contextmenu', event => event.preventDefault());
}
canvas.addEventListener('contextmenu', event => event.preventDefault());
jumpButton.addEventListener('pointerdown', event => { event.preventDefault(); jump(); });
jumpButton.addEventListener('click', event => { if (event.detail === 0) jump(); });
// Botões de tocar: reagem na hora em que o dedo encosta. No celular o "click" não chega
// quando outro dedo já está segurando a alavanca, e às vezes chega duas vezes.
function onTap(button, run) {
  let last = -1000;
  const fire = event => {
    const now = performance.now();
    if (now - last < 180) return;
    last = now;
    run(event);
    button.classList.remove('is-tap');
    void button.offsetWidth;
    button.classList.add('is-tap');
  };
  button.addEventListener('pointerdown', event => { if (event.pointerType !== 'mouse' || event.button === 0) { event.preventDefault(); fire(event); } });
  button.addEventListener('click', event => { if (event.detail === 0) fire(event); }); // teclado e leitores de tela
}
onTap(swapButton, switchPlayer);
onTap(switchButton, () => { switchPlayer(); canvas.focus({ preventScroll: true }); });
onTap($('cm-pause'), pause);
onTap($('cm-mute'), () => setMuted(!muted));
onTap($('cm-full'), () => { setFull(!stage.classList.contains('is-full')); if (state === 'play') canvas.focus({ preventScroll: true }); });
if (touchDevice) { touchEl.hidden = false; stage.classList.add('is-touch'); $('cm-mute').textContent = 'som'; $('cm-full').textContent = 'tela'; }

// ---------- Animação ----------
function turn(from, to, amount) {
  let delta = (to - from) % TAU;
  if (delta > Math.PI) delta -= TAU;
  if (delta < -Math.PI) delta += TAU;
  return from + delta * Math.min(1, amount);
}
const mix = (a, b, k) => a + (b - a) * k;
function animate(dt) {
  clock += dt;
  if (!level) return;
  const meeting = state === 'ending';
  bodies.forEach((body, i) => {
    const controlled = (level.glued || i === active) && state === 'play';
    const data = body.mesh.userData;
    const speed = Math.hypot(body.vx, body.vz);
    const pushing = clock - body.pushedAt < .2 && state === 'play';
    body.pushK += ((pushing ? 1 : 0) - body.pushK) * Math.min(1, dt * 12);
    body.cheer = Math.max(0, body.cheer - dt);
    if (speed > .4 && controlled && !pushing) body.face = turn(body.face, Math.atan2(body.vx, body.vz), dt * 14);
    const stride = Math.max(Math.min(1, speed / 3), body.pushK * .8);
    if (state === 'play') body.walk += Math.max(speed, pushing ? 3 : 0) * dt * 3.3;
    const swing = body.ground ? Math.sin(body.walk) * stride * .85 : .65;
    data.legs[0].rotation.x = swing;
    data.legs[1].rotation.x = -swing;
    const carrying = data.held > 0 && data.hand.parent === data.home.parent;
    const cheer = clamp(body.cheer * 3, 0, 1);
    const air = body.ground ? 0 : 1;
    // braços: balançam ao andar, vão para a frente ao empurrar, sobem ao comemorar ou pular
    let left = -swing * .8, right = carrying ? -.75 : swing * .8;
    left = mix(left, -1.45, body.pushK); right = mix(right, -1.45, body.pushK);
    left = mix(left, -2.7, Math.max(cheer, air * .7)); right = mix(right, carrying ? -1.5 : -2.7, Math.max(cheer, air * .7));
    if (meeting && meetTime > 1.3) left = right = -1.1;
    data.arms[0].rotation.x = left;
    data.arms[1].rotation.x = right;
    body.squash += (0 - body.squash) * Math.min(1, dt * 9);
    const breathe = Math.sin(clock * 2.2 + i * 1.7) * .012;
    body.mesh.scale.set(1 - body.squash * .5, 1 + body.squash + breathe, 1 - body.squash * .5);
    const idle = controlled || meeting ? 0 : Math.abs(Math.sin(clock * 2 + i)) * .03;
    const hop = cheer ? Math.abs(Math.sin(body.cheer * 9)) * .12 * cheer : 0;
    body.mesh.position.set(body.x, body.y + idle + hop + (body.ground ? Math.abs(Math.sin(body.walk)) * stride * .05 : 0), body.z);
    body.mesh.rotation.set(body.pushK * .32 + (body.ground ? 0 : -.12), body.face, 0);
    data.head.rotation.z = Math.sin(clock * 1.3 + i * 2) * .05;
    data.head.rotation.y = controlled || meeting ? 0 : Math.sin(clock * .7 + i) * .25;
    // piscar
    if (clock > data.blinkAt) data.blinkAt = clock + 2.4 + Math.random() * 3.2;
    const closed = data.blinkAt - clock < .13 || body.cheer > .3;
    data.eyes[0].scale.y = data.eyes[2].scale.y = closed ? .012 : data.eyeOpen;
    data.eyes[1].visible = data.eyes[3].visible = !closed;

    // sombrinha redonda no chão: aparece no pulo, para ajudar a mirar
    let floor = null;
    for (const block of level.blocks) {
      if (!block.solid || block.py > body.y + .06) continue;
      if (Math.abs(body.x - block.px) > block.w / 2 || Math.abs(body.z - block.pz) > block.d / 2) continue;
      if (!floor || block.py > floor.py) floor = block;
    }
    body.shadow.visible = !!floor && !body.ground;
    if (floor) {
      const height = body.y - floor.py;
      body.shadow.position.set(body.x, floor.py + .03, body.z);
      body.shadow.scale.setScalar(Math.max(.16, .36 - height * .05));
    }
  });
  const me = bodies[active];
  bodies.forEach((body, i) => {
    markers[i].visible = state === 'play' && (level.glued || i === active);
    markers[i].position.set(body.x, body.y + 1.95 + Math.sin(clock * 4) * .06, body.z);
  });
  gum.forEach((dot, i) => {
    dot.visible = !!level.mode?.gum && state !== 'title';
    if (!dot.visible) return;
    const t = (i + 1) / (gum.length + 1), [one, two] = bodies;
    const sag = Math.sin(t * Math.PI) * (1.1 + Math.sin(clock * 2) * .15);
    dot.position.set(mix(one.x, two.x, t), mix(one.y, two.y, t) + .75 - sag * .35 + Math.sin(clock * 3 + i * .7) * .03, mix(one.z, two.z, t));
    dot.scale.setScalar(.05 + .035 * Math.abs(Math.cos(t * Math.PI)));
  });

  level.flowers.forEach((flower, i) => {
    const mesh = flower.mesh;
    if (flower.taken) {
      if (!mesh.visible) return;
      flower.fly += dt * 3.2;
      const k = Math.min(1, flower.fly), to = bodies[0];
      mesh.position.set(mix(flower.x, to.x, k), flower.y + .6 * Math.sin(k * Math.PI) + (to.y + .6 - flower.y) * k, mix(flower.z, to.z, k));
      mesh.scale.setScalar(1.3 * (1 - k));
      if (k === 1) mesh.visible = false;
      return;
    }
    // balança sem deixar de olhar para a câmera
    mesh.quaternion.setFromAxisAngle(CAM_DIR, Math.sin(clock * 1.5 + i * 1.9) * .1);
    mesh.scale.setScalar(1.3 + Math.sin(clock * 2.4 + i) * .04);
  });
  level.photos.forEach((photo, i) => {
    const mesh = photo.mesh;
    if (photo.taken) {
      if (!mesh.visible) return;
      photo.fly += dt * 3.2;
      const k = Math.min(1, photo.fly);
      mesh.scale.setScalar(1 + k * .8);
      mesh.position.y = photo.y + 1 + k * 1.2;
      mesh.rotation.y += dt * 9;
      if (k === 1) mesh.visible = false;
      return;
    }
    mesh.rotation.y = Math.PI / 4 + Math.sin(clock * .9 + i * 2.1) * .5;
    mesh.position.y = photo.y + 1 + Math.sin(clock * 1.7 + i) * .09;
  });
  for (const prop of level.props) prop.userData.tick?.(clock);
  for (const plate of level.plates) if (!plate.locked) plate.mesh.userData.symbol.material.opacity = .55 + .25 * Math.sin(clock * 3);
  if (level.goalMesh) {
    const open = allDone();
    const goal = level.goalMesh.userData;
    const pulse = .5 + .5 * Math.sin(clock * 2.4);
    goal.moonMat.opacity += ((open ? 1 : .3) - goal.moonMat.opacity) * Math.min(1, dt * 4);
    goal.ringMat.opacity = open ? .55 + pulse * .35 : .22;
    goal.halo.material.opacity += ((open ? .5 + pulse * .2 : 0) - goal.halo.material.opacity) * Math.min(1, dt * 4);
    goal.moon.position.y = 2.3 + Math.sin(clock * 1.5) * .1;
  }
  level.mode?.animate?.(dt);
  fireflies.forEach((fly, i) => {
    fly.sprite.position.set(fly.x + Math.sin(clock * fly.speed + fly.phase) * .8, fly.y + Math.sin(clock * fly.speed * 1.7 + fly.phase) * .3, fly.z + Math.cos(clock * fly.speed * .8 + fly.phase) * .8);
    fly.sprite.material.opacity = level.theme.fireAlpha * (.35 + .65 * Math.abs(Math.sin(clock * 1.3 + i)));
  });
  tickSparks(dt);
  tickPuffs(dt);

  // câmera: segue quem está jogando; no encontro, fica no meio dos dois
  let tx = me.x, tz = me.z, ty = me.y < me.lastGroundY - 1.5 || me.ground ? me.y : me.lastGroundY;
  let zoom = 1;
  if (level.tiles && state !== 'ending') {
    // tabuleiros: a câmera fica parada, enquadrando tudo
    const tiles = level.tiles;
    tx = tiles.focus[0] + .5; tz = tiles.focus[1] + .5; ty = -.1;
    zoom = Math.min(1.3, (camera.right - camera.left) / tiles.needW, (camera.top - camera.bottom) / tiles.needH);
  }
  if (Math.abs(camera.zoom - zoom) > .001 && !debugZoom) { camera.zoom += (zoom - camera.zoom) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }
  if (cut > 0) { tx = cutAt.x; tz = cutAt.z; ty = 0; }
  if (meeting) { tx = (bodies[0].x + bodies[1].x) / 2; tz = (bodies[0].z + bodies[1].z) / 2; ty = level.meet.y; }
  const k = 1 - Math.exp(-dt * 4.2);
  camTarget.x += (tx - .5 - camTarget.x) * k;
  camTarget.z += (tz - .5 - camTarget.z) * k;
  camTarget.y += (ty + .7 - camTarget.y) * (1 - Math.exp(-dt * 3));
  camera.position.copy(camTarget).add(CAM_OFFSET);
  camera.lookAt(camTarget);
  sun.position.copy(camTarget).add(SUN_OFFSET);
  sun.target.position.copy(camTarget);
}

let debugZoom = false; // ?debug: deixa mexer no zoom da câmera à mão
const STEP = 1 / 60;
let last = performance.now(), pending = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000);
  last = now;
  if (document.hidden || locked()) return;
  if (state === 'play') {
    pending += dt;
    while (pending >= STEP) { step(STEP); pending -= STEP; if (state !== 'play') { pending = 0; break; } }
  } else pending = 0;
  if (state === 'ending') tickMeeting(dt);
  animate(dt);
  renderer.render(scene, camera);
}

if (new URLSearchParams(location.search).has('debug'))
  window.caminhoDebug = { camera, lockZoom: on => { debugZoom = on; }, bodies, input, level: () => level, state: () => state, active: () => active, step, STEP, switchPlayer, play, begin, startPhase, tickMeeting, tick: dt => { clock += dt; } };

buildLevel(Math.min(save.fase, LEVELS.length - 1));
resize();
showTitle();
requestAnimationFrame(frame);
