/* ==========================================================================
   XBASE — app.js
   Сторінки клубів і меню кафе: зали, тарифи, PlayStation, ігри, меню.
   Дані — з xbase-server через data.js; UI-хелпери — з main.js (XbaseUI).
   ========================================================================== */
(function () {
  'use strict';

  const D = window.XBASE;
  const UI = window.XbaseUI;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const esc = UI.esc;

  // Каталог ігор не керується з адмінки, тому лишається тут.
  const GAMES = [
    ['Steam', 'Apex Legends'], ['Steam', 'Battlefield 6'], ['Steam', 'Bloodstrike'], ['Steam', 'Call of Duty'],
    ['Steam', 'Cossacks 3'], ['Steam', 'Counter-Strike 2'], ['Steam', 'Counter-Strike 1.6'], ['Steam', 'DayZ'],
    ['Steam', 'Deep Rock Galactic'], ['Steam', 'Dead by Daylight'], ['Steam', 'Deus Ex: Human Revolution'],
    ['Steam', 'Dota 2'], ['Steam', 'Euro Truck Simulator 2'], ['Steam', 'Far Cry 3'], ['Steam', 'GTA 5 Legacy'],
    ['Steam', 'Hunt: Showdown 1896'], ['Steam', 'Left 4 Dead 2'], ['Steam', 'Marvel Rivals'],
    ['Steam', 'Mount & Blade II: Bannerlord'], ['Steam', 'Payday 2'], ['Steam', 'PUBG'], ['Steam', 'R.E.P.O.'],
    ['Steam', 'Rust'], ['Steam', 'Sea of Thieves'], ['Steam', 'The Sims 4'], ['Steam', 'Stellar Blade'],
    ['Steam', 'Tomb Raider'], ['Steam', 'War Thunder'], ['Steam', 'World of Tanks Blitz'],
    ['Epic Games', 'Fortnite'], ['Epic Games', 'Rocket League'], ['Epic Games', 'Wuthering Waves'], ['Epic Games', 'GTA V'],
    ['Riot', 'Valorant'], ['Riot', 'League of Legends'],
    ['Battle.net', 'Warzone 2'], ['Battle.net', 'Overwatch'], ['Battle.net', 'Hearthstone'],
    ['Інше', 'Genshin Impact'], ['Інше', 'RageMP'], ['Інше', 'World of Tanks'], ['Інше', 'World of Warships']
  ].map((g) => ({ platform: g[0], name: g[1] }));

  // Фільтр-чіпи (платформи ігор, категорії меню)
  function renderFilters(root, names, counts, active, onPick) {
    root.innerHTML = names.map((n) =>
      `<button type="button" class="fchip${n === active ? ' is-on' : ''}" aria-pressed="${n === active}" data-v="${esc(n)}">${esc(n)}<small>${counts(n)}</small></button>`).join('');
    $$('button', root).forEach((b) => b.addEventListener('click', () => onPick(b.dataset.v)));
  }

  /* ---------- Ігри ---------- */
  function initGames(rootSel) {
    const root = $(rootSel);
    if (!root) return;
    const search = $('.search', root), filters = $('.filters', root), grid = $('.games', root), note = $('.list-note', root);
    const names = ['Всі', 'Steam', 'Epic Games', 'Riot', 'Battle.net', 'Інше'];
    const state = { platform: 'Всі', query: '' };
    const byPlatform = (p) => (p === 'Всі' ? GAMES : GAMES.filter((g) => g.platform === p));

    function render() {
      const q = state.query.trim().toLowerCase();
      const visible = byPlatform(state.platform).filter((g) => !q || g.name.toLowerCase().includes(q));
      renderFilters(filters, names, (n) => byPlatform(n).length, state.platform, (v) => { state.platform = v; render(); });
      grid.innerHTML = visible.map((g) => `<li class="game"><span class="game__dot"></span><span class="game__name">${esc(g.name)}</span><span class="game__pf">${esc(g.platform)}</span></li>`).join('');
      note.textContent = visible.length
        ? 'Знайдено ігор: ' + visible.length
        : 'Нічого не знайдено. Зателефонуйте — встановимо гру до вашого приходу.';
    }
    search.addEventListener('input', (e) => { state.query = e.target.value; render(); });
    render();
  }

  /* ---------- Сторінка клубу: зали, тарифи, PlayStation ---------- */
  function initClub(slug) {
    const comp = $('#compGrid'), ptable = $('#clubPtable'), psGrid = $('#psGrid');
    const seg = $('#priceSeg'), fixedNote = $('#priceFixed');
    if (comp) comp.innerHTML = '<p class="fineprint">Завантаження…</p>';

    D.loadClub(slug).then((data) => {
      const pcs = data.places.filter((p) => p.kind === 'pc');
      const ps = data.places.filter((p) => p.kind === 'console');

      if (comp) comp.innerHTML = pcs.map((p) =>
        `<article class="zcard${p.top ? ' zcard--top' : ''}">` +
        `<div class="zcard__head">${p.badge ? `<p class="zcard__badge">${esc(p.badge)}</p>` : ''}<h3 class="zcard__name">${esc(p.name)}</h3>` +
        (p.prices.h1 ? `<p class="zcard__from"><small>від</small> ${p.prices.h1[0]} <span>₴/год</span></p>` : '') + `</div>` +
        `<dl class="zcard__specs">${p.specs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` +
        `<button class="btn btn--light btn--sm" type="button" data-book="${slug}" data-book-zone="${p.type}"><span class="btn__label">Забронювати</span><svg class="ic btn__arrow"><use href="#i-arrow"/></svg></button>` +
        `</article>`).join('');

      if (ptable) {
        let days = 0;
        const render = () => {
          $('tbody', ptable).innerHTML = pcs.map((p) =>
            `<tr><th scope="row">${esc(p.name)}</th>${D.PACKAGES.map((k) => `<td>${p.prices[k.id] ? `<span class="num">${p.prices[k.id][days]}</span><i>₴</i>` : '—'}</td>`).join('')}</tr>`).join('');
        };
        seg.hidden = !data.hasToggle;
        fixedNote.hidden = data.hasToggle;
        $$('button', seg).forEach((b) => b.addEventListener('click', () => {
          if (b.getAttribute('aria-selected') === 'true') return;
          UI.selectSeg(seg, b);
          ptable.classList.add('is-flip');
          setTimeout(() => { days = +b.dataset.days; render(); requestAnimationFrame(() => requestAnimationFrame(() => ptable.classList.remove('is-flip'))); }, 220);
        }));
        render();
        UI.placeThumb(seg);
      }

      if (psGrid) {
        psGrid.innerHTML = ps.length ? ps.map((p) =>
          `<article class="pscard${p.top ? ' pscard--vip' : ''}">` +
          `<div class="pscard__icon"><svg class="ic"><use href="#i-gamepad"/></svg></div>` +
          `${p.badge ? `<p class="pscard__badge">${esc(p.badge)}</p>` : ''}<h4 class="pscard__name">${esc(p.name)}</h4>` +
          `<table><caption class="sr-only">Ціни ${esc(p.name)}</caption>${p.rows.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v).replace(/\s*грн$/, ' ₴')}</td></tr>`).join('')}</table>` +
          `<button class="btn btn--accent btn--sm" type="button" data-book="${slug}" data-book-zone="${p.type}"><span class="btn__label">Забронювати</span><svg class="ic btn__arrow"><use href="#i-arrow"/></svg></button>` +
          `</article>`).join('') : '<p class="fineprint">У цьому клубі немає зон PlayStation.</p>';
      }
      UI.measure();
    }).catch(() => {
      const c = D.clubById(slug);
      const msg = `<p class="load-err">Не вдалося завантажити дані. Оновіть сторінку або зателефонуйте: <a class="link-u" href="tel:${c.tel}">${c.phone}</a></p>`;
      if (comp) comp.innerHTML = msg;
      if (ptable) $('tbody', ptable).innerHTML = `<tr><td colspan="6" class="ptable__msg">Тарифи тимчасово недоступні.</td></tr>`;
      if (psGrid) psGrid.innerHTML = '';
      if (seg) seg.hidden = true;
    });
  }

  /* ---------- Меню кафе ---------- */
  function initMenu(rootSel) {
    const root = $(rootSel);
    if (!root) return;
    const search = $('.search', root), cats = $('.filters', root), grid = $('.menu-grid', root), note = $('.list-note', root);
    grid.innerHTML = '<p class="fineprint">Завантаження меню…</p>';

    D.loadMenu().then((menu) => {
      const ALL = 'Все меню';
      const names = [ALL].concat(menu.reduce((acc, i) => (acc.includes(i.category) ? acc : acc.concat(i.category)), []));
      const state = { cat: ALL, query: '' };
      const byCat = (c) => (c === ALL ? menu : menu.filter((i) => i.category === c));

      function render() {
        const q = state.query.trim().toLowerCase();
        const items = byCat(state.cat).filter((i) => !q || (i.name + ' ' + i.note + ' ' + i.category).toLowerCase().includes(q));
        renderFilters(cats, names, (n) => byCat(n).length, state.cat, (v) => { state.cat = v; render(); });
        grid.innerHTML = items.map((i) =>
          `<article class="dish">` +
          `<div class="dish__photo">${i.photo ? `<img src="assets/menu-img/${esc(i.photo)}.png" alt="${esc(i.name)}" loading="lazy" decoding="async">` : '<span>XBASE</span>'}</div>` +
          `<div class="dish__body"><p class="dish__cat">${esc(i.category)}</p>` +
          `<div class="dish__row"><h3 class="dish__name">${esc(i.name)}</h3><span class="dish__price">${esc(i.price)}</span></div>` +
          (i.note ? `<p class="dish__note">${esc(i.note)}</p>` : '') + `</div></article>`).join('');
        $$('img', grid).forEach(UI.guardImg);
        note.textContent = items.length ? 'Знайдено позицій: ' + items.length : 'Нічого не знайдено. Запитайте в адміністратора.';
      }
      search.addEventListener('input', (e) => { state.query = e.target.value; render(); });
      render();
    }).catch(() => {
      grid.innerHTML = '<p class="load-err">Не вдалося завантажити меню. Оновіть сторінку, будь ласка.</p>';
      cats.innerHTML = '';
    });
  }

  window.XBase = { initGames, initClub, initMenu };
})();
