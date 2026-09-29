/* ═══════════════ PHYSLAB AI — ядро ═══════════════ */
'use strict';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp  = (a, b, t) => a + (b - a) * t;
const tri   = a => (Math.random() + Math.random() - 1) * a; // үшбұрышты қателік
const fmt   = (n, d = 2) => n.toFixed(d).replace('.', ',');
const G0 = 9.8;

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOUCH   = matchMedia('(pointer: coarse)').matches;

/* ── KaTeX (fallback мәтін) ── */
function renderMath() {
  $$('.math[data-tex], .float-f[data-tex]').forEach(el => {
    const tex = el.dataset.tex;
    try {
      if (window.katex) katex.render(tex, el, { throwOnError: false, displayMode: el.classList.contains('block') });
      else { el.textContent = tex; el.classList.add('math-fallback'); }
    } catch { el.textContent = tex; el.classList.add('math-fallback'); }
  });
}

/* ── Canvas көмекшісі (DPR) ── */
function makeCanvas(canvas, fixedH) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0;
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (r.width < 2) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = r.width; h = fixedH || r.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  new ResizeObserver(resize).observe(canvas);
  resize();
  return { ctx, get w() { return w; }, get h() { return h; }, resize };
}

/* ── Біртұтес анимация циклі ── */
const animators = new Set();
function register(anim) { animators.add(anim); return anim; }
let lastT = performance.now();
(function loop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  const t = now / 1000;
  animators.forEach(a => { if (a.visible) a.update(dt, t); });
  requestAnimationFrame(loop);
})(lastT);

function watchVisible(el, anim) {
  new IntersectionObserver(es => es.forEach(e => anim.visible = e.isIntersecting), { threshold: 0.05 }).observe(el);
  return register(anim);
}

/* ═══════════ PRELOADER ═══════════ */
function waitForResources() {
  return Promise.all([
    document.fonts.ready,
    new Promise(resolve => {
      if (window.katex) return resolve();
      const checkKaTeX = () => {
        if (window.katex) return resolve();
        setTimeout(checkKaTeX, 50);
      };
      checkKaTeX();
    })
  ]);
}

function hidePreloader() {
  const preloader = $('#preloader');
  const bar = $('#preBar');
  
  // Smooth progress bar completion
  let progress = 0;
  const progressInterval = setInterval(() => {
    progress = Math.min(100, progress + 15);
    bar.style.width = progress + '%';
    if (progress >= 100) {
      clearInterval(progressInterval);
      setTimeout(() => {
        document.body.removeAttribute('data-loading');
        preloader.style.transition = 'opacity 0.5s ease, clip-path 0.8s cubic-bezier(0.22, 1, 0.36, 1)';
        preloader.style.opacity = '0';
        preloader.style.clipPath = 'inset(0 0 100% 0)';
      }, 200);
    }
  }, 50);
}

/* ═══════════ CUSTOM CURSOR + MAGNETIC ═══════════ */
(function cursor() {
  if (TOUCH || REDUCED) return;
  const dot = $('#cursorDot'), ring = $('#cursorRing'), label = $('#cursorLabel');
  let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
  addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; });
  addEventListener('pointerdown', () => ring.classList.add('pressed'));
  addEventListener('pointerup',   () => ring.classList.remove('pressed'));
  register({ visible: true, update() {
    rx = lerp(rx, mx, 0.16); ry = lerp(ry, my, 0.16);
    dot.style.transform  = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
    ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
  }});
  const HOVER = 'a,button,input,[role=button],label,canvas';
  document.addEventListener('pointerover', e => {
    const t = e.target.closest(HOVER);
    ring.classList.toggle('hovered', !!t);
    const lb = t && t.dataset ? t.dataset.cursorText : null;
    label.textContent = lb || ''; ring.classList.toggle('labeled', !!lb);
  });
  // магнитті батырмалар
  $$('.magnetic').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${dx * 0.16}px,${dy * 0.22}px)`;
    });
    el.addEventListener('pointerleave', () => {
      el.style.transition = 'transform .5s cubic-bezier(.22,1,.36,1)';
      el.style.transform = '';
      setTimeout(() => el.style.transition = '', 500);
    });
  });
})();

/* ═══════════ НАВИГАЦИЯ ═══════════ */
(function nav() {
  const bar = $('#nav'), burger = $('#burger');
  const onScroll = () => bar.classList.toggle('scrolled', scrollY > 30);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  burger.addEventListener('click', () => {
    const open = document.body.classList.toggle('menu-open');
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Мәзірді жабу' : 'Мәзірді ашу');
    document.body.classList.toggle('lock', open);
  });
  const closeMenu = () => {
    document.body.classList.remove('menu-open');
    if (!$('.lab-screen.open')) document.body.classList.remove('lock');
    burger.setAttribute('aria-expanded', 'false');
  };
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const el = $(id); if (!el) return;
    e.preventDefault(); closeMenu();
    setTimeout(() => el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' }), 60);
  }));
  // scroll-spy
  const links = $$('.nav-link');
  ['home','story','solar','labs','about'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    new IntersectionObserver(es => es.forEach(en => {
      if (!en.isIntersecting) return;
      links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + id));
    }), { rootMargin: '-40% 0px -55% 0px' }).observe(el);
  });
  window.__closeMenu = closeMenu;
})();

/* ═══════════ REVEAL + ПАРАЛЛАКС ═══════════ */
(function reveals() {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.12 });
  $$('.rv').forEach(el => io.observe(el));
  if (REDUCED) return;
  const floats = $$('[data-speed]');
  addEventListener('scroll', () => {
    requestAnimationFrame(() => floats.forEach(el => {
      const r = el.getBoundingClientRect();
      const off = (r.top + r.height / 2 - innerHeight / 2) * parseFloat(el.dataset.speed);
      el.style.transform = `translateY(${off}px)`;
    }));
  }, { passive: true });
})();

/* ═══════════ HERO — бөлшектер + орбитрон ═══════════ */
(function hero() {
  const cv = $('#heroCanvas'); if (!cv) return;
  const C = makeCanvas(cv);
  const N = TOUCH ? 40 : 85;
  const pts = Array.from({ length: N }, () => ({
    x: Math.random(), y: Math.random(),
    vx: (Math.random() - .5) * .012, vy: (Math.random() - .5) * .012,
    r: 1 + Math.random() * 1.8
  }));
  let mx = -999, my = -999;
  cv.parentElement.addEventListener('pointermove', e => {
    const r = cv.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top;
  });
  cv.parentElement.addEventListener('pointerleave', () => { mx = my = -999; });
  const orbits = [0, 1, 2].map(i => ({ rx: 90 + i * 46, ry: 34 + i * 18, rot: -0.5 + i * 0.55, sp: 0.7 - i * 0.15, ph: i * 2.1 }));
  const anim = watchVisible(cv, { visible: true, update(dt, t) {
    const { ctx, w, h } = C; if (!w) return;
    ctx.clearRect(0, 0, w, h);
    // бөлшектер
    for (const p of pts) {
      p.x += p.vx * dt * 60 / 60; p.y += p.vy * dt;
      if (p.x < -0.05) p.x = 1.05; if (p.x > 1.05) p.x = -0.05;
      if (p.y < -0.05) p.y = 1.05; if (p.y > 1.05) p.y = -0.05;
      const px = p.x * w, py = p.y * h;
      const dx = mx - px, dy = my - py, d2 = dx * dx + dy * dy;
      if (d2 < 32400 && d2 > 1) { p.x -= dx / w * 0.0016; p.y -= dy / h * 0.0016; }
    }
    ctx.lineWidth = 1;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i], b = pts[j];
      const dx = (a.x - b.x) * w, dy = (a.y - b.y) * h, d = dx * dx + dy * dy;
      if (d < 10000) {
        ctx.strokeStyle = `rgba(110,231,255,${(1 - d / 10000) * 0.16})`;
        ctx.beginPath(); ctx.moveTo(a.x * w, a.y * h); ctx.lineTo(b.x * w, b.y * h); ctx.stroke();
      }
    }
    for (const p of pts) {
      ctx.fillStyle = 'rgba(140,210,255,.55)';
      ctx.beginPath(); ctx.arc(p.x * w, p.y * h, p.r, 0, 7); ctx.fill();
    }
    // орбитрон (оң жақ)
    if (w > 760) {
      const cx = w * 0.74, cy = h * 0.46;
      const tilt = mx > 0 ? (mx / w - 0.5) * 0.25 : 0;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90);
      g.addColorStop(0, 'rgba(140,235,255,.9)'); g.addColorStop(0.25, 'rgba(110,231,255,.35)'); g.addColorStop(1, 'transparent');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 90, 0, 7); ctx.fill();
      ctx.fillStyle = '#dff8ff'; ctx.beginPath(); ctx.arc(cx, cy, 7, 0, 7); ctx.fill();
      orbits.forEach((o, i) => {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(o.rot + tilt);
        ctx.strokeStyle = 'rgba(124,155,255,.22)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(0, 0, o.rx, o.ry, 0, 0, 7); ctx.stroke();
        const a = t * o.sp * 2 + o.ph;
        const ex = Math.cos(a) * o.rx, ey = Math.sin(a) * o.ry;
        ctx.fillStyle = i === 1 ? '#ffb86b' : '#6ee7ff';
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(ex, ey, 3.4, 0, 7); ctx.fill();
        ctx.restore();
      });
    }
  }});
  if (REDUCED) { anim.update(0.016, 1); anim.visible = false; }
})();

/* ═══════════ STORY виньеткалары ═══════════ */
(function vignettes() {
  // i — траектория
  const c1 = $('#cnvTraj') && makeCanvas($('#cnvTraj'));
  if (c1) watchVisible($('#cnvTraj'), { visible: true, update(dt, t) {
    const { ctx, w, h } = c1; if (!w) return;
    ctx.clearRect(0, 0, w, h);
    const x0 = w * 0.12, y0 = h * 0.82, x1 = w * 0.9, top = h * 0.16;
    const P = u => [lerp(x0, x1, u), y0 - (y0 - top) * 4 * u * (1 - u)];
    ctx.strokeStyle = 'rgba(160,190,255,.2)'; ctx.setLineDash([4, 6]); ctx.lineWidth = 1.2;
    ctx.beginPath(); for (let u = 0; u <= 1.001; u += 0.02) { const [x, y] = P(u); u ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke(); ctx.setLineDash([]);
    const u = (t * 0.28) % 1, [bx, by] = P(u);
    // векторлар
    const vx = 56, vy = (2 * u - 1) * 72;
    const arrow = (x, y, dx, dy, col) => {
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx, y + dy); ctx.stroke();
      const a = Math.atan2(dy, dx);
      ctx.beginPath(); ctx.moveTo(x + dx, y + dy);
      ctx.lineTo(x + dx - 8 * Math.cos(a - .45), y + dy - 8 * Math.sin(a - .45));
      ctx.lineTo(x + dx - 8 * Math.cos(a + .45), y + dy - 8 * Math.sin(a + .45));
      ctx.closePath(); ctx.fill();
    };
    arrow(bx, by, vx, 0, '#6ee7ff'); arrow(bx, by, 0, vy, '#ffb86b'); arrow(bx, by, vx, vy, 'rgba(178,139,255,.9)');
    ctx.font = '600 12px JetBrains Mono'; ctx.fillStyle = '#6ee7ff'; ctx.fillText('vₓ', bx + vx + 8, by + 4);
    ctx.fillStyle = '#ffb86b'; ctx.fillText('v_y', bx + 6, by + vy + (vy > 0 ? 14 : -8));
    ctx.shadowColor = '#6ee7ff'; ctx.shadowBlur = 16; ctx.fillStyle = '#eaf6ff';
    ctx.beginPath(); ctx.arc(bx, by, 6, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  }});
  // ii — толқын
  const c2 = $('#cnvWave') && makeCanvas=$('#cnvWave'));
  if (c2) watchVisible=$('#cnvWave'), { visible: true, update(dt, t) {
    const { ctx, w, h } = c2; if (!w) return;
    ctx.clearRect(0, 0, w, h);
    const mid = h * 0.55, A = h * 0.2, lam = w * 0.3;
    ctx.lineWidth = 2.2; ctx.strokeStyle = '#6ee7ff';
    ctx.shadowColor = 'rgba(110,231,255,.7)'; ctx.shadowBlur = 10;
    ctx.beginPath();
    let crests = [];
    for (let x = 0; x <= w; x += 3) {
      const env = Math.sin(Math.PI * x / w) ** 0.4;
      const y = mid + A * env * Math.sin((x / lam) * Math.PI * 2 - t * 2.4);
      x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke(); ctx.shadowBlur = 0;
    // λ белгісі
    const ph = ((t * 2.4) % (Math.PI * 2));
    const cx1 = ((Math.PI / 2 + ph) / (Math.PI * 2)) * lam % lam;
    const x1 = cx1 + lam * Math.floor(w * 0.28 / lam), x2 = x1 + lam;
    ctx.strokeStyle = '#ffb86b'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x1, mid - A - 26); ctx.lineTo(x1, mid - A - 12);
    ctx.moveTo(x2, mid - A - 26); ctx.lineTo(x2, mid - A - 12);
    ctx.moveTo(x1, mid - A - 19); ctx.lineTo(x2, mid - A - 19); ctx.stroke();
    ctx.font = '600 13px JetBrains Mono'; ctx.fillStyle = '#ffb86b';
    ctx.fillText('λ', (x1 + x2) / 2 - 4, mid - A - 26);
    ctx.fillStyle = 'rgba(147,161,198,.8)'; ctx.font = '12px Manrope';
    ctx.fillText('жоғарғы деңгей', 12, mid - A - 34);
  }});
  // iii — орбита
  const c3 = $('#cnvOrbit') && makeCanvas=$('#cnvOrbit'));
  if (c3) watchVisible=$('#cnvOrbit'), { visible: true, update(dt, t) {
    const { ctx, w, h } = c3; if (!w) return;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, rx = w * 0.32, ry = h * 0.26, rot = -0.35;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
    ctx.strokeStyle = 'rgba(124,155,255,.28)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, 7); ctx.stroke();
    const a = t * 0.9;
    const ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
    ctx.restore();
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 46);
    g.addColorStop(0, 'rgba(255,236,190,.95)'); g.addColorStop(0.3, 'rgba(255,196,110,.4)'); g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 46, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffe3b0'; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, 7); ctx.fill();
    const px = cx + Math.cos(rot) * ex - Math.sin(rot) * ey;
    const py = cy + Math.sin(rot) * ex + Math.cos(rot) * ey;
    // F векторы — центрге
    const fdx = cx - px, fdy = cy - py, fl = Math.hypot(fdx, fdy);
    ctx.strokeStyle = '#ffb86b'; ctx.fillStyle = '#ffb86b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + fdx / fl * 40, py + fdy / fl * 40); ctx.stroke();
    ctx.font = '600 12px JetBrains Mono'; ctx.fillText('F', px + fdx / fl * 48 - 3, py + fdy / fl * 48);
    ctx.shadowColor = '#6ee7ff'; ctx.shadowBlur = 14; ctx.fillStyle = '#9fd8ff';
    ctx.beginPath(); ctx.arc(px, py, 6, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  }});
})();

/* ═══════════ КҮН ЖҮЙЕСІ ═══════════ */
(function solar() {
  const cv = $('#solarCanvas'); if (!cv) return;
  const C = makeCanvas(cv);
  const tip = $('#solarTip'), info = $('#solarInfo');
  const planets = [
    { n: 'Меркурий', r: 4,   o: 62,  col: '#b8a99a', dist: '57,9 млн км', per: '0,24 жыл', dia: '4 879 км' },
    { n: 'Шолпан',   r: 7,   o: 88,  col: '#e8c07a', dist: '108,2 млн км', per: '0,62 жыл', dia: '12 104 км' },
    { n: 'Жер',      r: 7.6, o: 120, col: '#5ea9ff', dist: '149,6 млн км', per: '1 жыл', dia: '12 742 км', moon: true },
    { n: 'Марс',     r: 5.6, o: 150, col: '#e07a4f', dist: '227,9 млн км', per: '1,88 жыл', dia: '6 779 км' },
    { n: 'Юпитер',   r: 17,  o: 205, col: '#d8b48f', dist: '778,5 млн км', per: '11,9 жыл', dia: '139 820 км', bands: true },
    { n: 'Сатурн',   r: 14,  o: 258, col: '#e6cf9e', dist: '1 434 млн км', per: '29,4 жыл', dia: '116 460 км', ring: true },
    { n: 'Уран',     r: 10.5,o: 305, col: '#9fe3e0', dist: '2 871 млн км', per: '84 жыл', dia: '50 724 км' },
    { n: 'Нептун',   r: 10,  o: 348, col: '#6f8fff', dist: '4 495 млн км', per: '164,8 жыл', dia: '49 244 км' },
  ];
  planets.forEach(p => { p.sp = Math.pow(120 / p.o, 1.5); p.a = Math.random() * 7; }); // Кеплер: ω ∝ a^-3/2
  let stars = [];
  function genStars() {
    stars = Array.from({ length: TOUCH ? 110 : 210 }, () => ({
      x: Math.random() * C.w, y: Math.random() * C.h,
      r: Math.random() * 1.3 + .3, tw: 1 + Math.random() * 3, ph: Math.random() * 7
    }));
  }
  new ResizeObserver(genStars).observe(cv); genStars();

  const cam = { x: 0, y: 0, z: 1 }, target = { x: 0, y: 0, z: 1 };
  let speed = 1, hovered = null, focused = null, drag = null, moved = false;

  const speedInp = $('#solarSpeed');
  speedInp.addEventListener('input', () => speed = +speedInp.value);
  const zoomBy = f => { target.z = clamp(target.z * f, 0.45, 3); if (target.z <= 1.02) { target.x = 0; target.y = 0; focused = null; info.classList.remove('show'); } };
  $('#zoomIn').addEventListener('click', () => zoomBy(1.3));
  $('#zoomOut').addEventListener('click', () => zoomBy(1 / 1.3));
  $('#solarReset').addEventListener('click', () => { Object.assign(target, { x: 0, y: 0, z: 1 }); focused = null; info.classList.remove('show'); });
  $('#siClose').addEventListener('click', () => { focused = null; info.classList.remove('show'); Object.assign(target, { x: 0, y: 0, z: 1 }); });
  cv.addEventListener('wheel', e => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.12 : 0.9); }, { passive: false });

  const baseScale = () => Math.min(C.w, C.h) / 820;
  const toScreen = (wx, wy) => [C.w / 2 + (wx * baseScale() - cam.x) * cam.z, C.h / 2 + (wy * baseScale() - cam.y) * cam.z];
  const planetXY = p => [Math.cos(p.a) * p.o, Math.sin(p.a) * p.o];

  cv.addEventListener('pointermove', e => {
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (drag) { moved = true; target.x -= (x - drag.x) / cam.z; target.y -= (y - drag.y) / cam.z; drag = { x, y }; return; }
    hovered = null;
    for (const p of planets) {
      const [wx, wy] = planetXY(p), [sx, sy] = toScreen(wx, wy);
      if (Math.hypot(sx - x, sy - y) < Math.max(p.r * baseScale() * cam.z + 8, 14)) { hovered = p; break; }
    }
    if (hovered) {
      tip.textContent = hovered.n; tip.style.opacity = 1;
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    } else tip.style.opacity = 0;
  });
  cv.addEventListener('pointerleave', () => { tip.style.opacity = 0; hovered = null; });
  cv.addEventListener('pointerdown', e => {
    const r = cv.getBoundingClientRect();
    drag = { x: e.clientX - r.left, y: e.clientY - r.top }; moved = false;
  });
  addEventListener('pointerup', () => drag = null);
  cv.addEventListener('click', e => {
    if (moved) return;
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let hit = null;
    for (const p of planets) {
      const [wx, wy] = planetXY(p), [sx, sy] = toScreen(wx, wy);
      if (Math.hypot(sx - x, sy - y) < Math.max(p.r * baseScale() * cam.z + 10, 18)) { hit = p; break; }
    }
    if (hit) {
      focused = hit;
      $('#siName').textContent = hit.n;
      $('#siDist').textContent = hit.dist;
      $('#siPeriod').textContent = hit.per;
      $('#siDiam').textContent = hit.dia;
      info.classList.add('show'); info.setAttribute('aria-hidden', 'false');
      target.z = Math.max(target.z, 1.7);
    }
  });

  watchVisible(cv, { visible: true, update(dt, t) {
    const { ctx, w, h } = C; if (!w) return;
    planets.forEach(p => p.a += p.sp * dt * speed * 0.5);
    if (focused) {
      const [wx, wy] = planetXY(focused);
      target.x = wx * baseScale(); target.y = wy * baseScale();
    }
    cam.x = lerp(cam.x, target.x, 0.07); cam.y = lerp(cam.y, target.y, 0.07); cam.z = lerp(cam.z, target.z, 0.07);
    ctx.clearRect(0, 0, w, h);
    // жұлдыздар
    for (const s of stars) {
      ctx.fillStyle = `rgba(200,225,255,${0.25 + 0.55 * Math.abs(Math.sin(t * s.tw + s.ph))})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
    }
    const [scx, scy] = toScreen(0, 0), bs = baseScale() * cam.z;
    // орбиталар
    planets.forEach(p => {
      ctx.strokeStyle = p === hovered || p === focused ? 'rgba(110,231,255,.5)' : 'rgba(150,180,255,.13)';
      ctx.lineWidth = p === hovered ? 1.6 : 1;
      ctx.beginPath(); ctx.arc(scx, scy, p.o * bs, 0, 7); ctx.stroke();
    });
    // Күн
    const fl = 1 + Math.sin(t * 5.1) * 0.03 + Math.sin(t * 9.7) * 0.02;
    const sg = ctx.createRadialGradient(scx, scy, 0, scx, scy, 120 * bs * fl);
    sg.addColorStop(0, 'rgba(255,236,190,.95)'); sg.addColorStop(0.18, 'rgba(255,196,110,.55)');
    sg.addColorStop(0.5, 'rgba(255,150,70,.14)'); sg.addColorStop(1, 'transparent');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(scx, scy, 120 * bs * fl, 0, 7); ctx.fill();
    const sb = ctx.createRadialGradient(scx - 5 * bs, scy - 6 * bs, 1, scx, scy, 26 * bs);
    sb.addColorStop(0, '#fff6da'); sb.addColorStop(0.6, '#ffd98a'); sb.addColorStop(1, '#ff9c4a');
    ctx.fillStyle = sb; ctx.beginPath(); ctx.arc(scx, scy, Math.max(26 * bs, 6), 0, 7); ctx.fill();
    // ғаламшарлар
    for (const p of planets) {
      const [wx, wy] = planetXY(p); const [sx, sy] = toScreen(wx, wy);
      const pr = Math.max(p.r * bs, 2.4);
      // Сатурн сақинасы (артқы жарты)
      if (p.ring) {
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(-0.42); ctx.scale(1, 0.34);
        ctx.strokeStyle = 'rgba(230,207,158,.5)'; ctx.lineWidth = pr * 0.34;
        ctx.beginPath(); ctx.arc(0, 0, pr * 1.75, Math.PI, 2 * Math.PI); ctx.stroke(); ctx.restore();
      }
      const ang = Math.atan2(scy - sy, scx - sx);
      const gx = sx + Math.cos(ang) * pr * 0.55, gy = sy + Math.sin(ang) * pr * 0.55;
      const pg = ctx.createRadialGradient(gx, gy, pr * 0.2, gx, gy, pr);
      pg.addColorStop(0, '#fff'); pg.addColorStop(0.3, p.col); pg.addColorStop(1, p.col);
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(sx, sy, pr, 0, 7); ctx.fill();
      if (p.bands) {
        ctx.strokeStyle = 'rgba(120,80,60,.4)'; ctx.lineWidth = pr * 0.08;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath(); ctx.arc(sx, sy, pr * (0.7 + i * 0.08), -Math.PI / 2, Math.PI / 2); ctx.stroke();
        }
      }
      if (p.moon) {
        const ma = t * 3 + p.a;
        const mr = pr * 2.2;
        ctx.fillStyle = '#cfd4d8';
        ctx.beginPath(); ctx.arc(sx + Math.cos(ma) * mr, sy + Math.sin(ma) * mr, pr * 0.25, 0, 7); ctx.fill();
      }
      if (p === hovered) {
        ctx.strokeStyle = 'rgba(110,231,255,.9)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx, sy, pr + 6, 0, 7); ctx.stroke();
      }
    }
  }});
})();

/* ═══════════ КЕСТЕР + ЗЕРТХАНАЛАР ═══════════ */
const labs = {
  1: {
    title: 'Теңүдемелі қозғалыс',
    sim: null, plot: null, meas: [], running: false, t0: 0, lastT: 0,
    params: { v0: 4, a: 2, tStar: 3.0, gateX: 0.78 },
    init() {
      this.sim = makeCanvas(document.getElementById('sim1'), 420);
      this.plot = makeCanvas(document.getElementById('plot1'), 230);
      this.plotT = makeCanvas(document.getElementById('tr1'), 130);
      this.bind();
      this.updateLabels();
      this.drawSim();
    },
    bind() {
      const v0 = $('#s1v0'), a = $('#s1a');
      v0.addEventListener('input', () => { this.params.v0 = +v0.value; $('#s1v0v').textContent = fmt(this.params.v0) + ' м/с'; this.updateLabels(); });
      a.addEventListener('input', () => { this.params.a = +a.value; $('#s1av').textContent = fmt(this.params.a) + ' м/с²'; this.updateLabels(); });
      $('#b1start').addEventListener('click', () => this.start());
      $('#b1meas').addEventListener('click', () => this.measure());
      $('#b1clear').addEventListener('click', () => this.clear());
      document.addEventListener('keydown', e => {
        if (!document.getElementById('lab-1').classList.contains('open')) return;
        if (e.code === 'Space') { e.preventDefault(); if (this.running) this.measure(); else this.start(); }
      });
    },
    updateLabels() {
      const t = this.params.tStar, v0 = this.params.v0, a = this.params.a;
      $('#st1th').textContent = fmt(v0 + a * t) + ' м/с';
    },
    start() {
      if (this.running) return;
      this.running = true;
      this.t0 = performance.now() / 1000 - this.lastT;
      $('#b1start').disabled = true; $('#b1meas').disabled = false;
      $('#hint1').textContent = 'Дене қозғалып жатыр. Жарқыл аймақтан өткен сәтте «Өлшеу» батырмасын басыңыз.'; $('#hint1').classList.add('warn');
    },
    measure() {
      if (!this.running) return;
      const t = performance.now() / 1000 - this.t0;
      const v = this.params.v0 + this.params.a * t;
      this.meas.push({ t, v });
      this.lastT = t;
      this.updateTable();
      this.running = false;
      $('#b1start').disabled = false; $('#b1meas').disabled = true;
      $('#hint1').textContent = '«Бастау» батырмасын басып, жаңа өлшеуді бастаңыз.'; $('#hint1').classList.remove('warn');
      if (this.meas.length >= 5) this.running = false;
    },
    clear() {
      this.meas = []; this.lastT = 0; this.running = false;
      $('#b1start').disabled = false; $('#b1meas').disabled = true;
      this.updateTable();
    },
    updateTable() {
      const tb = $('#tbody1'); tb.innerHTML = '';
      this.meas.forEach((m, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${i + 1}</td><td>${fmt(m.t)}</td><td>${fmt(m.v)}</td>`;
        tb.appendChild(tr);
      });
      this.updateStats();
      this.drawPlot();
    },
    updateStats() {
      const N = this.meas.length;
      if (N === 0) {
        $('#st1mean').textContent = '—'; $('#st1abs').textContent = '—'; $('#st1rel').textContent = '—'; $('#st1res').textContent = '—';
        return;
      }
      const vs = this.meas.map(m => m.v);
      const mean = vs.reduce((a, b) => a + b, 0) / N;
      const abs = vs.reduce((a, b) => a + Math.abs(b - mean), 0) / N;
      const rel = (abs / mean) * 100;
      $('#st1mean').textContent = fmt(mean) + ' м/с';
      $('#st1abs').textContent = fmt(abs) + ' м/с';
      $('#st1rel').textContent = fmt(rel) + '%';
      $('#st1res').textContent = `${fmt(mean)} ± ${fmt(abs)} м/с`;
    },
    drawSim() {
      if (!this.sim) return;
      const { ctx, w, h } = this.sim;
      ctx.clearRect(0, 0, w, h);
      // жол
      ctx.strokeStyle = 'rgba(160,190,255,.2)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, h * 0.78); ctx.lineTo(w, h * 0.78); ctx.stroke();
      // жарқыл аймақ
      const gx = this.params.gateX * w;
      ctx.fillStyle = 'rgba(110,231,255,.12)';
      ctx.fillRect(gx - 30, h * 0.78 - 24, 60, 48);
      // дене
      const t = this.running ? (performance.now() / 1000 - this.t0) : this.lastT;
      const x = this.params.v0 * t + 0.5 * this.params.a * t * t;
      const px = Math.min(w - 20, x * 40 + 40);
      ctx.fillStyle = '#6ee7ff'; ctx.shadowColor = '#6ee7ff'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(px, h * 0.78 - 12, 12, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      // уақыт/шыдамдық
      const v = this.params.v0 + this.params.a * t;
      $('#r1t').textContent = fmt(t) + ' с';
      $('#r1x').textContent = fmt(x) + ' м';
      $('#r1v').textContent = fmt(v) + ' м/с';
    },
    drawPlot() {
      if (!this.plot) return;
      const { ctx, w, h } = this.plot;
      ctx.clearRect(0, 0, w, h);
      // осідер
      ctx.strokeStyle = 'rgba(160,190,255,.2)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(30, h - 20); ctx.lineTo(w - 10, h - 20); ctx.moveTo(30, 20); ctx.lineTo(30, h - 20); ctx.stroke();
      const maxT = Math.max(5, ...this.meas.map(m => m.t));
      const maxV = Math.max(10, ...this.meas.map(m => m.v));
      const X = t => 30 + (t / maxT) * (w - 40);
      const Y = v => h - 20 - (v / maxV) * (h - 40);
      // теориялық сызық
      ctx.strokeStyle = 'rgba(110,231,255,.4)'; ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (let t = 0; t <= maxT; t += 0.1) {
        const v = this.params.v0 + this.params.a * t;
        const x = X(t), y = Y(v);
        t ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke(); ctx.setLineDash([]);
      // өлшеу нүктелері
      this.meas.forEach(m => {
        ctx.fillStyle = '#ffb86b';
        ctx.beginPath(); ctx.arc(X(m.t), Y(m.v), 4, 0, 7); ctx.fill();
      });
    },
    update(dt) {
      if (this.running) this.drawSim();
      if (this.meas.length > 0 && this.running === false) this.drawPlot();
    }
  },
  2: {
    title: 'Горизонталь лақтырылған дене',
    sim: null, meas: [], running: false, params: { h: 20, v0: 8, g: 9.8 },
    init() {
      this.sim = makeCanvas(document.getElementById('sim2'), 420);
      this.bind();
      this.updateLabels();
      this.drawSim();
    },
    bind() {
      const h = $('#s2h'), v0 = $('#s2v0');
      h.addEventListener('input', () => { this.params.h = +h.value; $('#s2hv').textContent = fmt(this.params.h) + ' м'; this.updateLabels(); });
      v0.addEventListener('input', () => { this.params.v0 = +v0.value; $('#s2v0v').textContent = fmt(this.params.v0) + ' м/с'; this.updateLabels(); });
      $('#b2launch').addEventListener('click', () => this.launch());
      $('#b2meas').addEventListener('click', () => this.measure());
      $('#b2clear').addEventListener('click', () => this.clear());
    },
    updateLabels() {
      const t = Math.sqrt(2 * this.params.h / this.params.g);
      const L = this.params.v0 * t;
      $('#st2th').textContent = fmt(L) + ' м';
    },
    launch() {
      if (this.running) return;
      this.running = true;
      this.t0 = performance.now() / 1000;
      this.x = 0; this.y = this.params.h;
      this.vx = this.params.v0; this.vy = 0;
      $('#b2launch').disabled = true; $('#b2meas').disabled = false;
      $('#hint2').textContent = 'Дене қозғалып жатыр. қонған сәтте «Өлшеу» батырмасын басыңыз.'; $('#hint2').classList.add('warn');
    },
    measure() {
      if (!this.running) return;
      const t = performance.now() / 1000 - this.t0;
      const L = this.vx * t;
      this.meas.push({ t, L });
      this.updateTable();
      this.running = false;
      $('#b2launch').disabled = false; $('#b2meas').disabled = true;
      $('#hint2').textContent = '«Лақтыру» батырмасын басып, жаңа өлшеуді бастаңыз.'; $('#hint2').classList.remove('warn');
      if (this.meas.length >= 5) this.running = false;
    },
    clear() {
      this.meas = []; this.running = false;
      $('#b2launch').disabled = false; $('#b2meas').disabled = true;
      this.updateTable();
    },
    updateTable() {
      const tb = $('#tbody2'); tb.innerHTML = '';
      this.meas.forEach((m, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${i + 1}</td><td>${fmt(m.t)}</td><td>${fmt(m.L)}</td>`;
        tb.appendChild(tr);
      });
      this.updateStats();
    },
    updateStats() {
      const N = this.meas.length;
      if (N === 0) {
        $('#st2mean').textContent = '—'; $('#st2abs').textContent = '—'; $('#st2rel').textContent = '—'; $('#st2res').textContent = '—';
        return;
      }
      const Ls = this.meas.map(m => m.L);
      const mean = Ls.reduce((a, b) => a + b, 0) / N;
      const abs = Ls.reduce((a, b) => a + Math.abs(b - mean), 0) / N;
      const rel = (abs / mean) * 100;
      $('#st2mean').textContent = fmt(mean) + ' м';
      $('#st2abs').textContent = fmt(abs) + ' м';
      $('#st2rel').textContent = fmt(rel) + '%';
      $('#st2res').textContent = `${fmt(mean)} ± ${fmt(abs)} м`;
    },
    drawSim() {
      if (!this.sim) return;
      const { ctx, w, h } = this.sim;
      ctx.clearRect(0, 0, w, h);
      // жер беті
      ctx.strokeStyle = 'rgba(160,190,255,.2)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, h - 20); ctx.lineTo(w, h - 20); ctx.stroke();
      // бастапқы нүкте
      ctx.fillStyle = 'rgba(110,231,255,.2)';
      ctx.fillRect(40, 40, 20, this.params.h * 4);
      if (this.running) {
        const t = performance.now() / 1000 - this.t0;
        this.x = this.vx * t;
        this.y = this.params.h - 0.5 * this.params.g * t * t;
        if (this.y < 0) this.y = 0;
      }
      const px = 40 + this.x * 8, py = 40 + (this.params.h - this.y) * 4;
      ctx.fillStyle = '#6ee7ff'; ctx.shadowColor = '#6ee7ff'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(px, py, 10, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      const t = this.running ? (performance.now() / 1000 - this.t0) : 0;
      const L = this.vx * t;
      $('#r2t').textContent = fmt(t) + ' с';
      $('#r2L').textContent = fmt(L) + ' м';
    },
    update(dt) {
      if (this.running) this.drawSim();
    }
  },
  3: {
    title: 'Маятникпен g анықтау',
    sim: null, meas: [], running: false, params: { L: 1.0, N: 10, g: 9.8 },
    init() {
      this.sim = makeCanvas(document.getElementById('sim3'), 420);
      this.bind();
      this.updateLabels();
      this.drawSim();
    },
    bind() {
      const L = $('#s3L');
      L.addEventListener('input', () => { this.params.L = +L.value; $('#s3Lv').textContent = fmt(this.params.L) + ' м'; this.updateLabels(); });
      $('#b3start').addEventListener('click', () => this.start());
      $('#b3clear').addEventListener('click', () => this.clear());
    },
    updateLabels() {
      const T = 2 * Math.PI * Math.sqrt(this.params.L / this.params.g);
      $('#st3th').textContent = fmt(this.params.g) + ' м/с²';
    },
    start() {
      if (this.running) return;
      this.running = true;
      this.t0 = performance.now() / 1000;
      this.count = 0;
      this.angle = 0.3;
      this.lastAngle = 0.3;
      $('#b3start').disabled = true;
      $('#hint3').textContent = 'Маятник тербеледі. 10 рет тербелгеннен соң секундомір тоқтайды.'; $('#hint3').classList.add('warn');
    },
    measure() {
      const t = performance.now() / 1000 - this.t0;
      const T = t / this.params.N;
      const g = 4 * Math.PI * Math.PI * this.params.L / (T * T);
      this.meas.push({ L: this.params.L, t, T, g });
      this.updateTable();
      this.running = false;
      $('#b3start').disabled = false;
      $('#hint3').textContent = '«Бастау» батырмасын басып, жаңа өлшеуді бастаңыз.'; $('#hint3').classList.remove('warn');
      if (this.meas.length >= 5) this.running = false;
    },
    clear() {
      this.meas = []; this.running = false;
      $('#b3start').disabled = false;
      this.updateTable();
    },
    updateTable() {
      const tb = $('#tbody3'); tb.innerHTML = '';
      this.meas.forEach((m, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${i + 1}</td><td>${fmt(m.L)}</td><td>${fmt(m.t)}</td><td>${fmt(m.T)}</td><td>${fmt(m.g)}</td>`;
        tb.appendChild(tr);
      });
      this.updateStats();
    },
    updateStats() {
      const N = this.meas.length;
      if (N === 0) {
        $('#st3mean').textContent = '—'; $('#st3abs').textContent = '—'; $('#st3rel').textContent = '—'; $('#st3res').textContent = '—';
        return;
      }
      const gs = this.meas.map(m => m.g);
      const mean = gs.reduce((a, b) => a + b, 0) / N;
      const abs = gs.reduce((a, b) => a + Math.abs(b - mean), 0) / N;
      const rel = (abs / mean) * 100;
      $('#st3mean').textContent = fmt(mean) + ' м/с²';
      $('#st3abs').textContent = fmt(abs) + ' м/с²';
      $('#st3rel').textContent = fmt(rel) + '%';
      $('#st3res').textContent = `${fmt(mean)} ± ${fmt(abs)} м/с²`;
    },
    drawSim() {
      if (!this.sim) return;
      const { ctx, w, h } = this.sim;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = 60, L = this.params.L * 180;
      let angle = this.angle;
      if (this.running) {
        const t = performance.now() / 1000 - this.t0;
        const omega = Math.sqrt(this.params.g / this.params.L);
        angle = 0.3 * Math.cos(omega * t);
        this.count = Math.floor(omega * t / Math.PI);
        if (this.count >= this.params.N && this.running) {
          this.measure();
        }
      }
      const bx = cx + Math.sin(angle) * L;
      const by = cy + Math.cos(angle) * L;
      // жіп
      ctx.strokeStyle = 'rgba(160,190,255,.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(bx, by); ctx.stroke();
      // бал
      ctx.fillStyle = '#6ee7ff'; ctx.shadowColor = '#6ee7ff'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(bx, by, 12, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      $('#r3n').textContent = `${this.count} / ${this.params.N}`;
      $('#r3t').textContent = fmt(this.running ? performance.now() / 1000 - this.t0 : 0) + ' с';
    },
    update(dt) {
      if (this.running) this.drawSim();
    }
  },
  4: {
    title: 'Беттік толқын жылдамдығын анықтау',
    sim: null, meas: [], params: { f: 2.0, h: 20, g: 9.8, error: 0.003 },
    init() {
      this.sim = makeCanvas(document.getElementById('sim4'), 420);
      this.bind();
      this.updateLabels();
      this.drawSim();
    },
    bind() {
      const f = $('#s4f'), h = $('#s4h');
      f.addEventListener('input', () => { this.params.f = +f.value; $('#s4fv').textContent = fmt(this.params.f) + ' Гц'; this.updateLabels(); });
      h.addEventListener('input', () => { this.params.h = +h.value; $('#s4hv').textContent = fmt(this.params.h) + ' мм'; this.updateLabels(); });
      $('#b4meas').addEventListener('click', () => this.measure());
      $('#b4clear').addEventListener('click', () => this.clear());
    },
    updateLabels() {
      const v = Math.sqrt(this.params.g * this.params.h / 1000);
      const lam = v / this.params.f;
      $('#r4l').textContent = fmt(lam) + ' м';
      $('#r4v').textContent = fmt(v) + ' м/с';
      $('#st4th').textContent = fmt(v) + ' м/с';
    },
    measure() {
      const v = Math.sqrt(this.params.g * this.params.h / 1000);
      const lam = v / this.params.f;
      const measuredLam = lam + tri(this.params.error);
      const measuredV = measuredLam * this.params.f;
      this.meas.push({ f: this.params.f, lam: measuredLam, v: measuredV });
      this.updateTable();
      if (this.meas.length >= 5) this.running = false;
    },
    clear() {
      this.meas = [];
      this.updateTable();
    },
    updateTable() {
      const tb = $('#tbody4'); tb.innerHTML = '';
      this.meas.forEach((m, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${i + 1}</td><td>${fmt(m.f)}</td><td>${fmt(m.lam)}</td><td>${fmt(m.v)}</td>`;
        tb.appendChild(tr);
      });
      this.updateStats();
    },
    updateStats() {
      const N = this.meas.length;
      if (N === 0) {
        $('#st4mean').textContent = '—'; $('#st4abs').textContent = '—'; $('#st4rel').textContent = '—'; $('#st4res').textContent = '—';
        return;
      }
      const vs = this.meas.map(m => m.v);
      const mean = vs.reduce((a, b) => a + b, 0) / N;
      const abs = vs.reduce((a, b) => a + Math.abs(b - mean), 0) / N;
      const rel = (abs / mean) * 100;
      $('#st4mean').textContent = fmt(mean) + ' м/с';
      $('#st4abs').textContent = fmt(abs) + ' м/с';
      $('#st4rel').textContent = fmt(rel) + '%';
      $('#st4res').textContent = `${fmt(mean)} ± ${fmt(abs)} м/с`;
    },
    drawSim() {
      if (!this.sim) return;
      const { ctx, w, h } = this.sim;
      ctx.clearRect(0, 0, w, h);
      // су беті
      ctx.strokeStyle = 'rgba(160,190,255,.2)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, h * 0.6); ctx.lineTo(w, h * 0.6); ctx.stroke();
      // толқын
      const v = Math.sqrt(this.params.g * this.params.h / 1000);
      const lam = v / this.params.f;
      const k = 2 * Math.PI / lam;
      const A = h * 0.15;
      ctx.strokeStyle = '#6ee7ff'; ctx.lineWidth = 2.5; ctx.shadowColor = 'rgba(110,231,255,.7)'; ctx.shadowBlur = 10;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const y = h * 0.6 + A * Math.sin(k * x / 40 - performance.now() / 1000 * this.params.f * 2 * Math.PI);
        x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke(); ctx.shadowBlur = 0;
      // λ белгісі
      const px = w * 0.2;
      ctx.strokeStyle = '#ffb86b'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(px, h * 0.6 - A - 20); ctx.lineTo(px, h * 0.6 - A - 8);
      ctx.moveTo(px + lam * 40, h * 0.6 - A - 20); ctx.lineTo(px + lam * 40, h * 0.6 - A - 8);
      ctx.moveTo(px, h * 0.6 - A - 14); ctx.lineTo(px + lam * 40, h * 0.6 - A - 14); ctx.stroke();
      ctx.font = '600 13px JetBrains Mono'; ctx.fillStyle = '#ffb86b';
      ctx.fillText('λ', px + lam * 20 - 4, h * 0.6 - A - 22);
    },
    update(dt) {
      this.drawSim();
    }
  }
};

/* ═══════════ ЗЕРТХАНАЛАРды басқару ═══════════ */
function initLabsNavigation() {
  $$('.lab-row').forEach(row => {
    const labId = row.dataset.lab;
    const openLab = () => {
      const lab = labs[labId];
      if (!lab) return;
      
      // Hide all lab screens
      $$('.lab-screen').forEach(s => s.classList.remove('open'));
      
      // Show selected lab
      const screen = document.getElementById(`lab-${labId}`);
      screen.classList.add('open');
      document.body.classList.add('lock');
      
      // Initialize lab if not already
      if (!lab.sim) lab.init();
      
      // Scroll to top of lab screen
      screen.scrollTop = 0;
    };
    
    row.addEventListener('click', openLab);
    row.addEventListener('keydown', e => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        openLab();
      }
    });
  });
  
  // Back buttons
  $$('.lab-back').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.lab-screen').forEach(s => s.classList.remove('open'));
      document.body.classList.remove('lock');
      window.__closeMenu();
    });
  });
  
  // Theory toggle
  $$('[data-theory]').forEach(btn => {
    btn.addEventListener('click', () => {
      const theory = document.getElementById(btn.dataset.theory);
      theory.classList.toggle('open');
    });
  });
}

/* ═══════════ ЗЕРТХАНАЛАРды бастыру ═══════════ */
function initLabPreviews() {
  $$('.lab-prev').forEach(canvas => {
    const labId = canvas.dataset.prev;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    
    // Simple animated preview based on lab type
    function drawPreview() {
      ctx.clearRect(0, 0, w, h);
      
      if (labId === '1') {
        // Uniform acceleration preview
        ctx.strokeStyle = '#6ee7ff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(10, h - 20); ctx.lineTo(w - 10, h - 20); ctx.stroke();
        const t = (Date.now() / 500) % 2;
        const x = 20 + (t * (w - 40));
        ctx.fillStyle = '#6ee7ff';
        ctx.beginPath(); ctx.arc(x, h - 30, 6, 0, 7); ctx.fill();
      } else if (labId === '2') {
        // Projectile motion preview
        ctx.strokeStyle = 'rgba(160,190,255,.2)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, h - 20); ctx.lineTo(w, h - 20); ctx.stroke();
        const t = (Date.now() / 400) % 3;
        const x = 20 + t * (w - 40) / 3;
        const y = h - 20 - 40 * t * (1 - t / 3);
        ctx.fillStyle = '#ffb86b';
        ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill();
      } else if (labId === '3') {
        // Pendulum preview
        const cx = w / 2, cy = 20, L = Math.min(w, h) * 0.35;
        const angle = 0.3 * Math.sin(Date.now() / 400);
        const bx = cx + Math.sin(angle) * L;
        const by = cy + Math.cos(angle) * L;
        ctx.strokeStyle = 'rgba(160,190,255,.6)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(bx, by); ctx.stroke();
        ctx.fillStyle = '#b28bff';
        ctx.beginPath(); ctx.arc(bx, by, 6, 0, 7); ctx.fill();
      } else if (labId === '4') {
        // Wave preview
        ctx.strokeStyle = '#6ee7ff'; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 2) {
          const y = h / 2 + 15 * Math.sin(x / 10 - Date.now() / 200);
          x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      
      requestAnimationFrame(drawPreview);
    }
    
    drawPreview();
  });
}

/* ═══════════ БАСТАРУ ═══════════ */
function initApp() {
  // Wait for critical resources
  waitForResources().then(() => {
    // Initialize core functionality
    renderMath();
    initLabsNavigation();
    initLabPreviews();
    
    // Initialize heavy operations after a short delay
    setTimeout(() => {
      initHero();
      initVignettes();
      initSolar();
      
      // Initialize labs
      Object.values(labs).forEach(lab => lab.init());
      
      // Hide preloader
      hidePreloader();
    }, 100);
  });
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
