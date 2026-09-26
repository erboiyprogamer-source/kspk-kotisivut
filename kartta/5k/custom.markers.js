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
     - Merkin lisaaminen vaatii pelinimen ja tunnussanan
     - Oman merkin muokkaus/poisto: sama pelinimi + tunnussana
     - Dev-tila: kaikki oikeudet kaikkiin merkkeihin
   ===================================================================== */

var UnminedSharedPins = {

  // --- Jaettu tallennus (Supabase) ---------------------------------
  supabaseUrl : 'https://zfgwjxtruqoacxtkqprp.supabase.co',
  supabaseKey : 'sb_publishable_MwLjfXP5LCtZe8tZ3IIf7w_5a3zqoKc',
  table       : 'pins',

  // --- Kayttooikeudet ----------------------------------------------
  // Tunnussana ja yllapitokoodi EIVAT ole taalla. Ne ovat Supabasen
  // secrets-taulussa, jota anon-avaimella ei voi lukea. Kaikki kirjoitus
  // kulkee pin_add / pin_edit / pin_delete -funktioiden kautta, jotka
  // tarkistavat koodin ja whitelistin palvelimella.

  // --- Selaimen oma zoom --------------------------------------------
  allowBrowserZoom: true,

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

  /* Palvelinfunktioiden virheet suomeksi */
  function errText(e) {
    var m = String((e && e.message) || e || '');
    if (m.indexOf('BAD_PASSWORD')    > -1) return 'Vaara tunnussana';
    if (m.indexOf('NOT_WHITELISTED') > -1) return 'Pelinimi ei ole sallittujen listalla';
    if (m.indexOf('NO_RIGHTS')       > -1) return 'Ei oikeuksia — tarkista tunnussana ja pelinimi';
    if (m.indexOf('NO_AUTHOR')       > -1) return 'Pelinimi puuttuu';
    if (m.indexOf('NOT_FOUND')       > -1) return 'Merkkia ei loytynyt';
    return 'Toiminto ei onnistunut';
  }

  /* Pelinimi + tunnussana muokkausta/poistoa varten.
     Dev-tilassa yllapitokoodi kelpaa tunnussanaksi. */
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
      pw = prompt('Tunnussana:');
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
        p_color: pin.color, p_x: pin.x, p_z: pin.z
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
        p_x: v('x'), p_z: v('z'), p_hidden: v('hidden')
      });
    },
    remove: function (id, c) {
      if (!SHARED) {
        this.local(this.local().filter(function (p) { return String(p.id) !== String(id); }));
        return Promise.resolve();
      }
      return this.rpc('pin_delete', { p_pass: c.pass, p_author: c.author, p_id: id });
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
      + '.kspk-card .row{display:flex;gap:9px;justify-content:flex-end;margin-top:20px;flex-wrap:wrap}'
      + '.kspk-hint{margin:14px 0 0;padding:10px 12px;border-radius:10px;font-size:12.5px;'
      + 'background:rgba(62,240,138,.08);border:1px solid rgba(62,240,138,.22);color:#b9f5d2}'
      + '.kspk-badge{position:absolute;left:10px;bottom:10px;z-index:40;padding:6px 11px;border-radius:999px;'
      + 'background:rgba(10,18,14,.85);color:#9db3a6;border:1px solid rgba(255,255,255,.14);'
      + 'font:12px system-ui,sans-serif;pointer-events:none}'
      + '.kspk-dev{position:absolute;right:10px;bottom:10px;z-index:45;width:38px;height:38px;border-radius:50%;'
      + 'display:grid;place-items:center;cursor:pointer;font-size:17px;'
      + 'background:rgba(10,18,14,.85);color:#9db3a6;border:1px solid rgba(255,255,255,.16)}'
      + '.kspk-dev.on{background:#ffd166;color:#241a00;border-color:#ffd166}'
      + '.kspk-ripple{position:absolute;z-index:44;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;'
      + 'pointer-events:none;border:2px solid #3ef08a;box-shadow:0 0 22px 4px rgba(62,240,138,.45);'
      + 'animation:kspkR .6s cubic-bezier(.2,.7,.3,1) forwards}'
      + '@keyframes kspkR{from{transform:scale(1);opacity:.95}to{transform:scale(22);opacity:0}}';
    document.head.appendChild(el('style', null, css));
  }

  /* ---------- merkin tyyli ---------- */
  function pinStyle(p, olns) {
    var c = p.color || CFG.colors[0];
    var hidden = !!p.hidden;
    var s = new olns.style.Style({
      image: new olns.style.Circle({
        radius: 8,
        fill: new olns.style.Fill({ color: hidden ? 'rgba(120,120,120,.45)' : c }),
        stroke: new olns.style.Stroke({
          color: hidden ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.65)',
          width: 3, lineDash: hidden ? [3, 3] : undefined
        })
      })
    });
    if (p.title) {
      s.setText(new olns.style.Text({
        text: p.title + (hidden ? ' (piilotettu)' : ''),
        font: '600 13px system-ui,sans-serif', offsetY: -20,
        fill: new olns.style.Fill({ color: hidden ? '#b9c4bd' : '#ffffff' }),
        stroke: new olns.style.Stroke({ color: 'rgba(0,0,0,.85)', width: 3 })
      }));
    }
    return s;
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

      '<label>Pelinimesi *</label><input id="kp-a" maxlength="24" placeholder="Minecraft-nimesi">' +
      '<label>Tunnussana *</label><input id="kp-p" type="password" placeholder="' +
        (isDev() ? 'Tyhja = yllapitokoodi' : 'Yhteinen tunnussana') + '">' +
      (isDev() ? '<div class="kspk-hint">Dev-tila paalla — voit muokata ja poistaa kaikkien merkkeja.</div>' : '') +
      (!isDev() && WHITELIST && WHITELIST.length
        ? '<div class="kspk-hint">Sallitut pelinimet: ' + esc(WHITELIST.join(', ')) + '</div>' : '') +

      '<div class="row">' +
        '<button class="kspk-btn" id="kp-x2">Peruuta</button>' +
        '<button class="kspk-btn kspk-btn--primary" id="kp-ok">' + (edit ? 'Tallenna' : 'Lisaa merkki') + '</button>' +
      '</div>';
    wrap.appendChild(card);
    document.body.appendChild(wrap);

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

    $('#kp-center').onclick = function () {
      if (opts.centre) {
        var c = opts.centre();
        $('#kp-x').value = Math.round(c[0]);
        $('#kp-z').value = Math.round(c[1]);
      }
    };

    setTimeout(function () { $('#kp-t').focus(); }, 30);
    function close() { wrap.remove(); document.removeEventListener('keydown', onEsc); }
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
      if (!pw) { toast('Tunnussana puuttuu', false); $('#kp-p').focus(); return; }
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
      done({ x: x, z: z, title: t, message: $('#kp-m').value.trim(), author: a, color: color },
           { pass: pw, author: a });
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
    function closePop() { popEl.innerHTML = ''; popEl.className = ''; overlay.setPosition(undefined); }

    function toView(x, z) { return olns.proj.transform([x, z], unmined.dataProjection, unmined.viewProjection); }
    function toBlock(c)   { return olns.proj.transform(c, unmined.viewProjection, unmined.dataProjection); }
    function centre()     { return toBlock(map.getView().getCenter()); }

    var rows = [];

    function draw() {
      source.clear();
      rows.forEach(function (p) {
        if (p.hidden && !isDev()) return;
        var f = new olns.Feature({ geometry: new olns.geom.Point(toView(p.x, p.z)) });
        f.set('pin', p);
        f.setStyle(pinStyle(p, olns));
        source.addFeature(f);
      });
    }
    function refresh() {
      return Store.list().then(function (r) { rows = r || []; draw(); });
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
      pinForm({ mode: 'add', x: b[0], z: b[1], centre: centre }, function (pin, c) {
        Store.add(pin, c).then(function (saved) {
          if (saved) rows.push(saved);
          draw(); announce();
          toast(SHARED ? 'Merkki lisatty — nakyy kaikille' : 'Merkki lisatty (vain tassa selaimessa)');
          if (SHARED) refresh();
        }).catch(function (e) { toast(errText(e), false); });
      });
    }

    /* --- kupla --- */
    function openPop(p) {
      var can = mayEdit(p);
      popEl.className = 'kspk-pop';
      popEl.innerHTML =
        '<h4><span class="dot" style="background:' + esc(p.color || '#3ef08a') + '"></span>' + esc(p.title) +
          (p.hidden ? '<span class="kspk-tag">piilotettu</span>' : '') + '</h4>' +
        (p.message ? '<p>' + esc(p.message) + '</p>' : '') +
        '<p class="meta">' + esc(p.author || 'Nimeton') + ' &middot; X ' + p.x + ', Z ' + p.z + '</p>' +
        '<div class="row">' +
          (can ? '<button class="kspk-btn" id="kp-e">Muokkaa</button>' : '') +
          (can ? '<button class="kspk-btn" id="kp-h">' + (p.hidden ? 'Nayta' : 'Piilota') + '</button>' : '') +
          (can ? '<button class="kspk-btn kspk-btn--danger" id="kp-d">Poista</button>' : '') +
          '<button class="kspk-btn" id="kp-c2">Sulje</button>' +
        '</div>';
      overlay.setPosition(toView(p.x, p.z));
      popEl.querySelector('#kp-c2').onclick = closePop;

      if (!can) return;

      popEl.querySelector('#kp-e').onclick = function () {
        closePop();
        pinForm({ mode: 'edit', pin: p, centre: centre }, function (v, c) {
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

    map.on('singleclick', function (evt) {
      var hit = map.forEachFeatureAtPixel(evt.pixel, function (f) { return f.get('pin') ? f : null; },
        { hitTolerance: 10, layerFilter: function (l) { return l === layer; } });
      if (hit) openPop(hit.get('pin')); else closePop();
    });

    /* --- kolmoisnapautus / kolmoisklikkaus --- */
    var taps = [];
    map.getViewport().addEventListener('pointerup', function (e) {
      var now = Date.now();
      taps = taps.filter(function (t) { return now - t.t < 700; });
      taps.push({ t: now, x: e.clientX, y: e.clientY });
      if (taps.length >= 3) {
        var a = taps[0], c = taps[taps.length - 1];
        if (Math.abs(a.x - c.x) < 34 && Math.abs(a.y - c.y) < 34) {
          taps = [];
          closePop();
          var r = map.getViewport().getBoundingClientRect();
          var px = [c.x - r.left, c.y - r.top];
          addAt(map.getCoordinateFromPixel(px), px);
        }
      }
    });

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

    loadWhitelist();
    refresh();
    if (SHARED) setInterval(refresh, 30000);
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
