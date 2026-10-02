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
    { id: 'boat',   ico: '&#128676;', name: 'Vene',     v: 8.0,   note: 'Vettä pitkin. Sinisellä jäällä kulkeva venerata yltää noin 70 lohkoon/s.' },
    { id: 'swim',   ico: '&#127946;', name: 'Uinti',    v: 2.2,   note: 'Delfiinin suosio tai Depth Strider nopeuttaa selvästi.' },
    { id: 'elytra', ico: '&#128640;', name: 'Elytra',   v: 30,    note: 'Raketeilla, suoraan maaston yli — tämä arvio on tarkin.' }
  ];

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
  var pins = [], picking = null, dirMode = false;
  var stops = [null, null];        // {x, z, label}
  var hideSymbols = {};            // kategoriasiruilla piilotetut
  var showNav = true;
  var selected = null;             // paikkakortissa nakyva merkki

  /* ---------- kartta ---------- */
  function buildMap(meta) {
    var o = meta.props;
    curMap = meta.name;
    var minX = o.minRegionX * 512, minZ = o.minRegionZ * 512;
    var w = (o.maxRegionX + 1 - o.minRegionX) * 512;
    var h = (o.maxRegionZ + 1 - o.minRegionZ) * 512;
    var rm = new RegionMap(meta.regions, minX, minZ, w, h);
    var dpi = window.devicePixelRatio || 1;

    var proj = new ol.proj.Projection({
      code: 'KSPK-VIEW', units: 'degrees',
      extent: [-270, -270, 270, 270], worldExtent: [-270, -270, 270, 270], global: true
    });

    var tl = toView(minX, minZ), br = toView(minX + w, minZ + h);
    var extent = [Math.min(tl[0], br[0]), Math.min(tl[1], br[1]), Math.max(tl[0], br[0]), Math.max(tl[1], br[1])];

    var levels = o.maxZoom - o.minZoom, res = [];
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

    map.on('pointermove', function (e) {
      var b = toBlock(e.coordinate);
      $('kn-coord').textContent = 'X ' + b[0] + ', Z ' + b[1];
      var hit = map.hasFeatureAtPixel(e.pixel, { hitTolerance: 6 });
      map.getTargetElement().style.cursor = picking ? 'crosshair' : (hit ? 'pointer' : '');
    });

    map.on('singleclick', function (e) {
      var b = toBlock(e.coordinate);
      if (picking !== null) {
        setStop(picking, { x: b[0], z: b[1], label: b[0] + ' ' + b[1] });
        setPicking(null);
        return;
      }
      var hit = map.forEachFeatureAtPixel(e.pixel, function (f) { return f.get('pin') || null; }, { hitTolerance: 6 });
      if (hit) { openPlace(hit); }
      else { closePlace(); }
    });
  }

  /* ---------- tyylit ---------- */
  function pinStyle(f) {
    var p = f.get('pin'), nav = p && p.is_nav && p.is_target === false;
    var sel = selected && p && selected.id === p.id;
    var r = nav ? 3.6 : 5;
    if (sel) r += 2.5;
    return new ol.style.Style({
      image: new ol.style.Circle({
        radius: r,
        fill: new ol.style.Fill({ color: p.color || '#3ef08a' }),
        stroke: new ol.style.Stroke({ color: sel ? '#fff' : '#000', width: sel ? 2.5 : 1.6 })
      }),
      text: sel ? new ol.style.Text({
        text: p.title || '', offsetY: -17, font: '600 13px Outfit, sans-serif',
        fill: new ol.style.Fill({ color: '#e9f7ef' }),
        stroke: new ol.style.Stroke({ color: '#000', width: 3.5 })
      }) : null
    });
  }
  function stopStyle(i, total, label) {
    var isFirst = i === 0, isLast = i === total - 1;
    var col = isFirst ? '#3ef08a' : (isLast ? '#ffc94d' : '#5ad1ff');
    return new ol.style.Style({
      image: new ol.style.Circle({
        radius: 8, fill: new ol.style.Fill({ color: col }),
        stroke: new ol.style.Stroke({ color: '#06110b', width: 3 })
      }),
      text: new ol.style.Text({
        text: label || '', offsetY: -19, font: '600 13px Outfit, sans-serif',
        fill: new ol.style.Fill({ color: '#e9f7ef' }),
        stroke: new ol.style.Stroke({ color: '#000', width: 3.5 })
      })
    });
  }
  function routeStyle(f) {
    if (f.getGeometry().getType() === 'Point') return f.get('style');
    return [
      new ol.style.Style({ stroke: new ol.style.Stroke({ color: 'rgba(0,0,0,.7)', width: 8 }) }),
      new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#3ef08a', width: 4 }) })
    ];
  }

  /* ---------- merkit Supabasesta ---------- */
  function loadPins() {
    return fetch(SUPA.url + '/rest/v1/pins?select=id,title,message,x,z,author,color,symbol,is_nav,is_target&order=created_at.desc', {
      headers: { apikey: SUPA.key, Authorization: 'Bearer ' + SUPA.key }
    }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; });
  }
  function pinVisible(p) {
    if (hideSymbols[p.symbol || 'dot']) return false;
    if (!showNav && p.is_nav && p.is_target === false) return false;
    return true;
  }
  function drawPins() {
    if (!pinLayer) return;
    var s = pinLayer.getSource(); s.clear();
    pins.filter(pinVisible).forEach(function (p) {
      var f = new ol.Feature({ geometry: new ol.geom.Point(toView(p.x, p.z)) });
      f.set('pin', p); s.addFeature(f);
    });
  }

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
      sub: (SYMBOL_NAMES[p.symbol] || 'Merkki') + ' · ' + (p.author || 'Nimetön') + ' · X ' + p.x + ', Z ' + p.z
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
    box.innerHTML =
      '<button type="button" class="kn-place__x" id="kn-place-x" title="Sulje">&#10005;</button>' +
      '<h3><span class="kn-place__dot" style="background:' + esc(p.color || '#3ef08a') + '"></span>' + esc(p.title) + '</h3>' +
      '<p class="kn-place__meta">' +
        (p.symbol ? esc(SYMBOL_NAMES[p.symbol] || p.symbol) + ' · ' : '') +
        'X ' + p.x + ', Z ' + p.z +
        (p.author ? ' · ' + esc(p.author) : '') +
        (p.is_nav && p.is_target === false ? ' · navigointipiste' : '') + '</p>' +
      (p.message ? '<p class="kn-place__msg">' + esc(p.message) + '</p>' : '') +
      '<div class="kn-acts">' +
        '<button type="button" class="kn-act kn-act--primary" data-a="to">' +
          '<span class="kn-act__ico">&#10174;</span><span class="kn-act__t">Reittiohjeet</span></button>' +
        '<button type="button" class="kn-act" data-a="from">' +
          '<span class="kn-act__ico">&#9679;</span><span class="kn-act__t">Lähtöpiste</span></button>' +
        '<button type="button" class="kn-act" data-a="copy">' +
          '<span class="kn-act__ico">&#128203;</span><span class="kn-act__t">Kopioi X Z</span></button>' +
        '<button type="button" class="kn-act" data-a="share">' +
          '<span class="kn-act__ico">&#128279;</span><span class="kn-act__t">Jaa</span></button>' +
      '</div>';
    box.hidden = false;
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
      var url = location.origin + location.pathname + '#p=' + p.x + ',' + p.z;
      copyText(url, this, 'Jaa');
    };
  }

  function copyText(txt, btn, orig) {
    var t = btn.querySelector('.kn-act__t') || btn;
    var done = function () { t.textContent = 'Kopioitu'; setTimeout(function () { t.textContent = orig; }, 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, done); else done();
  }

  /* Avaa reittiohjeet paikkakortista: toinen paa taytetaan ja kursori
     viedaan tyhjaan kenttaan, jonka ehdotuslista aukeaa heti. */
  function routeTo(item, which) {
    closePlace();
    openDir();
    if (which === 'start') { stops[0] = item; if (!stops[stops.length - 1]) stops[stops.length - 1] = null; }
    else { stops[stops.length - 1] = item; }
    renderStops();
    drawRoute(true);
    writeHash();
    var empty = stops.indexOf(null);
    if (empty > -1) {
      var inp = document.querySelector('.kn-stop__in[data-i="' + empty + '"]');
      if (inp) { inp.focus(); inp.dispatchEvent(new Event('focus')); }
    }
  }

  function closePlace() {
    selected = null; drawPins();
    $('kn-place').hidden = true;
  }

  /* ---------- kategoriasirut ---------- */
  function renderChips() {
    var counts = {}, navCount = 0;
    pins.forEach(function (p) {
      if (p.is_nav && p.is_target === false) { navCount++; return; }
      var s = p.symbol || 'dot';
      counts[s] = (counts[s] || 0) + 1;
    });
    var list = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    var html = list.map(function (s) {
      return '<button type="button" class="kn-chip' + (hideSymbols[s] ? '' : ' is-on') + '" data-sym="' + esc(s) + '">' +
        esc(SYMBOL_NAMES[s] || s) + ' <span>' + counts[s] + '</span></button>';
    }).join('');
    if (navCount) {
      html += '<button type="button" class="kn-chip kn-chip--nav' + (showNav ? ' is-on' : '') + '" data-nav="1">' +
        '&#129517; Navigointi <span>' + navCount + '</span></button>';
    }
    var box = $('kn-chips');
    box.innerHTML = html;
    box.querySelectorAll('[data-sym]').forEach(function (b) {
      b.onclick = function () {
        var s = b.dataset.sym;
        hideSymbols[s] = !hideSymbols[s];
        b.classList.toggle('is-on', !hideSymbols[s]);
        drawPins();
      };
    });
    var nb = box.querySelector('[data-nav]');
    if (nb) nb.onclick = function () { showNav = !showNav; nb.classList.toggle('is-on', showNav); drawPins(); };
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
  }
  function closeDir() {
    dirMode = false;
    $('kn-dir').hidden = true;
    $('kn-search').classList.remove('is-dir');
    $('kn-dirbtn').classList.remove('is-on');
    setPicking(null);
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
        '<button type="button" class="kn-stop__pick" data-i="' + i + '" title="Valitse kartalta">&#8853;</button>' +
        (stops.length > 2 ? '<button type="button" class="kn-stop__del" data-i="' + i + '" title="Poista">&#10005;</button>' : '') +
      '</div>';
    }).join('');

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
      b.onclick = function () {
        var o = items[+b.dataset.k];
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

  function drawRoute(fit) {
    if (!routeLayer) return;
    var s = routeLayer.getSource(); s.clear();
    var r = legs();
    var pts = stops.filter(function (x) { return !!x; });

    pts.forEach(function (p, i) {
      var f = new ol.Feature({ geometry: new ol.geom.Point(toView(p.x, p.z)) });
      f.set('style', stopStyle(i, pts.length, p.label));
      s.addFeature(f);
    });

    if (r) {
      s.addFeature(new ol.Feature({
        geometry: new ol.geom.LineString(r.pts.map(function (p) { return toView(p.x, p.z); }))
      }));
    }
    renderRouteInfo(r);
    if (fit && r) fitRoute(r);
  }

  function fitRoute(r) {
    var e = ol.extent.boundingExtent(r.pts.map(function (p) { return toView(p.x, p.z); }));
    var pad = Math.max(ol.extent.getWidth(e), ol.extent.getHeight(e)) * 0.4 || 200 / BPD;
    view.fit(ol.extent.buffer(e, pad), {
      size: map.getSize(), duration: 420, maxZoom: view.getMaxZoom(),
      padding: [70, 40, 40, dirMode && window.innerWidth > 860 ? 430 : 40]
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
      b.onclick = function () { localStorage.setItem(LS_MODE, b.dataset.m); renderRouteInfo(legs()); };
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
      '<p class="kn-modenote">' + esc(sel.note) + '</p>';
  }

  /* ---------- jaettava linkki ---------- */
  function writeHash() {
    var pts = stops.filter(function (s) { return !!s; });
    var h = pts.length >= 2 ? '#r=' + pts.map(function (p) { return p.x + ',' + p.z; }).join(';') : '';
    if (location.hash !== h) history.replaceState(null, '', location.pathname + location.search + h);
  }
  function readHash() {
    var pm = /^#p=(-?\d+),(-?\d+)$/.exec(location.hash || '');
    if (pm) {
      var px = +pm[1], pz = +pm[2];
      var hit = pins.filter(function (p) { return p.x === px && p.z === pz; })[0];
      var place = hit || { id: 'coord', title: px + ' ' + pz, x: px, z: pz, color: '#5ad1ff' };
      openPlace(place);
      view.animate({ center: toView(px, pz), duration: 400, zoom: view.getMaxZoom() });
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
    var b = this; writeHash();
    var done = function () { b.textContent = 'Kopioitu!'; setTimeout(function () { b.textContent = 'Kopioi linkki'; }, 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(done, done); else done();
  };

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.kn-search') && !e.target.closest('#kn-sug')) $('kn-sug').hidden = true;
    if (!e.target.closest('.kn-stop')) document.querySelectorAll('.kn-stopsug').forEach(function (x) { x.remove(); });
    if (!e.target.closest('.kn-layers')) $('kn-layers-menu').hidden = true;
  });

  /* Tasot-valikko */
  $('kn-layers-btn').onclick = function (e) {
    e.stopPropagation();
    var m = $('kn-layers-menu');
    m.hidden = !m.hidden;
  };
  $('kn-layers-menu').querySelectorAll('[data-map]').forEach(function (b) {
    b.onclick = function () {
      $('kn-layers-menu').querySelectorAll('[data-map]').forEach(function (x) { x.classList.remove('is-on'); });
      b.classList.add('is-on');
      $('kn-layers-menu').hidden = true;
      loadMeta(b.dataset.map).then(buildMap).catch(function () {});
    };
  });

  /* zoom */
  $('kn-zin').onclick  = function () { view.animate({ zoom: view.getZoom() + 1, duration: 220 }); };
  $('kn-zout').onclick = function () { view.animate({ zoom: view.getZoom() - 1, duration: 220 }); };

  /* kokonaytto */
  function sizeSoon() {
    if (!map) return;
    map.updateSize();
    requestAnimationFrame(function () { map.updateSize(); });
    setTimeout(function () { map.updateSize(); }, 320);
  }
  function fullOn() {
    if (app.classList.contains('is-full')) return;
    app.classList.add('is-full');
    document.body.classList.add('kn-lock');
    $('kn-full').innerHTML = '&#10005;';
    $('kn-full').title = 'Sulje koko näyttö (Esc)';
    var big = $('kn-layers-menu').querySelector('[data-map="5k"]');
    if (big && !big.classList.contains('is-on')) { big.click(); setTimeout(sizeSoon, 420); }
    else sizeSoon();
  }
  function fullOff() {
    if (!app.classList.contains('is-full')) return;
    app.classList.remove('is-full');
    document.body.classList.remove('kn-lock');
    $('kn-full').innerHTML = '&#9974;';
    $('kn-full').title = 'Koko näyttö';
    sizeSoon();
  }
  $('kn-full').onclick = function () { app.classList.contains('is-full') ? fullOff() : fullOn(); };
  var openBtn = $('kn-full-open');
  if (openBtn) openBtn.onclick = function () { fullOn(); app.scrollIntoView({ block: 'start' }); };

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (picking !== null) { setPicking(null); return; }
    if (!$('kn-place').hidden) { closePlace(); return; }
    fullOff();
  });
  window.addEventListener('resize', sizeSoon);

  /* ---------- kaynnistys ---------- */
  renderStops();
  renderRouteInfo(null);

  loadMeta('paiva').then(function (meta) {
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
