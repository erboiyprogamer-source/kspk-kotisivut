/* =====================================================================
   K-S-P-K — reitti.js — reittihaku ("navigointipalvelu")
   ---------------------------------------------------------------------
   Rakentaa OMAN OpenLayers-karttansa suoraan uNmINeD-tiilista (karttarepo
   kspk-kartat) — EI iframea eika uNmINeDin omaa index.html:aa, jotta
   kayttoliittyma on taysin oma. Tiilijarjestelma, projektio ja
   resoluutiot on toteutettu samalla kaavalla kuin uNmINeDin omassa
   unmined.js:ssa, muuten tiilet eivat osuisi oikeille paikoille.

   Vaihe 1: linnuntie (suora viiva) + matka-aika kulkutavoittain.
   Myohempi vaihe (jos tehdaan): piirretty tieverkko + A*-reititys.
   ===================================================================== */
(function () {
  'use strict';

  var root = document.getElementById('nav2');
  if (!root || typeof ol === 'undefined') return;

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
    { id: 'walk',   ico: '&#128694;', name: 'Kävely',            v: 4.317, note: 'Perusnopeus maalla.' },
    { id: 'sprint', ico: '&#127939;', name: 'Juoksu',            v: 5.612, note: 'Vaatii ruokaa; juoksuhyppely yltää ~7,1 lohkoon/s.' },
    { id: 'swim',   ico: '&#127946;', name: 'Uinti',             v: 2.2,   note: 'Delfiinin suosio tai Depth Strider nopeuttaa selvästi.' },
    { id: 'boat',   ico: '&#128676;', name: 'Vene vedellä',      v: 8.0,   note: 'Sinisellä jäällä kulkeva venerata yltää noin 70 lohkoon/s.' },
    { id: 'horse',  ico: '&#128014;', name: 'Hevonen',           v: 9.0,   note: 'Hevoset vaihtelevat ~4,8–14,5 lohkoa/s; tässä keskitasoinen.' },
    { id: 'elytra', ico: '&#128640;', name: 'Elytra + raketit',  v: 30,    note: 'Lentää suoraan maaston yli, joten tämä arvio on tarkin.' }
  ];
  var LS_MODE = 'kspk.reitti.mode';

  /* ---------- pienet apurit ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nf(n, d) {
    return Number(n).toLocaleString('fi-FI', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  }
  function dur(sec) {
    if (!isFinite(sec)) return '–';
    sec = Math.round(sec);
    if (sec < 60) return sec + ' s';
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h) return h + ' h ' + m + ' min';
    return m + ' min ' + (s ? s + ' s' : '').trim();
  }

  /* ---------- koordinaattimuunnos (uNmINeDin kaava) ----------
     OpenLayersin Y kasvaa ylospain, Minecraftin Z alaspain. */
  function toView(x, z) { return [x / BPD, -z / BPD]; }
  function toBlock(c)   { return [Math.round(c[0] * BPD), Math.round(-c[1] * BPD)]; }

  /* ---------- uNmINeDin RegionMap: onko tiilta olemassa ----------
     Ilman tata selain pyytaisi satoja olemattomia tiilia (404). */
  function RegionMap(regions, worldMinX, worldMinZ, worldWidth, worldHeight) {
    this.r = regions; this.minX = worldMinX; this.minZ = worldMinZ;
    this.w = worldWidth; this.h = worldHeight;
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
        var gx = Math.floor(x / 32), gz = Math.floor(z / 32);
        var g = null;
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
        return {
          base: base,
          props: JSON.parse(JSON.stringify({
            minZoom: UnminedMapProperties.minZoom, maxZoom: UnminedMapProperties.maxZoom,
            imageFormat: UnminedMapProperties.imageFormat,
            minRegionX: UnminedMapProperties.minRegionX, minRegionZ: UnminedMapProperties.minRegionZ,
            maxRegionX: UnminedMapProperties.maxRegionX, maxRegionZ: UnminedMapProperties.maxRegionZ,
            centerX: UnminedMapProperties.centerX, centerZ: UnminedMapProperties.centerZ
          })),
          regions: UnminedRegions.map(function (e) { return { x: e.x, z: e.z, m: e.m }; })
        };
      });
  }

  /* ---------- kartta ---------- */
  var map = null, tileLayer = null, routeLayer = null, pinLayer = null, view = null, pendingView = null;
  var pins = [], picking = null;
  var pt = { a: null, b: null };   // {x, z, label}

  function buildMap(meta) {
    var o = meta.props;
    var minX = o.minRegionX * 512, minZ = o.minRegionZ * 512;
    var w = (o.maxRegionX + 1 - o.minRegionX) * 512;
    var h = (o.maxRegionZ + 1 - o.minRegionZ) * 512;
    var rm = new RegionMap(meta.regions, minX, minZ, w, h);
    var dpi = window.devicePixelRatio || 1;

    var viewProj = new ol.proj.Projection({
      code: 'KSPK-VIEW', units: 'degrees',
      extent: [-270, -270, 270, 270], worldExtent: [-270, -270, 270, 270], global: true
    });

    var tl = toView(minX, minZ), br = toView(minX + w, minZ + h);
    var extent = [Math.min(tl[0], br[0]), Math.min(tl[1], br[1]), Math.max(tl[0], br[0]), Math.max(tl[1], br[1])];

    var levels = o.maxZoom - o.minZoom;
    var res = [];
    for (var z = 0; z <= levels; z++) res[z] = (Math.pow(2, levels - z - o.maxZoom) / BPD) * dpi;

    var grid = new ol.tilegrid.TileGrid({
      extent: extent, origin: [0, 0], resolutions: res, tileSize: TILE / dpi
    });

    var src = new ol.source.XYZ({
      projection: viewProj, tileGrid: grid, tilePixelRatio: dpi, tileSize: TILE / dpi,
      tileUrlFunction: function (c) {
        var tx = c[1], ty = c[2], wz = -(levels - c[0]) + o.maxZoom;
        if (!rm.hasTile(tx, ty, wz)) return undefined;
        return meta.base + 'tiles/zoom.' + wz + '/' + Math.floor(tx / 10) + '/' + Math.floor(ty / 10) +
               '/tile.' + tx + '.' + ty + '.' + o.imageFormat;
      }
    });

    /* Kartan vaihdossa koko kartta rakennetaan uudelleen: paiva- ja
       yokartalla voi olla eri aluerajat ja eri zoom-tasot, joten pelkka
       tiililahteen vaihto jattaisi nakyman vaarille rajoille. */
    if (map) {
      var keep = view.getCenter(), keepZ = view.getZoom();
      map.setTarget(null); map.dispose && map.dispose(); map = null;
      pendingView = { center: keep, zoom: keepZ };
    }

    tileLayer = new ol.layer.Tile({ source: src });
    pinLayer = new ol.layer.Vector({ source: new ol.source.Vector(), style: pinStyle });
    routeLayer = new ol.layer.Vector({ source: new ol.source.Vector(), style: routeStyle });

    view = new ol.View({
      center: toView(o.centerX, o.centerZ), extent: extent, projection: viewProj,
      resolutions: res, maxZoom: levels, zoom: Math.max(0, levels - o.maxZoom),
      constrainResolution: true, showFullExtent: true, constrainOnlyCenter: true, enableRotation: false
    });

    map = new ol.Map({
      target: 'n2-map',
      controls: ol.control.defaults.defaults({ attribution: false, rotate: false }),
      layers: [tileLayer, routeLayer, pinLayer],
      view: view
    });

    if (pendingView) {
      try { view.setCenter(pendingView.center); view.setZoom(pendingView.zoom); } catch (e) {}
      pendingView = null;
      drawPins(); update(false);
    }

    map.on('pointermove', function (e) {
      var b = toBlock(e.coordinate);
      $('n2-coord').textContent = 'X ' + b[0] + ', Z ' + b[1];
    });
    map.on('singleclick', function (e) {
      var b = toBlock(e.coordinate);
      if (picking) { setPoint(picking, { x: b[0], z: b[1], label: b[0] + ' ' + b[1] }); setPicking(null); return; }
      var hit = map.forEachFeatureAtPixel(e.pixel, function (f) { return f.get('pin') ? f.get('pin') : null; }, { hitTolerance: 6 });
      if (hit) {
        var slot = pt.a ? (pt.b ? 'a' : 'b') : 'a';
        setPoint(slot, { x: hit.x, z: hit.z, label: hit.title });
      }
    });
  }

  /* ---------- tyylit ---------- */
  function pinStyle(f) {
    var p = f.get('pin'), r = f.get('end') ? 8 : 4.5;
    return new ol.style.Style({
      image: new ol.style.Circle({
        radius: r,
        fill: new ol.style.Fill({ color: f.get('end') ? (f.get('end') === 'a' ? '#3ef08a' : '#ffc94d') : (p.color || '#3ef08a') }),
        stroke: new ol.style.Stroke({ color: '#000', width: f.get('end') ? 2.5 : 1.5 })
      }),
      text: f.get('end') ? new ol.style.Text({
        text: f.get('label') || '', offsetY: -16, font: '600 13px Outfit, sans-serif',
        fill: new ol.style.Fill({ color: '#e9f7ef' }),
        stroke: new ol.style.Stroke({ color: '#000', width: 3.5 })
      }) : null
    });
  }
  function routeStyle(f) {
    if (f.getGeometry().getType() === 'Point') return pinStyle(f);
    return [
      new ol.style.Style({ stroke: new ol.style.Stroke({ color: 'rgba(0,0,0,.65)', width: 7 }) }),
      new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#3ef08a', width: 3, lineDash: [10, 8] }) })
    ];
  }

  /* ---------- merkit Supabasesta ---------- */
  function loadPins() {
    return fetch(SUPA.url + '/rest/v1/pins?select=id,title,x,z,author,color,symbol&order=created_at.desc', {
      headers: { apikey: SUPA.key, Authorization: 'Bearer ' + SUPA.key }
    }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; });
  }
  function drawPins() {
    var s = pinLayer.getSource(); s.clear();
    pins.forEach(function (p) {
      var f = new ol.Feature({ geometry: new ol.geom.Point(toView(p.x, p.z)) });
      f.set('pin', p); s.addFeature(f);
    });
  }

  /* ---------- pisteen asetus ja haku ---------- */
  function parseCoords(str) {
    var n = String(str).match(/-?\d+(?:[.,]\d+)?/g);
    if (!n || n.length < 2) return null;
    var v = n.map(function (x) { return Math.round(parseFloat(x.replace(',', '.'))); });
    // kolme lukua = F3-rivi (X Y Z) -> korkeus jatetaan pois
    return v.length >= 3 ? { x: v[0], z: v[2] } : { x: v[0], z: v[1] };
  }
  function setPoint(slot, p) {
    pt[slot] = p;
    $('n2-' + slot).value = p ? p.label : '';
    update();
  }
  function setPicking(slot) {
    picking = slot;
    $('n2-hint').hidden = !slot;
    document.querySelectorAll('.nav2__pick').forEach(function (b) {
      b.classList.toggle('is-on', !!slot && b.dataset.pick === slot);
    });
    if (map) map.getTargetElement().style.cursor = slot ? 'crosshair' : '';
  }

  function suggest(slot) {
    var q = $('n2-' + slot).value.trim().toLowerCase();
    var box = $('n2-sug-' + slot);
    if (!q) { box.hidden = true; return; }
    var out = [];
    var c = parseCoords(q);
    if (c) out.push({ x: c.x, z: c.z, label: c.x + ' ' + c.z, sub: 'Koordinaatit' });
    pins.filter(function (p) {
      return String(p.title || '').toLowerCase().indexOf(q) > -1 ||
             String(p.author || '').toLowerCase().indexOf(q) > -1;
    }).slice(0, 8).forEach(function (p) {
      out.push({ x: p.x, z: p.z, label: p.title, sub: (p.author || 'Nimetön') + ' · X ' + p.x + ', Z ' + p.z, color: p.color });
    });
    if (!out.length) { box.innerHTML = '<div class="nav2__sug-empty">Ei osumia</div>'; box.hidden = false; return; }
    box.innerHTML = out.map(function (o, i) {
      return '<button type="button" class="nav2__sug-i" data-i="' + i + '">' +
        '<span class="nav2__sug-dot" style="background:' + esc(o.color || '#5ad1ff') + '"></span>' +
        '<span><strong>' + esc(o.label) + '</strong><em>' + esc(o.sub) + '</em></span></button>';
    }).join('');
    box.hidden = false;
    box.querySelectorAll('.nav2__sug-i').forEach(function (b) {
      b.addEventListener('click', function () {
        var o = out[+b.dataset.i];
        setPoint(slot, { x: o.x, z: o.z, label: o.label });
        box.hidden = true;
      });
    });
  }

  /* ---------- reitin laskenta ja piirto ---------- */
  function update(fit) {
    if (fit === undefined) fit = true;
    var s = routeLayer.getSource(); s.clear();
    ['a', 'b'].forEach(function (k) {
      if (!pt[k]) return;
      var f = new ol.Feature({ geometry: new ol.geom.Point(toView(pt[k].x, pt[k].z)) });
      f.set('end', k); f.set('label', pt[k].label); f.set('pin', {}); s.addFeature(f);
    });

    var out = $('n2-out');
    if (!pt.a || !pt.b) { out.hidden = true; writeHash(); return; }

    s.addFeature(new ol.Feature({
      geometry: new ol.geom.LineString([toView(pt.a.x, pt.a.z), toView(pt.b.x, pt.b.z)])
    }));

    var dx = pt.b.x - pt.a.x, dz = pt.b.z - pt.a.z;
    var d = Math.sqrt(dx * dx + dz * dz);
    var sel = localStorage.getItem(LS_MODE) || 'walk';

    out.innerHTML =
      '<div class="nav2__sum">' +
        '<div><span>Matka linnuntietä</span><strong>' + nf(d) + ' m</strong>' +
          '<em>' + nf(Math.abs(dx)) + ' m itä–länsi, ' + nf(Math.abs(dz)) + ' m pohjois–etelä</em></div>' +
        '<div><span>Netherin kautta</span><strong>' + nf(d / 8) + ' m</strong>' +
          '<em>1:8 — vaatii portaalin molemmissa päissä</em></div>' +
      '</div>' +
      '<div class="nav2__modes">' + MODES.map(function (m) {
        return '<button type="button" class="nav2__mode' + (m.id === sel ? ' is-on' : '') + '" data-mode="' + m.id + '">' +
          '<span class="nav2__mode-ico">' + m.ico + '</span>' +
          '<span class="nav2__mode-n">' + esc(m.name) + '</span>' +
          '<span class="nav2__mode-t">' + dur(d / m.v) + '</span>' +
          '<span class="nav2__mode-v">' + String(m.v).replace('.', ',') + ' m/s</span>' +
          '<span class="nav2__mode-s">Netherin kautta ' + dur(d / 8 / m.v) + '</span>' +
        '</button>';
      }).join('') + '</div>' +
      '<p class="nav2__modenote">' + esc((MODES.filter(function (m) { return m.id === sel; })[0] || MODES[0]).note) + '</p>';
    out.hidden = false;

    out.querySelectorAll('.nav2__mode').forEach(function (b) {
      b.addEventListener('click', function () { localStorage.setItem(LS_MODE, b.dataset.mode); update(false); });
    });

    writeHash();
    if (fit) fitRoute();
  }

  function fitRoute() {
    if (!pt.a || !pt.b) return;
    var e = ol.extent.boundingExtent([toView(pt.a.x, pt.a.z), toView(pt.b.x, pt.b.z)]);
    view.fit(ol.extent.buffer(e, Math.max(ol.extent.getWidth(e), ol.extent.getHeight(e)) * 0.35 || 1 / BPD * 200),
      { size: map.getSize(), duration: 400, maxZoom: view.getMaxZoom() });
  }

  /* ---------- jaettava linkki ---------- */
  function writeHash() {
    var h = '';
    if (pt.a && pt.b) h = '#r=' + pt.a.x + ',' + pt.a.z + ';' + pt.b.x + ',' + pt.b.z;
    if (location.hash !== h) history.replaceState(null, '', location.pathname + location.search + h);
  }
  function readHash() {
    var m = /^#r=(-?\d+),(-?\d+);(-?\d+),(-?\d+)$/.exec(location.hash || '');
    if (!m) return;
    setPoint('a', { x: +m[1], z: +m[2], label: m[1] + ' ' + m[2] });
    setPoint('b', { x: +m[3], z: +m[4], label: m[3] + ' ' + m[4] });
  }

  /* ---------- kayttoliittyman kytkennat ---------- */
  ['a', 'b'].forEach(function (slot) {
    var i = $('n2-' + slot);
    i.addEventListener('input', function () { suggest(slot); });
    i.addEventListener('focus', function () { suggest(slot); });
    i.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var c = parseCoords(i.value);
      var hit = pins.filter(function (p) { return String(p.title || '').toLowerCase() === i.value.trim().toLowerCase(); })[0];
      if (hit) setPoint(slot, { x: hit.x, z: hit.z, label: hit.title });
      else if (c) setPoint(slot, { x: c.x, z: c.z, label: c.x + ' ' + c.z });
      $('n2-sug-' + slot).hidden = true;
    });
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.nav2__field')) document.querySelectorAll('.nav2__sug').forEach(function (b) { b.hidden = true; });
  });
  document.querySelectorAll('.nav2__pick').forEach(function (b) {
    b.addEventListener('click', function () { setPicking(picking === b.dataset.pick ? null : b.dataset.pick); });
  });
  $('n2-swap').addEventListener('click', function () {
    var t = pt.a; pt.a = pt.b; pt.b = t;
    $('n2-a').value = pt.a ? pt.a.label : ''; $('n2-b').value = pt.b ? pt.b.label : '';
    update();
  });
  $('n2-clear').addEventListener('click', function () {
    pt.a = pt.b = null; $('n2-a').value = ''; $('n2-b').value = ''; setPicking(null); update();
  });
  $('n2-share').addEventListener('click', function () {
    var btn = this;
    writeHash();
    var url = location.href;
    var done = function () { btn.textContent = 'Kopioitu!'; setTimeout(function () { btn.textContent = 'Kopioi linkki'; }, 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, done); else done();
  });
  document.querySelectorAll('.nav2__map').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.nav2__map').forEach(function (x) { x.classList.remove('is-on'); });
      b.classList.add('is-on');
      loadMeta(b.dataset.map).then(buildMap).catch(function () {});
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (picking) { setPicking(null); return; }
    knClose();
  });

  /* ---------- KasaNavigointi: koko naytön navigointinakyma ----------
     Ei omaa karttaa eika omaa logiikkaa: samat DOM-elementit (paneeli,
     karttalaatikko ja tulokset) siirretaan koko naytön kehykseen ja
     takaisin, jolloin haku, reitti ja kuuntelijat sailyvat sellaisenaan.
     Paikat merkitaan kommenttisolmuilla, jotta ne palautuvat tasmalleen
     omille paikoilleen sivulla. */
  var knBox = null, knMarks = [];

  function knMove(node, into) {
    var ph = document.createComment('kspk-kn');
    node.parentNode.insertBefore(ph, node);
    knMarks.push({ node: node, ph: ph });
    into.appendChild(node);
  }
  function knRestore() {
    knMarks.forEach(function (m) {
      if (m.ph.parentNode) m.ph.parentNode.insertBefore(m.node, m.ph);
      if (m.ph.parentNode) m.ph.parentNode.removeChild(m.ph);
    });
    knMarks = [];
  }
  function knSize() {
    if (!map) return;
    map.updateSize();
    requestAnimationFrame(function () { map.updateSize(); });
    setTimeout(function () { map.updateSize(); if (pt.a && pt.b) fitRoute(); }, 320);
  }

  function knOpen() {
    if (knBox) return;
    knBox = document.createElement('div');
    knBox.className = 'kn';
    knBox.innerHTML =
      '<div class="kn__map" id="kn-mapslot"></div>' +
      '<div class="kn__ui">' +
        '<div class="kn__bar">' +
          '<span class="kn__brand">&#129517; KasaNavigointi</span>' +
          '<span class="kn__beta">beta</span>' +
          '<button type="button" class="kn__close" id="kn-close" title="Sulje (Esc)">&#10005;</button>' +
        '</div>' +
        '<div class="kn__panel" id="kn-panelslot"></div>' +
        '<div class="kn__outwrap" id="kn-outslot"></div>' +
      '</div>';
    document.body.appendChild(knBox);
    knMove(document.querySelector('.nav2__mapwrap'), knBox.querySelector('#kn-mapslot'));
    knMove(document.querySelector('.nav2__panel'),   knBox.querySelector('#kn-panelslot'));
    knMove($('n2-out'),                          knBox.querySelector('#kn-outslot'));
    document.body.classList.add('kn-on');

    /* Koko naytön nakymassa kaytetaan suurta karttaa, kuten napin
       kuvauksessa luvataan. Vaihto rakentaa kartan uudelleen, joten
       koko paivitetaan vasta sen jalkeen. */
    /* Paneeli on jo siirretty kehykseen, joten nappi haetaan koko
       dokumentista eika rootin sisalta. */
    var big = document.querySelector('.nav2__map[data-map="5k"]');
    if (big && !big.classList.contains('is-on')) {
      big.click();
      setTimeout(knSize, 400);
    } else {
      knSize();
    }
    document.getElementById('kn-close').onclick = knClose;
  }

  function knClose() {
    if (!knBox) return;
    knRestore();
    knBox.parentNode.removeChild(knBox);
    knBox = null;
    document.body.classList.remove('kn-on');
    knSize();
  }

  var knBtn = document.getElementById('kn-open');
  if (knBtn) knBtn.onclick = knOpen;

  /* ---------- kaynnistys ---------- */
  loadMeta('paiva').then(function (meta) {
    buildMap(meta);
    return loadPins();
  }).then(function (rows) {
    pins = (rows || []).filter(function (p) { return typeof p.x === 'number' && typeof p.z === 'number'; });
    drawPins();
    readHash();
  }).catch(function (err) {
    $('n2-map').innerHTML = '<div class="nav2__err">Karttaa ei saatu ladattua. ' + esc(err && err.message || '') + '</div>';
  });
})();
