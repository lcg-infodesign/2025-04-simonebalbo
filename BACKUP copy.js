// map-with-calibration.js
// Versione completa: crop corretto, calibrazione interattiva, suggerimento automatico di 3 punti dal CSV.
// Include: ICON_SHIFT applicato solo alle icone + debug visuale

let table;
let worldMapImg = null;
const MAX_MERCATOR_LAT = 85.0511287798066;
const MIN_MERCATOR_LAT = -85.0511287798066;
let MAX_MERC_N, MIN_MERC_N;

// se ritagli la mappa a sinistra, tieni qui lo stesso valore (px)
const CROP_LEFT = 0; // imposta a 10 se stai ancora usando crop
// shift applicato SOLO alle icone (px)
const ICON_SHIFT_X = 0;
const ICON_SHIFT_Y = -20;

const volcanoIcons = {
  "Stratovolcano": "assets/stratovolcano.svg",
  "Shield volcano": "assets/shield_volcano.svg",
  "Complex volcano": "assets/complex_volcano.svg",
  "Cinder cone": "assets/cinder_cone.svg",
  "Pyroclastic cone": "assets/pyroclastic_cone.svg",
  "Tuff cone": "assets/tuff_cone.svg",
  "Lava dome": "assets/lava_dome.svg",
  "Explosion crater": "assets/explosion_crater.svg",
  "Caldera": "assets/caldera.svg",
  "Fissure vent": "assets/fissure_vent.svg",
  "Maar": "assets/maar.svg",
  "Submarine volcano": "assets/submarine_volcano.svg",
  "Volcanic field": "assets/volcanic_field.svg",
  "Pumice cone": "assets/pumice_cone.svg",
  "Scoria cones": "assets/scoria_cones.svg"
};

let volcanoImages = {};
let staticLayer; // buffer per mappa + vulcani
let hoverInfo = null; // info tooltip
let selectedVolcano = null; // info card

let mapOffsetX = 0, mapOffsetY = 0, mapDrawW = 0, mapDrawH = 0;
const WORLD_MAP_URL = 'https://upload.wikimedia.org/wikipedia/commons/f/f4/Mercator_projection_SW.jpg';

// --- Calibrazione interattiva ---
let calibMode = false;            // se true, mouse click chiede lon/lat per calibrare
let calibPoints = [];            // array di {x,y,lon,lat,n}
let useCalibration = false;      // se true, lonLatToXY userà la calibrazione
let lonA = 0, lonB = 0;          // x = lonA * lon + lonB
let nA = 0, nB = 0;              // y = nA * n + nB   (n = mercN(lat))

function mercN(latDegrees) {
  const phi = radians(latDegrees);
  return Math.log(Math.tan(Math.PI / 4 + phi / 2));
}

function preload() {
  table = loadTable('assets/dataset.csv', 'csv', 'header');
  for (const [type, path] of Object.entries(volcanoIcons)) {
    volcanoImages[type] = loadImage(path);
  }
}

function setup() {
  const container = document.getElementById('map-container');
  if (!container) {
    console.error('Container #map-container non trovato!');
    return;
  }
  container.style.width = '100vw';
  container.style.height = '100vh';

  const canvas = createCanvas(container.clientWidth, container.clientHeight);
  canvas.parent(container);

  MAX_MERC_N = mercN(MAX_MERCATOR_LAT);
  MIN_MERC_N = mercN(MIN_MERCATOR_LAT);

  staticLayer = createGraphics(width, height);

  loadImage(WORLD_MAP_URL, img => {
    worldMapImg = img;
    computeMapDrawArea();
    drawStaticLayer();
    // suggerisci punti automaticamente (log + visuale)
    suggestCalibrationCandidates();
  }, err => {
    console.warn('Errore caricamento mappa, useremo fallback graticola.', err);
    computeMapDrawArea();
    drawStaticLayer();
    suggestCalibrationCandidates();
  });
}

function windowResized() {
  const container = document.getElementById('map-container');
  if (!container) return;

  resizeCanvas(container.clientWidth, container.clientHeight);
  staticLayer.resizeCanvas(width, height);

  computeMapDrawArea();
  drawStaticLayer();
}

function computeMapDrawArea() {
  if (!worldMapImg) {
    mapOffsetX = 0; mapOffsetY = 0; mapDrawW = width; mapDrawH = height;
    return;
  }

  // dimensione sorgente effettiva dopo il ritaglio
  const srcWidth = worldMapImg.width - CROP_LEFT;
  const srcHeight = worldMapImg.height;

  // scale basata sulla porzione visibile (srcWidth x srcHeight)
  const scale = Math.min(width / srcWidth, height / srcHeight);

  // mapDrawW / mapDrawH sono ora la dimensione della PORZIONE VISIBILE sul canvas
  mapDrawW = srcWidth * scale;
  mapDrawH = srcHeight * scale;

  // offset centrato rispetto alla porzione visibile
  mapOffsetX = (width - mapDrawW) / 2;
  mapOffsetY = (height - mapDrawH) / 2;
}

// lonLatToXY supporta calibrazione (useCalibration) e fallback al comportamento "calcolato"
function lonLatToXY(lon, lat) {
  lon = parseFloat(lon);
  lat = parseFloat(lat);
  if (!isFinite(lon) || !isFinite(lat)) return { x: NaN, y: NaN };

  // Se abbiamo una calibrazione valida, usala (trasformazione lineare misurata)
  if (useCalibration) {
    const x = lonA * lon + lonB;
    const n = mercN(constrain(lat, MIN_MERCATOR_LAT, MAX_MERCATOR_LAT));
    const y = nA * n + nB;
    return { x, y };
  }

  // Altrimenti fallback: comportamento originale che usa mapOffset/mapDrawW e il crop
  if (worldMapImg) {
    const srcWidth = worldMapImg.width - CROP_LEFT;
    const leftLon = -180 + (CROP_LEFT / worldMapImg.width) * 360;
    const lonRange = 360 * (srcWidth / worldMapImg.width);
    const frac = (lon - leftLon) / lonRange;
    const fracClamped = constrain(frac, 0, 1);
    const x = mapOffsetX + fracClamped * mapDrawW;

    const n = mercN(constrain(lat, MIN_MERCATOR_LAT, MAX_MERCATOR_LAT));
    const t = (MAX_MERC_N - n) / (MAX_MERC_N - MIN_MERC_N);
    const y = mapOffsetY + t * mapDrawH;

    return { x, y };
  } else {
    // fallback senza immagine
    const x = mapOffsetX + ((lon + 180) / 360) * mapDrawW;
    const n = mercN(constrain(lat, MIN_MERCATOR_LAT, MAX_MERCATOR_LAT));
    const t = (MAX_MERC_N - n) / (MAX_MERC_N - MIN_MERC_N);
    const y = mapOffsetY + t * mapDrawH;
    return { x, y };
  }
}

function drawStaticLayer() {
  staticLayer.clear();
  staticLayer.background(245);

  if (worldMapImg) {
    staticLayer.image(
      worldMapImg,
      mapOffsetX, mapOffsetY, mapDrawW, mapDrawH, // dest
      CROP_LEFT, 0, worldMapImg.width - CROP_LEFT, worldMapImg.height // source rect
    );
  } else {
    drawMercatorGrid(staticLayer);
  }

  if (!table) {
    redraw();
    return;
  }
  const latCol = table.columns.find(c => c.toLowerCase().includes('latitude'));
  const lonCol = table.columns.find(c => c.toLowerCase().includes('longitude'));
  const typeCol = table.columns.find(c => c.toLowerCase().includes('type'));
  if (!latCol || !lonCol || !typeCol) {
    redraw();
    return;
  }

  // Disegniamo le icone NELLO staticLayer ma applicando lo shift SOLO alle icone.
  for (let r = 0; r < table.getRowCount(); r++) {
    const lat = parseFloat(table.getString(r, latCol).trim());
    const lon = parseFloat(table.getString(r, lonCol).trim());
    const type = table.getString(r, typeCol).trim();
    if (!isFinite(lat) || !isFinite(lon)) continue;

    // posizione logica sulla mappa (lonLatToXY già considera il CROP_LEFT o la calibrazione)
    const pBase = lonLatToXY(lon, lat);

    // posizione visuale dell'icona: applichiamo qui ICON_SHIFT
    const iconX = pBase.x + ICON_SHIFT_X;
    const iconY = pBase.y + ICON_SHIFT_Y;

    if (volcanoImages[type]) {
      staticLayer.push();
      staticLayer.tint(255, 180); // opacità 70%
      staticLayer.image(volcanoImages[type], iconX - 6, iconY - 6, 12, 12);
      staticLayer.pop();
    } else {
      staticLayer.fill(230, 60, 60, 180);
      staticLayer.noStroke();
      staticLayer.ellipse(iconX, iconY, 12, 12);
    }
  }

  // Se ci sono punti suggeriti, disegnali
  if (suggestedCandidates && suggestedCandidates.length > 0) {
    staticLayer.push();
    staticLayer.noStroke();
    for (let s of suggestedCandidates) {
      staticLayer.fill(255, 200, 0);
      staticLayer.ellipse(s.x, s.y, 10, 10);
      staticLayer.fill(0);
      staticLayer.textSize(11);
      staticLayer.textAlign(LEFT, BOTTOM);
      staticLayer.text(s.label, s.x + 6, s.y - 4);
    }
    staticLayer.pop();
  }

  redraw();
}

function draw() {
  image(staticLayer, 0, 0);
  hoverInfo = null;

  if (!table) return;
  const latCol = table.columns.find(c => c.toLowerCase().includes('latitude'));
  const lonCol = table.columns.find(c => c.toLowerCase().includes('longitude'));
  const typeCol = table.columns.find(c => c.toLowerCase().includes('type'));
  const nameCol = table.columns[1]; // seconda colonna con nome
  if (!latCol || !lonCol || !typeCol) return;

  for (let r = 0; r < table.getRowCount(); r++) {
    const lat = parseFloat(table.getString(r, latCol).trim());
    const lon = parseFloat(table.getString(r, lonCol).trim());
    const type = table.getString(r, typeCol).trim();
    const name = table.getString(r, nameCol).trim();
    if (!isFinite(lat) || !isFinite(lon)) continue;

    // posizione logica
    const pBase = lonLatToXY(lon, lat);
    // posizione icona (applichiamo lo shift)
    const pIcon = { x: pBase.x + ICON_SHIFT_X, y: pBase.y + ICON_SHIFT_Y };

    // Hover: se il mouse è vicino all'icona, mostriamo tooltip e icona non trasparente
    if (dist(mouseX, mouseY, pIcon.x, pIcon.y) < 6 && volcanoImages[type]) {
      hoverInfo = { x: pIcon.x, y: pIcon.y, name: name, type: type };
      push();
      tint(255, 255);
      image(volcanoImages[type], pIcon.x - 6, pIcon.y - 6, 12, 12);
      pop();
    }
  }

  // tooltip
  if (hoverInfo) {
    push();
    fill(50, 50, 50, 220);
    noStroke();
    rect(hoverInfo.x + 10, hoverInfo.y - 10, textWidth(hoverInfo.name) + 8, 18, 4);
    fill(255);
    textSize(12);
    textAlign(LEFT, CENTER);
    text(hoverInfo.name, hoverInfo.x + 14, hoverInfo.y + 1);
    pop();
  }

  // disegna punti di calibrazione se presenti (debug)
  if (calibPoints.length > 0) {
    push();
    noStroke();
    fill(255, 0, 0);
    for (let p of calibPoints) {
      ellipse(p.x, p.y, 8, 8);
      fill(0);
      textSize(11);
      textAlign(LEFT, BOTTOM);
      text(`${p.lon.toFixed(3)},${p.lat.toFixed(3)}`, p.x + 6, p.y - 6);
      fill(255, 0, 0);
    }
    pop();
  }

  // card dettagli vulcano
  if (selectedVolcano !== null) {
    push();
    fill(255); // sfondo bianco
    stroke(0); // bordo nero opzionale
    strokeWeight(1);
    const cardX = 20, cardY = 20, cardW = 260;
    const cardH = 20 + 18 * table.columns.length;
    rect(cardX, cardY, cardW, cardH, 6);

    fill(0); // testo nero
    noStroke();
    textSize(12);
    textAlign(LEFT, TOP);
    let y = cardY + 8;
    for (let col of table.columns) {
      const value = table.getString(selectedVolcano, col).trim();
      text(`• ${col}: ${value}`, cardX + 8, y);
      y += 18;
    }
    pop();
  }

  cursor(hoverInfo ? HAND : ARROW);
}

function drawMercatorGrid(g) {
  g.noStroke();
  g.fill(234, 244, 255);
  g.rect(0, 0, width, height);
  g.stroke(200);
  g.strokeWeight(1);
  for (let lon = -180; lon <= 180; lon += 30) {
    g.beginShape();
    for (let lat = -80; lat <= 80; lat += 2) {
      const p = lonLatToXY(lon, lat);
      g.vertex(p.x, p.y);
    }
    g.endShape();
  }
  for (let lat = -60; lat <= 80; lat += 30) {
    g.beginShape();
    for (let lon = -180; lon <= 180; lon += 2) {
      const p = lonLatToXY(lon, lat);
      g.vertex(p.x, p.y);
    }
    g.endShape();
  }
}

function mouseMoved() {
  redraw();
}

function mousePressed() {
  // Gestione calibrazione interattiva
  if (calibMode) {
    const user = prompt("Inserisci lon,lat per il punto cliccato (es: 12.34,41.90) - ATTENZIONE: ordine = lon,lat");
    if (!user) return;
    const parts = user.split(',').map(s => parseFloat(s.trim()));
    if (parts.length < 2 || !isFinite(parts[0]) || !isFinite(parts[1])) {
      alert("Coordinata non valida. Riprova.");
      return;
    }
    const lon = parts[0], lat = parts[1];
    const x = mouseX, y = mouseY;
    const n = mercN(constrain(lat, MIN_MERCATOR_LAT, MAX_MERCATOR_LAT));
    calibPoints.push({ x, y, lon, lat, n });
    console.log("Calib point aggiunto:", calibPoints);

    if (calibPoints.length >= 2) {
      const doFinish = confirm("Hai almeno 2 punti. Vuoi terminare la calibrazione ora?");
      if (doFinish) finishCalibration();
    }
    return; // non eseguire la logica di selezione vulcano quando siamo in calibrazione
  }

  // Selezione vulcano (comportamento originale)
  if (!table) return;
  const latCol = table.columns.find(c => c.toLowerCase().includes('latitude'));
  const lonCol = table.columns.find(c => c.toLowerCase().includes('longitude'));
  if (!latCol || !lonCol) return;

  selectedVolcano = null;

  for (let r = 0; r < table.getRowCount(); r++) {
    const lat = parseFloat(table.getString(r, latCol).trim());
    const lon = parseFloat(table.getString(r, lonCol).trim());
    if (!isFinite(lat) || !isFinite(lon)) continue;

    // posizione logica + shift per l'icona
    const pBase = lonLatToXY(lon, lat);
    const p = { x: pBase.x + ICON_SHIFT_X, y: pBase.y + ICON_SHIFT_Y };

    if (dist(mouseX, mouseY, p.x, p.y) < 6) {
      selectedVolcano = r;
      break;
    }
  }
}

function startCalibration() {
  calibMode = true;
  calibPoints = [];
  useCalibration = false;
  console.log("Calibration ON: click on map points and enter known lon,lat. Press 'c' to finish.");
}

function finishCalibration() {
  calibMode = false;
  if (calibPoints.length < 2) {
    console.warn("Serve almeno 2 punti per calibrazione. Hai fornito:", calibPoints.length);
    return;
  }

  // Calibrazione X (lon -> x): regressione lineare lon -> x
  let sumLon = 0, sumX = 0, sumLonX = 0, sumLon2 = 0;
  for (let p of calibPoints) {
    sumLon += p.lon; sumX += p.x; sumLonX += p.lon * p.x; sumLon2 += p.lon * p.lon;
  }
  const n = calibPoints.length;
  const denom = (n * sumLon2 - sumLon * sumLon);
  if (Math.abs(denom) < 1e-9) {
    console.warn("Impossibile calcolare trasformazione longitudine (denom ~ 0).");
    return;
  }
  lonA = (n * sumLonX - sumLon * sumX) / denom;
  lonB = (sumX - lonA * sumLon) / n;

  // Calibrazione Y (n = mercN(lat) -> y): regressione lineare n->y
  let sumN = 0, sumY = 0, sumNY = 0, sumN2 = 0;
  for (let p of calibPoints) {
    sumN += p.n; sumY += p.y; sumNY += p.n * p.y; sumN2 += p.n * p.n;
  }
  const denom2 = (n * sumN2 - sumN * sumN);
  if (Math.abs(denom2) < 1e-9) {
    console.warn("Impossibile calcolare trasformazione latitudine (denom ~ 0).");
    return;
  }
  nA = (n * sumNY - sumN * sumY) / denom2;
  nB = (sumY - nA * sumN) / n;

  useCalibration = true;
  console.log("Calibrazione completata. useCalibration = true");
  console.log("lonA, lonB:", lonA, lonB);
  console.log("nA, nB:", nA, nB);
  // ridisegna static layer con la nuova trasformazione
  drawStaticLayer();
}

function keyPressed() {
  if (key === 'c' || key === 'C') {
    if (!calibMode) {
      startCalibration();
    } else {
      finishCalibration();
      calibMode = false;
    }
  }
}

// --- SUGGERIMENTO AUTOMATICO: calcola 3 punti (min lon, max lon, mediana lon) dal CSV ---
// e disegnali, e stampa le coordinate in console. Utile come punto di partenza per calibrare.
let suggestedCandidates = [];

function suggestCalibrationCandidates() {
  suggestedCandidates = [];
  if (!table) return;
  const latCol = table.columns.find(c => c.toLowerCase().includes('latitude'));
  const lonCol = table.columns.find(c => c.toLowerCase().includes('longitude'));
  const nameCol = table.columns[1] || table.columns[0];
  if (!latCol || !lonCol) return;

  // costruiamo array di rows con lon
  const rows = [];
  for (let r = 0; r < table.getRowCount(); r++) {
    const lat = parseFloat(table.getString(r, latCol).trim());
    const lon = parseFloat(table.getString(r, lonCol).trim());
    const name = table.getString(r, nameCol).trim();
    if (!isFinite(lat) || !isFinite(lon)) continue;
    rows.push({ r, lat, lon, name });
  }
  if (rows.length < 2) return;

  // ordina per lon
  rows.sort((a, b) => a.lon - b.lon);
  const first = rows[0];
  const last = rows[rows.length - 1];
  const mid = rows[Math.floor(rows.length / 2)];

  const candidates = [first, mid, last];
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const p = lonLatToXY(c.lon, c.lat);
    suggestedCandidates.push({ x: p.x, y: p.y, label: `${c.name}` });
    console.log(`Candidate ${i+1}: row ${c.r}, name=${c.name}, lon=${c.lon}, lat=${c.lat}`);
  }
  // ridisegniamo static layer per mostrare i markers
  drawStaticLayer();
}
