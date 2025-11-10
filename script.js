function scrollToMap() {
    const mapSection = document.getElementById('map-section');
    mapSection.scrollIntoView({ behavior: 'smooth' });
  }
  // script.js — crea una sola marquee, la forza in posizione fixed sotto <body>
// Assicurati di includere questo file una sola volta (dopo gli altri script)
// Funziona anche se volcanoIcons non è globale (usa fallback)
