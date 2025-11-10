let table;
let worldMapImg = null; 
const MAX_MERCATOR_LAT = 85.0511287798066;
const MIN_MERCATOR_LAT = -85.0511287798066;
let MAX_MERC_N, MIN_MERC_N;

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
const WORLD_MAP_URL = 'https://upload.wikimedia.org/wikipedia/commons/c/c8/Mercator_Blank_Map_World.png';

function mercN(latDegrees) {
  const phi = radians(latDegrees);
  return Math.log(Math.tan(Math.PI / 4 + phi / 2));
}

function lonLatToXY(lon, lat) {
  lon = parseFloat(lon);
  lat = parseFloat(lat);
  if (!isFinite(lon) || !isFinite(lat)) return { x: NaN, y: NaN };
  const x = mapOffsetX + ((lon + 180) / 360) * mapDrawW;
  const n = mercN(constrain(lat, MIN_MERCATOR_LAT, MAX_MERCATOR_LAT));
  const t = (MAX_MERC_N - n) / (MAX_MERC_N - MIN_MERC_N);
  const y = mapOffsetY + t * mapDrawH;
  return { x, y };
}

function preload() {
  table = loadTable('assets/dataset.csv', 'csv', 'header');
  for (const [type, path] of Object.entries(volcanoIcons)) {
    volcanoImages[type] = loadImage(path);
  }
}

function setup() {
  // Assicurati che il container esista
  const container = document.getElementById('map-container');
  if (!container) {
    console.error('Container #map-container non trovato!');
    return;
  }

  // Forza il container a full screen
  container.style.width = '100vw';
  container.style.height = '100vh';

  // Crea il canvas full screen e associarlo al container
  const canvas = createCanvas(container.clientWidth, container.clientHeight);
  canvas.parent(container);

  MAX_MERC_N = mercN(MAX_MERCATOR_LAT);
  MIN_MERC_N = mercN(MIN_MERCATOR_LAT);

  // Layer statico per mappa e vulcani
  staticLayer = createGraphics(width, height);

  // Carica mappa del mondo
  loadImage(WORLD_MAP_URL, img => {
    worldMapImg = img;
    computeMapDrawArea();
    drawStaticLayer();
  }, err => {
    console.warn('Errore caricamento mappa, useremo fallback graticola.', err);
    computeMapDrawArea();
    drawStaticLayer();
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
  const scale = Math.min(width / worldMapImg.width, height / worldMapImg.height);
  mapDrawW = worldMapImg.width * scale;
  mapDrawH = worldMapImg.height * scale;
  mapOffsetX = (width - mapDrawW) / 2;
  mapOffsetY = (height - mapDrawH) / 2;
  
}

function drawStaticLayer() {
  staticLayer.background(245);

  if (worldMapImg) {
    // Ritaglio 2 pixel a sinistra per eliminare la riga nera
    const cropLeft = 10;
    staticLayer.image(
      worldMapImg,
      mapOffsetX, mapOffsetY, mapDrawW, mapDrawH, // posizione e dimensione sul canvas
      cropLeft, 0, worldMapImg.width - cropLeft, worldMapImg.height // area ritagliata dall'immagine
    );
  } else {
    drawMercatorGrid(staticLayer);
  }

  if (!table) return;
  const latCol = table.columns.find(c => c.toLowerCase().includes('latitude'));
  const lonCol = table.columns.find(c => c.toLowerCase().includes('longitude'));
  const typeCol = table.columns.find(c => c.toLowerCase().includes('type'));
  if (!latCol || !lonCol || !typeCol) return;

  for (let r = 0; r < table.getRowCount(); r++) {
    const lat = parseFloat(table.getString(r, latCol).trim());
    const lon = parseFloat(table.getString(r, lonCol).trim());
    const type = table.getString(r, typeCol).trim();
    if (!isFinite(lat) || !isFinite(lon)) continue;

    const p = lonLatToXY(lon, lat);
    if (volcanoImages[type]) {
      staticLayer.push();
      staticLayer.tint(255, 180); // opacità 70%
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

    const p = lonLatToXY(lon, lat);
    if (dist(mouseX, mouseY, p.x, p.y) < 6 && volcanoImages[type]) {
      hoverInfo = { x: p.x, y: p.y, name: name, type: type };
      push();
      tint(255, 255);
      image(volcanoImages[type], p.x - 6, p.y - 6, 12, 12);
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

  // cursore a mano
  if (hoverInfo) {
    cursor(HAND);
  } else {
    cursor(ARROW);
  }
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
  if (!table) return;

  const latCol = table.columns.find(c => c.toLowerCase().includes('latitude'));
  const lonCol = table.columns.find(c => c.toLowerCase().includes('longitude'));
  if (!latCol || !lonCol) return;

  selectedVolcano = null;

  for (let r = 0; r < table.getRowCount(); r++) {
    const lat = parseFloat(table.getString(r, latCol).trim());
    const lon = parseFloat(table.getString(r, lonCol).trim());
    if (!isFinite(lat) || !isFinite(lon)) continue;

    const p = lonLatToXY(lon, lat);
    if (dist(mouseX, mouseY, p.x, p.y) < 6) {
      selectedVolcano = r;
      break;
    }
  }
}











//BACKUP










    // MARQUEE JS
    const marquee = document.createElement('div');
    marquee.className = 'icon-marquee';
    marquee.setAttribute('aria-hidden', 'true');
  
    const track = document.createElement('div');
    track.className = 'marquee-track';
  
    function buildGroup() {
      const group = document.createElement('div');
      group.className = 'icon-group';
      for (const [name, path] of Object.entries(iconsObj)) {
        const img = document.createElement('img');
        img.src = path;
        img.alt = name;
        // evita che il caricamento immagini rallenti troppo l'animazione
        img.decoding = 'async';
        img.loading = 'lazy';
        group.appendChild(img);
      }
      return group;
    }
  
    // duplichiamo il gruppo per l'effetto loop continuo
    track.appendChild(buildGroup());
    track.appendChild(buildGroup());
    marquee.appendChild(track);
  
    // append a body (full-width, fixed)
    parentForMarquee.appendChild(marquee);
  
    // ---------- Ensure: forziamo che sia figlia di body e fixed ----------
    (function ensureMarqueeIsFixed(marqueeEl) {
      if (!marqueeEl) return;
  
      // sposta forzatamente la marquee sotto body se non ci fosse
      if (marqueeEl.parentElement !== document.body) {
        document.body.appendChild(marqueeEl);
      }
  
      // stili inline per ulteriore garanzia
      Object.assign(marqueeEl.style, {
        position: 'fixed',
        left: '0',
        right: '0',
        bottom: '8vh',
        width: '100%',
        height: marqueeEl.style.height || '110px',
        overflow: 'hidden',
        zIndex: '1',
        pointerEvents: 'none',
        opacity: '0.95',
        display: 'block',
        willChange: 'transform'
      });
  
      // diagnostica: trova eventuali antenati problematici (transform/perspective/filter)
      let el = marqueeEl.parentElement;
      const problematic = [];
      while (el && el !== document.documentElement) {
        const s = window.getComputedStyle(el);
        if (s.transform && s.transform !== 'none') problematic.push({el, prop: 'transform', value: s.transform});
        if (s.perspective && s.perspective !== 'none') problematic.push({el, prop: 'perspective', value: s.perspective});
        if (s.filter && s.filter !== 'none') problematic.push({el, prop: 'filter', value: s.filter});
        el = el.parentElement;
      }
      if (problematic.length) {
        console.warn('Marquee: trovati antenati con transform/perspective/filter che possono interferire con position:fixed:', problematic);
      }
    })(marquee);
  
    // ---------- Adatta la velocità in base alla larghezza del gruppo ----------
    function adjustSpeed() {
      const group = track.querySelector('.icon-group');
      if (!group) return;
      const groupW = group.getBoundingClientRect().width;
      const pxPerSecond = 80; // regola questa per aumentare/diminuire velocità percepita
      let duration = (groupW) / pxPerSecond;
      // limiti pratici
      duration = Math.max(10, Math.min(40, duration));
      track.style.setProperty('--marquee-speed', `${duration}s`);
    }
  
    // chiamiamo dopo un breve delay per dare il tempo alle immagini di iniziare il caricamento
    setTimeout(adjustSpeed, 180);
    window.addEventListener('resize', () => setTimeout(adjustSpeed, 180));
  
    // optional: pausa al hover se vuoi (attualmente pointer-events:none)
    // se vuoi abilitare hover-to-pause, rimuovi pointer-events:none e decommenta:
    // marquee.addEventListener('mouseenter', () => { track.style.animationPlayState = 'paused'; });
    // marquee.addEventListener('mouseleave', () => { track.style.animationPlayState = 'running'; });
  });
  












  //MARQUEE CSS
/* marquee full-screen (fissa) */
/* marquee forzata: fixed, full-width */
.icon-marquee {
  position: fixed !important;   /* important per sovrascrivere eventuali regole */
  left: 0 !important;
  right: 0 !important;
  bottom: 8vh !important;       /* regola questa distanza dal fondo */
  width: 100% !important;
  height: 110px !important;
  overflow: hidden !important;
  z-index: 1 !important;
  pointer-events: none !important;
  opacity: 0.95 !important;
  display: block !important;
  will-change: transform;       /* suggerimento per performance */
}



/* track che scorre */
.marquee-track {
  display: flex;
  align-items: center;
  height: 100%;
  --marquee-speed: 24s;   /* valore iniziale, verrà sovrascritto da JS */
  animation: marquee linear infinite;
  animation-duration: var(--marquee-speed);
}

/* gruppi duplicati */
.icon-group {
  display: flex;
  gap: 28px;
  align-items: center;
  padding-left: 30px;
  padding-right: 30px;
  white-space: nowrap;
}

/* stile icone */
.icon-group img {
  width: 56px;
  height: 56px;
  object-fit: contain;
  opacity: 0.9;
  filter: drop-shadow(0 4px 8px rgba(0,0,0,0.08));
}

/* animazione: sposta il track di metà della larghezza totale (duplicato) */
@keyframes marquee {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

/* Assicuriamoci che le card della home siano sopra la marquee */
.legend-card, .description-card, .intro-content { position: relative; z-index: 3; }
