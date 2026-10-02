/* =====================================================================
   K-S-P-K — reitti.js — KasaNavi (navigointipalvelu)
   ---------------------------------------------------------------------
   Rakentaa OMAN OpenLayers-karttansa suoraan uNmINeD-tiilista (karttarepo
   kspk-kartat) — EI iframea eika uNmINeDin omaa index.html:aa, jotta
   kayttoliittyma on taysin oma. Tiilijarjestelma, projektio ja
   resoluutiot on toteutettu samalla kaavalla kuin uNmINeDin omassa
   unmined.js:ssa, muuten tiilet eivat osuisi oikeille paikoille.

   Kayttoliittyman rakenne on tuttu karttapalveluista: hakupalkki ja
   reittinappi vasemmassa ylakulmassa, kategoriasirut sen alla,
   reittipaneeli kulkutapavalilehdilla, paikkakortti, Tasot-valitsin ja
   zoom-napit. Kokonaytto on pelkka luokanvaihto samalle laatikolle.
   ===================================================================== */
(function () {
  'use strict';

  var app = document.getElementById('kn-app');
  if (!app || typeof ol === 'undefined') return;

  var MAPS = 'https://erboiyprogamer-source.github.io/kspk-kartat/';
  var SUPA = {
    url: 'https://zfgwjxtruqoacxtkqprp.supabase.co',
    key: 'sb_publishable_MwLjfXP5LCtZe8tZ3IIf7w_5a3zqoKc'
  };

  /* uNmINeDin projektiovakio: blocksPerDegrees = max(30000000, maailman
     suurin koordinaatti) / 270. Maailma on reilusti alle 30 000 000
     lohkoa, joten arvo on kaikilla kartoilla sama vakio. */
  var BPD = 30000000 / 270;
  var TILE = 256;

  /* ---------- kulkutavat ----------
     Nopeudet lohkoa/sekunti. Minecraftissa 1 lohko = 1 metri. */
  var MODES = [
    { id: 'walk',   ico: '&#128694;', name: 'Kävely',   v: 4.317, note: 'Perusnopeus maalla.' },
    { id: 'sprint', ico: '&#127939;', name: 'Juoksu',   v: 5.612, note: 'Vaatii ruokaa; juoksuhyppely yltää noin 7,1 lohkoon sekunnissa.' },
    { id: 'horse',  ico: '&#128014;', name: 'Hevonen',  v: 9.0,   note: 'Hevoset vaihtelevat noin 4,8–14,5 lohkoa/s; tässä keskitasoinen.' },
    /* Vene ja uinti jatetty pois: suora viiva kulkee usein maan yli,
       jolloin niiden aika olisi harhaanjohtava. Ne palaavat kun reitit
       piirretaan oikeita kulkuvayliä pitkin. */
    { id: 'elytra', ico: '&#128640;', name: 'Elytra',   v: 30,    note: 'Raketeilla, suoraan maaston yli — tämä arvio on tarkin.' }
  ];

  /* KasaNavin kategoriat (sama lista kuin merkkien lisayslomakkeessa
     map-markers.js:ssa). Ilman kategoriaa oleva merkki nakyy kohdassa
     "Muut". */
  var CATEGORIES = [
    { id: 'koti',      name: 'Kodit',        ico: '&#127968;' },
    { id: 'kaupunki',  name: 'Kaupungit',    ico: '&#127961;' },
    { id: 'metro',     name: 'Metroasemat',  ico: '&#128647;' },
    { id: 'portti',    name: 'Portit',       ico: '&#128751;' },
    { id: 'farmi',     name: 'Farmit',       ico: '&#127806;' },
    { id: 'kauppa',    name: 'Kaupat',       ico: '&#128722;' },
    { id: 'satama',    name: 'Satamat',      ico: '&#9875;' },
    { id: 'nahtavyys', name: 'Nähtävyydet',  ico: '&#127963;' },
    { id: 'luola',     name: 'Luolat',       ico: '&#9935;' },
    { id: 'muu',       name: 'Muut',         ico: '&#128205;' }
  ];
  function catOf(p) { return p.category || 'muu'; }
  function catName(p) {
    var id = catOf(p);
    var c = CATEGORIES.filter(function (o) { return o.id === id; })[0];
    return c ? c.name.replace(/t$/, '') : 'Merkki';
  }

  /* Karttatasojen esikatselukuvat ovat oikeita tiilia karttarepossa. */
  var MAP_INFO = {
    paiva: { name: 'Päiväkartta', thumb: 'paiva/tiles/zoom.0/0/0/tile.0.0.webp' },
    yo:    { name: 'Yökartta',    thumb: 'yo/tiles/zoom.0/0/0/tile.0.0.webp' },
    '5k':  { name: 'Suuri kartta', thumb: '5k/tiles/zoom.0/0/0/tile.0.2.webp' }
  };
  var MAP_ORDER = ['paiva', 'yo', '5k'];

  var SYMBOL_NAMES = {
    dot: 'Piste', square: 'Neliö', triangle: 'Kolmio', star: 'Tähti', diamond: 'Timantti',
    house: 'Talo', skull: 'Pääkallo', sword: 'Miekka', hammer: 'Vasara', smiley: 'Hymiö',
    pickaxe: 'Hakku', tree: 'Puu', axe: 'Kirves', shield: 'Kilpi', heart: 'Sydän',
    anchor: 'Ankkuri', chest: 'Arkku', swords: 'Miekka'
  };

  var LS_MODE   = 'kspk.navi.mode';
  var LS_RECENT = 'kspk.navi.recent';

  /* ---------- pienet apurit ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nf(n) { return Number(Math.round(n)).toLocaleString('fi-FI'); }
  function dur(sec) {
    if (!isFinite(sec)) return '–';
    sec = Math.round(sec);
    if (sec < 60) return sec + ' s';
    var h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
    if (h) return h + ' h ' + m + ' min';
    return Math.floor(sec / 60) + ' min';
  }
  function dist(a, b) {
    var dx = b.x - a.x, dz = b.z - a.z;
    return Math.sqrt(dx * dx + dz * dz);
  }
  function lsGet(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  /* ---------- koordinaattimuunnos (uNmINeDin kaava) ----------
     OpenLayersin Y kasvaa ylospain, Minecraftin Z alaspain. */
  function toView(x, z) { return [x / BPD, -z / BPD]; }
  function toBlock(c)   { return [Math.round(c[0] * BPD), Math.round(-c[1] * BPD)]; }

  /* ---------- uNmINeDin RegionMap: onko tiilta olemassa ----------
     Ilman tata selain pyytaisi satoja olemattomia tiilia (404). */
  function RegionMap(regions, minX, minZ, w, h) {
    this.r = regions; this.minX = minX; this.minZ = minZ; this.w = w; this.h = h;
  }
  RegionMap.prototype.hasTile = function (tileX, tileZ, zoom) {
    var f = Math.pow(2, zoom);
    var minTX = Math.floor(this.minX * f / TILE), minTZ = Math.floor(this.minZ * f / TILE);
    var maxTX = Math.ceil((this.minX + this.w) * f / TILE) - 1;
    var maxTZ = Math.ceil((this.minZ + this.h) * f / TILE) - 1;
    if (tileX < minTX || tileZ < minTZ || tileX > maxTX || tileZ > maxTZ) return false;
    var bs = TILE / f;
    var rx = Math.floor(tileX * bs / 512), rz = Math.floor(tileZ * bs / 512);
    var size = Math.ceil(bs / 512);
    for (var x = rx; x < rx + size; x++) {
      for (var z = rz; z < rz + size; z++) {
        var gx = Math.floor(x / 32), gz = Math.floor(z / 32), g = null;
        for (var i = 0; i < this.r.length; i++) { if (this.r[i].x === gx && this.r[i].z === gz) { g = this.r[i]; break; } }
        if (!g) continue;
        var inx = (z - gz * 32) * 32 + (x - gx * 32);
        if ((g.m[Math.floor(inx / 32)] & (1 << (inx % 32))) !== 0) return true;
      }
    }
    return false;
  };

  /* ---------- kartan metatietojen lataus ----------
     unmined.map.properties.js ja .regions.js ovat autogeneroituja ja
     maarittelevat globaalit muuttujat, joten arvot otetaan talteen heti
     latauksen jalkeen ennen kuin seuraava kartta ylikirjoittaa ne. */
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.async = false;
      s.onload = function () { res(); };
      s.onerror = function () { rej(new Error('lataus epäonnistui: ' + src)); };
      document.head.appendChild(s);
    });
  }
  function loadMeta(name) {
    var base = MAPS + name + '/', bust = '?r=' + Date.now();
    return loadScript(base + 'unmined.map.properties.js' + bust)
      .then(function () { return loadScript(base + 'unmined.map.regions.js' + bust); })
      .then(function () {
        var o = UnminedMapProperties;
        return {
          name: name, base: base,
          props: {
            minZoom: o.minZoom, maxZoom: o.maxZoom, imageFormat: o.imageFormat,
            minRegionX: o.minRegionX, minRegionZ: o.minRegionZ,
            maxRegionX: o.maxRegionX, maxRegionZ: o.maxRegionZ,
            centerX: o.centerX, centerZ: o.centerZ
          },
          regions: UnminedRegions.map(function (e) { return { x: e.x, z: e.z, m: e.m }; })
        };
      });
  }

  /* ---------- tila ---------- */
  var map = null, view = null, tileLayer = null, pinLayer = null, routeLayer = null;
  var pendingView = null, curMap = 'paiva';
  var regionMap = null, mapLevels = 0, mapMaxZoom = 0;   // tiilien kattavuuden tarkistusta varten
  var pins = [], picking = null, dirMode = false;
  /* Automaattinen kartanvalinta: paivakartta on tarkka mutta kattaa vain
     keskusta-alueen, suuri kartta kattaa koko maailman. Kun kaikki reitin
     pisteet mahtuvat keskustan sisaan, kaytetaan tarkkaa paivakarttaa.
     Kayttajan oma valinta Tasot-valikosta lopettaa automatiikan. */
  var autoMapOn = true;
  var AUTO_RADIUS = 1000;   // paivakartan alue: -1000…1000 molemmilla akseleilla
  var stops = [null, null];        // {x, z, label}
  var hideCats = {};               // kategoriasiruilla piilotetut
  var showNav = true;
  var optPins = true, optNames = false, optGrid = false;
  var gridLayer = null;
  var selected = null;             // paikkakortissa nakyva merkki
  var hoveredId = null;            // merkki jonka paalla hiiri on
  var navigating = false;          // navigointi aloitettu
  var navDist = 0;                 // kuljettu matka lohkoina navigoinnin aikana
  var placeToken = 0;              // estaa vanhentunutta kuvahakua kirjoittamasta uuteen korttiin

  /* ---------- kartta ---------- */
  function buildMap(meta) {
    var o = meta.props;
    curMap = meta.name;
    var menu = document.getElementById('kn-layers-menu');
    if (menu) menu.querySelectorAll('[data-map]').forEach(function (x) {
      x.classList.toggle('is-on', x.dataset.map === curMap);
    });
    updateBaseBtn();
    setTimeout(buildGrid, 60);
    var minX = o.minRegionX * 512, minZ = o.minRegionZ * 512;
    var w = (o.maxRegionX + 1 - o.minRegionX) * 512;
    var h = (o.maxRegionZ + 1 - o.minRegionZ) * 512;
    var rm = new RegionMap(meta.regions, minX, minZ, w, h);
    regionMap = rm;
    var dpi = window.devicePixelRatio || 1;

    var proj = new ol.proj.Projection({
      code: 'KSPK-VIEW', units: 'degrees',
      extent: [-270, -270, 270, 270], worldExtent: [-270, -270, 270, 270], global: true
    });

    var tl = toView(minX, minZ), br = toView(minX + w, minZ + h);
    var extent = [Math.min(tl[0], br[0]), Math.min(tl[1], br[1]), Math.max(tl[0], br[0]), Math.max(tl[1], br[1])];

    var levels = o.maxZoom - o.minZoom, res = [];
    mapLevels = levels; mapMaxZoom = o.maxZoom;
    for (var z = 0; z <= levels; z++) res[z] = (Math.pow(2, levels - z - o.maxZoom) / BPD) * dpi;

    var grid = new ol.tilegrid.TileGrid({ extent: extent, origin: [0, 0], resolutions: res, tileSize: TILE / dpi });

    var src = new ol.source.XYZ({
      projection: proj, tileGrid: grid, tilePixelRatio: dpi, tileSize: TILE / dpi,
      tileUrlFunction: function (c) {
        var tx = c[1], ty = c[2], wz = -(levels - c[0]) + o.maxZoom;
        if (!rm.hasTile(tx, ty, wz)) return undefined;
        return meta.base + 'tiles/zoom.' + wz + '/' + Math.floor(tx / 10) + '/' + Math.floor(ty / 10) +
               '/tile.' + tx + '.' + ty + '.' + o.imageFormat;
      }
    });

    /* Kartan vaihdossa koko kartta rakennetaan uudelleen: kartoilla voi
       olla eri aluerajat ja eri zoom-tasot, joten pelkka tiililahteen
       vaihto jattaisi nakyman vaarille rajoille. */
    if (map) {
      pendingView = { center: view.getCenter(), zoom: view.getZoom() };
      map.setTarget(null);
      if (map.dispose) map.dispose();
      map = null;
    }

    tileLayer = new ol.layer.Tile({ source: src });
    pinLayer = new ol.layer.Vector({ source: new ol.source.Vector(), style: pinStyle });
    routeLayer = new ol.layer.Vector({ source: new ol.source.Vector(), style: routeStyle });

    view = new ol.View({
      center: toView(o.centerX, o.centerZ), extent: extent, projection: proj,
      resolutions: res, maxZoom: levels, zoom: Math.max(0, levels - o.maxZoom),
      constrainResolution: true, showFullExtent: true, constrainOnlyCenter: true, enableRotation: false
    });

    map = new ol.Map({
      target: 'n2-map',
      controls: [],                 // omat napit kayttoliittymassa
      layers: [tileLayer, routeLayer, pinLayer],
      view: view
    });

    if (pendingView) {
      try { view.setCenter(pendingView.center); view.setZoom(pendingView.zoom); } catch (e) {}
      pendingView = null;
      drawPins(); drawRoute(false);
    }

    /* Zoomin muutos ratkaisee nakyvatko merkit, joten piirto uusitaan
       kun liike on loppunut. */
    map.on('moveend', function () { drawPins(); checkCoverage(); });
    /* Kartan vaihto ei laukaise moveend-tapahtumaa, joten kattavuus
       tarkistetaan myos heti rakentamisen jalkeen. */
    setTimeout(checkCoverage, 150);

    /* Suurella kartalla on vain yksi zoom-taso, joten lahentaminen ei
       tee mitaan. Jos kayttaja rullaa sita kohti, siirrytaan tarkkaan
       paivakarttaan samaan kohtaan — mikali kohta on sen alueella. */
    var wheelAcc = 0, wheelTimer = null;
    map.getTargetElement().addEventListener('wheel', function (ev) {
      if (curMap !== '5k' || ev.deltaY >= 0) { wheelAcc = 0; return; }
      wheelAcc += Math.abs(ev.deltaY);
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(function () { wheelAcc = 0; }, 900);
      if (wheelAcc < 160) return;
      wheelAcc = 0;
      var b = toBlock(view.getCenter());
      if (Math.max(Math.abs(b[0]), Math.abs(b[1])) > 1500) return;   // paivakartan ulkopuolella
      loadMeta('paiva').then(function (meta) {
        buildMap(meta);
        view.setCenter(toView(b[0], b[1]));
        view.setZoom(Math.max(0, view.getMaxZoom() - 1));
        drawPins(); drawRoute(false);
      }).catch(function () {});
    }, { passive: true });

    map.on('pointermove', function (e) {
      var b = toBlock(e.coordinate);
      $('kn-coord').textContent = 'X ' + b[0] + ', Z ' + b[1];
      /* Merkki toimii nappina: kursori vaihtuu, merkki kasvaa ja nimi
         ilmestyy heti kun hiiri on sen paalla. */
      var f = map.forEachFeatureAtPixel(e.pixel, function (ft) { return ft.get('pin') ? ft : null; }, { hitTolerance: 8 });
      var id = f ? f.get('pin').id : null;
      if (id !== hoveredId) { hoveredId = id; pinLayer.changed(); }
      map.getTargetElement().style.cursor = (picking !== null) ? 'crosshair' : (f ? 'pointer' : '');
    });

    map.on('singleclick', function (e) {
      var b = toBlock(e.coordinate);
      if (picking !== null) {
        /* Napsautus tarttuu merkkiin, jos sellainen on osuman sisalla —
           nain valmiin kohteen poiminta kartalta on helppoa eika
           koordinaattiin tarvitse osua pikselilleen. */
        var snap = map.forEachFeatureAtPixel(e.pixel, function (ft) { return ft.get('pin') || null; }, { hitTolerance: 14 });
        if (snap && snap.title) setStop(picking, { x: snap.x, z: snap.z, label: snap.title });
        else setStop(picking, { x: b[0], z: b[1], label: b[0] + ' ' + b[1] });
        setPicking(null);
        return;
      }
      var hit = map.forEachFeatureAtPixel(e.pixel, function (f) { return f.get('pin') || null; }, { hitTolerance: 6 });
      if (hit) { openPlace(hit); }
      else { closePlace(); }
    });
  }

  /* ---------- karttamerkit (SVG-kuvakkeet) ----------
     Haettu tai valittu kohde saa pisaranmuotoisen paikkamerkin, ja
     reitin maaranpaa ison valkoisen ruutulippupallon — samaan tapaan
     kuin karttapalveluissa. */
  function svgUrl(svg) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  var PIN_RED = '#ff3b30';
  var PIN_SCALE = 0.45;         // merkit pienina kartalla
  var pinCache = {};
  function pinIcon(color) {
    if (pinCache[color]) return pinCache[color];
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="46" viewBox="0 0 34 46">' +
        '<path d="M17 1C8.7 1 2 7.7 2 16c0 11 15 29 15 29s15-18 15-29C32 7.7 25.3 1 17 1z" ' +
          'fill="' + color + '" stroke="#06110b" stroke-width="2"/>' +
        '<circle cx="17" cy="16" r="6" fill="#fff"/>' +
      '</svg>';
    pinCache[color] = svgUrl(svg);
    return pinCache[color];
  }
  var goalIconUrl = (function () {
    /* Valkoinen pallo ja mustat ruudut keskella (ruutulippu). */
    var sq = '', size = 5.2, x0 = 17 - size * 1.5, y0 = 17 - size * 1.5;
    for (var r = 0; r < 3; r++) {
      for (var c = 0; c < 3; c++) {
        if ((r + c) % 2) continue;
        sq += '<rect x="' + (x0 + c * size).toFixed(1) + '" y="' + (y0 + r * size).toFixed(1) +
              '" width="' + size + '" height="' + size + '" fill="#101813"/>';
      }
    }
    return svgUrl(
      '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">' +
        '<defs><clipPath id="c"><circle cx="17" cy="17" r="9.5"/></clipPath></defs>' +
        '<circle cx="17" cy="17" r="15" fill="#fff" stroke="#06110b" stroke-width="3"/>' +
        '<g clip-path="url(#c)">' + sq + '</g>' +
      '</svg>');
  })();
  /* Lahtopiste: pelkka pieni valkoinen pallo. */
  var startIconUrl = svgUrl(
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">' +
      '<circle cx="11" cy="11" r="8" fill="#ffffff" stroke="#06110b" stroke-width="2"/>' +
    '</svg>');

  var arrowIconUrl = svgUrl(
    '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">' +
      '<circle cx="14" cy="14" r="12" fill="#06110b" stroke="#3ef08a" stroke-width="2"/>' +
      '<path d="M14 6l6 12-6-3-6 3z" fill="#3ef08a"/>' +
    '</svg>');

  function smallLabel(text, dy) {
    return new ol.style.Text({
      text: text || '', offsetY: dy, font: '500 11px Outfit, sans-serif',
      fill: new ol.style.Fill({ color: '#f2f8f4' }),
      stroke: new ol.style.Stroke({ color: 'rgba(6,17,11,.75)', width: 2.5 })
    });
  }

  /* ---------- tyylit ---------- */
  function pinStyle(f) {
    var p = f.get('pin'), nav = p && p.is_nav && p.is_target === false;
    var sel = selected && p && selected.id === p.id;
    var hov = p && hoveredId !== null && p.id === hoveredId;

    /* Valittu kohde nostetaan pisaramerkiksi, jotta se erottuu muista. */
    if (sel) {
      return new ol.style.Style({
        image: new ol.style.Icon({
          src: pinIcon(PIN_RED),
          anchor: [0.5, 1], anchorXUnits: 'fraction', anchorYUnits: 'fraction', scale: PIN_SCALE
        }),
        text: smallLabel(p.title, -32)
      });
    }

    /* Tavalliset karttamerkit piirretaan pienina pisteina, jotta kartta
       pysyy luettavana myos kun merkkeja on paljon. */
    var r = nav ? 2.2 : 3;
    if (hov) r += 1.6;                    // merkki tuntuu napilta hiiren alla
    return new ol.style.Style({
      image: new ol.style.Circle({
        radius: r,
        fill: new ol.style.Fill({ color: p.color || '#3ef08a' }),
        stroke: new ol.style.Stroke({ color: hov ? '#fff' : 'rgba(0,0,0,.8)', width: hov ? 1.8 : 1 })
      }),
      text: (hov || optNames) ? smallLabel(p.title, -(r + 9)) : null
    });
  }

  var LETTERS = 'ABCDEFGH';
  function stopStyle(i, total, label, cum) {
    /* Lahtopiste on pieni valkoinen pallo, maaranpaa punainen
       paikkamerkki ja valipysahdykset harmaat pallot kirjaimilla. */
    if (i === 0) {
      return new ol.style.Style({
        image: new ol.style.Icon({ src: startIconUrl, anchor: [0.5, 0.5], scale: 0.62 }),
        text: smallLabel(label, -15)
      });
    }
    if (i === total - 1) {
      return new ol.style.Style({
        image: new ol.style.Icon({
          src: pinIcon(PIN_RED),
          anchor: [0.5, 1], anchorXUnits: 'fraction', anchorYUnits: 'fraction', scale: PIN_SCALE
        }),
        text: smallLabel(label, -26)
      });
    }
    var passed = navigating && navDist >= (cum || 0) - 0.5;
    return [
      new ol.style.Style({
        image: new ol.style.Circle({
          radius: 8,
          fill: new ol.style.Fill({ color: passed ? '#53605a' : '#b9c7c0' }),
          stroke: new ol.style.Stroke({ color: 'rgba(6,17,11,.75)', width: 1.6 })
        }),
        text: new ol.style.Text({
          text: LETTERS[i - 1] || String(i), font: '700 11px Outfit, sans-serif',
          fill: new ol.style.Fill({ color: passed ? '#c9d4ce' : '#111a16' })
        })
      }),
      new ol.style.Style({ text: smallLabel(label, -17) })
    ];
  }

  function routeStyle(f) {
    var g = f.getGeometry().getType();
    if (g === 'Point') {
      if (f.get('arrow')) {
        /* Nuoli kulkee viivaa pitkin samaan tahtiin laskurin kanssa. */
        return new ol.style.Style({
          image: new ol.style.Icon({
            src: arrowIconUrl, anchor: [0.5, 0.5], rotation: f.get('rot') || 0, rotateWithView: true
          })
        });
      }
      if (f.get('stopIndex') === undefined) return null;
      return stopStyle(f.get('stopIndex'), f.get('stopTotal'), f.get('stopLabel'), f.get('cum'));
    }

    /* Taakse jaanyt osuus harmaantuu navigoinnin aikana. */
    var done = navigating && navDist >= (f.get('end') || 0) - 0.5;
    var col = done ? 'rgba(150,165,158,.7)' : '#ffffff';
    return [
      new ol.style.Style({ stroke: new ol.style.Stroke({ color: 'rgba(0,0,0,.45)', width: 5 }) }),
      new ol.style.Style({
        stroke: new ol.style.Stroke({ color: col, width: 2.6 }),
        /* Pieni etaisyysteksti kulkee viivan suuntaisesti. */
        text: new ol.style.Text({
          text: nf(f.get('d') || 0) + ' m', placement: 'line', textBaseline: 'bottom', offsetY: -3,
          font: '500 10px Outfit, sans-serif',
          fill: new ol.style.Fill({ color: done ? '#a9b8b0' : '#cfdcd5' }),
          stroke: new ol.style.Stroke({ color: 'rgba(6,17,11,.7)', width: 2.5 })
        })
      })
    ];
  }

  /* ---------- merkit Supabasesta ---------- */
  function loadPins() {
    return fetch(SUPA.url + '/rest/v1/pins?select=id,title,message,x,z,author,color,symbol,is_nav,is_target,category&order=created_at.desc', {
      headers: { apikey: SUPA.key, Authorization: 'Bearer ' + SUPA.key }
    }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; });
  }
  function pinVisible(p) {
    if (!optPins) return false;
    if (p.is_nav && p.is_target === false) return showNav;
    return !hideCats[catOf(p)];
  }
  /* Merkit piirtyvat vasta riittavan lahella — samaan tapaan kuin
     karttapalveluissa, joissa liikkeet ja kohteet ilmestyvat vasta kun
     karttaa on zoomattu tarpeeksi. Raja on kolmanneksi lahin taso.
     Valittu merkki ja reitin pysahdykset nakyvat aina. */
  function pinsZoomOk() {
    if (!view) return false;
    var mz = view.getMaxZoom();
    if (mz <= 0) return false;                 // suuri kartta: vain yksi taso
    return view.getZoom() >= Math.max(0, mz - 2);
  }
  function drawPins() {
    if (!pinLayer) return;
    var src = pinLayer.getSource(); src.clear();
    var ok = pinsZoomOk();
    /* Reitin paiden ja valipysahdysten kohdalla ei piirreta tavallista
       varipalloa, jottei se pilkistaisi kuvakkeen alta. */
    var taken = {};
    stops.forEach(function (st) { if (st) taken[st.x + ',' + st.z] = true; });
    pins.forEach(function (p) {
      if (taken[p.x + ',' + p.z]) return;
      if (!pinVisible(p)) return;
      var isSel = selected && selected.id === p.id;
      if (!ok && !isSel) return;
      var f = new ol.Feature({ geometry: new ol.geom.Point(toView(p.x, p.z)) });
      f.set('pin', p); src.addFeature(f);
    });
    var note = $('kn-zoomnote');
    if (note) note.hidden = ok || !pins.length;
  }

  /* Onko nykyisen nakyman keskella tiilta? Jos ei, kayttajalle
     kerrotaan ettei alueella ole tarkkaa karttaa ja tarjotaan suurta
     karttaa, joka kattaa koko maailman. */
  function checkCoverage() {
    var note = $('kn-nomap');
    if (!note) return;
    if (!regionMap || curMap === '5k' || !view) { note.hidden = true; return; }
    var b = toBlock(view.getCenter());
    var wz = -(mapLevels - Math.round(view.getZoom())) + mapMaxZoom;
    var f = Math.pow(2, wz);
    var has = regionMap.hasTile(Math.floor(b[0] * f / TILE), Math.floor(b[1] * f / TILE), wz);
    note.hidden = !!has;
  }
  var nomapBtn = $('kn-nomap-btn');
  if (nomapBtn) nomapBtn.onclick = function () {
    var b = view ? toBlock(view.getCenter()) : [0, 0];
    autoMapOn = false;                 // kayttajan oma valinta
    $('kn-nomap').hidden = true;
    loadMeta('5k').then(function (meta) {
      buildMap(meta);
      view.setCenter(toView(b[0], b[1]));
      drawPins(); drawRoute(false);
    }).catch(function () {});
  };

  /* ---------- haku ---------- */
  function parseCoords(str) {
    var n = String(str).match(/-?\d+(?:[.,]\d+)?/g);
    if (!n || n.length < 2) return null;
    var v = n.map(function (x) { return Math.round(parseFloat(x.replace(',', '.'))); });
    /* kolme lukua = F3-rivi (X Y Z), korkeus jatetaan pois */
    return v.length >= 3 ? { x: v[0], z: v[2] } : { x: v[0], z: v[1] };
  }
  function search(q) {
    q = String(q || '').trim().toLowerCase();
    var out = [];
    var c = parseCoords(q);
    if (c) out.push({ x: c.x, z: c.z, label: c.x + ' ' + c.z, sub: 'Koordinaatit', coord: true });
    if (q) {
      pins.filter(function (p) {
        return String(p.title || '').toLowerCase().indexOf(q) > -1 ||
               String(p.author || '').toLowerCase().indexOf(q) > -1 ||
               String(p.message || '').toLowerCase().indexOf(q) > -1;
      }).slice(0, 8).forEach(function (p) { out.push(pinToItem(p)); });
    }
    return out;
  }
  function pinToItem(p) {
    return {
      x: p.x, z: p.z, label: p.title, pin: p, color: p.color,
      sub: catName(p) + ' · ' + (p.author || 'Nimetön') + ' · X ' + p.x + ', Z ' + p.z
    };
  }
  function recents() { return lsGet(LS_RECENT, []); }
  function pushRecent(item) {
    var r = recents().filter(function (o) { return !(o.x === item.x && o.z === item.z); });
    r.unshift({ x: item.x, z: item.z, label: item.label, sub: item.sub, color: item.color });
    lsSet(LS_RECENT, r.slice(0, 6));
  }

  function renderSug(items, emptyText) {
    var box = $('kn-sug');
    setTimeout(placeCollapseBtn, 0);
    if (!items.length) {
      if (!emptyText) { box.hidden = true; return; }
      box.innerHTML = '<div class="kn-sug__empty">' + esc(emptyText) + '</div>';
      box.hidden = false; return;
    }
    box.innerHTML = items.map(function (o, i) {
      return '<button type="button" class="kn-sug__i" data-i="' + i + '">' +
        '<span class="kn-sug__ico" style="color:' + esc(o.color || '#8fae9f') + '">' +
          (o.coord ? '&#9678;' : (o.recent ? '&#128337;' : '&#128205;')) + '</span>' +
        '<span class="kn-sug__txt"><strong>' + esc(o.label) + '</strong>' +
        '<em>' + esc(o.sub || '') + '</em></span></button>';
    }).join('');
    box.hidden = false;
    /* Hakuvaiheessa kartalle ei piirreta mitaan: paikkamerkki ilmestyy
       vasta kun kohde on valittu ja sen tiedot aukeavat. */
    box.querySelectorAll('.kn-sug__i').forEach(function (b) {
      b.onclick = function () { pickItem(items[+b.dataset.i]); };
    });
  }

  function pickItem(item) {
    $('kn-sug').hidden = true;
    pushRecent(item);
    if (dirMode) {
      var slot = stops.indexOf(null);
      setStop(slot > -1 ? slot : stops.length - 1, item);
      $('kn-q').value = '';
      return;
    }
    $('kn-q').value = item.label;
    $('kn-qx').hidden = false;
    var p = item.pin || { id: 'coord:' + item.x + ',' + item.z, title: item.label, x: item.x, z: item.z, color: '#5ad1ff' };
    openPlace(p);
    view.animate({ center: toView(p.x, p.z), duration: 420, zoom: Math.min(view.getMaxZoom(), view.getZoom() + 1) });
  }

  /* ---------- paikkakortti ---------- */
  function openPlace(p) {
    selected = p;
    drawPins();
    var box = $('kn-place');
    var real = p.id && String(p.id).indexOf('coord') !== 0;

    box.innerHTML =
      '<button type="button" class="kn-place__x" id="kn-place-x" title="Sulje">&#10005;</button>' +
      (real ? '<div class="kn-hero" id="kn-hero" hidden></div>' : '') +
      '<div class="kn-place__body">' +
        '<h3><span class="kn-place__dot" style="background:' + esc(p.color || '#3ef08a') + '"></span>' + esc(p.title) + '</h3>' +
        '<p class="kn-place__meta">' + esc(catName(p)) +
          (p.is_nav && p.is_target === false ? ' · navigointipiste' : '') +
          ' · X ' + p.x + ', Z ' + p.z + '</p>' +

        '<div class="kn-acts">' +
          '<button type="button" class="kn-act kn-act--primary" data-a="to">' +
            '<span class="kn-act__ico">&#10174;</span><span class="kn-act__t">Reittiohjeet</span></button>' +
          '<button type="button" class="kn-act" data-a="from">' +
            '<span class="kn-act__ico">&#9679;</span><span class="kn-act__t">Lähtöpiste</span></button>' +
          '<button type="button" class="kn-act" data-a="copy">' +
            '<span class="kn-act__ico">&#128203;</span><span class="kn-act__t">Kopioi X Z</span></button>' +
          '<button type="button" class="kn-act" data-a="share">' +
            '<span class="kn-act__ico">&#128279;</span><span class="kn-act__t">Jaa</span></button>' +
        '</div>' +

        (p.message ? '<p class="kn-place__msg">' + esc(p.message) + '</p>' : '') +

        '<div class="kn-rows">' +
          '<div><span class="kn-rows__i">&#128205;</span><span>X ' + p.x + ', Z ' + p.z + '</span></div>' +
          '<div><span class="kn-rows__i">&#127991;</span><span>' + esc(catName(p)) + '</span></div>' +
          (p.symbol ? '<div><span class="kn-rows__i">&#9734;</span><span>' + esc(SYMBOL_NAMES[p.symbol] || p.symbol) + '</span></div>' : '') +
          '<div><span class="kn-rows__i">&#128100;</span><span>' + esc(p.author || 'Nimetön') + '</span></div>' +
        '</div>' +

        (real ? '<div class="kn-imgs" id="kn-imgs"></div>' : '') +
        (real ? '<button type="button" class="kn-btn kn-btn--wide" id="kn-openmap">&#128506; Avaa karttasivulla</button>' : '') +
      '</div>';

    box.hidden = false;
    box.scrollTop = 0;
    placeCollapseBtn();
    var item = { x: p.x, z: p.z, label: p.title };
    $('kn-place-x').onclick = closePlace;

    /* Sama kulku kuin karttapalveluissa: haku vie paikkaan, ja vasta
       Reittiohjeet avaa reitin — kohde on valmiina ja lahtokentta jaa
       auki ehdotuksineen. */
    box.querySelector('[data-a="to"]').onclick = function () { routeTo(item, 'end'); };
    box.querySelector('[data-a="from"]').onclick = function () { routeTo(item, 'start'); };
    box.querySelector('[data-a="copy"]').onclick = function () {
      copyText(p.x + ' ' + p.z, this, 'Kopioi X Z');
    };
    box.querySelector('[data-a="share"]').onclick = function () {
      copyText(location.origin + location.pathname + '#p=' + p.x + ',' + p.z, this, 'Jaa');
    };
    if (real) {
      $('kn-openmap').onclick = function () {
        window.open('kartta.html#pin=' + encodeURIComponent(p.id), '_blank', 'noopener');
      };
      loadPlaceImages(p);
    }
  }

  /* Merkin kuvat haetaan vasta kun kohde avataan, ei koko listalle
     etukateen. Ensimmainen kuva nousee kortin ylaosaan isoksi
     kansikuvaksi ja loput pikkukuviksi; molemmat avaavat ison version. */
  function loadPlaceImages(p) {
    var token = ++placeToken;
    fetch(SUPA.url + '/rest/v1/pin_images?select=*&pin_id=eq.' + encodeURIComponent(p.id) + '&order=created_at.asc', {
      headers: { apikey: SUPA.key, Authorization: 'Bearer ' + SUPA.key }
    }).then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; })
      .then(function (imgs) {
        if (token !== placeToken) return;          // kortti ehti vaihtua
        var hero = $('kn-hero'), strip = $('kn-imgs');
        if (!hero || !strip || !imgs.length) return;
        hero.innerHTML = '<a href="' + esc(imgs[0].full_url) + '" target="_blank" rel="noopener">' +
          '<img src="' + esc(imgs[0].thumb_url) + '" alt="' + esc(p.title) + '"></a>' +
          (imgs.length > 1 ? '<span class="kn-hero__n">' + imgs.length + ' kuvaa</span>' : '');
        hero.hidden = false;
        strip.innerHTML = imgs.slice(1).map(function (im) {
          return '<a class="kn-img" href="' + esc(im.full_url) + '" target="_blank" rel="noopener" title="Avaa kuva">' +
            '<img src="' + esc(im.thumb_url) + '" alt="Merkin kuva" loading="lazy"></a>';
        }).join('');
      });
  }

  function copyText(txt, btn, orig) {
    var t = btn.querySelector('.kn-act__t') || btn;
    var done = function () { t.textContent = 'Kopioitu'; setTimeout(function () { t.textContent = orig; }, 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, done); else done();
  }

  /* Avaa reittiohjeet paikkasivulta: toinen paa taytetaan ja kursori
     viedaan tyhjaan kenttaan, jonka ehdotuslista aukeaa heti. */
  function routeTo(item, which) {
    closePlace();
    openDir();
    if (which === 'start') stops[0] = item;
    else stops[stops.length - 1] = item;
    renderStops();
    drawRoute(true);
    var empty = stops.indexOf(null);
    if (empty > -1) {
      /* Viive: tama kutsutaan klikkauksesta, ja sama klikkaus kayy viela
         dokumenttitason kuuntelijassa joka sulkee ehdotuslistat. */
      setTimeout(function () {
        var inp = document.querySelector('.kn-stop__in[data-i="' + empty + '"]');
        if (!inp) return;
        inp.focus();
        inp.dispatchEvent(new Event('focus'));
      }, 0);
    }
  }

  function closePlace() {
    selected = null; drawPins();
    $('kn-place').hidden = true;
    placeCollapseBtn();
  }

  /* ---------- kategoriasirut ---------- */
  function renderChips() {
    var counts = {}, navCount = 0;
    pins.forEach(function (p) {
      if (p.is_nav && p.is_target === false) { navCount++; return; }
      var c = catOf(p);
      counts[c] = (counts[c] || 0) + 1;
    });
    var html = CATEGORIES.filter(function (c) { return counts[c.id]; }).map(function (c) {
      return '<button type="button" class="kn-chip' + (hideCats[c.id] ? '' : ' is-on') + '" data-cat="' + c.id + '">' +
        '<span class="kn-chip__ico">' + c.ico + '</span>' + esc(c.name) + ' <span>' + counts[c.id] + '</span></button>';
    }).join('');
    if (navCount) {
      html += '<button type="button" class="kn-chip kn-chip--nav' + (showNav ? ' is-on' : '') + '" data-nav="1">' +
        '<span class="kn-chip__ico">&#129517;</span>Navigointi <span>' + navCount + '</span></button>';
    }
    var box = $('kn-chips');
    box.innerHTML = html;
    box.querySelectorAll('[data-cat]').forEach(function (b) {
      b.onclick = function () {
        var c = b.dataset.cat;
        hideCats[c] = !hideCats[c];
        b.classList.toggle('is-on', !hideCats[c]);
        drawPins();
      };
    });
    var nb = box.querySelector('[data-nav]');
    if (nb) nb.onclick = function () {
      showNav = !showNav;
      nb.classList.toggle('is-on', showNav);
      var cb = $('kn-opt-nav'); if (cb) cb.checked = showNav;
      drawPins();
    };
  }

  /* ---------- reittipaneeli ---------- */
  function openDir() {
    closePlace();
    dirMode = true;
    $('kn-dir').hidden = false;
    $('kn-search').classList.add('is-dir');
    $('kn-dirbtn').classList.add('is-on');
    $('kn-sug').hidden = true;
    renderStops();
    placeCollapseBtn();
  }
  function closeDir() {
    dirMode = false;
    $('kn-dir').hidden = true;
    $('kn-search').classList.remove('is-dir');
    $('kn-dirbtn').classList.remove('is-on');
    setPicking(null);
    placeCollapseBtn();
  }

  function setStop(i, item) {
    if (i < 0 || i >= stops.length) return;
    stops[i] = item ? { x: item.x, z: item.z, label: item.label } : null;
    renderStops();
    drawRoute(true);
    writeHash();
  }
  function setPicking(i) {
    picking = i;
    $('kn-hint').hidden = (i === null);
    document.querySelectorAll('.kn-stop__pick').forEach(function (b) {
      b.classList.toggle('is-on', picking !== null && +b.dataset.i === picking);
    });
    if (map) map.getTargetElement().style.cursor = (i !== null) ? 'crosshair' : '';
  }

  function stopRole(i) {
    if (i === 0) return '(aloituspiste)';
    if (i === stops.length - 1) return '(määränpää)';
    return '(' + (LETTERS[i - 1] || i) + ')';
  }
  function stopLabel(i) {
    if (i === 0) return 'Valitse aloituspiste tai klikkaa karttaa';
    if (i === stops.length - 1) return 'Valitse määränpää';
    return 'Välipysähdys';
  }
  function renderStops() {
    var box = $('kn-stops');
    box.innerHTML = stops.map(function (s, i) {
      var cls = i === 0 ? 'a' : (i === stops.length - 1 ? 'b' : 'w');
      return '<div class="kn-stop">' +
        '<span class="kn-stop__dot kn-stop__dot--' + cls + '"></span>' +
        '<input type="text" class="kn-stop__in" data-i="' + i + '" autocomplete="off" placeholder="' +
          esc(stopLabel(i)) + '" value="' + esc(s ? s.label : '') + '">' +
        '<span class="kn-stop__role">' + esc(stopRole(i)) + '</span>' +
        '<button type="button" class="kn-stop__pick" data-i="' + i + '" title="Valitse kartalta">&#8853;</button>' +
        (stops.length > 2 ? '<button type="button" class="kn-stop__del" data-i="' + i + '" title="Poista">&#10005;</button>' : '') +
      '</div>';
    }).join('');

    /* Klikkaus mihin tahansa kentan rivilla vie kursorin kenttaan. */
    box.querySelectorAll('.kn-stop').forEach(function (row) {
      row.addEventListener('mousedown', function (e) {
        if (e.target.closest('button') || e.target.classList.contains('kn-stop__in')) return;
        e.preventDefault();
        var inp = row.querySelector('.kn-stop__in');
        if (inp) inp.focus();
      });
    });

    box.querySelectorAll('.kn-stop__in').forEach(function (inp) {
      var i = +inp.dataset.i;
      inp.addEventListener('input', function () {
        var items = search(inp.value);
        renderStopSug(inp, items, i);
      });
      inp.addEventListener('focus', function () {
        var items = inp.value.trim() ? search(inp.value) : recents().map(function (r) { r.recent = true; return r; });
        renderStopSug(inp, items, i);
      });
      inp.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        var items = search(inp.value);
        if (items.length) { pushRecent(items[0]); setStop(i, items[0]); }
      });
    });
    box.querySelectorAll('.kn-stop__pick').forEach(function (b) {
      b.onclick = function () { setPicking(picking === +b.dataset.i ? null : +b.dataset.i); };
    });
    box.querySelectorAll('.kn-stop__del').forEach(function (b) {
      b.onclick = function () {
        stops.splice(+b.dataset.i, 1);
        renderStops(); drawRoute(true); writeHash();
      };
    });
    $('kn-add').disabled = stops.length >= 6;
  }

  /* Ehdotuslista avautuu suoraan sen kentan alle jota kirjoitetaan. */
  function renderStopSug(inp, items, i) {
    document.querySelectorAll('.kn-stopsug').forEach(function (e) { e.remove(); });
    /* Tyhjan kentan ensimmainen vaihtoehto on aina kartalta poiminta —
       samassa roolissa kuin "Sijaintisi" karttapalveluissa. */
    if (!inp.value.trim()) {
      items = [{ pickOnMap: true, label: 'Valitse kartalta', sub: 'Klikkaa haluamaasi kohtaa' }].concat(items);
    }
    if (!items.length) return;
    var box = document.createElement('div');
    box.className = 'kn-sug kn-stopsug';
    box.innerHTML = items.map(function (o, k) {
      return '<button type="button" class="kn-sug__i" data-k="' + k + '">' +
        '<span class="kn-sug__ico" style="color:' + esc(o.color || (o.pickOnMap ? '#3ef08a' : '#8fae9f')) + '">' +
          (o.pickOnMap ? '&#8853;' : (o.coord ? '&#9678;' : (o.recent ? '&#128337;' : '&#128205;'))) + '</span>' +
        '<span class="kn-sug__txt"><strong>' + esc(o.label) + '</strong><em>' + esc(o.sub || '') + '</em></span></button>';
    }).join('');
    inp.parentNode.appendChild(box);
    box.querySelectorAll('.kn-sug__i').forEach(function (b) {
      var o = items[+b.dataset.k];
      b.onclick = function () {
        box.remove();
        if (o.pickOnMap) { setPicking(i); return; }
        pushRecent(o); setStop(i, o);
      };
    });
  }

  /* ---------- reitin laskenta ja piirto ---------- */
  function legs() {
    var pts = stops.filter(function (s) { return !!s; });
    if (pts.length < 2) return null;
    var out = [], total = 0;
    for (var i = 1; i < pts.length; i++) {
      var d = dist(pts[i - 1], pts[i]);
      out.push({ from: pts[i - 1], to: pts[i], d: d });
      total += d;
    }
    return { pts: pts, legs: out, total: total };
  }

  function wantedMap(points) {
    if (!points.length) return curMap;
    var r = 0;
    points.forEach(function (p) { r = Math.max(r, Math.abs(p.x), Math.abs(p.z)); });
    return r <= AUTO_RADIUS ? 'paiva' : '5k';
  }
  /* Kartta vaihdetaan vasta kun seka lahto etta maaranpaa on valittu:
     yksittainen piste ei saa vaihtaa tasoa kesken valinnan. */
  function applyAutoMap(points, refit) {
    if (!autoMapOn) return false;
    if (points.length < 2) return false;
    var want = wantedMap(points);
    if (want === curMap) return false;
    var menu = $('kn-layers-menu');
    menu.querySelectorAll('[data-map]').forEach(function (x) { x.classList.toggle('is-on', x.dataset.map === want); });
    loadMeta(want).then(function (meta) {
      buildMap(meta);
      drawPins();
      drawRoute(!!refit);
    }).catch(function () {});
    return true;
  }

  function drawRoute(fit) {
    if (!routeLayer) return;
    var s = routeLayer.getSource(); s.clear();
    var r = legs();
    var pts = stops.filter(function (x) { return !!x; });

    /* Pysahdysten tyyli lasketaan vasta piirtohetkella, jotta ohitettu
       valipysahdys voi tummua navigoinnin edetessa. */
    var cum = 0;
    pts.forEach(function (p, i) {
      if (i > 0) cum += dist(pts[i - 1], p);
      var f = new ol.Feature({ geometry: new ol.geom.Point(toView(p.x, p.z)) });
      f.set('stopIndex', i); f.set('stopTotal', pts.length);
      f.set('stopLabel', p.label); f.set('cum', cum);
      s.addFeature(f);
    });

    if (r) {
      /* Jokainen osuus on oma viivansa, jotta sen voi varittaa ja
         nimeta erikseen. */
      var acc = 0;
      r.legs.forEach(function (l, i) {
        var f = new ol.Feature({
          geometry: new ol.geom.LineString([toView(l.from.x, l.from.z), toView(l.to.x, l.to.z)])
        });
        f.set('leg', i); f.set('d', l.d);
        f.set('start', acc); acc += l.d; f.set('end', acc);
        s.addFeature(f);
      });
      if (navigating) addArrow(r);
    }
    renderRouteInfo(r);
    renderNav();
    if (fit && r) {
      /* Vaihto rakentaa kartan uudelleen ja piirtaa reitin sitten uudelleen,
         joten tassa ei enaa sovitettaisi oikeaan nakymaan. Vaihto tehdaan
         vain kun jokainen pysahdys on valittu. */
      var allSet = stops.every(function (st) { return !!st; });
      if (allSet && applyAutoMap(r.pts, true)) return;
      fitRoute(r);
    }
  }

  /* Sovitus lasketaan kerralla valmiiksi ja ajetaan yhtena animaationa.
     Aiemmin zoomia kokeiltiin askel kerrallaan ajastimilla, mika nakyi
     nykivana sarjana hyppyja. */
  /* Nuoli asetetaan kuljetun matkan kohdalle ja kaannetaan osuuden
     suuntaan. Vauhti on sama kuin laskurissa: tasainen nopeus. */
  function arrowAt(r, dist) {
    var left = Math.max(0, Math.min(dist, r.total));
    for (var i = 0; i < r.legs.length; i++) {
      var l = r.legs[i];
      if (left <= l.d || i === r.legs.length - 1) {
        var t = l.d ? Math.min(1, left / l.d) : 0;
        var x = l.from.x + (l.to.x - l.from.x) * t;
        var z = l.from.z + (l.to.z - l.from.z) * t;
        /* OpenLayersin kierto kasvaa myotapaivaan ja Z kasvaa alaspain. */
        var rot = Math.atan2(l.to.x - l.from.x, -(l.to.z - l.from.z));
        return { x: x, z: z, rot: rot };
      }
      left -= l.d;
    }
    return null;
  }
  function addArrow(r) {
    var a = arrowAt(r, navDist);
    if (!a) return;
    var f = new ol.Feature({ geometry: new ol.geom.Point(toView(a.x, a.z)) });
    f.set('arrow', true); f.set('rot', a.rot);
    routeLayer.getSource().addFeature(f);
  }
  var navRaf = null;
  /* Nuoli paivitetaan naytön virkistystahdissa, jolloin liike on sulava
     — laskuri paivittyy edelleen kerran sekunnissa. */
  function animArrow() {
    if (!navigating) { navRaf = null; return; }
    var r = legs();
    if (r && navTotalSec > 0) {
      var elapsed = (Date.now() - navStart) / 1000;
      navDist = Math.max(0, Math.min(r.total, r.total * (elapsed / navTotalSec)));
      updateArrow();
    }
    navRaf = requestAnimationFrame(animArrow);
  }

  function updateArrow() {
    if (!routeLayer) return;
    var r = legs();
    if (!r) return;
    var src = routeLayer.getSource();
    var f = src.getFeatures().filter(function (o) { return o.get('arrow'); })[0];
    var a = arrowAt(r, navDist);
    if (!a) return;
    if (!f) { addArrow(r); return; }
    f.setGeometry(new ol.geom.Point(toView(a.x, a.z)));
    f.set('rot', a.rot);
    routeLayer.changed();
  }

  function fitRoute(r) {
    if (!map || !view) return;
    var size = map.getSize();
    if (!size) return;

    var e = ol.extent.boundingExtent(r.pts.map(function (p) { return toView(p.x, p.z); }));
    /* Marginaali: 18 % reitin pituudesta, vahintaan 70 lohkoa, jottei
       lyhyt reitti zoomaudu kiinni paatepisteisiin. */
    var span = Math.max(ol.extent.getWidth(e), ol.extent.getHeight(e));
    e = ol.extent.buffer(e, Math.max(span * 0.18, 70 / BPD));

    /* Reunukset mitataan paneelin todellisesta koosta, jottei reitti jaa
       sen alle. [ylos, oikea, alas, vasen] */
    var el = map.getTargetElement().getBoundingClientRect();
    var panel = document.querySelector('.kn-left');
    var hidden = app.classList.contains('is-collapsed') || !panel ||
                 getComputedStyle(panel).display === 'none';
    var pr = hidden ? { width: 0, height: 0 } : panel.getBoundingClientRect();
    var sideFits = (el.width - pr.width) > 340;
    var pad = hidden
      ? [80, 60, 90, 60]
      : (sideFits ? [90, 60, 90, Math.round(pr.width) + 36]
                  : [Math.min(Math.round(pr.height) + 24, Math.round(el.height * 0.55)), 50, 90, 50]);

    var freeW = Math.max(80, size[0] - pad[1] - pad[3]);
    var freeH = Math.max(80, size[1] - pad[0] - pad[2]);

    /* Tiilia on vain kokonaisille tasoille, joten valitaan suoraan lahin
       taso jolla reitti viela mahtuu vapaalle alueelle. */
    var need = Math.max(ol.extent.getWidth(e) / freeW, ol.extent.getHeight(e) / freeH);
    var res = view.getResolutions() || [view.getResolution()];
    var pick = res.length - 1;
    for (var i = 0; i < res.length; i++) { if (res[i] >= need) pick = i; }
    var r0 = res[pick];

    /* Keskipiste siirretaan niin etta reitti asettuu vapaan alueen
       keskelle eika paneelin alle. */
    var c = ol.extent.getCenter(e);
    view.animate({
      center: [c[0] - ((pad[3] - pad[1]) / 2) * r0, c[1] + ((pad[0] - pad[2]) / 2) * r0],
      resolution: r0,
      duration: 450,
      easing: ol.easing.inAndOut
    });
  }

  function curMode() {
    var id = localStorage.getItem(LS_MODE) || 'walk';
    return MODES.filter(function (m) { return m.id === id; })[0] || MODES[0];
  }

  function renderRouteInfo(r) {
    var modesBox = $('kn-modes'), routesBox = $('kn-routes');
    var sel = curMode();

    modesBox.innerHTML = MODES.map(function (m) {
      return '<button type="button" class="kn-mode' + (m.id === sel.id ? ' is-on' : '') + '" data-m="' + m.id + '" title="' + esc(m.name) + '">' +
        '<span class="kn-mode__ico">' + m.ico + '</span>' +
        '<span class="kn-mode__t">' + (r ? dur(r.total / m.v) : '–') + '</span>' +
      '</button>';
    }).join('');
    modesBox.querySelectorAll('.kn-mode').forEach(function (b) {
      b.onclick = function () { localStorage.setItem(LS_MODE, b.dataset.m); renderRouteInfo(legs()); renderNav(); };
    });

    if (!r) {
      routesBox.innerHTML = '<div class="kn-routes__empty">Valitse lähtöpaikka ja määränpää — hae nimellä, syötä X Z tai poimi piste kartalta.</div>';
      return;
    }

    var legHtml = r.legs.map(function (l, i) {
      return '<li><span class="kn-leg__n">' + (i + 1) + '</span>' +
        '<span class="kn-leg__t">' + esc(l.from.label) + ' &rarr; ' + esc(l.to.label) + '</span>' +
        '<span class="kn-leg__d">' + nf(l.d) + ' m · ' + dur(l.d / sel.v) + '</span></li>';
    }).join('');

    routesBox.innerHTML =
      '<div class="kn-route is-best">' +
        '<div class="kn-route__head">' +
          '<span class="kn-route__time">' + dur(r.total / sel.v) + '</span>' +
          '<span class="kn-route__km">' + nf(r.total) + ' m</span>' +
        '</div>' +
        '<div class="kn-route__sub">' + sel.ico + ' ' + esc(sel.name) + ' · linnuntietä' +
          (r.legs.length > 1 ? ' · ' + r.legs.length + ' osuutta' : '') + '</div>' +
      '</div>' +
      '<div class="kn-route">' +
        '<div class="kn-route__head">' +
          '<span class="kn-route__time">' + dur(r.total / 8 / sel.v) + '</span>' +
          '<span class="kn-route__km">' + nf(r.total / 8) + ' m</span>' +
        '</div>' +
        '<div class="kn-route__sub">&#128293; Netherin kautta 1:8 · vaatii portaalin molemmissa päissä</div>' +
      '</div>' +
      '<ol class="kn-legs">' + legHtml + '</ol>' +
      '<p class="kn-modenote">' + esc(sel.note) + '</p>' +
      (stops.every(function (st) { return !!st; })
        ? '<button type="button" class="kn-start" id="kn-start">&#9654; Aloita navigointi</button>' : '');

    var startBtn = $('kn-start');
    if (startBtn) startBtn.onclick = startNav;
  }

  /* ---------- jaettava linkki ---------- */
  /* Reittia EI tallenneta osoiteriville automaattisesti: sivun
     paivitys aloittaa aina puhtaalta poydalta. Jaettava linkki
     rakennetaan vasta Kopioi linkki -napista. */
  function writeHash() {}
  function routeUrl() {
    var pts = stops.filter(function (s) { return !!s; });
    if (pts.length < 2) return location.origin + location.pathname;
    return location.origin + location.pathname + '#r=' +
      pts.map(function (p) { return p.x + ',' + p.z; }).join(';');
  }
  function clearHash() {
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  }
  function readHash() {
    var pm = /^#p=(-?\d+),(-?\d+)$/.exec(location.hash || '');
    if (pm) {
      var px = +pm[1], pz = +pm[2];
      var hit = pins.filter(function (p) { return p.x === px && p.z === pz; })[0];
      var place = hit || { id: 'coord', title: px + ' ' + pz, x: px, z: pz, color: '#5ad1ff' };
      openPlace(place);
      view.animate({ center: toView(px, pz), duration: 400, zoom: view.getMaxZoom() });
      clearHash();
      return;
    }
    var m = /^#r=(.+)$/.exec(location.hash || '');
    if (!m) return;
    var pts = m[1].split(';').map(function (s) {
      var a = s.split(',');
      if (a.length !== 2) return null;
      var x = parseInt(a[0], 10), z = parseInt(a[1], 10);
      if (isNaN(x) || isNaN(z)) return null;
      var near = pins.filter(function (p) { return p.x === x && p.z === z; })[0];
      return { x: x, z: z, label: near ? near.title : (x + ' ' + z) };
    }).filter(Boolean);
    if (pts.length < 2) return;
    stops = pts.slice(0, 6);
    openDir();
    drawRoute(true);
    clearHash();
  }

  /* ---------- kayttoliittyman kytkennat ---------- */
  var q = $('kn-q');
  q.addEventListener('input', function () {
    $('kn-qx').hidden = !q.value;
    renderSug(search(q.value), q.value ? 'Ei osumia' : '');
  });
  q.addEventListener('focus', function () {
    if (q.value.trim()) { renderSug(search(q.value)); return; }
    var r = recents().map(function (o) { o.recent = true; return o; });
    renderSug(r);
  });
  q.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var items = search(q.value);
    if (items.length) pickItem(items[0]);
  });
  $('kn-qx').onclick = function () {
    q.value = ''; this.hidden = true; $('kn-sug').hidden = true; closePlace(); q.focus();
  };
  $('kn-dirbtn').onclick = function () { dirMode ? closeDir() : openDir(); };
  $('kn-dirx').onclick = closeDir;
  $('kn-add').onclick = function () {
    if (stops.length >= 6) return;
    stops.splice(stops.length - 1, 0, null);
    renderStops();
  };
  $('kn-swap').onclick = function () {
    stops.reverse();
    renderStops(); drawRoute(true); writeHash();
  };
  $('kn-clear').onclick = function () {
    stops = [null, null]; renderStops(); drawRoute(false); writeHash();
  };
  $('kn-copy').onclick = function () {
    var b = this, url = routeUrl();
    var done = function () { b.textContent = 'Kopioitu!'; setTimeout(function () { b.textContent = 'Kopioi linkki'; }, 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, done); else done();
  };

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.kn-search') && !e.target.closest('#kn-sug')) {
      $('kn-sug').hidden = true;
      placeCollapseBtn();
    }
    if (!e.target.closest('.kn-stop')) document.querySelectorAll('.kn-stopsug').forEach(function (x) { x.remove(); });
    if (!e.target.closest('.kn-layers')) $('kn-layers-menu').hidden = true;
  });

  /* Tasot-nappi nayttaa seuraavan karttatason esikatselukuvan, kuten
     karttapalveluissa: paivakartalla kuvana on yokartta. */
  (function initThumbs() {
    document.querySelectorAll('#kn-layers-menu img[data-thumb]').forEach(function (img) {
      img.src = MAPS + MAP_INFO[img.dataset.thumb].thumb;
    });
  })();
  function updateBaseBtn() {
    /* Napin taustakuvana on nykyisen kartan tiili, mutta teksti on aina
       "Tasot" tasosymbolin kanssa — kuten karttapalveluissa. */
    var img = $('kn-base-img');
    if (img) img.src = MAPS + MAP_INFO[curMap].thumb;
  }

  /* Koordinaattiruudukko: 128 lohkon valein, piirretaan vektoritasona. */
  function buildGrid() {
    if (!map) return;
    if (gridLayer) { map.removeLayer(gridLayer); gridLayer = null; }
    if (!optGrid) return;
    var src = new ol.source.Vector();
    var step = 128, lim = 4000;
    for (var v = -lim; v <= lim; v += step) {
      src.addFeature(new ol.Feature({ geometry: new ol.geom.LineString([toView(v, -lim), toView(v, lim)]) }));
      src.addFeature(new ol.Feature({ geometry: new ol.geom.LineString([toView(-lim, v), toView(lim, v)]) }));
    }
    gridLayer = new ol.layer.Vector({
      source: src, zIndex: 1,
      style: new ol.style.Style({ stroke: new ol.style.Stroke({ color: 'rgba(255,255,255,.18)', width: 1 }) })
    });
    map.addLayer(gridLayer);
  }

  /* Kartan tiedot -valinnat Tasot-valikossa. */
  function bindOpt(id, set) {
    var el = $(id);
    if (!el) return;
    el.onchange = function () { set(el.checked); };
  }
  bindOpt('kn-opt-pins',  function (v) { optPins = v; drawPins(); });
  bindOpt('kn-opt-names', function (v) { optNames = v; if (pinLayer) pinLayer.changed(); });
  bindOpt('kn-opt-nav',   function (v) { showNav = v; drawPins(); renderChips(); });
  bindOpt('kn-opt-grid',  function (v) { optGrid = v; buildGrid(); });

  /* Tasot-valikko */
  $('kn-layers-btn').onclick = function (e) {
    e.stopPropagation();
    var m = $('kn-layers-menu');
    m.hidden = !m.hidden;
    if (m.hidden) return;
    /* Valikko pidetaan kartan sisalla myos kun nappi on lahella reunaa. */
    m.style.transform = '';
    var mr = m.getBoundingClientRect();
    var er = app.getBoundingClientRect();
    var over = mr.right - (er.right - 12);
    if (over > 0) m.style.transform = 'translateX(' + (-Math.round(over)) + 'px)';
  };
  /* zoom */
  $('kn-zin').onclick  = function () { view.animate({ zoom: view.getZoom() + 1, duration: 220 }); };
  $('kn-zout').onclick = function () { view.animate({ zoom: view.getZoom() - 1, duration: 220 }); };

  /* --- navigointitila ---------------------------------------------
     Reitin voi aloittaa vasta kun kaikki pysahdykset on valittu. Sen
     jalkeen alareunaan tulee karttapalveluiden tapainen palkki, jossa
     on kulkutapa, kokonaisaika, matka ja arvioitu perillaoloaika — ja
     vasta silloin paneelin voi piilottaa sivuun. */
  function fmtClock(d) {
    return ('0' + d.getHours()).slice(-2) + '.' + ('0' + d.getMinutes()).slice(-2);
  }
  function mmss(sec) {
    sec = Math.max(0, Math.round(sec));
    var m = Math.floor(sec / 60), ss = sec % 60;
    if (m >= 60) return Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
    return m + ':' + ('0' + ss).slice(-2);
  }

  var navStart = 0, navTimer = null, navTotalSec = 0, autoEndCancelled = false;

  /* Navigointinakyma korvaa reittipaneelin kokonaan: reitti pystyviivana,
     jokainen osuus omana vaiheenaan matkoineen, kestoineen ja arvioituine
     saapumisaikoineen, seka laskuri perillaoloon. */
  function renderNav() {
    var box = $('kn-nav');
    var r = legs();
    if (!navigating || !r) { box.hidden = true; return; }
    var m = curMode();
    navTotalSec = r.total / m.v;
    var eta = new Date(navStart + navTotalSec * 1000);

    var t = navStart;
    var stepHtml = r.legs.map(function (l, i) {
      var sec = l.d / m.v;
      t += sec * 1000;
      return '<li class="kn-step">' +
        '<span class="kn-step__dot"></span>' +
        '<span class="kn-step__txt">' +
          '<strong>' + esc(l.from.label) + ' &rarr; ' + esc(l.to.label) + '</strong>' +
          '<em>' + nf(l.d) + ' m · ' + dur(sec) + '</em>' +
        '</span>' +
        '<span class="kn-step__eta">' + fmtClock(new Date(t)) + '</span>' +
      '</li>';
    }).join('');

    box.innerHTML =
      '<div class="kn-nav__head">' +
        '<span class="kn-nav__ico">' + m.ico + '</span>' +
        '<span class="kn-nav__title">' +
          '<strong>' + esc(r.pts[r.pts.length - 1].label) + '</strong>' +
          '<em>' + esc(m.name) + ' · ' + nf(r.total) + ' m</em>' +
        '</span>' +
        '<button type="button" class="kn-nav__x" id="kn-nav-x" title="Lopeta navigointi">&#10005;</button>' +
      '</div>' +

      '<div class="kn-count">' +
        '<div class="kn-count__big" id="kn-count">' + mmss(navTotalSec) + '</div>' +
        '<div class="kn-count__sub">jäljellä · perillä noin <strong>' + fmtClock(eta) + '</strong></div>' +
        '<div class="kn-count__bar"><span id="kn-count-bar"></span></div>' +
      '</div>' +

      '<ol class="kn-steps">' +
        '<li class="kn-step kn-step--start">' +
          '<span class="kn-step__dot"></span>' +
          '<span class="kn-step__txt"><strong>' + esc(r.pts[0].label) + '</strong>' +
          '<em>lähtö · ' + fmtClock(new Date(navStart)) + '</em></span>' +
        '</li>' + stepHtml +
      '</ol>' +

      '<div class="kn-nav__modes" id="kn-nav-modes">' + MODES.map(function (o) {
        return '<button type="button" class="kn-mode' + (o.id === m.id ? ' is-on' : '') + '" data-m="' + o.id + '">' +
          '<span class="kn-mode__ico">' + o.ico + '</span>' +
          '<span class="kn-mode__t">' + dur(r.total / o.v) + '</span></button>';
      }).join('') + '</div>' +

      '<p class="kn-nav__note">' + esc(m.note) + ' Arviot ovat linnuntietä eivätkä huomioi maastoa.</p>' +

      '<div class="kn-nav__foot">' +
        '<button type="button" class="kn-link" id="kn-nav-copy">Kopioi linkki</button>' +
        '<button type="button" class="kn-link kn-link--danger" id="kn-nav-stop">Lopeta navigointi</button>' +
      '</div>';

    box.hidden = false;

    /* Napista lopetus on tahallinen toimenpide, joten sita ei varmisteta
       — vahvistus kysytaan vain Esc-nappaimelta. */
    $('kn-nav-x').onclick = stopNav;
    $('kn-nav-stop').onclick = stopNav;
    $('kn-nav-copy').onclick = function () {
      var b = this, url = routeUrl();
      var done = function () { b.textContent = 'Kopioitu!'; setTimeout(function () { b.textContent = 'Kopioi linkki'; }, 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, done); else done();
    };
    box.querySelectorAll('.kn-nav__modes .kn-mode').forEach(function (b) {
      b.onclick = function () {
        localStorage.setItem(LS_MODE, b.dataset.m);
        navStart = Date.now();           // uusi kulkutapa = uusi arvio
        renderNav(); renderRouteInfo(legs());
      };
    });
  }

  function tickNav() {
    if (!navigating) return;
    var left = navTotalSec - (Date.now() - navStart) / 1000;

    var elBig = $('kn-count'), bar = $('kn-count-bar');
    if (!elBig) return;
    elBig.textContent = left > 0 ? mmss(left) : 'Perillä';
    elBig.classList.toggle('is-done', left <= 0);
    if (bar) bar.style.width = Math.min(100, Math.max(0, (1 - left / navTotalSec) * 100)) + '%';

    /* Perilla: navigointi paattyy itsestaan ja reitin suunnittelu
       aukeaa takaisin. */
    if (left <= 0) {
      var over = -left;
      var sub = document.querySelector('.kn-count__sub');
      if (sub && !autoEndCancelled) {
        sub.innerHTML = 'perillä · navigointi päättyy ' + Math.max(0, Math.ceil(15 - over)) + ' s kuluttua ' +
          '<button type="button" class="kn-link" id="kn-cancel-end">Jatka navigointia</button>';
        var cb = $('kn-cancel-end');
        if (cb) cb.onclick = function () {
          autoEndCancelled = true;
          var s2 = document.querySelector('.kn-count__sub');
          if (s2) s2.innerHTML = 'perillä · navigointi jatkuu kunnes lopetat sen';
        };
      }
      if (over >= 15 && !autoEndCancelled) { stopNav(); openDir(); }
    }
  }

  function startNav() {
    if (!legs() || !stops.every(function (st) { return !!st; })) return;
    navigating = true;
    navStart = Date.now();
    navDist = 0;
    autoEndCancelled = false;
    app.classList.add('is-nav');
    $('kn-dir').hidden = true;
    renderNav();
    clearInterval(navTimer);
    navTimer = setInterval(tickNav, 1000);
    if (!navRaf) navRaf = requestAnimationFrame(animArrow);
    placeCollapseBtn();
    drawRoute(true);
  }
  function stopNav() {
    navigating = false;
    navDist = 0;
    clearInterval(navTimer); navTimer = null;
    if (navRaf) { cancelAnimationFrame(navRaf); navRaf = null; }
    $('kn-confirm').hidden = true;
    $('kn-nav').hidden = true;
    app.classList.remove('is-nav');
    app.classList.remove('is-collapsed');
    if (dirMode) $('kn-dir').hidden = false;
    placeCollapseBtn();
    sizeSoon();
    setTimeout(function () { if (legs()) drawRoute(true); }, 120);
  }

  /* --- paneelin piilotus: kartta jaa kokonaan nakyviin ja reitti
     keskitetaan uudelleen vapautuneeseen tilaan --- */
  /* Paneeli on "auki" vasta kun jotain on oikeasti auki: ehdotuslista,
     kohteen tiedot, reittiohjeet tai navigointi. Pelkka hakupalkki ei
     ole paneeli, joten sivulle saavuttaessa kartta on kokonaan vapaa:
     piilotusnuoli ei nay ja Tasot-nappi on ruudun reunassa. */
  function panelOpen() {
    if (app.classList.contains('is-collapsed')) return false;
    return ['kn-sug', 'kn-place', 'kn-dir', 'kn-nav'].some(function (id) {
      var el = $(id);
      return el && !el.hidden;
    });
  }

  function placeCollapseBtn() {
    var rail = $('kn-rail');
    var btn = $('kn-collapse');
    var layers = $('kn-layers');
    var collapsed = app.classList.contains('is-collapsed');
    var open = panelOpen();

    /* Reunakahva nakyy vain kun paneelissa on jotain — tai kun paneeli on
       piilotettu, jotta sen saa takaisin. Kahva on paneelin sisalla,
       joten se keskittyy itsestaan paneelin korkeuteen. */
    if (rail) rail.hidden = !open && !collapsed;
    if (btn) {
      btn.innerHTML = collapsed ? '&#8250;' : '&#8249;';
      btn.title = collapsed ? 'Näytä paneeli' : 'Piilota paneeli';
    }
    var cl = $('kn-close');
    if (cl) cl.hidden = collapsed;    // suljettavaa ei ole kun paneeli on piilossa

    /* Tasot-nappi pysyy nurkassa, ja siirtyy sivuun vasta jos paneeli
       oikeasti yltaa sen paalle. */
    if (!layers) return;
    layers.style.left = '12px';
    if (!open) return;
    var left = document.querySelector('.kn-left');
    if (!left) return;
    var lr = layers.getBoundingClientRect();
    var pr = left.getBoundingClientRect();
    var overlaps = pr.bottom > lr.top && pr.right > lr.left && pr.left < lr.right;
    if (!overlaps) return;
    var mapW = map ? map.getTargetElement().getBoundingClientRect().width : 0;
    if ((mapW - pr.width) > 260) layers.style.left = Math.round(pr.width) + 50 + 'px';
  }

  function toggleCollapse() {
    app.classList.toggle('is-collapsed');
    placeCollapseBtn();
    sizeSoon();
    /* Reitti sovitetaan uusiksi, jolloin se asettuu nyt koko ruudun
       keskelle (tai paneelin viereen kun paneeli palaa). */
    setTimeout(function () { if (legs()) drawRoute(true); }, 120);
  }
  $('kn-collapse').onclick = toggleCollapse;
  /* Ruksi vie takaisin KasaNavin perusnakymaan: sulkee navigoinnin,
     reittiohjeet, kohteen tiedot ja ehdotukset. */
  $('kn-close').onclick = function () {
    app.classList.remove('is-collapsed');
    if (navigating) stopNav();
    closeDir();
    closePlace();
    $('kn-sug').hidden = true;
    var q = $('kn-q');
    if (q) { q.value = ''; $('kn-qx').hidden = true; }
    placeCollapseBtn();
    sizeSoon();
    setTimeout(function () { if (legs()) drawRoute(true); }, 120);
  };
  window.addEventListener('resize', placeCollapseBtn);

  /* kokonaytto */
  function sizeSoon() {
    if (!map) return;
    map.updateSize();
    requestAnimationFrame(function () { map.updateSize(); });
    setTimeout(function () { map.updateSize(); }, 320);
  }
  /* KasaNavi on aina koko naytön nakyma — erillista pienempaa ikkunaa
     ei enaa ole, joten tilaa ei tarvitse vaihdella. */
  function sizeSoon() {
    if (!map) return;
    map.updateSize();
    requestAnimationFrame(function () { map.updateSize(); });
    setTimeout(function () { map.updateSize(); }, 320);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !$('kn-confirm').hidden) { e.preventDefault(); closeAsk(); return; }
    if (e.key !== 'Escape') return;
    if (!$('kn-confirm').hidden) { closeAsk(); stopNav(); return; }
    if (picking !== null) { setPicking(null); return; }
    if (!$('kn-place').hidden) { closePlace(); return; }
    if (navigating) {
      /* Ensin Esc piilottaa paneelin, ja vasta piilotettuna se kysyy
         lopetetaanko navigointi. */
      if (!app.classList.contains('is-collapsed')) { toggleCollapse(); return; }
      askStop();
      return;
    }
    /* Valitut kohteet tyhjentyvat ja navigointi loppuu ennen kuin Esc
       sulkee koko naytön nakyman. */
    if (stops.some(function (st) { return !!st; })) {
      stops = [null, null];
      renderStops(); drawRoute(false);
      return;
    }
    if (dirMode) { closeDir(); return; }
  });
  window.addEventListener('resize', sizeSoon);

  /* ---------- kaynnistys ---------- */
  renderStops();
  renderRouteInfo(null);
  placeCollapseBtn();
  setInterval(placeCollapseBtn, 800);    // paneelin leveys elaa sisallon mukana

  loadMeta('5k').then(function (meta) {
    buildMap(meta);
    return loadPins();
  }).then(function (rows) {
    pins = (rows || []).filter(function (p) { return typeof p.x === 'number' && typeof p.z === 'number'; });
    renderChips();
    drawPins();
    readHash();
  }).catch(function (err) {
    $('n2-map').innerHTML = '<div class="kn-err">Karttaa ei saatu ladattua. ' + esc((err && err.message) || '') + '</div>';
  });
})();
