/* =====================================================================
   gallery.js — kayttajien omat galleriakuvat (galleria.html)
   ---------------------------------------------------------------------
   Sama pelinimi + salasana -jarjestelma kuin karttamerkeissa (players-
   taulu, check_player/is_admin palvelimella). Kuvat muutetaan WebP:ksi
   selaimessa (canvas) ennen lahetysta, tavoite ~100 kt/kuva. Rajat:
   yksi pelaaja max 50 kuvaa, koko galleria max 200 kuvaa — palvelin
   tarkistaa nama lopullisesti Edge Functionissa.
   ===================================================================== */
(function () {
  'use strict';

  var root = document.getElementById('gallery-dynamic');
  var formEl = document.getElementById('gallery-upload');
  if (!root && !formEl) return;

  var CFG = {
    url: 'https://zfgwjxtruqoacxtkqprp.supabase.co',
    key: 'sb_publishable_MwLjfXP5LCtZe8tZ3IIf7w_5a3zqoKc'
  };
  var LS_NAME = 'kspk.pins.name';
  var LS_PASS = 'kspk.pins.pass';
  var SS_DEV  = 'kspk.pins.dev';
  var SS_CODE = 'kspk.pins.devcode';

  var MAX_PER_USER = 50;
  var MAX_TOTAL = 200;
  var TARGET_BYTES = 100 * 1024;
  var MAX_DIM = 1600;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }
  function get(k, d) { try { return localStorage.getItem(k) || d || ''; } catch (e) { return d || ''; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function isDev() { try { return sessionStorage.getItem(SS_DEV) === '1'; } catch (e) { return false; } }
  function devCode() { try { return sessionStorage.getItem(SS_CODE) || ''; } catch (e) { return ''; } }

  function rest(path) {
    return fetch(CFG.url + '/rest/v1/' + path, {
      headers: { apikey: CFG.key, Authorization: 'Bearer ' + CFG.key }
    });
  }
  function galleryCall(payload) {
    return fetch(CFG.url + '/functions/v1/gallery-image', {
      method: 'POST',
      headers: { apikey: CFG.key, Authorization: 'Bearer ' + CFG.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (data) {
        if (!r.ok) throw new Error((data && data.error) || ('HTTP ' + r.status));
        return data;
      });
    });
  }
  function errText(e) {
    var m = String((e && e.message) || e || '');
    if (m.indexOf('BAD_PASSWORD')    > -1) return 'Vaara salasana';
    if (m.indexOf('NOT_WHITELISTED') > -1) return 'Pelinimi ei ole sallittujen listalla';
    if (m.indexOf('NO_AUTHOR')       > -1) return 'Pelinimi puuttuu';
    if (m.indexOf('NO_RIGHTS')       > -1) return 'Ei oikeuksia poistaa tata kuvaa';
    if (m.indexOf('USER_LIMIT')      > -1) return 'Olet jo lisannyt enimmaismaaran kuvia (' + MAX_PER_USER + ')';
    if (m.indexOf('TOTAL_LIMIT')     > -1) return 'Galleria on taynna (' + MAX_TOTAL + ' kuvaa) — poista ensin jokin kuva';
    if (m.indexOf('IMAGE_TOO_BIG')   > -1) return 'Kuva on liian iso pakkauksen jalkeenkin';
    if (m.indexOf('NOT_FOUND')       > -1) return 'Kuvaa ei loytynyt';
    return 'Toiminto ei onnistunut';
  }
  function mayEdit(row) {
    if (isDev()) return true;
    var n = get(LS_NAME);
    return !!n && !!row.added_by && n.toLowerCase() === String(row.added_by).toLowerCase();
  }

  /* ---------- kuvan pakkaus WebP:ksi (canvas) ---------- */
  function loadImageFile(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { resolve({ img: img, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('IMG_LOAD_FAILED')); };
      img.src = url;
    });
  }
  function canvasWebp(img, maxDim, quality) {
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    var scale = Math.min(1, maxDim / Math.max(w, h));
    var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
    var cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    cv.getContext('2d').drawImage(img, 0, 0, cw, ch);
    return new Promise(function (resolve) { cv.toBlob(function (b) { resolve(b); }, 'image/webp', quality); });
  }
  function shrinkToTarget(img, maxDim, targetBytes) {
    var qualities = [0.82, 0.7, 0.58, 0.46, 0.36, 0.28, 0.2];
    var i = 0, best = null;
    function next() {
      if (i >= qualities.length) return Promise.resolve(best);
      var q = qualities[i++];
      return canvasWebp(img, maxDim, q).then(function (b) {
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
  function compressToWebp(file) {
    return loadImageFile(file).then(function (loaded) {
      return shrinkToTarget(loaded.img, MAX_DIM, TARGET_BYTES).then(function (blob) {
        URL.revokeObjectURL(loaded.url);
        if (!blob) throw new Error('COMPRESS_FAILED');
        return blobToBase64(blob).then(function (b64) { return { b64: b64, bytes: blob.size }; });
      });
    });
  }

  /* ---------- lista + piirto ---------- */
  var rows = [];

  function figureEl(row) {
    var f = document.createElement('figure');
    f.innerHTML =
      '<img loading="lazy" src="' + esc(row.url) + '" alt="' + esc(row.caption || 'Galleriakuva') + '">' +
      (mayEdit(row) ? '<button type="button" class="gallery__del" title="Poista kuva" aria-label="Poista kuva">&times;</button>' : '') +
      (row.caption || row.added_by ? '<figcaption>' + esc(row.caption || '') +
        (row.caption && row.added_by ? ' &middot; ' : '') +
        (row.added_by ? esc(row.added_by) : '') + '</figcaption>' : '');
    var del = f.querySelector('.gallery__del');
    if (del) del.addEventListener('click', function () {
      if (!confirm('Poistetaanko tama kuva galleriasta? Tata ei voi perua.')) return;
      var n = get(LS_NAME), pw = get(LS_PASS);
      var pass = isDev() ? devCode() : pw;
      if (!isDev() && (!n || !pw)) { alert('Kirjoita ensin pelinimesi ja salasanasi lomakkeeseen.'); return; }
      del.disabled = true;
      galleryCall({ action: 'delete', pass: pass, author: n || 'dev', id: row.id }).then(function () {
        rows = rows.filter(function (o) { return o.id !== row.id; });
        f.remove();
        updateCounts();
      }).catch(function (e) { alert(errText(e)); del.disabled = false; });
    });
    return f;
  }

  function renderList() {
    if (!root) return;
    root.innerHTML = '';
    rows.forEach(function (row) { root.appendChild(figureEl(row)); });
  }

  function updateCounts() {
    var elCount = document.getElementById('gup-count');
    if (!elCount) return;
    var n = get(LS_NAME).toLowerCase();
    var mine = n ? rows.filter(function (r) { return String(r.added_by || '').toLowerCase() === n; }).length : 0;
    elCount.textContent = 'Galleriassa ' + rows.length + '/' + MAX_TOTAL + ' kuvaa' +
      (n ? ' — omia kuvia ' + mine + '/' + MAX_PER_USER : '');
  }

  function load() {
    return rest('gallery_images?select=*&order=created_at.desc').then(function (r) {
      return r.ok ? r.json() : [];
    }).then(function (r) {
      rows = r || [];
      renderList();
      updateCounts();
    }).catch(function () { rows = []; renderList(); updateCounts(); });
  }

  /* ---------- lisayslomake ---------- */
  if (formEl) {
    var $name = document.getElementById('gup-name');
    var $pass = document.getElementById('gup-pass');
    var $file = document.getElementById('gup-file');
    var $cap  = document.getElementById('gup-caption');
    var $status = document.getElementById('gup-status');
    var $submit = document.getElementById('gup-submit');

    if ($name) $name.value = get(LS_NAME);
    if ($pass) $pass.value = get(LS_PASS);
    if ($name) $name.oninput = function () { set(LS_NAME, $name.value.trim()); updateCounts(); };
    if ($pass) $pass.oninput = function () { set(LS_PASS, $pass.value); };

    function status(text, kind) {
      if (!$status) return;
      $status.textContent = text || '';
      $status.className = 'gup__status' + (kind ? ' ' + kind : '');
    }

    formEl.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var name = ($name && $name.value.trim()) || '';
      var pass = ($pass && $pass.value) || '';
      var f = $file && $file.files && $file.files[0];
      if (!name) { status('Kirjoita pelinimesi.', 'bad'); return; }
      if (!pass) { status('Kirjoita salasanasi.', 'bad'); return; }
      if (!f) { status('Valitse ensin kuvatiedosto.', 'bad'); return; }
      set(LS_NAME, name); set(LS_PASS, pass);

      $submit.disabled = true;
      status('Pakataan kuvaa (WebP)...');
      compressToWebp(f).then(function (res) {
        status('Ladataan palvelimelle...');
        return galleryCall({
          action: 'add', pass: pass, author: name,
          image: res.b64, caption: ($cap && $cap.value.trim()) || ''
        });
      }).then(function (row) {
        rows.unshift(row);
        renderList();
        updateCounts();
        if ($file) $file.value = '';
        if ($cap) $cap.value = '';
        status('Kuva lisatty galleriaan!', 'ok');
      }).catch(function (e) {
        status(errText(e), 'bad');
      }).then(function () { $submit.disabled = false; });
    });
  }

  load();
})();
