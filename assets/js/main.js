/* =====================================================================
   main.js — scroll-animaatiot ja efektit
   Kaikki kunnioittaa prefers-reduced-motion -asetusta.
   ===================================================================== */
(() => {
  'use strict';
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- 0. Sivun sisääntulo ---------- */
  document.documentElement.classList.remove('is-loading');
  requestAnimationFrame(() => document.documentElement.classList.add('ready'));

  /* ---------- 1. Kerrostetut elementit ---------- */
  document.body.insertAdjacentHTML('afterbegin', `
    <div class="scroll-progress" aria-hidden="true"></div>
    <div class="cursor-glow" aria-hidden="true"></div>`);
  document.body.insertAdjacentHTML('beforeend', `
    <button class="to-top" aria-label="Takaisin ylös">↑</button>
    <div class="noise" aria-hidden="true"></div>
    <div class="toast" role="status" aria-live="polite"></div>`);

  const bar    = $('.scroll-progress');
  const glow   = $('.cursor-glow');
  const toTop  = $('.to-top');
  const nav    = $('.nav');
  const toastEl= $('.toast');

  /* ---------- 2. Reveal (IntersectionObserver) ---------- */
  const revealTargets = $$('[data-reveal]');
  // automaattinen porrastus saman vanhemman sisällä
  revealTargets.forEach(el => {
    if (el.style.transitionDelay) return;
    const sibs = [...el.parentElement.children].filter(n => n.hasAttribute('data-reveal'));
    const i = sibs.indexOf(el);
    if (sibs.length > 1 && i > -1) el.style.transitionDelay = (i * 90) + 'ms';
  });

  if ('IntersectionObserver' in window && !RM) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    revealTargets.forEach(el => io.observe(el));
  } else {
    revealTargets.forEach(el => el.classList.add('in'));
  }

  /* ---------- 3. Count-up ---------- */
  const counters = $$('[data-count]');
  if (counters.length) {
    const cio = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        cio.unobserve(e.target);
        const el = e.target;
        const end = parseFloat(el.dataset.count);
        const suf = el.dataset.suffix || '';
        const dec = (el.dataset.dec | 0);
        const fmt = (n) => n.toFixed(dec).replace('.', ',');
        if (RM) { el.textContent = fmt(end) + suf; return; }
        const dur = 1500, t0 = performance.now();
        const step = (t) => {
          const p = Math.min((t - t0) / dur, 1);
          const e2 = 1 - Math.pow(1 - p, 3);
          el.textContent = fmt(end * e2) + suf;
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: .4 });
    counters.forEach(c => cio.observe(c));
  }

  /* ---------- 4. Scroll: progress, nav, parallax, to-top ---------- */
  const parallaxEls = $$('[data-parallax]');
  let sy = window.scrollY, ticking = false;

  function onScrollFrame() {
    const h = document.documentElement.scrollHeight - innerHeight;
    if (bar) bar.style.transform = `scaleX(${h > 0 ? sy / h : 0})`;
    if (nav) nav.classList.toggle('is-stuck', sy > 24);
    if (toTop) toTop.classList.toggle('show', sy > innerHeight * .7);

    if (!RM) {
      for (const el of parallaxEls) {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > innerHeight + 200) continue;
        const speed = parseFloat(el.dataset.parallax) || .15;
        const off = (r.top + r.height / 2 - innerHeight / 2) * -speed;
        el.style.transform = `translate3d(0, ${off.toFixed(2)}px, 0)`;
      }
    }
    ticking = false;
  }
  addEventListener('scroll', () => {
    sy = window.scrollY;
    if (!ticking) { ticking = true; requestAnimationFrame(onScrollFrame); }
  }, { passive: true });
  onScrollFrame();

  toTop?.addEventListener('click', () =>
    scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' }));

  /* ---------- 5. Kursorin hehku + korttien kohdevalo + tilt ---------- */
  if (!RM && matchMedia('(hover:hover) and (pointer:fine)').matches) {
    let mx = innerWidth / 2, my = innerHeight / 2, gx = mx, gy = my;
    addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });
    (function loop() {
      gx = lerp(gx, mx, .09); gy = lerp(gy, my, .09);
      glow.style.transform = `translate3d(${gx}px, ${gy}px, 0) translate(-50%,-50%)`;
      requestAnimationFrame(loop);
    })();

    $$('.card').forEach(card => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        card.style.setProperty('--mx', (px * 100) + '%');
        card.style.setProperty('--my', (py * 100) + '%');
        if (card.classList.contains('tilt')) {
          card.style.transform =
            `perspective(900px) rotateX(${(.5 - py) * 7}deg) rotateY(${(px - .5) * 9}deg) translateY(-6px)`;
        }
      });
      card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    });
  }

  /* ---------- 6. Taustacanvas: putoavat lohkot ---------- */
  if (!RM && !matchMedia('(max-width: 700px)').matches) {
    const cv = document.createElement('canvas');
    cv.id = 'bg-canvas'; document.body.prepend(cv);
    const ctx = cv.getContext('2d');
    let W, H, blocks = [];
    const COLORS = ['62,240,138', '90,209,255', '255,201,77'];

    function size() {
      const d = Math.min(devicePixelRatio || 1, 2);
      W = cv.width = innerWidth * d; H = cv.height = innerHeight * d;
      cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
      ctx.setTransform(d, 0, 0, d, 0, 0);
      const n = Math.round(innerWidth / 42);
      blocks = Array.from({ length: n }, () => spawn(true));
    }
    function spawn(init) {
      return {
        x: Math.random() * innerWidth,
        y: init ? Math.random() * innerHeight : -40,
        s: 5 + Math.random() * 14,
        v: .16 + Math.random() * .55,
        r: Math.random() * Math.PI,
        vr: (Math.random() - .5) * .008,
        a: .06 + Math.random() * .2,
        c: COLORS[(Math.random() * COLORS.length) | 0]
      };
    }
    function tick() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        b.y += b.v; b.r += b.vr;
        if (b.y - b.s > innerHeight) blocks[i] = spawn(false);
        ctx.save();
        ctx.translate(b.x, b.y); ctx.rotate(b.r);
        ctx.fillStyle = `rgba(${b.c},${b.a})`;
        ctx.strokeStyle = `rgba(${b.c},${b.a * 2.1})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(-b.s / 2, -b.s / 2, b.s, b.s, 2);
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      requestAnimationFrame(tick);
    }
    if (ctx.roundRect) { size(); addEventListener('resize', size); tick(); }
  }

  /* ---------- 7. Lightbox (galleria) ---------- */
  const figs = $$('.gallery figure');
  if (figs.length) {
    const lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.innerHTML = `<button class="lightbox__close" aria-label="Sulje">✕</button>
                    <img alt=""><div class="lightbox__cap"></div>`;
    document.body.append(lb);
    const img = $('img', lb), cap = $('.lightbox__cap', lb);
    const close = () => { lb.classList.remove('is-open'); document.body.style.overflow = ''; };
    figs.forEach(f => f.addEventListener('click', () => {
      const i = $('img', f); if (!i) return;
      img.src = i.currentSrc || i.src;
      img.alt = i.alt || '';
      cap.textContent = $('figcaption', f)?.textContent.trim() || '';
      lb.classList.add('is-open'); document.body.style.overflow = 'hidden';
    }));
    lb.addEventListener('click', (e) => { if (e.target === lb || e.target.closest('.lightbox__close')) close(); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }

  /* ---------- 8. Kopioi leikepöydälle ---------- */
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }
  $$('[data-copy]').forEach(btn => btn.addEventListener('click', async () => {
    const txt = btn.dataset.copy || btn.previousElementSibling?.textContent?.trim() || '';
    try { await navigator.clipboard.writeText(txt); toast('Kopioitu: ' + txt); }
    catch { toast('Kopiointi ei onnistunut'); }
  }));

  /* ---------- 9. Suodattimet (videot / galleria / projektit) ---------- */
  $$('[data-filter-group]').forEach(group => {
    const targetSel = group.dataset.filterGroup;
    const items = $$(targetSel);
    group.addEventListener('click', (e) => {
      const b = e.target.closest('[data-filter]'); if (!b) return;
      $$('[data-filter]', group).forEach(x => x.classList.toggle('btn--solid', x === b));
      const f = b.dataset.filter;
      items.forEach(it => {
        const show = f === '*' || (it.dataset.tags || '').split(/\s+/).includes(f);
        it.style.display = show ? '' : 'none';
      });
    });
  });

  /* ---------- 10. Lomake (ei backendiä → mailto) ---------- */
  const form = $('#contact-form');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = new FormData(form);
    const to = form.dataset.email || '';
    const subj = encodeURIComponent(`[KSPK] ${d.get('aihe') || 'Yhteydenotto'}`);
    const body = encodeURIComponent(`Nimi: ${d.get('nimi')}\nSähköposti: ${d.get('email')}\n\n${d.get('viesti')}`);
    location.href = `mailto:${to}?subject=${subj}&body=${body}`;
    toast('Avataan sähköpostiohjelma…');
  });

  /* ---------- 11. Taulukon summat (kirjanpito) ---------- */
  $$('[data-sum-table]').forEach(t => {
    let sum = 0;
    $$('tbody td.num[data-amount]', t).forEach(td => sum += parseFloat(td.dataset.amount) || 0);
    const out = $('[data-sum-out]', t);
    if (out) {
      out.textContent = (sum >= 0 ? '+' : '') + sum.toFixed(2).replace('.', ',') + ' €';
      out.classList.add(sum >= 0 ? 'pos' : 'neg');
    }
  });
})();
