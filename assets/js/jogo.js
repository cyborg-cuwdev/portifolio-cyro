'use strict';

const get = id => document.getElementById(id);
const canvas = get('track');
const ctx = canvas.getContext('2d');
const wagonLayer = document.createElement('canvas');
wagonLayer.width = canvas.width;
wagonLayer.height = canvas.height;
const wagonCtx = wagonLayer.getContext('2d');
const approve = get('approve');
const reject = get('reject');
const start = get('start');
const result = get('result');
const player = get('player');
const palette = [
  ['#bb514c', '#f18b73', '#743b48'],
  ['#526eae', '#8eabe6', '#384775'],
  ['#bb8740', '#f2c56d', '#76543a'],
  ['#478879', '#89c6a3', '#335b5c'],
  ['#8c609e', '#c998ce', '#573e6d']
];
const centerY = 161;
const wagonHeight = 338;
const wagonSpacing = 356;
const hatchOffsets = [24, 124, 224];
const residuePatterns = [
  { colors: ['#343137', '#595057'], pixels: [[-8,-4,16,8],[-4,-8,8,4],[4,4,8,4],[-12,8,4,4],[-4,-4,8,4]] },
  { colors: ['#dedac8', '#fff8e3'], pixels: [[-12,0,4,4],[-8,-8,4,4],[0,4,8,4],[8,-8,4,4],[0,-4,8,4],[-8,8,4,4],[12,4,4,4]] },
  { colors: ['#75523c', '#d6a66a'], pixels: [[-12,-4,24,8],[-4,4,12,4],[-8,-4,12,4],[8,8,4,4]] }
];
const edgeFade = wagonCtx.createLinearGradient(0, 0, 0, canvas.height);
edgeFade.addColorStop(0, 'transparent');
edgeFade.addColorStop(.23, '#000');
edgeFade.addColorStop(.77, '#000');
edgeFade.addColorStop(1, 'transparent');
const zoneStart = centerY - wagonHeight / 2;
const openingDistance = 104;
const openingLeadMs = 500;
const nightBeam = ctx.createRadialGradient(280, 330, 105, 280, 330, 355);
nightBeam.addColorStop(0, '#161c3910');
nightBeam.addColorStop(.43, '#161c3930');
nightBeam.addColorStop(1, '#161c39d9');
let score = 0;
let phase = 'idle';
let wagons = [];
let active = null;
const entryY = -wagonHeight - 12;
let nightAmount = 0;
let sceneProgress = 1;
let ranking = [];
let online = null;

function renderRanking() {
  get('ranking').replaceChildren(...ranking.map(entry => {
    const item = document.createElement('li');
    item.textContent = entry.name + ' · ' + entry.score;
    return item;
  }));
}

function rect(color, x, top, width, height) {
  ctx.fillStyle = color;
  ctx.fillRect(x, top, width, height);
}

function drawShed(x, top, width, height) {
  rect('#80735a30', x + 8, top + 10, width, height);
  rect('#586264', x, top, width, height);
  rect('#a9b0ae', x + 4, top + 4, width - 8, height - 16);
  for (let seam = x + 8; seam < x + width - 8; seam += 8) {
    rect('#788484', seam, top + 4, 2, height - 16);
    rect('#d4d7cf', seam + 2, top + 4, 3, height - 16);
  }
  rect('#e0dfd3', x + 4, top + 4, width - 8, 4);
  rect('#838783', x + 4, top + height - 12, width - 8, 8);
  rect('#4b585d', x + 12, top + height - 12, 20, 8);
  for (const [dx, dy] of [[12, 18], [32, 52], [width - 16, height - 35]]) {
    rect('#ad8166', x + dx, top + dy, 4, 3);
    rect('#967766', x + dx + 2, top + dy + 3, 5, 3);
  }
}

function drawStairTower(x, top, flights) {
  const height = flights * 32;
  rect('#625a4933', x + 6, top + 8, 36, height);
  for (let offset = 0; offset < height; offset += 4) {
    const across = offset % 32;
    rect('#7e8076', x + 4 + across, top + offset, 4, 4);
    rect('#a9aaa0', x + 32 - across, top + offset, 4, 4);
    rect('#a8a99b', x + 7, top + offset, 21, 2);
  }
  for (let offset = 0; offset <= height; offset += 32) {
    rect('#666d68', x, top + offset, 38, 5);
    rect('#d5d4bc', x + 4, top + offset, 30, 2);
  }
  for (const edge of [x, x + 34]) {
    rect('#8b6d38', edge, top, 4, height + 5);
    rect('#dcb359', edge, top, 2, height + 5);
  }
}

function drawGround() {
  for (const [x, y, w, h] of [[6, 145, 118, 234], [440, 215, 114, 336], [62, 468, 57, 101]]) {
    rect('#d7ceb8', x, y, w, h);
    rect('#e4dcc9', x + 3, y + 3, w - 6, h - 6);
    for (let seam = y + 28; seam < y + h - 4; seam += 28) {
      rect('#cfc6b0', x + 3, seam, w - 6, 1);
    }
  }
  for (let i = 0; i < 140; i += 1) {
    const x = 9 + (i * 101 % 119) + (i % 2 ? 421 : 0);
    const y = (i * 67 % 652) + 4;
    rect(i % 3 ? '#bfa98942' : '#8d847048', x, y, i % 4 + 2, i % 3 + 1);
  }
}

function drawYardEquipment() {
  // Cabine de serviço, caixas e dutos afastados das escotilhas.
  drawShed(46, 56, 58, 56);
  for (const [x, y] of [[76, 392], [92, 402], [450, 145], [472, 153]]) {
    rect('#85745f', x, y, 14, 12);
    rect('#c7af87', x + 2, y + 2, 10, 7);
    rect('#f0d6a3', x + 3, y + 2, 8, 2);
  }
  rect('#777c75', 461, 63, 72, 7);
  rect('#a1a399', 461, 63, 72, 3);
  rect('#777c75', 528, 63, 6, 54);
  rect('#a1a399', 528, 68, 2, 46);
}

const yardLights = [[110, 146], [112, 322], [72, 512], [450, 229], [458, 420], [520, 581]];

function drawYardLights() {
  ctx.globalAlpha = nightAmount;
  for (const [x, y] of yardLights) {
    rect('#fff7d436', x - 7, y - 7, 14, 14);
    rect('#fff7d469', x - 4, y - 4, 8, 8);
    rect('#fffef8', x - 2, y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
}

function drawBuildings() {
  drawStairTower(22, 312, 9);
  drawShed(14, 160, 90, 190);
  rect('#4b585d', 64, 338, 15, 12);
  drawShed(470, 232, 76, 304);
  rect('#4b585d', 486, 232, 15, 10);
  drawStairTower(501, 388, 5);
  rect('#777973', 492, 540, 13, 65);
  rect('#c0bfb0', 495, 544, 6, 57);
}

function drawTrack() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGround();
  drawYardEquipment();
  drawBuildings();
  for (const [x, y] of yardLights) {
    rect('#6d6b61', x - 1, y, 2, 8);
    rect('#b8b3a1', x - 2, y - 2, 4, 4);
  }

  for (let i = 0; i < 170; i += 1) {
    const x = 138 + (i * 61 % 71) * 4;
    const top = (i * 19 % 165) * 4;
    rect(i % 2 ? '#e3d3b6' : '#fff6e4', x, top, i % 3 ? 4 : 8, 4);
  }
  for (let top = 0; top < 660; top += 36) {
    rect('#a88a68', 146, top, 268, 12);
    rect('#c8a885', 150, top, 260, 4);
    rect('#927457', 154, top + 8, 252, 4);
  }
  for (const rail of [182, 370]) {
    rect('#565b5b', rail, 0, 12, 660);
    rect('#c8cbc1', rail + 4, 0, 4, 660);
    for (let top = 0; top < 660; top += 36) {
      rect('#716c60', rail - 4, top + 4, 4, 4);
      rect('#716c60', rail + 12, top + 4, 4, 4);
    }
  }
}

const workerRoutes = [
  { at: 5, vest: '#f3943c', helmet: '#ffda74', points: [[0,124,8],[.7,124,125],[1.05,76,125],[1.55,76,125],[1.72,76,111]] },
  { at: 15, vest: '#e7aa38', helmet: '#f6f1ca', points: [[0,118,428],[.5,118,374],[.8,71,374],[1.35,71,374],[1.6,71,348]] },
  { at: 30, vest: '#f08043', helmet: '#ffe17d', points: [[0,442,508],[.9,442,365],[1.45,442,365],[2.3,442,508]] },
  { at: 35, vest: '#ce9b37', helmet: '#f9edce', points: [[0,552,188],[.5,493,188],[.78,493,212],[1.32,493,212],[1.58,493,233]] },
  { at: 45, vest: '#df8350', helmet: '#ffdb68', points: [[0,12,646],[.72,12,506],[1.24,12,506],[2,12,646]] }
];

function drawWorkers(progress) {
  for (const route of workerRoutes) {
    const elapsed = ((progress - route.at) % 45 + 45) % 45;
    const points = route.points;
    if (progress < route.at || elapsed >= points.at(-1)[0]) continue;
    const next = points.findIndex(point => point[0] > elapsed);
    const [from, x, y] = points[next - 1];
    const [to, endX, endY] = points[next];
    const part = (elapsed - from) / (to - from);
    const left = Math.round(x + (endX - x) * part);
    const top = Math.round(y + (endY - y) * part);
    const moving = x !== endX || y !== endY;
    const step = moving && Math.floor(elapsed * 19) % 2 ? 2 : 0;
    ctx.globalAlpha = Math.min(1, elapsed * 9, (points.at(-1)[0] - elapsed) * 12);
    rect('#302d2a45', left - 6, top + 3, 14, 9);
    rect('#263943', left - 4, top + 4 + step, 3, 6);
    rect('#263943', left + 1, top + 6 - step, 3, 6);
    rect('#4b4a44', left - 6, top - 3, 12, 10);
    rect(route.vest, left - 5, top - 2, 10, 8);
    rect('#fff4c2', left - 5, top + 3, 10, 2);
    rect('#a77b5b', left - 3, top - 5, 6, 4);
    rect('#524831', left - 5, top - 9, 10, 5);
    rect(route.helmet, left - 4, top - 10, 8, 5);
    rect('#fff3a0', left - 5, top - 6, 10, 2);
    ctx.globalAlpha = 1;
  }
}

const vliPalette = ['#a8afb1', '#e1e6e4', '#687a81'];
const vliGlyphs = [
  ['10001','10001','10001','10001','10001','01010','00100'],
  ['10000','10000','10000','10000','10000','10000','11111'],
  ['11111','00100','00100','00100','00100','00100','11111']
];

function drawVliMark(paint) {
  vliGlyphs.forEach((letter, index) => {
    letter.forEach((row, y) => {
      [...row].forEach((pixel, x) => {
        if (pixel === '1') paint('#075aa3', 210 + index * 48 + x * 8, 142 + y * 8, 8, 8);
      });
    });
  });
}

function drawWagon(wagon, target = wagonCtx) {
  const position = wagon.y;
  const opening = smoothstep((position - zoneStart + openingDistance + (wagon.openingLead ?? 0)) / openingDistance);
  const revealInterior = position >= zoneStart - (wagon.openingLead ?? 0) && !wagon.waiting;
  const top = Math.round(position / 4) * 4;
  const paint = (color, x, offset, width, height) => {
    target.fillStyle = color;
    target.fillRect(x, top + offset, width, height);
  };
  const [body, highlight, shade] = wagon.color;
  const outline = '#282937';

  // Engates, rodas e contorno em degraus.
  for (const offset of [-12, 330]) {
    paint(outline, 266, offset, 28, 20);
    paint('#8c929e', 274, offset + 4, 12, 12);
  }
  for (const offset of [36, 64, 256, 284]) {
    paint(outline, 158, offset, 244, 16);
    paint('#636776', 162, offset + 4, 236, 4);
  }
  paint(outline, 166, 12, 228, 312);
  paint(outline, 178, 0, 204, 336);
  paint(body, 174, 12, 212, 312);
  paint(highlight, 182, 4, 196, 8);
  paint(shade, 182, 324, 196, 8);

  // Três escotilhas e suas tampas recolhidas junto às dobradiças.
  paint(body, 186, 20, 188, 296);
  for (const offset of hatchOffsets) {
    paint(highlight, 190, offset, 168, 88);
    paint(outline, 194, offset + 4, 160, 80);
    paint('#526063', 198, offset + 8, 152, 72);
    paint('#909995', 202, offset + 16, 144, 60);
    paint('#aab3aa', 202, offset + 16, 4, 60);
    paint('#6c7977', 206, offset + 48, 140, 4);
    if (!revealInterior) paint('#39434b', 198, offset + 8, 152, 72);
    paint(outline, 354, offset + 8, 20, 72);
    paint(shade, 358, offset + 12, 12, 64);
    paint(highlight, 358, offset + 12, 4, 64);
    for (const hinge of [16, 64]) paint('#c8c8bc', 350, offset + hinge, 8, 4);
  }

  for (let offset = 28; offset <= 292; offset += 24) {
    paint(shade, 174, offset + 4, 12, 4);
    paint(highlight, 174, offset, 8, 4);
    paint(shade, 374, offset, 12, 8);
    paint(highlight, 374, offset, 4, 4);
  }
  for (const offset of [12, 316]) {
    paint(highlight, 190, offset, 180, 4);
    for (const x of [194, 218, 338, 362]) paint(outline, x, offset, 4, 4);
  }
  paint('#f1de9b', 178, 16, 8, 4);
  paint('#f1de9b', 374, 308, 8, 4);

  for (const piece of revealInterior ? wagon.residue : []) {
    const { colors, pixels } = piece.pattern;
    pixels.forEach(([x, offset, width, height], i) => {
      const dx = piece.mirrored ? -x - width : x;
      paint(colors[Number(i >= pixels.length - 3)], piece.x + dx, piece.y + offset, width, height);
    });
  }
  if (wagon.vli && revealInterior) drawVliMark(paint);
  // O aro das escotilhas bloqueia parte da luz, mesmo sob a lanterna.
  if (nightAmount > 0) {
    target.save();
    for (const offset of hatchOffsets) {
      target.globalAlpha = .58 * nightAmount;
      paint('#141a2b', 198, offset + 8, 152, 72);
      target.globalAlpha = .20 * nightAmount;
      paint('#121526', 198, offset + 8, 152, 12);
      paint('#121526', 330, offset + 20, 20, 60);
    }
    target.restore();
  }

  for (const offset of hatchOffsets) {
    const width = Math.round(148 * (1 - opening) / 4) * 4;
    if (!width) continue;
    const left = 354 - width;
    paint(outline, left, offset + 4, width, 80);
    paint(body, left + 4, offset + 8, Math.max(0, width - 4), 72);
    paint(highlight, left + 4, offset + 8, Math.max(0, width - 4), 4);
    paint(shade, left, offset + 72, width, 8);
    for (let rib = left + 12; rib < 350; rib += 20) {
      paint(shade, rib, offset + 16, 4, 56);
    }
  }
}

function drawPlatform() {
  const left = 66;
  const top = 536;
  const width = 428;

  rect('#3b38302e', left + 4, top + 8, width, 64);
  for (let row = 0; row < 16; row += 1) {
    const rise = row % 8;
    const inset = Math.min(rise, 8 - rise) * 3;
    for (let x = left + 10; x < left + width - 14; x += 24) {
      const metal = (row + x) % 7 < 2 ? '#a97b66' : '#807b7b';
      rect(metal, x + inset, top + row * 4, 4, 4);
      rect('#b6ab9f', x + 20 - inset, top + row * 4, 4, 4);
    }
  }
  for (const edge of [top, top + 64]) {
    rect('#bd8a29', left, edge, width, 8);
    rect('#ffda65', left + 4, edge, width - 8, 3);
  }
  for (const x of [left, left + width - 8]) {
    rect('#d9a436', x, top, 8, 72);
    rect('#ffe99c', x + 2, top + 6, 4, 4);
    rect('#ffe99c', x + 2, top + 62, 4, 4);
  }
}

function smoothstep(value) {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

function draw() {
  drawTrack();
  wagonCtx.clearRect(0, 0, canvas.width, canvas.height);
  for (const wagon of wagons) drawWagon(wagon);
  wagonCtx.globalCompositeOperation = 'destination-in';
  wagonCtx.fillStyle = edgeFade;
  wagonCtx.fillRect(0, 0, canvas.width, canvas.height);
  wagonCtx.globalCompositeOperation = 'source-over';
  ctx.drawImage(wagonLayer, 0, 0);
  drawPlatform();
  drawWorkers(sceneProgress);
  if (nightAmount > 0) {
    ctx.globalAlpha = nightAmount;
    ctx.fillStyle = nightBeam;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    drawYardLights();
  }
}

function intervalFor(number) {
  if (number <= 10) return 2000;
  if (number <= 25) return 1800;
  if (number <= 45) return 1600;
  if (number <= 70) return 1400;
  return 1200;
}

function updateTurn(progress) {
  sceneProgress = progress;
  nightAmount = smoothstep((progress - 15) / 5) * (1 - smoothstep((progress - 35) / 5));
  document.body.style.setProperty('--night', (nightAmount * 100).toFixed(1) + '%');
  document.body.toggleAttribute('data-dark', nightAmount >= .56);
}

function setStatus(message) {
  if (get('status').textContent !== message) get('status').textContent = message;
}

function setActive(wagon) {
  active = wagon;
  approve.disabled = reject.disabled = !active;
}

function finish(reason) {
  phase = 'over';
  setActive(null);
  setStatus('Fim de partida');
  get('feedback').textContent = reason + ' Pontuação: ' + score + '.';
  get('record').reset();
  player.setCustomValidity('');
  get('publish-status').textContent = '';
  result.showModal();
  get('result-title').focus();
}

async function refreshRanking() {
  const notice = get('ranking-source');
  const retry = get('retry-ranking');
  retry.hidden = true;
  get('empty-ranking').hidden = true;
  notice.textContent = 'Consultando o placar global…';
  try {
    const { ranking: entries } = await rankingOnline.load();
    ranking = entries.map(entry => ({ name: entry.apelido, score: entry.pontuacao }));
    renderRanking();
    get('empty-ranking').hidden = ranking.length > 0;
    notice.textContent = 'Placar global.';
  } catch {
    notice.textContent = 'O placar global está indisponível. Verifique a conexão.';
    retry.hidden = false;
  }
}

function onlineFailure(message) {
  phase = 'idle';
  online = null;
  setActive(null);
  setStatus(message);
  start.hidden = false;
  start.disabled = false;
  start.textContent = 'Tentar novamente';
  start.focus();
}

function onlineFrame(session) {
  if (phase !== 'running' || online !== session) return;
  const now = rankingOnline.now();
  while (!session.missed && now >= session.opens + intervalFor(session.number)) {
    if (session.accepted < session.number) break;
    session.opens += intervalFor(session.number++);
  }
  const interval = intervalFor(session.number);
  const position = Math.max(entryY, zoneStart + (now - session.opens) * wagonSpacing / interval);
  const nextOpens = session.opens + interval;
  for (const [number, opens] of [[session.number, session.opens], [session.number + 1, nextOpens]]) {
    if (now < opens - openingLeadMs - 175 || now < (session.retryAt.get(number) ?? 0) ||
        session.missed || session.cars.has(number) || session.requesting.has(number)) continue;
    session.requesting.add(number);
    rankingOnline.reveal(number).then(({ vagao, fecha }) => {
      if (online !== session || phase !== 'running' || session.missed) return;
      session.cars.set(number, {
        color: vagao.vli === true ? vliPalette : palette[vagao.paletteIndex],
        vli: vagao.vli === true,
        residue: vagao.residue.map(piece => ({ ...piece, pattern: residuePatterns[piece.patternIndex] })),
        closes: fecha
      });
      session.retryAt.delete(number);
    }).catch(error => {
      if (online !== session || phase !== 'running' || session.missed) return;
      if (error.data?.erro === 'cedo' || number !== session.number) {
        session.retryAt.set(number, rankingOnline.now() + 150);
      } else if (error.data?.erro === 'janela_expirada') {
        session.missed = true;
        setActive(null);
        setStatus('Vagão sem resposta');
      } else {
        onlineFailure('Partida encerrada. A conexão caiu antes de carregar o próximo vagão.');
      }
    }).finally(() => { session.requesting.delete(number); });
  }
  const currentCar = session.cars.get(session.number);
  const closes = currentCar?.closes ?? session.opens + Math.floor(wagonHeight * interval / wagonSpacing);
  if (now >= closes && !session.pending && session.accepted < session.number && !session.missed) {
    session.missed = true;
    setActive(null);
    setStatus('Vagão sem resposta');
  }
  const eligible = now >= session.opens && now < closes && !session.missed &&
    !session.pending && session.accepted < session.number && session.cars.has(session.number);
  if (eligible && !active) {
    setActive({ number: session.number });
    setStatus('Inspecione o interior');
  } else if (!eligible && active) {
    setActive(null);
  }
  wagons = [-1, 0, 1].map(offset => {
    const number = session.number - offset;
    const car = session.cars.get(number);
    return {
      number, y: position + offset * wagonSpacing,
      color: car?.color ?? palette[1],
      residue: car?.residue ?? [],
      vli: car?.vli ?? false,
      openingLead: openingLeadMs * wagonSpacing / interval,
      waiting: !car && number >= session.number
    };
  }).filter(wagon => wagon.number > 0 && wagon.y >= entryY && wagon.y < canvas.height + 12);
  session.cars.delete(session.number - 3);
  updateTurn(Math.max(1, session.number + (position - zoneStart) / wagonSpacing));
  draw();
  if (session.missed && position >= canvas.height + 12) finish('O vagão passou sem resposta.');
  else requestAnimationFrame(() => onlineFrame(session));
}

async function classifyOnline(approved) {
  const session = online;
  const number = active.number;
  if (rankingOnline.now() >= session.cars.get(number).closes) return;
  session.pending = true;
  setActive(null);
  try {
    const decision = await rankingOnline.decide(number, approved);
    if (online !== session || phase !== 'running') return;
    score = decision.pontuacao;
    get('score').textContent = score;
    if (decision.acerto) {
      session.accepted = number;
      setStatus('Acerto! +1 ponto');
    } else {
      finish(decision.sujo ? 'O vagão continha resíduos.' : 'O vagão estava limpo.');
    }
  } catch (error) {
    if (online !== session || phase !== 'running') return;
    if (error.data?.erro === 'janela_expirada') {
      session.missed = true;
      setStatus('Vagão sem resposta');
    } else {
      onlineFailure('Partida encerrada. O servidor não confirmou a última decisão.');
    }
  } finally {
    session.pending = false;
  }
}

get('retry-ranking').addEventListener('click', refreshRanking);
start.addEventListener('click', async () => {
  if (phase !== 'idle') return;
  phase = 'connecting';
  start.disabled = true;
  setStatus('Conectando ao jogo online…');
  try {
    await rankingOnline.start();
    score = 0;
    get('score').textContent = score;
    wagons = [];
    setActive(null);
    updateTurn(1);
    draw();
    const session = {
      number: 1, opens: rankingOnline.firstOpening(),
      accepted: 0, retryAt: new Map(), cars: new Map(),
      requesting: new Set(), pending: false, missed: false
    };
    online = session;
    phase = 'running';
    start.hidden = true;
    setStatus('Vagão chegando…');
    requestAnimationFrame(() => onlineFrame(session));
  } catch {
    const message = rankingOnline.available
      ? 'Não foi possível conectar. Verifique sua internet e tente novamente.'
      : 'Abra o jogo pelo endereço do site para iniciar uma partida online.';
    onlineFailure(message);
  } finally {
    start.disabled = false;
  }
});

function classify(approved) {
  if (phase !== 'running' || !active || !online || document.hidden) return;
  void classifyOnline(approved);
}

approve.addEventListener('click', () => classify(true));
reject.addEventListener('click', () => classify(false));
document.addEventListener('keydown', event => {
  if (!active || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
  const key = event.key.toLowerCase();
  if (key === 'a' || key === 'r') classify(key === 'a');
});
player.addEventListener('input', () => player.setCustomValidity(''));
get('record').addEventListener('submit', async event => {
  event.preventDefault();
  if (phase !== 'over' || !online) return;
  const name = player.value.trim();
  if ([...name].length < 2) {
    player.setCustomValidity('Use pelo menos dois caracteres.');
    player.reportValidity();
    return;
  }
  const submit = get('save-score');
  if (submit.disabled) return;
  submit.disabled = true;
  get('skip').disabled = true;
  get('publish-status').textContent = 'Publicando…';
  try {
    await rankingOnline.publish(name);
    result.close();
    void refreshRanking();
  } catch {
    get('publish-status').textContent = 'O placar não confirmou o envio. Tente novamente.';
  } finally {
    submit.disabled = false;
    get('skip').disabled = false;
  }
});
get('skip').addEventListener('click', () => result.close());
result.addEventListener('cancel', event => { if (get('save-score').disabled) event.preventDefault(); });
result.addEventListener('close', () => {
  phase = 'idle';
  online = null;
  start.textContent = 'Jogar novamente';
  start.hidden = false;
  start.focus();
});

function showTutorial() {
  const key = 'tiresias-tutorial-v1';
  try {
    if (localStorage.getItem(key) === 'done') return;
  } catch {
    // O tutorial também funciona sem armazenamento.
  }

  const tutorial = get('game-tutorial');
  const drawExample = (id, color, residue) => {
    const target = get(id).getContext('2d');
    target.translate(-150, -144);
    drawWagon({ y: 160, color, residue }, target);
  };
  drawExample('tutorial-clean', palette[4], []);
  drawExample('tutorial-dirty', palette[0], [
    { pattern: residuePatterns[0], x: 244, y: 65, mirrored: false },
    { pattern: residuePatterns[1], x: 306, y: 170, mirrored: true },
    { pattern: residuePatterns[2], x: 264, y: 275, mirrored: false }
  ]);

  tutorial.addEventListener('cancel', event => event.preventDefault());
  get('tutorial-start').addEventListener('click', () => {
    try {
      localStorage.setItem(key, 'done');
    } catch {
      // A tela pode ser fechada mesmo sem salvar a preferência.
    }
    tutorial.close();
    start.focus();
  });
  tutorial.showModal();
}

draw();
showTutorial();
void refreshRanking();
