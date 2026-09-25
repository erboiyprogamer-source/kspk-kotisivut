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
  full:      'K-S-P-K Minecraft Official',
  tagline:   'Minecraft-sisältöä suomeksi',
  youtube:   'https://www.youtube.com/@K-S-P-K',      // ← vaihda oikeaan URLiin
  discord:   '#',
  tiktok:    '#',
  email:     'erboiy22@gmail.com',
  serverIp:  'play.kspk.fi',                          // ← vaihda oikeaan IP:hen
  mapPath:   'kartta/index.html',                     // uNmINeD-kartan sijainti

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
