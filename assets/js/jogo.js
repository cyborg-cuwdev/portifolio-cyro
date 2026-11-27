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
const rankingKey = 'cyro-inspecao-highscore-v1';
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
const zoneEnd = centerY + wagonHeight / 2;
const openingDistance = 104;
const nightBeam = ctx.createRadialGradient(280, 330, 105, 280, 330, 355);
nightBeam.addColorStop(0, '#161c3910');
nightBeam.addColorStop(.43, '#161c3930');
nightBeam.addColorStop(1, '#161c39d9');
let score = 0;
let phase = 'idle';
let wagons = [];
let active = null;
let nextNumber = 1;
let previousFrame;
const entryY = -wagonHeight - 12;
let nightAmount = 0;
let missed = null;
let ranking = [];
const mode = get('game-mode');
let online = null;
let localRanking;

try {
  const saved = JSON.parse(localStorage.getItem(rankingKey));
  if (Array.isArray(saved)) {
    ranking = saved.filter(entry => typeof entry?.name === 'string' &&
      Number.isSafeInteger(entry.score) && entry.score >= 0);
  }
} catch {
  // O placar continua disponível durante a sessão.
}

localRanking = ranking;
mode.disabled = !rankingOnline.available;
if (rankingOnline.available) get('mode-choice').hidden = false;

function renderRanking() {
  ranking.sort((a, b) => b.score - a.score);
  ranking.length = Math.min(10, ranking.length);
  get('empty-ranking').hidden = ranking.length > 0;
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

function drawBuildings() {
  drawShed(14, 160, 90, 190);
  drawShed(470, 232, 76, 304);
  drawStairTower(22, 440, 5);
  drawStairTower(501, 388, 5);
  rect('#777973', 492, 540, 13, 65);
  rect('#c0bfb0', 495, 544, 6, 57);
}

function drawTrack() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBuildings();

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

function drawWagon(wagon) {
  const position = wagon.y;
  const opening = wagon.waiting ? 0 : smoothstep((position - zoneStart + openingDistance) / openingDistance);
  const top = Math.round(position / 4) * 4;
  const paint = (color, x, offset, width, height) => {
    wagonCtx.fillStyle = color;
    wagonCtx.fillRect(x, top + offset, width, height);
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

  for (const piece of position >= zoneStart ? wagon.residue : []) {
    const { colors, pixels } = piece.pattern;
    pixels.forEach(([x, offset, width, height], i) => {
      const dx = piece.mirrored ? -x - width : x;
      paint(colors[Number(i >= pixels.length - 3)], piece.x + dx, piece.y + offset, width, height);
    });
  }
  // O aro das escotilhas bloqueia parte da luz, mesmo sob a lanterna.
  if (nightAmount > 0) {
    wagonCtx.save();
    for (const offset of hatchOffsets) {
      wagonCtx.globalAlpha = .58 * nightAmount;
      paint('#141a2b', 198, offset + 8, 152, 72);
      wagonCtx.globalAlpha = .20 * nightAmount;
      paint('#121526', 198, offset + 8, 152, 12);
      paint('#121526', 330, offset + 20, 20, 60);
    }
    wagonCtx.restore();
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
  if (nightAmount > 0) {
    ctx.globalAlpha = nightAmount;
    ctx.fillStyle = nightBeam;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
  }
}

function makeResidue() {
  const pattern = residuePatterns[Math.floor(Math.random() * residuePatterns.length)];
  const firstHatch = Math.floor(Math.random() * hatchOffsets.length);
  const spread = Math.random() < .5;
  const count = 1 + Math.floor(Math.random() * 4);
  const centerX = 232 + Math.floor(Math.random() * 20) * 4;
  return Array.from({ length: count }, (_, i) => {
    const hatch = hatchOffsets[(firstHatch + (spread ? i : 0)) % hatchOffsets.length];
    return {
      pattern,
      x: spread ? 224 + Math.floor(Math.random() * 26) * 4 : centerX + i * 8 - 12,
      y: hatch + 28 + Math.floor(Math.random() * 9) * 4,
      mirrored: Math.random() < .5
    };
  });
}

function makeWagon(y) {
  const dirty = Math.random() < .5;
  return {
    number: nextNumber++, y, judged: false,
    color: palette[Math.floor(Math.random() * palette.length)],
    residue: dirty ? makeResidue() : []
  };
}

function intervalFor(number) {
  if (number <= 10) return 2000;
  if (number <= 25) return 1800;
  if (number <= 45) return 1600;
  if (number <= 70) return 1400;
  return 1200;
}

function updateTurn(progress) {
  nightAmount = smoothstep((progress - 15) / 5) * (1 - smoothstep((progress - 35) / 5));
  document.body.style.setProperty('--night', (nightAmount * 100).toFixed(1) + '%');
  document.body.toggleAttribute('data-dark', nightAmount >= .56);
  const label = nightAmount === 0 ? 'Dia' : nightAmount === 1 ? 'Noite'
    : progress < 21 ? 'Anoitecendo' : 'Amanhecendo';
  if (get('shift').textContent !== label) get('shift').textContent = label;
}

function setStatus(message) {
  if (get('status').textContent !== message) get('status').textContent = message;
}

function setActive(wagon) {
  active = wagon;
  approve.disabled = reject.disabled = !active;
}

function frame(now) {
  if (phase !== 'running') return;
  const elapsed = previousFrame === undefined || document.hidden ? 0 : Math.min(100, now - previousFrame);
  previousFrame = now;

  const lead = wagons.find(wagon => wagon.y < zoneEnd) ?? wagons.at(-1);
  const progress = lead.number + (lead.y - zoneStart) / wagonSpacing;
  const distance = elapsed * wagonSpacing / intervalFor(Math.max(1, Math.floor(progress)));
  for (const wagon of wagons) wagon.y += distance;
  const tail = wagons.at(-1);
  if (!missed && tail.y >= entryY + wagonSpacing) wagons.push(makeWagon(tail.y - wagonSpacing));

  if (!missed) {
    missed = wagons.find(wagon => !wagon.judged && wagon.y >= zoneEnd) ?? null;
    if (missed) {
      setActive(null);
      setStatus('Vagão sem resposta');
    } else {
      const candidate = wagons.find(wagon => !wagon.judged && wagon.y >= zoneStart);
      if (candidate && active !== candidate) {
        setActive(candidate);
        get('wagon-number').textContent = candidate.number;
        setStatus('Inspecione o interior');
      }
    }
  }

  wagons = wagons.filter(wagon => wagon.y < canvas.height + 12);
  updateTurn(Math.max(1, progress));
  draw();
  if (missed && missed.y >= canvas.height + 12) finish('O vagão passou sem resposta.');
  else requestAnimationFrame(frame);
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
  player.focus();
}

async function refreshRanking() {
  const notice = get('ranking-source');
  if (!mode.checked) {
    ranking = localRanking;
    notice.textContent = 'Placar salvo neste navegador.';
    renderRanking();
    return;
  }
  ranking = [];
  renderRanking();
  notice.textContent = 'Consultando o placar online…';
  try {
    const { ranking: entries } = await rankingOnline.load();
    if (!mode.checked) return;
    ranking = entries.map(entry => ({ name: entry.apelido, score: entry.pontuacao }));
    notice.textContent = 'Placar compartilhado.';
    renderRanking();
  } catch {
    if (mode.checked) notice.textContent = 'Placar online indisponível. Tente novamente.';
  }
}

function onlineFailure(message) {
  phase = 'idle';
  online = null;
  setActive(null);
  setStatus(message);
  mode.disabled = false;
  start.hidden = false;
  start.textContent = 'Jogar novamente';
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
  if (now >= session.opens - 175 && now >= session.retryAt && !session.requesting &&
      !session.missed && !session.pending && !session.cars.has(session.number)) {
    const number = session.number;
    session.requesting = true;
    rankingOnline.reveal(number).then(({ vagao, fecha }) => {
      if (online !== session || session.missed) return;
      session.cars.set(number, {
        color: palette[vagao.paletteIndex],
        residue: vagao.residue.map(piece => ({ ...piece, pattern: residuePatterns[piece.patternIndex] }))
      });
      session.closes = fecha;
    }).catch(error => {
      if (online !== session || phase !== 'running' || session.missed) return;
      if (error.data?.erro === 'cedo') {
        session.retryAt = now + 75;
      } else if (error.data?.erro === 'janela_expirada') {
        session.missed = true;
        setActive(null);
        setStatus('Vagão sem resposta');
      } else {
        onlineFailure('Conexão interrompida. Inicie outra partida.');
      }
    }).finally(() => { session.requesting = false; });
  }
  const closes = session.cars.has(session.number) ? session.closes
    : session.opens + Math.floor(wagonHeight * interval / wagonSpacing);
  if (now >= closes && !session.pending && session.accepted < session.number && !session.missed) {
    session.missed = true;
    setActive(null);
    setStatus('Vagão sem resposta');
  }
  const eligible = now >= session.opens && now < closes && !session.missed &&
    !session.pending && session.accepted < session.number && session.cars.has(session.number);
  if (eligible && !active) {
    setActive({ number: session.number });
    get('wagon-number').textContent = session.number;
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
  if (rankingOnline.now() >= session.closes) return;
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
      onlineFailure('Não foi possível confirmar a decisão. Inicie outra partida.');
    }
  } finally {
    session.pending = false;
  }
}

mode.addEventListener('change', refreshRanking);

function classify(approved) {
  if (phase !== 'running' || !active || document.hidden) return;
  if (online) { void classifyOnline(approved); return; }
  const clean = active.residue.length === 0;
  if (approved !== clean) {
    finish(clean ? 'O vagão estava limpo.' : 'O vagão continha resíduos.');
    return;
  }
  active.judged = true;
  setActive(null);
  score += 1;
  get('score').textContent = score;
  setStatus('Acerto! +1 ponto');
}

start.addEventListener('click', async () => {
  if (phase === 'running') return;
  phase = 'running';
  start.hidden = true;
  mode.disabled = true;
  online = null;
  score = 0;
  nextNumber = 1;
  previousFrame = undefined;
  missed = null;
  wagons = [makeWagon(entryY)];
  get('score').textContent = score;
  get('wagon-number').textContent = '—';
  setActive(null);
  setStatus('Vagão chegando…');
  updateTurn(1);
  draw();
  if (!mode.checked) {
    requestAnimationFrame(frame);
    return;
  }
  wagons = [];
  draw();
  setStatus('Conectando ao placar online…');
  try {
    await rankingOnline.start();
    online = {
      number: 1, opens: rankingOnline.firstOpening(), closes: 0,
      accepted: 0, retryAt: 0, cars: new Map(),
      requesting: false, pending: false, missed: false
    };
    setStatus('Vagão chegando…');
    requestAnimationFrame(() => onlineFrame(online));
  } catch {
    onlineFailure('Não foi possível abrir uma partida online.');
  }
});
document.addEventListener('visibilitychange', () => { previousFrame = undefined; });
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
  const name = player.value.trim();
  if (!name) {
    player.setCustomValidity('Digite seu nome.');
    player.reportValidity();
    return;
  }
  if (online) {
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
    return;
  }
  ranking.push({ name, score });
  renderRanking();
  try {
    localStorage.setItem(rankingKey, JSON.stringify(ranking));
  } catch {
    document.querySelector('.game-ranking .muted').textContent = 'Placar disponível durante esta sessão.';
  }
  result.close();
});
get('skip').addEventListener('click', () => result.close());
result.addEventListener('cancel', event => { if (get('save-score').disabled) event.preventDefault(); });
result.addEventListener('close', () => {
  mode.disabled = !rankingOnline.available;
  start.textContent = 'Jogar novamente';
  start.hidden = false;
  start.focus();
});

draw();
renderRanking();
