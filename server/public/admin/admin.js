(function () {
  "use strict";

  const tg = window.Telegram && window.Telegram.WebApp;
  const initData = tg ? tg.initData : "";

  if (tg) {
    tg.ready();
    tg.expand();
    try { tg.setHeaderColor("#07070a"); } catch { /* older client, ignore */ }
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

  // ---------- tabs ----------
  const tabs = document.querySelectorAll(".tab");
  const panels = document.querySelectorAll(".panel");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.toggle("active", t === tab));
      const name = tab.dataset.tab;
      panels.forEach((p) => p.classList.toggle("active", p.id === "panel-" + name));
      loadTab(name);
    });
  });

  document.getElementById("refreshBtn").addEventListener("click", () => {
    const active = document.querySelector(".tab.active");
    if (active) loadTab(active.dataset.tab);
  });

  let clubs = []; // [{slug, name}]
  let clubsLoaded = false;

  function loadTab(name) {
    if (name === "bookings") return loadBookings();
    if (name === "menu") return loadMenu();
    if (name === "prices") return loadPrices();
  }

  // ---------- bookings ----------
  async function loadBookings() {
    const list = document.getElementById("bookingsList");
    list.innerHTML = "<div class=\"empty\">Завантаження…</div>";
    try {
      if (!clubsLoaded) await loadClubs();
      const rows = await api("/api/bookings");
      if (!rows.length) {
        list.innerHTML = "<div class=\"empty\">Заявок ще немає.</div>";
        return;
      }
      const clubName = (slug) => (clubs.find((c) => c.slug === slug) || {}).name || slug || "не вказано";
      list.innerHTML = rows.map((r) => `
        <div class="card">
          <div class="row"><h4>${escapeHtml(r.name || "без імені")}</h4><span class="meta">#${r.id}</span></div>
          <div class="meta">${escapeHtml(r.phone)}</div>
          <div class="meta">${escapeHtml(clubName(r.club_slug))} · ${escapeHtml(r.section || "розділ не вказано")}</div>
          <div class="meta">${escapeHtml(r.booking_date)} ${escapeHtml(r.booking_time)}</div>
          <div class="meta">Створено: ${escapeHtml(r.created_at)}</div>
        </div>
      `).join("");
    } catch (err) {
      list.innerHTML = `<div class="empty">Помилка: ${escapeHtml(err.message)}</div>`;
    }
  }

  async function loadClubs() {
    clubs = await api("/api/clubs");
    clubsLoaded = true;
    const select = document.getElementById("clubSelect");
    select.innerHTML = clubs.map((c) => `<option value="${escapeHtml(c.slug)}">${escapeHtml(c.name)}</option>`).join("");
  }

  // ---------- menu ----------
  async function loadMenu() {
    const list = document.getElementById("menuList");
    list.innerHTML = "<div class=\"empty\">Завантаження…</div>";
    try {
      const items = await api("/api/menu");
      if (!items.length) {
        list.innerHTML = "<div class=\"empty\">Меню порожнє.</div>";
        return;
      }
      const byCat = new Map();
      for (const it of items) {
        if (!byCat.has(it.category)) byCat.set(it.category, []);
        byCat.get(it.category).push(it);
      }
      let html = "";
      for (const [cat, catItems] of byCat) {
        html += `<div class="section-title" style="margin:14px 0 8px">${escapeHtml(cat)}</div>`;
        html += catItems.map(menuItemCard).join("");
      }
      list.innerHTML = html;
      list.querySelectorAll("[data-edit-menu]").forEach((btn) =>
        btn.addEventListener("click", () => openMenuEdit(btn.dataset.editMenu, items)));
      list.querySelectorAll("[data-del-menu]").forEach((btn) =>
        btn.addEventListener("click", () => deleteMenuItem(btn.dataset.delMenu)));
    } catch (err) {
      list.innerHTML = `<div class="empty">Помилка: ${escapeHtml(err.message)}</div>`;
    }
  }

  function menuItemCard(it) {
    return `
      <div class="card" data-menu-card="${it.id}">
        <div class="row"><h4>${escapeHtml(it.name)}</h4><span class="meta">${escapeHtml(it.price)}</span></div>
        ${it.note ? `<div class="meta">${escapeHtml(it.note)}</div>` : ""}
        <div class="actions">
          <button class="btn-small" data-edit-menu="${it.id}">Редагувати</button>
          <button class="btn-danger" data-del-menu="${it.id}">Видалити</button>
        </div>
      </div>
    `;
  }

  function openMenuEdit(id, items) {
    const it = items.find((x) => String(x.id) === String(id));
    if (!it) return;
    const card = document.querySelector(`[data-menu-card="${id}"]`);
    card.innerHTML = `
      <form class="form" style="margin:0">
        <input name="category" value="${escapeHtml(it.category)}" placeholder="Категорія" required>
        <input name="name" value="${escapeHtml(it.name)}" placeholder="Назва" required>
        <input name="priceUah" type="number" min="0" step="1" value="${it.priceUah}" placeholder="Ціна, ₴" required>
        <input name="note" value="${escapeHtml(it.note || "")}" placeholder="Примітка">
        <div class="actions">
          <button type="submit" class="btn">Зберегти</button>
          <button type="button" class="btn-small" data-cancel>Скасувати</button>
        </div>
      </form>
    `;
    card.querySelector("[data-cancel]").addEventListener("click", () => loadMenu());
    card.querySelector("form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
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

  document.getElementById("menuAddForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      await api("/api/menu", {
        method: "POST",
        body: {
          category: f.get("category"), name: f.get("name"),
          priceUah: Number(f.get("priceUah")), note: f.get("note") || ""
        }
      });
      e.target.reset();
      toast("Додано");
      loadMenu();
    } catch (err) {
      toast(err.message, true);
    }
  });

  // ---------- prices ----------
  document.getElementById("clubSelect").addEventListener("change", loadPrices);

  async function loadPrices() {
    if (!clubsLoaded) await loadClubs();
    const select = document.getElementById("clubSelect");
    const slug = select.value || (clubs[0] && clubs[0].slug);
    if (!slug) return;
    select.value = slug;

    const zonesList = document.getElementById("zonesList");
    const psList = document.getElementById("psList");
    zonesList.innerHTML = "<div class=\"empty\">Завантаження…</div>";
    psList.innerHTML = "";
    try {
      const data = await api(`/api/clubs/${slug}/prices`);
      renderZones(slug, data.zones || []);
      renderPs(slug, data.ps || []);
    } catch (err) {
      zonesList.innerHTML = `<div class="empty">Помилка: ${escapeHtml(err.message)}</div>`;
    }
  }

  const LABELS = ["1 год", "3 год", "5 год", "День", "Ніч"];

  function renderZones(slug, zones) {
    const list = document.getElementById("zonesList");
    if (!zones.length) {
      list.innerHTML = "<div class=\"empty\">Немає тарифних зон.</div>";
      return;
    }
    list.innerHTML = zones.map((z) => `
      <div class="card" data-zone-card="${z.id}">
        <div class="row"><h4>${escapeHtml(z.zone)}${z.isTop ? " ★" : ""}</h4><span class="meta">#${z.id}</span></div>
        <div class="meta">Будні: ${z.wd.map((v, i) => `${LABELS[i]} ${v}₴`).join(" · ")}</div>
        ${z.hasToggle ? `<div class="meta">Вихідні: ${z.we.map((v, i) => `${LABELS[i]} ${v}₴`).join(" · ")}</div>` : ""}
        <div class="actions">
          <button class="btn-small" data-edit-zone="${z.id}">Редагувати</button>
          <button class="btn-danger" data-del-zone="${z.id}">Видалити</button>
        </div>
      </div>
    `).join("");
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
    card.innerHTML = `
      <form class="form" style="margin:0">
        <input name="zone" value="${escapeHtml(z.zone)}" placeholder="Назва зони" required>
        <label class="checkbox"><input type="checkbox" name="isTop" ${z.isTop ? "checked" : ""}> Топова зона</label>
        <input name="badge" value="${escapeHtml(z.badge || "")}" placeholder="Бейдж">
        <input name="cpu" value="${escapeHtml(z.cpu || "")}" placeholder="CPU">
        <input name="gpu" value="${escapeHtml(z.gpu || "")}" placeholder="GPU">
        <input name="ram" value="${escapeHtml(z.ram || "")}" placeholder="RAM">
        <input name="monitor" value="${escapeHtml(z.monitor || "")}" placeholder="Монітор">
        <input name="periph" value="${escapeHtml(z.periph || "")}" placeholder="Периферія">
        <input name="chair" value="${escapeHtml(z.chair || "")}" placeholder="Крісло">
        <div class="grid5">
          <input name="wd1" type="number" value="${z.wd[0]}" required>
          <input name="wd3" type="number" value="${z.wd[1]}" required>
          <input name="wd5" type="number" value="${z.wd[2]}" required>
          <input name="wdDay" type="number" value="${z.wd[3]}" required>
          <input name="wdNight" type="number" value="${z.wd[4]}" required>
        </div>
        <label class="checkbox"><input type="checkbox" name="hasToggle" class="toggle-we" ${hasToggle ? "checked" : ""}> Окремі ціни на вихідні</label>
        <div class="grid5 we-fields" ${hasToggle ? "" : "hidden"}>
          <input name="we1" type="number" value="${z.we[0]}">
          <input name="we3" type="number" value="${z.we[1]}">
          <input name="we5" type="number" value="${z.we[2]}">
          <input name="weDay" type="number" value="${z.we[3]}">
          <input name="weNight" type="number" value="${z.we[4]}">
        </div>
        <div class="actions">
          <button type="submit" class="btn">Зберегти</button>
          <button type="button" class="btn-small" data-cancel>Скасувати</button>
        </div>
      </form>
    `;
    wireToggleWe(card);
    card.querySelector("[data-cancel]").addEventListener("click", () => loadPrices());
    card.querySelector("form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const body = zoneFormToBody(f);
      try {
        await api(`/api/clubs/${slug}/prices/zones/${id}`, { method: "PUT", body });
        toast("Збережено");
        loadPrices();
      } catch (err) {
        toast(err.message, true);
      }
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
      wd: [f.get("wd1"), f.get("wd3"), f.get("wd5"), f.get("wdDay"), f.get("wdNight")].map(Number)
    };
    if (f.get("hasToggle") === "on") {
      body.we = [f.get("we1"), f.get("we3"), f.get("we5"), f.get("weDay"), f.get("weNight")].map(Number);
    }
    return body;
  }

  function wireToggleWe(scope) {
    const toggle = scope.querySelector(".toggle-we");
    const fields = scope.querySelector(".we-fields");
    if (!toggle || !fields) return;
    toggle.addEventListener("change", () => { fields.hidden = !toggle.checked; });
  }
  wireToggleWe(document.getElementById("zoneAddForm"));

  document.getElementById("zoneAddForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const slug = document.getElementById("clubSelect").value;
    const f = new FormData(e.target);
    const body = zoneFormToBody(f);
    try {
      await api(`/api/clubs/${slug}/prices/zones`, { method: "POST", body });
      e.target.reset();
      document.querySelector("#zoneAddForm .we-fields").hidden = true;
      toast("Зону додано");
      loadPrices();
    } catch (err) {
      toast(err.message, true);
    }
  });

  function renderPs(slug, cards) {
    const list = document.getElementById("psList");
    if (!cards.length) {
      list.innerHTML = "<div class=\"empty\">Немає карток PlayStation.</div>";
      return;
    }
    list.innerHTML = cards.map((p) => `
      <div class="card" data-ps-card="${p.id}">
        <div class="row"><h4>${escapeHtml(p.title)}${p.isVip ? " · VIP" : ""}</h4><span class="meta">#${p.id}</span></div>
        <div class="meta">${p.rows.map(([label, price]) => `${escapeHtml(label)}: ${escapeHtml(price)}`).join(" · ")}</div>
        <div class="actions">
          <button class="btn-small" data-edit-ps="${p.id}">Редагувати</button>
          <button class="btn-danger" data-del-ps="${p.id}">Видалити</button>
        </div>
      </div>
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
        <input class="ps-label" placeholder="Напр. 1 година" value="${escapeHtml(label || "")}">
        <input class="ps-price" placeholder="Ціна" value="${escapeHtml(price || "")}">
        <button type="button" class="btn-small" data-remove-row>✕</button>
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
    card.innerHTML = `
      <form class="form" style="margin:0">
        <input name="title" value="${escapeHtml(p.title)}" placeholder="Назва" required>
        <label class="checkbox"><input type="checkbox" name="isVip" ${p.isVip ? "checked" : ""}> VIP</label>
        <input name="badge" value="${escapeHtml(p.badge || "")}" placeholder="Бейдж">
        <div class="ps-rows" data-rows></div>
        <button type="button" class="btn-outline" data-add-row>+ рядок ціни</button>
        <div class="actions">
          <button type="submit" class="btn">Зберегти</button>
          <button type="button" class="btn-small" data-cancel>Скасувати</button>
        </div>
      </form>
    `;
    const editor = psRowsEditor(card.querySelector("[data-rows]"), p.rows);
    card.querySelector("[data-add-row]").addEventListener("click", () => editor.addEmptyRow());
    card.querySelector("[data-cancel]").addEventListener("click", () => loadPrices());
    card.querySelector("form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
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

  const psAddEditor = psRowsEditor(document.getElementById("psAddRows"), []);
  document.getElementById("psAddRowBtn").addEventListener("click", () => psAddEditor.addEmptyRow());

  document.getElementById("psAddForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const slug = document.getElementById("clubSelect").value;
    const f = new FormData(e.target);
    try {
      await api(`/api/clubs/${slug}/prices/ps`, {
        method: "POST",
        body: { title: f.get("title"), isVip: f.get("isVip") === "on", badge: f.get("badge") || null, rows: psAddEditor.getRows() }
      });
      e.target.reset();
      psRowsEditor(document.getElementById("psAddRows"), []);
      toast("Картку додано");
      loadPrices();
    } catch (err) {
      toast(err.message, true);
    }
  });

  // ---------- init ----------
  loadBookings();
})();
