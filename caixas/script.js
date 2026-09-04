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

const $ = (id) => document.getElementById(id);
const colors = {
  black: { hex: 0x272723, opacity: .94 },
  white: { hex: 0xf0f0ed, opacity: .96 },
  clear: { hex: 0xa9d7d1, opacity: .48 }
};

function init3D() {
  const host = $('preview');
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(35, 1, 1, 2000);
  camera.position.set(190, 150, 210);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
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
  return preset === 'divider' ? 7 : (preset === 'open' ? 5 : 6);
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
  const material = new THREE.MeshStandardMaterial({ color: color.hex, roughness: .32, metalness: .05, transparent: color.opacity < 1, opacity: color.opacity, side: THREE.DoubleSide });
  panel(outer.w, thickness, outer.d, material, [0, thickness / 2, 0]);
  panel(outer.w, outer.h, thickness, material, [0, outer.h / 2, outer.d / 2 - thickness / 2]);
  panel(outer.w, outer.h, thickness, material, [0, outer.h / 2, -outer.d / 2 + thickness / 2]);
  panel(thickness, outer.h, outer.d - 2 * thickness, material, [-outer.w / 2 + thickness / 2, outer.h / 2, 0]);
  panel(thickness, outer.h, outer.d - 2 * thickness, material, [outer.w / 2 - thickness / 2, outer.h / 2, 0]);
  if (preset === 'lid' || preset === 'hinge') panel(outer.w, thickness, outer.d, material, [0, outer.h + thickness / 2, 0]);
  if (preset === 'divider') {
    panel(outer.w - 2 * thickness, outer.h * .7, thickness / 2, material, [0, outer.h * .36, 0]);
    panel(thickness / 2, outer.h * .7, outer.d - 2 * thickness, material, [0, outer.h * .36, 0], [0, Math.PI / 2, 0]);
  }
  camera.position.set(Math.max(150, outer.w * 1.8), Math.max(130, outer.h * 1.7), Math.max(180, outer.d * 2));
  controls.target.set(0, outer.h / 2, 0);
  controls.update();
  $('summary').innerHTML = `<strong>${Math.round(outer.w)} x ${Math.round(outer.d)} x ${Math.round(outer.h)} mm</strong> · ${pieceCount()} peças · ${selectedColor}`;
  $('status').textContent = 'modelo atualizado';
  $('message').textContent = 'Dimensões externas calculadas com a espessura selecionada.';
}

function addRect(model, name, x, y, width, height, thickness, edge) {
  const rect = new makerjs.models.Rectangle(width, height);
  makerjs.model.move(rect, [x, y]);
  model.models[name] = rect;
  addFingerJoints(model, x, y, width, height, thickness, edge);
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
  if (preset === 'divider') addRect(model, 'divider', w * 2 + d + t * 12, d + t * 3, w - 2 * t, d - 2 * t, t, w);
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
$('generate').addEventListener('click', generateBox);
$('export').addEventListener('click', exportSVG);
document.querySelectorAll('input').forEach((input) => input.addEventListener('change', generateBox));

try {
  init3D();
  generateBox();
} catch (error) {
  console.error(error);
  $('message').textContent = 'Não foi possível iniciar o preview 3D. Recarregue a página.';
}
