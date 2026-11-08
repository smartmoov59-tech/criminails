/* =========================================================
   CRIMINAILS — animations & interactions
   GSAP + ScrollTrigger + Lenis (tout est local, aucun service externe)
   ========================================================= */
(() => {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const body = document.body;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  /* ---------- Petits utilitaires ---------- */
  $('#year').textContent = new Date().getFullYear();
  const years = Math.max(1, new Date().getFullYear() - 2020);
  const yearsEl = $('#years');
  if (yearsEl) { yearsEl.textContent = years; yearsEl.dataset.count = years; }

  // découpe un texte en mots ou en lettres (chaque mot masque la montée de ses lettres)
  function split(el, mode) {
    const text = el.textContent.replace(/\s+/g, ' ').trim();
    el.textContent = '';
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = text;
    el.appendChild(sr);
    const out = [];
    text.split(' ').forEach((word, i, arr) => {
      const w = document.createElement('span');
      w.className = 'w';
      w.setAttribute('aria-hidden', 'true');
      if (mode === 'chars') {
        Array.from(word).forEach((ch) => {
          const c = document.createElement('span');
          c.className = 'c';
          c.textContent = ch;
          w.appendChild(c);
          out.push(c);
        });
      } else {
        const c = document.createElement('span');
        c.className = 'c';
        c.textContent = word;
        w.appendChild(c);
        out.push(c);
      }
      el.appendChild(w);
      if (i < arr.length - 1) el.appendChild(document.createTextNode(' '));
    });
    return out;
  }

  // empreinte digitale : arches concentriques, interrompues comme des sillons
  function fingerprintMarkup() {
    let d = '';
    for (let i = 0; i < 11; i++) {
      const w = 92 - i * 8;
      const top = 24 + i * 9.5;
      const base = 232 - i * 2.2;
      const dash = `${150 + i * 9} ${9 + (i % 3) * 4} ${44 + (i % 4) * 8} ${8}`;
      d += `<path d="M${100 - w} ${base} C${100 - w} ${top - 8} ${100 + w} ${top - 8} ${100 + w} ${base}" stroke-dasharray="${dash}"/>`;
    }
    return d + '<path d="M96 150c-2-8 3-13 8-11 6 2 5 12-1 14" stroke-dasharray="40 6"/>';
  }

  /* =========================================================
     Fonctions indépendantes de GSAP (restent utilisables sans)
     ========================================================= */

  /* ---------- Ouvert / fermé (heure de Paris) ---------- */
  (function openNow() {
    const HOURS = { 0: null, 1: [525, 1035], 2: [525, 1035], 3: [480, 1050], 4: [525, 1035], 5: [525, 1035], 6: [480, 705] };
    const NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const fmt = (m) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
    const box = $('#open-now');
    if (!box) return;
    function update() {
      const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
      const day = now.getDay();
      const mins = now.getHours() * 60 + now.getMinutes();
      $$('#hours tr').forEach((tr) => tr.classList.toggle('is-today', Number(tr.dataset.d) === day));
      const today = HOURS[day];
      let text;
      let isOpen = false;
      if (today && mins >= today[0] && mins < today[1]) {
        isOpen = true;
        text = `Ouvert maintenant · ferme à ${fmt(today[1])}`;
      } else {
        let found = null;
        for (let add = 0; add < 8 && !found; add++) {
          const d = (day + add) % 7;
          const h = HOURS[d];
          if (h && (add > 0 || mins < h[0])) found = { add, d, h };
        }
        const when = found.add === 0 ? "aujourd'hui" : found.add === 1 ? 'demain' : NAMES[found.d];
        text = `Fermé · ouvre ${when} à ${fmt(found.h[0])}`;
      }
      box.classList.toggle('is-open', isOpen);
      $('span', box).textContent = text;
    }
    update();
    setInterval(update, 60000);
  })();

  /* ---------- Ticket : estimateur de séance ---------- */
  (function estimator() {
    const list = $('#ticket-list');
    if (!list) return;
    const data = $$('.card').map((c, i) => {
      const h4 = $('h4', c);
      const small = $('small', h4);
      return {
        id: i,
        group: c.closest('.group').dataset.group,
        name: h4.childNodes[0].textContent.trim(),
        sub: small ? small.textContent.trim() : '',
        price: Number(c.dataset.price),
        min: Number(c.dataset.min),
      };
    });
    const selected = new Set();
    let tab = 'Les mains';
    const euro = (n) => `${n} €`;
    const dur = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}` : `${m} min`);

    function render() {
      list.innerHTML = '';
      data.filter((d) => d.group === tab).forEach((d) => {
        const li = document.createElement('li');
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = selected.has(d.id);
        input.addEventListener('change', () => {
          if (input.checked) selected.add(d.id); else selected.delete(d.id);
          sum();
        });
        const span = document.createElement('span');
        span.textContent = d.name;
        if (d.sub) {
          const em = document.createElement('em');
          em.textContent = d.sub;
          span.appendChild(em);
        }
        const b = document.createElement('b');
        b.textContent = euro(d.price);
        label.append(input, span, b);
        li.appendChild(label);
        list.appendChild(li);
      });
    }
    function sum() {
      let p = 0;
      let m = 0;
      selected.forEach((id) => { p += data[id].price; m += data[id].min; });
      $('#ticket-total').textContent = euro(p);
      $('#ticket-time').textContent = m ? dur(m) : '0 min';
    }
    $$('.ticket__tabs button').forEach((btn) => {
      btn.addEventListener('click', () => {
        tab = btn.dataset.tab;
        $$('.ticket__tabs button').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
        list.setAttribute('aria-labelledby', btn.id);
        render();
      });
    });
    render();
    sum();
  })();

  /* ---------- Points chauds du repaire ---------- */
  (function hotspots() {
    const pins = $$('.pin');
    if (!pins.length) return;
    const set = (p, on) => {
      p.classList.toggle('is-open', on);
      $('.pin__btn', p).setAttribute('aria-expanded', String(on));
    };
    const closeAll = () => pins.forEach((p) => set(p, false));
    pins.forEach((p) => {
      $('.pin__btn', p).addEventListener('click', (e) => {
        e.stopPropagation();
        const was = p.classList.contains('is-open');
        closeAll();
        set(p, !was);
      });
      if (fine) {
        p.addEventListener('pointerenter', () => { closeAll(); set(p, true); });
        p.addEventListener('pointerleave', () => set(p, false));
      }
    });
    document.addEventListener('click', closeAll);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
  })();

  /* ---------- Galerie : lightbox ---------- */
  let lenis = null;
  (function lightbox() {
    const items = $$('.gi');
    const dlg = $('#lightbox');
    if (!items.length || !dlg) return;
    const img = $('#lb-img');
    const cap = $('#lb-cap');
    let idx = 0;
    const show = (i) => {
      idx = (i + items.length) % items.length;
      const it = items[idx];
      img.src = it.dataset.full;
      img.alt = $('img', it).alt;
      cap.textContent = it.dataset.cap;
    };
    items.forEach((it, i) => it.addEventListener('click', () => {
      show(i);
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      if (lenis) lenis.stop();
    }));
    const close = () => { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); };
    $('#lb-close').addEventListener('click', close);
    $('#lb-prev').addEventListener('click', () => show(idx - 1));
    $('#lb-next').addEventListener('click', () => show(idx + 1));
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
    dlg.addEventListener('close', () => { if (lenis) lenis.start(); });
    dlg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') show(idx - 1);
      if (e.key === 'ArrowRight') show(idx + 1);
    });
  })();

  /* ---------- Avis : carrousel glissant ---------- */
  (function reviews() {
    const slider = $('#slider');
    const track = $('#slider-track');
    if (!slider || !track) return;
    const cards = $$('.rev', track);
    const counter = $('#slider-n');
    let idx = 0;
    let x = 0;
    let dragging = false;
    let startX = 0;
    let startPos = 0;
    let moved = 0;
    let hover = false;
    let inView = false;

    const maxX = () => {
      const cs = getComputedStyle(slider);
      const inner = slider.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      return Math.max(0, track.scrollWidth - inner);
    };
    const offsetOf = (i) => cards[i].offsetLeft - cards[0].offsetLeft;
    const apply = (animate) => {
      track.style.transition = animate && !reduce ? 'transform .8s cubic-bezier(.16,1,.3,1)' : 'none';
      track.style.transform = `translate3d(${x}px,0,0)`;
    };
    const goTo = (i) => {
      idx = clamp(i, 0, cards.length - 1);
      x = -Math.min(offsetOf(idx), maxX());
      counter.textContent = idx + 1;
      apply(true);
    };
    $('#prev').addEventListener('click', () => goTo(idx - 1));
    $('#next').addEventListener('click', () => goTo(idx + 1 >= cards.length ? 0 : idx + 1));

    slider.setAttribute('tabindex', '0');
    slider.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); goTo(idx + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(idx - 1); }
    });

    slider.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true;
      moved = 0;
      startX = e.clientX;
      startPos = x;
      slider.classList.add('is-drag');
      slider.setPointerCapture(e.pointerId);
      apply(false);
    });
    slider.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      moved = Math.max(moved, Math.abs(dx));
      x = clamp(startPos + dx, -maxX() - 60, 60);
      apply(false);
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      slider.classList.remove('is-drag');
      let best = 0;
      let bestD = Infinity;
      cards.forEach((_, i) => {
        const d = Math.abs(-Math.min(offsetOf(i), maxX()) - x);
        if (d < bestD) { bestD = d; best = i; }
      });
      goTo(best);
    };
    slider.addEventListener('pointerup', end);
    slider.addEventListener('pointercancel', end);
    slider.addEventListener('mouseenter', () => { hover = true; });
    slider.addEventListener('mouseleave', () => { hover = false; });
    slider.addEventListener('focusin', () => { hover = true; });
    slider.addEventListener('focusout', () => { hover = false; });
    window.addEventListener('resize', () => goTo(idx));

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((en) => { inView = en[0].isIntersecting; }, { threshold: 0.35 }).observe(slider);
    }
    if (!reduce) {
      setInterval(() => {
        if (inView && !hover && !dragging && !document.hidden) goTo(idx + 1 >= cards.length ? 0 : idx + 1);
      }, 5200);
    }
  })();

  /* ---------- Menu mobile ---------- */
  const burger = $('#burger');
  const menu = $('#menu');
  let menuOpen = false;
  $$('.menu__nav a', menu).forEach((a) => {
    const small = $('small', a);
    const span = document.createElement('span');
    while (small.nextSibling) span.appendChild(small.nextSibling);
    a.appendChild(span);
  });
  function toggleMenu(force) {
    menuOpen = typeof force === 'boolean' ? force : !menuOpen;
    burger.setAttribute('aria-expanded', String(menuOpen));
    burger.setAttribute('aria-label', menuOpen ? 'Fermer le menu' : 'Ouvrir le menu');
    menu.setAttribute('aria-hidden', String(!menuOpen));
    if (menuOpen) $('#nav').classList.remove('nav--hide');
    if (lenis) { if (menuOpen) lenis.stop(); else lenis.start(); }
    const origin = 'calc(100% - 2.8rem) 2.4rem';
    if (hasGsap && !reduce) {
      if (menuOpen) {
        menu.classList.add('is-open');
        gsap.fromTo(menu, { clipPath: `circle(0% at ${origin})` }, { clipPath: `circle(150% at ${origin})`, duration: 0.9, ease: 'expo.inOut' });
        gsap.fromTo($$('.menu__nav a span', menu), { yPercent: 110 }, { yPercent: 0, duration: 1, ease: 'expo.out', stagger: 0.07, delay: 0.25 });
        gsap.fromTo($('.menu__foot', menu), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.55 });
      } else {
        gsap.to(menu, { clipPath: `circle(0% at ${origin})`, duration: 0.7, ease: 'expo.inOut', onComplete: () => menu.classList.remove('is-open') });
      }
    } else {
      menu.classList.toggle('is-open', menuOpen);
      menu.style.clipPath = menuOpen ? 'none' : '';
    }
  }
  burger.addEventListener('click', () => toggleMenu());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) toggleMenu(false); });

  /* ---------- Ancres ---------- */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const target = id === '#top' ? document.body : $(id);
    if (!target) return;
    e.preventDefault();
    if (menuOpen) toggleMenu(false);
    if (lenis) lenis.scrollTo(id === '#top' ? 0 : target, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  });

  /* ---------- Barre de progression, nav, dock ---------- */
  const nav = $('#nav');
  const bar = $('.progress i');
  const dock = $('#dock');
  let lastY = 0;
  function onScroll() {
    const y = window.scrollY;
    nav.classList.toggle('nav--solid', y > 40);
    if (!menuOpen) {
      if (y > lastY + 4 && y > 320) nav.classList.add('nav--hide');
      else if (y < lastY - 4 || y < 320) nav.classList.remove('nav--hide');
    }
    lastY = y;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? clamp(y / max, 0, 1) : 0})`;
    dock.classList.toggle('is-on', y > window.innerHeight * 0.75);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Vidéo du hero ---------- */
  const heroVideo = $('.hero__media video');
  if (heroVideo) {
    if (reduce) { heroVideo.removeAttribute('autoplay'); heroVideo.pause(); } else { const p = heroVideo.play(); if (p && p.catch) p.catch(() => {}); }
  }

  /* =========================================================
     Tout ce qui suit demande GSAP
     ========================================================= */
  const finishLoading = () => {
    const l = $('#loader');
    if (l) l.remove();
    body.classList.remove('is-loading');
    if (lenis) lenis.start();
  };

  if (!hasGsap) { finishLoading(); return; }
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  // Lenis : défilement inertiel
  if (!reduce && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }

  /* ---------- Découpe des titres ---------- */
  const heroChars = [];
  $$('[data-split]').forEach((el) => {
    const mode = el.dataset.split;
    const chars = split(el, mode);
    if (el.closest('.hero')) { heroChars.push(...chars); return; }
    if (reduce) return;
    gsap.set(chars, { yPercent: 115 });
    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () => gsap.to(chars, { yPercent: 0, duration: mode === 'chars' ? 1.1 : 1.15, ease: 'expo.out', stagger: mode === 'chars' ? 0.045 : 0.07 }),
    });
  });
  const footerGiant = $('[data-footer-giant]');
  if (footerGiant) {
    const fc = split(footerGiant, 'chars');
    if (!reduce) {
      gsap.set(fc, { yPercent: 105 });
      ScrollTrigger.create({ trigger: footerGiant, start: 'top 95%', once: true, onEnter: () => gsap.to(fc, { yPercent: 0, duration: 1.4, ease: 'expo.out', stagger: 0.05 }) });
    }
  }

  /* ---------- Loader → hero ---------- */
  function heroIntro() {
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.to(heroChars, { yPercent: 0, duration: 1.4, stagger: 0.06 }, 0)
      .to($$('[data-hero-in]'), { opacity: 1, y: 0, duration: 1.1, stagger: 0.12 }, 0.35)
      .from('.hero__mid span', { opacity: 0, duration: 1.8, stagger: 0.15 }, 0.2)
      .from('.hero__dossier', { opacity: 0, x: 30, duration: 1 }, 0.7)
      .from('.hero__tapeband', { xPercent: 110, duration: 1.6 }, 0.5)
      .from('.hero__media video', { scale: 1.22, duration: 2.6 }, 0);
    return tl;
  }

  gsap.set(heroChars, { yPercent: 112 });
  gsap.set($$('[data-hero-in]'), { opacity: 0, y: 34 });

  const loader = $('#loader');
  if (!loader || reduce) {
    gsap.set(heroChars, { yPercent: 0 });
    gsap.set($$('[data-hero-in]'), { opacity: 1, y: 0 });
    finishLoading();
  } else {
    const fp = $('#loader-fp');
    fp.innerHTML = fingerprintMarkup();
    const arcs = $$('path', fp);
    const word = $('#loader-word');
    const letters = Array.from(word.textContent).map((ch) => {
      const s = document.createElement('span');
      s.textContent = ch;
      return s;
    });
    word.textContent = '';
    letters.forEach((s) => word.appendChild(s));
    const inner = $('.loader__inner');
    const nEl = $('#loader-n');
    const counter = { n: 0 };
    const tapeA = $('.loader__tape--a');
    const tapeB = $('.loader__tape--b');

    gsap.set(arcs, { scale: 0.55, opacity: 0 });
    gsap.set(letters, { yPercent: 115 });

    const tl = gsap.timeline({ onComplete: finishLoading });
    tl.to(letters, { yPercent: 0, duration: 0.9, ease: 'expo.out', stagger: 0.05 }, 0.1)
      .to(arcs, { scale: 1, opacity: 1, duration: 0.9, ease: 'power3.out', stagger: 0.07 }, 0.1)
      .to(counter, { n: 100, duration: 1.4, ease: 'power2.inOut', onUpdate: () => { nEl.textContent = Math.round(counter.n); } }, 0.1)
      .set([tapeA, tapeB], { visibility: 'visible' }, 1.5)
      .fromTo(tapeA, { xPercent: -125, rotation: -14 }, { xPercent: 0, rotation: -14, duration: 0.8, ease: 'expo.out' }, 1.5)
      .fromTo(tapeB, { xPercent: 125, rotation: 14 }, { xPercent: 0, rotation: 14, duration: 0.8, ease: 'expo.out' }, 1.6)
      .to(inner, { scale: 0.9, opacity: 0, duration: 0.4, ease: 'power2.in' }, 2.0)
      .to(loader, { '--r': '112%', duration: 1.05, ease: 'expo.inOut' }, 2.3)
      .add(heroIntro, 2.55);

    setTimeout(finishLoading, 9000); // garde-fou
  }

  /* ---------- Navigation : survol des boutons magnétiques, curseur ---------- */
  if (fine && !reduce) {
    $$('.magnetic').forEach((el) => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.3);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.3);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });

    $$('.tilt').forEach((el) => {
      gsap.set(el, { transformPerspective: 900 });
      const rx = gsap.quickTo(el, 'rotationX', { duration: 0.5, ease: 'power3' });
      const ry = gsap.quickTo(el, 'rotationY', { duration: 0.5, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        ry((px - 0.5) * 14);
        rx((0.5 - py) * 14);
        el.style.setProperty('--mx', `${px * 100}%`);
        el.style.setProperty('--my', `${py * 100}%`);
      });
      el.addEventListener('pointerleave', () => { rx(0); ry(0); });
    });

    const cur = $('.cursor');
    body.classList.add('has-cursor');
    const cx = gsap.quickTo(cur, 'x', { duration: 0.25, ease: 'power3' });
    const cy = gsap.quickTo(cur, 'y', { duration: 0.25, ease: 'power3' });
    window.addEventListener('pointermove', (e) => { cx(e.clientX); cy(e.clientY); });
    document.addEventListener('pointerover', (e) => {
      cur.classList.toggle('is-hover', !!e.target.closest('a, button, summary, label, [data-cursor], .slider'));
    });

    // parallaxe à la souris sur le hero
    const hero = $('.hero');
    const mid = $('[data-hero-mid]');
    const fore = $('[data-hero-fore]');
    const media = $('[data-hero-media]');
    const q = (el, p, d) => gsap.quickTo(el, p, { duration: d, ease: 'power3' });
    const midX = q(mid, 'x', 1.2); const midY = q(mid, 'y', 1.2);
    const foreX = q(fore, 'x', 0.8); const foreY = q(fore, 'y', 0.8);
    const medX = q(media, 'x', 1.6);
    hero.addEventListener('pointermove', (e) => {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      midX(nx * -40); midY(ny * -24);
      foreX(nx * 36); foreY(ny * 24);
      medX(nx * -18);
    });
  }

  if (reduce) {
    ScrollTrigger.refresh();
    return;
  }

  /* ---------- Hero : parallaxe multicouche au scroll ---------- */
  const heroST = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
  gsap.to('[data-hero-media]', { yPercent: 14, ease: 'none', scrollTrigger: heroST });
  gsap.fromTo('.hero__mid span:nth-child(1)', { xPercent: -6 }, { xPercent: -26, ease: 'none', scrollTrigger: heroST });
  gsap.fromTo('.hero__mid span:nth-child(2)', { xPercent: -34 }, { xPercent: -8, ease: 'none', scrollTrigger: heroST });
  gsap.to('.hero__content', { yPercent: -14, ease: 'none', scrollTrigger: heroST });
  gsap.to('.hero__fore', { yPercent: -22, ease: 'none', scrollTrigger: heroST });
  gsap.to('.hero__tint', { opacity: 0.55, ease: 'none', scrollTrigger: heroST });

  /* ---------- Rubans qui réagissent à la vitesse du scroll ---------- */
  (function tapes() {
    const items = $$('[data-tape]').map((tape) => {
      const track = $('.tape__track', tape);
      const group = $('.tape__group', tape);
      let guard = 0;
      while (track.scrollWidth < window.innerWidth * 2.4 && guard++ < 12) track.appendChild(group.cloneNode(true));
      return { track, group, dir: parseFloat(tape.dataset.tape) || 1, x: 0, unit: group.getBoundingClientRect().width };
    });
    window.addEventListener('resize', () => items.forEach((it) => { it.unit = it.group.getBoundingClientRect().width; }));
    let prevY = window.scrollY;
    let boost = 0;
    let dirS = 1;
    let targetDir = 1;
    gsap.ticker.add((time, dt) => {
      const y = window.scrollY;
      const vel = y - prevY;
      prevY = y;
      boost += (clamp(Math.abs(vel), 0, 60) * 0.22 - boost) * 0.08;
      if (vel < -0.6) targetDir = -1; else if (vel > 0.6) targetDir = 1;
      dirS += (targetDir - dirS) * 0.07;
      items.forEach((it) => {
        it.x -= (0.9 + boost) * it.dir * dirS * (dt / 16.7) * 1.6;
        if (it.unit > 0) {
          while (it.x <= -it.unit) it.x += it.unit;
          while (it.x > 0) it.x -= it.unit;
        }
        it.track.style.transform = `translate3d(${it.x}px,0,0)`;
      });
    });
  })();

  const mm = gsap.matchMedia();

  /* ---------- Le dossier : section épinglée (bureau) ---------- */
  mm.add('(min-width: 900px)', () => {
    const story = $('.story');
    const pin = $('.story__pin', story);
    const steps = $$('.step', story);
    const rail = $('.story__rail b');
    const nEl = $('#story-n');
    story.classList.add('story--pinned');

    const parts = (s) => ({ fig: $('.step__fig', s), img: $('.step__img img', s), kids: $$('.step__body > *', s), body: $('.step__body', s) });
    steps.forEach((s, i) => {
      const p = parts(s);
      if (i > 0) {
        gsap.set(s, { autoAlpha: 0 });
        gsap.set(p.fig, { clipPath: 'circle(0% at 50% 50%)' });
        gsap.set(p.kids, { opacity: 0, y: 60 });
      }
    });

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      onUpdate: () => {
        gsap.set(rail, { scaleX: tl.progress() });
        nEl.textContent = clamp(Math.floor(tl.time() + 0.4) + 1, 1, steps.length);
      },
      scrollTrigger: {
        trigger: story,
        start: 'top top',
        end: () => `+=${window.innerHeight * 3.8}`,
        pin,
        scrub: 0.8,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });
    tl.to({}, { duration: steps.length });
    steps.forEach((s, i) => {
      if (i === 0) return;
      const prev = parts(steps[i - 1]);
      const cur = parts(s);
      tl.to(prev.kids, { opacity: 0, y: -40, duration: 0.35, stagger: 0.03 }, i - 0.4)
        .to(prev.fig, { rotation: -4, opacity: 0.2, duration: 0.5 }, i - 0.3)
        .set(s, { autoAlpha: 1 }, i - 0.28)
        .to(cur.fig, { clipPath: 'circle(100% at 50% 50%)', duration: 0.7, ease: 'power2.inOut' }, i - 0.28)
        .fromTo(cur.img, { scale: 1.35 }, { scale: 1, duration: 1 }, i - 0.28)
        .to(cur.kids, { opacity: 1, y: 0, duration: 0.45, stagger: 0.07, ease: 'power2.out' }, i + 0.1);
    });
    // léger mouvement continu sur la première photo
    gsap.fromTo($('.step__img img', steps[0]), { scale: 1.12 }, { scale: 1, duration: 1.2, ease: 'power2.out', scrollTrigger: { trigger: story, start: 'top 70%' } });
    return () => story.classList.remove('story--pinned');
  });

  /* ---------- Prestations : défilement horizontal piloté par le scroll (bureau) ---------- */
  mm.add('(min-width: 900px)', () => {
    const sec = $('.services');
    const track = $('#services-track');
    const fill = $('.services__bar i');
    const now = $('#services-now');
    const groups = $$('.group', track);
    sec.classList.add('services--pinned');
    track.scrollLeft = 0;

    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
    let current = '';
    const tween = gsap.to(track, {
      x: () => -dist(),
      ease: 'none',
      scrollTrigger: {
        trigger: $('.services__pin', sec),
        start: 'top top',
        end: () => `+=${dist() * 0.8}`,
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          gsap.set(fill, { scaleX: self.progress });
          const scrolled = self.progress * dist() + window.innerWidth * 0.3;
          let g = groups[0];
          groups.forEach((gr) => { if (gr.offsetLeft <= scrolled) g = gr; });
          if (g.dataset.group !== current) { current = g.dataset.group; now.textContent = current; }
        },
      },
    });
    $$('.card, .group__intro', track).forEach((el) => {
      gsap.from(el, { y: 70, opacity: 0, rotation: 2.5, ease: 'power2.out', scrollTrigger: { trigger: el, containerAnimation: tween, start: 'left 96%', end: 'left 66%', scrub: true } });
    });
    return () => { sec.classList.remove('services--pinned'); gsap.set(track, { clearProps: 'transform' }); };
  });

  /* ---------- Tableau d'enquête : fil rose + compteurs ---------- */
  const thread = $('#thread');
  if (thread) {
    const len = thread.getTotalLength();
    gsap.set(thread, { strokeDasharray: len, strokeDashoffset: len });
    gsap.to(thread, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: '.board__wall', start: 'top 82%', end: 'bottom 60%', scrub: true } });
  }
  gsap.from('.note', { y: 90, opacity: 0, rotation: (i) => (i % 2 ? 8 : -8), duration: 1.1, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: '.board__wall', start: 'top 85%' } });
  $$('[data-count]').forEach((el) => {
    const end = parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.dec || '0', 10);
    const obj = { v: 0 };
    const fmt = (v) => v.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    el.textContent = fmt(0);
    ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      once: true,
      onEnter: () => gsap.to(obj, { v: end, duration: 2.2, ease: 'power3.out', onUpdate: () => { el.textContent = fmt(obj.v); } }),
    });
  });

  /* ---------- Le repaire : révélation en cercle ---------- */
  $$('[data-reveal-circle]').forEach((el) => {
    gsap.fromTo(el, { clipPath: 'circle(0% at 50% 50%)' }, {
      clipPath: 'circle(100% at 50% 50%)', duration: 1.8, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 78%' },
      onComplete: () => gsap.set(el, { clearProps: 'clipPath' }),
    });
  });

  /* ---------- Galerie : masques variés + image qui bouge dans son cadre ---------- */
  const MASKS = {
    curtain: ['inset(0% 0% 100% 0%)', 'inset(0% 0% 0% 0%)'],
    circle: ['circle(0% at 50% 50%)', 'circle(100% at 50% 50%)'],
    diag: ['polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)', 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)'],
  };
  $$('.gi').forEach((gi, i) => {
    const m = MASKS[gi.dataset.reveal] || MASKS.curtain;
    gsap.fromTo(gi, { clipPath: m[0] }, {
      clipPath: m[1], duration: 1.5, ease: 'expo.out', delay: (i % 2) * 0.1,
      scrollTrigger: { trigger: gi, start: 'top 85%' },
      onComplete: () => gsap.set(gi, { clearProps: 'clipPath' }),
    });
    gsap.fromTo($('.gi__frame img', gi), { yPercent: -5 }, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: gi, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  const mood = $('#mood-track');
  if (mood) {
    gsap.to(mood, { x: () => -Math.max(0, mood.scrollWidth - window.innerWidth), ease: 'none', scrollTrigger: { trigger: '.mood', start: 'top bottom', end: 'bottom top', scrub: 0.6, invalidateOnRefresh: true } });
    $$('.mood__item').forEach((it, i) => {
      gsap.from(it, { y: 60 + (i % 2) * 30, opacity: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.mood', start: 'top 85%' }, delay: i * 0.06 });
    });
  }

  /* ---------- CTA : image en parallaxe, ticket qui tombe ---------- */
  gsap.fromTo('.cta__bg img', { yPercent: -10 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.from('.ticket', { y: 120, rotation: 9, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.ticket', start: 'top 88%' } });

  /* ---------- Apparitions douces ---------- */
  ['.lieu__head > p', '.gallery__head > p', '.reviews__score', '.slider', '.slider__ctrl', '.cta__p', '.cta__btns', '.cta__tels', '.infos__map', '.infos__card > *:not(h2)', '.faq__title', '.faq details', '.footer__top > div']
    .forEach((sel) => $$(sel).forEach((e) => e.classList.add('fade')));
  gsap.set('.fade', { opacity: 0, y: 40 });
  ScrollTrigger.batch('.fade', {
    start: 'top 92%',
    once: true,
    onEnter: (b) => gsap.to(b, { opacity: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.08 }),
  });

  /* ---------- Recalcul final ---------- */
  const refresh = () => ScrollTrigger.refresh();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
  window.addEventListener('load', refresh);
})();
