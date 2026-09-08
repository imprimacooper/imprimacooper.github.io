import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/environments/RoomEnvironment.js';
import { BlobWriter, TextReader, ZipWriter } from 'https://cdn.jsdelivr.net/npm/@zip.js/zip.js@2.7.57/+esm';
import { businessConfig } from './config.js';
import { createBoxGeometry } from './geometry.js';

let scene;
let camera;
let renderer;
let controls;
let environmentTarget;
let current = null;
let selectedColor = 'black';
let preset = 'open';
let jointType = 'finger';
let hasDividers = false;
let cameraViewInitialized = false;

const $ = (id) => document.getElementById(id);
const colors = {
  black: { hex: 0x020304, edge: 0x697275, edgeOpacity: .36, roughness: .2, clearcoat: .8, clearcoatRoughness: .06, envMapIntensity: .55, opacity: 1 },
  white: { hex: 0xbfc2bf, edge: 0x646866, edgeOpacity: .62, roughness: .24, clearcoat: 1, clearcoatRoughness: .045, specularIntensity: 1, specularColor: 0xffffff, envMapIntensity: .95, opacity: 1 },
  clear: { hex: 0xf5f7f6, edge: 0x8a908e, edgeOpacity: .62, roughness: .018, clearcoat: .75, clearcoatRoughness: .035, transmission: .9, ior: 1.46, specularIntensity: 1.25, specularColor: 0xffffff, envMapIntensity: 1.45, opacity: .58 }
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
  const environment = new RoomEnvironment();
  environmentTarget = new THREE.PMREMGenerator(renderer).fromScene(environment, .04);
  scene.environment = environmentTarget.texture;
  environment.dispose();
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 30, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x59635e, 1.35));
  const light = new THREE.DirectionalLight(0xffffff, 2.8);
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

function createExtrudedPart(piece, material) {
  const shape = new THREE.Shape();
  piece.points.forEach(([x, y], index) => {
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {
    depth: piece.thickness,
    bevelEnabled: false,
    curveSegments: 1
  }), material);
  mesh.position.set(...piece.position);
  mesh.rotation.set(...piece.rotation);
  const edgeMaterial = material.userData.edgeMaterial;
  if (edgeMaterial) {
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), edgeMaterial);
    mesh.add(edges);
  }
  scene.add(mesh);
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
  return dimensions.length ? Math.max(1, Math.floor(Math.min(...dimensions) * 2 / 3 * 10) / 10) : 1;
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
  const margin = Math.max(0, Number(businessConfig.materialWastePercent) || 0) / 100;
  const squareMeters = (area / 1000000) * (1 + margin);
  return { area: squareMeters, value: squareMeters * material.pricePerSquareMeter };
}

function updateEstimate(width, height, depth, thickness) {
  const estimate = getMaterialEstimate(width, height, depth, thickness);
  const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: businessConfig.currency });
  $('estimate').textContent = `Valor estimado: ${formatter.format(estimate.value)} · ${estimate.area.toFixed(3)} m²`;
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
  current.geometry = createBoxGeometry({
    width: outer.w,
    height: outer.h,
    depth: outer.d,
    thickness,
    preset,
    jointType,
    fingerLength: getFingerLength(),
    kerf: getKerf(),
    hasDividers,
    dividerRows: getDividerRows(),
    dividerColumns: getDividerColumns()
  });
  clearScene();
  const color = colors[selectedColor];
  const material = new THREE.MeshPhysicalMaterial({
    color: color.hex,
    roughness: color.roughness,
    metalness: .04,
    clearcoat: color.clearcoat || 0,
    clearcoatRoughness: color.clearcoatRoughness || .1,
    transmission: color.transmission || 0,
    thickness: color.transmission ? thickness : 0,
    ior: color.ior || 1.5,
    specularIntensity: color.specularIntensity,
    specularColor: color.specularColor,
    envMapIntensity: color.envMapIntensity,
    transparent: color.transmission ? true : color.opacity < 1,
    opacity: color.opacity,
    depthWrite: !color.transmission && color.opacity >= .9,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
  });
  material.userData.edgeMaterial = new THREE.LineBasicMaterial({
    color: color.edge,
    transparent: true,
    opacity: color.edgeOpacity,
    depthTest: true,
    depthWrite: false
  });
  current.geometry.pieces.forEach((piece) => createExtrudedPart(piece, material));
  if (!cameraViewInitialized) {
    camera.position.set(Math.max(150, outer.w * 1.8), Math.max(130, outer.h * 1.7), Math.max(180, outer.d * 2));
    controls.target.set(0, outer.h / 2, 0);
    controls.update();
    cameraViewInitialized = true;
  }
  const jointLabel = jointType === 'finger' ? `dedos de ${getFingerLength()} mm` : 'juntas planas';
  const dividerLabel = hasDividers ? ` · ${getDividerRows()} linhas x ${getDividerColumns()} colunas` : '';
  $('summary').innerHTML = `<strong>${Math.round(outer.w)} x ${Math.round(outer.d)} x ${Math.round(outer.h)} mm</strong> · ${pieceCount()} peças · ${jointLabel}${dividerLabel}`;
  updateEstimate(outer.w, outer.h, outer.d, thickness);
  $('status').textContent = 'modelo atualizado';
  $('message').textContent = 'Dimensões externas calculadas com a espessura selecionada.';
}

const layoutGap = 1.2;

function svgPath(points, offset) {
  return points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${(x + offset[0]).toFixed(3)} ${(y + offset[1]).toFixed(3)}`).join(' ') + ' Z';
}

function buildSVG() {
  if (!current) generateBox();
  if (!current || !current.geometry) return null;
  const { w, h, d, t } = current;
  const gap = 2 * t + layoutGap;
  const layout = {
    base: [0, 0],
    front: [0, d + gap],
    back: [w + gap, d + gap],
    left: [w * 2 + gap * 2, d + gap],
    right: [w * 2 + d + gap * 3, d + gap],
    lid: [0, d + h + gap * 2]
  };
  const paths = [];
  current.geometry.pieces.filter((piece) => piece.type !== 'divider').forEach((piece) => {
    paths.push(svgPath(piece.points, layout[piece.name]));
  });
  const dividerX = w * 2 + d + gap * 4;
  const rowLayoutGap = gap * 1.5;
  const dividerHeight = preset === 'open' ? h : h - 2 * t;
  let dividerRowIndex = 0;
  let dividerColumnIndex = 0;
  current.geometry.pieces.filter((piece) => piece.type === 'divider').forEach((piece) => {
    const isRow = piece.name.startsWith('divider-row');
    const index = isRow ? dividerRowIndex++ : dividerColumnIndex++;
    const x = isRow ? dividerX : dividerX + w + rowLayoutGap;
    const y = d + gap * 3 + index * (dividerHeight + rowLayoutGap);
    paths.push(svgPath(piece.points, [x, y]));
  });
  const allPoints = current.geometry.pieces.flatMap((piece) => {
    if (piece.type !== 'divider') {
      return piece.points.map(([x, y]) => [x + layout[piece.name][0], y + layout[piece.name][1]]);
    }
    const isRow = piece.name.startsWith('divider-row');
    const index = Number(piece.name.split('-').pop()) - 1;
    const offset = [isRow ? dividerX : dividerX + w + rowLayoutGap, d + gap * 3 + index * (dividerHeight + rowLayoutGap)];
    return piece.points.map(([x, y]) => [x + offset[0], y + offset[1]]);
  });
  const minX = Math.min(...allPoints.map(([x]) => x));
  const minY = Math.min(...allPoints.map(([, y]) => y));
  const maxX = Math.max(...allPoints.map(([x]) => x));
  const maxY = Math.max(...allPoints.map(([, y]) => y));
  const padding = 2;
  return `<svg id="caixa-laser" xmlns="http://www.w3.org/2000/svg" viewBox="${(minX - padding).toFixed(3)} ${(minY - padding).toFixed(3)} ${(maxX - minX + padding * 2).toFixed(3)} ${(maxY - minY + padding * 2).toFixed(3)}"><g fill="none" stroke="#000" stroke-width="0.1">${paths.map((path) => `<path d="${path}"/>`).join('')}</g></svg>`;
}

function buildSummary() {
  const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: businessConfig.currency });
  const estimate = getMaterialEstimate(current.w, current.h, current.d, current.t);
  const materialLabels = { black: 'Preto', white: 'Branco', clear: 'Transparente' };
  const generatedAt = new Date();
  return [
    'Resumo da caixa',
    '================',
    `Data/hora: ${generatedAt.toLocaleString('pt-BR')}`,
    `Formato: ${preset === 'lid' ? 'Com tampa' : 'Aberta'}`,
    `Dimensões externas: ${current.w} x ${current.d} x ${current.h} mm`,
    `Área estimada: ${estimate.area.toFixed(3)} m²`,
    `Espessura: ${current.t} mm`,
    `Material: Acrílico ${materialLabels[selectedColor] || selectedColor}`,
    `Junta: ${jointType === 'finger' ? `Com dedos de ${getFingerLength()} mm` : 'Plana'}`,
    `Divisórias: ${hasDividers ? `${getDividerRows()} linhas x ${getDividerColumns()} colunas` : 'Não'}`,
    `Valor estimado: ${formatter.format(estimate.value)}`,
    ''
  ].join('\n');
}

async function exportZIP() {
  if (!current) generateBox();
  const svg = buildSVG();
  if (!svg) return;
  const zipWriter = new ZipWriter(new BlobWriter('application/zip'));
  const options = { password: businessConfig.zipPassword, encryptionStrength: 3 };
  await zipWriter.add('Resumo.txt', new TextReader(buildSummary()), options);
  await zipWriter.add('Corte.svg', new TextReader(svg), options);
  const zipBlob = await zipWriter.close();
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const formatName = preset === 'lid' ? 'fechada' : 'aberta';
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Caixa-${formatName}-${date}.zip`;
  link.click();
  URL.revokeObjectURL(url);
  $('message').textContent = 'ZIP protegido exportado com resumo e corte SVG.';
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
$('export').addEventListener('click', () => exportZIP().catch((error) => {
  console.error(error);
  $('message').textContent = 'Não foi possível gerar o ZIP protegido.';
}));
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
