import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/controls/OrbitControls.js';
import { businessConfig } from './config.js';

let makerjs = globalThis.MakerJs || globalThis.makerjs || globalThis.makerJS;
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
  black: { hex: 0x181a1b, roughness: .14, clearcoat: 1, clearcoatRoughness: .07, opacity: .98 },
  white: { hex: 0xd9dad6, roughness: .17, clearcoat: 1, clearcoatRoughness: .09, opacity: .98 },
  clear: { hex: 0xd8dedb, roughness: .08, transmission: .82, thickness: .8, ior: 1.46, opacity: .58 }
};
const kerf = businessConfig.kerf;

function populateThicknessOptions() {
  const select = $('thickness');
  businessConfig.acrylic.forEach(({ thickness }) => {
    const option = document.createElement('option');
    option.value = thickness;
    option.textContent = `${thickness} mm`;
    option.selected = thickness === 2;
    select.appendChild(option);
  });
}

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

function addFingerPreview(width, height, depth, thickness, material) {
  if (jointType !== 'finger') return;
  const fingerLength = getFingerLength();
  const tabHeight = Math.max(.5, thickness * .45);
  const horizontalCount = Math.max(2, Math.floor(width / fingerLength));
  const horizontalStep = width / horizontalCount;
  const depthCount = Math.max(2, Math.floor(depth / fingerLength));
  const depthStep = depth / depthCount;
  for (let index = 0; index < horizontalCount; index += 2) {
    const x = -width / 2 + horizontalStep * (index + .5);
    panel(horizontalStep * .82, tabHeight, thickness, material, [x, -tabHeight / 2, depth / 2 - thickness / 2]);
    panel(horizontalStep * .82, tabHeight, thickness, material, [x, -tabHeight / 2, -depth / 2 + thickness / 2]);
  }
  for (let index = 0; index < depthCount; index += 2) {
    const z = -depth / 2 + depthStep * (index + .5);
    panel(thickness, tabHeight, depthStep * .82, material, [width / 2 - thickness / 2, -tabHeight / 2, z]);
    panel(thickness, tabHeight, depthStep * .82, material, [-width / 2 + thickness / 2, -tabHeight / 2, z]);
  }
  const verticalCount = Math.max(2, Math.floor(height / fingerLength));
  const verticalStep = height / verticalCount;
  for (let index = 0; index < verticalCount; index += 2) {
    const y = verticalStep * (index + .5);
    panel(thickness, verticalStep * .82, thickness, material, [-width / 2 - thickness / 2, y, depth / 2 - thickness / 2]);
    panel(thickness, verticalStep * .82, thickness, material, [width / 2 + thickness / 2, y, depth / 2 - thickness / 2]);
    panel(thickness, verticalStep * .82, thickness, material, [-width / 2 - thickness / 2, y, -depth / 2 + thickness / 2]);
    panel(thickness, verticalStep * .82, thickness, material, [width / 2 + thickness / 2, y, -depth / 2 + thickness / 2]);
  }
}

function pieceCount() {
  const basePieces = preset === 'open' ? 5 : 6;
  return basePieces + (hasDividers ? Math.max(0, getDividerRows() - 1) + Math.max(0, getDividerColumns() - 1) : 0);
}

function getDividerRows() {
  return Math.max(1, Math.min(12, Math.round(+$('divider-rows').value) || 1));
}

function getDividerColumns() {
  return Math.max(1, Math.min(12, Math.round(+$('divider-columns').value) || 1));
}

function getFingerLimit() {
  const dimensions = [+$('width').value, +$('height').value, +$('depth').value].filter((value) => Number.isFinite(value) && value > 0);
  return dimensions.length ? Math.max(1, Math.floor(Math.min(...dimensions) / 2 * 10) / 10) : 1;
}

function syncFingerLimit() {
  const limit = getFingerLimit();
  const input = $('finger-length');
  input.max = limit;
  input.value = Math.min(limit, Math.max(1, +input.value || 1));
  $('finger-limit').textContent = `Máximo para estas dimensões: ${limit} mm.`;
  $('finger-value').textContent = `${input.value} mm`;
}

function getFingerLength() {
  syncFingerLimit();
  return Math.min(getFingerLimit(), Math.max(1, +$('finger-length').value || 1));
}

function getKerf() {
  return kerf;
}

function getMaterialEstimate(width, height, depth, thickness) {
  const material = businessConfig.acrylic.find((item) => item.thickness === thickness);
  if (!material) return { area: 0, value: 0 };
  const wallArea = 2 * width * height + 2 * depth * height;
  const lidArea = preset === 'lid' ? width * depth : 0;
  let area = width * depth + wallArea + lidArea;
  if (hasDividers) {
    const dividerHeight = preset === 'open' ? height : height - 2 * thickness;
    area += Math.max(0, getDividerRows() - 1) * (width - 2 * thickness) * dividerHeight;
    area += Math.max(0, getDividerColumns() - 1) * (depth - 2 * thickness) * dividerHeight;
  }
  const squareMeters = area / 1000000;
  return { area: squareMeters, value: squareMeters * material.pricePerSquareMeter };
}

function updateEstimate(width, height, depth, thickness) {
  const estimate = getMaterialEstimate(width, height, depth, thickness);
  const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: businessConfig.currency });
  $('estimate').textContent = `Valor estimado: ${formatter.format(estimate.value)} · ${estimate.area.toFixed(3)} m²`;
}

function loadMakerJs() {
  if (makerjs) return Promise.resolve(makerjs);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/makerjs@0.15.0/dist/browser.maker.js';
    script.onload = () => {
      makerjs = globalThis.MakerJs || globalThis.makerjs || globalThis.makerJS;
      makerjs ? resolve(makerjs) : reject(new Error('Maker.js não expôs uma API global.'));
    };
    script.onerror = () => reject(new Error('Não foi possível carregar Maker.js.'));
    document.head.appendChild(script);
  });
}

function generateBox() {
  syncFingerLimit();
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
  current.kerf = getKerf();
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
    depthWrite: color.opacity >= .9,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
  });
  panel(outer.w, thickness, outer.d, material, [0, thickness / 2, 0]);
  panel(outer.w, outer.h, thickness, material, [0, outer.h / 2, outer.d / 2 - thickness / 2]);
  panel(outer.w, outer.h, thickness, material, [0, outer.h / 2, -outer.d / 2 + thickness / 2]);
  panel(thickness, outer.h, outer.d - 2 * thickness, material, [-outer.w / 2 + thickness / 2, outer.h / 2, 0]);
  panel(thickness, outer.h, outer.d - 2 * thickness, material, [outer.w / 2 - thickness / 2, outer.h / 2, 0]);
  addFingerPreview(outer.w, outer.h, outer.d, thickness, material);
  if (preset === 'lid') panel(outer.w, thickness, outer.d, material, [0, outer.h + thickness / 2, 0]);
  if (hasDividers) {
    const rows = getDividerRows();
    const columns = getDividerColumns();
    const dividerHeight = preset === 'open' ? outer.h : outer.h - 2 * thickness;
    for (let index = 1; index < rows; index += 1) {
      const z = -outer.d / 2 + thickness + (outer.d - 2 * thickness) * index / rows;
      panel(outer.w - 2 * thickness, dividerHeight, thickness / 2, material, [0, dividerHeight / 2, z]);
    }
    for (let index = 1; index < columns; index += 1) {
      const x = -outer.w / 2 + thickness + (outer.w - 2 * thickness) * index / columns;
      panel(thickness / 2, dividerHeight, outer.d - 2 * thickness, material, [x, dividerHeight / 2, 0]);
    }
  }
  camera.position.set(Math.max(150, outer.w * 1.8), Math.max(130, outer.h * 1.7), Math.max(180, outer.d * 2));
  controls.target.set(0, outer.h / 2, 0);
  controls.update();
  const jointLabel = jointType === 'finger' ? `dedos de ${getFingerLength()} mm` : 'juntas planas';
  const dividerLabel = hasDividers ? ` · ${getDividerRows()} linhas x ${getDividerColumns()} colunas` : '';
  $('summary').innerHTML = `<strong>${Math.round(outer.w)} x ${Math.round(outer.d)} x ${Math.round(outer.h)} mm</strong> · ${pieceCount()} peças · ${jointLabel}${dividerLabel}`;
  updateEstimate(outer.w, outer.h, outer.d, thickness);
  $('status').textContent = 'modelo atualizado';
  $('message').textContent = 'Dimensões externas calculadas com a espessura selecionada.';
}

function addRect(model, name, x, y, width, height, thickness, edges) {
  const rect = jointType === 'finger'
    ? new makerjs.models.ConnectTheDots(true, fingerPoints(width, height, thickness, getFingerLength(), getKerf(), edges))
    : new makerjs.models.Rectangle(width, height);
  makerjs.model.move(rect, [x, y]);
  model.models[name] = rect;
}

function fingerPoints(width, height, thickness, fingerLength, kerf, edges = { bottom: true, right: true, top: true, left: true }) {
  const horizontalCount = Math.max(2, Math.floor(width / fingerLength));
  const verticalCount = Math.max(2, Math.floor(height / fingerLength));
  const points = [];
  const addEdge = (start, end, count, outward, enabled) => {
    const stepX = (end[0] - start[0]) / count;
    const stepY = (end[1] - start[1]) / count;
    for (let index = 0; index < count; index += 1) {
      const ax = start[0] + stepX * index;
      const ay = start[1] + stepY * index;
      const bx = start[0] + stepX * (index + 1);
      const by = start[1] + stepY * (index + 1);
      const finger = index % 2 === 0;
      const direction = enabled === 'in' ? -1 : 1;
      const normal = [outward[0] * direction * (thickness - kerf / 2), outward[1] * direction * (thickness - kerf / 2)];
      points.push([ax, ay]);
      if (enabled && finger) {
        points.push([ax + normal[0], ay + normal[1]]);
        points.push([bx + normal[0], by + normal[1]]);
      }
      points.push([bx, by]);
    }
  };
  addEdge([0, 0], [width, 0], horizontalCount, [0, -1], edges.bottom);
  addEdge([width, 0], [width, height], verticalCount, [1, 0], edges.right);
  addEdge([width, height], [0, height], horizontalCount, [0, 1], edges.top);
  addEdge([0, height], [0, 0], verticalCount, [-1, 0], edges.left);
  return points;
}

function dividerPoints(width, height, thickness, fingerLength, kerf, slots, slotsFromTop) {
  const points = [];
  const notchDepth = Math.max(thickness, thickness * 2 - kerf);
  const notchWidth = Math.min(thickness + kerf, fingerLength * .45);
  const addNotchedEdge = (fromTop) => {
    const orderedSlots = slots.slice().sort((a, b) => a - b);
    if (fromTop) {
      points.push([0, height]);
      let cursor = 0;
      orderedSlots.forEach((slot) => {
        points.push([slot - notchWidth / 2, height]);
        points.push([slot - notchWidth / 2, height - notchDepth]);
        points.push([slot + notchWidth / 2, height - notchDepth]);
        points.push([slot + notchWidth / 2, height]);
        cursor = slot + notchWidth / 2;
      });
      points.push([width, height]);
    } else {
      points.push([width, 0]);
      orderedSlots.slice().reverse().forEach((slot) => {
        points.push([slot + notchWidth / 2, 0]);
        points.push([slot + notchWidth / 2, notchDepth]);
        points.push([slot - notchWidth / 2, notchDepth]);
        points.push([slot - notchWidth / 2, 0]);
      });
      points.push([0, 0]);
    }
  };
  if (slotsFromTop) {
    points.push([0, 0], [width, 0], [width, height]);
    addNotchedEdge(true);
    points.push([0, height], [0, 0]);
  } else {
    points.push([0, 0], [0, height], [width, height]);
    addNotchedEdge(false);
    points.push([0, 0]);
  }
  return points;
}

function addDividerPiece(model, name, x, y, width, height, thickness, slots, slotsFromTop) {
  const piece = jointType === 'finger'
    ? new makerjs.models.ConnectTheDots(true, dividerPoints(width, height, thickness, getFingerLength(), getKerf(), slots, slotsFromTop))
    : new makerjs.models.Rectangle(width, height);
  makerjs.model.move(piece, [x, y]);
  model.models[name] = piece;
}

const layoutGap = 1.2;

async function exportSVG() {
  if (!current) generateBox();
  try {
    await loadMakerJs();
  } catch (error) {
    $('message').textContent = 'Maker.js não foi carregado. Verifique a conexão e tente novamente.';
    return;
  }
  if (!current || !makerjs) return;
  const { w, h, d, t } = current;
  const model = { models: {}, paths: {} };
  const gap = 2 * t + layoutGap;
  addRect(model, 'base', 0, 0, w, d, t, { bottom: true, right: true, top: true, left: true });
  const wallEdges = {
    bottom: 'in',
    right: 'in',
    top: preset === 'lid' ? 'out' : false,
    left: 'in'
  };
  addRect(model, 'front', 0, d + gap, w, h, t, wallEdges);
  addRect(model, 'back', w + gap, d + gap, w, h, t, wallEdges);
  addRect(model, 'left', w * 2 + gap * 2, d + gap, d, h, t, wallEdges);
  addRect(model, 'right', w * 2 + d + gap * 3, d + gap, d, h, t, wallEdges);
  if (preset === 'lid') addRect(model, 'lid', 0, d + h + gap * 2, w, d, t, { bottom: 'in', right: 'in', top: 'in', left: 'in' });
  if (hasDividers) {
    const rows = getDividerRows();
    const columns = getDividerColumns();
    const rowSlots = Array.from({ length: Math.max(0, columns - 1) }, (_, index) => (w - 2 * t) * (index + 1) / columns);
    const columnSlots = Array.from({ length: Math.max(0, rows - 1) }, (_, index) => (d - 2 * t) * (index + 1) / rows);
    const dividerHeight = preset === 'open' ? h : h - 2 * t;
    const dividerX = w * 2 + d + gap * 4;
    const rowLayoutGap = gap * 1.5;
    const columnX = dividerX + w + rowLayoutGap;
    for (let index = 1; index < rows; index += 1) {
      addDividerPiece(model, `divider-row-${index}`, dividerX, d + gap * 3 + (index - 1) * (dividerHeight + rowLayoutGap), w - 2 * t, dividerHeight, t, rowSlots, true);
    }
    for (let index = 1; index < columns; index += 1) {
      addDividerPiece(model, `divider-column-${index}`, columnX, d + gap * 3 + (index - 1) * (dividerHeight + rowLayoutGap), d - 2 * t, dividerHeight, t, columnSlots, false);
    }
  }
  const svg = makerjs.exporter.toSVG(model, { stroke: '#000000', strokeWidth: .1, fill: 'none' }).replace(/<svg /, '<svg id="caixa-laser" ');
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
  $('finger-options').hidden = jointType !== 'finger';
  generateBox();
}));
$('finger-options').hidden = false;
$('generate').addEventListener('click', generateBox);
$('export').addEventListener('click', exportSVG);
document.querySelectorAll('input:not([name="joint"]), select').forEach((input) => input.addEventListener('change', () => {
  $('divider-options').hidden = !hasDividers;
  generateBox();
}));

populateThicknessOptions();
try {
  init3D();
  generateBox();
} catch (error) {
  console.error(error);
  $('message').textContent = 'Não foi possível iniciar o preview 3D. Recarregue a página.';
}
