/* FundSplit sidebar panel. Dependency-free web component (no build step). */

const ZAR = new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" });
const rand = (cents) => ZAR.format(cents / 100);
const todayISO = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local

const MAX_EDGE = 1600; // px; keeps the upload small without hurting receipt legibility

const STYLE = `
  :host { display: block; background: var(--primary-background-color); color: var(--primary-text-color);
          min-height: 100vh; font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif); }
  header { display: flex; align-items: center; gap: 8px; height: 56px; padding: 0 16px;
           background: var(--app-header-background-color, var(--primary-color));
           color: var(--app-header-text-color, #fff); position: sticky; top: 0; z-index: 2; }
  header h1 { font-size: 20px; font-weight: 400; margin: 0; flex: 1; }
  header button { background: none; border: none; color: inherit; font-size: 24px; cursor: pointer; }
  main { max-width: 720px; margin: 0 auto; padding: 16px; display: grid; gap: 16px; }
  .card { background: var(--card-background-color); border-radius: var(--ha-card-border-radius, 12px);
          box-shadow: var(--ha-card-box-shadow, 0 1px 3px rgba(0,0,0,.2)); padding: 16px; }
  .hero { text-align: center; }
  .hero .big { font-size: 32px; font-weight: 500; margin: 4px 0 12px; }
  .hero .sub { color: var(--secondary-text-color); }
  .hero.even .big { color: var(--success-color, #43a047); }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; text-align: center; }
  .stats div span { display: block; color: var(--secondary-text-color); font-size: 12px; }
  .stats div b { font-size: 16px; }
  .pos { color: var(--success-color, #43a047); } .neg { color: var(--error-color, #db4437); }
  button.primary, button.secondary { border: none; border-radius: 20px; padding: 10px 20px; font-size: 14px;
          font-weight: 500; cursor: pointer; }
  button.primary { background: var(--primary-color); color: var(--text-primary-color, #fff); }
  button.secondary { background: transparent; color: var(--primary-color); }
  button:disabled { opacity: .5; cursor: default; }
  form { display: grid; gap: 12px; }
  label { display: grid; gap: 4px; font-size: 12px; color: var(--secondary-text-color); }
  input, select { font: inherit; font-size: 16px; padding: 10px; border-radius: 8px; color: var(--primary-text-color);
          border: 1px solid var(--divider-color); background: var(--secondary-background-color); }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .actions { display: flex; justify-content: flex-end; gap: 8px; }
  .error { color: var(--error-color, #db4437); font-size: 14px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .5px; color: var(--secondary-text-color);
       margin: 0 0 8px; font-weight: 500; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid var(--divider-color); }
  li:first-child { border-top: none; }
  li .main { flex: 1; min-width: 0; }
  li .title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  li .meta { color: var(--secondary-text-color); font-size: 12px; }
  li .amt { text-align: right; white-space: nowrap; }
  li .amt small { display: block; color: var(--secondary-text-color); font-size: 12px; }
  li .del { background: none; border: none; color: var(--secondary-text-color); cursor: pointer; font-size: 18px; }
  .empty { color: var(--secondary-text-color); text-align: center; padding: 16px 0; }
  .hidden { display: none; }
  .toolbar { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .toolbar button, form button.scan { width: 100%; }
  .scanning { text-align: center; color: var(--secondary-text-color); }
`;

class FundSplitPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._state = null;
    this._error = null;
    this._showForm = false;
    this._busy = false;
    this._unsub = null;
    this._prefill = null;
    this._scanning = false;
    this._skipDraft = false;
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) this._init();
  }

  set narrow(v) { this._narrow = v; this._render(); }
  set panel(_) {}
  set route(_) {}

  async _init() {
    await this._load();
    // Refresh whenever anyone (UI, service call, automation) changes the ledger.
    const names = ["fundsplit_expense_added", "fundsplit_settlement_added", "fundsplit_item_deleted"];
    const unsubs = await Promise.all(
      names.map((n) => this._hass.connection.subscribeEvents(() => this._load(), n))
    );
    this._unsub = () => unsubs.forEach((u) => u());
  }

  disconnectedCallback() { if (this._unsub) { this._unsub(); this._unsub = null; } }

  async _load() {
    try {
      this._state = await this._hass.callWS({ type: "fundsplit/state" });
      this._error = null;
    } catch (err) {
      this._error = err.message || "Could not load FundSplit";
    }
    this._render();
  }

  async _call(msg) {
    this._busy = true;
    this._error = null;
    this._render();
    try {
      this._state = await this._hass.callWS(msg);
      return true;
    } catch (err) {
      this._error = err.message || "Something went wrong";
      return false;
    } finally {
      this._busy = false;
      this._render();
    }
  }

  // ---- helpers ---------------------------------------------------------

  _name(id) { return this._state.members.find((m) => m.id === id)?.name ?? "?"; }

  /** The member linked to the logged-in HA user, if any. */
  _currentMemberId() {
    const uid = this._hass.user?.id;
    const person = Object.values(this._hass.states).find(
      (s) => s.entity_id.startsWith("person.") && s.attributes.user_id === uid
    );
    return this._state.members.find((m) => m.person && m.person === person?.entity_id)?.id
      ?? this._state.members[0].id;
  }

  // ---- rendering -------------------------------------------------------

  _render() {
    const root = this.shadowRoot;
    // Preserve form input while re-rendering on background updates.
    const draft = this._skipDraft ? null : this._readDraft();
    this._skipDraft = false;
    root.innerHTML = `<style>${STYLE}</style>
      <header>
        ${this._narrow ? '<button id="menu" aria-label="Menu">☰</button>' : ""}
        <h1>FundSplit</h1>
      </header>
      <main>${this._body()}</main>
      <input type="file" id="file" accept="image/*" class="hidden">`;
    root.getElementById("menu")?.addEventListener("click", () =>
      this.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true })));
    this._bind(draft);
  }

  _body() {
    if (!this._state) {
      return this._error ? `<div class="card error">${this._error}</div>` : `<div class="card empty">Loading…</div>`;
    }
    const s = this._state;
    const pay = s.payments[0];
    const hero = pay
      ? `<div class="card hero">
           <div class="sub">${this._name(pay.from)} owes ${this._name(pay.to)}</div>
           <div class="big">${rand(pay.amount)}</div>
           <button class="primary" id="settle" ${this._busy ? "disabled" : ""}>Settle up</button>
         </div>`
      : `<div class="card hero even"><div class="big">All settled up ✓</div>
           <div class="sub">Nobody owes anything.</div></div>`;

    const balances = s.members.map((m) => {
      const b = s.balances[m.id];
      return `<div><span>${m.name}</span><b class="${b > 0 ? "pos" : b < 0 ? "neg" : ""}">${rand(b)}</b></div>`;
    }).join("");
    const stats = `<div class="card stats">${balances}
      <div><span>This month</span><b>${rand(s.month_spend)}</b></div></div>`;

    const scanning = this._scanning ? `<div class="card scanning">📷 Reading receipt…</div>` : "";
    return `${this._error ? `<div class="card error">${this._error}</div>` : ""}
      ${hero}${stats}${scanning}${this._form()}${this._activity()}`;
  }

  _form() {
    if (!this._showForm) {
      return `<div class="toolbar">
        <button class="primary" id="add">+ Add expense</button>
        <button class="primary scan" ${this._scanning ? "disabled" : ""}>📷 Scan receipt</button>
      </div>`;
    }
    const s = this._state;
    const me = this._currentMemberId();
    const opts = s.members.map((m) => `<option value="${m.id}" ${m.id === me ? "selected" : ""}>${m.name}</option>`).join("");
    const pf = this._prefill || {};
    const cats = s.categories.map((c) => `<option ${c === pf.category ? "selected" : ""}>${c}</option>`).join("");
    return `<form class="card" id="form">
      <button type="button" class="secondary scan" ${this._scanning ? "disabled" : ""}>📷 Scan receipt</button>
      <label>Description<input name="description" required maxlength="80" value="${this._esc(pf.description ?? "").replace(/"/g, "&quot;")}" autofocus></label>
      <div class="row">
        <label>Amount (ZAR)<input name="amount" type="number" inputmode="decimal" step="0.01" min="0.01" value="${pf.amount ?? ""}" required></label>
        <label>Paid by<select name="paid_by">${opts}</select></label>
      </div>
      <div class="row">
        <label>Split<select name="split">
          <option value="equal">Equally</option>
          <option value="other">The other person owes all</option>
          <option value="percent">By percentage</option>
          <option value="exact">Exact amounts</option>
        </select></label>
        <label>Date<input name="date" type="date" value="${pf.date ?? todayISO()}"></label>
      </div>
      <label id="split-extra" class="hidden"></label>
      <label>Category<select name="category"><option value="">—</option>${cats}</select></label>
      <div class="actions">
        <button type="button" class="secondary" id="cancel">Cancel</button>
        <button type="submit" class="primary" ${this._busy ? "disabled" : ""}>Save</button>
      </div>
    </form>`;
  }

  _activity() {
    const items = this._state.activity;
    if (!items.length) return `<div class="card empty">No expenses yet. Add your first one above.</div>`;
    const rows = items.map((a) => {
      if (a.type === "settlement") {
        return `<li><div class="main"><div class="title">💸 ${this._name(a.from)} paid ${this._name(a.to)}</div>
          <div class="meta">${a.date} · Settlement</div></div>
          <div class="amt">${rand(a.amount)}</div>
          <button class="del" data-id="${a.id}" title="Delete" aria-label="Delete">✕</button></li>`;
      }
      const lent = a.amount - a.split[a.paid_by];
      return `<li><div class="main"><div class="title">${this._esc(a.description)}</div>
        <div class="meta">${a.date} · ${this._name(a.paid_by)} paid${a.category ? " · " + this._esc(a.category) : ""}</div></div>
        <div class="amt">${rand(a.amount)}<small>${this._name(a.paid_by)} lent ${rand(lent)}</small></div>
        <button class="del" data-id="${a.id}" title="Delete" aria-label="Delete">✕</button></li>`;
    }).join("");
    return `<div class="card"><h2>Activity</h2><ul>${rows}</ul></div>`;
  }

  _esc(str) {
    const d = document.createElement("div");
    d.textContent = str ?? "";
    return d.innerHTML;
  }

  // ---- events ----------------------------------------------------------

  _readDraft() {
    const f = this.shadowRoot.getElementById("form");
    if (!f) return null;
    return Object.fromEntries(new FormData(f).entries());
  }

  _bind(draft) {
    const root = this.shadowRoot;
    root.getElementById("add")?.addEventListener("click", () => { this._showForm = true; this._render(); });
    root.getElementById("cancel")?.addEventListener("click", () => {
      this._showForm = false; this._prefill = null; this._render();
    });
    const file = root.getElementById("file");
    root.querySelectorAll(".scan").forEach((b) => b.addEventListener("click", () => file.click()));
    file.addEventListener("change", () => {
      const picked = file.files[0];
      file.value = "";
      if (picked) this._scan(picked);
    });
    root.getElementById("settle")?.addEventListener("click", () => {
      const pay = this._state.payments[0];
      if (confirm(`Record ${this._name(pay.from)} paying ${this._name(pay.to)} ${rand(pay.amount)}?`)) {
        this._call({ type: "fundsplit/settle" });
      }
    });
    root.querySelectorAll(".del").forEach((btn) =>
      btn.addEventListener("click", () => {
        if (confirm("Delete this entry?")) this._call({ type: "fundsplit/delete", item_id: btn.dataset.id });
      }));

    const form = root.getElementById("form");
    if (!form) return;
    if (draft) for (const [k, v] of Object.entries(draft)) if (form.elements[k]) form.elements[k].value = v;
    const sync = () => this._syncSplitExtra(form);
    form.elements.split.addEventListener("change", sync);
    form.elements.paid_by.addEventListener("change", sync);
    sync();
    form.addEventListener("submit", (e) => { e.preventDefault(); this._submit(form); });
  }

  _syncSplitExtra(form) {
    const extra = this.shadowRoot.getElementById("split-extra");
    const mode = form.elements.split.value;
    const payer = this._name(form.elements.paid_by.value);
    if (mode === "percent") {
      extra.className = "";
      extra.innerHTML = `${payer}'s share (%)<input name="payer_value" type="number" min="0" max="100" step="0.01" value="50" required>`;
    } else if (mode === "exact") {
      extra.className = "";
      extra.innerHTML = `${payer}'s own share (ZAR)<input name="payer_value" type="number" min="0" step="0.01" value="0" required>`;
    } else {
      extra.className = "hidden";
      extra.innerHTML = "";
    }
  }

  async _submit(form) {
    const f = Object.fromEntries(new FormData(form).entries());
    const payer = f.paid_by;
    const other = this._state.members.find((m) => m.id !== payer).id;
    const msg = {
      type: "fundsplit/add_expense",
      description: f.description,
      amount: parseFloat(f.amount),
      paid_by: payer,
      date: f.date || undefined,
      category: f.category || null,
      split_mode: "equal",
    };
    if (f.split === "other") {
      msg.split_mode = "shares";
      msg.split_values = { [payer]: 0, [other]: 1 };
    } else if (f.split === "percent") {
      const p = parseFloat(f.payer_value);
      msg.split_mode = "percent";
      msg.split_values = { [payer]: p, [other]: Math.round((100 - p) * 100) / 100 };
    } else if (f.split === "exact") {
      // Work in cents to avoid float drift, then send rands.
      const total = Math.round(msg.amount * 100);
      const mine = Math.round(parseFloat(f.payer_value) * 100);
      msg.split_mode = "exact";
      msg.split_values = { [payer]: mine / 100, [other]: (total - mine) / 100 };
    }
    if (await this._call(msg)) { this._showForm = false; this._prefill = null; }
    this._render();
  }

  /** Downscale a photo to a JPEG (base64, no data: prefix) so the upload stays small. */
  async _shrink(file) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
  }

  async _scan(file) {
    this._scanning = true;
    this._error = null;
    this._render();
    try {
      const image = await this._shrink(file);
      const draft = await this._hass.callWS({
        type: "fundsplit/scan_receipt", image, mime_type: "image/jpeg",
      });
      this._prefill = draft;
      this._showForm = true;
      this._skipDraft = true; // let the scanned values replace whatever was typed
    } catch (err) {
      this._error = err.message || "Couldn't read that receipt";
    } finally {
      this._scanning = false;
      this._render();
    }
  }
}

customElements.define("fundsplit-panel", FundSplitPanel);
