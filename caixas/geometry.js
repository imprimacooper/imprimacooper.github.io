// Mantém uma quantidade ímpar de segmentos para centralizar os dedos nas bordas.
function centeredSegmentCount(length, fingerLength) {
  const count = Math.max(2, Math.floor(length / fingerLength));
  return count % 2 === 0 ? Math.max(3, count - 1) : count;
}

// Constrói o contorno de uma placa, incluindo tabs, notches e margens de canto.
function fingerPoints(width, height, thickness, fingerLength, kerf, edges) {
  const horizontalInset = Math.max(edges.horizontalInset || 0, 0);
  const horizontalCount = centeredSegmentCount(width - 2 * horizontalInset, fingerLength);
  const verticalCount = centeredSegmentCount(height, fingerLength);
  const points = [];
  const addEdge = (start, end, count, outward, mode, inset = 0) => {
    const edgeWidth = end[0] - start[0];
    const edgeHeight = end[1] - start[1];
    const edgeLength = Math.hypot(edgeWidth, edgeHeight);
    const unit = [edgeWidth / edgeLength, edgeHeight / edgeLength];
    const innerStart = [start[0] + unit[0] * inset, start[1] + unit[1] * inset];
    const innerEnd = [end[0] - unit[0] * inset, end[1] - unit[1] * inset];
    const stepX = (innerEnd[0] - innerStart[0]) / count;
    const stepY = (innerEnd[1] - innerStart[1]) / count;
    points.push([start[0], start[1]]);
    if (inset) points.push(innerStart);
    for (let index = 0; index < count; index += 1) {
      const ax = innerStart[0] + stepX * index;
      const ay = innerStart[1] + stepY * index;
      const bx = innerStart[0] + stepX * (index + 1);
      const by = innerStart[1] + stepY * (index + 1);
      const isNotch = mode && mode.startsWith('notch') && (mode === 'notch-even' ? index % 2 === 0 : index % 2 === 1);
      const isTab = mode && mode.startsWith('tab') && (mode === 'tab-even' ? index % 2 === 0 : index % 2 === 1);
      const engagement = isNotch ? thickness + kerf / 2 : thickness - kerf / 2;
      const direction = isTab ? 1 : -1;
      const normal = [outward[0] * direction * engagement, outward[1] * direction * engagement];
      points.push([ax, ay]);
      if ((isNotch || isTab) && index > 0 && index < count - 1) {
        points.push([ax + normal[0], ay + normal[1]], [bx + normal[0], by + normal[1]]);
      }
      points.push([bx, by]);
    }
    if (inset) points.push([end[0], end[1]]);
  };
  addEdge([0, 0], [width, 0], horizontalCount, [0, -1], edges.bottom, horizontalInset);
  addEdge([width, 0], [width, height], verticalCount, [1, 0], edges.right);
  addEdge([width, height], [0, height], horizontalCount, [0, 1], edges.top, horizontalInset);
  addEdge([0, height], [0, 0], verticalCount, [-1, 0], edges.left);
  return points;
}

// Retorna um contorno retangular para juntas lisas.
function rectanglePoints(width, height) {
  return [[0, 0], [width, 0], [width, height], [0, height]];
}

// Escolhe entre a geometria com dedos e a geometria lisa.
function panelPoints(width, height, thickness, fingerLength, kerf, edges, jointType) {
  return jointType === 'finger'
    ? fingerPoints(width, height, thickness, fingerLength, kerf, edges)
    : rectanglePoints(width, height);
}

// Converte uma paridade numérica no nome da borda esperado por fingerPoints.
function edgeMode(kind, parity) {
  return `${kind}-${parity === 0 ? 'even' : 'odd'}`;
}

// Mapeia a paridade quando a mesma borda é percorrida no sentido inverso.
function mappedParity(parity, count, reversed) {
  return reversed ? (count - 1 + parity) % 2 : parity;
}

// Cria as bordas com slots das divisórias internas.
function dividerPoints(width, height, thickness, fingerLength, kerf, slots, slotsFromTop, jointType) {
  if (jointType !== 'finger') return rectanglePoints(width, height);
  const points = [];
  const notchDepth = Math.max(thickness, thickness * 2 - kerf);
  const notchWidth = Math.min(thickness + kerf, fingerLength * .45);
  const addNotchedEdge = (fromTop) => {
    const orderedSlots = slots.slice().sort((a, b) => a - b);
    if (fromTop) {
      points.push([0, height]);
      orderedSlots.forEach((slot) => {
        points.push([slot - notchWidth / 2, height], [slot - notchWidth / 2, height - notchDepth], [slot + notchWidth / 2, height - notchDepth], [slot + notchWidth / 2, height]);
      });
      points.push([width, height]);
    } else {
      points.push([width, 0]);
      orderedSlots.slice().reverse().forEach((slot) => {
        points.push([slot + notchWidth / 2, 0], [slot + notchWidth / 2, notchDepth], [slot - notchWidth / 2, notchDepth], [slot - notchWidth / 2, 0]);
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

// Guarda o contorno e a transformação espacial de uma peça.
function piece(name, type, points, thickness, position, rotation = [0, 0, 0]) {
  return { name, type, points, thickness, position, rotation };
}

// Fonte única da geometria: alimenta simultaneamente SVG e preview 3D.
export function createBoxGeometry({ width, height, depth, thickness, preset, jointType, fingerLength, kerf, hasDividers, dividerRows, dividerColumns }) {
  const pieces = [];
  const innerWidth = Math.max(thickness, width - 2 * thickness);
  const innerDepth = Math.max(thickness, depth - 2 * thickness);
  const widthCount = centeredSegmentCount(innerWidth, fingerLength);
  const heightCount = centeredSegmentCount(height, fingerLength);
  const frontWallVerticalParity = 1;
  const backWallVerticalParity = 1;
  const sideFrontDirectParity = mappedParity(frontWallVerticalParity, heightCount, false);
  const sideFrontReversedParity = mappedParity(frontWallVerticalParity, heightCount, true);
  const sideBackDirectParity = mappedParity(backWallVerticalParity, heightCount, false);
  const sideBackReversedParity = mappedParity(backWallVerticalParity, heightCount, true);
  const frontBaseParity = mappedParity(1, widthCount, true);
  const backBaseParity = mappedParity(1, widthCount, false);
  const backLidParity = mappedParity(1, widthCount, true);
  const fingerEdges = (top = false) => ({
    bottom: 'notch-odd',
    right: edgeMode('tab', frontWallVerticalParity),
    top: top ? 'notch-odd' : false,
    left: edgeMode('tab', frontWallVerticalParity)
  });
  const leftEdges = (top = false) => ({
    bottom: 'notch-odd',
    right: edgeMode('notch', sideBackReversedParity),
    top: top ? 'notch-odd' : false,
    left: edgeMode('notch', sideFrontDirectParity),
    horizontalInset: thickness
  });
  const rightEdges = (top = false) => ({
    bottom: 'notch-odd',
    right: edgeMode('notch', sideFrontReversedParity),
    top: top ? 'notch-odd' : false,
    left: edgeMode('notch', sideBackDirectParity),
    horizontalInset: thickness
  });
  const baseEdges = {
    bottom: edgeMode('tab', backBaseParity),
    right: 'tab-odd',
    top: edgeMode('tab', frontBaseParity),
    left: 'tab-odd'
  };
  const lidEdges = {
    bottom: edgeMode('tab', backLidParity),
    right: 'tab-odd',
    top: 'tab-odd',
    left: 'tab-odd'
  };
  // Cria uma placa com pontos 2D e sua transformação no espaço da caixa.
  const panel = (name, type, panelWidth, panelHeight, position, rotation, edges) => pieces.push(piece(
    name,
    type,
    panelPoints(panelWidth, panelHeight, thickness, fingerLength, kerf, edges, jointType),
    thickness,
    position,
    rotation
  ));

  // Fundo e quatro paredes principais.
  panel('base', 'base', innerWidth, innerDepth, [-width / 2 + thickness, thickness, -depth / 2 + thickness], [Math.PI / 2, 0, 0], baseEdges);
  panel('front', 'wall', innerWidth, height, [-width / 2 + thickness, 0, depth / 2 - thickness], [0, 0, 0], fingerEdges(preset === 'lid'));
  panel('back', 'wall', innerWidth, height, [-width / 2 + thickness, 0, -depth / 2], [0, 0, 0], fingerEdges(preset === 'lid'));
  panel('left', 'wall', depth, height, [-width / 2, 0, depth / 2], [0, Math.PI / 2, 0], leftEdges(preset === 'lid'));
  panel('right', 'wall', depth, height, [width / 2, 0, -depth / 2], [0, -Math.PI / 2, 0], rightEdges(preset === 'lid'));

  // Tampa opcional, posicionada no topo das paredes.
  if (preset === 'lid') {
    panel('lid', 'lid', innerWidth, innerDepth, [-width / 2 + thickness, height, -depth / 2 + thickness], [Math.PI / 2, 0, 0], lidEdges);
  }

  // Divisórias internas e seus slots de encaixe.
  if (hasDividers) {
    const dividerHeight = preset === 'open' ? height : height - 2 * thickness;
    const rowSlots = Array.from({ length: Math.max(0, dividerColumns - 1) }, (_, index) => (width - 2 * thickness) * (index + 1) / dividerColumns);
    const columnSlots = Array.from({ length: Math.max(0, dividerRows - 1) }, (_, index) => (depth - 2 * thickness) * (index + 1) / dividerRows);
    for (let index = 1; index < dividerRows; index += 1) {
      const z = -depth / 2 + thickness + (depth - 2 * thickness) * index / dividerRows;
      pieces.push(piece(
        `divider-row-${index}`,
        'divider',
        dividerPoints(width - 2 * thickness, dividerHeight, thickness, fingerLength, kerf, rowSlots, true, jointType),
        thickness,
        [-width / 2 + thickness, 0, z - thickness / 2]
      ));
    }
    for (let index = 1; index < dividerColumns; index += 1) {
      const x = -width / 2 + thickness + (width - 2 * thickness) * index / dividerColumns;
      pieces.push(piece(
        `divider-column-${index}`,
        'divider',
        dividerPoints(depth - 2 * thickness, dividerHeight, thickness, fingerLength, kerf, columnSlots, false, jointType),
        thickness,
        [x - thickness / 2, 0, depth / 2 - thickness],
        [0, Math.PI / 2, 0]
      ));
    }
  }

  return { width, height, depth, thickness, preset, pieces };
}
