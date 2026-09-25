/* =========================================================================
   XBASE — дані клубів
   Тут лише те, чого немає в базі: назви, адреси, телефони, Telegram, фото.
   Зали, залізо та ціни приходять з xbase-server (/api/clubs/:slug/prices),
   тож правки в адмінці одразу видно на сайті. Потрібен assets/js/config.js.
   ========================================================================= */
(function () {
  'use strict';

  const IMG = 'assets/img/';

  // Пакети в тому ж порядку, що й стовпці тарифів у базі (wd/we: 1 год, 3 год, 5 год, день, ніч).
  const PACKAGES = [
    { id: 'h1',    label: '1 година',                 short: '1 год',        hours: 1 },
    { id: 'h3',    label: '3 години',                 short: '3 год',        hours: 3 },
    { id: 'h5',    label: '5 годин',                  short: '5 год',        hours: 5 },
    { id: 'day',   label: 'Пакет «День» · 9 годин',   short: 'День · 9 год', hours: 9 },
    { id: 'night', label: 'Пакет «Ніч» · 22:00–07:00', short: 'Ніч',         hours: 9, fixedStart: '22:00' }
  ];

  // Типи місць — для «від X ₴» на головній і для кнопок «Забронювати Bootcamp / PS5».
  const TYPES = {
    gaming:   'Gaming',
    pro:      'PRO',
    vip:      'VIP · Bootcamp',
    supervip: 'SuperVIP',
    ps5:      'PlayStation 5',
    ps5vip:   'PS5 VIP',
    ps4pro:   'PS4 Pro'
  };

  const CLUBS = [
    {
      id: 'saltovka', name: 'Героїв Праці', metro: 'м. Героїв Праці',
      address: 'вул. Академіка Павлова, 319А/1', note: '2 поверх · 500 м від м. Героїв Праці',
      phone: '(066) 775-91-19', tel: '+380667759119', telegram: 'xbase_cyber_club',
      page: 'saltovka.html', photo: IMG + 'club_saltovka.jpg'
    },
    {
      id: 'pobeda', name: 'Перемога', metro: 'м. Перемога',
      address: 'проспект Перемоги, 59', note: 'Цоколь, біля с/м Basket · 50 м від метро',
      phone: '(066) 775-92-29', tel: '+380667759229', telegram: 'xbase_pobeda',
      page: 'pobeda.html', photo: IMG + 'pobeda-gen.jpg'
    },
    {
      id: 'holodka', name: 'Холодна Гора', metro: 'м. Холодна Гора',
      address: 'провулок Володимира Усенка, 25А', note: 'Одразу за с/м РОСТ',
      phone: '(066) 775-93-39', tel: '+380667759339', telegram: 'xbase_hg',
      page: 'holodka.html', photo: IMG + 'ps5vip_light.jpg'
    },
    {
      id: 'palac', name: 'Палац Спорту', metro: 'м. Палац Спорту',
      address: 'проспект Героїв Харкова, 190/1', note: '50 м від м. Палац Спорту',
      phone: '(066) 775-94-49', tel: '+380667759449', telegram: 'xbase_palac',
      page: 'palac.html', photo: IMG + 'palac.jpg'
    },
    {
      id: 'centr', name: 'Центр', metro: 'Навпроти ТРЦ «Нікольський»',
      address: 'вул. Григорія Сковороди, 5', note: 'Навпроти ТРЦ «Нікольський»',
      phone: '(066) 775-95-59', tel: '+380667759559', telegram: 'xbase_centr',
      page: 'centr.html', photo: IMG + 'club_centr.jpg'
    }
  ];

  const CONTACTS = {
    instagram: 'https://www.instagram.com/xbase.cc',
    telegram: 'https://t.me/xbase_cyber_club',
    email: 'info@xbase.cc'
  };

  /* ---------- API ---------- */
  const apiBase = () => (window.XBASE_API_BASE || '').replace(/\/$/, '');

  function pcType(name) {
    const n = String(name).toLowerCase();
    if (n.includes('supervip')) return 'supervip';
    if (n.includes('vip')) return 'vip';
    if (n.includes('pro')) return 'pro';
    if (n.includes('gaming')) return 'gaming';
    return 'other';
  }
  function psType(title) {
    const n = String(title).toLowerCase();
    if (/ps\s*4|playstation\s*4/.test(n)) return 'ps4pro';
    if (n.includes('vip')) return 'ps5vip';
    return 'ps5';
  }
  // PS-тарифи в базі — рядки [«1 година», «200 грн»]; розкладаємо їх по пакетах.
  function psPackage(label) {
    const l = String(label).toLowerCase().trim();
    if (/^1\s*год/.test(l)) return 'h1';
    if (/^3\s*год/.test(l)) return 'h3';
    if (/^5\s*год/.test(l)) return 'h5';
    if (l.startsWith('день')) return 'day';
    if (l.startsWith('ніч')) return 'night';
    return null;
  }

  /* Нормалізована модель клубу:
     { id, hasToggle, places: [{ key, kind: 'pc'|'console', type, name, badge, top,
       specs: [[label, value], …], prices: { h1: [пн–чт, пт–нд], … } }] } */
  function normalize(slug, data) {
    const places = [];
    data.zones.forEach((z) => {
      const prices = {};
      PACKAGES.forEach((p, i) => { prices[p.id] = [z.wd[i], z.we[i]]; });
      places.push({
        key: 'pc-' + z.id, kind: 'pc', type: pcType(z.zone), name: z.zone, badge: z.badge, top: z.isTop,
        specs: [['Процесор', z.cpu], ['Відеокарта', z.gpu], ['Пам\'ять', z.ram], ['Монітор', z.monitor], ['Периферія', z.periph], ['Крісло', z.chair]].filter((s) => s[1]),
        raw: z, prices
      });
    });
    data.ps.forEach((p) => {
      const prices = {};
      p.rows.forEach(([label, value]) => {
        const k = psPackage(label), n = parseInt(String(value).replace(/\D/g, ''), 10);
        if (k && n) prices[k] = [n, n];
      });
      places.push({
        key: 'ps-' + p.id, kind: 'console', type: psType(p.title), name: p.title, badge: p.badge, top: p.isVip,
        specs: [], rows: p.rows, prices
      });
    });
    return { id: slug, hasToggle: !!data.hasToggle, places };
  }

  const cache = {};
  function loadClub(slug) {
    if (!cache[slug]) {
      cache[slug] = fetch(apiBase() + '/api/clubs/' + encodeURIComponent(slug) + '/prices')
        .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then((d) => normalize(slug, d));
      cache[slug].catch(() => { delete cache[slug]; }); // дозволяємо повторну спробу
    }
    return cache[slug];
  }
  // Усі клуби; клуби, що не завантажились, пропускаються.
  function loadAll() {
    return Promise.all(CLUBS.map((c) => loadClub(c.id).catch(() => null))).then((list) => list.filter(Boolean));
  }
  function loadMenu() {
    return fetch(apiBase() + '/api/menu').then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }
  function submitBooking(payload) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 15000);
    return fetch(apiBase() + '/api/bookings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ctrl.signal
    }).then((r) => r.ok).catch(() => false).finally(() => clearTimeout(to));
  }

  // Найнижча ціна пакета серед місць певного типу. days: 0 = пн–чт, 1 = пт–нд.
  function minPrice(clubs, type, pkg, days) {
    let best = null;
    clubs.forEach((c) => c.places.forEach((p) => {
      if (p.type !== type || !p.prices[pkg]) return;
      const v = p.prices[pkg][days];
      if (v && (best === null || v < best)) best = v;
    }));
    return best;
  }

  window.XBASE = {
    CLUBS, PACKAGES, TYPES, CONTACTS,
    clubById: (id) => CLUBS.find((c) => c.id === id),
    loadClub, loadAll, loadMenu, submitBooking, minPrice
  };
})();
