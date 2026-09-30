/* =====================================================================
   K-S-P-K — jaetut karttamerkit
   ---------------------------------------------------------------------
   uNmINeD EI ylikirjoita tata tiedostoa kun kartta renderoidaan
   uudelleen, joten kaikki oma koodi asuu taalla.

   Kaytto kartalla:
     - Oikea klikkaus TAI kolmoisnapautus  ->  "Lisaa merkki tahan"
     - Merkkia klikkaamalla                ->  kupla: viesti, muokkaa, poista
     - Oikean alanurkan tyokalunappi       ->  dev-tila (yllapitokoodi)

   Oikeudet:
     - Merkin lisaaminen vaatii pelinimen ja pelaajan omaa salasanaa
     - Oman merkin muokkaus/poisto: sama pelinimi + salasana
     - Dev-tila: kaikki oikeudet kaikkiin merkkeihin
   ===================================================================== */

/* ---------------------------------------------------------------------
   Tumma tausta + theme-color mobiilille (kohta 11)
   Suoritetaan heti kun tama tiedosto ladataan (ennen kuin uNmINeD on
   edes alkanut piirtaa karttaa), jotta selaimen oma osoite-/tyokalurivi
   pysyy tummana myos taalla avattuna koko naytolle, eika valkoisena
   reunoilla tai ladatessa. Tama tiedosto sailyy uNmINeD-paivityksissa,
   joten korjaus ei katoa kun kartta renderoidaan uudelleen. ------------ */
(function () {
  try {
    var DARK = '#070d0a';
    var css = document.createElement('style');
    css.textContent = 'html,body{background:' + DARK + ' !important;background-color:' + DARK + ' !important;}';
    (document.head || document.documentElement).appendChild(css);

    function setMeta(name, content) {
      var m = document.querySelector('meta[name="' + name + '"]');
      if (!m) { m = document.createElement('meta'); m.setAttribute('name', name); (document.head || document.documentElement).appendChild(m); }
      m.setAttribute('content', content);
    }
    setMeta('theme-color', DARK);
    setMeta('color-scheme', 'dark');
    setMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
  } catch (e) {}
})();

var UnminedSharedPins = {

  // --- Jaettu tallennus (Supabase) ---------------------------------
  supabaseUrl : 'https://zfgwjxtruqoacxtkqprp.supabase.co',
  supabaseKey : 'sb_publishable_MwLjfXP5LCtZe8tZ3IIf7w_5a3zqoKc',
  table       : 'pins',

  // --- Kayttooikeudet ----------------------------------------------
  // Salasanat ja yllapitokoodi EIVAT ole taalla. Ne ovat Supabasen
  // secrets-taulussa, jota anon-avaimella ei voi lukea. Kaikki kirjoitus
  // kulkee pin_add / pin_edit / pin_delete -funktioiden kautta, jotka
  // tarkistavat koodin ja whitelistin palvelimella.

  // --- Selaimen oma zoom --------------------------------------------
  allowBrowserZoom: false,

  // --- Ulkoasu ------------------------------------------------------
  colors: ['#3ef08a','#ffd166','#ff6b6b','#5aa9ff','#c792ea','#ff9f43','#ffffff','#7bed9f']
};

/* uNmINeDin oma kiintea merkkilista (ei kaytossa) */
var UnminedCustomMarkers = { isEnabled: false, markers: [] };

(function () {
  'use strict';

  var CFG = UnminedSharedPins;
  var SHARED = !!(CFG.supabaseUrl && CFG.supabaseKey);
  var WHITELIST = null;      // null = ei viela ladattu, [] = ei rajoitusta
  var LS_LOCAL = 'kspk.pins.local';
  var LS_NAME  = 'kspk.pins.name';
  var LS_PASS  = 'kspk.pins.pass';
  var SS_DEV   = 'kspk.pins.dev';
  var SS_CODE  = 'kspk.pins.devcode';
  var LS_VIEW  = 'kspk.pins.view';   // Kohta 7: henkilokohtainen nakyma (vain tama selain)

  /* Kohta 6: 5 valittavaa symbolia karttamerkeille (piste = oletus).
     Kohta 25: + 12 uutta muotoa (talo, paakallo, miekat, vasara, hymio,
     pickaxe, puu, kirves, kilpi, sydan, ankkuri, aarrearkku) — ei emojeita,
     samanlaisia tasavarisia muotoja kuin alkuperaiset viisi. Nailla ei ole
     Unicode-glyfia, joten valitsimen nappi piirretaan pienena inline-SVG:na
     (glyph-kentta), ja itse kartalla ne piirretaan ol.style.Iconina
     ICON_SVGS-taulukon SVG:sta varjattynа merkin varilla (ks. pinStyle). */
  var SYMBOLS = [
    { id: 'dot',      glyph: '●' },
    { id: 'square',   glyph: '■' },
    { id: 'triangle', glyph: '▲' },
    { id: 'star',     glyph: '★' },
    { id: 'diamond',  glyph: '◆' },
    { id: 'house', glyph: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><g transform="translate(0.000 0.250)"><path d="M12 2.2 1.5 11h3.2v10.3h6V15h2.6v6.3h6V11h3.2z"/></g></svg>' },
    { id: 'skull', glyph: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><g transform="translate(0.000 0.750)"><path fill-rule="evenodd" d="M12 1.6c-5 0-8.6 3.7-8.6 8.3 0 3 1.5 5.2 3.4 6.7v3.1c0 .7.5 1.2 1.2 1.2h1v-2.2h1.6v2.2h2.8v-2.2h1.6v2.2h1c.7 0 1.2-.5 1.2-1.2v-3.1c1.9-1.5 3.4-3.7 3.4-6.7 0-4.6-3.6-8.3-8.6-8.3zm-3.6 9.6a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6zm7.2 0a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6zM12 13.4l1.6 2.6h-3.2z"/></g></svg>' },
    { id: 'sword', glyph: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 1 14.4 5.4V15.2H9.6V5.4z"/><path d="M5.2 15.2h13.6v2.4H5.2z"/><path d="M10.8 17.6h2.4v3.6h-2.4z"/><path d="M9.4 21.2h5.2v1.9H9.4z"/></svg>' },
    { id: 'hammer', glyph: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><g transform="translate(-2.000 2.031)"><g transform="rotate(45 12 12)"><g transform="translate(12 12)"><g transform="scale(1.00000)"><g transform="translate(-12 -12)"><rect x="4.6" y="2.2" width="14.8" height="5.9" rx="1.4"/><rect x="10.8" y="8.1" width="2.4" height="13.8" rx="0.7"/></g></g></g></g></g></svg>' },
    { id: 'smiley', glyph: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-3.6 6.8a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8zm7.2 0a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8zM6.8 14c1 2.2 3 3.6 5.2 3.6s4.2-1.4 5.2-3.6z"/></svg>' },
    { id: 'pickaxe', glyph: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><g transform="translate(-1.031 1.031)"><g transform="rotate(45 12 12)"><g transform="translate(12 12)"><g transform="scale(1.00000)"><g transform="translate(-12 -12)"><path d="M1.6 11.2C3.2 4.4 7.2 1.2 12 1.2s8.8 3.2 10.4 10c-2.6-4.2-6.1-6.2-10.4-6.2S4.2 7 1.6 11.2z"/><path d="M10.7 4.6h2.6V22.6h-2.6z"/></g></g></g></g></g></svg>' },
    { id: 'tree', glyph: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><g transform="translate(0.000 -0.250)"><path d="M12 1.5 6.5 9.5h2.3L4.5 16h4.7l-3.5 6.5h12.6L15 16h4.5l-4.3-6.5h2.3z"/><rect x="10.6" y="19" width="2.8" height="4"/></g></svg>' },
    { id: 'axe', glyph: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><g transform="translate(0.750 2.375)"><g transform="rotate(45 12 12)"><g transform="translate(12 12)"><g transform="scale(1.00000)"><g transform="translate(-12 -12)"><path d="M13.4 3.8 3.9 1.4c-.9 3.8-.9 7.4 0 11L13.4 10.8z"/><path d="M10.9 3.8h2.5V22.6h-2.5z"/></g></g></g></g></g></svg>' },
    { id: 'shield', glyph: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><g transform="translate(0.000 -0.250)"><path d="M12 1.8 3.5 5v6.2c0 5.4 3.6 9.8 8.5 11.5 4.9-1.7 8.5-6.1 8.5-11.5V5z"/></g></svg>' },
    { id: 'heart', glyph: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><g transform="translate(0.000 0.156)"><path d="M12 21S2.5 14.6 2.5 8.2C2.5 5 5 2.7 8 2.7c1.8 0 3.3.9 4 2.3.7-1.4 2.2-2.3 4-2.3 3 0 5.5 2.3 5.5 5.5 0 6.4-9.5 12.8-9.5 12.8z"/></g></svg>' },
    { id: 'anchor', glyph: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><g transform="translate(0.031 0.250)"><path fill-rule="evenodd" d="M12 1.8a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6zm-1.1 4.9h2.2v2.5h3.6v1.7h-3.6v8.3c2.3-.5 4-2.2 4.5-4.4h1.8c-.6 3.7-3.7 6.5-7.4 6.8v.1h-.1v-.1c-3.7-.3-6.8-3.1-7.4-6.8h1.8c.5 2.2 2.2 3.9 4.5 4.4V10.9H7.3V9.2h3.6z"/></g></svg>' },
    { id: 'chest', glyph: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path fill-rule="evenodd" d="M3 9.5h18v10.2H3zm7.2 3.3v2.3h3.6v-2.3h1.9c-.3 1.8-1.9 3.2-3.7 3.2s-3.4-1.4-3.7-3.2z"/><path d="M4.5 4.3h15l1.8 4.2H2.7z"/></svg>' }
  ];

  /* Kohta 25 + korjaus: samat 12 muotoa SVG:na karttamerkkeja varten.
     TAYTTO ON VALKOINEN (#fff) — ol.style.Icon:n color-optio varjaa kuvan
     "multiply"-sekoituksella (kuvapikseli * valittu vari / 255): musta pikseli
     (0) pysyy aina mustana varista riippumatta, siksi taysimusta versio ei
     koskaan nayttanyt vartia. Valkoinen (255) taas muuttuu tasmalleen
     valituksi variksi. Ulkoreunan musta viiva (stroke) on leivottu SVG:hen
     kiinteana — se pysyy mustana samasta multiply-syysta eika hairitse
     varjaystä, ja vastaa ympyra/nelio-symbolien tummaa outlinea. */
  var ICON_SVGS = {
    house: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64"><g fill="#fff" stroke="#000" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"><g transform="translate(12 12) scale(0.9) translate(-12 -12)"><g transform="translate(0.000 0.250)"><path d="M12 2.2 1.5 11h3.2v10.3h6V15h2.6v6.3h6V11h3.2z"/></g></g></g></svg>',
    skull: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64"><g fill="#fff" stroke="#000" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"><g transform="translate(12 12) scale(0.9) translate(-12 -12)"><g transform="translate(0.000 0.750)"><path fill-rule="evenodd" d="M12 1.6c-5 0-8.6 3.7-8.6 8.3 0 3 1.5 5.2 3.4 6.7v3.1c0 .7.5 1.2 1.2 1.2h1v-2.2h1.6v2.2h2.8v-2.2h1.6v2.2h1c.7 0 1.2-.5 1.2-1.2v-3.1c1.9-1.5 3.4-3.7 3.4-6.7 0-4.6-3.6-8.3-8.6-8.3zm-3.6 9.6a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6zm7.2 0a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6zM12 13.4l1.6 2.6h-3.2z"/></g></g></g></svg>',
    sword: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64"><g fill="#fff" stroke="#000" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"><g transform="translate(12 12) scale(0.9) translate(-12 -12)"><path d="M12 1 14.4 5.4V15.2H9.6V5.4z"/><path d="M5.2 15.2h13.6v2.4H5.2z"/><path d="M10.8 17.6h2.4v3.6h-2.4z"/><path d="M9.4 21.2h5.2v1.9H9.4z"/></g></g></svg>',
    hammer: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64"><g fill="#fff" stroke="#000" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"><g transform="translate(12 12) scale(0.9) translate(-12 -12)"><g transform="translate(-2.000 2.031)"><g transform="rotate(45 12 12)"><g transform="translate(12 12)"><g transform="scale(1.00000)"><g transform="translate(-12 -12)"><rect x="4.6" y="2.2" width="14.8" height="5.9" rx="1.4"/><rect x="10.8" y="8.1" width="2.4" height="13.8" rx="0.7"/></g></g></g></g></g></g></g></svg>',
    smiley: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64"><g fill="#fff" stroke="#000" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"><g transform="translate(12 12) scale(0.9) translate(-12 -12)"><path fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-3.6 6.8a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8zm7.2 0a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8zM6.8 14c1 2.2 3 3.6 5.2 3.6s4.2-1.4 5.2-3.6z"/></g></g></svg>',
    pickaxe: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64"><g fill="#fff" stroke="#000" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"><g transform="translate(12 12) scale(0.9) translate(-12 -12)"><g transform="translate(-1.031 1.031)"><g transform="rotate(45 12 12)"><g transform="translate(12 12)"><g transform="scale(1.00000)"><g transform="translate(-12 -12)"><path d="M1.6 11.2C3.2 4.4 7.2 1.2 12 1.2s8.8 3.2 10.4 10c-2.6-4.2-6.1-6.2-10.4-6.2S4.2 7 1.6 11.2z"/><path d="M10.7 4.6h2.6V22.6h-2.6z"/></g></g></g></g></g></g></g></svg>',
    tree: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64"><g fill="#fff" stroke="#000" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"><g transform="translate(12 12) scale(0.9) translate(-12 -12)"><g transform="translate(0.000 -0.250)"><path d="M12 1.5 6.5 9.5h2.3L4.5 16h4.7l-3.5 6.5h12.6L15 16h4.5l-4.3-6.5h2.3z"/><rect x="10.6" y="19" width="2.8" height="4"/></g></g></g></svg>',
    axe: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64"><g fill="#fff" stroke="#000" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"><g transform="translate(12 12) scale(0.9) translate(-12 -12)"><g transform="translate(0.750 2.375)"><g transform="rotate(45 12 12)"><g transform="translate(12 12)"><g transform="scale(1.00000)"><g transform="translate(-12 -12)"><path d="M13.4 3.8 3.9 1.4c-.9 3.8-.9 7.4 0 11L13.4 10.8z"/><path d="M10.9 3.8h2.5V22.6h-2.5z"/></g></g></g></g></g></g></g></svg>',
    shield: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64"><g fill="#fff" stroke="#000" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"><g transform="translate(12 12) scale(0.9) translate(-12 -12)"><g transform="translate(0.000 -0.250)"><path d="M12 1.8 3.5 5v6.2c0 5.4 3.6 9.8 8.5 11.5 4.9-1.7 8.5-6.1 8.5-11.5V5z"/></g></g></g></svg>',
    heart: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64"><g fill="#fff" stroke="#000" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"><g transform="translate(12 12) scale(0.9) translate(-12 -12)"><g transform="translate(0.000 0.156)"><path d="M12 21S2.5 14.6 2.5 8.2C2.5 5 5 2.7 8 2.7c1.8 0 3.3.9 4 2.3.7-1.4 2.2-2.3 4-2.3 3 0 5.5 2.3 5.5 5.5 0 6.4-9.5 12.8-9.5 12.8z"/></g></g></g></svg>',
    anchor: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64"><g fill="#fff" stroke="#000" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"><g transform="translate(12 12) scale(0.9) translate(-12 -12)"><g transform="translate(0.031 0.250)"><path fill-rule="evenodd" d="M12 1.8a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6zm-1.1 4.9h2.2v2.5h3.6v1.7h-3.6v8.3c2.3-.5 4-2.2 4.5-4.4h1.8c-.6 3.7-3.7 6.5-7.4 6.8v.1h-.1v-.1c-3.7-.3-6.8-3.1-7.4-6.8h1.8c.5 2.2 2.2 3.9 4.5 4.4V10.9H7.3V9.2h3.6z"/></g></g></g></svg>',
    chest: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64"><g fill="#fff" stroke="#000" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"><g transform="translate(12 12) scale(0.9) translate(-12 -12)"><path fill-rule="evenodd" d="M3 9.5h18v10.2H3zm7.2 3.3v2.3h3.6v-2.3h1.9c-.3 1.8-1.9 3.2-3.7 3.2s-3.4-1.4-3.7-3.2z"/><path d="M4.5 4.3h15l1.8 4.2H2.7z"/></g></g></svg>',
    /* vanha tunniste 'swords' varalta, jos joku ehti tallentaa merkin silla */
    swords: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64"><g fill="#fff" stroke="#000" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"><g transform="translate(12 12) scale(0.9) translate(-12 -12)"><path d="M12 1 14.4 5.4V15.2H9.6V5.4z"/><path d="M5.2 15.2h13.6v2.4H5.2z"/><path d="M10.8 17.6h2.4v3.6h-2.4z"/><path d="M9.4 21.2h5.2v1.9H9.4z"/></g></g></svg>'
  };
  /* Kunkin kuvakkeen "muste" (taytto+outline) ei tayta koko 24x24-ruutua
     yhta tarkasti kuin ympyra tayttaa oman sateensa — siksi jokaiselle on
     mitattu (cairosvg-rasteroinnilla) oma kerroin, jolla 1x-koossa kuvakkeen
     lavistaja vastaa 1x-ympyran halkaisijaa (2 * baseR). Ks. pinStyle(). */
  var ICON_SCALE = {
    house: 2.39, skull: 2.59, sword: 2.28, hammer: 2.6, smiley: 2.49,
    pickaxe: 2.64, tree: 2.33, axe: 2.31, shield: 2.39, heart: 2.61,
    anchor: 2.49, chest: 2.66, swords: 2.28
  };
  /* Karttakuvakkeiden luontainen rasterikoko. SVG on vektori, mutta selain
     rasteroi sen tahan kokoon ennen kuin OpenLayers skaalaa sen merkin
     kokoon — 24 px sumeni kun merkkia suurennettiin (koko 2.5x * nakyma 3x).
     64 px antaa 2.7x enemman tarkkuutta ja pysyy terävana isollakin.
     TAMAN on vastattava ICON_SVGS:n width/height-arvoa. */
  var ICON_PX = 64;
  var ICON_SVG_CACHE = {};
  function iconDataUri(id) {
    if (ICON_SVG_CACHE[id]) return ICON_SVG_CACHE[id];
    var svg = ICON_SVGS[id];
    if (!svg) return null;
    var uri = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    ICON_SVG_CACHE[id] = uri;
    return uri;
  }

  /* ---------- apurit ---------- */
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }
  function isDev() { try { return sessionStorage.getItem(SS_DEV) === '1'; } catch (e) { return false; } }
  function setDev(v) { try { v ? sessionStorage.setItem(SS_DEV,'1') : sessionStorage.removeItem(SS_DEV); } catch (e) {} }
  function devCode()  { try { return sessionStorage.getItem(SS_CODE) || ''; } catch (e) { return ''; } }
  function setDevCode(c) { try { c ? sessionStorage.setItem(SS_CODE, c) : sessionStorage.removeItem(SS_CODE); } catch (e) {} }
  function savedName() { try { return localStorage.getItem(LS_NAME) || ''; } catch (e) { return ''; } }
  function saveName(n) { try { localStorage.setItem(LS_NAME, n); } catch (e) {} }
  function savedPass() { try { return localStorage.getItem(LS_PASS) || ''; } catch (e) { return ''; } }
  function savePass(p) { try { localStorage.setItem(LS_PASS, p); } catch (e) {} }

  /* Kohta 7: henkilokohtainen nakyma-asetus. Talletetaan vain omaan
     selaimeen (localStorage) — ei vaikuta palvelimelle eika muihin
     pelaajiin. Vari/symboli-piilotus + koon skaalaus. */
  function getView() {
    try {
      var v = JSON.parse(localStorage.getItem(LS_VIEW) || '{}');
      return {
        hideColors: Array.isArray(v.hideColors) ? v.hideColors : [],
        hideSymbols: Array.isArray(v.hideSymbols) ? v.hideSymbols : [],
        hideAuthors: Array.isArray(v.hideAuthors) ? v.hideAuthors : [],
        scale: (typeof v.scale === 'number' && v.scale > 0) ? v.scale : 1
      };
    } catch (e) { return { hideColors: [], hideSymbols: [], hideAuthors: [], scale: 1 }; }
  }
  function setView(v) {
    try { localStorage.setItem(LS_VIEW, JSON.stringify(v)); } catch (e) {}
  }

  /* Palvelinfunktioiden virheet suomeksi */
  function errText(e) {
    var m = String((e && e.message) || e || '');
    if (m.indexOf('BAD_PASSWORD')    > -1) return 'Vaara salasana';
    if (m.indexOf('NOT_WHITELISTED') > -1) return 'Pelinimi ei ole sallittujen listalla';
    if (m.indexOf('NO_RIGHTS')       > -1) return 'Ei oikeuksia — tarkista salasana ja pelinimi';
    if (m.indexOf('NO_AUTHOR')       > -1) return 'Pelinimi puuttuu';
    if (m.indexOf('NOT_FOUND')       > -1) return 'Merkkia ei loytynyt';
    if (m.indexOf('THUMB_TOO_BIG')   > -1) return 'Kuvan pikkukuva jai liian isoksi';
    if (m.indexOf('FULL_TOO_BIG')    > -1) return 'Kuva jai pakkauksen jalkeenkin liian isoksi';
    if (m.indexOf('UPLOAD_FAILED')   > -1) return 'Kuvan lataus palvelimelle epaonnistui';
    if (m.indexOf('NO_IMAGE')        > -1) return 'Kuva puuttuu';
    if (m.indexOf('MAX_IMAGES')      > -1) return 'Merkilla on jo enimmaismaara kuvia (5)';
    return 'Toiminto ei onnistunut';
  }

  /* ---------- kohta 9: kuvan pakkaus selaimessa (canvas) ---------- */
  function loadImageFile(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { resolve({ img: img, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('IMG_LOAD_FAILED')); };
      img.src = url;
    });
  }
  function canvasJpeg(img, maxDim, quality) {
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    var scale = Math.min(1, maxDim / Math.max(w, h));
    var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
    var cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    cv.getContext('2d').drawImage(img, 0, 0, cw, ch);
    return new Promise(function (resolve) { cv.toBlob(function (b) { resolve(b); }, 'image/jpeg', quality); });
  }
  /* Kokeilee laskevia laatuja kunnes tavoitekoko alittuu; palauttaa
     pienimman loydetyn jos tavoitetta ei saavuteta. */
  function shrinkToTarget(img, maxDim, targetBytes) {
    var qualities = [0.82, 0.7, 0.58, 0.46, 0.36, 0.28];
    var i = 0, best = null;
    function next() {
      if (i >= qualities.length) return Promise.resolve(best);
      var q = qualities[i++];
      return canvasJpeg(img, maxDim, q).then(function (b) {
        if (b && (!best || b.size < best.size)) best = b;
        if (b && b.size <= targetBytes) return b;
        return next();
      });
    }
    return next();
  }
  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1] || ''); };
      r.onerror = function () { reject(new Error('READ_FAILED')); };
      r.readAsDataURL(blob);
    });
  }
  /* Tuottaa pikkukuvan (max 20 kt) ja isomman version (max 250 kt)
     mista tahansa selaimeen valitusta kuvasta. Jos alkuperainen tiedosto
     on jo sallittua kuvatyyppia (jpeg/png/webp) JA jo tavoitekokoa
     pienempi, sita EI pakata/pienenneta uudelleen — kaytetaan sellaisenaan. */
  var PASSTHROUGH_TYPES = { 'image/jpeg': 1, 'image/png': 1, 'image/webp': 1 };
  function passOrCompress(file, loaded, maxDim, targetBytes) {
    if (PASSTHROUGH_TYPES[file.type] && file.size <= targetBytes) {
      return Promise.resolve({ blob: file, type: file.type });
    }
    return shrinkToTarget(loaded.img, maxDim, targetBytes).then(function (b) {
      return { blob: b, type: 'image/jpeg' };
    });
  }
  function compressImage(file) {
    return loadImageFile(file).then(function (loaded) {
      return Promise.all([
        passOrCompress(file, loaded, 260, 20 * 1024),
        passOrCompress(file, loaded, 1600, 250 * 1024)
      ]).then(function (arr) {
        URL.revokeObjectURL(loaded.url);
        var thumb = arr[0], full = arr[1];
        if (!thumb.blob || !full.blob) throw new Error('COMPRESS_FAILED');
        return Promise.all([blobToBase64(thumb.blob), blobToBase64(full.blob)]).then(function (b64) {
          return {
            thumbB64: b64[0], thumbType: thumb.type, thumbBytes: thumb.blob.size,
            fullB64: b64[1], fullType: full.type, fullBytes: full.blob.size
          };
        });
      });
    });
  }
  var MAX_IMAGES = 5;
  function mayEditImage(img) {
    if (isDev()) return true;
    var n = savedName();
    return !!n && !!img && !!img.added_by && n.toLowerCase() === String(img.added_by).toLowerCase();
  }

  /* Pelinimi + oma salasana muokkausta/poistoa varten.
     Dev-tilassa yllapitokoodi kelpaa salasanaksi. */
  function creds(pin) {
    if (isDev() && devCode()) {
      return { pass: devCode(), author: savedName() || (pin && pin.author) || 'dev' };
    }
    var a = savedName();
    if (!a) {
      a = (prompt('Pelinimesi:') || '').trim();
      if (!a) return null;
      saveName(a);
    }
    var pw = savedPass();
    if (!pw) {
      pw = prompt('Salasanasi:');
      if (pw === null || pw === '') return null;
      savePass(pw);
    }
    return { pass: pw, author: a };
  }

  function toast(msg, ok) {
    if (typeof Toastify === 'function') {
      Toastify({
        text: msg, duration: 3200, gravity: 'bottom', position: 'center',
        style: { background: ok === false ? '#b23b3b' : '#1c2a22', border: '1px solid rgba(255,255,255,.18)' }
      }).showToast();
    }
  }

  /* ---------- tallennus ---------- */
  var Store = {
    base: function () { return CFG.supabaseUrl.replace(/\/$/, ''); },
    head: function () {
      return {
        'apikey': CFG.supabaseKey,
        'Authorization': 'Bearer ' + CFG.supabaseKey,
        'Content-Type': 'application/json'
      };
    },
    /* Kaikki kirjoitus kulkee taalta: palvelin tarkistaa koodin */
    rpc: function (fn, body) {
      return fetch(this.base() + '/rest/v1/rpc/' + fn, {
        method: 'POST', headers: this.head(), body: JSON.stringify(body || {})
      }).then(function (r) {
        return r.text().then(function (txt) {
          var data = null;
          try { data = txt ? JSON.parse(txt) : null; } catch (e) {}
          if (!r.ok) {
            var msg = (data && (data.message || data.error || data.hint)) || txt || ('HTTP ' + r.status);
            throw new Error(msg);
          }
          return data;
        });
      });
    },
    one: function (d) { return Array.isArray(d) ? d[0] : d; },
    local: function (rows) {
      try {
        if (rows) { localStorage.setItem(LS_LOCAL, JSON.stringify(rows)); return rows; }
        return JSON.parse(localStorage.getItem(LS_LOCAL) || '[]');
      } catch (e) { return []; }
    },
    plain: function () {
      return fetch(this.base() + '/rest/v1/' + CFG.table + '?select=*&order=created_at.asc', {
        headers: { 'apikey': CFG.supabaseKey, 'Authorization': 'Bearer ' + CFG.supabaseKey }
      }).then(function (r) { return r.ok ? r.json() : []; })
        .catch(function () { return []; });
    },
    list: function () {
      if (!SHARED) return Promise.resolve(this.local());
      var self = this;
      /* Piilotetut merkit eivat tule API:sta lapi lainkaan — dev hakee
         ne erillisella funktiolla, joka tarkistaa koodin palvelimella. */
      if (isDev() && devCode()) {
        return this.rpc('pins_all', { p_code: devCode() })
          .then(function (rows) { return rows || []; })
          .catch(function () { return self.plain(); });
      }
      return this.plain();
    },
    add: function (pin, c) {
      if (!SHARED) {
        pin.id = 'local-' + Date.now();
        var a = this.local(); a.push(pin); this.local(a);
        return Promise.resolve(pin);
      }
      var self = this;
      return this.rpc('pin_add', {
        p_pass: c.pass, p_author: c.author,
        p_title: pin.title, p_message: pin.message || '',
        p_color: pin.color, p_x: pin.x, p_z: pin.z,
        p_symbol: pin.symbol || 'dot', p_size: pin.size || 1, p_show_text: !!pin.show_text
      }).then(function (d) { return self.one(d); });
    },
    update: function (id, patch, c) {
      if (!SHARED) {
        var a = this.local().map(function (p) { return String(p.id) === String(id) ? Object.assign(p, patch) : p; });
        this.local(a);
        return Promise.resolve();
      }
      var v = function (k) { return patch[k] === undefined ? null : patch[k]; };
      return this.rpc('pin_edit', {
        p_pass: c.pass, p_author: c.author, p_id: id,
        p_title: v('title'), p_message: v('message'), p_color: v('color'),
        p_x: v('x'), p_z: v('z'), p_hidden: v('hidden'),
        p_symbol: v('symbol'), p_size: v('size'), p_show_text: v('show_text')
      });
    },
    /* Poistaa merkin JA kaikki sen kuvat (myos Storagesta) Edge Functionin
       kautta — pelkka pin_delete-RPC ei siivoaisi Storage-tiedostoja. */
    remove: function (id, c) {
      if (!SHARED) {
        this.local(this.local().filter(function (p) { return String(p.id) !== String(id); }));
        return Promise.resolve();
      }
      var self = this;
      return fetch(this.base() + '/functions/v1/pin-image', {
        method: 'POST', headers: this.head(),
        body: JSON.stringify({ action: 'pin_delete', pass: c.pass, author: c.author, id: id })
      }).then(function (r) {
        return r.json().catch(function () { return null; }).then(function (data) {
          if (!r.ok) throw new Error((data && data.error) || ('HTTP ' + r.status));
          return data;
        });
      });
    },
    /* Kohta 9 (v2): monta kuvaa per merkki (max 5). Kulkee Edge Functionin
       kautta koska tiedoston tavuja ei voi laittaa suoraan RPC:lle —
       service-role-avain (joka voi kirjoittaa Storageen) asuu vain
       funktiossa, ei koskaan taalla clientilla. */
    imageAdd: function (id, img, c) {
      if (!SHARED) return Promise.reject(new Error('NO_SHARED'));
      return fetch(this.base() + '/functions/v1/pin-image', {
        method: 'POST', headers: this.head(),
        body: JSON.stringify({
          action: 'add', pass: c.pass, author: c.author, id: id,
          thumb: img.thumbB64, thumbType: img.thumbType, full: img.fullB64, fullType: img.fullType
        })
      }).then(function (r) {
        return r.json().catch(function () { return null; }).then(function (data) {
          if (!r.ok) throw new Error((data && data.error) || ('HTTP ' + r.status));
          return data;
        });
      });
    },
    imageDelete: function (imageId, c) {
      if (!SHARED) return Promise.reject(new Error('NO_SHARED'));
      return fetch(this.base() + '/functions/v1/pin-image', {
        method: 'POST', headers: this.head(),
        body: JSON.stringify({ action: 'delete', pass: c.pass, author: c.author, image_id: imageId })
      }).then(function (r) {
        return r.json().catch(function () { return null; }).then(function (data) {
          if (!r.ok) throw new Error((data && data.error) || ('HTTP ' + r.status));
          return data;
        });
      });
    },
    /* Kaikkien nakyvien merkkien kuvat (RLS piilottaa piilotettujen
       merkkien kuvat samalla tavoin kuin itse merkit). */
    plainImages: function () {
      return fetch(this.base() + '/rest/v1/pin_images?select=*&order=created_at.asc', {
        headers: { 'apikey': CFG.supabaseKey, 'Authorization': 'Bearer ' + CFG.supabaseKey }
      }).then(function (r) { return r.ok ? r.json() : []; })
        .catch(function () { return []; });
    },
    images: function () {
      if (!SHARED) return Promise.resolve([]);
      if (isDev() && devCode()) {
        var self = this;
        return this.rpc('pin_images_all', { p_code: devCode() })
          .then(function (rows) { return rows || []; })
          .catch(function () { return self.plainImages(); });
      }
      return this.plainImages();
    },
    /* Kohta 23: yhden merkin kuvat vasta kun merkkia klikataan kartalla —
       ei haeta kaikkien merkkien kuvia etukateen sivun ensilatauksessa. */
    imagesForPin: function (pinId) {
      if (!SHARED) return Promise.resolve([]);
      return fetch(this.base() + '/rest/v1/pin_images?select=*&pin_id=eq.' + encodeURIComponent(pinId) + '&order=created_at.asc', {
        headers: { 'apikey': CFG.supabaseKey, 'Authorization': 'Bearer ' + CFG.supabaseKey }
      }).then(function (r) { return r.ok ? r.json() : []; })
        .catch(function () { return []; });
    }
  };

  function loadWhitelist() {
    if (!SHARED) { WHITELIST = []; return Promise.resolve(); }
    return fetch(CFG.supabaseUrl.replace(/\/$/,'') + '/rest/v1/settings?select=whitelist&id=eq.1', {
      headers: { apikey: CFG.supabaseKey, Authorization: 'Bearer ' + CFG.supabaseKey }
    }).then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) { WHITELIST = (rows[0] && rows[0].whitelist) || []; })
      .catch(function () { WHITELIST = []; });
  }
  function onWhitelist(name) {
    if (isDev()) return true;
    if (!WHITELIST || !WHITELIST.length) return true;   // tyhja lista = ei rajoitusta
    var n = String(name || '').toLowerCase();
    return WHITELIST.some(function (w) { return String(w).toLowerCase() === n; });
  }

  function announce() {
    try { window.parent.postMessage({ kspk: 'pins-changed' }, '*'); } catch (e) {}
  }
  function tellParentDev(on) {
    try { window.parent.postMessage({ kspk: 'dev-state', on: !!on }, '*'); } catch (e) {}
  }
  /* Emosivun vierityslukko ei saa palata kun tassa on lomake tai kupla auki */
  function tellParentBusy(on) {
    try { window.parent.postMessage({ kspk: 'map-busy', on: !!on }, '*'); } catch (e) {}
  }

  /* ---------- tyylit ---------- */
  function injectCss() {
    var css = ''
      + '.kspk-pop{position:absolute;bottom:14px;left:-150px;width:300px;padding:14px 16px;'
      + 'background:rgba(10,18,14,.96);color:#eaf3ee;border:1px solid rgba(255,255,255,.18);'
      + 'border-radius:14px;box-shadow:0 18px 44px -18px #000;font:14px/1.5 system-ui,sans-serif;z-index:60}'
      + '.kspk-pop:after{content:"";position:absolute;bottom:-9px;left:160px;width:16px;height:16px;'
      + 'background:inherit;border-right:1px solid rgba(255,255,255,.18);border-bottom:1px solid rgba(255,255,255,.18);'
      + 'transform:rotate(45deg)}'
      + '.kspk-pop h4{margin:0 0 6px;font-size:15px;display:flex;align-items:center;gap:8px}'
      + '.kspk-pop .dot{width:11px;height:11px;border-radius:50%;flex:0 0 auto;box-shadow:0 0 0 2px rgba(0,0,0,.45)}'
      + '.kspk-pop p{margin:0 0 10px;white-space:pre-wrap;word-break:break-word}'
      + '.kspk-pop .meta{font-size:12px;opacity:.6;margin:0 0 10px}'
      + '.kspk-pop .row{display:flex;gap:7px;justify-content:flex-end;flex-wrap:wrap}'
      + '.kspk-tag{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;'
      + 'background:rgba(255,209,102,.16);color:#ffd166;border:1px solid rgba(255,209,102,.35);margin-left:6px}'
      + '.kspk-btn{border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.07);color:inherit;'
      + 'padding:7px 13px;border-radius:9px;cursor:pointer;font:inherit;font-size:13px}'
      + '.kspk-btn:hover{background:rgba(255,255,255,.14)}'
      + '.kspk-btn--danger{border-color:rgba(255,107,107,.5);color:#ff8f8f}'
      + '.kspk-btn--primary{background:#3ef08a;border-color:#3ef08a;color:#05140c;font-weight:600}'
      + '.kspk-modal{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;'
      + 'background:rgba(3,6,5,.62);padding:16px;overflow:auto}'
      + '.kspk-card{width:min(430px,100%);padding:22px;border-radius:16px;background:#0c1510;color:#eaf3ee;'
      + 'border:1px solid rgba(255,255,255,.16);box-shadow:0 30px 70px -28px #000;font:14px/1.5 system-ui,sans-serif}'
      + '.kspk-card h3{margin:0 0 4px;font-size:17px}'
      + '.kspk-card .sub{margin:0 0 14px;font-size:12.5px;opacity:.6}'
      + '.kspk-card label{display:block;font-size:12px;opacity:.75;margin:12px 0 5px}'
      + '.kspk-card input,.kspk-card textarea{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;'
      + 'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);color:inherit;font:inherit}'
      + '.kspk-card textarea{min-height:80px;resize:vertical}'
      + '.kspk-card input:focus,.kspk-card textarea:focus{outline:none;border-color:#3ef08a}'
      + '.kspk-xy{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end}'
      + '.kspk-xy .kspk-btn{padding:10px 12px;white-space:nowrap}'
      + '.kspk-colors{display:flex;gap:9px;flex-wrap:wrap;margin-top:6px}'
      + '.kspk-colors button{width:28px;height:28px;border-radius:50%;border:2px solid transparent;cursor:pointer;padding:0}'
      + '.kspk-colors button[aria-checked="true"]{border-color:#fff;transform:scale(1.15)}'
      + '.kspk-symbols{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}'
      + '.kspk-symbols button{width:34px;height:34px;border-radius:9px;border:2px solid rgba(255,255,255,.18);'
      + 'background:rgba(255,255,255,.06);color:#eaf3ee;font-size:16px;line-height:1;cursor:pointer;padding:0;'
      + 'display:grid;place-items:center}'
      + '.kspk-symbols button[aria-checked="true"]{border-color:#3ef08a;background:rgba(62,240,138,.14);color:#3ef08a}'
      + '.kspk-card input[type=range]{width:100%;margin:6px 0 0;accent-color:#3ef08a}'
      + '.kspk-check{display:flex;align-items:center;gap:8px;margin:14px 0 0;font-size:13px;cursor:pointer;opacity:.9}'
      + '.kspk-check input{width:auto;margin:0}'
      + '.kspk-card .row{display:flex;gap:9px;justify-content:flex-end;margin-top:20px;flex-wrap:wrap}'
      + '.kspk-hint{margin:14px 0 0;padding:10px 12px;border-radius:10px;font-size:12.5px;'
      + 'background:rgba(62,240,138,.08);border:1px solid rgba(62,240,138,.22);color:#b9f5d2}'
      + '.kspk-coord{position:absolute;top:10px;right:10px;z-index:46;padding:6px 12px;border-radius:9px;'
      + 'background:rgba(10,18,14,.85);color:#9db3a6;border:1px solid rgba(255,255,255,.16);'
      + 'font:12px/1.3 ui-monospace,monospace;pointer-events:none;white-space:nowrap}'
      /* uNmINeDin oma ol.control.MousePosition (harmaanvalkoinen "palkki"
         samassa kulmassa) piilotetaan — kayttajan oma tumma .kspk-coord
         korvaa sen kokonaan, kahta paallekkaista koordinaattia ei tarvita. */
      + '.ol-mouse-position{display:none!important}'
      + '.kspk-badge{position:absolute;left:10px;bottom:10px;z-index:40;padding:6px 11px;border-radius:999px;'
      + 'background:rgba(10,18,14,.85);color:#9db3a6;border:1px solid rgba(255,255,255,.14);'
      + 'font:12px system-ui,sans-serif;pointer-events:none}'
      + '.kspk-dev{position:absolute;right:10px;bottom:10px;z-index:45;width:38px;height:38px;border-radius:50%;'
      + 'display:grid;place-items:center;cursor:pointer;font-size:17px;'
      + 'background:rgba(10,18,14,.85);color:#9db3a6;border:1px solid rgba(255,255,255,.16)}'
      + '.kspk-dev.on{background:#ffd166;color:#241a00;border-color:#ffd166}'
      + '.kspk-view{position:absolute;right:10px;bottom:56px;z-index:45;width:38px;height:38px;border-radius:50%;'
      + 'display:grid;place-items:center;cursor:pointer;font-size:17px;'
      + 'background:rgba(10,18,14,.85);color:#9db3a6;border:1px solid rgba(255,255,255,.16)}'
      + '.kspk-view.on{background:#5aa9ff;color:#041018;border-color:#5aa9ff}'
      + '.kv-off{opacity:.28}'
      + '.kspk-authors{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}'
      + '.kspk-authors button{padding:6px 12px;border-radius:999px;border:2px solid rgba(255,255,255,.18);'
      + 'background:rgba(255,255,255,.06);color:#eaf3ee;font:inherit;font-size:12.5px;cursor:pointer}'
      + '.kspk-imgrow{display:flex;align-items:center;gap:10px;margin-top:6px}'
      + '.kspk-imgprev{width:64px;height:64px;object-fit:cover;border-radius:10px;border:1px solid rgba(255,255,255,.18);display:block}'
      + '.kspk-imggrid{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px}'
      + '.kspk-imgitem{display:flex;flex-direction:column;align-items:center;gap:6px;width:76px}'
      + '.kspk-imgitem .kspk-btn{padding:4px 8px;font-size:11px;white-space:nowrap}'
      + '.kspk-imgcount{font-size:12px;opacity:.6;margin:6px 0 0}'
      + '.kspk-card input[type=file]{width:100%;box-sizing:border-box;padding:9px 10px;border-radius:10px;'
      + 'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);color:inherit;font:inherit;font-size:12.5px}'
      + '.kspk-ripple{position:absolute;z-index:44;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;'
      + 'pointer-events:none;border:2px solid #3ef08a;box-shadow:0 0 22px 4px rgba(62,240,138,.45);'
      + 'animation:kspkR .6s cubic-bezier(.2,.7,.3,1) forwards}'
      + '@keyframes kspkR{from{transform:scale(1);opacity:.95}to{transform:scale(22);opacity:0}}';
    document.head.appendChild(el('style', null, css));
  }

  /* ---------- merkin tyyli ---------- */
  function pinStyle(p, olns, viewScale, hoverT) {
    var vs = (typeof viewScale === 'number' && viewScale > 0) ? viewScale : 1;
    var ht = (typeof hoverT === 'number' && hoverT > 0) ? Math.min(1, hoverT) : 0;
    var c = p.color || CFG.colors[0];
    var hidden = !!p.hidden;
    var sym = p.symbol || 'dot';
    /* Hiiren hover "nappimainen" suurennus: baseR kasvaa max +21.6%
       kun ht=1 (0.18 * 1.2, ks. hoverScale-animaatio boot()issa). */
    var baseR = 8 * (p.size || 1) * vs * (1 + 0.216 * ht);
    var fillColor = hidden ? 'rgba(120,120,120,.45)' : c;
    /* Yhtenaistetty uusien SVG-kuvakkeiden kanssa: taysin musta (ei 65%
       lapinakyva) ja outline skaalautuu koon mukaan (baseR/6) kiintean
       3px:n sijaan — muuten piste/nelio/kolmio/tahti/timantti nayttivat
       paksummalta, vaaleammalta ja pehmeammalta kuin uudet kuvakkeet. */
    var strokeColor = hidden ? 'rgba(255,255,255,.55)' : '#000';
    var strokeW = Math.max(1, baseR / 6);
    var fill = new olns.style.Fill({ color: fillColor });
    var stroke = new olns.style.Stroke({ color: strokeColor, width: strokeW, lineDash: hidden ? [3, 3] : undefined });
    var image;
    var iconUri = ICON_SVGS[sym] ? iconDataUri(sym) : null;
    switch (sym) {
      case 'square':
        image = new olns.style.RegularShape({ fill: fill, stroke: stroke, points: 4, radius: baseR * 1.15, angle: Math.PI / 4 });
        break;
      case 'triangle':
        image = new olns.style.RegularShape({ fill: fill, stroke: stroke, points: 3, radius: baseR * 1.35, angle: 0 });
        break;
      case 'star':
        image = new olns.style.RegularShape({ fill: fill, stroke: stroke, points: 5, radius: baseR * 1.35, radius2: baseR * 0.55, angle: 0 });
        break;
      case 'diamond':
        image = new olns.style.RegularShape({ fill: fill, stroke: stroke, points: 4, radius: baseR * 1.3, angle: 0 });
        break;
      default:
        if (iconUri) {
          /* Kohta 25 + korjaus: mukautetut muodot (talo, paakallo, jne.) ovat
             inline-SVG data-URIna, valkoisella taytolla + mustalla outlinella.
             OpenLayersin Icon color-optio varjaa kuvan "multiply"-sekoituksella:
             valkoinen (255) -> tasan valittu vari, musta outline (0) pysyy aina
             mustana. scale laskee kuvakkeen kokonaisen ICON_SCALE-kertoimen
             kautta niin etta 1x-koossa kuvakkeen mitat vastaavat 1x-ympyran
             halkaisijaa (2*baseR) — kuvakkeet eivat muuten tayta 24x24-ruutua
             yhta tarkasti kuin ympyra oman sateensa. anchor on eksplisiittinen
             (kuvan keskikohta), jotta merkki pysyy tasmalleen koordinaatissaan. */
          image = new olns.style.Icon({
            src: iconUri,
            color: fillColor,
            anchor: [0.5, 0.5],
            anchorXUnits: 'fraction',
            anchorYUnits: 'fraction',
            scale: (baseR * (ICON_SCALE[sym] || 2.4)) / ICON_PX,
            opacity: hidden ? 0.55 : 1
          });
        } else {
          image = new olns.style.Circle({ radius: baseR, fill: fill, stroke: stroke });
        }
    }
    var s = new olns.style.Style({ image: image });
    /* Otsikko nakyy joko pysyvasti (show_text) tai hetkellisesti hoverin
       ajan (ht>0) vaikka show_text olisi pois — sama valmis teksti-tyyli,
       ei erillista uutta elementtia. Hover-tapauksessa ht (0->1) toimii
       samalla myos "mini-fade-in"-himmennyksena tekstin lapinakyvyytena. */
    var titleVisible = p.title && (p.show_text || ht > 0);
    if (titleVisible) {
      var ta = p.show_text ? 1 : ht;
      s.setText(new olns.style.Text({
        text: p.title + (hidden ? ' (piilotettu)' : ''),
        font: '600 ' + Math.max(9, Math.round(13 * vs)) + 'px system-ui,sans-serif', offsetY: -20 - (baseR - 8),
        fill: new olns.style.Fill({ color: (hidden ? 'rgba(185,196,189,' : 'rgba(255,255,255,') + ta + ')' }),
        stroke: new olns.style.Stroke({ color: 'rgba(0,0,0,' + (0.85 * ta) + ')', width: 3 })
      }));
    }
    /* Tumma, lapinakyva "varjoympyra" ikonin/muodon alla — hieman pienempi
       kuin itse merkki, antaa pientä syvyytta ja auttaa erottumaan vaaleista
       karttapohjista. Piirretaan ensin (taustimmaisena tyylina). */
    var shadow = new olns.style.Style({
      image: new olns.style.Circle({
        radius: baseR * 0.86,
        fill: new olns.style.Fill({ color: hidden ? 'rgba(0,0,0,.15)' : 'rgba(0,0,0,.32)' })
      })
    });
    return [shadow, s];
  }

  /* ---------- lomake (lisays + muokkaus) ---------- */
  function pinForm(opts, done) {
    // opts: { mode:'add'|'edit', x, z, pin }
    var edit = opts.mode === 'edit';
    var p = opts.pin || {};
    var color = p.color || CFG.colors[0];

    var wrap = el('div', 'kspk-modal');
    var card = el('div', 'kspk-card');
    card.innerHTML =
      '<h3>' + (edit ? 'Muokkaa merkkia' : 'Lisaa merkki') + '</h3>' +
      '<p class="sub">' + (edit ? 'Muuta tietoja ja tallenna' : 'Napauta kartalla kolmesti tai klikkaa oikealla') + '</p>' +

      '<label>Otsikko *</label><input id="kp-t" maxlength="40" placeholder="esim. Kotini">' +
      '<label>Viesti</label><textarea id="kp-m" maxlength="400" placeholder="Kerro mita taalla on..."></textarea>' +

      '<label>Koordinaatit (voit korjata tahan tarkat)</label>' +
      '<div class="kspk-xy">' +
        '<input id="kp-x" type="number" step="1" placeholder="X">' +
        '<input id="kp-z" type="number" step="1" placeholder="Z">' +
        '<button type="button" class="kspk-btn" id="kp-center">Kartan keskelta</button>' +
      '</div>' +

      '<label>Vari</label><div class="kspk-colors" id="kp-c" role="radiogroup"></div>' +

      '<label>Symboli</label><div class="kspk-symbols" id="kp-sym" role="radiogroup"></div>' +

      '<label>Koko (<span id="kp-size-val">1.0x</span>)</label>' +
      '<input id="kp-size" type="range" min="0.4" max="2.5" step="0.1" value="1">' +

      '<label class="kspk-check"><input type="checkbox" id="kp-text"> Nayta otsikko kartalla</label>' +

      '<label>Kuvat (<span id="kp-img-count">0</span>/' + MAX_IMAGES + ', valinnainen)</label>' +
      '<div class="kspk-imggrid" id="kp-imggrid"></div>' +
      '<div id="kp-img-addwrap"><input id="kp-img" type="file" accept="image/*"></div>' +
      (!edit ? '<div class="kspk-imgcount">Ensimmainen kuva liitetaan heti kun merkki on lisatty. Loput (max ' +
        MAX_IMAGES + ') voit lisata jalkeenpain muokkauksesta.</div>' : '') +
      '<div id="kp-img-status" class="kspk-hint" style="display:none"></div>' +

      '<label>Pelinimesi *</label><input id="kp-a" maxlength="24" placeholder="Minecraft-nimesi">' +
      '<label>Salasanasi *</label><input id="kp-p" type="password" placeholder="' +
        (isDev() ? 'Tyhja = yllapitokoodi' : 'Oma salasanasi') + '">' +
      (isDev() ? '<div class="kspk-hint">Dev-tila paalla — voit muokata ja poistaa kaikkien merkkeja.</div>' : '') +
      (!isDev() && WHITELIST && WHITELIST.length
        ? '<div class="kspk-hint">Sallitut pelinimet: ' + esc(WHITELIST.join(', ')) + '</div>' : '') +

      '<div class="row">' +
        '<button class="kspk-btn" id="kp-x2">Peruuta</button>' +
        '<button class="kspk-btn kspk-btn--primary" id="kp-ok">' + (edit ? 'Tallenna' : 'Lisaa merkki') + '</button>' +
      '</div>';
    wrap.appendChild(card);
    document.body.appendChild(wrap);
    tellParentBusy(true);

    var $ = function (id) { return card.querySelector(id); };
    $('#kp-t').value = p.title || '';
    $('#kp-m').value = p.message || '';
    $('#kp-x').value = Math.round(edit ? p.x : opts.x);
    $('#kp-z').value = Math.round(edit ? p.z : opts.z);
    $('#kp-a').value = edit ? (p.author || '') : savedName();
    $('#kp-p').value = isDev() ? '' : savedPass();

    var cbox = $('#kp-c');
    CFG.colors.forEach(function (c) {
      var b = el('button');
      b.style.background = c;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', c === color ? 'true' : 'false');
      b.onclick = function () {
        color = c;
        [].forEach.call(cbox.children, function (o) { o.setAttribute('aria-checked', 'false'); });
        b.setAttribute('aria-checked', 'true');
      };
      cbox.appendChild(b);
    });

    var symbol = (edit ? p.symbol : null) || 'dot';
    var sbox = $('#kp-sym');
    SYMBOLS.forEach(function (sInfo) {
      var b = el('button', null, sInfo.glyph);
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', sInfo.id === symbol ? 'true' : 'false');
      b.title = sInfo.id;
      b.onclick = function () {
        symbol = sInfo.id;
        [].forEach.call(sbox.children, function (o) { o.setAttribute('aria-checked', 'false'); });
        b.setAttribute('aria-checked', 'true');
      };
      sbox.appendChild(b);
    });

    var sizeVal = (edit ? p.size : null) || 1;
    $('#kp-size').value = sizeVal;
    $('#kp-size-val').textContent = Number(sizeVal).toFixed(1) + 'x';
    $('#kp-size').addEventListener('input', function () {
      $('#kp-size-val').textContent = Number($('#kp-size').value).toFixed(1) + 'x';
    });

    $('#kp-text').checked = edit ? !!p.show_text : false;

    /* ---------- kohta 9 (v2): monta kuvaa per merkki (max 5) ---------- */
    var pendingImage = null;                 // vain lisays-tilassa (merkilla ei viela id:ta)
    var images = edit ? (p.images || []).slice() : [];
    var imgGrid = $('#kp-imggrid');
    var imgAddWrap = $('#kp-img-addwrap');
    var imgFile = $('#kp-img');
    var imgStatus = $('#kp-img-status');

    function renderImgGrid() {
      $('#kp-img-count').textContent = images.length + (pendingImage ? 1 : 0);
      imgGrid.innerHTML = '';
      images.forEach(function (im) {
        var item = el('div', 'kspk-imgitem');
        item.innerHTML =
          '<a href="' + esc(im.full_url) + '" target="_blank" rel="noopener">' +
            '<img src="' + esc(im.thumb_url) + '" class="kspk-imgprev" alt="Merkin kuva"></a>' +
          (mayEditImage(im) ? '<button type="button" class="kspk-btn kspk-btn--danger" data-id="' + im.id + '">Poista</button>' : '');
        var b = item.querySelector('button');
        if (b) b.onclick = function () {
          if (!confirm('Poistetaanko tama kuva? Toimintoa ei voi perua.')) return;
          var c = creds(p);
          if (!c) return;
          b.disabled = true;
          Store.imageDelete(im.id, c).then(function () {
            images = images.filter(function (o) { return o.id !== im.id; });
            if (edit) p.images = images;
            renderImgGrid(); draw(); announce();
            toast('Kuva poistettu');
          }).catch(function (e) { toast(errText(e), false); b.disabled = false; });
        };
        imgGrid.appendChild(item);
      });
      imgAddWrap.style.display = (edit ? images.length >= MAX_IMAGES : !!pendingImage) ? 'none' : '';
    }
    renderImgGrid();

    imgFile.addEventListener('change', function (ev) {
      var f = ev.target.files && ev.target.files[0];
      if (!f) {
        if (!edit) { pendingImage = null; renderImgGrid(); }
        imgStatus.style.display = 'none';
        return;
      }
      imgStatus.style.display = ''; imgStatus.textContent = 'Pakataan kuvaa...';
      compressImage(f).then(function (res) {
        if (!edit) {
          pendingImage = res;
          imgStatus.textContent = 'Kuva valmis (pikkukuva ~' + Math.round(res.thumbBytes / 1024) +
            ' kt, iso versio ~' + Math.round(res.fullBytes / 1024) + ' kt). Liitetaan kun merkki lisataan.';
          renderImgGrid();
          return;
        }
        var c = creds(p);
        if (!c) { imgStatus.style.display = 'none'; imgFile.value = ''; return; }
        imgStatus.textContent = 'Lisataan kuvaa...';
        imgFile.disabled = true;
        Store.imageAdd(p.id, res, c).then(function (row) {
          images.push(row);
          p.images = images;
          imgFile.value = ''; imgFile.disabled = false;
          imgStatus.style.display = 'none';
          renderImgGrid(); draw(); announce();
          toast('Kuva lisatty');
        }).catch(function (e) {
          imgFile.disabled = false;
          imgStatus.textContent = errText(e);
        });
      }).catch(function () {
        imgStatus.textContent = 'Kuvan kasittely epaonnistui — kokeile toista kuvaa.';
      });
    });

    $('#kp-center').onclick = function () {
      if (opts.centre) {
        var c = opts.centre();
        $('#kp-x').value = Math.round(c[0]);
        $('#kp-z').value = Math.round(c[1]);
      }
    };

    setTimeout(function () { $('#kp-t').focus(); }, 30);
    function close() {
      wrap.remove();
      document.removeEventListener('keydown', onEsc);
      tellParentBusy(false);
    }
    function onEsc(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
    document.addEventListener('keydown', onEsc);
    $('#kp-x2').onclick = close;
    /* Taustaklikkaus sulkee vain jos painallus ALKOI taustalta. Nain
       tekstin maalaaminen lomakkeen sisalla ei enaa sulje lomaketta. */
    var downOnWrap = false;
    wrap.addEventListener('pointerdown', function (e) { downOnWrap = (e.target === wrap); });
    wrap.addEventListener('click', function (e) {
      if (e.target === wrap && downOnWrap) close();
      downOnWrap = false;
    });

    $('#kp-ok').onclick = function () {
      var t = $('#kp-t').value.trim();
      var a = $('#kp-a').value.trim();
      var pw = $('#kp-p').value;
      if (!t) { toast('Otsikko puuttuu', false); $('#kp-t').focus(); return; }
      if (!a) { toast('Pelinimi puuttuu', false); $('#kp-a').focus(); return; }
      if (!pw && isDev()) pw = devCode();
      if (!pw) { toast('Salasana puuttuu', false); $('#kp-p').focus(); return; }
      if (!onWhitelist(a)) {
        toast('Pelinimi "' + a + '" ei ole sallittujen listalla', false); $('#kp-a').focus(); return;
      }
      if (edit && !isDev() && a.toLowerCase() !== String(p.author || '').toLowerCase()) {
        toast('Tama on toisen merkki — pelinimen pitaa tasmata', false); return;
      }
      var x = parseInt($('#kp-x').value, 10);
      var z = parseInt($('#kp-z').value, 10);
      if (isNaN(x) || isNaN(z)) { toast('Koordinaatit puuttuvat', false); return; }

      saveName(a);
      if (!isDev() || pw !== devCode()) savePass(pw);
      close();
      done({
        x: x, z: z, title: t, message: $('#kp-m').value.trim(), author: a, color: color,
        symbol: symbol, size: parseFloat($('#kp-size').value) || 1, show_text: $('#kp-text').checked
      }, { pass: pw, author: a }, pendingImage);
    };
  }

  /* ---------- oikeustarkistus ---------- */
  function mayEdit(p) {
    if (isDev()) return true;
    var n = savedName();
    return !!n && n.toLowerCase() === String(p.author || '').toLowerCase();
  }

  /* ---------- paaohjelma ---------- */
  function boot(unmined) {
    var olns = window.ol;
    var map = unmined.olMap;
    if (!map || !olns) return;

    injectCss();

    var source = new olns.source.Vector();
    var layer = new olns.layer.Vector({ source: source, zIndex: 50 });
    map.addLayer(layer);

    var popEl = el('div');
    var overlay = new olns.Overlay({ element: popEl, positioning: 'bottom-center', stopEvent: true });
    map.addOverlay(overlay);
    function closePop() {
      popToken++;
      popEl.innerHTML = ''; popEl.className = '';
      overlay.setPosition(undefined);
      tellParentBusy(false);
    }

    /* --- hover: pieni "nappimainen" suurennus + otsikko hetkellisesti ----
       Ei erillista uutta teksti-/lappuelementtia — sama valmis otsikko-
       tyyli (pinStyle:n titleVisible/ht) nayttaa merkin nimen kartalla
       vaikka "nayta otsikko" olisi pois paalta, ja hoivyy pois kun hiiri
       siirtyy pois. Itse skaalausanimaatio hoidetaan taalla. */
    var hoverFeature = null;
    function setHoverTarget(f, target, vwScale) {
      if (!f) return;
      var prevRaf = f.get('_hoverRaf');
      if (prevRaf) cancelAnimationFrame(prevRaf);
      var from = f.get('_hoverT') || 0;
      if (from === target) return;
      var t0 = null, dur = 150;
      function step(ts) {
        if (t0 === null) t0 = ts;
        var k = Math.min(1, (ts - t0) / dur);
        var eased = 1 - Math.pow(1 - k, 2);
        var val = from + (target - from) * eased;
        f.set('_hoverT', val);
        f.setStyle(pinStyle(f.get('pin'), olns, vwScale, val));
        if (k < 1) f.set('_hoverRaf', requestAnimationFrame(step));
        else f.set('_hoverRaf', null);
      }
      f.set('_hoverRaf', requestAnimationFrame(step));
    }
    function clearHover() {
      if (hoverFeature) setHoverTarget(hoverFeature, 0, getView().scale);
      hoverFeature = null;
      var t = map.getTargetElement();
      if (t) t.style.cursor = '';
    }

    function toView(x, z) { return olns.proj.transform([x, z], unmined.dataProjection, unmined.viewProjection); }
    function toBlock(c)   { return olns.proj.transform(c, unmined.viewProjection, unmined.dataProjection); }
    function centre()     { return toBlock(map.getView().getCenter()); }

    var rows = [];

    function draw() {
      source.clear();
      var vw = getView();
      rows.forEach(function (p) {
        if (p.hidden && !isDev()) return;
        if (vw.hideColors.indexOf(p.color) > -1) return;
        if (vw.hideSymbols.indexOf(p.symbol || 'dot') > -1) return;
        if (vw.hideAuthors.indexOf(String(p.author || '').toLowerCase()) > -1) return;
        var f = new olns.Feature({ geometry: new olns.geom.Point(toView(p.x, p.z)) });
        f.set('pin', p);
        f.setStyle(pinStyle(p, olns, vw.scale));
        source.addFeature(f);
      });
    }
    /* Kohta 23: merkkien kuvia EI enaa haeta kaikille etukateen — vain
       merkin oma nimi/sijainti tarvitaan piirtoon. Kuvat haetaan vasta
       kun kayttaja klikkaa yksittaista merkkia (ks. openPop). Sailytetaan
       jo ladatut kuvat (p.images) merkin id:n kautta yli refreshin, jotta
       auki oleva kupla ei "unohda" juuri katsottuja kuvia taustapaivityksessa. */
    function refresh() {
      var prevImages = {};
      rows.forEach(function (p) { if (p.images) prevImages[p.id] = p.images; });
      return Store.list().then(function (list) {
        rows = list || [];
        rows.forEach(function (p) { if (prevImages[p.id]) p.images = prevImages[p.id]; });
        draw();
      });
    }

    function ripple(px) {
      var d = el('span', 'kspk-ripple');
      d.style.left = px[0] + 'px'; d.style.top = px[1] + 'px';
      map.getViewport().appendChild(d);
      setTimeout(function () { d.remove(); }, 700);
    }

    /* --- lisays --- */
    function addAt(coordinate, pixel) {
      var b = toBlock(coordinate);
      if (pixel) ripple(pixel);
      pinForm({ mode: 'add', x: b[0], z: b[1], centre: centre }, function (pin, c, img) {
        Store.add(pin, c).then(function (saved) {
          if (saved) { saved.images = []; rows.push(saved); }
          draw(); announce();
          toast(SHARED ? 'Merkki lisatty — nakyy kaikille' : 'Merkki lisatty (vain tassa selaimessa)');
          var after = Promise.resolve();
          if (img && saved && SHARED) {
            after = Store.imageAdd(saved.id, img, c).then(function (row) {
              saved.images = [row];
              draw(); announce(); toast('Kuva lisatty merkille');
            }).catch(function (e) { toast('Merkki tallennettu, mutta kuva ei onnistunut: ' + errText(e), false); });
          }
          after.then(function () { if (SHARED) refresh(); });
        }).catch(function (e) { toast(errText(e), false); });
      });
    }

    /* --- kupla --- */
    function popBody(p, imgHtml) {
      var can = mayEdit(p);
      return '<h4><span class="dot" style="background:' + esc(p.color || '#3ef08a') + '"></span>' + esc(p.title) +
          (p.hidden ? '<span class="kspk-tag">piilotettu</span>' : '') + '</h4>' +
        (imgHtml || '') +
        (p.message ? '<p>' + esc(p.message) + '</p>' : '') +
        '<p class="meta">' + esc(p.author || 'Nimeton') + ' &middot; X ' + p.x + ', Z ' + p.z + '</p>' +
        '<div class="row">' +
          (can ? '<button class="kspk-btn" id="kp-e">Muokkaa</button>' : '') +
          (can ? '<button class="kspk-btn" id="kp-h">' + (p.hidden ? 'Nayta' : 'Piilota') + '</button>' : '') +
          (can ? '<button class="kspk-btn kspk-btn--danger" id="kp-d">Poista</button>' : '') +
          '<button class="kspk-btn" id="kp-c2">Sulje</button>' +
        '</div>';
    }
    function wirePopButtons(p) {
      var can = mayEdit(p);
      popEl.querySelector('#kp-c2').onclick = closePop;
      if (!can) return;

      popEl.querySelector('#kp-e').onclick = function () {
        closePop();
        pinForm({ mode: 'edit', pin: p, centre: centre }, function (v, c) {
          /* Kuvien lisays/poisto tapahtuu jo lomakkeen sisalla valittomasti
             (p.images paivittyy suoraan) — tassa tallennetaan vain tekstikentat. */
          Store.update(p.id, v, c).then(function () {
            Object.assign(p, v); draw(); announce(); toast('Merkki paivitetty');
          }).catch(function (e) { toast(errText(e), false); });
        });
      };
      popEl.querySelector('#kp-h').onclick = function () {
        var nv = !p.hidden;
        var c = creds(p);
        if (!c) return;
        Store.update(p.id, { hidden: nv }, c).then(function () {
          p.hidden = nv; draw(); closePop(); announce();
          toast(nv ? 'Merkki piilotettu' : 'Merkki taas nakyvissa');
        }).catch(function (e) { toast(errText(e), false); });
      };
      popEl.querySelector('#kp-d').onclick = function () {
        if (!confirm('Poistetaanko merkki "' + p.title + '"? Tata ei voi perua.')) return;
        var c = creds(p);
        if (!c) return;
        Store.remove(p.id, c).then(function () {
          rows = rows.filter(function (o) { return o.id !== p.id; });
          draw(); closePop(); announce(); toast('Merkki poistettu');
        }).catch(function (e) { toast(errText(e), false); });
      };
    }

    /* Kohta 23: kuvat haetaan vasta kun tata merkkia klikataan, ja
       thumbnailit ilmestyvat jarjestyksessa vasemmalta oikealle (max 5
       vierekkain) nimen alle sita mukaa kun kukin <img> ehtii latautua. */
    var popToken = 0;
    function renderPopImages(p, container) {
      if (!p.images || !p.images.length) return;
      container.innerHTML = '';
      container.style.display = '';
      p.images.slice(0, 5).forEach(function (im, i) {
        var a = el('a');
        a.href = im.full_url; a.target = '_blank'; a.rel = 'noopener';
        a.style.opacity = '0';
        a.style.transition = 'opacity .35s ease';
        a.style.transitionDelay = (i * 70) + 'ms';
        var img = el('img', 'kspk-imgprev');
        img.alt = 'Merkin kuva';
        img.loading = 'lazy';
        img.src = im.thumb_url;
        a.appendChild(img);
        container.appendChild(a);
        requestAnimationFrame(function () { a.style.opacity = '1'; });
      });
    }
    function openPop(p) {
      popEl.className = 'kspk-pop';
      tellParentBusy(true);
      var myToken = ++popToken;
      var haveImages = Array.isArray(p.images);
      popEl.innerHTML = popBody(p, haveImages && p.images.length
        ? '<div class="kspk-imggrid" id="kp-imggrid2" style="margin:0 0 8px"></div>' : '');
      overlay.setPosition(toView(p.x, p.z));
      wirePopButtons(p);
      var grid = popEl.querySelector('#kp-imggrid2');
      if (haveImages) {
        if (grid) renderPopImages(p, grid);
        return;
      }
      Store.imagesForPin(p.id).then(function (imgs) {
        if (myToken !== popToken) return;   // kupla ehti vaihtua/sulkeutua
        p.images = imgs || [];
        if (!p.images.length) return;
        var g = popEl.querySelector('#kp-imggrid2');
        if (!g) {
          // lisataan ruudukko jalkikateen viestin ja otsikon valiin
          g = el('div', 'kspk-imggrid');
          g.id = 'kp-imggrid2';
          g.style.margin = '0 0 8px';
          var h4 = popEl.querySelector('h4');
          if (h4 && h4.nextSibling) h4.parentNode.insertBefore(g, h4.nextSibling);
          else popEl.insertBefore(g, popEl.firstChild.nextSibling);
        }
        renderPopImages(p, g);
      }).catch(function () {});
    }

    map.on('singleclick', function (evt) {
      var hit = map.forEachFeatureAtPixel(evt.pixel, function (f) { return f.get('pin') ? f : null; },
        { hitTolerance: 10, layerFilter: function (l) { return l === layer; } });
      if (hit) openPop(hit.get('pin')); else closePop();
    });

    map.on('pointermove', function (evt) {
      if (evt.dragging) { clearHover(); return; }
      var f = map.forEachFeatureAtPixel(evt.pixel, function (ff) { return ff.get('pin') ? ff : null; },
        { hitTolerance: 10, layerFilter: function (l) { return l === layer; } });
      var t = map.getTargetElement();
      if (t) t.style.cursor = f ? 'pointer' : '';
      if (f === hoverFeature) return;
      var vwScale = getView().scale;
      if (hoverFeature) setHoverTarget(hoverFeature, 0, vwScale);
      hoverFeature = f;
      if (f) setHoverTarget(f, 1, vwScale);
    });
    map.getViewport().addEventListener('pointerleave', clearHover);

    /* --- kolmoisnapautus / kolmoisklikkaus ------------------------------
       Mobiilikorjaus: kahden sormen zoomaus ei saa enaa vahingossa
       kaynnistaa merkin lisaysta. Siksi:
         - vain yksi sormi kerrallaan kelpaa (moni kosketus nollaa sarjan)
         - napautus ei kelpaa jos sormi liikkui (= panorointi tai zoomaus)
         - kaikkien kolmen napautuksen on osuttava samaan pieneen alueeseen,
           ei pelkastaan ensimmaisen ja viimeisen
         - napautus saa kestaa korkeintaan 300 ms                          */
    var taps = [];
    var live = 0;            // kuinka monta sormea/osoitinta alhaalla
    var multi = false;       // oliko sarjassa valissa monikosketus
    var down = null;         // meneillaan olevan napautuksen aloitus
    var TAP_R = 22;          // sallittu liike yhden napautuksen aikana (px)
    var SEQ_R = 26;          // kaikkien napautusten max-etaisyys ensimmaisesta
    var TAP_MS = 300;        // yksi napautus saa kestaa tama
    var SEQ_MS = 800;        // koko kolmoisnapautus tassa ajassa
    var vp = map.getViewport();

    function reset() { taps = []; multi = false; }

    vp.addEventListener('pointerdown', function (e) {
      live++;
      if (live > 1) { multi = true; reset(); down = null; return; }
      down = { t: Date.now(), x: e.clientX, y: e.clientY, id: e.pointerId };
    });

    function endPointer(e, ok) {
      live = Math.max(0, live - 1);
      var d = down;
      down = null;
      if (live > 0) { multi = true; reset(); return; }   // sormia viela alhaalla
      if (!ok || multi || !d || d.id !== e.pointerId) { multi = false; reset(); return; }

      var now = Date.now();
      // liikkuiko sormi napautuksen aikana, tai kestiko se liian kauan?
      if (now - d.t > TAP_MS ||
          Math.abs(e.clientX - d.x) > TAP_R || Math.abs(e.clientY - d.y) > TAP_R) {
        reset(); return;
      }

      taps = taps.filter(function (t) { return now - t.t < SEQ_MS; });
      taps.push({ t: now, x: e.clientX, y: e.clientY });

      // kaikkien napautusten on osuttava samaan pieneen alueeseen
      var a = taps[0];
      for (var i = 1; i < taps.length; i++) {
        if (Math.abs(taps[i].x - a.x) > SEQ_R || Math.abs(taps[i].y - a.y) > SEQ_R) {
          taps = [taps[taps.length - 1]];
          return;
        }
      }

      if (taps.length >= 3) {
        var c = taps[taps.length - 1];
        reset();
        closePop();
        var r = vp.getBoundingClientRect();
        var px = [c.x - r.left, c.y - r.top];
        addAt(map.getCoordinateFromPixel(px), px);
      }
    }

    vp.addEventListener('pointerup',     function (e) { endPointer(e, true);  });
    vp.addEventListener('pointercancel', function (e) { endPointer(e, false); });
    // selaimen oma pinch-zoom / vierityssele -> unohda sarja
    vp.addEventListener('touchmove', function (e) {
      if (e.touches && e.touches.length > 1) { multi = true; reset(); }
    }, { passive: true });

    /* --- oikean klikkauksen valikko --- */
    var menu = null;
    map.getControls().forEach(function (c) {
      if (c && typeof c.push === 'function' && typeof c.clear === 'function') menu = c;
    });
    if (menu) {
      menu.on('open', function () {
        menu.push('-');
        menu.push({
          text: 'Lisaa merkki tahan',
          callback: function (obj) { addAt(obj.coordinate, null); }
        });
      });
    } else {
      map.getViewport().addEventListener('contextmenu', function (e) {
        e.preventDefault();
        addAt(map.getEventCoordinate(e), null);
      });
    }

    /* --- kursorin koordinaatit (oikea ylanurkka) -----------------------
       uNmINeDin oma ol.control.MousePosition ei nayta arvoja luotettavasti
       tassa upotuksessa, joten piirretaan oma, taatusti toimiva laatikko. */
    var coordEl = el('div', 'kspk-coord', 'X: — &nbsp; Z: —');
    map.getViewport().appendChild(coordEl);
    map.on('pointermove', function (evt) {
      if (evt.dragging) return;
      var b = toBlock(evt.coordinate);
      coordEl.innerHTML = 'X: ' + Math.round(b[0]) + ' &nbsp; Z: ' + Math.round(b[1]);
    });
    map.getViewport().addEventListener('pointerleave', function () {
      coordEl.innerHTML = 'X: — &nbsp; Z: —';
    });

    /* --- dev-nappi --- */
    var dev = el('div', 'kspk-dev' + (isDev() ? ' on' : ''), '&#128295;');
    dev.title = 'Dev-tila';
    dev.onclick = function () {
      if (isDev()) {
        setDev(false); setDevCode(''); dev.classList.remove('on'); refresh(); announce();
        tellParentDev(false);
        toast('Dev-tila pois paalta');
      } else {
        if (!SHARED) { toast('Ei yhteytta palvelimeen', false); return; }
        var code = prompt('Yllapitokoodi:');
        if (code === null || code === '') return;
        Store.rpc('is_admin', { p_code: code }).then(function (ok) {
          if (ok !== true) { toast('Vaara koodi', false); return; }
          setDev(true); setDevCode(code); dev.classList.add('on'); refresh(); announce();
          tellParentDev(true);
          toast('Dev-tila paalla — kaikki merkit hallittavissa');
        }).catch(function () { toast('Tarkistus ei onnistunut', false); });
      }
    };
    map.getViewport().appendChild(dev);

    /* --- Kohta 7: oma nakyma -nappi (vari/symboli-piilotus + koko, vain tama selain) --- */
    var viewBtn = el('div', 'kspk-view', '&#128065;');
    viewBtn.title = 'Oma nakyma (vain tama selain)';
    function paintViewBtn() {
      var v = getView();
      var active = v.hideColors.length || v.hideSymbols.length || v.hideAuthors.length || Math.abs(v.scale - 1) > 0.001;
      viewBtn.classList.toggle('on', !!active);
    }
    viewBtn.onclick = function () { openViewPanel(); };
    map.getViewport().appendChild(viewBtn);
    paintViewBtn();

    function openViewPanel() {
      var v = getView();
      var wrap = el('div', 'kspk-modal');
      var card = el('div', 'kspk-card');
      card.innerHTML =
        '<h3>Oma nakyma</h3>' +
        '<p class="sub">Nama asetukset vaikuttavat vain tahan selaimeen — eivat muihin pelaajiin eika palvelimelle. Sama asetus nakyy myos merkkilistassa.</p>' +
        (rows.length ? '<label>Piilota pelaajat omasta nakymasta</label><div class="kspk-authors" id="kv-a" role="group"></div>' : '') +
        '<label>Piilota varit omasta nakymasta</label><div class="kspk-colors" id="kv-c" role="group"></div>' +
        '<label>Piilota symbolit omasta nakymasta</label><div class="kspk-symbols" id="kv-s" role="group"></div>' +
        '<label>Merkkien ja tekstin koko omassa nakymassa (<span id="kv-scale-val">' + v.scale.toFixed(1) + 'x</span>)</label>' +
        '<input id="kv-scale" type="range" min="0.1" max="3" step="0.1" value="' + v.scale + '">' +
        '<div class="row">' +
          '<button class="kspk-btn" id="kv-reset">Palauta oletukset</button>' +
          '<button class="kspk-btn kspk-btn--primary" id="kv-ok">Valmis</button>' +
        '</div>';
      wrap.appendChild(card);
      document.body.appendChild(wrap);
      tellParentBusy(true);

      var $ = function (id) { return card.querySelector(id); };
      var hideColors = v.hideColors.slice();
      var hideSymbols = v.hideSymbols.slice();
      var hideAuthors = v.hideAuthors.slice();

      var abox = $('#kv-a');
      if (abox) {
        var authors = [], seenA = {};
        rows.forEach(function (p) {
          var a = p.author || 'Nimeton';
          if (!seenA[a.toLowerCase()]) { seenA[a.toLowerCase()] = true; authors.push(a); }
        });
        authors.forEach(function (a) {
          var key = a.toLowerCase();
          var b = el('button', null, esc(a));
          b.type = 'button';
          var off = hideAuthors.indexOf(key) > -1;
          b.setAttribute('aria-pressed', off ? 'false' : 'true');
          if (off) b.classList.add('kv-off');
          b.title = off ? 'Piilotettu — klikkaa nayttaaksesi' : 'Nakyvissa — klikkaa piilottaaksesi';
          b.onclick = function () {
            var i = hideAuthors.indexOf(key);
            if (i > -1) { hideAuthors.splice(i, 1); b.classList.remove('kv-off'); b.setAttribute('aria-pressed', 'true'); }
            else { hideAuthors.push(key); b.classList.add('kv-off'); b.setAttribute('aria-pressed', 'false'); }
            apply();
          };
          abox.appendChild(b);
        });
      }

      var cbox = $('#kv-c');
      CFG.colors.forEach(function (c) {
        var b = el('button');
        b.type = 'button';
        b.style.background = c;
        var off = hideColors.indexOf(c) > -1;
        b.setAttribute('aria-pressed', off ? 'false' : 'true');
        if (off) b.classList.add('kv-off');
        b.title = off ? 'Piilotettu — klikkaa nayttaaksesi' : 'Nakyvissa — klikkaa piilottaaksesi';
        b.onclick = function () {
          var i = hideColors.indexOf(c);
          if (i > -1) { hideColors.splice(i, 1); b.classList.remove('kv-off'); b.setAttribute('aria-pressed', 'true'); }
          else { hideColors.push(c); b.classList.add('kv-off'); b.setAttribute('aria-pressed', 'false'); }
          apply();
        };
        cbox.appendChild(b);
      });

      var sbox = $('#kv-s');
      SYMBOLS.forEach(function (sInfo) {
        var b = el('button', null, sInfo.glyph);
        b.type = 'button';
        var off = hideSymbols.indexOf(sInfo.id) > -1;
        b.setAttribute('aria-pressed', off ? 'false' : 'true');
        if (off) b.classList.add('kv-off');
        b.title = sInfo.id + (off ? ' — piilotettu' : ' — nakyvissa');
        b.onclick = function () {
          var i = hideSymbols.indexOf(sInfo.id);
          if (i > -1) { hideSymbols.splice(i, 1); b.classList.remove('kv-off'); b.setAttribute('aria-pressed', 'true'); }
          else { hideSymbols.push(sInfo.id); b.classList.add('kv-off'); b.setAttribute('aria-pressed', 'false'); }
          apply();
        };
        sbox.appendChild(b);
      });

      function apply() {
        setView({ hideColors: hideColors, hideSymbols: hideSymbols, hideAuthors: hideAuthors, scale: parseFloat($('#kv-scale').value) || 1 });
        draw();
        paintViewBtn();
      }

      $('#kv-scale').addEventListener('input', function () {
        $('#kv-scale-val').textContent = Number($('#kv-scale').value).toFixed(1) + 'x';
        apply();
      });

      $('#kv-reset').onclick = function () {
        hideColors = []; hideSymbols = []; hideAuthors = [];
        [].forEach.call(cbox.children, function (o) { o.classList.remove('kv-off'); o.setAttribute('aria-pressed', 'true'); });
        [].forEach.call(sbox.children, function (o) { o.classList.remove('kv-off'); o.setAttribute('aria-pressed', 'true'); });
        if (abox) [].forEach.call(abox.children, function (o) { o.classList.remove('kv-off'); o.setAttribute('aria-pressed', 'true'); });
        $('#kv-scale').value = 1;
        $('#kv-scale-val').textContent = '1.0x';
        apply();
      };

      function close() {
        wrap.remove();
        document.removeEventListener('keydown', onEsc);
        tellParentBusy(false);
      }
      function onEsc(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
      document.addEventListener('keydown', onEsc);
      $('#kv-ok').onclick = close;
      var downOnWrap = false;
      wrap.addEventListener('pointerdown', function (e) { downOnWrap = (e.target === wrap); });
      wrap.addEventListener('click', function (e) {
        if (e.target === wrap && downOnWrap) close();
        downOnWrap = false;
      });
    }

    if (!SHARED) map.getViewport().appendChild(el('div', 'kspk-badge', 'Merkit tallentuvat vain tahan selaimeen'));

    /* --- selaimen oma zoom (Ctrl + rulla) --- */
    if (CFG.allowBrowserZoom) {
      var vp = document.querySelector('meta[name="viewport"]');
      if (vp) vp.setAttribute('content', 'width=device-width, initial-scale=1.0');
      window.addEventListener('wheel', function (e) { if (e.ctrlKey) e.stopPropagation(); }, { capture: true, passive: false });
      ['gesturestart','gesturechange','gestureend'].forEach(function (t) {
        window.addEventListener(t, function (e) { e.stopPropagation(); }, true);
      });
    }

    /* --- Esc: takaisin sivulle / vapauta lukko --- */
    var embedded = (function () { try { return window.self !== window.top; } catch (e) { return true; } })();
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' && e.key !== 'Esc') return;
      if (document.querySelector('.kspk-card')) return;
      if (overlay.getPosition()) { closePop(); return; }
      if (embedded) { try { window.parent.postMessage({ kspk: 'map-escape' }, '*'); } catch (err) {} }
      else {
        var ref = document.referrer || '';
        if (ref && ref.indexOf(location.origin) === 0 && history.length > 1) history.back();
        else location.href = '../../kartta.html';
      }
    });
    if (!embedded) {
      var hint = el('div', 'kspk-badge', 'Esc = takaisin sivulle &nbsp;|&nbsp; kolmoisnapautus = uusi merkki');
      map.getViewport().appendChild(hint);
      setTimeout(function () { hint.style.transition = 'opacity .6s'; hint.style.opacity = '0'; }, 6500);
      setTimeout(function () { hint.remove(); }, 7500);
    }

    /* --- sivun listalta tulevat komennot --- */
    window.addEventListener('message', function (e) {
      var d = e.data || {};
      if (d.kspk === 'pins-reload') refresh();
      if (d.kspk === 'pins-focus') {
        var p = rows.filter(function (o) { return String(o.id) === String(d.id); })[0];
        if (p) { map.getView().animate({ center: toView(p.x, p.z), duration: 500 }); openPop(p); }
      }
      if (d.kspk === 'dev-state') {
        setDev(!!d.on);
        if (d.code) setDevCode(d.code); else if (!d.on) setDevCode('');
        dev.classList.toggle('on', !!d.on); refresh();
      }
    });

    window.__kspkRefresh = refresh;
    loadWhitelist();
    refresh();
    if (SHARED) setInterval(refresh, 30000);
    if (SHARED) initRealtime();
  }

  /* ---------- kohta 24: reaaliaikainen paivitys (Supabase Realtime) ----------
     Kartan oma index.html on uNmINeDin generoima eika sinne voi pysyvasti
     lisata <script>-tageja, joten Supabasen JS-kirjasto ladataan taalta
     dynaamisesti CDN:sta. Kun joku muuttaa/lisaa/poistaa merkin tai kuvan,
     kartta paivittyy heti — 30s pollaus jatetaan rinnalle varajarjestelmaksi. */
  var rtDebounce = null;
  function debouncedRefreshFromRealtime() {
    clearTimeout(rtDebounce);
    rtDebounce = setTimeout(function () {
      var fn = window.__kspkRefresh;
      if (fn) fn();
    }, 250);
  }
  function initRealtime() {
    if (window.__kspkRealtimeStarted) return;
    window.__kspkRealtimeStarted = true;
    function start() {
      try {
        var sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey);
        var ch = sb.channel('kspk-map-changes');
        ['pins', 'pin_images'].forEach(function (table) {
          ch.on('postgres_changes', { event: '*', schema: 'public', table: table }, debouncedRefreshFromRealtime);
        });
        ch.subscribe();
      } catch (e) { /* realtime ei kaynnistynyt — pollaus riittaa varajarjestelmaksi */ }
    }
    if (window.supabase && window.supabase.createClient) { start(); return; }
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
    s.onload = start;
    s.onerror = function () {};
    document.head.appendChild(s);
  }

  /* --- odota etta uNmINeD on luonut kartan --- */
  var tries = 0;
  (function wait() {
    var u = null;
    try { u = unmined; } catch (e) { u = null; }
    if (u && u.olMap) { boot(u); return; }
    if (++tries < 200) setTimeout(wait, 50);
  })();
})();
