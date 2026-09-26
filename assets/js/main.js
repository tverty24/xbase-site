/* ==========================================================================
   XBASE — main.js
   Спільний для всіх сторінок: smooth scroll, курсор, навігація, модалка
   бронювання. Секції головної (WebGL-герой, історія, залізо, клуби, PS)
   вмикаються лише якщо є на сторінці. Потрібні config.js і data.js.
   ========================================================================== */
(function () {
  'use strict';

  const D = window.XBASE;
  const doc = document.documentElement;
  doc.classList.add('js');

  /* ---------- helpers ---------- */
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const mq = (q) => window.matchMedia(q);
  const reduced = mq('(prefers-reduced-motion: reduce)').matches;
  const finePointer = mq('(hover: hover) and (pointer: fine)').matches;
  const isDesk = () => window.innerWidth >= 1024;
  const store = {
    get(k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clubById = D.clubById;
  let vw = window.innerWidth, vh = window.innerHeight;

  /* ======================================================================
     1. SPLIT TEXT
     ====================================================================== */
  function splitChars(el) {
    const text = el.textContent;
    el.setAttribute('aria-label', text.replace(/ /g, ' '));
    el.textContent = '';
    let i = 0;
    text.split(' ').forEach((word, wi, arr) => {
      const w = document.createElement('span');
      w.className = 'w';
      w.setAttribute('aria-hidden', 'true');
      for (const ch of word) {
        const c = document.createElement('span');
        c.className = 'ch';
        c.textContent = ch;
        c.style.setProperty('--i', i++);
        w.appendChild(c);
      }
      el.appendChild(w);
      if (wi < arr.length - 1) el.appendChild(document.createTextNode(' '));
    });
  }
  $$('.split, .split-hero').forEach(splitChars);

  // story statement → слова підсвічуються зі скролом
  const statement = $('[data-words]');
  let statementWords = [];
  if (statement) {
    const words = statement.textContent.split(/\s+/).filter(Boolean);
    statement.innerHTML = words.map((w) => `<span class="sw${/xbase/i.test(w) ? ' hl' : ''}">${esc(w)}</span>`).join(' ');
    statementWords = $$('.sw', statement);
  }

  /* ======================================================================
     2. IMAGE FALLBACKS
     ====================================================================== */
  function guardImg(img) {
    const fail = () => img.classList.add('img-failed');
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) fail();
    img.addEventListener('error', fail);
    img.addEventListener('load', () => img.classList.remove('img-failed'));
  }
  $$('img').forEach(guardImg);

  /* ======================================================================
     3. SMOOTH SCROLL (desktop, без hijack на тач-пристроях)
     ====================================================================== */
  const SS = {
    enabled: finePointer && !reduced,
    target: window.scrollY, cur: window.scrollY, running: false, locked: false,
    max() { return document.documentElement.scrollHeight - window.innerHeight; }
  };
  window.addEventListener('wheel', (e) => {
    if (!SS.enabled || SS.locked || e.ctrlKey) return;
    if (e.target.closest && e.target.closest('[data-lenis-prevent]')) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    let d = e.deltaY;
    if (e.deltaMode === 1) d *= 40; else if (e.deltaMode === 2) d *= vh;
    if (!SS.running) { SS.cur = SS.target = window.scrollY; SS.lastSet = null; }
    SS.target = clamp(SS.target + d, 0, SS.max());
    SS.running = true;
  }, { passive: false });
  window.addEventListener('scroll', () => { if (!SS.running) SS.cur = SS.target = window.scrollY; }, { passive: true });
  ['keydown', 'mousedown', 'touchstart'].forEach((ev) => window.addEventListener(ev, (e) => {
    if (ev === 'keydown' && !['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) return;
    SS.running = false;
  }, { passive: true }));

  function scrollToY(y) {
    y = clamp(y, 0, SS.max());
    if (SS.enabled && !SS.locked) { SS.cur = window.scrollY; SS.target = y; SS.running = true; SS.lastSet = null; }
    else window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
  }
  function lockScroll(on) {
    SS.locked = on; SS.running = false;
    document.body.classList.toggle('is-locked', on);
  }

  /* ======================================================================
     4. PRELOADER (лише на головній)
     ====================================================================== */
  const loader = $('#loader');
  function runLoader(done) {
    if (!loader) { document.body.classList.remove('is-loading'); done(); return; }
    const loaderCount = $('#loaderCount'), loaderBar = $('#loaderBar');
    const repeat = store.get('xb-visited') === '1';
    const dur = reduced ? 200 : repeat ? 700 : 1500;
    const t0 = performance.now();
    let fontsReady = false;
    const fr = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    fr.then(() => { fontsReady = true; });
    setTimeout(() => { fontsReady = true; }, 2400); // не чекаємо шрифти вічно
    function step(now) {
      let p = clamp((now - t0) / dur);
      if (!fontsReady) p = Math.min(p, 0.92);
      const e = 1 - Math.pow(1 - p, 3);
      loaderCount.textContent = String(Math.round(e * 100)).padStart(3, '0');
      loaderBar.style.transform = `scaleX(${e})`;
      if (p < 1) requestAnimationFrame(step);
      else {
        store.set('xb-visited', '1');
        setTimeout(() => {
          // половини X роз'їжджаються перпендикулярно до шва — достатньо, щоб піти за край екрана
          loader.style.setProperty('--split', `${Math.ceil(Math.hypot(innerWidth, innerHeight) * 0.62)}px`);
          loader.classList.add('is-done');
          document.body.classList.remove('is-loading');
          done();
          setTimeout(() => loader.remove(), reduced ? 400 : 1600);
        }, reduced ? 0 : 250);
      }
    }
    requestAnimationFrame(step);
  }

  /* ======================================================================
     5. REVEALS (IntersectionObserver)
     ====================================================================== */
  let revealIO = null;
  function observeReveals(root) {
    const targets = $$('.reveal-up, .reveal-clip, .split, .footer__mega', root).filter((t) => !t.classList.contains('is-in'));
    if (!revealIO) { targets.forEach((t) => t.classList.add('is-in')); return; }
    targets.forEach((t) => revealIO.observe(t));
  }
  function initReveals() {
    [['.tier', .07], ['.crow', .06], ['.bc-fact, .bc-cta', .08], ['.tv', .06]].forEach(([sel, step]) => {
      $$(sel).forEach((el, i) => { el.classList.add('reveal-up'); el.style.setProperty('--d', (i * step).toFixed(2) + 's'); });
    });
    if ('IntersectionObserver' in window && !reduced) {
      revealIO = new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); revealIO.unobserve(en.target); } });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    }
    observeReveals(document);
  }
  function heroIntro() {
    $$('.hero__line, .phero__title').forEach((l, i) => setTimeout(() => l.classList.add('is-in'), 80 + i * 180));
  }

  /* ======================================================================
     6. HERO WEBGL SCENE (сирий WebGL, 1 draw call)
     ====================================================================== */
  const GL = (function () {
    const canvas = $('#gl');
    if (!canvas) return null;
    let gl;
    try { gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }); } catch (e) { gl = null; }
    if (!gl) { canvas.remove(); return null; }

    const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const fs = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes; uniform float uT; uniform vec2 uM; uniform float uS; uniform vec3 uA; uniform vec3 uV; uniform float uQ;
float h(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  vec2 m=uM;
  float hor=-0.1+m.y*0.035+uS*0.28;
  vec3 col=vec3(0.010,0.012,0.018);
  vec2 sp=uv-vec2(0.22+m.x*0.12,hor+0.02);
  float glow=exp(-length(sp*vec2(0.55,1.7))*3.0);
  col+=uA*glow*0.5;
  col+=uV*exp(-length(uv-vec2(-0.75-m.x*0.1,0.32))*1.7)*0.30;
  col+=mix(uA,vec3(1.),.45)*exp(-abs(uv.y-hor)*140.)*0.55*(0.35+0.65*exp(-abs(sp.x)*1.6));
  float below=hor-uv.y;
  if(below>0.0){
    float z=0.3/below;
    float x=(uv.x-m.x*0.1)*z;
    vec2 g=vec2(x*1.25,z+uT*0.85);
    vec2 gf=abs(fract(g)-0.5);
    float lwx=0.015+1.6*z*1.25/uRes.y;
    float lwz=0.015+1.6*(z*z/0.3)/uRes.y;
    float lx=1.0-smoothstep(0.0,lwx,0.5-gf.x);
    float lz=1.0-smoothstep(0.0,lwz,0.5-gf.y);
    float grid=max(lx,lz);
    float fade=exp(-z*0.085);
    vec3 gc=mix(uA,vec3(0.72,0.76,1.0),0.3);
    col+=gc*grid*fade*0.5;
    float band=exp(-abs(fract(z*0.05-uT*0.22)-0.5)*16.0);
    col+=uA*band*fade*grid*0.9;
    col+=uA*glow*0.22*smoothstep(0.45,0.0,below);
  }
  for(int i=0;i<3;i++){
    float fi=float(i);
    float bx=sin(uT*0.13+fi*2.1)*0.95+m.x*0.05*(fi+1.0);
    float b=min(0.0022/abs(uv.x-bx-(uv.y-hor)*0.18*(fi-1.0)),1.0);
    col+=mix(uV,uA,fi*0.5)*b*smoothstep(hor-0.02,hor+0.7,uv.y)*0.32;
  }
  if(uQ>0.5){
    for(int l=0;l<2;l++){
      float fl=float(l);
      vec2 pg=(uv+m*0.02*(fl+1.0))*vec2(22.0+fl*14.0)+vec2(0.0,uT*(0.35+fl*0.3));
      vec2 id=floor(pg); vec2 f=fract(pg)-0.5;
      float r=h(id+fl*17.0);
      if(r>0.88){
        vec2 o=vec2(h(id+3.1),h(id+7.7))-0.5;
        float d=length(f-o*0.6);
        float tw=0.5+0.5*sin(uT*2.0+r*60.0);
        col+=mix(vec3(0.9),uA,step(0.96,r))*smoothstep(0.07,0.0,d)*tw*(0.55-fl*0.2);
      }
    }
  }
  vec2 mp=vec2(m.x*0.5*uRes.x/uRes.y,m.y*0.5);
  col+=uA*exp(-length(uv-mp)*4.5)*0.07;
  col*=1.0-0.55*dot(uv*0.85,uv*0.85);
  col*=1.0-uS*0.75;
  col+=(h(gl_FragCoord.xy+fract(uT))-0.5)*0.018;
  gl_FragColor=vec4(col,1.0);
}`;
    function sh(type, src) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('[xbase] shader:', gl.getShaderInfoLog(s)); return null; }
      return s;
    }
    const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
    if (!v || !f) { canvas.remove(); return null; }
    const prog = gl.createProgram();
    gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return null; }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {};
    ['uRes', 'uT', 'uM', 'uS', 'uA', 'uV', 'uQ'].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
    const css = getComputedStyle(doc);
    const rgb = (name, fb) => (css.getPropertyValue(name).trim() || fb).split(',').map((n) => parseFloat(n) / 255);
    gl.uniform3fv(U.uA, rgb('--accent-rgb', '200,255,46'));
    gl.uniform3fv(U.uV, rgb('--violet-rgb', '111,91,255'));
    gl.uniform1f(U.uQ, isDesk() ? 1 : 0);

    let lost = false;
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; });

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, isDesk() ? 1.5 : 1);
      const w = Math.floor(canvas.clientWidth * dpr), hh = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== hh) { canvas.width = w; canvas.height = hh; }
      gl.viewport(0, 0, w, hh);
      gl.uniform2f(U.uRes, w, hh);
      gl.uniform1f(U.uQ, isDesk() ? 1 : 0);
    }
    resize();
    return {
      resize,
      render(t, mx, my, s) {
        if (lost) return;
        gl.uniform1f(U.uT, (t / 1000) % 1000);
        gl.uniform2f(U.uM, mx, my);
        gl.uniform1f(U.uS, s);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    };
  })();

  /* ======================================================================
     7. POINTER + CURSOR
     ====================================================================== */
  const P = { x: vw / 2, y: vh / 2, nx: 0, ny: 0 };
  const cursor = $('#cursor');
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    P.x = e.clientX; P.y = e.clientY;
    if (cursor) cursor.classList.remove('is-hidden');
    P.nx = (e.clientX / vw) * 2 - 1; P.ny = -((e.clientY / vh) * 2 - 1);
  }, { passive: true });

  const C = { rx: vw / 2, ry: vh / 2 };
  let cDot, cRing, cLabel;
  if (finePointer && cursor) {
    doc.classList.add('has-cursor');
    cDot = $('.cursor__dot', cursor); cRing = $('.cursor__ring', cursor); cLabel = $('.cursor__label', cursor);
    document.addEventListener('mouseover', (e) => {
      const t = e.target.closest('a, button, [data-cursor], .opt, input, select, label');
      cursor.classList.toggle('is-hover', !!t);
      const lbl = t && t.closest('[data-cursor]');
      const txt = lbl && !(t.matches('button, a') && !t.hasAttribute('data-cursor')) ? lbl.getAttribute('data-cursor') : '';
      cLabel.textContent = txt || '';
      cursor.classList.toggle('is-label', !!txt);
    });
    document.addEventListener('mouseleave', () => cursor.classList.add('is-hidden'));
    document.addEventListener('mouseenter', () => cursor.classList.remove('is-hidden'));
    window.addEventListener('mousedown', () => cursor.classList.add('is-down'));
    window.addEventListener('mouseup', () => cursor.classList.remove('is-down'));
  }
  function tickCursor() {
    if (!cDot) return;
    C.rx = lerp(C.rx, P.x, 0.2); C.ry = lerp(C.ry, P.y, 0.2);
    const big = cursor.classList.contains('is-label') ? 2.2 : cursor.classList.contains('is-hover') ? 1.5 : 1;
    cDot.style.transform = `translate3d(${P.x}px, ${P.y}px, 0)`;
    cRing.style.transform = `translate3d(${C.rx}px, ${C.ry}px, 0) scale(${big})`;
    cLabel.style.transform = `scale(${1 / big})`;
  }

  /* ======================================================================
     8. MAGNETIC BUTTONS + TILT CARDS
     ====================================================================== */
  if (finePointer && !reduced) {
    $$('.magnetic').forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate3d(${dx * 0.25}px, ${dy * 0.35}px, 0) scale(1.04)`;
      });
      el.addEventListener('mouseleave', () => { el.style.transform = ''; });
    });
    $$('[data-tilt]').forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        el.style.setProperty('--ry', ((px - 0.5) * 10).toFixed(2) + 'deg');
        el.style.setProperty('--rx', ((0.5 - py) * 10).toFixed(2) + 'deg');
        el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      });
      el.addEventListener('mouseleave', () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
    });
  }

  /* ======================================================================
     9. NAV + MOBILE MENU
     ====================================================================== */
  const nav = $('#nav');
  const burger = $('#burger');
  const mmenu = $('#mmenu');
  let menuOpen = false;
  function setMenu(open) {
    if (!burger || !mmenu) return;
    menuOpen = open;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрити меню' : 'Відкрити меню');
    mmenu.classList.toggle('is-open', open);
    mmenu.setAttribute('aria-hidden', String(!open));
    lockScroll(open);
    if (nav) nav.classList.remove('is-hidden');
  }
  if (burger) burger.addEventListener('click', () => setMenu(!menuOpen));

  // якірні посилання (плавно, закривають меню)
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const t = document.getElementById(id.slice(1));
    if (!t) return;
    e.preventDefault();
    if (menuOpen) setMenu(false);
    const y = id === '#top' ? 0 : t.getBoundingClientRect().top + window.scrollY;
    scrollToY(y);
    if (history.replaceState) history.replaceState(null, '', id);
  });

  const navLinks = $$('.nav__links a').filter((a) => (a.getAttribute('href') || '').startsWith('#'));
  const navTargets = navLinks.map((a) => document.getElementById(a.getAttribute('href').slice(1)));

  /* ======================================================================
     10. CLOCK + YEAR
     ====================================================================== */
  const clock = $('#clock');
  function tickClock() {
    if (!clock) return;
    try { clock.textContent = new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' }).format(new Date()); }
    catch (e) { const d = new Date(); clock.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  }
  if (clock) { tickClock(); setInterval(tickClock, 15000); }
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* ======================================================================
     11. MARQUEE (швидкість і skew залежать від швидкості скролу)
     ====================================================================== */
  const marquees = $$('[data-marquee]').map((row) => {
    row.innerHTML += row.innerHTML; // дублюємо для безшовної петлі
    Array.from(row.children).forEach((c, i) => { if (i >= row.children.length / 2) c.setAttribute('aria-hidden', 'true'); });
    return { row, x: 0, w: 0 };
  });

  /* ======================================================================
     12. SEGMENTED CONTROLS
     ====================================================================== */
  function placeThumb(seg) {
    const on = $('[aria-selected="true"]', seg), th = $('.seg__thumb', seg);
    if (!on || !th) return;
    th.style.width = on.offsetWidth + 'px';
    th.style.transform = `translateX(${on.offsetLeft}px)`;
  }
  function selectSeg(seg, btn) {
    $$('button', seg).forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
    placeThumb(seg);
  }

  /* ======================================================================
     13. ЦІНИ НА ГОЛОВНІЙ — мінімум по мережі з API
     ====================================================================== */
  const PT_ROWS = ['gaming', 'pro', 'vip', 'supervip', 'ps5', 'ps5vip', 'ps4pro'];
  const ptable = $('#ptable');
  let allClubs = null;
  function renderPrices(days) {
    const tb = $('tbody', ptable);
    if (!allClubs || !allClubs.length) {
      tb.innerHTML = `<tr><td colspan="6" class="ptable__msg">${allClubs ? 'Не вдалося завантажити тарифи. Ціни є на сторінці кожного клубу або в адміністратора.' : 'Завантаження тарифів…'}</td></tr>`;
      return;
    }
    tb.innerHTML = PT_ROWS.map((type) => {
      const cells = D.PACKAGES.map((p) => D.minPrice(allClubs, type, p.id, days));
      if (cells.every((v) => v === null)) return '';
      return `<tr><th scope="row">${D.TYPES[type]}</th>${cells.map((v) => `<td>${v === null ? '<span class="num">—</span>' : `<span class="num">${v}</span><i>₴</i>`}</td>`).join('')}</tr>`;
    }).join('');
  }
  function fillFromPrices() {
    $$('[data-from]').forEach((el) => {
      const v = D.minPrice(allClubs, el.dataset.from, 'h1', 0);
      if (v !== null) el.textContent = v;
    });
  }
  if (ptable || $('[data-from]')) {
    if (ptable) renderPrices(0);
    D.loadAll().then((list) => {
      allClubs = list;
      if (ptable) renderPrices(+($('.pricing .seg [aria-selected="true"]') || { dataset: { days: 0 } }).dataset.days);
      if (list.length) fillFromPrices();
    });
  }
  if (ptable) {
    const seg = $('.pricing .seg');
    $$('button', seg).forEach((b) => b.addEventListener('click', () => {
      if (b.getAttribute('aria-selected') === 'true') return;
      selectSeg(seg, b);
      ptable.classList.add('is-flip');
      setTimeout(() => { renderPrices(+b.dataset.days); ptable.classList.add('is-flip'); requestAnimationFrame(() => requestAnimationFrame(() => ptable.classList.remove('is-flip'))); }, reduced ? 0 : 220);
    }));
  }

  /* ======================================================================
     14. HARDWARE (псевдо-3D ПК, тири, scramble-текст)
     ====================================================================== */
  const hwSection = $('#hardware');
  const HW = [
    { club: 'palac', type: 'pro', src: 'Конфігурація PRO — клуб «Палац Спорту».', glow: .18,
      specs: { cpu: 'AMD Ryzen 5 7500F', gpu: 'RTX 5060', ram: '16GB DDR5', monitor: 'Lenovo Legion 24" 240Hz', periph: 'Bloody S87, Bloody R72 Pro Duo, HyperX Cloud Alpha', chair: 'Cougar Armor EVO S' } },
    { club: 'centr', type: 'vip', src: 'Конфігурація VIP — клуб «Центр».', glow: .26,
      specs: { cpu: 'AMD Ryzen 7 7700', gpu: 'AMD RX 9060XT 16GB', ram: '32GB DDR5', monitor: 'Asus 24" 300Hz', periph: 'Bloody S87, Bloody R72 Pro Duo, HyperX Alpha', chair: 'Cougar Armor Pro' } },
    { club: 'palac', type: 'supervip', src: 'Конфігурація SuperVIP — клуб «Палац Спорту». В інших клубах залізо відрізняється — дивіться сторінку клубу.', glow: .36,
      specs: { cpu: 'AMD Ryzen 7 7800X3D', gpu: 'AMD RX 9070XT', ram: '32GB DDR5', monitor: 'MSI 24" 600Hz', periph: 'HyperX Alloy Origins TKL, Logitech G PRO X Superlight 2, HyperX Cloud Alpha', chair: 'Cougar Armor EVO' } }
  ];
  let hwTier = -1, setTier = () => {};
  const PCR = { mx: 0, my: 0, drag: 0, dragging: false, lastX: 0 };
  const PCS = { ry: 60, rx: -8, tx: 0, s: 1 };
  const pc = $('#pc');
  if (hwSection) {
    const hwTabs = $('#hwTabs'), hwSource = $('#hwSource');
    const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#/%';
    const scramble = (el, to) => {
      if (reduced) { el.textContent = to; return; }
      const from = el.textContent, len = Math.max(from.length, to.length);
      const start = performance.now(), dur = 520;
      (function f(now) {
        const p = clamp((now - start) / dur);
        let out = '';
        for (let i = 0; i < len; i++) out += i / len < p ? (to[i] || '') : (to[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0]);
        el.textContent = out;
        if (p < 1) requestAnimationFrame(f); else el.textContent = to;
      })(start);
    };
    setTier = (i, force) => {
      if (i === hwTier && !force) return;
      hwTier = i;
      const t = HW[i];
      $$('.spec__v', hwSection).forEach((v) => {
        const val = t.specs[v.dataset.k];
        scramble(v, val && val !== '—' ? val : 'уточнюйте в клубі');
      });
      hwSource.textContent = t.src;
      hwSection.style.setProperty('--glow', t.glow);
      selectSeg(hwTabs, $$('button', hwTabs)[i]);
    };
    // конфігурація змінюється лише кнопками, скрол її не перемикає
    $$('button', hwTabs).forEach((b) => b.addEventListener('click', () => setTier(+b.dataset.tier)));
    setTier(0);

    // актуальне залізо з бази
    HW.forEach((t, i) => D.loadClub(t.club).then((c) => {
      const place = c.places.find((p) => p.kind === 'pc' && p.type === t.type);
      if (!place) return;
      t.specs = place.raw;
      if (hwTier === i) setTier(i, true);
    }).catch(() => { /* лишаємо запасні дані */ }));

    const stage = $('#hwStage');
    stage.addEventListener('pointerdown', (e) => { PCR.dragging = true; PCR.lastX = e.clientX; if (stage.setPointerCapture) stage.setPointerCapture(e.pointerId); });
    stage.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      PCR.mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      PCR.my = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (PCR.dragging) { PCR.drag += (e.clientX - PCR.lastX) * 0.4; PCR.lastX = e.clientX; }
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => stage.addEventListener(ev, () => { PCR.dragging = false; if (ev === 'pointerleave') { PCR.mx = 0; PCR.my = 0; } }));
  }

  /* ======================================================================
     15. ЗАЛИ КЛУБУ — картка зони (спільна для детальної картки й сторінок клубів)
     ====================================================================== */
  function fmtPair(pair, hasToggle) {
    if (!pair) return '—';
    return !hasToggle || pair[0] === pair[1] ? pair[0] + ' ₴' : pair[0] + ' / ' + pair[1] + ' ₴';
  }
  function zoneCard(place, hasToggle) {
    const isPc = place.kind === 'pc';
    const from = place.prices.h1 ? place.prices.h1[0] : null;
    const dl = isPc
      ? place.specs.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')
      : '';
    const rows = D.PACKAGES.filter((p) => place.prices[p.id])
      .map((p) => `<tr><th scope="row">${p.short}</th><td>${fmtPair(place.prices[p.id], isPc && hasToggle)}</td></tr>`).join('');
    return `<article class="dzone${place.top ? ' dzone--top' : ''}">` +
      `<div class="dzone__head"><div>${place.badge ? `<p class="dzone__badge">${esc(place.badge)}</p>` : ''}<h3 class="dzone__name">${esc(place.name)}</h3></div>` +
      (from ? `<span class="dzone__from">від ${from} ₴/год</span>` : '') + `</div>` +
      (dl ? `<dl>${dl}</dl>` : '') +
      (rows ? `<table><caption class="sr-only">Ціни ${esc(place.name)}${isPc && hasToggle ? ', пн–чт / пт–нд' : ''}</caption>${rows}</table>` : '') +
      `</article>`;
  }

  /* ======================================================================
     16. CLUBS (accordion + distortion + fullscreen detail)
     ====================================================================== */
  const clubs = $$('.club');
  const detail = $('#detail');
  let detailFrom = null, lastFocus = null;
  const disp = document.getElementById('fxDisp');
  let distortRAF = 0;
  function distort(club) {
    if (reduced || !disp) return;
    cancelAnimationFrame(distortRAF);
    clubs.forEach((c) => c.classList.remove('is-hovered'));
    club.classList.add('is-hovered');
    const t0 = performance.now();
    (function f(now) {
      const p = clamp((now - t0) / 750);
      disp.setAttribute('scale', (38 * Math.pow(1 - p, 2)).toFixed(2));
      if (p < 1) distortRAF = requestAnimationFrame(f); else club.classList.remove('is-hovered');
    })(t0);
  }
  function activate(club) {
    if (!isDesk() || club.classList.contains('is-active')) return;
    clubs.forEach((c) => c.classList.toggle('is-active', c === club));
    if (finePointer) distort(club);
  }
  if (clubs.length) clubs[0].classList.add('is-active');
  clubs.forEach((club) => {
    club.addEventListener('mouseenter', () => activate(club));
    club.addEventListener('focusin', () => activate(club));
    club.addEventListener('mousemove', (e) => {
      const r = club.getBoundingClientRect();
      club.style.setProperty('--px', (((e.clientX - r.left) / r.width - 0.5) * -24).toFixed(1) + 'px');
    });
    // клік по картці — одразу на сторінку клубу з повною інформацією
    club.addEventListener('click', (e) => {
      if (e.target.closest('[data-book], a')) return;
      goToClub(club.dataset.club);
    });
    club.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === club) { e.preventDefault(); goToClub(club.dataset.club); }
    });
  });

  function goToClub(id) {
    const c = clubById(id);
    if (c) location.href = c.page;
  }

  function setClipFrom(el) {
    const r = el ? el.getBoundingClientRect() : { top: vh / 2, left: vw / 2, right: vw / 2, bottom: vh / 2 };
    detail.style.setProperty('--t', Math.max(0, r.top) + 'px');
    detail.style.setProperty('--l', Math.max(0, r.left) + 'px');
    detail.style.setProperty('--r2', Math.max(0, vw - r.right) + 'px');
    detail.style.setProperty('--b', Math.max(0, vh - r.bottom) + 'px');
  }
  const mapUrl = (c) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(c.address + ', Харків');
  function openDetail(id, fromEl) {
    const c = clubById(id); if (!c || !detail) return;
    lastFocus = document.activeElement;
    detailFrom = fromEl;
    const img = $('#detailImg');
    img.classList.remove('img-failed');
    img.src = c.photo; img.alt = 'Клуб Xbase ' + c.name;
    $('#detailOfficial').innerHTML = `<span>●</span> ${esc(c.metro)}`;
    $('#detailTitle').textContent = c.name;
    $('#detailAddr').textContent = `${c.address} · ${c.note}`;
    $('#detailLinks').innerHTML =
      `<a class="btn btn--light btn--sm" href="tel:${c.tel}"><svg class="ic"><use href="#i-phone"/></svg><span class="btn__label">${c.phone}</span></a>` +
      `<a class="btn btn--light btn--sm" href="https://t.me/${c.telegram}" target="_blank" rel="noopener"><svg class="ic"><use href="#i-send"/></svg><span class="btn__label">@${c.telegram}</span></a>` +
      `<a class="btn btn--light btn--sm" href="${mapUrl(c)}" target="_blank" rel="noopener"><svg class="ic"><use href="#i-pin"/></svg><span class="btn__label">На карті</span></a>`;
    const zones = $('#detailZones');
    zones.innerHTML = '<p class="fineprint">Завантаження залів і цін…</p>';
    D.loadClub(c.id).then((data) => {
      if ($('#detailTitle').textContent !== c.name) return; // встигли відкрити інший клуб
      zones.innerHTML = data.places.map((p) => zoneCard(p, data.hasToggle)).join('') +
        `<p class="fineprint" style="grid-column:1/-1">${data.hasToggle ? 'Ціни ПК — пн–чт / пт–нд. ' : ''}Актуальні ціни та наявність місць уточнюйте в адміністратора.</p>`;
    }).catch(() => {
      zones.innerHTML = `<p class="fineprint">Не вдалося завантажити зали й ціни. Подивіться <a class="link-u" href="${c.page}">сторінку клубу</a> або зателефонуйте ${c.phone}.</p>`;
    });
    $('#detailBook').onclick = () => { closeDetail(true); openBooking({ club: c.id }); };
    $('#detailPage').href = c.page;
    $('.detail__scroll', detail).scrollTop = 0;
    setClipFrom(fromEl);
    detail.setAttribute('aria-hidden', 'false');
    detail.getBoundingClientRect(); // reflow → стартова форма clip-path
    detail.classList.add('is-open');
    lockScroll(true);
    setTimeout(() => $('.detail__close', detail).focus({ preventScroll: true }), 50);
  }
  function closeDetail(keepLock) {
    if (!detail || !detail.classList.contains('is-open')) return;
    setClipFrom(detailFrom && detailFrom.getBoundingClientRect().height ? detailFrom : null);
    detail.classList.remove('is-open');
    detail.setAttribute('aria-hidden', 'true');
    if (!keepLock) { lockScroll(false); if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); }
  }
  $$('[data-close-detail]').forEach((b) => b.addEventListener('click', () => closeDetail()));
  $$('[data-open-club]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); goToClub(b.dataset.openClub); }));

  /* ======================================================================
     17. BOOKING
     ====================================================================== */
  const modal = $('#booking');
  const B = { club: null, place: null, wantType: null, pkg: 'h1', data: null, failed: false };
  let openBooking = () => {}, closeBooking = () => {};

  if (modal) {
    const form = $('#bookForm'), result = $('#bResult');
    const optClubs = $('#optClubs'), optZones = $('#optZones'), optPkg = $('#optPkg');
    const fDate = $('#fDate'), fTime = $('#fTime'), fName = $('#fName'), fPhone = $('#fPhone'), summary = $('#bSummary');

    const pad = (n) => String(n).padStart(2, '0');
    const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
    const isWeekend = (d) => [5, 6, 0].includes(d.getDay()); // пт, сб, нд
    const fmtDate = (d) => new Intl.DateTimeFormat('uk-UA', { weekday: 'short', day: 'numeric', month: 'long' }).format(d);
    // Запасні варіанти, якщо зали клубу не завантажились
    const FALLBACK_PLACES = [
      { key: 'fb-pc', kind: 'pc', type: 'other', name: 'Комп\'ютер (ПК)', prices: {} },
      { key: 'fb-ps', kind: 'console', type: 'ps5', name: 'PlayStation', prices: {} }
    ];
    const places = () => (B.data ? B.data.places : B.failed ? FALLBACK_PLACES : []);
    const placeByKey = (k) => places().find((p) => p.key === k);

    const radio = (name, value, label, sub, checked, disabled) =>
      `<label class="opt"><input type="radio" name="${name}" value="${esc(value)}"${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}><span>${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</span></label>`;

    const renderClubs = () => { optClubs.innerHTML = D.CLUBS.map((c) => radio('club', c.id, c.name, c.address, c.id === B.club)).join(''); };
    function renderZones() {
      if (!B.club) { optZones.innerHTML = '<p class="fineprint">Спочатку оберіть клуб</p>'; return; }
      if (!B.data && !B.failed) { optZones.innerHTML = '<p class="fineprint">Завантаження залів…</p>'; return; }
      const list = places();
      if (B.place && !placeByKey(B.place)) B.place = null;
      if (!B.place && B.wantType) {
        // близька заміна: PS5 VIP → PS5, SuperVIP → VIP тощо
        const fb = { ps5vip: 'ps5', supervip: 'vip', gaming: 'pro', ps4pro: 'ps5', vip: 'supervip' };
        const hit = list.find((p) => p.type === B.wantType) || list.find((p) => p.type === fb[B.wantType]);
        if (hit) B.place = hit.key;
      }
      optZones.innerHTML = (B.failed ? '<p class="fineprint" style="flex-basis:100%">Не вдалося завантажити зали — оберіть тип місця, адміністратор уточнить деталі.</p>' : '') +
        list.map((p) => radio('zone', p.key, p.name, p.prices.h1 ? 'від ' + p.prices.h1[0] + ' ₴/год' : '', p.key === B.place)).join('');
    }
    function renderPkgs() {
      const p = placeByKey(B.place);
      const has = (id) => !p || !Object.keys(p.prices).length || !!p.prices[id];
      if (!has(B.pkg)) { const first = D.PACKAGES.find((x) => has(x.id)); B.pkg = first ? first.id : 'h1'; }
      optPkg.innerHTML = D.PACKAGES.map((x) => radio('pkg', x.id, x.short, '', x.id === B.pkg, !has(x.id))).join('');
      syncPkg();
    }
    function renderTimes() {
      const keep = fTime.value;
      let html = '<option value="" disabled>Час</option>';
      for (let h = 0; h < 24; h++) for (const m of [0, 30]) { const t = `${pad(h)}:${pad(m)}`; html += `<option value="${t}">${t}</option>`; }
      fTime.innerHTML = html;
      if (keep) fTime.value = keep;
    }
    function nextSlot() {
      const d = new Date(); d.setSeconds(0, 0);
      d.setMinutes(d.getMinutes() + 30);
      d.setMinutes(d.getMinutes() < 30 ? 30 : 60); // найближчі :00 / :30 не раніше ніж за 30 хв
      return d;
    }
    function syncPkg() {
      const p = D.PACKAGES.find((x) => x.id === B.pkg);
      if (p && p.fixedStart) { fTime.value = p.fixedStart; fTime.disabled = true; } else fTime.disabled = false;
    }
    function price() {
      const p = placeByKey(B.place);
      if (!p || !fDate.value || !p.prices[B.pkg]) return null;
      return p.prices[B.pkg][isWeekend(parseDate(fDate.value)) ? 1 : 0];
    }
    function updateSummary() {
      const c = clubById(B.club), pl = placeByKey(B.place);
      if (!c || !pl) { summary.innerHTML = ''; return; }
      const p = D.PACKAGES.find((x) => x.id === B.pkg);
      const pr = price();
      const d = fDate.value ? fmtDate(parseDate(fDate.value)) : '—';
      summary.innerHTML =
        `<div class="row"><span>Клуб</span><span>${esc(c.name)}</span></div>` +
        `<div class="row"><span>Місце</span><span>${esc(pl.name)}</span></div>` +
        `<div class="row"><span>Коли</span><span>${esc(d)}${fTime.value ? ', ' + fTime.value : ''}</span></div>` +
        `<div class="row"><span>Пакет</span><span>${esc(p ? p.label : '—')}</span></div>` +
        (pr ? `<div class="row"><span>Орієнтовно</span><span class="total">${pr} ₴</span></div>` : '');
    }
    function selectClub(id) {
      B.club = id; B.data = null; B.failed = false;
      renderZones(); renderPkgs(); updateSummary();
      D.loadClub(id).then((data) => { if (B.club !== id) return; B.data = data; })
        .catch(() => { if (B.club === id) B.failed = true; })
        .finally(() => { if (B.club !== id) return; renderZones(); renderPkgs(); updateSummary(); });
    }

    // маска телефону: +380 (XX) XXX-XX-XX
    function formatPhone(v) {
      const pre = /\+\s*3\s*8\s*0/;
      const hadPrefix = pre.test(v);
      const d = (hadPrefix ? v.replace(pre, '') : v).replace(/\D/g, '');
      if (!d && !hadPrefix) return '';
      let local = hadPrefix ? d : d.startsWith('380') ? d.slice(3) : d.startsWith('80') ? d.slice(2) : d;
      if (local.startsWith('0')) local = local.slice(1);
      local = local.slice(0, 9);
      let out = '+380';
      if (local.length) out += ' (' + local.slice(0, 2);
      if (local.length >= 2) out += ')';
      if (local.length > 2) out += ' ' + local.slice(2, 5);
      if (local.length > 5) out += '-' + local.slice(5, 7);
      if (local.length > 7) out += '-' + local.slice(7, 9);
      return out;
    }
    fPhone.addEventListener('input', (e) => {
      clearErr(fPhone);
      if (e.inputType && e.inputType.indexOf('delete') === 0) return; // даємо спокійно стирати
      fPhone.value = formatPhone(fPhone.value);
    });
    fPhone.addEventListener('focus', () => {
      if (fPhone.value) return;
      fPhone.value = '+380 (';
      requestAnimationFrame(() => { try { const n = fPhone.value.length; fPhone.setSelectionRange(n, n); } catch (e) { /* noop */ } });
    });
    fPhone.addEventListener('blur', () => {
      fPhone.value = fPhone.value.replace(/\D/g, '').length <= 3 ? '' : formatPhone(fPhone.value);
    });
    fName.addEventListener('input', () => clearErr(fName));

    form.addEventListener('change', (e) => {
      const t = e.target;
      if (t.name === 'club') { selectClub(t.value); clearErr(optClubs); return; }
      if (t.name === 'zone') { B.place = t.value; B.wantType = null; clearErr(optZones); renderPkgs(); }
      if (t.name === 'pkg') { B.pkg = t.value; syncPkg(); }
      if (t === fDate || t === fTime) clearErr(t);
      updateSummary();
    });

    function setErr(el, msg) {
      el.setAttribute('aria-invalid', 'true');
      const host = el.closest('.field');
      let m = $('.err', host);
      if (!m) { m = document.createElement('p'); m.className = 'err'; m.id = 'err-' + Math.random().toString(36).slice(2, 8); host.appendChild(m); }
      m.textContent = msg;
      if (el.matches('input, select')) el.setAttribute('aria-describedby', m.id);
    }
    function clearErr(el) {
      el.removeAttribute('aria-invalid');
      const host = el.closest('.field'); const m = host && $('.err', host);
      if (m) m.remove();
    }
    function validate() {
      let first = null;
      if (fPhone.value) fPhone.value = formatPhone(fPhone.value);
      const fail = (el, msg) => { setErr(el, msg); if (!first) first = el; };
      if (!B.club) fail(optClubs, 'Оберіть клуб');
      if (!placeByKey(B.place)) fail(optZones, B.club && !B.data && !B.failed ? 'Зачекайте, зали ще завантажуються' : 'Оберіть тип місця');
      const today = isoDate(new Date());
      if (!fDate.value) fail(fDate, 'Оберіть дату');
      else if (fDate.value < today) fail(fDate, 'Ця дата вже минула');
      if (!fTime.value) fail(fTime, 'Оберіть час');
      else if (fDate.value === today && !fTime.disabled) {
        const [h, m] = fTime.value.split(':').map(Number); const now = new Date();
        if (h * 60 + m < now.getHours() * 60 + now.getMinutes()) fail(fTime, 'Цей час уже минув');
      }
      if (fName.value.trim().length < 2) fail(fName, 'Введіть ім\'я (мінімум 2 символи)');
      if (fPhone.value.replace(/\D/g, '').length !== 12) fail(fPhone, 'Введіть номер у форматі +380 (XX) XXX-XX-XX');
      if (first) { const f = first.matches('input, select') ? first : $('input', first); if (f) f.focus(); }
      return !first;
    }

    const requestText = (pl) => `Вітаю! Хочу забронювати місце в Xbase.\nКлуб: ${pl.clubName}\nМісце: ${pl.placeName}\nДата: ${pl.dateLabel}, ${pl.time}\nПакет: ${pl.packageLabel}\nІм'я: ${pl.name}\nТелефон: ${pl.phone}`;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validate()) return;
      const c = clubById(B.club), p = D.PACKAGES.find((x) => x.id === B.pkg), pl = placeByKey(B.place);
      const info = {
        clubName: c.name, placeName: pl.name, packageLabel: p.label, time: fTime.value,
        dateLabel: fmtDate(parseDate(fDate.value)), name: fName.value.trim(), phone: '+' + fPhone.value.replace(/\D/g, '')
      };
      const est = price();
      const btn = $('#bSubmit');
      btn.disabled = true; $('.btn__label', btn).textContent = 'Надсилаємо…';
      // Формат, який приймає xbase-server: POST /api/bookings
      const ok = await D.submitBooking({
        name: info.name, phone: info.phone, club: c.id, date: fDate.value, time: fTime.value,
        section: `${pl.name} · ${p.label}${est ? ` · ≈${est} ₴` : ''}`
      });
      btn.disabled = false; $('.btn__label', btn).textContent = 'Забронювати';
      showResult(ok, info, c);
    });

    function showResult(ok, info, c) {
      const text = requestText(info);
      const contacts =
        `<div class="bresult__actions">` +
        `<a class="btn btn--${ok ? 'ghost' : 'accent'} btn--lg btn--block" href="tel:${c.tel}"><svg class="ic"><use href="#i-phone"/></svg><span class="btn__label">Зателефонувати ${c.phone}</span></a>` +
        `<a class="btn btn--ghost btn--lg btn--block" href="https://t.me/${c.telegram}" target="_blank" rel="noopener"><svg class="ic"><use href="#i-send"/></svg><span class="btn__label">Написати в Telegram</span></a>` +
        (ok ? '' : `<button class="btn btn--ghost btn--lg btn--block" type="button" data-copy><svg class="ic"><use href="#i-copy"/></svg><span class="btn__label">Скопіювати заявку</span></button>`) +
        `</div>`;
      let html;
      if (ok) {
        html = `<div class="bresult__icon"><svg class="ic"><use href="#i-check"/></svg></div>
          <h3>Заявку надіслано</h3>
          <p>Дякуємо! Адміністратор клубу «${esc(c.name)}» зателефонує на номер ${esc(info.phone)}, щоб підтвердити бронювання.</p>
          <pre>${esc(text)}</pre>${contacts}`;
      } else {
        html = `<div class="bresult__icon bresult__icon--warn"><svg class="ic"><use href="#i-alert"/></svg></div>
          <h3>Не вдалося надіслати заявку</h3>
          <p>Схоже, проблема зі зв'язком. Місце <b>не заброньовано</b> — зателефонуйте або напишіть у клуб, текст заявки вже готовий.</p>
          <pre>${esc(text)}</pre>${contacts}`;
      }
      html += `<button class="btn btn--light btn--sm" type="button" data-back>${ok ? 'Нова заявка' : '← Змінити заявку'}</button>`;
      result.innerHTML = html;
      form.hidden = true; result.hidden = false; result.focus();
      const copy = $('[data-copy]', result);
      if (copy) copy.addEventListener('click', async () => {
        const l = $('.btn__label', copy);
        try { await navigator.clipboard.writeText(text); l.textContent = 'Скопійовано'; }
        catch (err) { l.textContent = 'Виділіть текст вище'; }
        setTimeout(() => { l.textContent = 'Скопіювати заявку'; }, 2200);
      });
      $('[data-back]', result).addEventListener('click', () => {
        if (ok) { fName.value = ''; fPhone.value = ''; }
        result.hidden = true; form.hidden = false; fName.focus();
      });
    }

    openBooking = (opts = {}) => {
      lastFocus = document.activeElement;
      if (menuOpen) setMenu(false);
      B.wantType = opts.zone || null;
      if (opts.zone) B.place = null;
      let club = opts.club || B.club || document.body.dataset.club || null;
      if (!opts.club && opts.zone && !B.club && !document.body.dataset.club) {
        // для типу місця без клубу — перший клуб, де він є
        const withType = (allClubs || []).find((x) => x.places.some((p) => p.type === opts.zone));
        club = withType ? withType.id : null;
      }
      form.hidden = false; result.hidden = true;
      if (club && (club !== B.club || B.failed)) selectClub(club);
      else { renderZones(); renderPkgs(); }
      renderClubs();
      const today = isoDate(new Date());
      fDate.min = today;
      const max = new Date(); max.setDate(max.getDate() + 60); fDate.max = isoDate(max);
      renderTimes();
      if (!fDate.value || fDate.value < today || !fTime.value) {
        const slot = nextSlot();
        fDate.value = isoDate(slot);
        fTime.value = `${pad(slot.getHours())}:${pad(slot.getMinutes())}`;
      }
      syncPkg();
      updateSummary();
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      lockScroll(true);
      setTimeout(() => { const first = $('input:checked', optClubs) || $('input', optClubs); if (first) first.focus({ preventScroll: true }); }, 100);
    };
    closeBooking = () => {
      if (!modal.classList.contains('is-open')) return;
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      lockScroll(false);
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    };
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-book]');
      if (!b) return;
      e.preventDefault(); e.stopPropagation();
      openBooking({ club: b.dataset.book || null, zone: b.dataset.bookZone || null });
    });
    $$('[data-close-modal]').forEach((b) => b.addEventListener('click', closeBooking));
    // посилання виду page.html#book відкривають бронювання одразу
    if (location.hash === '#book') setTimeout(() => openBooking({}), 400);
  }

  // Esc + focus trap
  document.addEventListener('keydown', (e) => {
    const open = modal && modal.classList.contains('is-open') ? modal : detail && detail.classList.contains('is-open') ? detail : menuOpen ? mmenu : null;
    if (!open) return;
    if (e.key === 'Escape') { if (open === modal) closeBooking(); else if (open === detail) closeDetail(); else { setMenu(false); burger.focus(); } return; }
    if (e.key !== 'Tab') return;
    const scope = open === mmenu ? [burger, ...$$('a, button', mmenu)] : $$('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]', open).filter((el) => el.offsetParent !== null);
    if (!scope.length) return;
    const first = scope[0], last = scope[scope.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ======================================================================
     18. MEASURE + LAYOUT для pinned-секцій
     ====================================================================== */
  const S = {};
  const storySec = $('#xbase'), storyTrack = $('#storyTrack'), storyBar = $('#storyBar');
  const psSec = $('.ps__h'), psTrack = $('#psTrack'), psHead = $('.ps__head');
  const heroSec = $('.hero'), heroContent = $('.hero__content'), heroWm = $('.hero__watermark'), heroTitle = $('.hero__title');
  const bcSec = $('#bootcamp'), bcPin = $('.bootcamp__pin'), bcStage = $('.bootcamp__stage');
  const psRows = $$('.ps__row');
  const storyPanels = storyTrack ? Array.from(storyTrack.children).map((el) => ({ el, speed: $$('[data-speed]', el).map((n) => ({ n, sp: parseFloat(n.dataset.speed) })), art: $('.story__art', el) })) : [];
  const depthEls = $$('[data-depth]');
  const tvImgs = $$('.tv__screen img');

  function trackWidth(track) {
    const kids = track.children; if (!kids.length) return 0;
    const last = kids[kids.length - 1];
    const pr = parseFloat(getComputedStyle(track).paddingRight) || 0;
    return last.offsetLeft + last.offsetWidth + pr;
  }
  const box = (el) => { const r = el.getBoundingClientRect(); return { top: r.top + window.scrollY, h: el.offsetHeight }; };
  function measure() {
    vw = window.innerWidth; vh = window.innerHeight;
    if (storySec && storyTrack) {
      if (isDesk()) storySec.style.setProperty('--story-h', (trackWidth(storyTrack) - vw + vh) + 'px');
      else { storyTrack.style.transform = ''; storyPanels.forEach((panel) => panel.speed.forEach(({ n }) => { n.style.transform = ''; })); }
      S.story = box(storySec); S.storyW = trackWidth(storyTrack);
    }
    if (psSec && psTrack) {
      if (isDesk()) psSec.style.setProperty('--ps-h', (trackWidth(psTrack) - vw + vh) + 'px');
      else psTrack.style.transform = '';
      S.ps = box(psSec); S.psW = trackWidth(psTrack);
    }
    if (psHead) S.psHead = box(psHead);
    if (heroSec && heroContent) S.hero = box(heroSec);
    if (hwSection) S.hw = box(hwSection);
    if (bcSec) S.bc = box(bcSec);
    S.nav = navTargets.map((t) => (t ? box(t) : null));
    marquees.forEach((m) => { m.w = m.row.scrollWidth / 2; });
    $$('.seg').forEach(placeThumb);
    if (GL) GL.resize();
  }

  /* ======================================================================
     19. MAIN LOOP
     ====================================================================== */
  let lastY = window.scrollY, vel = 0, lastNavY = 0;
  const M = { x: 0, y: 0 };
  let heroVisible = true;
  if (heroSec && 'IntersectionObserver' in window) {
    new IntersectionObserver((en) => { heroVisible = en[0].isIntersecting; }, { threshold: 0 }).observe(heroSec);
  }

  let lastT = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, Math.max(0.001, (now - lastT) / 1000)); lastT = now;
    const k = (base) => 1 - Math.pow(1 - base, dt * 60); // lerp, що не залежить від FPS
    if (SS.running && !SS.locked) {
      // зовнішній скрол (scrollIntoView, фокус, пошук) — віддаємо керування браузеру
      if (SS.lastSet != null && Math.abs(window.scrollY - SS.lastSet) > 3) { SS.running = false; SS.cur = SS.target = window.scrollY; }
    }
    if (SS.running && !SS.locked) {
      SS.cur = lerp(SS.cur, SS.target, reduced ? 1 : k(0.095));
      if (Math.abs(SS.target - SS.cur) < 0.4) { SS.cur = SS.target; SS.running = false; }
      window.scrollTo(0, SS.cur);
      SS.lastSet = window.scrollY;
    } else SS.lastSet = null;
    const y = window.scrollY;
    vel = lerp(vel, y - lastY, 0.2); lastY = y;
    const desk = isDesk();

    M.x = lerp(M.x, P.nx, k(0.06)); M.y = lerp(M.y, P.ny, k(0.06));
    tickCursor();

    // nav
    if (nav && !menuOpen) {
      nav.classList.toggle('is-scrolled', y > 30);
      if (y > vh * 0.8 && y - lastNavY > 6) nav.classList.add('is-hidden');
      else if (lastNavY - y > 6 || y < vh * 0.8) nav.classList.remove('is-hidden');
      if (Math.abs(y - lastNavY) > 6) lastNavY = y;
    }
    if (S.nav) {
      let active = -1;
      S.nav.forEach((b, i) => { if (b && y + vh * 0.4 >= b.top && y + vh * 0.4 < b.top + b.h) active = i; });
      navLinks.forEach((a, i) => a.classList.toggle('is-active', i === active));
    }

    // hero
    if (S.hero) {
      const hp = clamp(y / S.hero.h);
      if (hp < 1 && !reduced) {
        heroContent.style.transform = `translate3d(0, ${hp * -90}px, 0) scale(${1 - hp * 0.06})`;
        heroContent.style.opacity = String(1 - hp * 1.25);
        if (heroWm) heroWm.style.transform = `translate(-50%, -50%) translate3d(${M.x * -30}px, ${hp * 160 + M.y * 20}px, 0)`;
        if (finePointer) depthEls.forEach((el) => {
          if (el === heroWm) return;
          const d = parseFloat(el.dataset.depth);
          el.style.transform = `translate3d(${M.x * d * 14}px, ${M.y * d * -10}px, 0)`;
        });
        if (heroTitle) heroTitle.style.setProperty('--ca', clamp(Math.abs(vel) * 0.5 + Math.abs(P.nx - M.x) * 16, 0, 8).toFixed(2));
      }
      heroSec.style.setProperty('--beam', clamp((hp - 0.15) / 0.55).toFixed(3));
      heroSec.style.setProperty('--beam-o', clamp((hp - 0.1) / 0.2) * (1 - clamp((hp - 0.8) / 0.2)));
      if (GL && heroVisible && document.visibilityState === 'visible') GL.render(reduced ? 8000 : now, M.x, M.y, hp);
    }

    // story (горизонтально)
    if (desk && S.story && y + vh > S.story.top && y < S.story.top + S.story.h) {
      const span = S.story.h - vh;
      const p = clamp((y - S.story.top) / span);
      const dist = S.storyW - vw;
      storyTrack.style.transform = `translate3d(${-p * dist}px, 0, 0)`;
      storyBar.style.transform = `scaleX(${p})`;
      storyPanels.forEach((panel, i) => {
        const px = i * vw - p * dist;
        const near = 1 - clamp(Math.abs(px) / vw);
        panel.speed.forEach(({ n, sp }) => { n.style.transform = `translate3d(${px * (sp - 1) * 0.6}px, 0, 0)`; });
        if (panel.art) panel.art.style.setProperty('--draw', near.toFixed(3));
      });
      const wp = clamp((y - (S.story.top - vh * 0.5)) / (vh * 0.9));
      const n = Math.round(wp * statementWords.length);
      statementWords.forEach((w, i) => w.classList.toggle('on', i < n));
    } else if (!desk && statementWords.length) {
      const r = statement.getBoundingClientRect();
      const wp = clamp((vh * 0.85 - r.top) / (vh * 0.6));
      const n = Math.round(wp * statementWords.length);
      statementWords.forEach((w, i) => w.classList.toggle('on', i < n));
    }

    // marquee
    if (!reduced) marquees.forEach((m) => {
      m.x -= 0.6 + Math.min(Math.abs(vel) * 0.35, 18);
      if (m.w && m.x <= -m.w) m.x += m.w;
      m.row.style.transform = `translate3d(${m.x}px, 0, 0) skewX(${clamp(-vel * 0.25, -10, 10)}deg)`;
    });

    // hardware
    if (S.hw && pc) {
      const enter = clamp((y - (S.hw.top - vh)) / vh);
      const span = S.hw.h - vh;
      const p = desk ? clamp((y - S.hw.top) / span) : 0;
      hwSection.classList.toggle('is-in', enter > 0.55);
      const tRy = 72 - p * 26 + PCR.mx * 14 + PCR.drag;
      const tRx = -8 - PCR.my * 8 + (1 - enter) * 10;
      PCS.ry = lerp(PCS.ry, reduced ? 62 : tRy, 0.08);
      PCS.rx = lerp(PCS.rx, reduced ? -8 : tRx, 0.08);
      PCS.tx = desk && !reduced ? (1 - enter) * vw * 0.3 : 0;
      PCS.s = desk ? 0.85 + enter * 0.15 + p * 0.08 : 1;
      if (y + vh > S.hw.top && y < S.hw.top + S.hw.h) {
        pc.style.transform = `translate3d(${PCS.tx}px, 0, 0) scale(${PCS.s.toFixed(3)}) rotateX(${PCS.rx.toFixed(2)}deg) rotateY(${PCS.ry.toFixed(2)}deg)`;
        hwSection.style.setProperty('--bgx', (-p * 18 + (1 - enter) * 10) + 'vw');
      }
      if (!PCR.dragging) PCR.drag = lerp(PCR.drag, 0, 0.02);
    }

    // bootcamp
    if (S.bc && !reduced) {
      const p = clamp((y - (S.bc.top - vh * 0.6)) / (vh * 1.3));
      const q = clamp((y - S.bc.top - vh * 0.5) / (vh * 0.7));
      if (y + vh > S.bc.top && y < S.bc.top + S.bc.h) {
        bcPin.style.setProperty('--clip', (10 + p * 90).toFixed(2) + '%');
        bcStage.style.setProperty('--bs', (0.55 + p * 0.45 - q * 0.08).toFixed(3));
        bcStage.style.setProperty('--bo', (1 - q * 0.8).toFixed(3));
      }
    }

    // playstation
    if (S.psHead) {
      const p = clamp((y - (S.psHead.top - vh)) / (S.psHead.h + vh));
      psRows.forEach((r) => {
        const dir = +r.dataset.dir;
        r.style.transform = `translate3d(${dir > 0 ? -p * 35 : (p * 35 - 30)}vw, 0, 0)`;
      });
    }
    if (desk && S.ps) {
      const span = S.ps.h - vh;
      const p = clamp((y - S.ps.top) / span);
      const dist = S.psW - vw;
      psTrack.style.transform = `translate3d(${-p * dist}px, 0, 0)`;
      if (y + vh > S.ps.top && y < S.ps.top + S.ps.h) tvImgs.forEach((img, i) => img.style.setProperty('--px', ((p * 4 - i * 0.8) * -12).toFixed(1) + 'px'));
    }

    requestAnimationFrame(frame);
  }

  /* ======================================================================
     20. BOOT
     ====================================================================== */
  let resizeT;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(measure, 120); });
  window.addEventListener('load', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  if ('ResizeObserver' in window) new ResizeObserver(() => { clearTimeout(resizeT); resizeT = setTimeout(measure, 150); }).observe(document.body);

  measure();
  requestAnimationFrame(frame);
  runLoader(() => { heroIntro(); initReveals(); measure(); });

  // публічний API для сторінок клубів і меню (app.js)
  window.XbaseUI = { openBooking, closeBooking, openDetail: (id) => openDetail(id, null), zoneCard, selectSeg, placeThumb, observeReveals, measure, esc, guardImg };
})();
