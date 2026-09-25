(function () {
  "use strict";

  const tg = window.Telegram && window.Telegram.WebApp;
  const initData = tg ? tg.initData : "";

  if (tg) {
    tg.ready();
    tg.expand();
    try { tg.setHeaderColor("#060708"); tg.setBackgroundColor("#060708"); } catch { /* older client, ignore */ }
  }

  const authGate = document.getElementById("authGate");
  const app = document.getElementById("app");

  if (!initData) {
    authGate.hidden = false;
    app.hidden = true;
    return;
  }
  authGate.hidden = true;
  app.hidden = false;

  // ---------- helpers ----------
  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function toast(message, isError) {
    let el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.className = "toast show" + (isError ? " error" : "");
    if (tg && tg.HapticFeedback) {
      try { tg.HapticFeedback.notificationOccurred(isError ? "error" : "success"); } catch { /* ignore */ }
    }
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 2600);
  }

  async function confirmAction(message) {
    if (tg && tg.showConfirm) {
      return new Promise((resolve) => tg.showConfirm(message, (ok) => resolve(!!ok)));
    }
    return window.confirm(message);
  }

  async function api(path, options) {
    const opts = Object.assign({}, options);
    opts.headers = Object.assign({ "x-telegram-init-data": initData }, opts.headers);
    if (opts.body && typeof opts.body !== "string") {
      opts.body = JSON.stringify(opts.body);
      opts.headers["Content-Type"] = "application/json";
    }
    const res = await fetch(path, opts);
    if (res.status === 204) return null;
    let data = null;
    try { data = await res.json(); } catch { /* empty body */ }
    if (!res.ok) {
      throw new Error((data && data.error) || `HTTP ${res.status}`);
    }
    return data;
  }

  const loading = '<div class="empty">Завантаження…</div>';
  const failed = (err) => `<div class="empty error">Помилка: ${escapeHtml(err.message)}</div>`;

  // Кнопка «Зберегти» блокується, поки йде запит
  async function withBusy(form, fn) {
    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    try { await fn(); } finally { if (btn) btn.disabled = false; }
  }

  // ---------- tabs ----------
  const tabs = document.querySelectorAll(".tab");
  const panels = document.querySelectorAll(".panel");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.toggle("active", t === tab));
      const name = tab.dataset.tab;
      panels.forEach((p) => p.classList.toggle("active", p.id === "panel-" + name));
      if (tg && tg.HapticFeedback) { try { tg.HapticFeedback.selectionChanged(); } catch { /* ignore */ } }
      loadTab(name);
    });
  });

  const refreshBtn = document.getElementById("refreshBtn");
  refreshBtn.addEventListener("click", async () => {
    const active = document.querySelector(".tab.active");
    if (!active) return;
    refreshBtn.classList.add("is-spinning");
    try { await loadTab(active.dataset.tab); } finally { refreshBtn.classList.remove("is-spinning"); }
  });

  let clubs = []; // [{slug, name}]
  let clubsLoaded = false;

  function loadTab(name) {
    if (name === "bookings") return loadBookings();
    if (name === "menu") return loadMenu();
    if (name === "prices") return loadPrices();
  }

  // ---------- bookings ----------
  // created_at з SQLite — UTC «YYYY-MM-DD HH:MM:SS»; показуємо за Києвом
  function fmtCreated(s) {
    const d = new Date(String(s || "").replace(" ", "T") + "Z");
    if (isNaN(d)) return s || "";
    return d.toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }
  function fmtDate(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
    if (!m) return s || "";
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.toLocaleDateString("uk-UA", { weekday: "short", day: "numeric", month: "long" });
  }

  async function loadBookings() {
    const list = document.getElementById("bookingsList");
    list.innerHTML = loading;
    try {
      if (!clubsLoaded) await loadClubs();
      const rows = await api("/api/bookings");
      if (!rows.length) {
        list.innerHTML = '<div class="empty">Заявок ще немає.</div>';
        return;
      }
      const clubName = (slug) => (clubs.find((c) => c.slug === slug) || {}).name || slug || "не вказано";
      list.innerHTML = rows.map((r) => `
        <article class="card">
          <div class="bk__top"><span class="bk__club">${escapeHtml(clubName(r.club_slug))}</span><span class="id">#${r.id}</span></div>
          <p class="bk__when">${escapeHtml(fmtDate(r.booking_date))}<small>${escapeHtml(r.booking_time || "")}</small></p>
          <p class="bk__section">${escapeHtml(r.section || "розділ не вказано")}</p>
          <div class="bk__foot">
            <div class="bk__who"><b>${escapeHtml(r.name || "без імені")}</b><a href="tel:${escapeHtml(r.phone)}">${escapeHtml(r.phone)}</a></div>
            <span class="bk__created">створено ${escapeHtml(fmtCreated(r.created_at))}</span>
          </div>
        </article>
      `).join("");
    } catch (err) {
      list.innerHTML = failed(err);
    }
  }

  async function loadClubs() {
    clubs = await api("/api/clubs");
    clubsLoaded = true;
    const select = document.getElementById("clubSelect");
    select.innerHTML = clubs.map((c) => `<option value="${escapeHtml(c.slug)}">${escapeHtml(c.name)}</option>`).join("");
    const chips = document.getElementById("clubChips");
    chips.innerHTML = clubs.map((c) => `<button type="button" class="chip" role="tab" data-slug="${escapeHtml(c.slug)}">${escapeHtml(c.name)}</button>`).join("");
    chips.querySelectorAll(".chip").forEach((chip) => chip.addEventListener("click", () => {
      select.value = chip.dataset.slug;
      loadPrices();
    }));
  }

  // ---------- menu ----------
  async function loadMenu() {
    const list = document.getElementById("menuList");
    list.innerHTML = loading;
    try {
      const items = await api("/api/menu");
      if (!items.length) {
        list.innerHTML = '<div class="empty">Меню порожнє.</div>';
        return;
      }
      const byCat = new Map();
      for (const it of items) {
        if (!byCat.has(it.category)) byCat.set(it.category, []);
        byCat.get(it.category).push(it);
      }
      let html = "";
      for (const [cat, catItems] of byCat) {
        html += `<div class="cat-title">${escapeHtml(cat)}<small>${catItems.length}</small></div>`;
        html += catItems.map(menuItemCard).join("");
      }
      list.innerHTML = html;
      list.querySelectorAll("[data-edit-menu]").forEach((btn) =>
        btn.addEventListener("click", () => openMenuEdit(btn.dataset.editMenu, items)));
      list.querySelectorAll("[data-del-menu]").forEach((btn) =>
        btn.addEventListener("click", () => deleteMenuItem(btn.dataset.delMenu)));
    } catch (err) {
      list.innerHTML = failed(err);
    }
  }

  function menuItemCard(it) {
    return `
      <article class="card" data-menu-card="${it.id}">
        <div class="row"><h4>${escapeHtml(it.name)}</h4><span class="price">${escapeHtml(it.price)}</span></div>
        ${it.note ? `<p class="meta">${escapeHtml(it.note)}</p>` : ""}
        <div class="actions">
          <button class="btn btn--ghost btn--sm" data-edit-menu="${it.id}">Редагувати</button>
          <button class="btn btn--danger btn--sm" data-del-menu="${it.id}">Видалити</button>
        </div>
      </article>
    `;
  }

  function openMenuEdit(id, items) {
    const it = items.find((x) => String(x.id) === String(id));
    if (!it) return;
    const card = document.querySelector(`[data-menu-card="${id}"]`);
    card.classList.add("card--editing");
    card.innerHTML = `
      <form class="form">
        <label class="fld"><span>Категорія</span><input name="category" value="${escapeHtml(it.category)}" required></label>
        <label class="fld"><span>Назва</span><input name="name" value="${escapeHtml(it.name)}" required></label>
        <label class="fld"><span>Ціна, ₴</span><input name="priceUah" type="number" min="0" step="1" inputmode="numeric" value="${it.priceUah}" required></label>
        <label class="fld"><span>Примітка</span><input name="note" value="${escapeHtml(it.note || "")}"></label>
        <div class="actions">
          <button type="submit" class="btn btn--accent btn--sm">Зберегти</button>
          <button type="button" class="btn btn--ghost btn--sm" data-cancel>Скасувати</button>
        </div>
      </form>
    `;
    card.querySelector("[data-cancel]").addEventListener("click", () => loadMenu());
    card.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      withBusy(e.target, async () => {
        try {
          await api(`/api/menu/${id}`, {
            method: "PUT",
            body: {
              category: f.get("category"), name: f.get("name"),
              priceUah: Number(f.get("priceUah")), note: f.get("note") || "",
              photo: it.photo || null, sortOrder: it.sortOrder || 0
            }
          });
          toast("Збережено");
          loadMenu();
        } catch (err) {
          toast(err.message, true);
        }
      });
    });
  }

  async function deleteMenuItem(id) {
    if (!(await confirmAction("Видалити цю позицію меню?"))) return;
    try {
      await api(`/api/menu/${id}`, { method: "DELETE" });
      toast("Видалено");
      loadMenu();
    } catch (err) {
      toast(err.message, true);
    }
  }

  document.getElementById("menuAddForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    withBusy(e.target, async () => {
      try {
        await api("/api/menu", {
          method: "POST",
          body: {
            category: f.get("category"), name: f.get("name"),
            priceUah: Number(f.get("priceUah")), note: f.get("note") || ""
          }
        });
        e.target.reset();
        e.target.closest("details").open = false;
        toast("Додано");
        loadMenu();
      } catch (err) {
        toast(err.message, true);
      }
    });
  });

  // ---------- prices ----------
  document.getElementById("clubSelect").addEventListener("change", loadPrices);

  async function loadPrices() {
    if (!clubsLoaded) await loadClubs();
    const select = document.getElementById("clubSelect");
    const slug = select.value || (clubs[0] && clubs[0].slug);
    if (!slug) return;
    select.value = slug;
    document.querySelectorAll("#clubChips .chip").forEach((c) => {
      c.classList.toggle("active", c.dataset.slug === slug);
      c.setAttribute("aria-selected", String(c.dataset.slug === slug));
    });

    const zonesList = document.getElementById("zonesList");
    const psList = document.getElementById("psList");
    zonesList.innerHTML = loading;
    psList.innerHTML = "";
    try {
      const data = await api(`/api/clubs/${slug}/prices`);
      renderZones(slug, data.zones || []);
      renderPs(slug, data.ps || []);
    } catch (err) {
      zonesList.innerHTML = failed(err);
    }
  }

  const LABELS = ["1 год", "3 год", "5 год", "День", "Ніч"];
  const KEYS = ["1", "3", "5", "Day", "Night"];

  // Сітка з 5 підписаних полів ціни: prefix "wd" (пн–чт) або "we" (пт–нд)
  function priceGridHtml(prefix, values, required) {
    const title = prefix === "wd" ? "Ціни пн–чт, ₴" : "Ціни пт–нд, ₴";
    return `<p class="price-grid__title">${title}</p>` + KEYS.map((k, i) => `
      <label class="fld"><span>${LABELS[i]}</span><input name="${prefix}${k}" type="number" min="0" inputmode="numeric" value="${values && values[i] != null ? values[i] : ""}"${required ? " required" : ""}></label>
    `).join("");
  }

  function renderZones(slug, zones) {
    const list = document.getElementById("zonesList");
    if (!zones.length) {
      list.innerHTML = '<div class="empty">Немає тарифних зон.</div>';
      return;
    }
    list.innerHTML = zones.map((z) => {
      const specs = [["CPU", z.cpu], ["GPU", z.gpu], ["RAM", z.ram], ["Монітор", z.monitor], ["Периферія", z.periph], ["Крісло", z.chair]].filter((s) => s[1]);
      return `
      <article class="card${z.isTop ? " card--top" : ""}" data-zone-card="${z.id}">
        ${z.badge ? `<span class="badge">${escapeHtml(z.badge)}</span>` : ""}
        <div class="row"><h4>${escapeHtml(z.zone)}</h4><span class="id">#${z.id}</span></div>
        ${specs.length ? `<dl class="specs">${specs.map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(v)}</dd>`).join("")}</dl>` : ""}
        <table class="ptbl">
          <tr><th></th>${LABELS.map((l) => `<th>${l}</th>`).join("")}</tr>
          <tr><td>${z.hasToggle ? "Пн–Чт" : "Усі дні"}</td>${z.wd.map((v) => `<td>${v}</td>`).join("")}</tr>
          ${z.hasToggle ? `<tr><td>Пт–Нд</td>${z.we.map((v) => `<td>${v}</td>`).join("")}</tr>` : ""}
        </table>
        <div class="actions">
          <button class="btn btn--ghost btn--sm" data-edit-zone="${z.id}">Редагувати</button>
          <button class="btn btn--danger btn--sm" data-del-zone="${z.id}">Видалити</button>
        </div>
      </article>`;
    }).join("");
    list.querySelectorAll("[data-edit-zone]").forEach((btn) =>
      btn.addEventListener("click", () => openZoneEdit(slug, btn.dataset.editZone, zones)));
    list.querySelectorAll("[data-del-zone]").forEach((btn) =>
      btn.addEventListener("click", () => deleteZone(slug, btn.dataset.delZone)));
  }

  function openZoneEdit(slug, id, zones) {
    const z = zones.find((x) => String(x.id) === String(id));
    if (!z) return;
    const hasToggle = z.hasToggle;
    const card = document.querySelector(`[data-zone-card="${id}"]`);
    card.className = "card card--editing";
    card.innerHTML = `
      <form class="form">
        <label class="fld"><span>Назва зони</span><input name="zone" value="${escapeHtml(z.zone)}" required></label>
        <label class="fld"><span>Бейдж</span><input name="badge" value="${escapeHtml(z.badge || "")}" placeholder="Необов'язково"></label>
        <label class="switch"><input type="checkbox" name="isTop" ${z.isTop ? "checked" : ""}><i></i> Топова зона</label>
        <div class="grid2">
          <label class="fld"><span>CPU</span><input name="cpu" value="${escapeHtml(z.cpu || "")}"></label>
          <label class="fld"><span>GPU</span><input name="gpu" value="${escapeHtml(z.gpu || "")}"></label>
          <label class="fld"><span>RAM</span><input name="ram" value="${escapeHtml(z.ram || "")}"></label>
          <label class="fld"><span>Монітор</span><input name="monitor" value="${escapeHtml(z.monitor || "")}"></label>
        </div>
        <label class="fld"><span>Периферія</span><input name="periph" value="${escapeHtml(z.periph || "")}"></label>
        <label class="fld"><span>Крісло</span><input name="chair" value="${escapeHtml(z.chair || "")}"></label>
        <div class="price-grid">${priceGridHtml("wd", z.wd, true)}</div>
        <label class="switch"><input type="checkbox" name="hasToggle" class="toggle-we" ${hasToggle ? "checked" : ""}><i></i> Окремі ціни на вихідні (пт–нд)</label>
        <div class="price-grid we-fields" ${hasToggle ? "" : "hidden"}>${priceGridHtml("we", z.we, false)}</div>
        <div class="actions">
          <button type="submit" class="btn btn--accent btn--sm">Зберегти</button>
          <button type="button" class="btn btn--ghost btn--sm" data-cancel>Скасувати</button>
        </div>
      </form>
    `;
    wireToggleWe(card);
    card.querySelector("[data-cancel]").addEventListener("click", () => loadPrices());
    card.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      const body = zoneFormToBody(new FormData(e.target));
      withBusy(e.target, async () => {
        try {
          await api(`/api/clubs/${slug}/prices/zones/${id}`, { method: "PUT", body });
          toast("Збережено");
          loadPrices();
        } catch (err) {
          toast(err.message, true);
        }
      });
    });
  }

  async function deleteZone(slug, id) {
    if (!(await confirmAction("Видалити цю тарифну зону?"))) return;
    try {
      await api(`/api/clubs/${slug}/prices/zones/${id}`, { method: "DELETE" });
      toast("Видалено");
      loadPrices();
    } catch (err) {
      toast(err.message, true);
    }
  }

  function zoneFormToBody(f) {
    const body = {
      zone: f.get("zone"), badge: f.get("badge") || null, isTop: f.get("isTop") === "on",
      cpu: f.get("cpu") || "", gpu: f.get("gpu") || "", ram: f.get("ram") || "",
      monitor: f.get("monitor") || "", periph: f.get("periph") || "", chair: f.get("chair") || "",
      wd: KEYS.map((k) => Number(f.get("wd" + k)))
    };
    if (f.get("hasToggle") === "on") {
      body.we = KEYS.map((k) => Number(f.get("we" + k)));
    }
    return body;
  }

  function wireToggleWe(scope) {
    const toggle = scope.querySelector(".toggle-we");
    const fields = scope.querySelector(".we-fields");
    if (!toggle || !fields) return;
    toggle.addEventListener("change", () => { fields.hidden = !toggle.checked; });
  }

  const zoneAddForm = document.getElementById("zoneAddForm");
  function resetZoneAddGrids() {
    zoneAddForm.querySelector('[data-grid="wd"]').innerHTML = priceGridHtml("wd", null, true);
    zoneAddForm.querySelector('[data-grid="we"]').innerHTML = priceGridHtml("we", null, false);
    zoneAddForm.querySelector(".we-fields").hidden = true;
  }
  resetZoneAddGrids();
  wireToggleWe(zoneAddForm);

  zoneAddForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const slug = document.getElementById("clubSelect").value;
    const body = zoneFormToBody(new FormData(e.target));
    withBusy(e.target, async () => {
      try {
        await api(`/api/clubs/${slug}/prices/zones`, { method: "POST", body });
        e.target.reset();
        resetZoneAddGrids();
        e.target.closest("details").open = false;
        toast("Зону додано");
        loadPrices();
      } catch (err) {
        toast(err.message, true);
      }
    });
  });

  function renderPs(slug, cards) {
    const list = document.getElementById("psList");
    if (!cards.length) {
      list.innerHTML = '<div class="empty">Немає карток PlayStation.</div>';
      return;
    }
    list.innerHTML = cards.map((p) => `
      <article class="card${p.isVip ? " card--vip" : ""}" data-ps-card="${p.id}">
        ${p.badge || p.isVip ? `<span class="badge">${escapeHtml(p.badge || "VIP")}</span>` : ""}
        <div class="row"><h4>${escapeHtml(p.title)}</h4><span class="id">#${p.id}</span></div>
        <table class="ptbl">${p.rows.map(([label, price]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(price)}</td></tr>`).join("")}</table>
        <div class="actions">
          <button class="btn btn--ghost btn--sm" data-edit-ps="${p.id}">Редагувати</button>
          <button class="btn btn--danger btn--sm" data-del-ps="${p.id}">Видалити</button>
        </div>
      </article>
    `).join("");
    list.querySelectorAll("[data-edit-ps]").forEach((btn) =>
      btn.addEventListener("click", () => openPsEdit(slug, btn.dataset.editPs, cards)));
    list.querySelectorAll("[data-del-ps]").forEach((btn) =>
      btn.addEventListener("click", () => deletePs(slug, btn.dataset.delPs)));
  }

  function psRowsEditor(container, rows) {
    container.innerHTML = "";
    const addRow = (label, price) => {
      const row = document.createElement("div");
      row.className = "ps-row";
      row.innerHTML = `
        <input class="ps-label" placeholder="Напр. 1 година" aria-label="Пакет" value="${escapeHtml(label || "")}">
        <input class="ps-price" placeholder="200 грн" aria-label="Ціна" value="${escapeHtml(price || "")}">
        <button type="button" class="btn btn--danger btn--icon" data-remove-row aria-label="Видалити рядок">✕</button>
      `;
      row.querySelector("[data-remove-row]").addEventListener("click", () => row.remove());
      container.appendChild(row);
    };
    (rows.length ? rows : [["", ""]]).forEach(([l, p]) => addRow(l, p));
    return {
      addEmptyRow: () => addRow("", ""),
      getRows: () => Array.from(container.querySelectorAll(".ps-row"))
        .map((row) => [row.querySelector(".ps-label").value.trim(), row.querySelector(".ps-price").value.trim()])
        .filter(([l, p]) => l || p)
    };
  }

  function openPsEdit(slug, id, cards) {
    const p = cards.find((x) => String(x.id) === String(id));
    if (!p) return;
    const card = document.querySelector(`[data-ps-card="${id}"]`);
    card.className = "card card--editing";
    card.innerHTML = `
      <form class="form">
        <label class="fld"><span>Назва</span><input name="title" value="${escapeHtml(p.title)}" required></label>
        <label class="fld"><span>Бейдж</span><input name="badge" value="${escapeHtml(p.badge || "")}" placeholder="Необов'язково"></label>
        <label class="switch"><input type="checkbox" name="isVip" ${p.isVip ? "checked" : ""}><i></i> VIP</label>
        <p class="fld-label">Рядки цін</p>
        <div class="ps-rows" data-rows></div>
        <button type="button" class="btn btn--ghost btn--sm" data-add-row>+ рядок ціни</button>
        <div class="actions">
          <button type="submit" class="btn btn--accent btn--sm">Зберегти</button>
          <button type="button" class="btn btn--ghost btn--sm" data-cancel>Скасувати</button>
        </div>
      </form>
    `;
    const editor = psRowsEditor(card.querySelector("[data-rows]"), p.rows);
    card.querySelector("[data-add-row]").addEventListener("click", () => editor.addEmptyRow());
    card.querySelector("[data-cancel]").addEventListener("click", () => loadPrices());
    card.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      withBusy(e.target, async () => {
        try {
          await api(`/api/clubs/${slug}/prices/ps/${id}`, {
            method: "PUT",
            body: { title: f.get("title"), isVip: f.get("isVip") === "on", badge: f.get("badge") || null, rows: editor.getRows() }
          });
          toast("Збережено");
          loadPrices();
        } catch (err) {
          toast(err.message, true);
        }
      });
    });
  }

  async function deletePs(slug, id) {
    if (!(await confirmAction("Видалити цю картку PlayStation?"))) return;
    try {
      await api(`/api/clubs/${slug}/prices/ps/${id}`, { method: "DELETE" });
      toast("Видалено");
      loadPrices();
    } catch (err) {
      toast(err.message, true);
    }
  }

  let psAddEditor = psRowsEditor(document.getElementById("psAddRows"), []);
  document.getElementById("psAddRowBtn").addEventListener("click", () => psAddEditor.addEmptyRow());

  document.getElementById("psAddForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const slug = document.getElementById("clubSelect").value;
    const f = new FormData(e.target);
    withBusy(e.target, async () => {
      try {
        await api(`/api/clubs/${slug}/prices/ps`, {
          method: "POST",
          body: { title: f.get("title"), isVip: f.get("isVip") === "on", badge: f.get("badge") || null, rows: psAddEditor.getRows() }
        });
        e.target.reset();
        psAddEditor = psRowsEditor(document.getElementById("psAddRows"), []);
        e.target.closest("details").open = false;
        toast("Картку додано");
        loadPrices();
      } catch (err) {
        toast(err.message, true);
      }
    });
  });

  // ---------- init ----------
  loadBookings();
})();
