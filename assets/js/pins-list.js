/* =====================================================================
   K-S-P-K — karttamerkkien lista (kartta.html)
   Nayttaa kaikki merkit kartan alla: sijainti, viesti, lisaaja.
   Omat merkit (pelinimi + tunnussana) voi piilottaa ja poistaa,
   dev-koodilla kaikki.
   ===================================================================== */
(function () {
  'use strict';

  var CFG = {
    url  : 'https://zfgwjxtruqoacxtkqprp.supabase.co',
    key  : 'sb_publishable_MwLjfXP5LCtZe8tZ3IIf7w_5a3zqoKc',
    table: 'pins',
    pass : '538140123456789',
    dev  : '538140155'
  };

  var LS_NAME = 'kspk.pins.name';
  var LS_PASS = 'kspk.pins.pass';
  var SS_DEV  = 'kspk.pins.dev';

  var root = document.getElementById('pin-list');
  if (!root) return;

  var rows = [];

  /* ---------- apurit ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }
  function get(k, d) { try { return localStorage.getItem(k) || d || ''; } catch (e) { return d || ''; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function isDev() { try { return sessionStorage.getItem(SS_DEV) === '1'; } catch (e) { return false; } }
  function setDev(v) { try { v ? sessionStorage.setItem(SS_DEV,'1') : sessionStorage.removeItem(SS_DEV); } catch (e) {} }

  function rest(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({
      'apikey': CFG.key, 'Authorization': 'Bearer ' + CFG.key, 'Content-Type': 'application/json'
    }, opts.headers || {});
    return fetch(CFG.url + '/rest/v1/' + path, opts);
  }

  function mayEdit(p) {
    if (isDev()) return true;
    var n = get(LS_NAME), pw = get(LS_PASS);
    return !!n && pw === CFG.pass && n.toLowerCase() === String(p.author || '').toLowerCase();
  }

  function tellMap(msg) {
    var f = document.getElementById('map-frame');
    if (f && f.contentWindow) { try { f.contentWindow.postMessage(msg, '*'); } catch (e) {} }
  }

  /* ---------- tyylit ---------- */
  (function css() {
    var s = document.createElement('style');
    s.textContent = ''
      + '#pin-list{margin-top:26px}'
      + '.pl-head{display:flex;flex-wrap:wrap;gap:12px;align-items:end;justify-content:space-between;margin-bottom:16px}'
      + '.pl-auth{display:flex;flex-wrap:wrap;gap:10px;align-items:end}'
      + '.pl-f{display:grid;gap:5px}'
      + '.pl-f span{font-size:11.5px;color:var(--muted,#9db3a6);letter-spacing:.04em}'
      + '.pl-f input{padding:9px 12px;border-radius:10px;min-width:150px;'
      + 'background:rgba(8,14,11,.7);border:1px solid var(--line,rgba(255,255,255,.12));color:var(--text,#eaf3ee);font:inherit;font-size:.9rem}'
      + '.pl-f input:focus{outline:none;border-color:var(--green,#3ef08a)}'
      + '.pl-grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(290px,1fr))}'
      + '.pl-card{padding:15px 17px;border-radius:14px;background:rgba(8,14,11,.6);'
      + 'border:1px solid var(--line,rgba(255,255,255,.12));display:grid;gap:9px;align-content:start}'
      + '.pl-card.is-hidden{opacity:.55}'
      + '.pl-t{display:flex;align-items:center;gap:9px;font-weight:600;font-size:1rem}'
      + '.pl-dot{width:12px;height:12px;border-radius:50%;flex:0 0 auto;box-shadow:0 0 0 2px rgba(0,0,0,.5)}'
      + '.pl-msg{margin:0;white-space:pre-wrap;word-break:break-word;font-size:.92rem;color:var(--text,#eaf3ee)}'
      + '.pl-meta{font-size:.8rem;color:var(--muted,#9db3a6);display:flex;flex-wrap:wrap;gap:10px}'
      + '.pl-acts{display:flex;flex-wrap:wrap;gap:7px;margin-top:2px}'
      + '.pl-b{border:1px solid var(--line,rgba(255,255,255,.14));background:rgba(255,255,255,.05);'
      + 'color:inherit;padding:6px 11px;border-radius:9px;cursor:pointer;font:inherit;font-size:.8rem}'
      + '.pl-b:hover{background:rgba(255,255,255,.12)}'
      + '.pl-b--danger{border-color:rgba(255,107,107,.45);color:#ff8f8f}'
      + '.pl-b--dev{border-color:rgba(255,209,102,.5);color:#ffd166}'
      + '.pl-b--dev.on{background:#ffd166;color:#241a00;border-color:#ffd166}'
      + '.pl-tag{padding:2px 8px;border-radius:999px;font-size:11px;'
      + 'background:rgba(255,209,102,.16);color:#ffd166;border:1px solid rgba(255,209,102,.35)}'
      + '.pl-empty{padding:26px;text-align:center;color:var(--muted,#9db3a6);'
      + 'border:1px dashed var(--line,rgba(255,255,255,.14));border-radius:14px}';
    document.head.appendChild(s);
  })();

  /* ---------- runko ---------- */
  root.innerHTML =
    '<div class="section-head" data-reveal>' +
      '<span class="eyebrow">Merkit</span>' +
      '<h2>Kartan merkinnat <span id="pl-n" class="muted" style="font-size:1rem"></span></h2>' +
    '</div>' +
    '<div class="pl-head">' +
      '<div class="pl-auth">' +
        '<label class="pl-f"><span>PELINIMI</span><input id="pl-name" maxlength="24" placeholder="Minecraft-nimesi"></label>' +
        '<label class="pl-f"><span>TUNNUSSANA</span><input id="pl-pass" type="password" placeholder="Yhteinen tunnussana"></label>' +
      '</div>' +
      '<div style="display:flex;gap:8px">' +
        '<button class="pl-b" id="pl-reload">Paivita</button>' +
        '<button class="pl-b pl-b--dev" id="pl-dev">Dev</button>' +
      '</div>' +
    '</div>' +
    '<div class="pl-grid" id="pl-grid"></div>';

  var $name = document.getElementById('pl-name');
  var $pass = document.getElementById('pl-pass');
  var $grid = document.getElementById('pl-grid');
  var $n    = document.getElementById('pl-n');
  var $dev  = document.getElementById('pl-dev');

  $name.value = get(LS_NAME);
  $pass.value = get(LS_PASS);
  $name.oninput = function () { set(LS_NAME, $name.value.trim()); render(); };
  $pass.oninput = function () { set(LS_PASS, $pass.value); render(); };
  $dev.classList.toggle('on', isDev());

  $dev.onclick = function () {
    if (isDev()) {
      setDev(false); $dev.classList.remove('on');
      tellMap({ kspk: 'dev-state', on: false });
    } else {
      var c = prompt('Yllapitokoodi:');
      if (c === null) return;
      if (c !== CFG.dev) { alert('Vaara koodi'); return; }
      setDev(true); $dev.classList.add('on');
      tellMap({ kspk: 'dev-state', on: true });
    }
    render();
  };
  document.getElementById('pl-reload').onclick = load;

  /* ---------- piirto ---------- */
  function render() {
    var dev = isDev();
    var visible = rows.filter(function (p) { return !p.hidden || dev; });
    $n.textContent = '(' + visible.length + ')';

    if (!visible.length) {
      $grid.innerHTML = '<div class="pl-empty">Ei viela yhtaan merkkia. Avaa kartta, klikkaa oikealla tai napauta kolmesti — ja lisaa ensimmainen.</div>';
      return;
    }

    $grid.innerHTML = '';
    visible.forEach(function (p) {
      var can = mayEdit(p);
      var c = document.createElement('div');
      c.className = 'pl-card' + (p.hidden ? ' is-hidden' : '');
      c.innerHTML =
        '<div class="pl-t"><span class="pl-dot" style="background:' + esc(p.color || '#3ef08a') + '"></span>' +
          esc(p.title) + (p.hidden ? ' <span class="pl-tag">piilotettu</span>' : '') + '</div>' +
        (p.message ? '<p class="pl-msg">' + esc(p.message) + '</p>' : '') +
        '<div class="pl-meta"><span>&#128100; ' + esc(p.author || 'Nimeton') + '</span>' +
          '<span>&#128205; X ' + p.x + ', Z ' + p.z + '</span></div>' +
        '<div class="pl-acts">' +
          '<button class="pl-b" data-a="go">Nayta kartalla</button>' +
          (can ? '<button class="pl-b" data-a="hide">' + (p.hidden ? 'Palauta nakyviin' : 'Piilota') + '</button>' : '') +
          (can ? '<button class="pl-b pl-b--danger" data-a="del">Poista</button>' : '') +
        '</div>';

      c.querySelector('[data-a="go"]').onclick = function () {
        tellMap({ kspk: 'pins-focus', id: p.id });
        var mf = document.querySelector('.map-frame');
        if (mf) mf.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
      var h = c.querySelector('[data-a="hide"]');
      if (h) h.onclick = function () {
        var nv = !p.hidden;
        rest(CFG.table + '?id=eq.' + encodeURIComponent(p.id), {
          method: 'PATCH', body: JSON.stringify({ hidden: nv })
        }).then(function (r) {
          if (!r.ok) throw 0;
          p.hidden = nv; render(); tellMap({ kspk: 'pins-reload' });
        }).catch(function () { alert('Ei onnistunut'); });
      };
      var d = c.querySelector('[data-a="del"]');
      if (d) d.onclick = function () {
        if (!confirm('Poistetaanko merkki "' + p.title + '"? Tata ei voi perua.')) return;
        rest(CFG.table + '?id=eq.' + encodeURIComponent(p.id), { method: 'DELETE' })
          .then(function (r) {
            if (!r.ok) throw 0;
            rows = rows.filter(function (o) { return o.id !== p.id; });
            render(); tellMap({ kspk: 'pins-reload' });
          }).catch(function () { alert('Poisto epaonnistui'); });
      };

      $grid.appendChild(c);
    });
  }

  function load() {
    return rest(CFG.table + '?select=*&order=created_at.desc')
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (r) { rows = r || []; render(); })
      .catch(function () { rows = []; render(); });
  }

  window.addEventListener('message', function (e) {
    if (e.data && e.data.kspk === 'pins-changed') load();
  });

  load();
  setInterval(load, 45000);
})();
