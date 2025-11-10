// map-no-map.js
// Versione planare con toggle griglia (checkbox + scorciatoia 'g').
// Nessuna immagine di sfondo, nessuna proiezione geografica complessa.

// -----------------------------
// dati e immagini
let table;
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
let flagCache = {};     
let staticLayer;
let hoverInfo = null;
let selectedVolcano = null; // controlla la visibilità delle 3 cards
let tempCardBBoxes = []; // bbox temporanei delle 3 cards (popolati quando si disegnano le cards)
let showGrid = true;
let gridCheckbox = null;

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
  container.style.position = 'relative';
  container.style.width = '100vw';
  container.style.height = '100vh';
  const canvas = createCanvas(container.clientWidth, container.clientHeight);
  canvas.parent(container);
  staticLayer = createGraphics(width, height);
  createGridToggle(container);
  drawStaticLayer();
}

function windowResized() {
  const container = document.getElementById('map-container');
  if (!container) return;
  resizeCanvas(container.clientWidth, container.clientHeight);
  staticLayer.resizeCanvas(width, height);
  drawStaticLayer();
}

function createGridToggle(container) {
  const existing = document.getElementById('grid-toggle-wrapper');
  if (existing) existing.remove();
  const wrapper = document.createElement('div');
  wrapper.id = 'grid-toggle-wrapper';
  wrapper.style.position = 'absolute';
  wrapper.style.top = '10px';
  wrapper.style.right = '10px';
  wrapper.style.background = 'rgba(255,255,255,0.9)';
  wrapper.style.padding = '6px 8px';
  wrapper.style.borderRadius = '6px';
  wrapper.style.boxShadow = '0 1px 4px rgba(0,0,0,0.15)';
  wrapper.style.fontFamily = 'sans-serif';
  wrapper.style.fontSize = '13px';
  wrapper.style.zIndex = 10;
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = 'grid-toggle';
  checkbox.checked = showGrid;
  checkbox.style.marginRight = '6px';
  const label = document.createElement('label');
  label.htmlFor = 'grid-toggle';
  label.innerText = 'Mostra griglia (G)';
  checkbox.addEventListener('change', () => {
    showGrid = checkbox.checked;
    drawStaticLayer();
  });
  wrapper.appendChild(checkbox);
  wrapper.appendChild(label);
  container.appendChild(wrapper);
  gridCheckbox = checkbox;
}

function keyPressed() {
  if (key === 'g' || key === 'G') {
    showGrid = !showGrid;
    if (gridCheckbox) gridCheckbox.checked = showGrid;
    drawStaticLayer();
  }
}

function detectColumns() {
  if (!table) return {};
  const cols = table.columns.map(c => c.toLowerCase());
  function find(preds) {
    for (let p of preds) {
      const i = cols.findIndex(c => c.includes(p));
      if (i >= 0) return table.columns[i];
    }
    return null;
  }
  return {
    name: find(['name', 'nome', 'volcano', 'vulcan', 'feature']) || table.columns[0],
    lat: find(['lat', 'latitude', 'y']),
    lon: find(['lon', 'longitude', 'x']),
    type: find(['type', 'tip', 'kind']),
    country: find(['country', 'stato', 'nation']),
    country_code: find(['country_code', 'cc', 'iso']),
    altitude: find(['altitude', 'elevation', 'height']),
    activity: find(['activity', 'attiv', 'history'])
  };
}

function lonLatToXY(lon, lat) {
  lon = parseFloat(lon);
  lat = parseFloat(lat);
  if (!isFinite(lon) || !isFinite(lat)) return { x: NaN, y: NaN };
  const x = map(lon, -180, 180, 0, width);
  const y = map(lat, 90, -90, 0, height);
  return { x, y };
}

function drawStaticLayer() {
  staticLayer.clear();
  staticLayer.background(245);
  if (showGrid) {
    drawGrid(staticLayer);
  } else {
    staticLayer.noStroke();
    staticLayer.fill(245);
    staticLayer.rect(0, 0, width, height);
  }
  if (!table) {
    redraw();
    return;
  }
  const cols = detectColumns();
  if (!cols.lat || !cols.lon || !cols.type) {
    redraw();
    return;
  }
  for (let r = 0; r < table.getRowCount(); r++) {
    const lat = parseFloat(table.getString(r, cols.lat).trim());
    const lon = parseFloat(table.getString(r, cols.lon).trim());
    const type = table.getString(r, cols.type).trim();
    if (!isFinite(lat) || !isFinite(lon)) continue;
    const p = lonLatToXY(lon, lat);
    if (volcanoImages[type]) {
      staticLayer.push();
      staticLayer.tint(255, 180);
      staticLayer.image(volcanoImages[type], p.x - 6, p.y - 6, 12, 12);
      staticLayer.pop();
    } else {
      staticLayer.fill(230, 60, 60, 180);
      staticLayer.noStroke();
      staticLayer.ellipse(p.x, p.y, 12, 12);
    }
  }
  redraw();
}

function draw() {
  image(staticLayer, 0, 0);
  hoverInfo = null;
  if (!table) return;
  const cols = detectColumns();
  if (!cols.lat || !cols.lon || !cols.type) return;
  for (let r = 0; r < table.getRowCount(); r++) {
    const lat = parseFloat(table.getString(r, cols.lat).trim());
    const lon = parseFloat(table.getString(r, cols.lon).trim());
    const type = table.getString(r, cols.type).trim();
    const name = table.getString(r, cols.name).trim();
    if (!isFinite(lat) || !isFinite(lon)) continue;
    const p = lonLatToXY(lon, lat);
    if (dist(mouseX, mouseY, p.x, p.y) < 6 && volcanoImages[type]) {
      hoverInfo = { x: p.x, y: p.y, name: name, type: type };
      push();
      tint(255, 255);
      image(volcanoImages[type], p.x - 6, p.y - 6, 12, 12);
      pop();
    }
  }

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

  // Disegna cards solo se c'è un vulc selezionato
  if (selectedVolcano !== null) {
    drawThreeCardsForSelected(selectedVolcano);
  }

  cursor(hoverInfo ? HAND : ARROW);
}

// Disegna le 3 cards riferite alla riga r del csv
function drawThreeCardsForSelected(r) {
  if (!table || !isFinite(r) || r < 0 || r >= table.getRowCount()) return;
  const cols = detectColumns();
  // vari tipi di dati per le variabili
  const name = table.getString(r, cols.name).trim();
  const lat = parseFloat(cols.lat ? table.getString(r, cols.lat).trim() : NaN);
  const lon = parseFloat(cols.lon ? table.getString(r, cols.lon).trim() : NaN);
  const country = cols.country ? table.getString(r, cols.country).trim() : '';
  const cc = (cols.country_code ? table.getString(r, cols.country_code).trim().toLowerCase() : '') || '';
  const type = cols.type ? table.getString(r, cols.type).trim() : '';
  const altitude = cols.altitude ? parseFloat(table.getString(r, cols.altitude).trim()) : 0;
  const activityRaw = cols.activity ? table.getString(r, cols.activity).trim() : '';

  // allineamento delle carte in basso 
  const margin = 24;
  const totalW = width - margin * 2;
  const cardW = (totalW - (3 - 1) * 16) / 3;
  const cardH = Math.min(320, height - margin * 2);
  const baseY = height - margin - cardH;

  // Card overview (sx)
  const ax = margin;
  drawOverviewCard(ax, baseY, cardW, cardH, { name, country, cc, type, altitude, rowIndex: r });

  // card latlon (cent)
  const bx = margin + (cardW + 16) * 1;
  drawLatLonCard(bx, baseY, cardW, cardH, { lat, lon });

  // card attività (dx) - passiamo l'oggetto completo ottenuto da getVolcanoData
  const cx = margin + (cardW + 16) * 2;
  const rowData = getVolcanoData(table.getRow(r));
  drawActivityCard(cx, baseY, cardW, cardH, rowData);

  // salva i bbox delle 3 card per intercettare i click in mousePressed()
  tempCardBBoxes = [
    { x: ax, y: baseY, w: cardW, h: cardH, kind: 'overview', row: r },
    { x: bx, y: baseY, w: cardW, h: cardH, kind: 'latlon', row: r },
    { x: cx, y: baseY, w: cardW, h: cardH, kind: 'activity', row: r }
  ];
}

// Icona in base al vulcano
function getVolcanoImage(type) {
  if (volcanoImages[type]) return volcanoImages[type];
  // match case-insensitive
  for (const key in volcanoImages) {
    if (key.toLowerCase() === type.toLowerCase()) return volcanoImages[key];
  }
  return null; // fallback emoji
}

// CARD OVERVIEW DRAW
function drawOverviewCard(x, y, w, h, data) {
  push();
  fill(255);
  stroke(220);
  strokeWeight(1);
  rect(x, y, w, h, 8);
  noStroke();

  // ---------------- Header: nome ----------------
  fill(20);
  textSize(16);
  textAlign(LEFT, TOP);
  text(data.name, x + 12, y + 10);

  // Country label sotto il nome
  fill(90);
  textSize(11);
  textAlign(LEFT, TOP);
  text(data.country || '', x + 12, y + 32);

  // ---------------- Icona centrale ----------------
  const rightColCenterX = x + w / 2;
  const rightColCenterY = y + h / 2;

  // Dimensione icona scalata in base all'altitudine
  const rawIconSize = map(data.altitude || 0, 0, 4000, 40, 140);
  const iconSize = constrain(rawIconSize, 40, Math.min(140, w * 0.6));

  const volcanoImg = getVolcanoImage(data.type);

  if (volcanoImg instanceof p5.Image) {
    // Shadow sotto icona
    drawingContext.save();
    drawingContext.shadowColor = 'rgba(0,0,0,0.18)';
    drawingContext.shadowBlur = 14;
    imageMode(CENTER);
    image(volcanoImg, rightColCenterX, rightColCenterY - 10, iconSize, iconSize);
    imageMode(CORNER);
    drawingContext.restore();
  } else {
    // fallback emoji
    textSize(iconSize);
    textAlign(CENTER, CENTER);
    fill(0);
    text(getIconEmojiForType(data.type), rightColCenterX, rightColCenterY - 10);
  }

  // Tipo e altitudine centrati sotto icona
  textSize(12);
  fill(60);
  textAlign(CENTER, TOP);
  const typeTextY = rightColCenterY - 10 + iconSize / 2 + 6;
  text(data.type || 'unknown', rightColCenterX, typeTextY);

  textSize(12);
  fill(90);
  text((data.altitude || 0) + ' m', rightColCenterX, typeTextY + 18);

  // ---------------- Bottone chiudi 'X' ----------------
  const closeSize = 18;
  const closeX = x + w - closeSize - 8;
  const closeY = y + 8;
  fill(240);
  stroke(200);
  rect(closeX, closeY, closeSize, closeSize, 4);
  noStroke();
  fill(80);
  textSize(12);
  textAlign(CENTER, CENTER);
  text('✕', closeX + closeSize / 2, closeY + closeSize / 2);

  pop();
}

// CARD LATLON DRAW
function drawLatLonCard(x, y, w, h, data) {
  push();
  fill(255);
  stroke(220);
  strokeWeight(1);
  rect(x, y, w, h, 8);
  noStroke();

  fill(20);
  textSize(14);
  textAlign(LEFT, TOP);
  text('Posizione', x + 12, y + 10);

  // Mappa
  const pad = 12;
  const areaW = w - 2*pad;
  const areaH = h - 50; // lascia spazio header
  const areaX = x + pad;
  const areaY = y + 40;

  // sfondo mappa
  fill(245);
  rect(areaX, areaY, areaW, areaH, 4);

  // linee 
  stroke(200);
  strokeWeight(1.5);
  // verticale 
  const centerX = areaX + areaW/2;
  line(centerX, areaY, centerX, areaY + areaH);
  // orizzontales
  const centerY = areaY + areaH/2;
  line(areaX, centerY, areaX + areaW, centerY);

  // punto rosso vulc
  const px = map(isFinite(data.lon) ? data.lon : 0, -180, 180, areaX, areaX + areaW);
  const py = map(isFinite(data.lat) ? data.lat : 0, 90, -90, areaY, areaY + areaH);
  fill('#ef4444');
  stroke(180);
  strokeWeight(1);
  ellipse(px, py, 12, 12);

  // testo lat/lon punto
  fill(30);
  noStroke();
  textSize(11);
  textAlign(LEFT, BOTTOM);
  text(`Lat: ${isFinite(data.lat) ? nf(data.lat,1,2) : 'n.d.'}`, min(px + 8, areaX + areaW - 40), py - 2);
  text(`Lon: ${isFinite(data.lon) ? nf(data.lon,1,2) : 'n.d.'}`, min(px + 8, areaX + areaW - 40), py + 10);
  pop();
}

// getdata 
function getVolcanoData(row) {
  return {
    name: row.getString('Volcano Name'),
    country: row.getString('Country'),
    latitude: parseFloat(row.getString('Latitude')),
    longitude: parseFloat(row.getString('Longitude')),
    elevation: parseFloat(row.getString('Elevation (m)')),
    type: row.getString('Type'),
    typeCategory: row.getString('TypeCategory'),
    status: row.getString('Status'),
    lastEruption: row.getString('Last Known Eruption')
  };
}

// CARD ATTIVITA'
function drawActivityCard(x, y, w, h, data) {
  push();
  fill(255);
  stroke(220);
  strokeWeight(1);
  rect(x, y, w, h, 8);
  noStroke();

  // Header
  fill(20);
  textSize(16);
  textAlign(LEFT, TOP);
  text('Storico attività', x + 12, y + 10);

  // stato
  const status = (data.status || 'Unknown').trim();
  // Colori unici stato
  const statusMap = {
    'active': '#ef4444',       // rosso
    'dormant': '#facc15',      // giallo
    'extinct': '#6b7280',      // grigio
    'holocene': '#10b981',     // verde
    'fumarolic': '#6366f1',    // blu
    'unknown': '#9ca3af'       // grigio chiaro
  };
  const statusColor = statusMap[status.toLowerCase()] || '#9ca3af';

  //Barra mid
  fill(statusColor);
  noStroke();
  rect(x + 12, y + 50, w - 24, 40, 6); 

  // Stato centra
  fill(255);
  textSize(18);
  textAlign(CENTER, CENTER);
  text(status, x + w / 2, y + 50 + 20);

  // ultima eruzione
  const lastEruption = (data.lastEruption || 'n.d.').trim();
  fill(30);
  textSize(16);
  textAlign(CENTER, CENTER);
  text(`Ultima eruzione: ${lastEruption}`, x + w / 2, y + 110);

  pop();
}

// gestione click: se click su marker => apre le 3 cards per quel vulcano
function mousePressed() {
  // Se le cards sono aperte: controlla se il click è dentro una card
  if (selectedVolcano !== null) {
    for (let bbox of tempCardBBoxes) {
      if (bbox && mouseX >= bbox.x && mouseX <= bbox.x + bbox.w && mouseY >= bbox.y && mouseY <= bbox.y + bbox.h) {
        // se click dentro overview e sul pulsante X -> chiudi
        if (bbox.kind === 'overview') {
          const closeSize = 18;
          const closeX = bbox.x + bbox.w - closeSize - 8;
          const closeY = bbox.y + 8;
          if (mouseX >= closeX && mouseX <= closeX + closeSize && mouseY >= closeY && mouseY <= closeY + closeSize) {
            selectedVolcano = null;
            tempCardBBoxes = [];
            redraw();
            return;
          }
        }
        // click dentro qualsiasi card consuma l'evento (non passerà ai marker sottostanti)
        return;
      }
    }
    // se siamo qui, il click è fuori dalle card: prosegui con la selezione marker
  }

  if (!table) return;
  const cols = detectColumns();
  if (!cols.lat || !cols.lon) return;

  let found = false;
  for (let r = 0; r < table.getRowCount(); r++) {
    const lat = parseFloat(table.getString(r, cols.lat).trim());
    const lon = parseFloat(table.getString(r, cols.lon).trim());
    if (!isFinite(lat) || !isFinite(lon)) continue;

    const p = lonLatToXY(lon, lat);
    if (dist(mouseX, mouseY, p.x, p.y) < 6) {
      selectedVolcano = r;
      found = true;
      // preload flag per la riga selezionata (se presente)
      const code = (cols.country_code ? table.getString(r, cols.country_code) : '') || '';
      if (code) loadFlagForCode(code.toLowerCase());
      redraw();
      break; // importante: non continuare il loop
    }
  }

  if (!found) {
    // click in area non marker => deseleziona (chiude le cards)
    selectedVolcano = null;
    tempCardBBoxes = [];
    redraw();
  }
}

//Parsing per year val
function parseActivityField(field) {
  if (!field) return [];
  field = field.trim();
  // prova JSON
  try {
    const maybe = JSON.parse(field);
    if (Array.isArray(maybe)) {
      return maybe.map(x => ({ year: Number(x.year), value: Number(x.value) })).filter(a => isFinite(a.year));
    }
  } catch (e) {
    // non JSON
  }
  // formato anno:val;...
  const parts = field.split(';').map(s => s.trim()).filter(Boolean);
  const out = [];
  for (let seg of parts) {
    const [y, v] = seg.split(':').map(s => s && s.trim());
    const yy = Number(y);
    const vv = Number(v);
    if (isFinite(yy)) out.push({ year: yy, value: isFinite(vv) ? vv : 0 });
  }
  return out;
}

// griglia
function drawGrid(g) {
  g.noStroke();
  g.fill(234, 244, 255);
  g.rect(0, 0, width, height);
  g.stroke(200);
  g.strokeWeight(1);

  // Meridiani ogni 30°
  for (let lon = -180; lon <= 180; lon += 30) {
    const x = map(lon, -180, 180, 0, width);
    g.line(x, 0, x, height);
  }

  // Paralleli ogni 30°
  for (let lat = -90; lat <= 90; lat += 30) {
    const y = map(lat, 90, -90, 0, height);
    g.line(0, y, width, y);
  }
}

function mouseMoved() {
  redraw();
}

// icona emoji fallback per tipi non mappati
function getIconEmojiForType(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('strat')) return '🌋';
  if (t.includes('shield')) return '🛡️';
  if (t.includes('caldera')) return '🌀';
  if (t.includes('cone')) return '▲';
  return '❓';
}
