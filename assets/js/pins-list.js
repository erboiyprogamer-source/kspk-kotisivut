/* =====================================================================
   K-S-P-K — karttamerkkien lista (kartta.html)
   Nayttaa kaikki merkit kartan alla: sijainti, viesti, lisaaja.
   Omat merkit (pelinimi + oma salasana) voi piilottaa ja poistaa,
   dev-koodilla kaikki.
   ===================================================================== */
(function () {
  'use strict';

  /* Salasanat ja yllapitokoodi ovat Supabasen puolella, eivat
     taalla. Kaikki kirjoitus kulkee pin_edit / pin_delete -funktioiden
     kautta, jotka tarkistavat oikeudet palvelimella. */
  var CFG = {
    url  : 'https://zfgwjxtruqoacxtkqprp.supabase.co',
    key  : 'sb_publishable_MwLjfXP5LCtZe8tZ3IIf7w_5a3zqoKc',
    table: 'pins'
  };

  var LS_NAME = 'kspk.pins.name';
  var LS_PASS = 'kspk.pins.pass';
  var SS_DEV  = 'kspk.pins.dev';
  var SS_CODE = 'kspk.pins.devcode';
  var LS_VIEW = 'kspk.pins.view';   // Kohta 7/8: sama avain kuin kartalla — jaettu oma nakyma

  /* Kohta 25: alkuperaiset 5 ovat Unicode-glyfeja (ei emojeita); uudet 12
     muotoa eivat vastaa mitaan yksinkertaista glyfia, joten niille on pieni
     inline-SVG (piirretaan sellaisenaan HTML:na, ks. chip()-kutsut alla). */
  var SYMBOL_GLYPH = { dot: '●', square: '■', triangle: '▲', star: '★', diamond: '◆' };

  /* Varipaletin nimet suodatinchippeja varten (sama lista kuin
     merkkien lisayslomakkeessa map-markers.js:ssa). */
  var COLOR_NAMES = {
    '#3ef08a': 'vihrea', '#7bed9f': 'vaalea vihrea', '#c0f549': 'limetti',
    '#ffd166': 'keltainen', '#ff9f43': 'oranssi', '#ff6b6b': 'punainen',
    '#e84393': 'pinkki', '#c792ea': 'violetti', '#5aa9ff': 'sininen',
    '#1e6fd9': 'tumma sininen', '#00d2d3': 'turkoosi', '#9c6644': 'ruskea',
    '#ffffff': 'valkoinen', '#9e9e9e': 'harmaa', '#5a6b7a': 'tumma harmaa'
  };
  var SYMBOL_SVG = {
    house: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><g transform="translate(0.000 0.250)"><path d="M12 2.2 1.5 11h3.2v10.3h6V15h2.6v6.3h6V11h3.2z"/></g></svg>',
    skull: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><g transform="translate(0.000 0.750)"><path fill-rule="evenodd" d="M12 1.6c-5 0-8.6 3.7-8.6 8.3 0 3 1.5 5.2 3.4 6.7v3.1c0 .7.5 1.2 1.2 1.2h1v-2.2h1.6v2.2h2.8v-2.2h1.6v2.2h1c.7 0 1.2-.5 1.2-1.2v-3.1c1.9-1.5 3.4-3.7 3.4-6.7 0-4.6-3.6-8.3-8.6-8.3zm-3.6 9.6a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6zm7.2 0a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6zM12 13.4l1.6 2.6h-3.2z"/></g></svg>',
    sword: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12 1 14.4 5.4V15.2H9.6V5.4z"/><path d="M5.2 15.2h13.6v2.4H5.2z"/><path d="M10.8 17.6h2.4v3.6h-2.4z"/><path d="M9.4 21.2h5.2v1.9H9.4z"/></svg>',
    hammer: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><g transform="translate(-2.000 2.031)"><g transform="rotate(45 12 12)"><g transform="translate(12 12)"><g transform="scale(1.00000)"><g transform="translate(-12 -12)"><rect x="4.6" y="2.2" width="14.8" height="5.9" rx="1.4"/><rect x="10.8" y="8.1" width="2.4" height="13.8" rx="0.7"/></g></g></g></g></g></svg>',
    smiley: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-3.6 6.8a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8zm7.2 0a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8zM6.8 14c1 2.2 3 3.6 5.2 3.6s4.2-1.4 5.2-3.6z"/></svg>',
    pickaxe: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><g transform="translate(-1.031 1.031)"><g transform="rotate(45 12 12)"><g transform="translate(12 12)"><g transform="scale(1.00000)"><g transform="translate(-12 -12)"><path d="M1.6 11.2C3.2 4.4 7.2 1.2 12 1.2s8.8 3.2 10.4 10c-2.6-4.2-6.1-6.2-10.4-6.2S4.2 7 1.6 11.2z"/><path d="M10.7 4.6h2.6V22.6h-2.6z"/></g></g></g></g></g></svg>',
    tree: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><g transform="translate(0.000 -0.250)"><path d="M12 1.5 6.5 9.5h2.3L4.5 16h4.7l-3.5 6.5h12.6L15 16h4.5l-4.3-6.5h2.3z"/><rect x="10.6" y="22.5" width="2.8" height="1.4"/></g></svg>',
    axe: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><g transform="translate(0.750 2.375)"><g transform="rotate(45 12 12)"><g transform="translate(12 12)"><g transform="scale(1.00000)"><g transform="translate(-12 -12)"><path d="M13.4 3.8 3.9 1.4c-.9 3.8-.9 7.4 0 11L13.4 10.8z"/><path d="M10.9 3.8h2.5V22.6h-2.5z"/></g></g></g></g></g></svg>',
    shield: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><g transform="translate(0.000 -0.250)"><path d="M12 1.8 3.5 5v6.2c0 5.4 3.6 9.8 8.5 11.5 4.9-1.7 8.5-6.1 8.5-11.5V5z"/></g></svg>',
    heart: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><g transform="translate(0.000 0.156)"><path d="M12 21S2.5 14.6 2.5 8.2C2.5 5 5 2.7 8 2.7c1.8 0 3.3.9 4 2.3.7-1.4 2.2-2.3 4-2.3 3 0 5.5 2.3 5.5 5.5 0 6.4-9.5 12.8-9.5 12.8z"/></g></svg>',
    anchor: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><g transform="translate(0.031 0.250)"><path fill-rule="evenodd" d="M12 1.8a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6zm-1.1 4.9h2.2v2.5h3.6v1.7h-3.6v8.3c2.3-.5 4-2.2 4.5-4.4h1.8c-.6 3.7-3.7 6.5-7.4 6.8v.1h-.1v-.1c-3.7-.3-6.8-3.1-7.4-6.8h1.8c.5 2.2 2.2 3.9 4.5 4.4V10.9H7.3V9.2h3.6z"/></g></svg>',
    chest: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path fill-rule="evenodd" d="M3 9.5h18v10.2H3zm7.2 3.3v2.3h3.6v-2.3h1.9c-.3 1.8-1.9 3.2-3.7 3.2s-3.4-1.4-3.7-3.2z"/><path d="M4.5 4.3h15l1.8 4.2H2.7z"/></svg>',
    swords: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12 1 14.4 5.4V15.2H9.6V5.4z"/><path d="M5.2 15.2h13.6v2.4H5.2z"/><path d="M10.8 17.6h2.4v3.6h-2.4z"/><path d="M9.4 21.2h5.2v1.9H9.4z"/></svg>'
  };

  /* Kohta 8: oma nakyma-asetus myos merkkilistalle (vain tama selain,
     ei vaikuta palvelimelle eika muihin kayttajiin). Sama tallennuspaikka
     kuin kartalla (custom.markers.js), joten piilotus on yhtenainen. */
  function getView() {
    try {
      var v = JSON.parse(localStorage.getItem(LS_VIEW) || '{}');
      return {
        hideColors: Array.isArray(v.hideColors) ? v.hideColors : [],
        hideSymbols: Array.isArray(v.hideSymbols) ? v.hideSymbols : [],
        hideAuthors: Array.isArray(v.hideAuthors) ? v.hideAuthors : [],
        /* "nayta vain" -rajaus: tyhja lista = ei rajausta */
        onlyColors: Array.isArray(v.onlyColors) ? v.onlyColors : [],
        onlySymbols: Array.isArray(v.onlySymbols) ? v.onlySymbols : [],
        onlyAuthors: Array.isArray(v.onlyAuthors) ? v.onlyAuthors : [],
        modeColors: v.modeColors === 'only' ? 'only' : 'hide',
        modeSymbols: v.modeSymbols === 'only' ? 'only' : 'hide',
        modeAuthors: v.modeAuthors === 'only' ? 'only' : 'hide',
        scale: (typeof v.scale === 'number' && v.scale > 0) ? v.scale : 1
      };
    } catch (e) {
      return {
        hideColors: [], hideSymbols: [], hideAuthors: [],
        onlyColors: [], onlySymbols: [], onlyAuthors: [],
        modeColors: 'hide', modeSymbols: 'hide', modeAuthors: 'hide', scale: 1
      };
    }
  }
  function setView(v) {
    try { localStorage.setItem(LS_VIEW, JSON.stringify(v)); } catch (e) {}
  }

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
  function devCode() { try { return sessionStorage.getItem(SS_CODE) || ''; } catch (e) { return ''; } }
  function setDevCode(c) { try { c ? sessionStorage.setItem(SS_CODE, c) : sessionStorage.removeItem(SS_CODE); } catch (e) {} }

  function rest(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({
      'apikey': CFG.key, 'Authorization': 'Bearer ' + CFG.key, 'Content-Type': 'application/json'
    }, opts.headers || {});
    return fetch(CFG.url + '/rest/v1/' + path, opts);
  }

  /* Kirjoitus palvelinfunktion kautta */
  function rpc(fn, body) {
    return rest('rpc/' + fn, { method: 'POST', body: JSON.stringify(body || {}) })
      .then(function (r) {
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
  }

  function errText(e) {
    var m = String((e && e.message) || e || '');
    if (m.indexOf('BAD_PASSWORD')    > -1) return 'Vaara salasana';
    if (m.indexOf('PIN_LIMIT_REACHED')         > -1) return 'Merkkien yläraja täynnä (' + (m.split('PIN_LIMIT_REACHED:')[1]||'').replace(/\D.*$/,'') + ' merkkiä/pelaaja) — poista vanhoja merkkejä';
    if (m.indexOf('IMAGE_TOTAL_LIMIT_REACHED') > -1) return 'Koko sivuston merkkikuvien yläraja on täynnä — ota yhteyttä ylläpitoon';
    if (m.indexOf('IMAGE_LIMIT_REACHED')       > -1) return 'Kuvien yläraja täynnä (' + (m.split('IMAGE_LIMIT_REACHED:')[1]||'').replace(/\D.*$/,'') + ' kuvaa/pelaaja) — poista vanhoja kuvia';
    if (m.indexOf('NOT_WHITELISTED') > -1) return 'Pelinimi ei ole sallittujen listalla';
    if (m.indexOf('NO_RIGHTS')       > -1) return 'Ei oikeuksia — tarkista salasana ja pelinimi';
    if (m.indexOf('NO_AUTHOR')       > -1) return 'Pelinimi puuttuu';
    if (m.indexOf('NOT_FOUND')       > -1) return 'Merkkia ei loytynyt';
    return 'Toiminto ei onnistunut';
  }

  /* Kohta 9 (v2): kuvat + merkin taysi poisto — sama Edge Function kuin kartalla */
  function pinImageCall(payload) {
    return fetch(CFG.url + '/functions/v1/pin-image', {
      method: 'POST',
      headers: { 'apikey': CFG.key, 'Authorization': 'Bearer ' + CFG.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (data) {
        if (!r.ok) throw new Error((data && data.error) || ('HTTP ' + r.status));
        return data;
      });
    });
  }
  function imageDelete(imageId, c) {
    return pinImageCall({ action: 'delete', pass: c.pass, author: c.author, image_id: imageId });
  }
  function pinDeleteFull(id, c) {
    return pinImageCall({ action: 'pin_delete', pass: c.pass, author: c.author, id: id });
  }
  function plainImages() {
    return rest('pin_images?select=*&order=created_at.asc').then(function (r) { return r.ok ? r.json() : []; });
  }
  function loadImages() {
    var p = (isDev() && devCode())
      ? rpc('pin_images_all', { p_code: devCode() }).catch(plainImages)
      : plainImages();
    return p.catch(function () { return []; });
  }

  /* Pelinimi + oma salasana. Dev-tilassa yllapitokoodi kelpaa. */
  function creds(pin) {
    if (isDev() && devCode()) {
      return { pass: devCode(), author: get(LS_NAME) || (pin && pin.author) || 'dev' };
    }
    var a = get(LS_NAME);
    if (!a) { alert('Kirjoita ensin pelinimesi ylle.'); return null; }
    var pw = get(LS_PASS);
    if (!pw) { alert('Kirjoita ensin oma salasanasi ylle.'); return null; }
    return { pass: pw, author: a };
  }

  /* Naytetaan napit sille, joka voi periaatteessa muokata.
     Lopullinen tarkistus tehdaan palvelimella. */
  function mayEdit(p) {
    if (isDev()) return true;
    var n = get(LS_NAME), pw = get(LS_PASS);
    return !!n && !!pw && n.toLowerCase() === String(p.author || '').toLowerCase();
  }
  /* Kohta 9: kuvan poisto-oikeus — dev tai kuvan alun perin liittanyt
     kayttaja, ei valttamatta sama kuin merkin omistaja. */
  function mayEditImage(im) {
    if (isDev()) return true;
    var n = get(LS_NAME), pw = get(LS_PASS);
    return !!n && !!pw && !!im && !!im.added_by && n.toLowerCase() === String(im.added_by).toLowerCase();
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
      + '.pl-img{width:100%;max-height:140px;object-fit:cover;border-radius:10px;'
      + 'border:1px solid var(--line,rgba(255,255,255,.12));display:block}'
      + '.pl-imggrid{display:flex;flex-wrap:wrap;gap:8px}'
      + '.pl-imgitem{display:flex;flex-direction:column;align-items:center;gap:5px;width:78px}'
      + '.pl-imgitem img{width:78px;height:78px;object-fit:cover;border-radius:10px;'
      + 'border:1px solid var(--line,rgba(255,255,255,.12));display:block}'
      + '.pl-imgitem .pl-b{padding:4px 8px;font-size:.72rem}'
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
      + 'border:1px dashed var(--line,rgba(255,255,255,.14));border-radius:14px}'
      + '.pl-filters{display:flex;flex-wrap:wrap;gap:16px 22px;align-items:flex-start;margin:0 0 18px;'
      + 'padding:14px 16px;border-radius:14px;background:rgba(8,14,11,.45);border:1px solid var(--line,rgba(255,255,255,.1))}'
      + '.pl-fgroup{display:grid;gap:7px}'
      + '.pl-fgroup > span{font-size:11px;letter-spacing:.04em;color:var(--muted,#9db3a6)}'
      + '.pl-chips{display:flex;flex-wrap:wrap;gap:7px}'
      + '.pl-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;cursor:pointer;'
      + 'font:inherit;font-size:.78rem;color:inherit;background:rgba(255,255,255,.06);'
      + 'border:1px solid rgba(255,255,255,.18)}'
      + '.pl-chip .sw{width:10px;height:10px;border-radius:50%;flex:0 0 auto;box-shadow:0 0 0 1px rgba(0,0,0,.5)}'
      + '.pl-chip.off{opacity:.4;text-decoration:line-through}'
      + '.pl-fclear{align-self:center;margin-left:auto}'
      + '.pl-toggle{display:flex;justify-content:center;margin:4px 0 18px}'
      + '.pl-toggle__btn{display:inline-flex;align-items:center;gap:10px;padding:13px 22px;border-radius:999px;'
      + 'cursor:pointer;font:inherit;font-size:.92rem;font-weight:600;color:var(--text,#eaf3ee);'
      + 'background:rgba(62,240,138,.1);border:1px solid rgba(62,240,138,.4);transition:background .2s ease,transform .15s ease}'
      + '.pl-toggle__btn:hover{background:rgba(62,240,138,.18)}'
      + '.pl-toggle__btn:active{transform:scale(.98)}'
      + '.pl-toggle__ico{transition:transform .25s ease;display:inline-block}'
      + '.pl-toggle__btn.is-open .pl-toggle__ico{transform:rotate(180deg)}'
      + '.pl-body{display:none}'
      + '.pl-body.is-open{display:block;animation:plFadeIn .38s ease}'
      + '@keyframes plFadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}'
      /* --- haku + suodatinnappi --- */
      + '.pl-tools{display:flex;gap:10px;align-items:center;margin:0 0 14px}'
      + '.pl-q{flex:1;min-width:0;padding:11px 14px;border-radius:999px;'
      + 'background:rgba(8,14,11,.7);border:1px solid var(--line,rgba(255,255,255,.12));'
      + 'color:var(--text,#eaf3ee);font:inherit;font-size:.9rem}'
      + '.pl-q:focus{outline:none;border-color:var(--green,#3ef08a)}'
      + '.pl-b--filter{padding:10px 18px;border-radius:999px}'
      + '.pl-b--filter.on{background:rgba(62,240,138,.16);border-color:rgba(62,240,138,.5);color:#3ef08a}'
      + '.pl-fmode{display:inline-flex;gap:3px;padding:3px;border-radius:999px;'
      + 'background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);width:max-content}'
      + '.pl-fmode button{border:0;background:none;color:var(--muted,#9db3a6);font:inherit;font-size:.74rem;'
      + 'padding:4px 11px;border-radius:999px;cursor:pointer}'
      + '.pl-fmode button.is-on{background:var(--green,#3ef08a);color:#04150c;font-weight:600}'
      + '.pl-chip.pick{border-color:rgba(62,240,138,.65);background:rgba(62,240,138,.18);color:#bff7d6}'
      /* --- kortin tiivis muoto ja laajennus --- */
      + '.pl-card{transition:border-color .2s ease,transform .2s ease,box-shadow .25s ease}'
      + '.pl-card:hover{border-color:rgba(62,240,138,.45);transform:translateY(-2px);'
      + 'box-shadow:0 18px 40px -26px rgba(0,0,0,.95)}'
      + '.pl-t{cursor:pointer}'
      + '.pl-tt{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '.pl-sub{display:flex;flex-wrap:wrap;gap:10px;font-size:.8rem;color:var(--muted,#9db3a6);align-items:center}'
      + '.pl-imgn{color:#ffd166;font-weight:600}'
      + '.pl-more{display:grid;gap:9px;grid-template-rows:0fr;opacity:0;'
      + 'transition:grid-template-rows .3s ease,opacity .25s ease,margin-top .3s ease;margin-top:0}'
      + '.pl-more > *{overflow:hidden;min-height:0}'
      + '.pl-card:hover .pl-more,.pl-card:focus-within .pl-more,.pl-card.is-open .pl-more'
      + '{grid-template-rows:1fr;opacity:1;margin-top:3px}'
      + '@media (prefers-reduced-motion:reduce){.pl-more{transition:none}}'
      /* --- navigointipisteiden oma lista --- */
      + '.pl-navsec{margin-top:30px;padding-top:22px;border-top:1px dashed var(--line,rgba(255,255,255,.14))}'
      + '.pl-navh{margin:0 0 4px;font-size:1.05rem}'
      + '.pl-navnote{margin:0 0 14px;font-size:.84rem;color:var(--muted,#9db3a6)}'
      + '.pl-card.is-nav{border-style:dashed}'
      + '.pl-tag--nav{background:rgba(90,169,255,.16);color:#9ccbff;border-color:rgba(90,169,255,.4)}';
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
        '<label class="pl-f"><span>SALASANA</span><input id="pl-pass" type="password" placeholder="Oma salasanasi"></label>' +
      '</div>' +
      '<div style="display:flex;gap:8px">' +
        '<button class="pl-b" id="pl-reload">Paivita</button>' +
        '<button class="pl-b pl-b--dev" id="pl-dev">Dev</button>' +
      '</div>' +
    '</div>' +
    '<div class="pl-toggle"><button class="pl-toggle__btn" id="pl-toggle" type="button" aria-expanded="false">' +
      '<span id="pl-toggle-label">Nayta karttamerkinnat</span> <span id="pl-toggle-n"></span>' +
      '<span class="pl-toggle__ico">&#9660;</span>' +
    '</button></div>' +
    '<div class="pl-body" id="pl-body">' +
      '<div class="pl-tools">' +
        '<input id="pl-q" class="pl-q" type="search" autocomplete="off" placeholder="Hae merkkia — nimi, viesti, pelaaja tai koordinaatti">' +
        '<button class="pl-b pl-b--filter" id="pl-fbtn" type="button" aria-expanded="false">Suodatin</button>' +
      '</div>' +
      '<div class="pl-filters" id="pl-filters" hidden>' +
        fgroup('Authors', 'PELAAJA', 'pl-f-authors') +
        fgroup('Colors',  'VARI',    'pl-f-colors') +
        fgroup('Symbols', 'SYMBOLI', 'pl-f-symbols') +
        '<button class="pl-b pl-fclear" id="pl-f-reset">Nollaa oma nakyma</button>' +
      '</div>' +
      '<div class="pl-grid" id="pl-grid"></div>' +
      '<div class="pl-navsec" id="pl-navsec" hidden>' +
        '<h3 class="pl-navh">&#129517; Navigointipisteet <span class="muted" id="pl-navn"></span></h3>' +
        '<p class="pl-navnote">Reittien piirtamista varten lisatyt pisteet. Ne eivat ole kohteita, joten ne ovat omana listanaan.</p>' +
        '<div class="pl-grid pl-grid--nav" id="pl-navgrid"></div>' +
      '</div>' +
    '</div>';

  /* Suodatinryhma: sama ryhma toimii joko piilotus- tai "nayta vain"
     -tilassa. Tila on ryhmakohtainen, jotta esim. varilla voi rajata
     naytettavat merkit samalla kun pelaajia piilotetaan. */
  function fgroup(group, label, chipsId) {
    return '<div class="pl-fgroup"><span>' + label + '</span>' +
      '<div class="pl-fmode" data-g="' + group + '">' +
        '<button type="button" data-m="hide">Piilota</button>' +
        '<button type="button" data-m="only">Nayta vain</button>' +
      '</div>' +
      '<div class="pl-chips" id="' + chipsId + '"></div></div>';
  }

  var $name = document.getElementById('pl-name');
  var $pass = document.getElementById('pl-pass');
  var $grid = document.getElementById('pl-grid');
  var $navGrid = document.getElementById('pl-navgrid');
  var $navSec  = document.getElementById('pl-navsec');
  var $navN    = document.getElementById('pl-navn');
  var $n    = document.getElementById('pl-n');
  var $dev  = document.getElementById('pl-dev');
  var $q    = document.getElementById('pl-q');
  var $fBtn = document.getElementById('pl-fbtn');
  var $filters  = document.getElementById('pl-filters');
  var $fAuthors = document.getElementById('pl-f-authors');
  var $fColors  = document.getElementById('pl-f-colors');
  var $fSymbols = document.getElementById('pl-f-symbols');
  var $fReset   = document.getElementById('pl-f-reset');
  var $toggle   = document.getElementById('pl-toggle');
  var $toggleN  = document.getElementById('pl-toggle-n');
  var $toggleLabel = document.getElementById('pl-toggle-label');
  var $body    = document.getElementById('pl-body');

  var query = '';

  /* Kohta 22: lista piilossa oletuksena — ensimmainen avaus lataa/piirtaa
     kortit (ja niiden thumbnailit) vasta silloin, ei sivun ensilatauksessa. */
  var listOpened = false;
  $toggle.onclick = function () {
    listOpened = !listOpened;
    $toggle.classList.toggle('is-open', listOpened);
    $toggle.setAttribute('aria-expanded', listOpened ? 'true' : 'false');
    $toggleLabel.textContent = listOpened ? 'Piilota karttamerkinnat' : 'Nayta karttamerkinnat';
    $body.classList.toggle('is-open', listOpened);
    if (listOpened) {
      render();
      if (!imagesLoadedOnce) attachImages().then(render);
    }
  };

  $q.oninput = function () { query = $q.value.trim().toLowerCase(); render(); };
  $fBtn.onclick = function () {
    var open = $filters.hasAttribute('hidden');
    if (open) $filters.removeAttribute('hidden'); else $filters.setAttribute('hidden', '');
    $fBtn.classList.toggle('on', open);
    $fBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  $name.value = get(LS_NAME);
  $pass.value = get(LS_PASS);
  $name.oninput = function () { set(LS_NAME, $name.value.trim()); render(); };
  $pass.oninput = function () { set(LS_PASS, $pass.value); render(); };
  $dev.classList.toggle('on', isDev());

  $dev.onclick = function () {
    if (isDev()) {
      setDev(false); setDevCode(''); $dev.classList.remove('on');
      tellMap({ kspk: 'dev-state', on: false });
      load();
    } else {
      var c = prompt('Yllapitokoodi:');
      if (c === null || c === '') return;
      rpc('is_admin', { p_code: c }).then(function (ok) {
        if (ok !== true) { alert('Vaara koodi'); return; }
        setDev(true); setDevCode(c); $dev.classList.add('on');
        tellMap({ kspk: 'dev-state', on: true, code: c });
        load();
      }).catch(function () { alert('Tarkistus ei onnistunut'); });
    }
  };
  document.getElementById('pl-reload').onclick = load;

  /* ---------- oma nakyma -suodattimet (vain tama selain) ----------
     'hide'-tilassa valitut piilotetaan, 'only'-tilassa naytetaan VAIN
     valitut. Sama tallennuspaikka kuin kartalla, joten rajaus nakyy myos
     itse kartalla eika pelkastaan tassa listassa. */
  function modeOf(group) { return getView()['mode' + group] === 'only' ? 'only' : 'hide'; }
  function keyOf(group)  { return modeOf(group) + group; }

  function chip(container, group, value, label, swatch, labelIsHtml) {
    var key = keyOf(group), only = modeOf(group) === 'only';
    var v = getView();
    var on = v[key].indexOf(value) > -1;   // 'hide': piilotettu, 'only': valittu nakyviin
    var b = document.createElement('span');
    b.className = 'pl-chip' + (on ? (only ? ' pick' : ' off') : '');
    b.setAttribute('role', 'button');
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.title = only
      ? (on ? 'Naytetaan — klikkaa poistaaksesi valinnasta' : 'Klikkaa nayttaaksesi vain tama')
      : (on ? 'Piilotettu — klikkaa nayttaaksesi' : 'Nakyvissa — klikkaa piilottaaksesi');
    b.innerHTML = (swatch ? '<span class="sw" style="background:' + esc(swatch) + '"></span>' : '') +
      (labelIsHtml ? label : esc(label));
    b.onclick = function () {
      var cur = getView();
      var a = cur[key].slice();
      var i = a.indexOf(value);
      if (i > -1) a.splice(i, 1); else a.push(value);
      cur[key] = a;
      setView(cur);
      render();
      tellMap({ kspk: 'pins-reload' });
    };
    container.appendChild(b);
  }

  function renderFilters() {
    var authors = [], colors = [], symbols = [], seenA = {}, seenC = {}, seenS = {};
    rows.forEach(function (p) {
      var a = p.author || 'Nimeton';
      if (!seenA[a.toLowerCase()]) { seenA[a.toLowerCase()] = true; authors.push(a); }
      var c = p.color || '#3ef08a';
      if (!seenC[c]) { seenC[c] = true; colors.push(c); }
      var s = p.symbol || 'dot';
      if (!seenS[s]) { seenS[s] = true; symbols.push(s); }
    });
    $fAuthors.innerHTML = ''; $fColors.innerHTML = ''; $fSymbols.innerHTML = '';
    authors.forEach(function (a) { chip($fAuthors, 'Authors', a.toLowerCase(), a); });
    colors.forEach(function (c) { chip($fColors, 'Colors', c, COLOR_NAMES[c] || c, c); });
    symbols.forEach(function (s) {
      if (SYMBOL_SVG[s]) chip($fSymbols, 'Symbols', s, SYMBOL_SVG[s] + ' ' + esc(s), null, true);
      else chip($fSymbols, 'Symbols', s, SYMBOL_GLYPH[s] || s);
    });
    [].forEach.call($filters.querySelectorAll('.pl-fmode'), function (box) {
      var g = box.dataset.g, m = modeOf(g);
      [].forEach.call(box.children, function (b) {
        b.classList.toggle('is-on', b.dataset.m === m);
        b.onclick = function () {
          var cur = getView();
          cur['mode' + g] = b.dataset.m;
          setView(cur);
          render();
          tellMap({ kspk: 'pins-reload' });
        };
      });
    });
  }

  $fReset.onclick = function () {
    var v = getView();
    setView({
      hideColors: [], hideSymbols: [], hideAuthors: [],
      onlyColors: [], onlySymbols: [], onlyAuthors: [],
      modeColors: 'hide', modeSymbols: 'hide', modeAuthors: 'hide',
      scale: v.scale
    });
    render();
    tellMap({ kspk: 'pins-reload' });
  };

  /* ---------- suodatus ---------- */
  function passView(p, v) {
    var a = String(p.author || 'Nimeton').toLowerCase();
    var c = p.color || '#3ef08a';
    var s = p.symbol || 'dot';
    function ok(group, val) {
      var only = (v['mode' + group] === 'only');
      var sel = v[(only ? 'only' : 'hide') + group] || [];
      if (only) return !sel.length || sel.indexOf(val) > -1;
      return sel.indexOf(val) < 0;
    }
    return ok('Authors', a) && ok('Colors', c) && ok('Symbols', s);
  }
  function passQuery(p) {
    if (!query) return true;
    return [p.title, p.message, p.author, p.x, p.z].join(' ').toLowerCase().indexOf(query) > -1;
  }

  /* ---------- kortti ----------
     Kortti on oletuksena tiivis: nimi, vari, sijainti ja kuvien maara.
     Hiiren alla (tai klikkauksesta kosketuslaitteella) se laajenee ja
     nayttaa viestin, kuvien esikatselut ja toiminnot. */
  var NUMW = ['', 'yksi', 'kaksi', 'kolme', 'nelja', 'viisi'];
  function imgWord(n) { return (NUMW[n] || n) + ' kuva' + (n === 1 ? '' : 'a'); }

  function makeCard(p) {
    var can = mayEdit(p);
    var imgs = p.images || [];
    var c = document.createElement('div');
    c.className = 'pl-card' + (p.hidden ? ' is-hidden' : '') + (p.is_nav && !p.is_target ? ' is-nav' : '');
    c.innerHTML =
      '<div class="pl-t"><span class="pl-dot" style="background:' + esc(p.color || '#3ef08a') + '"></span>' +
        '<span class="pl-tt">' + esc(p.title) + '</span>' +
        (p.hidden ? '<span class="pl-tag">Piilotettu</span>' : '') +
        (p.is_nav && p.is_target ? '<span class="pl-tag pl-tag--nav">Myos navigointi</span>' : '') +
      '</div>' +
      '<div class="pl-sub">' +
        '<span>&#128205; X ' + p.x + ', Z ' + p.z + '</span>' +
        (imgs.length ? '<span class="pl-imgn">&#128247; ' + imgWord(imgs.length) + '</span>' : '') +
      '</div>' +
      '<div class="pl-more">' +
        (imgs.length ? '<div class="pl-imggrid" data-imggrid></div>' : '') +
        (p.message ? '<p class="pl-msg">' + esc(p.message) + '</p>' : '') +
        '<div class="pl-meta"><span>&#128100; ' + esc(p.author || 'Nimeton') + '</span>' +
          '<span>' + esc(COLOR_NAMES[p.color || '#3ef08a'] || (p.color || '')) + '</span>' +
          '<span>' + esc(p.symbol || 'dot') + '</span>' +
          (p.created_at ? '<span>' + esc(String(p.created_at).slice(0, 10)) + '</span>' : '') +
        '</div>' +
        '<div class="pl-acts">' +
          '<button class="pl-b" data-a="go">Nayta kartalla</button>' +
          (can ? '<button class="pl-b" data-a="hide">' + (p.hidden ? 'Nayta' : 'Piilota') + '</button>' : '') +
          (can ? '<button class="pl-b" data-a="kind">' + (p.is_nav ? 'Poista navigoinnista' : 'Merkitse navigoinniksi') + '</button>' : '') +
          (can ? '<button class="pl-b pl-b--danger" data-a="del">Poista</button>' : '') +
        '</div>' +
      '</div>';

    /* Kosketuslaitteella ei ole hoveria, joten kortin saa auki myos
       napauttamalla sen otsikkoriviä. */
    c.querySelector('.pl-t').onclick = function () { c.classList.toggle('is-open'); };

    var imggrid = c.querySelector('[data-imggrid]');
    if (imggrid) {
      imgs.forEach(function (im) {
        var item = document.createElement('div');
        item.className = 'pl-imgitem';
        var canImg = mayEditImage(im);
        item.innerHTML =
          '<a href="' + esc(im.full_url) + '" target="_blank" rel="noopener">' +
            '<img src="' + esc(im.thumb_url) + '" alt="Merkin kuva" loading="lazy"></a>' +
          (canImg ? '<button class="pl-b pl-b--danger" type="button">Poista</button>' : '');
        var b = item.querySelector('button');
        if (b) b.onclick = function () {
          if (!confirm('Poistetaanko tama kuva merkilta "' + p.title + '"? Itse merkki sailyy.')) return;
          var cr = creds(p);
          if (!cr) return;
          b.disabled = true;
          imageDelete(im.id, cr).then(function () {
            p.images = (p.images || []).filter(function (o) { return o.id !== im.id; });
            render(); tellMap({ kspk: 'pins-reload' });
          }).catch(function (e) { alert(errText(e)); b.disabled = false; });
        };
        imggrid.appendChild(item);
      });
    }

    c.querySelector('[data-a="go"]').onclick = function () {
      tellMap({ kspk: 'pins-focus', id: p.id });
      var mf = document.querySelector('.map-frame');
      if (mf) mf.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    var h = c.querySelector('[data-a="hide"]');
    if (h) h.onclick = function () {
      var nv = !p.hidden;
      var cr = creds(p);
      if (!cr) return;
      rpc('pin_edit', {
        p_pass: cr.pass, p_author: cr.author, p_id: p.id,
        p_title: null, p_message: null, p_color: null,
        p_x: null, p_z: null, p_hidden: nv
      }).then(function () {
        p.hidden = nv; render(); tellMap({ kspk: 'pins-reload' });
      }).catch(function (e) { alert(errText(e)); });
    };
    var k = c.querySelector('[data-a="kind"]');
    if (k) k.onclick = function () {
      var cr = creds(p);
      if (!cr) return;
      var nav = !p.is_nav;
      /* Merkin on kuuluttava ainakin toiseen listaan: jos navigointi
         otetaan pois, se palaa kohteeksi. */
      var tgt = nav ? (p.is_target !== false) : true;
      k.disabled = true;
      rpc('pin_set_kind', {
        p_pass: cr.pass, p_author: cr.author, p_id: p.id,
        p_is_target: tgt, p_is_nav: nav
      }).then(function () {
        p.is_nav = nav; p.is_target = tgt;
        render(); tellMap({ kspk: 'pins-reload' });
      }).catch(function (e) { alert(errText(e)); k.disabled = false; });
    };
    var d = c.querySelector('[data-a="del"]');
    if (d) d.onclick = function () {
      if (!confirm('Poistetaanko merkki "' + p.title + '"? Tata ei voi perua — myos sen kuvat poistuvat.')) return;
      var cr = creds(p);
      if (!cr) return;
      pinDeleteFull(p.id, cr)
        .then(function () {
          rows = rows.filter(function (o) { return o.id !== p.id; });
          render(); tellMap({ kspk: 'pins-reload' });
        }).catch(function (e) { alert(errText(e)); });
    };
    return c;
  }

  /* ---------- piirto ---------- */
  function render() {
    var dev = isDev();
    var v = getView();
    var visible = rows.filter(function (p) {
      /* Piilotettu merkki jaa nakyviin (tummempana) VAIN devlle tai sen
         omalle tekijalle — muilta se puuttuu jo palvelimen RLS:sta. */
      if (p.hidden && !dev && !mayEdit(p)) return false;
      if (!passView(p, v)) return false;
      return passQuery(p);
    });
    /* Navigointipisteet ovat merkkeja joilla on vain navigointi-luokka. */
    var navs    = visible.filter(function (p) { return p.is_nav && p.is_target === false; });
    var targets = visible.filter(function (p) { return !(p.is_nav && p.is_target === false); });

    $n.textContent = '(' + visible.length + ')';
    if ($toggleN) $toggleN.textContent = '(' + visible.length + ')';

    /* Kohta 22: kortit (ja niiden kuvat) rakennetaan DOMiin vasta kun
       lista on avattu — muuten thumbnailit alkaisivat latautua heti kun
       sivu aukeaa, vaikka kayttaja ei olisi viela edes avannut listaa. */
    if (!listOpened) return;

    renderFilters();

    $grid.innerHTML = '';
    if (!targets.length) {
      $grid.innerHTML = '<div class="pl-empty">' +
        (query || rows.length
          ? 'Ei osumia nailla hakuehdoilla.'
          : 'Ei viela yhtaan merkkia. Avaa kartta, klikkaa oikealla tai napauta kolmesti — ja lisaa ensimmainen.') +
        '</div>';
    } else {
      targets.forEach(function (p) { $grid.appendChild(makeCard(p)); });
    }

    $navGrid.innerHTML = '';
    if (navs.length) {
      $navSec.removeAttribute('hidden');
      $navN.textContent = '(' + navs.length + ')';
      navs.forEach(function (p) { $navGrid.appendChild(makeCard(p)); });
    } else {
      $navSec.setAttribute('hidden', '');
    }
  }

  function plainLoad() {
    return rest(CFG.table + '?select=*&order=created_at.desc')
      .then(function (r) { return r.ok ? r.json() : []; });
  }
  /* Oman piilotetun merkin saa nakyviin listaan (tummempana, Nayta-napilla)
     vaikka RLS piilottaa hidden=true-rivit muilta — pins_mine tarkistaa
     salasanan palvelimella ja palauttaa vain kutsujan omat piilotetut. */
  function loadMineHidden() {
    var n = get(LS_NAME), pw = get(LS_PASS);
    if (!n || !pw) return Promise.resolve({ pins: [], images: [] });
    return Promise.all([
      rpc('pins_mine', { p_pass: pw, p_author: n }).catch(function () { return []; }),
      rpc('pin_images_mine', { p_pass: pw, p_author: n }).catch(function () { return []; })
    ]).then(function (arr) { return { pins: arr[0] || [], images: arr[1] || [] }; });
  }
  /* Kohta 22: kuvia EI haeta ollenkaan ennen kuin lista on avattu kerran —
     muuten kaikkien merkkien thumbnailit alkaisivat ladata heti sivun
     avautuessa. imagesLoadedOnce estaa turhat toistuvat hakukierrokset. */
  var imagesLoadedOnce = false;
  function attachImages() {
    var dev = isDev() && devCode();
    var imagesP = loadImages();
    var mineImgP = dev ? Promise.resolve([]) : loadMineHidden().then(function (m) { return m.images || []; });
    return Promise.all([imagesP, mineImgP]).then(function (arr) {
      var images = (arr[0] || []).slice();
      var imgIds = {};
      images.forEach(function (im) { imgIds[im.id] = true; });
      (arr[1] || []).forEach(function (im) { if (!imgIds[im.id]) { images.push(im); imgIds[im.id] = true; } });
      var byPin = {};
      images.forEach(function (im) { (byPin[im.pin_id] = byPin[im.pin_id] || []).push(im); });
      rows.forEach(function (p) { p.images = byPin[p.id] || []; });
      imagesLoadedOnce = true;
    }).catch(function () {});
  }

  function load() {
    /* Piilotetut merkit eivat tule API:sta lapi — dev hakee ne
       pins_all-funktiolla, joka tarkistaa koodin palvelimella. */
    var dev = isDev() && devCode();
    var pinsP = dev
      ? rpc('pins_all', { p_code: devCode() }).then(function (r) { return (r || []).slice().reverse(); }).catch(plainLoad)
      : plainLoad();
    var mineP = dev ? Promise.resolve({ pins: [], images: [] }) : loadMineHidden();

    return Promise.all([pinsP, mineP]).then(function (arr) {
      var basePins = arr[0] || [], mine = arr[1] || { pins: [], images: [] };
      var ids = {};
      basePins.forEach(function (p) { ids[p.id] = true; });
      mine.pins.forEach(function (p) { if (!ids[p.id]) { basePins.push(p); ids[p.id] = true; } });

      /* Sailytetaan jo ladatut kuvat merkin id:n kautta, jos lista on ollut
         auki ja taustapaivitys (polling/realtime) hakee merkit uudestaan. */
      var prevImages = {};
      rows.forEach(function (p) { if (p.images) prevImages[p.id] = p.images; });
      basePins.forEach(function (p) { if (prevImages[p.id]) p.images = prevImages[p.id]; });

      rows = basePins;
      if (listOpened && imagesLoadedOnce) {
        attachImages().then(render);
        render();
      } else {
        render();
      }
    }).catch(function () { rows = []; render(); });
  }

  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || !d.kspk) return;
    if (d.kspk === 'pins-changed') load();
    if (d.kspk === 'dev-state') {
      setDev(!!d.on);
      if (d.code) setDevCode(d.code); else if (!d.on) setDevCode('');
      $dev.classList.toggle('on', !!d.on);
      load();
    }
  });

  /* Footerin dev-kirjautuminen (site.js) ilmoittaa muutoksesta */
  window.addEventListener('kspk-dev', function () {
    $dev.classList.toggle('on', isDev());
    tellMap({ kspk: 'dev-state', on: isDev(), code: devCode() });
    load();
  });

  /* ---------- kohta 24: reaaliaikainen paivitys (Supabase Realtime) ----------
     Kun joku muuttaa/lisaa/poistaa merkin tai kuvan, kaikki avoinna olevat
     sivut paivittyvat saman tien ilman 45s pollausviivetta. Pollaus jatetaan
     rinnalle varajarjestelmaksi siltä varalta ettei realtime-yhteys toimisi
     (esim. palomuuri estaa WebSocketin). */
  var debounceTimer = null;
  function debouncedLoad() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(load, 250);
  }
  (function initRealtime() {
    if (typeof window.supabase === 'undefined' || !window.supabase.createClient) return;
    try {
      var sb = window.supabase.createClient(CFG.url, CFG.key);
      var ch = sb.channel('kspk-pins-changes');
      ['pins', 'pin_images'].forEach(function (table) {
        ch.on('postgres_changes', { event: '*', schema: 'public', table: table }, debouncedLoad);
      });
      ch.subscribe();
    } catch (e) { /* realtime ei kaynnistynyt — pollaus riittaa varajarjestelmaksi */ }
  })();

  load();
  setInterval(load, 45000);
})();
