/* =====================================================================
   tila.js — projektin hyvinvointi (tila.html)
   ---------------------------------------------------------------------
   Nayttaa MITATTAVISSA olevat luvut sellaisenaan:
     - Supabase: tietokannan koko + Storage-kayttö (public.project_health()
       -RPC, SECURITY DEFINER, palauttaa vain aggregoituja lukuja) verrattuna
       Supabasen ilmaistason julkisiin rajoihin.
     - GitHub: repon koko GitHubin julkisesta REST-APIsta (ei kirjautumista)
       verrattuna Pages-sivustolle suositeltuun kokoon.
   Kaistankaytto/kuukausittaiset kutsumaarat eivat ole SQL:lla tai julkisella
   API:lla mitattavissa taalta — niille naytetaan vain staattinen rajatieto
   ja linkki oikeaan hallintapaneeliin, EI arvattua/keksittya lukua.
   ===================================================================== */
(function () {
  'use strict';

  var CFG = {
    url: 'https://zfgwjxtruqoacxtkqprp.supabase.co',
    key: 'sb_publishable_MwLjfXP5LCtZe8tZ3IIf7w_5a3zqoKc'
  };
  var GH_REPO      = (window.SITE && SITE.githubRepo)     || 'erboiyprogamer-source/kspk-kotisivut';
  /* Kartat asuvat omassa repossaan, ja juuri SE on se joka kasvaa:
     jokainen uNmINeD-render jattaa vanhat tiilet git-historiaan. Siksi
     molemmat repot naytetaan erikseen omina mittareinaan. */
  var GH_MAPS_REPO = (window.SITE && SITE.githubMapsRepo) || 'erboiyprogamer-source/kspk-kartat';

  var LIMITS = {
    db: 500 * 1024 * 1024,        // Supabase free: 500 MB tietokanta
    storage: 1024 * 1024 * 1024,  // Supabase free: 1 GB tiedostosailytys
    ghRepo: 1024 * 1024 * 1024    // GitHub Pages: suositus < 1 GB sivuston koko
  };

  function fmtBytes(b) {
    if (b == null || isNaN(b)) return '—';
    var u = ['B', 'kt', 'Mt', 'Gt'], i = 0;
    while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
    return (i === 0 ? Math.round(b) : b.toFixed(b < 10 ? 2 : 1)) + ' ' + u[i];
  }
  function pct(v, max) { return Math.max(0, Math.min(100, (v / max) * 100)); }

  function paintMeter(id, current, max, extraLabel) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('meter--skeleton');
    var p = pct(current, max);
    var fill = el.querySelector('.meter__fill');
    fill.style.width = p.toFixed(1) + '%';
    fill.classList.toggle('is-warn', p >= 60 && p < 85);
    fill.classList.toggle('is-crit', p >= 85);
    var val = el.querySelector('.meter__val');
    val.innerHTML = '<b>' + fmtBytes(current) + '</b> / ' + fmtBytes(max) + ' &middot; ' + p.toFixed(1) + '%' +
      (extraLabel ? ' <span style="opacity:.7">(' + extraLabel + ')</span>' : '');
  }
  function meterError(id, msg) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('meter--skeleton');
    el.querySelector('.meter__val').textContent = 'Ei saatavilla';
    var err = document.createElement('div');
    err.className = 'status-err';
    err.textContent = msg;
    el.appendChild(err);
  }

  function loadSupabase() {
    return fetch(CFG.url + '/rest/v1/rpc/project_health', {
      method: 'POST',
      headers: { apikey: CFG.key, Authorization: 'Bearer ' + CFG.key, 'Content-Type': 'application/json' },
      body: '{}'
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (d) {
      paintMeter('m-db', d.db_bytes, LIMITS.db);
      paintMeter('m-storage', d.storage_bytes, LIMITS.storage);
      var grid = document.getElementById('sb-stats');
      if (grid) {
        grid.innerHTML =
          '<div class="status-stat"><b>' + d.pins_count + '</b><span>Karttamerkkiä</span></div>' +
          '<div class="status-stat"><b>' + d.pin_images_count + '</b><span>Merkkien kuvaa</span></div>' +
          '<div class="status-stat"><b>' + d.gallery_count + '</b><span>Galleriakuvaa</span></div>' +
          '<div class="status-stat"><b>' + d.players_count + '</b><span>Pelaajaa listalla</span></div>';
      }
      var upd = document.getElementById('sb-updated');
      if (upd) upd.textContent = 'Päivitetty juuri nyt, suoraan Supabasesta.';
    }).catch(function (e) {
      meterError('m-db', 'Supabaseen ei saatu yhteyttä (' + e.message + ')');
      meterError('m-storage', 'Supabaseen ei saatu yhteyttä (' + e.message + ')');
    });
  }

  function loadGithub(repo, meterId, statsId, updId) {
    return fetch('https://api.github.com/repos/' + repo).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (d) {
      var sizeBytes = (d.size || 0) * 1024; // GitHub API antaa koon kilotavuina
      paintMeter(meterId, sizeBytes, LIMITS.ghRepo);
      var grid = document.getElementById(statsId);
      if (grid) {
        grid.innerHTML =
          '<div class="status-stat"><b>' + (d.open_issues_count || 0) + '</b><span>Avointa issueta</span></div>' +
          '<div class="status-stat"><b>' + (d.default_branch || '—') + '</b><span>Oletushaara</span></div>' +
          '<div class="status-stat"><b>' + (d.visibility === 'public' ? 'Julkinen' : 'Yksityinen') + '</b><span>Näkyvyys</span></div>' +
          '<div class="status-stat"><b>' + new Date(d.pushed_at).toLocaleDateString('fi-FI') + '</b><span>Viimeisin push</span></div>';
      }
      var upd = document.getElementById(updId);
      if (upd) upd.textContent = 'Päivitetty juuri nyt, GitHubin julkisesta API:sta.';
    }).catch(function (e) {
      meterError(meterId, 'GitHubiin ei saatu yhteyttä (' + e.message + ')');
    });
  }

  loadSupabase();
  loadGithub(GH_REPO,      'm-gh',      'gh-stats',      'gh-updated');
  loadGithub(GH_MAPS_REPO, 'm-gh-maps', 'gh-maps-stats', 'gh-maps-updated');
})();
