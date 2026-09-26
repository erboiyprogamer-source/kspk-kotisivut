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
  youtube:   'https://www.youtube.com/@K-S-P-K_Minecraft_Official',
  email:     'kasapeka.official@gmail.com',      // yleinen yhteydenotto + liittymispyynnöt
  support:   'kasapeka.support@gmail.com',       // tuki- ja supportviestit
  // uNmINeD-kartat. Jokainen on oma kansionsa jossa on index.html + lib/ + tiles/
  mapDay:    'kartta/paiva/index.html',
  mapNight:  'kartta/yo/index.html',
  map5k:     'kartta/5k/index.html',

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
     TAPAHTUMAT  (keltainen ruutu etusivulla)
     -------------------------------------------------------------------
     Dev voi julkaista, muokata ja piilottaa nämä sivulla dev.html
     (välilehti "Eventit"). Tämä lista on vain varasisältö siltä varalta
     ettei asetuksia ole vielä tallennettu.
       on    : näkyykö ruutu
       badge : pieni tunniste ruudun ylälaidassa
       title : otsikko
       text  : kuvaus
       iso   : tapahtuman hetki. Countdown lasketaan tästä selaimessa —
               EI yhtään palvelinpyyntöä, joten se ei kuormita mitään.
               Muoto: 2027-03-04T17:55:00+02:00  (+02:00 = Suomen talviaika,
               kesäaikaan +03:00)
     =================================================================== */
  events: [
    { on: true,
      badge: 'Juhlavuosi',
      title: 'KASAPEKA täyttää 5 vuotta!',
      text:  'Viisi vuotta rakentamista, serveriä ja videoita. Juhlitaan yhdessä — merkkaa päivä kalenteriin jo nyt.',
      iso:   '2027-03-04T17:55:00+02:00',
      when:  '4.3.2027 klo 17:55 Suomen aikaa' }
  ],

  /* ===================================================================
     GOOGLE DOCS -LINKIT  (näkyvät sivulla projektit.html)
     -------------------------------------------------------------------
     Dev voi lisätä ja muokata näitä sivulla dev.html (välilehti "Linkit").
     =================================================================== */
  docs: [
    { type:'doc', name:'Muistiinpanot',
      desc:'Yhteinen muistiinpanovihko: päätökset, ideat ja avoimet kysymykset.',
      url:'https://docs.google.com/document/d/1viOlvNQ0ZzFE7PGuFv0WTckZlAbC2y5KuRuq9ftW26s/edit' },
    { type:'doc', name:'Videoideat',
      desc:'Ideapankki tuleville videoille — mitä on työn alla ja mitä jo julkaistu.',
      url:'https://docs.google.com/document/d/1YF1bAxuwioZk9SqnQjrdZIf_h_qjF9yEb-eoYsPn4C4/edit' },
    { type:'doc', name:'Serveriprojektit ja tehtävälista',
      desc:'Mitä serverillä rakennetaan, kuka tekee ja mihin mennessä.',
      url:'https://docs.google.com/document/d/1nNChKcaJO4lIYsJUTvFiGERBCXUfnKI_9EZBwq_a_ug/edit' },
    { type:'doc', name:'Tapahtumat ja aikataulu',
      desc:'Tulevat tapahtumat ja juhlapäivät — samat jotka näkyvät etusivun tapahtumaruudussa.',
      url:'https://docs.google.com/document/d/12wYYRjaOHw0prvTeoTThPj4EvZbeQ5brqQ0SlcsBNX4/edit' }
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
        <span class="brand__txt"><b>${SITE.name}</b><span>Minecraft SMP</span></span>
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
            <span class="brand__txt"><b>${SITE.name}</b><span>Minecraft SMP</span></span>
          </a>
          <p class="muted" style="max-width:38ch;font-size:.92rem">
            ${SITE.tagline}. Buildeja, serveriprojekteja ja pelituokioita —
            uutta sisältöä kanavalle säännöllisesti.
          </p>
          <div class="socials">
            <a href="${SITE.youtube}" target="_blank" rel="noopener" aria-label="YouTube">${icon('yt')}</a>
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
        if (sel === '@events') {                 // tapahtumat, ei CSS-valitsin
          var list = null;
          try { list = JSON.parse(s.texts[sel]); } catch (e) { list = null; }
          if (list && list.length !== undefined) window.KSPK_renderEvents(list);
          return;
        }
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


/* =====================================================================
   TAPAHTUMARUUTU + REAALIAIKAINEN COUNTDOWN
   ---------------------------------------------------------------------
   Renderöi keltaisen tapahtumaruudun elementtiin #kspk-events (etusivu).
   Countdown lasketaan pelkästään selaimen kellosta suhteessa tapahtuman
   ISO-aikaleimaan, jossa on aikavyöhyke mukana. Siksi se näyttää saman
   jäljellä olevan ajan kaikille avaajille maailmassa, eikä tee yhtäkään
   verkkopyyntöä — Supabasen kuormitus on nolla.
   ===================================================================== */
(function events() {
  var box = document.getElementById('kspk-events');
  if (!box) return;

  var esc = function (t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  var timer = null;

  function fmtWhen(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    try {
      return d.toLocaleString('fi-FI', {
        day: 'numeric', month: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Helsinki'
      }) + ' Suomen aikaa';
    } catch (e) { return iso; }
  }

  function render(list) {
    if (timer) { clearInterval(timer); timer = null; }
    var live = (list || []).filter(function (e) { return e && e.on !== false && (e.title || e.text); });
    if (!live.length) { box.innerHTML = ''; box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = live.map(function (e, i) {
      var t = e.iso ? Date.parse(e.iso) : NaN;
      return '<article class="evt" data-reveal>'
        + (e.badge ? '<span class="evt__badge">' + esc(e.badge) + '</span>' : '')
        + '<h3 class="evt__title">' + esc(e.title || '') + '</h3>'
        + (e.text ? '<p class="evt__text">' + esc(e.text) + '</p>' : '')
        + (isNaN(t) ? '' :
            '<div class="evt__cd" data-at="' + t + '" role="timer" aria-live="off">'
          + '<div><b data-u="d">–</b><span>päivää</span></div>'
          + '<div><b data-u="h">–</b><span>tuntia</span></div>'
          + '<div><b data-u="m">–</b><span>min</span></div>'
          + '<div><b data-u="s">–</b><span>sek</span></div></div>'
          + '<p class="evt__when">' + esc(e.when || fmtWhen(e.iso)) + '</p>')
        + '</article>';
    }).join('');
    tick();
    timer = setInterval(tick, 1000);
  }

  function tick() {
    var cds = box.querySelectorAll('.evt__cd');
    for (var i = 0; i < cds.length; i++) {
      var cd = cds[i];
      var left = Number(cd.dataset.at) - Date.now();
      if (left <= 0) {
        cd.classList.add('is-now');
        cd.innerHTML = '<div class="evt__now">🎉 Tapahtuma on alkanut!</div>';
        continue;
      }
      var s2 = Math.floor(left / 1000);
      var d = Math.floor(s2 / 86400), h = Math.floor(s2 % 86400 / 3600),
          m = Math.floor(s2 % 3600 / 60), sec = s2 % 60;
      var set = function (u, v) {
        var n = cd.querySelector('[data-u="' + u + '"]');
        if (n) n.textContent = v;
      };
      set('d', d); set('h', ('0' + h).slice(-2));
      set('m', ('0' + m).slice(-2)); set('s', ('0' + sec).slice(-2));
    }
  }

  window.KSPK_renderEvents = render;     // dev-asetukset voivat korvata listan
  render(SITE.events);                   // näytä varasisältö heti, ennen verkkohakua
})();

/* =====================================================================
   TUE KSPK:TA — kulmanappi + ikkuna
   ===================================================================== */
(function support() {
  if (document.body.dataset.noSupport === '1') return;

  var TO   = SITE.support || SITE.email;
  var SUBJ = 'Palaute ja tuki — K-S-P-K';
  var BODY = 'Moi K-S-P-K!\n\n'
    + 'Palautteeni sivustosta / kanavasta / serveristä:\n\n\n'
    + 'Olisin kiinnostunut tukemaan toimintaanne: kyllä / ei\n\n'
    + 'Idea johon tuki voisi mennä (kanavan, serverin tai yleisön kasvattamiseksi):\n\n\n'
    + 'Terveisin,\n';

  var st = document.createElement('style');
  st.textContent = ''
    + '.kspk-coffee{position:fixed;right:16px;bottom:16px;z-index:90;display:inline-flex;align-items:center;'
    + 'gap:8px;padding:11px 16px;border:0;border-radius:999px;cursor:pointer;font:inherit;font-size:.9rem;'
    + 'font-weight:600;color:#241a00;background:linear-gradient(135deg,#ffd166,#ffb020);'
    + 'box-shadow:0 12px 30px -12px rgba(255,180,32,.8);transition:transform .18s ease}'
    + '.kspk-coffee:hover{transform:translateY(-2px)}'
    + '.kspk-coffee:focus-visible{outline:2px solid #fff;outline-offset:3px}'
    + '@media (max-width:640px){.kspk-coffee{right:12px;bottom:12px;padding:10px 14px;font-size:.84rem}}'
    + '.kspk-sup{position:fixed;inset:0;z-index:120;display:none;padding:18px;overflow:auto;'
    + '-webkit-overflow-scrolling:touch;background:rgba(3,7,5,.72);backdrop-filter:blur(3px)}'
    + '.kspk-sup.on{display:block}'
    + '.kspk-sup__in{max-width:620px;margin:6vh auto 40px;border-radius:18px;padding:26px;'
    + 'background:#0b120e;border:1px solid rgba(255,209,102,.35);box-shadow:0 30px 70px -30px #000}'
    + '.kspk-sup h2{margin:0 0 6px;font-size:1.35rem;color:#ffd166}'
    + '.kspk-sup p{margin:0 0 12px;font-size:.95rem;line-height:1.6}'
    + '.kspk-sup ul{margin:0 0 14px;padding-left:20px;font-size:.93rem;line-height:1.65}'
    + '.kspk-sup__mail{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:14px 0;padding:12px 14px;'
    + 'border-radius:12px;background:rgba(255,209,102,.08);border:1px solid rgba(255,209,102,.25)}'
    + '.kspk-sup__mail code{font-size:.95rem;word-break:break-all;color:#ffe9b0}'
    + '.kspk-sup__acts{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}'
    + '.kspk-sup__b{font:inherit;font-size:.9rem;font-weight:600;padding:11px 16px;border-radius:11px;'
    + 'cursor:pointer;border:1px solid rgba(255,255,255,.18);background:transparent;color:inherit;text-decoration:none;'
    + 'display:inline-flex;align-items:center;gap:7px}'
    + '.kspk-sup__b--y{background:linear-gradient(135deg,#ffd166,#ffb020);color:#241a00;border-color:transparent}'
    + '.kspk-sup__eco{margin-top:18px;padding-top:16px;border-top:1px solid rgba(255,255,255,.1);'
    + 'font-size:.88rem;line-height:1.65;color:#b9cdc0}'
    + '.kspk-sup__x{float:right;background:none;border:0;color:inherit;font-size:1.5rem;line-height:1;'
    + 'cursor:pointer;padding:0 4px;margin:-6px -4px 0 0}';
  document.head.appendChild(st);

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'kspk-coffee';
  btn.innerHTML = '☕ <span>Buy us a coffee — tue KSPK:ta!</span>';

  var mod = document.createElement('div');
  mod.className = 'kspk-sup';
  mod.setAttribute('role', 'dialog');
  mod.setAttribute('aria-modal', 'true');
  mod.setAttribute('aria-label', 'Tue KSPK:ta');
  mod.innerHTML = ''
    + '<div class="kspk-sup__in">'
    + '<button type="button" class="kspk-sup__x" data-a="x" aria-label="Sulje">&times;</button>'
    + '<h2>☕ Support K-S-P-K by donating!</h2>'
    + '<p>Emme kerää rahaa sivuston kautta emmekä pyydä korttitietoja missään. '
    + 'Tuki hoidetaan ihan sähköpostilla, ihmiseltä ihmiselle.</p>'
    + '<p><b>Laita meille sähköpostia ja kerro:</b></p>'
    + '<ul>'
    + '<li>palautetta sivustosta, kanavasta tai serveristä</li>'
    + '<li>olisitko kiinnostunut tukemaan toimintaamme — silloin voimme antaa sinulle tilinumeron, johon tuen voi siirtää</li>'
    + '<li>jos haluat, kerro myös oma ideasi siitä mihin tukiraha kannattaisi käyttää: kanavan tai serverin kehittämiseen vai yleisön kasvattamiseen</li>'
    + '</ul>'
    + '<div class="kspk-sup__mail"><span>Osoite:</span><code id="kspk-sup-mail"></code></div>'
    + '<div class="kspk-sup__acts">'
    + '<button type="button" class="kspk-sup__b" data-a="copy">📋 Kopioi osoite</button>'
    + '<a class="kspk-sup__b kspk-sup__b--y" data-a="gmail" href="#" target="_blank" rel="noopener">✉️ Avaa Gmail valmiilla viestillä</a>'
    + '<a class="kspk-sup__b" data-a="mailto" href="#">Avaa oma sähköpostiohjelma</a>'
    + '</div>'
    + '<p class="kspk-sup__eco">🌱 <b>Lupauksemme tuesta:</b> käytämme jokaisen saamamme euron huolella ja '
    + 'ainoastaan tämän projektin kehittämiseen — kanavaan, serveriin ja sivustoon. Valintamme teemme '
    + 'ajatellen mahdollisimman vähäisiä ilmastopäästöjä, ja pääideanamme on kestävän kehityksen '
    + 'edistäminen. Ilmoitamme tukijoillemme aika ajoin myös oman hiilikädenjälkemme.</p>'
    + '</div>';

  document.body.appendChild(btn);
  document.body.appendChild(mod);

  mod.querySelector('#kspk-sup-mail').textContent = TO;
  var q = function (k, v) { return k + '=' + encodeURIComponent(v); };
  mod.querySelector('[data-a="gmail"]').href =
    'https://mail.google.com/mail/?view=cm&fs=1&' + q('to', TO) + '&' + q('su', SUBJ) + '&' + q('body', BODY);
  mod.querySelector('[data-a="mailto"]').href =
    'mailto:' + TO + '?' + q('subject', SUBJ) + '&' + q('body', BODY);

  function open()  { mod.classList.add('on'); document.documentElement.style.overflow = 'hidden'; }
  function close() { mod.classList.remove('on'); document.documentElement.style.overflow = ''; }
  btn.onclick = open;
  mod.addEventListener('click', function (e) {
    if (e.target === mod || e.target.dataset.a === 'x') close();
    if (e.target.dataset.a === 'copy') {
      try {
        navigator.clipboard.writeText(TO);
        e.target.textContent = '✅ Kopioitu!';
        setTimeout(function () { e.target.textContent = '📋 Kopioi osoite'; }, 1800);
      } catch (err) {}
    }
    if (e.target.dataset.a === 'gmail' || e.target.dataset.a === 'mailto') close();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && mod.classList.contains('on')) close();
  });

  // sivun omat "tue meitä" -napit avaavat saman ikkunan
  [].forEach.call(document.querySelectorAll('[data-support]'), function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); open(); });
  });
})();

/* =====================================================================
   KEVYT YOUTUBE-UPOTUS
   ---------------------------------------------------------------------
   Kortti näyttää aluksi vain kansikuvan. Vasta klikkauksesta ladataan
   YouTube-soitin — sivu pysyy nopeana myös mobiilissa.
   ===================================================================== */
(function ytLite() {
  [].forEach.call(document.querySelectorAll('[data-yt]'), function (card) {
    var btn = card.querySelector('.yt-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var id = card.dataset.yt;
      var w = document.createElement('div');
      w.className = 'video-card__thumb is-playing';
      w.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + id +
        '?autoplay=1&rel=0" title="YouTube-video" loading="lazy" allowfullscreen ' +
        'allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture;web-share" ' +
        'referrerpolicy="strict-origin-when-cross-origin" frameborder="0"></iframe>';
      btn.replaceWith(w);
    });
  });
})();
