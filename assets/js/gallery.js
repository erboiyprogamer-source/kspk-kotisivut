/* =====================================================================
   gallery.js — kayttajien omat galleriakuvat (galleria.html)
   ---------------------------------------------------------------------
   Sama pelinimi + salasana -jarjestelma kuin karttamerkeissa (players-
   taulu, check_player/is_admin palvelimella). Kuvat muutetaan WebP:ksi
   selaimessa (canvas) ennen lahetysta, tavoite ~100 kt/kuva. Rajat:
   yksi pelaaja max 50 kuvaa, koko galleria max 200 kuvaa — palvelin
   tarkistaa nama lopullisesti Edge Functionissa.

   "featured" (Sivuston oma / arvostettujen kuvien galleria): dev voi
   nostaa minkä tahansa yhteisön kuvan #gallery-official-listaan ilman
   GitHub-committia. Nostetulle kuvalle voi kirjoittaa pidemman
   kuvatekstin (featured_caption) ja perustelun (featured_reason), jotka
   nakyvat omassa scrollattavassa suurennetussa nakymassa.
   ===================================================================== */
(function () {
  'use strict';

  var root = document.getElementById('gallery-dynamic');
  var officialRoot = document.getElementById('gallery-official');
  var formEl = document.getElementById('gallery-upload');
  if (!root && !formEl && !officialRoot) return;

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
    if (m.indexOf('NO_RIGHTS')       > -1) return 'Ei oikeuksia tahan toimintoon';
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

  /* ---------- "sivuston oma" -suurennos (scrollattava tarina) ---------- */
  var fviewer = null;
  function ensureFviewer() {
    if (fviewer) return fviewer;
    fviewer = document.createElement('div');
    fviewer.className = 'fviewer';
    fviewer.innerHTML =
      '<button type="button" class="fviewer__close" aria-label="Sulje">&times;</button>' +
      '<div class="fviewer__hero"><img alt=""><span class="fviewer__hint">Skrollaa alas &darr;</span></div>' +
      '<div class="fviewer__body">' +
        '<div class="fviewer__cap"></div>' +
        '<div class="fviewer__why" hidden><h3>Miksi tämä kuva ansaitsi paikkansa arvostettujen kuvien galleriassa</h3><p></p></div>' +
      '</div>';
    document.body.appendChild(fviewer);
    var close = function () { fviewer.classList.remove('is-open'); document.body.style.overflow = ''; };
    fviewer.querySelector('.fviewer__close').addEventListener('click', close);
    fviewer.addEventListener('scroll', function () {
      fviewer.classList.toggle('scrolled', fviewer.scrollTop > 40);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && fviewer.classList.contains('is-open')) close(); });
    fviewer._close = close;
    return fviewer;
  }
  function openFeaturedViewer(row) {
    var v = ensureFviewer();
    var img = v.querySelector('.fviewer__hero img');
    var cap = v.querySelector('.fviewer__cap');
    var why = v.querySelector('.fviewer__why');
    var whyP = why.querySelector('p');
    img.src = row.url; img.alt = row.caption || 'Galleriakuva';
    var capText = row.featured_caption || row.caption || '';
    cap.textContent = capText;
    cap.hidden = !capText;
    if (row.featured_reason) { whyP.textContent = row.featured_reason; why.hidden = false; }
    else { why.hidden = true; }
    v.scrollTop = 0; v.classList.remove('scrolled');
    v.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  /* ---------- dev: siirra/muokkaa "sivuston omaan" ---------- */
  var promoteModal = null;
  function ensurePromoteModal() {
    if (promoteModal) return promoteModal;
    promoteModal = document.createElement('div');
    promoteModal.className = 'fpromote';
    promoteModal.innerHTML =
      '<div class="fpromote__box">' +
        '<h3>Siirrä sivuston omiin kuviin</h3>' +
        '<p class="fpromote__lead">Kuva näkyy jatkossa "Sivuston oma galleria" -osiossa. Voit kirjoittaa pidemmän ' +
        'artikkelimaisen kuvatekstin ja kertoa miksi kuva ansaitsi paikkansa.</p>' +
        '<label>Kuvateksti / artikkeli<textarea class="fp-cap" rows="5" placeholder="Kerro kuvan tarina..."></textarea></label>' +
        '<label>Miksi kuva ansaitsi paikkansa?<textarea class="fp-reason" rows="4" placeholder="Miksi juuri tämä kuva kuuluu arvostettujen joukkoon?"></textarea></label>' +
        '<p class="fpromote__status"></p>' +
        '<div class="fpromote__actions">' +
          '<button type="button" class="btn btn--solid fp-ok">Siirrä</button>' +
          '<button type="button" class="btn fp-cancel">Peruuta</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(promoteModal);
    promoteModal.addEventListener('click', function (e) { if (e.target === promoteModal) close(); });
    var close = function () { promoteModal.classList.remove('is-open'); };
    promoteModal.querySelector('.fp-cancel').addEventListener('click', close);
    promoteModal._close = close;
    return promoteModal;
  }
  function openPromoteModal(row, onDone) {
    var m = ensurePromoteModal();
    var capEl = m.querySelector('.fp-cap'), reasonEl = m.querySelector('.fp-reason'), status = m.querySelector('.fpromote__status');
    var okBtn = m.querySelector('.fp-ok');
    m.querySelector('h3').textContent = row.featured ? 'Muokkaa sivuston omaa kuvaa' : 'Siirrä sivuston omiin kuviin';
    okBtn.textContent = row.featured ? 'Tallenna' : 'Siirrä';
    capEl.value = row.featured_caption || row.caption || '';
    reasonEl.value = row.featured_reason || '';
    status.textContent = ''; status.className = 'fpromote__status';
    okBtn.disabled = false;
    okBtn.onclick = function () {
      okBtn.disabled = true;
      status.textContent = 'Tallennetaan...'; status.className = 'fpromote__status';
      galleryCall({
        action: 'feature', pass: devCode(), author: 'dev', id: row.id,
        featured: true, featured_caption: capEl.value.trim(), featured_reason: reasonEl.value.trim()
      }).then(function (updated) {
        m.classList.remove('is-open');
        onDone(updated);
      }).catch(function (e) {
        status.textContent = errText(e); status.className = 'fpromote__status bad'; okBtn.disabled = false;
      });
    };
    m.classList.add('is-open');
    capEl.focus();
  }
  function unfeature(row, onDone) {
    if (!confirm('Poistetaanko kuva sivuston omasta galleriasta? Kuva jää edelleen yhteisön galleriaan.')) return;
    galleryCall({ action: 'feature', pass: devCode(), author: 'dev', id: row.id, featured: false })
      .then(onDone)
      .catch(function (e) { alert(errText(e)); });
  }

  /* ---------- lista + piirto ---------- */
  var rows = [];

  function actionBtn(cls, label, title) {
    return '<button type="button" class="gallery__action ' + cls + '" title="' + esc(title) + '">' + label + '</button>';
  }

  function figureEl(row) {
    var f = document.createElement('figure');
    var buttons = '';
    if (mayEdit(row)) buttons += '<button type="button" class="gallery__del" title="Poista kuva" aria-label="Poista kuva">&times;</button>';
    if (isDev() && !row.featured) buttons += actionBtn('gallery__promote', '&rarr;', 'Siirrä Sivuston omiin kuviin');
    f.innerHTML =
      '<img loading="lazy" src="' + esc(row.url) + '" alt="' + esc(row.caption || 'Galleriakuva') + '">' +
      buttons +
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
        renderList();
      }).catch(function (e) { alert(errText(e)); del.disabled = false; });
    });
    var promote = f.querySelector('.gallery__promote');
    if (promote) promote.addEventListener('click', function () {
      openPromoteModal(row, function (updated) {
        var i = rows.findIndex(function (o) { return o.id === updated.id; });
        if (i > -1) rows[i] = updated;
        renderList();
      });
    });
    return f;
  }

  function officialFigureEl(row) {
    var f = document.createElement('figure');
    f.className = 'gallery__promoted';
    var buttons = '';
    if (isDev()) {
      buttons += actionBtn('gallery__edit', '&#9998;', 'Muokkaa kuvatekstiä ja perustelua');
      buttons += actionBtn('gallery__unfeature', '&#8617;', 'Palauta yhteisön galleriaan');
      buttons += '<button type="button" class="gallery__del" title="Poista kuva kokonaan" aria-label="Poista kuva">&times;</button>';
    }
    f.innerHTML =
      '<img loading="lazy" src="' + esc(row.url) + '" alt="' + esc(row.caption || 'Galleriakuva') + '">' +
      buttons +
      '<figcaption>' + esc(row.caption || row.added_by || '') + '</figcaption>';
    f.addEventListener('click', function (e) {
      if (e.target.closest('button')) return;
      e.stopPropagation();
      openFeaturedViewer(row);
    });
    var edit = f.querySelector('.gallery__edit');
    if (edit) edit.addEventListener('click', function (e) {
      e.stopPropagation();
      openPromoteModal(row, function (updated) {
        var i = rows.findIndex(function (o) { return o.id === updated.id; });
        if (i > -1) rows[i] = updated;
        renderList();
      });
    });
    var unf = f.querySelector('.gallery__unfeature');
    if (unf) unf.addEventListener('click', function (e) {
      e.stopPropagation();
      unfeature(row, function (updated) {
        var i = rows.findIndex(function (o) { return o.id === updated.id; });
        if (i > -1) rows[i] = updated;
        renderList();
      });
    });
    var del = f.querySelector('.gallery__del');
    if (del) del.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!confirm('Poistetaanko tama kuva kokonaan galleriasta? Tata ei voi perua.')) return;
      del.disabled = true;
      galleryCall({ action: 'delete', pass: devCode(), author: 'dev', id: row.id }).then(function () {
        rows = rows.filter(function (o) { return o.id !== row.id; });
        renderList();
      }).catch(function (e2) { alert(errText(e2)); del.disabled = false; });
    });
    return f;
  }

  function renderList() {
    if (root) {
      root.innerHTML = '';
      rows.filter(function (r) { return !r.featured; }).forEach(function (row) { root.appendChild(figureEl(row)); });
    }
    if (officialRoot) {
      officialRoot.querySelectorAll('.gallery__promoted').forEach(function (n) { n.remove(); });
      rows.filter(function (r) { return r.featured; }).forEach(function (row) { officialRoot.appendChild(officialFigureEl(row)); });
    }
    updateCounts();
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
    }).catch(function () { rows = []; renderList(); });
  }

  window.addEventListener('kspk-dev', renderList);

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
