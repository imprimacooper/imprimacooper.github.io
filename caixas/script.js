import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/controls/OrbitControls.js';

const makerjs = globalThis.MakerJs || globalThis.makerjs;
let scene;
let camera;
let renderer;
let controls;
let current = null;
let selectedColor = 'black';
let preset = 'open';
let jointType = 'finger';
let hasDividers = false;

const $ = (id) => document.getElementById(id);
const colors = {
  black: { hex: 0x08090a, roughness: .12, clearcoat: 1, clearcoatRoughness: .06, opacity: .98 },
  white: { hex: 0xf7f7f4, roughness: .15, clearcoat: 1, clearcoatRoughness: .08, opacity: .98 },
  clear: { hex: 0xa9d7d1, roughness: .06, transmission: .72, thickness: .8, ior: 1.46, opacity: .62 }
};

function init3D() {
  const host = $('preview');
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(35, 1, 1, 2000);
  camera.position.set(190, 150, 210);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  host.appendChild(renderer.domElement);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 30, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x59635e, 2.1));
  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(120, 240, 160);
  scene.add(light);
  resize();
  window.addEventListener('resize', resize);
  animate();
}

function resize() {
  const host = $('preview');
  const width = host.clientWidth;
  const height = host.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function clearScene() {
  while (scene.children.length > 2) scene.remove(scene.children[2]);
}

function panel(width, height, depth, material, position, rotation) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  scene.add(mesh);
}

function pieceCount() {
  const basePieces = preset === 'open' ? 5 : (preset === 'hinge' ? 7 : 6);
  return basePieces + (hasDividers ? Math.max(0, getDividerRows() - 1) + Math.max(0, getDividerColumns() - 1) : 0);
}

function getDividerRows() {
  return Math.max(1, Math.min(12, Math.round(+$('divider-rows').value) || 1));
}

function getDividerColumns() {
  return Math.max(1, Math.min(12, Math.round(+$('divider-columns').value) || 1));
}

function generateBox() {
  const width = +$('width').value;
  const height = +$('height').value;
  const depth = +$('depth').value;
  const thickness = +$('thickness').value;
  if ([width, height, depth, thickness].some((value) => !Number.isFinite(value) || value <= 0)) {
    $('message').textContent = 'Informe medidas positivas.';
    return;
  }
  const internal = document.querySelector('input[name="dimension"]:checked').value === 'internal';
  const outer = {
    w: internal ? width + 2 * thickness : width,
    h: internal ? height + 2 * thickness : height,
    d: internal ? depth + 2 * thickness : depth
  };
  current = { ...outer, t: thickness, preset };
  clearScene();
  const color = colors[selectedColor];
  const material = new THREE.MeshPhysicalMaterial({
    color: color.hex,
    roughness: color.roughness,
    metalness: .04,
    clearcoat: color.clearcoat || 0,
    clearcoatRoughness: color.clearcoatRoughness || .1,
    transmission: color.transmission || 0,
    thickness: color.thickness || 0,
    ior: color.ior || 1.5,
    transparent: color.opacity < 1,
    opacity: color.opacity,
    side: THREE.DoubleSide
  });
  panel(outer.w, thickness, outer.d, material, [0, thickness / 2, 0]);
  panel(outer.w, outer.h, thickness, material, [0, outer.h / 2, outer.d / 2 - thickness / 2]);
  panel(outer.w, outer.h, thickness, material, [0, outer.h / 2, -outer.d / 2 + thickness / 2]);
  panel(thickness, outer.h, outer.d - 2 * thickness, material, [-outer.w / 2 + thickness / 2, outer.h / 2, 0]);
  panel(thickness, outer.h, outer.d - 2 * thickness, material, [outer.w / 2 - thickness / 2, outer.h / 2, 0]);
  if (preset === 'lid' || preset === 'hinge') panel(outer.w, thickness, outer.d, material, [0, outer.h + thickness / 2, 0]);
  if (preset === 'hinge') {
    const hingeMaterial = new THREE.MeshStandardMaterial({ color: 0x5d6664, roughness: .42, metalness: .5 });
    for (let index = -1; index <= 1; index += 2) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 1.25, thickness * 1.25, outer.w / 3, 20), hingeMaterial);
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(index * outer.w / 3, outer.h + thickness * 1.15, outer.d / 2 - thickness);
      scene.add(barrel);
    }
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(thickness * .35, thickness * .35, outer.w * .96, 16), hingeMaterial);
    pin.rotation.z = Math.PI / 2;
    pin.position.set(0, outer.h + thickness * 1.15, outer.d / 2 - thickness);
    scene.add(pin);
  }
  if (hasDividers) {
    const rows = getDividerRows();
    const columns = getDividerColumns();
    for (let index = 1; index < rows; index += 1) {
      const z = -outer.d / 2 + thickness + (outer.d - 2 * thickness) * index / rows;
      panel(outer.w - 2 * thickness, outer.h * .7, thickness / 2, material, [0, outer.h * .36, z]);
    }
    for (let index = 1; index < columns; index += 1) {
      const x = -outer.w / 2 + thickness + (outer.w - 2 * thickness) * index / columns;
      panel(thickness / 2, outer.h * .7, outer.d - 2 * thickness, material, [x, outer.h * .36, 0], [0, Math.PI / 2, 0]);
    }
  }
  camera.position.set(Math.max(150, outer.w * 1.8), Math.max(130, outer.h * 1.7), Math.max(180, outer.d * 2));
  controls.target.set(0, outer.h / 2, 0);
  controls.update();
  const jointLabel = jointType === 'finger' ? 'juntas com dedos' : 'juntas planas';
  const dividerLabel = hasDividers ? ` · ${getDividerRows()} linhas x ${getDividerColumns()} colunas` : '';
  $('summary').innerHTML = `<strong>${Math.round(outer.w)} x ${Math.round(outer.d)} x ${Math.round(outer.h)} mm</strong> · ${pieceCount()} peças · ${jointLabel}${dividerLabel}`;
  $('status').textContent = 'modelo atualizado';
  $('message').textContent = 'Dimensões externas calculadas com a espessura selecionada.';
}

function addRect(model, name, x, y, width, height, thickness, edge) {
  const rect = new makerjs.models.Rectangle(width, height);
  makerjs.model.move(rect, [x, y]);
  model.models[name] = rect;
  if (jointType === 'finger') addFingerJoints(model, x, y, width, height, thickness, edge);
}

function addFingerJoints(model, x, y, width, height, thickness, edge) {
  const count = Math.max(2, Math.floor((edge || width) / (thickness * 5)));
  const step = (edge || width) / count;
  for (let index = 1; index < count; index += 2) {
    const joint = makerjs.model.move(new makerjs.models.Rectangle(Math.min(thickness, step * .35), thickness), [x + index * step - thickness / 2, y + height - thickness]);
    model.models[`joint_${x}_${index}`] = joint;
  }
}

function exportSVG() {
  if (!current) generateBox();
  if (!current || !makerjs) {
    $('message').textContent = 'Maker.js não foi carregado. Verifique a conexão e tente novamente.';
    return;
  }
  const { w, h, d, t } = current;
  const model = { models: {} };
  addRect(model, 'base', 0, 0, w, d, t, w);
  addRect(model, 'front', 0, d + t * 3, w, h, t, w);
  addRect(model, 'back', w + t * 3, d + t * 3, w, h, t, w);
  addRect(model, 'left', w * 2 + t * 6, d + t * 3, d, h, t, h);
  addRect(model, 'right', w * 2 + d + t * 9, d + t * 3, d, h, t, h);
  if (preset !== 'open') addRect(model, 'lid', 0, d + h + t * 6, w, d, t, w);
  if (preset === 'hinge') {
    addRect(model, 'hinge-barrel-left', 0, d + h + t * 9, w / 3, t * 3, t, w / 3);
    addRect(model, 'hinge-barrel-right', w / 3 + t * 2, d + h + t * 9, w / 3, t * 3, t, w / 3);
    addRect(model, 'hinge-pin', 2 * w / 3 + t * 4, d + h + t * 9, w / 3, t, t, w / 3);
  }
  if (hasDividers) {
    const rows = getDividerRows();
    const columns = getDividerColumns();
    for (let index = 1; index < rows; index += 1) addRect(model, `divider-row-${index}`, w * 2 + d + t * 12, d + t * (3 + index * 2), w - 2 * t, d - 2 * t, t, w);
    for (let index = 1; index < columns; index += 1) addRect(model, `divider-column-${index}`, w * 3 + d * 2 + t * (15 + index * 2), d + t * 3, d - 2 * t, h, t, h);
  }
  const svg = makerjs.exporter.toSVG(model, { stroke: 'none', fill: 'none' }).replace(/<svg /, '<svg id="caixa-laser" ');
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `caixa-${preset}.svg`;
  link.click();
  URL.revokeObjectURL(url);
  $('message').textContent = 'SVG planificado exportado com encaixes.';
}

document.querySelectorAll('.preset').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.preset').forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
  preset = button.dataset.preset;
  generateBox();
}));
document.querySelectorAll('.swatch').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.swatch').forEach((item) => item.classList.remove('selected'));
  button.classList.add('selected');
  selectedColor = button.dataset.color;
  generateBox();
}));
$('divider-options').hidden = true;
document.querySelector('#has-dividers').addEventListener('change', (event) => {
  hasDividers = event.target.checked;
  $('divider-options').hidden = !hasDividers;
  generateBox();
});
document.querySelectorAll('input[name="joint"]').forEach((input) => input.addEventListener('change', () => {
  jointType = document.querySelector('input[name="joint"]:checked').value;
  generateBox();
}));
$('generate').addEventListener('click', generateBox);
$('export').addEventListener('click', exportSVG);
document.querySelectorAll('input, select').forEach((input) => input.addEventListener('change', () => {
  $('divider-options').hidden = !hasDividers;
  generateBox();
}));

try {
  init3D();
  generateBox();
} catch (error) {
  console.error(error);
  $('message').textContent = 'Não foi possível iniciar o preview 3D. Recarregue a página.';
}
