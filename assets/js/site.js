/* =====================================================================
   site.js — sivuston ASETUKSET + jaettu navigaatio ja footer
   ---------------------------------------------------------------------
   ► UUDEN SIVUN LISÄÄMINEN:
     1) Kopioi _template.html ja nimeä se esim. "tapahtumat.html"
     2) Lisää alle SITE.pages-listaan uusi rivi:
            { href:'tapahtumat.html', label:'Tapahtumat' }
     3) Valmista. Navi, footer ja aktiivinen linkki päivittyvät itsestään.

   ► Merkitse piilotettu sivu (ei navissa) lisäämällä: hidden:true
   ► Merkitse footer-linkiksi lisäämällä: foot:'Yhteisö'
   ===================================================================== */

const SITE = {
  name:      'K-S-P-K',
  full:      'K-S-P-K Minecraft SMP',
  tagline:   'Minecraft-sisältöä suomeksi',
  youtube:   'https://www.youtube.com/@K-S-P-K_Minecraft_Official',      // ← vaihda oikeaan URLiin
  discord:   '#',
  tiktok:    '#',
  email:     'kasapeka.official@gmail.com',
  serverIp:  'play.kspk.fi',                          // ← vaihda oikeaan IP:hen
  // uNmINeD-kartat. Kumpikin on oma kansionsa jossa on index.html + lib/ + tiles/
  mapDay:    'kartta/paiva/index.html',
  mapNight:  'kartta/yo/index.html',

  pages: [
    { href:'index.html',     label:'Etusivu',    foot:'Sivusto' },
    { href:'videot.html',    label:'Videot',     foot:'Sivusto' },
    { href:'galleria.html',  label:'Galleria',   foot:'Sivusto' },
    { href:'serveri.html',   label:'Serveri',    foot:'Yhteisö' },
    { href:'kartta.html',    label:'Kartta',     foot:'Yhteisö' },
    { href:'projektit.html', label:'Dokumentit', foot:'Yhteisö' },
    { href:'tietoa.html',    label:'Tietoa',     foot:'Sivusto' }
  ],

  /* ===================================================================
     GOOGLE DOCS -LINKIT  (näkyvät sivulla projektit.html)
     -------------------------------------------------------------------
     Lisää uusi linkki kopioimalla yksi rivi alta.
       name : otsikko kortissa
       desc : lyhyt kuvaus
       url  : Google Docsin / Sheetsin / Driven osoite (liitä tähän)
       type : 'doc' | 'sheet' | 'slide' | 'form' | 'drive'
     =================================================================== */
  docs: [
    { type:'sheet', name:'Kirjanpito — päätilikirja',
      desc:'Kaikki tulot ja menot yhdessä taulukossa, kuukausittain eriteltynä.',
      url:'#' },
    { type:'sheet', name:'Kuukausiraportti',
      desc:'Yhteenveto kuukauden saldosta ja isoimmista eristä.',
      url:'#' },
    { type:'drive', name:'Kuitit ja tositteet',
      desc:'Skannatut kuitit ja laskut Drive-kansiossa päivämäärän mukaan.',
      url:'#' },
    { type:'doc',   name:'Projektisuunnitelma',
      desc:'Tavoitteet, aikataulu ja vastuut. Päivitetään viikoittain.',
      url:'#' },
    { type:'doc',   name:'Tehtävälista',
      desc:'Mitä on tekemättä, kuka tekee ja mihin mennessä.',
      url:'#' },
    { type:'doc',   name:'Videoideat',
      desc:'Kerätyt ideat ja käsikirjoitusluonnokset tuleviin jaksoihin.',
      url:'#' },
    { type:'slide', name:'Yhteistyöesittely',
      desc:'Kanavan esittelydiat yhteistyökumppaneille.',
      url:'#' },
    { type:'drive', name:'Materiaalipankki',
      desc:'Kansikuvat, musiikit ja raakamateriaali yhdessä paikassa.',
      url:'#' }
  ]
};

/* Google-dokumenttityyppien ulkoasu */
const DOC_TYPES = {
  doc:   { ico:'📄', tag:'Google Docs',   cls:'tag--sky' },
  sheet: { ico:'📊', tag:'Google Sheets', cls:'' },
  slide: { ico:'📽️', tag:'Google Slides', cls:'tag--gold' },
  form:  { ico:'📝', tag:'Google Forms',  cls:'tag--sky' },
  drive: { ico:'🗂️', tag:'Google Drive',  cls:'tag--dim' }
};

/* --------------------------------------------------------------- */
(function buildChrome(){
  const path = location.pathname.split('/').pop() || 'index.html';

  /* ---- Navigaatio ---- */
  const links = SITE.pages.filter(p => !p.hidden).map(p =>
    `<li><a href="${p.href}"${p.href === path ? ' aria-current="page"' : ''}>${p.label}</a></li>`
  ).join('');

  const nav = document.createElement('header');
  nav.className = 'nav';
  nav.innerHTML = `
    <div class="nav__inner">
      <a class="brand" href="index.html" aria-label="${SITE.full} — etusivu">
        <span class="brand__mark" aria-hidden="true">K</span>
        <span class="brand__txt"><b>${SITE.name}</b><span>Minecraft Official</span></span>
      </a>
      <nav aria-label="Päävalikko">
        <ul class="nav__links">${links}</ul>
      </nav>
      <a class="btn btn--solid btn--sm nav__cta" href="${SITE.youtube}" target="_blank" rel="noopener">
        ${icon('yt')} Tilaa
      </a>
      <button class="nav__toggle" aria-label="Avaa valikko" aria-expanded="false"><span></span></button>
    </div>`;

  /* ---- Footer ---- */
  const groups = {};
  SITE.pages.filter(p => !p.hidden).forEach(p => {
    const g = p.foot || 'Sivusto';
    (groups[g] = groups[g] || []).push(p);
  });
  const cols = Object.entries(groups).map(([title, items]) => `
    <div data-reveal>
      <h4>${title}</h4>
      <ul>${items.map(p => `<li><a href="${p.href}">${p.label}</a></li>`).join('')}</ul>
    </div>`).join('');

  const foot = document.createElement('footer');
  foot.className = 'footer';
  foot.innerHTML = `
    <div class="wrap">
      <div class="footer__grid">
        <div class="footer__brand" data-reveal>
          <a class="brand" href="index.html" style="margin-bottom:18px">
            <span class="brand__mark" aria-hidden="true">K</span>
            <span class="brand__txt"><b>${SITE.name}</b><span>Minecraft Official</span></span>
          </a>
          <p class="muted" style="max-width:38ch;font-size:.92rem">
            ${SITE.tagline}. Buildeja, serveriprojekteja ja pelituokioita —
            uutta sisältöä kanavalle säännöllisesti.
          </p>
          <div class="socials">
            <a href="${SITE.youtube}" target="_blank" rel="noopener" aria-label="YouTube">${icon('yt')}</a>
            <a href="${SITE.discord}" aria-label="Discord">${icon('dc')}</a>
            <a href="${SITE.tiktok}" aria-label="TikTok">${icon('tt')}</a>
            <a href="mailto:${SITE.email}" aria-label="Sähköposti">${icon('mail')}</a>
          </div>
        </div>
        ${cols}
      </div>
      <div class="footer__bottom">
        <span>© <span id="year"></span> ${SITE.full}</span>
        <span>Ei Mojang Studiosin virallinen tuote.</span>
      </div>
    </div>`;

  document.body.prepend(nav);
  document.body.append(foot);
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  /* mobiilivalikko */
  const tgl = nav.querySelector('.nav__toggle');
  tgl.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    tgl.setAttribute('aria-expanded', String(open));
  });
  nav.querySelectorAll('.nav__links a').forEach(a =>
    a.addEventListener('click', () => nav.classList.remove('is-open')));

  /* Google Docs -korttien renderöinti (projektit.html) */
  const dg = document.getElementById('docs-grid');
  if (dg) {
    dg.innerHTML = SITE.docs.map(d => {
      const t = DOC_TYPES[d.type] || DOC_TYPES.doc;
      const ext = d.url && d.url !== '#';
      return `
      <a class="card card--link tilt doc-card" data-tags="${d.type}"
         href="${d.url}"${ext ? ' target="_blank" rel="noopener"' : ''} data-reveal>
        <div class="card__ico">${t.ico}</div>
        <span class="tag ${t.cls}">${t.tag}</span>
        <h3 style="margin-top:12px">${d.name}</h3>
        <p>${d.desc}</p>
        <span class="card__link">${ext ? 'Avaa dokumentti' : 'Lisää linkki site.js:ään'} <span>→</span></span>
      </a>`;
    }).join('');
  }

  /* täydennä data-site-* paikkamerkit sivuilla */
  document.querySelectorAll('[data-site]').forEach(el => {
    const v = SITE[el.dataset.site];
    if (v != null) el.textContent = v;
  });
  document.querySelectorAll('[data-site-href]').forEach(el => {
    const v = SITE[el.dataset.siteHref];
    if (v != null) el.setAttribute('href', v);
  });
})();

function icon(n){
  const p = {
    yt:'M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z',
    dc:'M20.3 4.4A19 19 0 0 0 15.7 3l-.2.4a17 17 0 0 1 4.1 1.4 15 15 0 0 0-11.2 0A17 17 0 0 1 12.5 3.4L12.3 3a19 19 0 0 0-4.6 1.4C4.3 9.3 3.4 14 3.9 18.7A19 19 0 0 0 9.6 21l.9-1.7a12 12 0 0 1-2-1l.5-.4a13.5 13.5 0 0 0 10 0l.5.4a12 12 0 0 1-2 1L18.4 21a19 19 0 0 0 5.7-2.3c.6-5.4-.9-10.1-3.8-14.3ZM9.4 15.7c-1.1 0-2-1-2-2.3s.9-2.3 2-2.3 2 1 2 2.3-.9 2.3-2 2.3Zm5.2 0c-1.1 0-2-1-2-2.3s.9-2.3 2-2.3 2 1 2 2.3-.9 2.3-2 2.3Z',
    tt:'M16.6 2h-3v13.4a2.6 2.6 0 1 1-2.2-2.6v-3a5.6 5.6 0 1 0 5.2 5.6V9a7.5 7.5 0 0 0 4.4 1.4V7.3a4.5 4.5 0 0 1-4.4-5.3Z',
    mail:'M2 5h20v14H2V5Zm2 2v.3l8 5 8-5V7H4Zm16 10V9.6l-8 5-8-5V17h16Z'
  }[n] || '';
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${p}"/></svg>`;
}

/* =====================================================================
   DEV — kirjautuminen joka sivun alalaidasta + sivuston asetukset
   ---------------------------------------------------------------------
   Yllapitokoodi tarkistetaan palvelimella (Supabase-funktio is_admin).
   Koodi elaa vain valilehden sessionStoragessa, ei koskaan repossa.
   Asetukset (whitelist, linkit, tekstit) haetaan settings-taulusta ja
   niita muokataan sivulla dev.html.
   ===================================================================== */
var KSPK = (function () {
  var SS_DEV  = 'kspk.pins.dev';
  var SS_CODE = 'kspk.pins.devcode';
  var SB = { url: 'https://zfgwjxtruqoacxtkqprp.supabase.co', key: 'sb_publishable_MwLjfXP5LCtZe8tZ3IIf7w_5a3zqoKc' };

  function isDev() { try { return sessionStorage.getItem(SS_DEV) === '1'; } catch (e) { return false; } }
  function code()  { try { return sessionStorage.getItem(SS_CODE) || ''; } catch (e) { return ''; } }
  function setDev(on, c) {
    try {
      if (on) { sessionStorage.setItem(SS_DEV, '1'); if (c) sessionStorage.setItem(SS_CODE, c); }
      else { sessionStorage.removeItem(SS_DEV); sessionStorage.removeItem(SS_CODE); }
    } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('kspk-dev', { detail: { on: !!on } })); } catch (e) {}
  }
  function rest(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({
      apikey: SB.key, Authorization: 'Bearer ' + SB.key, 'Content-Type': 'application/json'
    }, opts.headers || {});
    return fetch(SB.url + '/rest/v1/' + path, opts);
  }
  function rpc(fn, body) {
    return rest('rpc/' + fn, { method: 'POST', body: JSON.stringify(body || {}) })
      .then(function (r) {
        return r.text().then(function (txt) {
          var data = null;
          try { data = txt ? JSON.parse(txt) : null; } catch (e) {}
          if (!r.ok) throw new Error((data && (data.message || data.error || data.hint)) || txt || ('HTTP ' + r.status));
          return data;
        });
      });
  }
  function settings() {
    return rest('settings?select=whitelist,links,texts&id=eq.1')
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) { return rows[0] || {}; })
      .catch(function () { return {}; });
  }
  function login(c) {
    return rpc('is_admin', { p_code: c }).then(function (ok) {
      if (ok !== true) return false;
      setDev(true, c);
      return true;
    });
  }
  function save(patch) {
    var c = code();
    if (!c) return Promise.reject(new Error('NO_CODE'));
    return settings().then(function (cur) {
      return rpc('settings_save', {
        p_code: c,
        p_whitelist: patch.whitelist !== undefined ? patch.whitelist : (cur.whitelist || []),
        p_links:     patch.links     !== undefined ? patch.links     : (cur.links || []),
        p_texts:     patch.texts     !== undefined ? patch.texts     : (cur.texts || {})
      });
    });
  }
  return { isDev: isDev, code: code, setDev: setDev, rest: rest, rpc: rpc,
           settings: settings, login: login, save: save };
})();
window.KSPK = KSPK;

/* --- asetusten soveltaminen: dokumenttilinkit ja tekstit ------------- */
(function applySettings() {
  function docCards(list) {
    var dg = document.getElementById('docs-grid');
    if (!dg || !list || !list.length) return;
    dg.innerHTML = list.map(function (d) {
      var t = DOC_TYPES[d.type] || DOC_TYPES.doc;
      var ext = d.url && d.url !== '#';
      return '<a class="card card--link tilt doc-card" data-tags="' + (d.type || 'doc') + '" href="' + (d.url || '#') + '"' +
             (ext ? ' target="_blank" rel="noopener"' : '') + ' data-reveal>' +
             '<div class="card__ico">' + t.ico + '</div>' +
             '<span class="tag ' + t.cls + '">' + t.tag + '</span>' +
             '<h3 style="margin-top:12px">' + (d.name || '') + '</h3>' +
             '<p>' + (d.desc || '') + '</p>' +
             '<span class="card__link">' + (ext ? 'Avaa dokumentti' : 'Lisaa linkki dev-asetuksista') + ' <span>&rarr;</span></span></a>';
    }).join('');
  }
  KSPK.settings().then(function (s) {
    docCards(s.links);
    if (s.texts) {
      Object.keys(s.texts).forEach(function (sel) {
        var nodes;
        try { nodes = document.querySelectorAll(sel); } catch (e) { return; }
        [].forEach.call(nodes, function (n) { n.innerHTML = s.texts[sel]; });
      });
    }
  });
})();

/* --- dev-palkki footeriin ------------------------------------------- */
(function devBar() {
  var st = document.createElement('style');
  st.textContent = ''
    + '.footer__bottom{flex-wrap:wrap}'
    + '.kspk-devbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:.82rem;'
    + 'flex-basis:100%;justify-content:flex-start;margin-top:4px;padding-right:72px}'
    + '.kspk-devbar a,.kspk-devbar button{font:inherit;font-size:.82rem;color:var(--muted,#9db3a6);'
    + 'background:none;border:0;padding:0;cursor:pointer;text-decoration:none;border-bottom:1px dotted transparent}'
    + '.kspk-devbar a:hover,.kspk-devbar button:hover{color:var(--green,#3ef08a);border-bottom-color:currentColor}'
    + '.kspk-devbar .on{color:#ffd166}'
    + '.kspk-devbox{display:flex;gap:8px;align-items:center;flex-wrap:wrap}'
    + '.kspk-devbox input{padding:7px 10px;border-radius:9px;font:inherit;font-size:.82rem;width:150px;'
    + 'background:rgba(8,14,11,.75);border:1px solid var(--line,rgba(255,255,255,.14));color:var(--text,#eaf3ee)}'
    + '.kspk-devbox input:focus{outline:none;border-color:var(--green,#3ef08a)}'
    + '.kspk-devbox .go{border:1px solid var(--line,rgba(255,255,255,.18));border-radius:9px;padding:6px 11px}';
  document.head.appendChild(st);

  var bottom = document.querySelector('.footer__bottom');
  if (!bottom) return;
  var bar = document.createElement('span');
  bar.className = 'kspk-devbar';
  bottom.appendChild(bar);

  function paint() {
    if (KSPK.isDev()) {
      bar.innerHTML = '<span class="on">&#128295; Dev p&auml;&auml;ll&auml;</span>'
        + '<a href="dev.html">Asetukset</a>'
        + '<button type="button" data-a="out">Kirjaudu ulos</button>';
      bar.querySelector('[data-a="out"]').onclick = function () { KSPK.setDev(false); paint(); };
    } else {
      bar.innerHTML = '<button type="button" data-a="in">Dev</button>';
      bar.querySelector('[data-a="in"]').onclick = openBox;
    }
  }
  function openBox() {
    bar.innerHTML = '<span class="kspk-devbox">'
      + '<input type="password" placeholder="Yll&auml;pitokoodi" id="kspk-devcode">'
      + '<button type="button" class="go" data-a="ok">Kirjaudu</button>'
      + '<button type="button" data-a="no">Peruuta</button></span>';
    var inp = bar.querySelector('#kspk-devcode');
    inp.focus();
    function go() {
      var c = inp.value;
      if (!c) { inp.focus(); return; }
      inp.disabled = true;
      KSPK.login(c).then(function (ok) {
        if (ok) { paint(); return; }
        inp.disabled = false; inp.value = ''; inp.placeholder = 'Väärä koodi'; inp.focus();
      }).catch(function () {
        inp.disabled = false; inp.placeholder = 'Ei yhteyttä'; inp.focus();
      });
    }
    bar.querySelector('[data-a="ok"]').onclick = go;
    bar.querySelector('[data-a="no"]').onclick = paint;
    inp.onkeydown = function (e) { if (e.key === 'Enter') go(); if (e.key === 'Escape') paint(); };
  }
  window.addEventListener('kspk-dev', paint);
  paint();
})();
