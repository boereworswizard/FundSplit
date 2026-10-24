/* FundSplit sidebar panel. Dependency-free web component (no build step). */

const ZAR = new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" });
const rand = (cents) => ZAR.format(cents / 100);
const todayISO = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local

const MAX_EDGE = 1600; // px; keeps the upload small without hurting receipt legibility

const STYLE = `
  :host { display: block; overflow-x: hidden; background: var(--primary-background-color); color: var(--primary-text-color);
          min-height: 100vh; font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif); }
  header { display: flex; align-items: center; gap: 8px; height: 56px; padding: 0 16px;
           background: var(--app-header-background-color, var(--primary-color));
           color: var(--app-header-text-color, #fff); position: sticky; top: 0; z-index: 2; }
  header h1 { font-size: 20px; font-weight: 400; margin: 0; flex: 1; }
  header button { background: none; border: none; color: inherit; font-size: 24px; cursor: pointer; }
  main { max-width: 720px; margin: 0 auto; padding: 16px; display: grid; gap: 16px;
         grid-template-columns: minmax(0, 1fr); box-sizing: border-box; }
  .card { min-width: 0; box-sizing: border-box; overflow-wrap: anywhere; background: var(--card-background-color); border-radius: var(--ha-card-border-radius, 12px);
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
  input, select { min-width: 0; max-width: 100%; box-sizing: border-box; font: inherit; font-size: 16px; padding: 10px; border-radius: 8px; color: var(--primary-text-color);
          border: 1px solid var(--divider-color); background: var(--secondary-background-color); }
  .row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
  .actions { display: flex; justify-content: flex-end; gap: 8px; }
  .error { color: var(--error-color, #db4437); font-size: 14px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .5px; color: var(--secondary-text-color);
       margin: 0 0 8px; font-weight: 500; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid var(--divider-color); }
  li:first-child { border-top: none; }
  li .main { flex: 1 1 0; min-width: 40%; }
  li .title { overflow-wrap: anywhere; }
  li .meta { color: var(--secondary-text-color); font-size: 12px; }
  li .amt { text-align: right; flex: 0 1 auto; max-width: 42%; }
  li .amt .v { white-space: nowrap; }
  li .amt small { display: block; color: var(--secondary-text-color); font-size: 12px; }
  li .del { background: none; border: none; color: var(--secondary-text-color); cursor: pointer; font-size: 18px; }
  .empty { color: var(--secondary-text-color); text-align: center; padding: 16px 0; }
  .hidden { display: none; }
  li .edit { background: none; border: none; color: var(--secondary-text-color); cursor: pointer; font-size: 16px; }
  .toolbar { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
  .toolbar button, form button.scan { width: 100%; }
  .scanning { text-align: center; color: var(--secondary-text-color); }
  .tag { display: block; width: fit-content; margin-top: 2px; padding: 0 8px; border-radius: 10px; font-size: 11px;
         border: 1px solid var(--divider-color); color: var(--secondary-text-color); white-space: nowrap; }

  /* Chart colours (validated: palette checks pass in light and dark). */
  :host { --fs-bar: #2a78d6; --fs-bar-dim: rgba(42,120,214,.28); --fs-p1: #eb6834; --fs-p2: #6250d6; }
  :host([dark]) { --fs-bar: #3987e5; --fs-bar-dim: rgba(57,135,229,.30); --fs-p1: #d95926; --fs-p2: #9085e9; }

  .tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; border-radius: 22px;
          background: var(--secondary-background-color); }
  .tabs button { border: none; border-radius: 18px; padding: 8px; font: inherit; font-size: 14px; font-weight: 500;
          cursor: pointer; background: transparent; color: var(--secondary-text-color); }
  .tabs button[aria-selected="true"] { background: var(--card-background-color); color: var(--primary-text-color);
          box-shadow: 0 1px 2px rgba(0,0,0,.2); }
  .monthnav { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .monthnav b { font-size: 16px; font-weight: 500; }
  .monthnav button { width: 40px; height: 40px; border-radius: 20px; border: none; font-size: 20px; cursor: pointer;
          background: var(--secondary-background-color); color: var(--primary-text-color); }
  .monthnav button:disabled { opacity: .35; cursor: default; }
  .delta { color: var(--secondary-text-color); font-size: 14px; }
  .legend { display: grid; gap: 6px; margin-bottom: 12px; }
  .legend .item { display: grid; grid-template-columns: auto 1fr auto auto; gap: 8px; align-items: baseline; font-size: 14px; }
  .legend .item small { color: var(--secondary-text-color); font-size: 12px; text-align: right; }
  .dot { width: 10px; height: 10px; border-radius: 5px; display: inline-block; align-self: center; }
  .stackrow { margin-top: 12px; }
  .stackrow .lab { font-size: 12px; color: var(--secondary-text-color); margin-bottom: 4px; }
  .stack { display: flex; gap: 2px; height: 20px; border-radius: 4px; overflow: hidden; }
  .stack .seg { min-width: 2px; }
  .stack.none { background: var(--secondary-background-color); }
  .note { margin: 12px 0 0; font-size: 14px; color: var(--secondary-text-color); }
  .cats { display: grid; gap: 12px; }
  .cat { display: grid; gap: 4px; padding: 2px 0; }
  .cat .top { display: flex; justify-content: space-between; gap: 8px; font-size: 14px; }
  .cat .top small { color: var(--secondary-text-color); font-size: 12px; }
  .cat .track { height: 20px; }
  .cat .fill { height: 100%; min-width: 2px; background: var(--fs-bar); border-radius: 0 4px 4px 0; }
  .cat:hover .fill, .cat:focus-visible .fill { filter: brightness(1.12); }
  .chart { display: flex; align-items: flex-end; gap: 2px; height: 140px; border-bottom: 1px solid var(--divider-color); }
  .col { flex: 1 1 0; min-width: 0; height: 100%; display: flex; align-items: flex-end; justify-content: center;
         background: none; border: none; padding: 0; cursor: pointer; position: relative; }
  .col .bar { width: 100%; max-width: 24px; background: var(--fs-bar-dim); border-radius: 4px 4px 0 0; min-height: 0; }
  .col[aria-pressed="true"] .bar { background: var(--fs-bar); }
  .col:hover .bar, .col:focus-visible .bar { background: var(--fs-bar); filter: brightness(1.05); }
  .col .cap { position: absolute; font-size: 11px; font-weight: 500; white-space: nowrap; color: var(--primary-text-color); }
  .col .cap.c { left: 50%; transform: translateX(-50%); }
  .col .cap.l { left: 0; } .col .cap.r { right: 0; }
  .xlabels { display: flex; gap: 2px; margin-top: 4px; }
  .xlabels span { flex: 1 1 0; min-width: 0; text-align: center; font-size: 10px; color: var(--secondary-text-color); }
  details { margin-top: 4px; }
  summary { cursor: pointer; font-size: 14px; color: var(--primary-color); }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
  th, td { padding: 6px 4px; border-top: 1px solid var(--divider-color); }
  th { text-align: left; font-weight: 500; color: var(--secondary-text-color); }
  td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; }
  .tip { position: fixed; z-index: 10; pointer-events: none; padding: 6px 10px; border-radius: 8px; font-size: 12px;
         background: var(--primary-text-color); color: var(--card-background-color); max-width: 220px; }
  .tip b { display: block; font-size: 14px; }
`;

const monthName = (key, style = "long") => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-ZA", style === "long" ? { month: "long", year: "numeric" } : { month: "short" });
};
const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

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
    this._editing = null; // { type: "expense" | "settlement", item }
    this._scanning = false;
    this._skipDraft = false;
    this._tab = "overview"; // "overview" | "insights"
    this._month = null; // selected insights month (YYYY-MM); null = current
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    this.toggleAttribute("dark", !!hass.themes?.darkMode);
    if (first) this._init();
  }

  set narrow(v) { this._narrow = v; this._render(); }
  set panel(_) {}
  set route(_) {}

  async _init() {
    await this._load();
    // Refresh whenever anyone (UI, service call, automation) changes the ledger.
    const names = ["fundsplit_expense_added", "fundsplit_settlement_added", "fundsplit_item_deleted", "fundsplit_item_updated"];
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
    const tabs = `<div class="tabs" role="tablist">
      <button role="tab" data-tab="overview" aria-selected="${this._tab === "overview"}">Overview</button>
      <button role="tab" data-tab="insights" aria-selected="${this._tab === "insights"}">Insights</button>
    </div>`;
    const err = this._error ? `<div class="card error">${this._error}</div>` : "";
    if (this._tab === "insights") return `${tabs}${err}${this._insights()}`;
    return `${tabs}${err}${hero}${stats}${scanning}${this._form()}${this._activity()}`;
  }

  /** Turn a stored expense back into the form's fields. */
  _editDraft(a) {
    const payer = a.paid_by;
    const other = this._state.members.find((m) => m.id !== payer).id;
    const v = a.split_values || {};
    const draft = {
      description: a.description, amount: a.amount / 100, date: a.date,
      category: a.category, paid_by: payer, split: "equal",
    };
    if (a.split_mode === "percent" || a.split_mode === "exact") {
      draft.split = a.split_mode;
      draft.payer_value = v[payer];
    } else if (a.split_mode === "shares" && Number(v[payer] ?? 0) === 0 && Number(v[other] ?? 0) > 0) {
      draft.split = "other";
    } else if (a.split_mode !== "equal") {
      draft.split = "exact";
      draft.payer_value = a.split[payer] / 100;
    }
    return draft;
  }

  _settlementForm() {
    const s = this._state;
    const a = this._editing.item;
    const opts = (sel) => s.members.map((m) => `<option value="${m.id}" ${m.id === sel ? "selected" : ""}>${m.name}</option>`).join("");
    return `<form class="card" id="settleform">
      <h2>Edit settlement</h2>
      <div class="row">
        <label>Paid by<select name="from">${opts(a.from)}</select></label>
        <label>Paid to<select name="to">${opts(a.to)}</select></label>
      </div>
      <div class="row">
        <label>Amount (ZAR)<input name="amount" type="number" inputmode="decimal" step="0.01" min="0.01" value="${a.amount / 100}" required></label>
        <label>Date<input name="date" type="date" value="${a.date}"></label>
      </div>
      <div class="actions">
        <button type="button" class="secondary" id="cancel">Cancel</button>
        <button type="submit" class="primary" ${this._busy ? "disabled" : ""}>Save</button>
      </div>
    </form>`;
  }

  _form() {
    if (this._editing?.type === "settlement") return this._settlementForm();
    if (!this._showForm) {
      return `<div class="toolbar">
        <button class="primary" id="add">+ Add expense</button>
        <button class="primary scan" ${this._scanning ? "disabled" : ""}>📷 Scan receipt</button>
      </div>`;
    }
    const s = this._state;
    const pf = this._prefill || {};
    const me = pf.paid_by ?? this._currentMemberId();
    const opts = s.members.map((m) => `<option value="${m.id}" ${m.id === me ? "selected" : ""}>${m.name}</option>`).join("");
    const sel = (v) => (pf.split === v ? "selected" : "");
    const cats = s.categories.map((c) => `<option ${c === pf.category ? "selected" : ""}>${c}</option>`).join("");
    return `<form class="card" id="form">
      ${this._editing ? "<h2>Edit expense</h2>" : ""}
      <button type="button" class="secondary scan" ${this._scanning ? "disabled" : ""}>📷 Scan receipt</button>
      <label>Description<input name="description" required maxlength="80" value="${this._esc(pf.description ?? "").replace(/"/g, "&quot;")}" autofocus></label>
      <div class="row">
        <label>Amount (ZAR)<input name="amount" type="number" inputmode="decimal" step="0.01" min="0.01" value="${pf.amount ?? ""}" required></label>
        <label>Paid by<select name="paid_by">${opts}</select></label>
      </div>
      <div class="row">
        <label>Split<select name="split">
          <option value="equal" ${sel("equal")}>Equally</option>
          <option value="other" ${sel("other")}>The other person owes all</option>
          <option value="percent" ${sel("percent")}>By percentage</option>
          <option value="exact" ${sel("exact")}>Exact amounts</option>
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
          <div class="meta">${a.date} · Settlement${this._tag(a)}</div></div>
          <div class="amt"><span class="v">${rand(a.amount)}</span></div>
          <button class="edit" data-id="${a.id}" title="Edit" aria-label="Edit">✎</button>
          <button class="del" data-id="${a.id}" title="Delete" aria-label="Delete">✕</button></li>`;
      }
      const lent = a.amount - a.split[a.paid_by];
      return `<li><div class="main"><div class="title">${this._esc(a.description)}</div>
        <div class="meta">${a.date} · ${this._name(a.paid_by)} paid${a.category ? " · " + this._esc(a.category) : ""}${this._tag(a)}</div></div>
        <div class="amt"><span class="v">${rand(a.amount)}</span><small>${this._name(a.paid_by)} lent ${rand(lent)}</small></div>
        <button class="edit" data-id="${a.id}" title="Edit" aria-label="Edit">✎</button>
        <button class="del" data-id="${a.id}" title="Delete" aria-label="Delete">✕</button></li>`;
    }).join("");
    return `<div class="card"><h2>Activity</h2><ul>${rows}</ul></div>`;
  }

  _tag(a) {
    return a.created_by ? ` <span class="tag">added by ${this._esc(a.created_by)}</span>` : "";
  }

  _esc(str) {
    const d = document.createElement("div");
    d.textContent = str ?? "";
    return d.innerHTML;
  }

  // ---- insights --------------------------------------------------------

  _personColor(id) { return this._state.members[0].id === id ? "var(--fs-p1)" : "var(--fs-p2)"; }

  _stack(label, byMember, total) {
    if (!total) return `<div class="stackrow"><div class="lab">${label}</div><div class="stack none"></div></div>`;
    const segs = this._state.members.filter((m) => byMember[m.id] > 0).map((m) =>
      `<div class="seg" tabindex="0" style="flex:${byMember[m.id]};background:${this._personColor(m.id)}"
        data-tt="${this._esc(m.name)} · ${label.toLowerCase()}" data-tv="${rand(byMember[m.id])}"
        data-ts="${pct(byMember[m.id], total)}% of ${rand(total)}"></div>`).join("");
    return `<div class="stackrow"><div class="lab">${label}</div><div class="stack">${segs}</div></div>`;
  }

  _insights() {
    const months = this._state.insights;
    let i = months.findIndex((m) => m.month === this._month);
    if (i < 0) i = months.length - 1;
    const cur = months[i];
    const prev = months[i - 1];
    const members = this._state.members;

    // Headline: this month's spend vs the one before.
    let delta = "";
    if (!cur.total) delta = "Nothing spent this month.";
    else if (prev && prev.total) {
      const change = Math.round(((cur.total - prev.total) / prev.total) * 100);
      const arrow = change > 0 ? "▲" : change < 0 ? "▼" : "▬";
      delta = `${arrow} ${Math.abs(change)}% vs ${monthName(prev.month, "short")} (${rand(prev.total)})`;
    } else if (prev) delta = `Nothing was spent in ${monthName(prev.month, "short")}.`;
    const hero = `<div class="card hero">
      <div class="sub">Spent in ${monthName(cur.month)}</div>
      <div class="big">${rand(cur.total)}</div>
      <div class="delta">${delta}${cur.count ? ` · ${cur.count} expense${cur.count === 1 ? "" : "s"}` : ""}</div>
    </div>`;

    const nav = `<div class="monthnav">
      <button id="mprev" aria-label="Previous month" ${i === 0 ? "disabled" : ""}>‹</button>
      <b>${monthName(cur.month)}</b>
      <button id="mnext" aria-label="Next month" ${i === months.length - 1 ? "disabled" : ""}>›</button>
    </div>`;

    // Who paid vs who's share it was.
    const legend = members.map((m) => `<div class="item">
        <span class="dot" style="background:${this._personColor(m.id)}"></span><span>${this._esc(m.name)}</span>
        <small>paid ${rand(cur.paid[m.id])}</small><small>share ${rand(cur.share[m.id])}</small></div>`).join("");
    const gaps = members.map((m) => ({ m, diff: cur.paid[m.id] - cur.share[m.id] })).sort((a, b) => b.diff - a.diff);
    const note = cur.total && gaps[0].diff > 0
      ? `${this._esc(gaps[0].m.name)} paid ${rand(gaps[0].diff)} more than their share.`
      : cur.total ? "Everyone paid their share." : "";
    const who = `<div class="card"><h2>Who paid</h2>
      <div class="legend">${legend}</div>
      ${this._stack("Paid", cur.paid, cur.total)}${this._stack("Share of costs", cur.share, cur.total)}
      ${note ? `<p class="note">${note}</p>` : ""}</div>`;

    // Categories, biggest first.
    const cats = Object.entries(cur.by_category).sort((a, b) => b[1] - a[1]);
    const top = cats.length ? cats[0][1] : 0;
    const catRows = cats.map(([name, amt]) => `<div class="cat" tabindex="0" data-tt="${this._esc(name)}"
        data-tv="${rand(amt)}" data-ts="${pct(amt, cur.total)}% of ${monthName(cur.month, "short")} spending">
        <div class="top"><span>${this._esc(name)}</span><span>${rand(amt)} <small>${pct(amt, cur.total)}%</small></span></div>
        <div class="track"><div class="fill" style="width:${(amt / top) * 100}%"></div></div></div>`).join("");
    const catCard = `<div class="card"><h2>By category</h2>
      ${cats.length ? `<div class="cats">${catRows}</div>` : `<div class="empty">No spending to break down.</div>`}</div>`;

    // Last 12 months: selected month emphasised, the rest dimmed.
    const max = Math.max(...months.map((m) => m.total), 1);
    const last = months.length - 1;
    const cols = months.map((m, k) => {
      const sel = k === i;
      const side = k <= 1 ? "l" : k >= last - 1 ? "r" : "c";
      const h = (m.total / max) * 100;
      return `<button class="col" data-month="${m.month}" aria-pressed="${sel}" aria-label="${monthName(m.month)}: ${rand(m.total)}"
        data-tt="${monthName(m.month)}" data-tv="${rand(m.total)}" data-ts="${m.count} expense${m.count === 1 ? "" : "s"}">
        ${sel && m.total ? `<span class="cap ${side}" style="bottom:calc(${h}% + 4px)">${rand(m.total)}</span>` : ""}
        <div class="bar" style="height:${h}%"></div></button>`;
    }).join("");
    const labels = months.map((m) => `<span>${monthName(m.month, "short")}</span>`).join("");
    const trend = `<div class="card"><h2>Last 12 months</h2>
      <div class="chart">${cols}</div><div class="xlabels">${labels}</div></div>`;

    // Table view: every value above is reachable without hovering.
    const memberHeads = members.map((m) => `<th class="n">${this._esc(m.name)}</th>`).join("");
    const monthRows = months.map((m) => `<tr><td>${monthName(m.month)}</td><td class="n">${rand(m.total)}</td>
      ${members.map((x) => `<td class="n">${rand(m.paid[x.id])}</td>`).join("")}</tr>`).join("");
    const table = `<div class="card"><details><summary>View as table</summary>
      <table><tr><th>Month</th><th class="n">Total</th>${memberHeads}</tr>${monthRows}</table>
      <table><tr><th>${monthName(cur.month)} category</th><th class="n">Amount</th></tr>
      ${cats.map(([n, a]) => `<tr><td>${this._esc(n)}</td><td class="n">${rand(a)}</td></tr>`).join("")}</table>
      </details></div>`;

    return `${nav}${hero}${who}${catCard}${trend}${table}<div class="tip" hidden></div>`;
  }

  /** One shared tooltip for every [data-tt] mark; same content on hover and keyboard focus. */
  _bindTips() {
    const root = this.shadowRoot;
    const tip = root.querySelector(".tip");
    if (!tip) return;
    const show = (el, x, y) => {
      tip.replaceChildren();
      const title = document.createElement("span");
      title.textContent = el.dataset.tt;
      const value = document.createElement("b");
      value.textContent = el.dataset.tv;
      const sub = document.createElement("span");
      sub.textContent = el.dataset.ts || "";
      tip.append(value, title, ...(el.dataset.ts ? [document.createElement("br"), sub] : []));
      tip.hidden = false;
      const w = tip.offsetWidth;
      tip.style.left = `${Math.max(8, Math.min(x - w / 2, window.innerWidth - w - 8))}px`;
      tip.style.top = `${Math.max(8, y - tip.offsetHeight - 12)}px`;
    };
    root.querySelectorAll("[data-tt]").forEach((el) => {
      el.addEventListener("pointermove", (e) => show(el, e.clientX, e.clientY));
      el.addEventListener("pointerleave", () => { tip.hidden = true; });
      el.addEventListener("focus", () => {
        const r = el.getBoundingClientRect();
        show(el, r.left + r.width / 2, r.top);
      });
      el.addEventListener("blur", () => { tip.hidden = true; });
    });
  }

  // ---- events ----------------------------------------------------------

  _readDraft() {
    const f = this.shadowRoot.getElementById("form");
    if (!f) return null;
    return Object.fromEntries(new FormData(f).entries());
  }

  _bind(draft) {
    const root = this.shadowRoot;
    root.querySelectorAll("[data-tab]").forEach((b) =>
      b.addEventListener("click", () => { this._tab = b.dataset.tab; this._render(); }));
    if (this._tab === "insights") {
      const months = this._state.insights;
      const at = () => {
        const k = months.findIndex((m) => m.month === this._month);
        return k < 0 ? months.length - 1 : k;
      };
      const go = (k) => { this._month = months[Math.min(months.length - 1, Math.max(0, k))].month; this._render(); };
      root.getElementById("mprev")?.addEventListener("click", () => go(at() - 1));
      root.getElementById("mnext")?.addEventListener("click", () => go(at() + 1));
      root.querySelectorAll(".col").forEach((c) =>
        c.addEventListener("click", () => { this._month = c.dataset.month; this._render(); }));
      this._bindTips();
      return;
    }
    root.getElementById("add")?.addEventListener("click", () => { this._showForm = true; this._render(); });
    root.getElementById("cancel")?.addEventListener("click", () => {
      this._showForm = false; this._prefill = null; this._editing = null; this._render();
    });
    root.querySelectorAll(".edit").forEach((btn) =>
      btn.addEventListener("click", () => {
        const item = this._state.activity.find((a) => a.id === btn.dataset.id);
        if (!item) return;
        this._editing = { type: item.type, item };
        this._showForm = item.type === "expense";
        this._prefill = item.type === "expense" ? this._editDraft(item) : null;
        this._skipDraft = true;
        this._render();
        this.shadowRoot.querySelector("form")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }));
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

    const sform = root.getElementById("settleform");
    if (sform) {
      sform.addEventListener("submit", async (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(sform).entries());
        const ok = await this._call({
          type: "fundsplit/update_settlement", item_id: this._editing.item.id,
          from: f.from, to: f.to, amount: parseFloat(f.amount), date: f.date || undefined,
        });
        if (ok) this._editing = null;
        this._render();
      });
      return;
    }
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
    // Only reuse a stored value while the split type is the one it was saved with.
    const saved = this._prefill?.split === mode ? this._prefill.payer_value : undefined;
    if (mode === "percent") {
      extra.className = "";
      extra.innerHTML = `${payer}'s share (%)<input name="payer_value" type="number" min="0" max="100" step="0.01" value="${saved ?? 50}" required>`;
    } else if (mode === "exact") {
      extra.className = "";
      extra.innerHTML = `${payer}'s own share (ZAR)<input name="payer_value" type="number" min="0" step="0.01" value="${saved ?? 0}" required>`;
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
      type: this._editing ? "fundsplit/update_expense" : "fundsplit/add_expense",
      ...(this._editing ? { item_id: this._editing.item.id } : {}),
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
    if (await this._call(msg)) { this._showForm = false; this._prefill = null; this._editing = null; }
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
      this._prefill = this._editing ? { ...this._prefill, ...draft } : draft;
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
