/* =====================================================================
   K-S-P-K — jaetut karttamerkit
   ---------------------------------------------------------------------
   Tama tiedosto on uNmINeDin oma laajennuskohta: uNmINeD EI ylikirjoita
   tata tiedostoa kun kartta renderoidaan uudelleen. Siksi kaikki oma
   koodi on taalla eika index.html:ssa.

   Kaytto kartalla:
     - Oikea klikkaus kartalla  ->  "Lisaa merkki tahan"
     - Merkkia klikkaamalla     ->  kupla jossa viesti ja Poista-nappi

   ASETUKSET: katso ASETUKSET-lohko heti alta.
   ===================================================================== */

var UnminedSharedPins = {

  // --- Jaettu tallennus (Supabase) ---------------------------------
  // Tyhjina merkit tallentuvat vain omaan selaimeen (ei jakoa).
  // Taytä nama niin merkit nakyvat kaikille sivun katsojille.
  supabaseUrl : 'https://zfgwjxtruqoacxtkqprp.supabase.co',            // esim. 'https://abcdefgh.supabase.co'
  supabaseKey : 'sb_publishable_MwLjfXP5LCtZe8tZ3IIf7w_5a3zqoKc',            // julkinen anon/publishable-avain
  table       : 'pins',

  // --- Kayttooikeudet ----------------------------------------------
  addPassword : '',            // jos asetettu, merkin lisaaminen kysyy taman
  adminCode   : '',            // talla koodilla voi poistaa kenen tahansa merkin

  // --- Ulkoasu ------------------------------------------------------
  colors: ['#3ef08a','#ffd166','#ff6b6b','#5aa9ff','#c792ea','#ff9f43','#ffffff','#7bed9f']
};

/* uNmINeDin oma kiintea merkkilista (jatetaan pois kaytosta) */
var UnminedCustomMarkers = { isEnabled: false, markers: [] };


(function () {
  'use strict';

  var CFG = UnminedSharedPins;
  var SHARED = !!(CFG.supabaseUrl && CFG.supabaseKey);
  var LSKEY_MINE  = 'kspk.pins.mine';
  var LSKEY_LOCAL = 'kspk.pins.local';

  /* ---------- pieni apukirjasto ---------- */
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
  function mine() {
    try { return JSON.parse(localStorage.getItem(LSKEY_MINE) || '[]'); } catch (e) { return []; }
  }
  function rememberMine(id) {
    try {
      var a = mine(); a.push(String(id));
      localStorage.setItem(LSKEY_MINE, JSON.stringify(a.slice(-500)));
    } catch (e) {}
  }
  function forgetMine(id) {
    try {
      localStorage.setItem(LSKEY_MINE, JSON.stringify(mine().filter(function (x) { return x !== String(id); })));
    } catch (e) {}
  }
  function isMine(id) { return mine().indexOf(String(id)) !== -1; }

  function toast(msg, ok) {
    if (typeof Toastify === 'function') {
      Toastify({
        text: msg, duration: 3000, gravity: 'bottom', position: 'center',
        style: { background: ok === false ? '#b23b3b' : '#1c2a22', border: '1px solid rgba(255,255,255,.18)' }
      }).showToast();
    }
  }

  /* ---------- tallennus ---------- */
  var Store = {
    rest: function (path, opts) {
      opts = opts || {};
      opts.headers = Object.assign({
        'apikey': CFG.supabaseKey,
        'Authorization': 'Bearer ' + CFG.supabaseKey,
        'Content-Type': 'application/json'
      }, opts.headers || {});
      return fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/rest/v1/' + path, opts);
    },
    list: function () {
      if (!SHARED) {
        try { return Promise.resolve(JSON.parse(localStorage.getItem(LSKEY_LOCAL) || '[]')); }
        catch (e) { return Promise.resolve([]); }
      }
      return this.rest(CFG.table + '?select=*&order=created_at.asc')
        .then(function (r) { return r.ok ? r.json() : []; })
        .catch(function () { return []; });
    },
    add: function (pin) {
      if (!SHARED) {
        pin.id = 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        var a = [];
        try { a = JSON.parse(localStorage.getItem(LSKEY_LOCAL) || '[]'); } catch (e) {}
        a.push(pin);
        try { localStorage.setItem(LSKEY_LOCAL, JSON.stringify(a)); } catch (e) {}
        return Promise.resolve(pin);
      }
      return this.rest(CFG.table, {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify(pin)
      }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json().then(function (rows) { return rows[0]; });
      });
    },
    remove: function (id) {
      if (!SHARED) {
        var a = [];
        try { a = JSON.parse(localStorage.getItem(LSKEY_LOCAL) || '[]'); } catch (e) {}
        try {
          localStorage.setItem(LSKEY_LOCAL, JSON.stringify(a.filter(function (p) { return String(p.id) !== String(id); })));
        } catch (e) {}
        return Promise.resolve();
      }
      return this.rest(CFG.table + '?id=eq.' + encodeURIComponent(id), { method: 'DELETE' })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); });
    }
  };

  /* ---------- tyylit ---------- */
  function injectCss() {
    var css = ''
      + '.kspk-pop{position:absolute;bottom:14px;left:-140px;width:280px;padding:14px 16px;'
      + 'background:rgba(10,18,14,.96);color:#eaf3ee;border:1px solid rgba(255,255,255,.18);'
      + 'border-radius:14px;box-shadow:0 18px 44px -18px #000;font:14px/1.5 system-ui,sans-serif;z-index:60}'
      + '.kspk-pop:after{content:"";position:absolute;bottom:-9px;left:150px;width:16px;height:16px;'
      + 'background:inherit;border-right:1px solid rgba(255,255,255,.18);border-bottom:1px solid rgba(255,255,255,.18);'
      + 'transform:rotate(45deg)}'
      + '.kspk-pop h4{margin:0 0 6px;font-size:15px;display:flex;align-items:center;gap:8px}'
      + '.kspk-pop .dot{width:11px;height:11px;border-radius:50%;flex:0 0 auto;box-shadow:0 0 0 2px rgba(0,0,0,.45)}'
      + '.kspk-pop p{margin:0 0 10px;white-space:pre-wrap;word-break:break-word}'
      + '.kspk-pop .meta{font-size:12px;opacity:.6;margin:0 0 10px}'
      + '.kspk-pop .row{display:flex;gap:8px;justify-content:flex-end}'
      + '.kspk-btn{border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.07);color:inherit;'
      + 'padding:7px 13px;border-radius:9px;cursor:pointer;font:inherit;font-size:13px}'
      + '.kspk-btn:hover{background:rgba(255,255,255,.14)}'
      + '.kspk-btn--danger{border-color:rgba(255,107,107,.5);color:#ff8f8f}'
      + '.kspk-btn--primary{background:#3ef08a;border-color:#3ef08a;color:#05140c;font-weight:600}'
      + '.kspk-modal{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:rgba(3,6,5,.62)}'
      + '.kspk-card{width:min(420px,92vw);padding:22px;border-radius:16px;background:#0c1510;color:#eaf3ee;'
      + 'border:1px solid rgba(255,255,255,.16);box-shadow:0 30px 70px -28px #000;font:14px/1.5 system-ui,sans-serif}'
      + '.kspk-card h3{margin:0 0 4px;font-size:17px}'
      + '.kspk-card .sub{margin:0 0 16px;font-size:12.5px;opacity:.6}'
      + '.kspk-card label{display:block;font-size:12px;opacity:.75;margin:12px 0 5px}'
      + '.kspk-card input,.kspk-card textarea{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;'
      + 'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);color:inherit;font:inherit}'
      + '.kspk-card textarea{min-height:82px;resize:vertical}'
      + '.kspk-colors{display:flex;gap:9px;flex-wrap:wrap;margin-top:6px}'
      + '.kspk-colors button{width:28px;height:28px;border-radius:50%;border:2px solid transparent;cursor:pointer;padding:0}'
      + '.kspk-colors button[aria-checked="true"]{border-color:#fff;transform:scale(1.15)}'
      + '.kspk-card .row{display:flex;gap:9px;justify-content:flex-end;margin-top:20px}'
      + '.kspk-badge{position:absolute;left:10px;bottom:10px;z-index:40;padding:6px 11px;border-radius:999px;'
      + 'background:rgba(10,18,14,.85);color:#9db3a6;border:1px solid rgba(255,255,255,.14);'
      + 'font:12px system-ui,sans-serif;pointer-events:none}';
    document.head.appendChild(el('style', null, css));
  }

  /* ---------- merkin piirto ---------- */
  function pinStyle(p, olns) {
    var c = p.color || CFG.colors[0];
    var s = new olns.style.Style({
      image: new olns.style.Circle({
        radius: 8,
        fill: new olns.style.Fill({ color: c }),
        stroke: new olns.style.Stroke({ color: 'rgba(0,0,0,.65)', width: 3 })
      })
    });
    if (p.title) {
      s.setText(new olns.style.Text({
        text: p.title, font: '600 13px system-ui,sans-serif', offsetY: -20,
        fill: new olns.style.Fill({ color: '#ffffff' }),
        stroke: new olns.style.Stroke({ color: 'rgba(0,0,0,.85)', width: 3 })
      }));
    }
    return s;
  }

  /* ---------- lomake ---------- */
  function askPin(x, z, done) {
    var color = CFG.colors[0];
    var wrap = el('div', 'kspk-modal');
    var card = el('div', 'kspk-card');
    card.innerHTML =
      '<h3>Lisaa merkki</h3>' +
      '<p class="sub">Koordinaatit X ' + Math.round(x) + ', Z ' + Math.round(z) + '</p>' +
      '<label>Otsikko</label><input id="kp-t" maxlength="40" placeholder="esim. Kotini">' +
      '<label>Viesti (valinnainen)</label><textarea id="kp-m" maxlength="400" placeholder="Kerro mita taalla on..."></textarea>' +
      '<label>Nimimerkki</label><input id="kp-a" maxlength="24" placeholder="Pelaajanimesi">' +
      (CFG.addPassword ? '<label>Tunnussana</label><input id="kp-p" type="password">' : '') +
      '<label>Vari</label><div class="kspk-colors" id="kp-c" role="radiogroup"></div>' +
      '<div class="row"><button class="kspk-btn" id="kp-x">Peruuta</button>' +
      '<button class="kspk-btn kspk-btn--primary" id="kp-ok">Lisaa merkki</button></div>';
    wrap.appendChild(card);
    document.body.appendChild(wrap);

    var cbox = card.querySelector('#kp-c');
    CFG.colors.forEach(function (c, i) {
      var b = el('button');
      b.style.background = c;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', i === 0 ? 'true' : 'false');
      b.title = c;
      b.onclick = function () {
        color = c;
        [].forEach.call(cbox.children, function (o) { o.setAttribute('aria-checked', 'false'); });
        b.setAttribute('aria-checked', 'true');
      };
      cbox.appendChild(b);
    });

    try { card.querySelector('#kp-a').value = localStorage.getItem('kspk.pins.name') || ''; } catch (e) {}
    setTimeout(function () { card.querySelector('#kp-t').focus(); }, 30);

    function close() { wrap.remove(); }
    card.querySelector('#kp-x').onclick = close;
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    document.addEventListener('keydown', function esckey(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esckey); }
    });

    card.querySelector('#kp-ok').onclick = function () {
      var t = card.querySelector('#kp-t').value.trim();
      var m = card.querySelector('#kp-m').value.trim();
      var a = card.querySelector('#kp-a').value.trim();
      if (!t) { card.querySelector('#kp-t').focus(); return; }
      if (CFG.addPassword) {
        var pw = card.querySelector('#kp-p').value;
        if (pw !== CFG.addPassword) { toast('Vaara tunnussana', false); return; }
      }
      try { localStorage.setItem('kspk.pins.name', a); } catch (e) {}
      close();
      done({ x: Math.round(x), z: Math.round(z), title: t, message: m, author: a || 'Nimeton', color: color });
    };
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
    function closePop() { popEl.innerHTML = ''; overlay.setPosition(undefined); }

    function toView(x, z) {
      return olns.proj.transform([x, z], unmined.dataProjection, unmined.viewProjection);
    }
    function toBlock(c) {
      return olns.proj.transform(c, unmined.viewProjection, unmined.dataProjection);
    }

    function addFeature(p) {
      var f = new olns.Feature({ geometry: new olns.geom.Point(toView(p.x, p.z)) });
      f.set('pin', p);
      f.setStyle(pinStyle(p, olns));
      source.addFeature(f);
      return f;
    }

    function refresh() {
      Store.list().then(function (rows) {
        source.clear();
        (rows || []).forEach(addFeature);
      });
    }

    /* --- merkin kupla --- */
    map.on('singleclick', function (evt) {
      var hit = map.forEachFeatureAtPixel(evt.pixel, function (f) {
        return f.get('pin') ? f : null;
      }, { hitTolerance: 8, layerFilter: function (l) { return l === layer; } });
      if (!hit) { closePop(); return; }

      var p = hit.get('pin');
      var canDelete = isMine(p.id) || !!CFG.adminCode;
      popEl.className = 'kspk-pop';
      popEl.innerHTML =
        '<h4><span class="dot" style="background:' + esc(p.color || '#3ef08a') + '"></span>' + esc(p.title) + '</h4>' +
        (p.message ? '<p>' + esc(p.message) + '</p>' : '') +
        '<p class="meta">' + esc(p.author || 'Nimeton') + ' &middot; X ' + p.x + ', Z ' + p.z + '</p>' +
        '<div class="row">' +
        (canDelete ? '<button class="kspk-btn kspk-btn--danger" id="kp-del">Poista</button>' : '') +
        '<button class="kspk-btn" id="kp-cl">Sulje</button></div>';
      overlay.setPosition(toView(p.x, p.z));

      popEl.querySelector('#kp-cl').onclick = closePop;
      var del = popEl.querySelector('#kp-del');
      if (del) del.onclick = function () {
        if (!isMine(p.id)) {
          var code = prompt('Tama ei ole sinun merkkisi. Syota yllapitokoodi poistaaksesi:');
          if (code === null) return;
          if (code !== CFG.adminCode) { toast('Vaara koodi', false); return; }
        } else if (!confirm('Poistetaanko merkki "' + p.title + '"?')) return;

        Store.remove(p.id).then(function () {
          forgetMine(p.id);
          source.removeFeature(hit);
          closePop();
          toast('Merkki poistettu');
        }).catch(function () { toast('Poisto epaonnistui', false); });
      };
    });

    /* --- oikea klikkaus: lisaa merkki --- */
    function handleAdd(coordinate) {
      var b = toBlock(coordinate);
      askPin(b[0], b[1], function (pin) {
        Store.add(pin).then(function (saved) {
          rememberMine(saved.id);
          addFeature(saved);
          toast(SHARED ? 'Merkki lisatty ja jaettu' : 'Merkki lisatty (vain tassa selaimessa)');
        }).catch(function () { toast('Tallennus epaonnistui', false); });
      });
    }

    var menu = null;
    map.getControls().forEach(function (c) {
      if (c && typeof c.push === 'function' && typeof c.clear === 'function') menu = c;
    });

    if (menu) {
      // uNmINeDin oma valikko rakennetaan 'open'-tapahtumassa; lisataan oma kohta perään
      menu.on('open', function (evt) {
        menu.push('-');
        menu.push({
          text: 'Lisaa merkki tahan',
          classname: 'kspk-ctx',
          callback: function (obj) { handleAdd(obj.coordinate); }
        });
      });
    } else {
      // varajarjestelma jos valikkoa ei loydy
      map.getViewport().addEventListener('contextmenu', function (e) {
        e.preventDefault();
        handleAdd(map.getEventCoordinate(e));
      });
    }

    if (!SHARED) {
      var badge = el('div', 'kspk-badge', 'Merkit tallentuvat vain tahan selaimeen');
      map.getViewport().appendChild(badge);
    }

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
