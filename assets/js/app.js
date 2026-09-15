// XBase — shared site behaviour (booking form, games filter, club prices/comp specs, cafe menu).
// Menu items and club prices are loaded from the xbase-server API (see /server and assets/js/config.js).
// Only the games catalogue stays static here since it isn't managed through the backend.
(function () {
  "use strict";

  function apiBase() {
    return (window.XBASE_API_BASE || "").replace(/\/$/, "");
  }

  var GAMES = [
    ["Steam", "Apex Legends"], ["Steam", "Battlefield 6"], ["Steam", "Bloodstrike"], ["Steam", "Call of Duty"],
    ["Steam", "Cossacks 3"], ["Steam", "Counter-Strike 2"], ["Steam", "Counter-Strike 1.6"], ["Steam", "DayZ"],
    ["Steam", "Deep Rock Galactic"], ["Steam", "Dead by Daylight"], ["Steam", "Deus Ex: Human Revolution"],
    ["Steam", "Dota 2"], ["Steam", "Euro Truck Simulator 2"], ["Steam", "Far Cry 3"], ["Steam", "GTA 5 Legacy"],
    ["Steam", "Hunt: Showdown 1896"], ["Steam", "Left 4 Dead 2"], ["Steam", "Marvel Rivals"],
    ["Steam", "Mount & Blade II: Bannerlord"], ["Steam", "Payday 2"], ["Steam", "PUBG"], ["Steam", "R.E.P.O."],
    ["Steam", "Rust"], ["Steam", "Sea of Thieves"], ["Steam", "The Sims 4"], ["Steam", "Stellar Blade"],
    ["Steam", "Tomb Raider"], ["Steam", "War Thunder"], ["Steam", "World of Tanks Blitz"],
    ["Epic Games", "Fortnite"], ["Epic Games", "Rocket League"], ["Epic Games", "Wuthering Waves"], ["Epic Games", "GTA V"],
    ["Riot", "Valorant"], ["Riot", "League of Legends"],
    ["Battle.net", "Warzone 2"], ["Battle.net", "Overwatch"], ["Battle.net", "Hearthstone"],
    ["Інше", "Genshin Impact"], ["Інше", "RageMP"], ["Інше", "World of Tanks"], ["Інше", "World of Warships"]
  ].map(function (g) { return { platform: g[0], name: g[1] }; });

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "class") e.className = attrs[k];
      else if (k === "text") e.textContent = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }

  function showError(root, message) {
    var box = el("p", { class: "list-footnote", text: message });
    root.appendChild(box);
  }

  /* ---- Mobile nav toggle (hamburger) ---- */
  function initMobileNav() {
    document.querySelectorAll(".header").forEach(function (header) {
      var bar = header.querySelector(".header__bar");
      if (!bar) return;
      var nav = bar.querySelector(".nav");
      var actions = bar.querySelector(".header__actions");
      var hasExtra = actions && actions.querySelector(".tel-link, .social-link, .pill-outline");
      if (!nav && !hasExtra) return;

      var toggle = el("button", { type: "button", class: "nav-toggle", "aria-label": "Меню", "aria-expanded": "false" }, [
        el("span", {}), el("span", {}), el("span", {})
      ]);
      var anchor = bar.querySelector(".logo") || bar.firstElementChild;
      anchor.insertAdjacentElement("afterend", toggle);

      function close() {
        header.classList.remove("nav-open");
        toggle.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }

      toggle.addEventListener("click", function () {
        var open = header.classList.toggle("nav-open");
        toggle.classList.toggle("is-open", open);
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });

      bar.querySelectorAll("a").forEach(function (a) {
        a.addEventListener("click", close);
      });
    });
  }
  initMobileNav();

  /* ---- Booking form ---- */
  function resetSectionSelect(select, message) {
    select.innerHTML = "";
    select.appendChild(el("option", { value: "", disabled: "disabled", selected: "selected", text: message }));
    select.disabled = true;
  }

  function loadSections(select, slug) {
    resetSectionSelect(select, "Завантаження…");
    fetch(apiBase() + "/api/clubs/" + encodeURIComponent(slug) + "/prices")
      .then(function (r) { if (!r.ok) throw new Error("request failed"); return r.json(); })
      .then(function (data) {
        select.innerHTML = "";
        select.appendChild(el("option", { value: "", disabled: "disabled", selected: "selected", text: "Оберіть розділ" }));
        data.zones.forEach(function (z) {
          select.appendChild(el("option", { value: z.zone, text: "ПК · " + z.zone }));
        });
        data.ps.forEach(function (p) {
          select.appendChild(el("option", { value: p.title, text: "PlayStation · " + p.title }));
        });
        select.disabled = false;
      })
      .catch(function () {
        resetSectionSelect(select, "Не вдалося завантажити розділи");
      });
  }

  function initBooking(formSel, thanksSel) {
    var form = document.querySelector(formSel);
    if (!form) return;
    var thanks = document.querySelector(thanksSel);
    var button = form.querySelector("button[type=submit]");
    var clubSelect = form.querySelector("select[name=club]");
    var sectionSelect = form.querySelector("select[name=section]");
    var dateInput = form.querySelector("input[name=date]");

    if (dateInput) dateInput.min = new Date().toISOString().slice(0, 10);

    if (clubSelect && sectionSelect) {
      clubSelect.addEventListener("change", function () {
        if (clubSelect.value) loadSections(sectionSelect, clubSelect.value);
        else resetSectionSelect(sectionSelect, "Спочатку оберіть клуб");
      });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      button.disabled = true;
      var data = new FormData(form);
      fetch(apiBase() + "/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          phone: data.get("phone"),
          club: data.get("club"),
          date: data.get("date"),
          time: data.get("time"),
          section: data.get("section")
        })
      })
        .then(function (r) { if (!r.ok) throw new Error("request failed"); return r.json(); })
        .then(function () {
          if (thanks) { thanks.textContent = "Дякуємо! Ми передзвонимо Вам найближчим часом."; thanks.classList.add("show"); }
          form.reset();
          if (sectionSelect) resetSectionSelect(sectionSelect, "Спочатку оберіть клуб");
        })
        .catch(function () {
          if (thanks) { thanks.textContent = "Не вдалося відправити заявку. Зателефонуйте нам, будь ласка."; thanks.classList.add("show"); }
        })
        .finally(function () { button.disabled = false; });
    });
  }

  /* ---- Games block (static catalogue, filter/search client-side) ---- */
  function initGames(rootSel) {
    var root = document.querySelector(rootSel);
    if (!root) return;
    var search = root.querySelector(".search-input");
    var filters = root.querySelector(".filters");
    var grid = root.querySelector(".games-grid");
    var footnote = root.querySelector(".list-footnote");
    var names = ["Всі", "Steam", "Epic Games", "Riot", "Battle.net", "Інше"];
    var state = { platform: "Всі", query: "" };

    function byPlatform(p) { return p === "Всі" ? GAMES : GAMES.filter(function (g) { return g.platform === p; }); }

    function render() {
      var q = state.query.trim().toLowerCase();
      var visible = byPlatform(state.platform).filter(function (g) {
        return !q || g.name.toLowerCase().indexOf(q) !== -1;
      });

      filters.innerHTML = "";
      names.forEach(function (n) {
        var btn = el("button", { type: "button", class: "filter-btn" + (n === state.platform ? " active" : "") }, [
          document.createTextNode(n),
          el("span", { class: "count", text: String(byPlatform(n).length) })
        ]);
        btn.addEventListener("click", function () { state.platform = n; render(); });
        filters.appendChild(btn);
      });

      grid.innerHTML = "";
      visible.forEach(function (g) {
        grid.appendChild(el("div", { class: "game-chip" }, [
          el("span", { class: "game-chip__dot" }),
          el("span", { class: "game-chip__name", text: g.name })
        ]));
      });

      footnote.textContent = visible.length
        ? "Знайдено ігор: " + visible.length
        : "Нічого не знайдено. Подзвоніть, і ми встановимо гру до Вашого приходу.";
    }

    if (search) search.addEventListener("input", function (e) { state.query = e.target.value; render(); });
    render();
  }

  /* ---- Club computers + prices (comp-grid, price table, PlayStation cards) — loaded from API ---- */
  function compCardEl(z) {
    return el("div", { class: "comp-card" + (z.isTop ? " comp-card--top" : "") }, [
      z.badge ? el("span", { class: "comp-card__badge", text: z.badge }) : null,
      el("h3", { text: z.zone }),
      el("div", { class: "comp-rows" }, [
        el("div", { class: "comp-row" }, [el("span", { text: "CPU" }), el("span", { text: z.cpu })]),
        el("div", { class: "comp-row" }, [el("span", { text: "GPU" }), el("span", { text: z.gpu })]),
        el("div", { class: "comp-row" }, [el("span", { text: "RAM" }), el("span", { text: z.ram })]),
        el("div", { class: "comp-row" }, [el("span", { text: "Монітор" }), el("span", { text: z.monitor })]),
        el("div", { class: "comp-row" }, [el("span", { text: "Периферія" }), el("span", { text: z.periph })]),
        el("div", { class: "comp-row" }, [el("span", { text: "Крісло" }), el("span", { text: z.chair })])
      ])
    ]);
  }

  function psCardEl(p) {
    return el("div", { class: "ps-card" + (p.isVip ? " ps-card--vip" : "") }, [
      p.badge ? el("span", { class: "ps-card__badge", text: p.badge }) : null,
      el("h4", { text: p.title }),
      el("div", { class: "ps-rows" }, p.rows.map(function (r) {
        return el("div", { class: "ps-row" }, [el("span", { text: r[0] }), el("span", { text: r[1] })]);
      }))
    ]);
  }

  function initClub(clubSlug) {
    var compGrid = document.querySelector(".comp-grid");
    var priceToggle = document.querySelector("#price .price-toggle");
    var priceFixedNote = document.querySelector("#price .price-note-fixed");
    var tbody = document.querySelector("#price tbody");
    var psGrid = document.querySelector("#price .ps-grid");
    if (!compGrid && !tbody) return;

    fetch(apiBase() + "/api/clubs/" + encodeURIComponent(clubSlug) + "/prices")
      .then(function (r) { if (!r.ok) throw new Error("request failed"); return r.json(); })
      .then(function (data) {
        if (compGrid) {
          compGrid.innerHTML = "";
          data.zones.forEach(function (z) { compGrid.appendChild(compCardEl(z)); });
        }

        var state = { weekend: false };
        function renderTable() {
          if (priceToggle) priceToggle.hidden = !data.hasToggle;
          if (priceFixedNote) priceFixedNote.hidden = data.hasToggle;
          var wd = priceToggle && priceToggle.querySelector('[data-day="wd"]');
          var we = priceToggle && priceToggle.querySelector('[data-day="we"]');
          if (wd) wd.classList.toggle("active", !state.weekend);
          if (we) we.classList.toggle("active", state.weekend);
          tbody.innerHTML = "";
          data.zones.forEach(function (z) {
            var vals = state.weekend ? z.we : z.wd;
            tbody.appendChild(el("tr", { class: "row" }, [
              el("td", { text: z.zone }),
              el("td", { text: vals[0] + " грн", "data-label": "1 год" }),
              el("td", { text: vals[1] + " грн", "data-label": "3 год" }),
              el("td", { text: vals[2] + " грн", "data-label": "5 год" }),
              el("td", { text: vals[3] + " грн", "data-label": "День (9 год)" }),
              el("td", { text: vals[4] + " грн", "data-label": "Ніч 22:00–07:00" })
            ]));
          });
        }
        if (priceToggle) {
          priceToggle.querySelectorAll("button").forEach(function (btn) {
            btn.addEventListener("click", function () {
              state.weekend = btn.getAttribute("data-day") === "we";
              renderTable();
            });
          });
        }
        renderTable();

        if (psGrid) {
          psGrid.innerHTML = "";
          data.ps.forEach(function (p) { psGrid.appendChild(psCardEl(p)); });
        }
      })
      .catch(function () {
        if (compGrid) showError(compGrid, "Не вдалося завантажити дані про комп'ютери. Спробуйте оновити сторінку.");
        if (psGrid) showError(psGrid, "Не вдалося завантажити тарифи PlayStation.");
      });
  }

  /* ---- Cafe menu (centr) — loaded from API ---- */
  function initMenu(rootSel) {
    var root = document.querySelector(rootSel);
    if (!root) return;
    var search = root.querySelector(".search-input");
    var cats = root.querySelector(".menu-cats");
    var grid = root.querySelector(".menu-grid");
    var footnote = root.querySelector(".list-footnote");

    fetch(apiBase() + "/api/menu")
      .then(function (r) { if (!r.ok) throw new Error("request failed"); return r.json(); })
      .then(function (menu) {
        var names = ["Все меню"].concat(menu.reduce(function (acc, i) {
          if (acc.indexOf(i.category) === -1) acc.push(i.category);
          return acc;
        }, []));
        var state = { cat: "Все меню", query: "" };

        function byCat(c) { return c === "Все меню" ? menu : menu.filter(function (i) { return i.category === c; }); }

        function render() {
          var q = state.query.trim().toLowerCase();
          var items = byCat(state.cat).filter(function (i) {
            return !q || (i.name + " " + i.note + " " + i.category).toLowerCase().indexOf(q) !== -1;
          });

          cats.innerHTML = "";
          names.forEach(function (n) {
            var btn = el("button", { type: "button", class: "filter-btn" + (n === state.cat ? " active" : "") }, [
              document.createTextNode(n),
              el("span", { class: "count", text: String(byCat(n).length) })
            ]);
            btn.addEventListener("click", function () { state.cat = n; render(); });
            cats.appendChild(btn);
          });

          grid.innerHTML = "";
          items.forEach(function (i) {
            var photoEl = i.photo
              ? el("img", { src: "assets/menu-img/" + i.photo + ".png", alt: i.name })
              : el("span", { class: "ph", text: "фото" });
            grid.appendChild(el("div", { class: "menu-item" }, [
              el("div", { class: "menu-item__photo" }, [photoEl]),
              el("div", { class: "menu-item__body" }, [
                el("div", { class: "menu-item__cat", text: i.category }),
                el("div", { class: "menu-item__row" }, [
                  el("span", { class: "menu-item__name", text: i.name }),
                  el("span", { class: "menu-item__price", text: i.price })
                ]),
                i.note ? el("div", { class: "menu-item__note", text: i.note }) : null
              ])
            ]));
          });

          footnote.textContent = items.length
            ? "Знайдено позицій: " + items.length
            : "Нічого не знайдено. Запитайте в адміністратора.";
        }

        if (search) search.addEventListener("input", function (e) { state.query = e.target.value; render(); });
        render();
      })
      .catch(function () {
        showError(grid, "Не вдалося завантажити меню. Спробуйте оновити сторінку.");
      });
  }

  window.XBase = { initBooking: initBooking, initGames: initGames, initClub: initClub, initMenu: initMenu };
})();
