/* =====================================================================
   yt-stats.js — etusivun oikeat YouTube-luvut
   ---------------------------------------------------------------------
   Hakee kanavan tilaajamaaran, katselukerrat ja videomaaran Supabasen
   youtube-stats-funktiolta. Funktio pitaa API-avaimen omassa paassaan ja
   valimuistittaa tuloksen, joten tasta ei lahde kutsuja YouTubelle.

   Jos haku epaonnistuu tai avainta ei ole viela asetettu, sivulla olevat
   luvut jaavat sellaisiksi kuin ne ovat HTML:ssa. Mikaan ei riko sivua.

   HUOM: YouTube pyoristaa tilaajamaaran (1234 -> 1230). Katselukerrat ja
   videomaara ovat tarkkoja.
   ===================================================================== */
(function () {
  'use strict';

  var FN = 'https://zfgwjxtruqoacxtkqprp.supabase.co/functions/v1/youtube-stats';
  var KEY = 'sb_publishable_MwLjfXP5LCtZe8tZ3IIf7w_5a3zqoKc';

  var targets = document.querySelectorAll('[data-ytstat]');
  if (!targets.length) return;

  /* 1234 -> "1,2k", 1250000 -> "1,3M". Pienet luvut sellaisenaan. */
  function lyhenna(n) {
    n = Number(n) || 0;
    if (n < 1000) return { arvo: n, dec: 0, pate: '' };
    if (n < 1000000) return { arvo: n / 1000, dec: n < 10000 ? 1 : 0, pate: 'k' };
    return { arvo: n / 1000000, dec: 1, pate: 'M' };
  }

  function aseta(el, luku) {
    var muoto = el.dataset.ytstatRaw === '1'
      ? { arvo: Number(luku) || 0, dec: 0, pate: '' }
      : lyhenna(luku);

    var span = el.querySelector('[data-count]');
    var pateEl = el.querySelector('[data-ytstat-suffix]');

    if (span) {
      /* Luku syotetaan laskurianimaation lahtotiedoksi. Jos animaatio on jo
         ehtinyt ajaa (hero on heti ruudulla), kirjoitetaan tulos suoraan. */
      span.dataset.count = String(muoto.arvo);
      span.dataset.dec = String(muoto.dec);
      var ajettu = span.dataset.counted === '1' || span.textContent.trim() !== '0';
      if (ajettu) {
        span.textContent = muoto.arvo.toFixed(muoto.dec).replace('.', ',');
      }
    }
    if (pateEl) pateEl.textContent = muoto.pate;
  }

  fetch(FN, { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || d.error) return;
      targets.forEach(function (el) {
        var mika = el.dataset.ytstat;
        if (mika === 'videos' && d.videos != null) aseta(el, d.videos);
        if (mika === 'views' && d.views != null) aseta(el, d.views);
        if (mika === 'subscribers' && d.subscribers != null) aseta(el, d.subscribers);
      });
    })
    .catch(function () { /* luvut jaavat HTML:n mukaisiksi */ });
})();
