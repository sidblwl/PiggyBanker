/* BudgetSplit — Vanilla JS prototype
   - Simple in-memory state + localStorage persistence
   - 4 screens: overview, goals, expenses, goal detail
   - Pie chart via canvas
*/

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ---------- Utils ---------- */
const money = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(n || 0)
  );

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const pct = (saved, target) => {
  const t = Number(target || 0);
  if (t <= 0) return 0;
  return clamp(Math.round((Number(saved || 0) / t) * 100), 0, 999);
};

const uid = () => Math.random().toString(36).slice(2, 10);

const todayISO = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const load = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};
const save = (key, val) => localStorage.setItem(key, JSON.stringify(val));

/* ---------- State ---------- */
const DEFAULT_STATE = {
  accounts: [
    { id: "acc_checking", name: "Checking", balance: 1420.15, subtitle: "Auto linked • main" },
    { id: "acc_savings", name: "Savings", balance: 860.0, subtitle: "Auto linked • reserve" },
  ],
  categories: [
    { id: "cat_groceries", name: "Groceries" },
    { id: "cat_food", name: "Food" },
    { id: "cat_transport", name: "Transport" },
    { id: "cat_fun", name: "Fun" },
    { id: "cat_bills", name: "Bills" },
    { id: "cat_other", name: "Other" },
  ],
  goals: [
    { id: "g_tv", name: "TV", emoji: "📺", color: "#5B8CFF", target: 200, saved: 100, notes: "" },
    { id: "g_car", name: "Car", emoji: "🚗", color: "#2EE59D", target: 3000, saved: 240, notes: "" },
  ],
  transactions: [
    { id: uid(), name: "Target", amount: 24.99, categoryId: "cat_groceries", accountId: "acc_checking", date: todayISO() },
    { id: uid(), name: "Chipotle", amount: 12.65, categoryId: "cat_food", accountId: "acc_checking", date: todayISO() },
    { id: uid(), name: "Metro", amount: 2.0, categoryId: "cat_transport", accountId: "acc_checking", date: todayISO() },
  ],
  contributions: [
    { id: uid(), goalId: "g_tv", amount: 15, date: todayISO() },
    { id: uid(), goalId: "g_tv", amount: 10, date: todayISO() },
    { id: uid(), goalId: "g_car", amount: 25, date: todayISO() },
  ],
  ui: {
    route: "overview",
    activeGoalId: null,
    search: "",
    txFilter: "all",
  },
};

let state = load("budgetsplit_state_v1", DEFAULT_STATE);
function persist() {
  save("budgetsplit_state_v1", state);
}

/* ---------- Routing ---------- */
const ROUTES = ["overview", "goals", "expenses", "goal-detail"];

function setRoute(route, payload = {}) {
  if (!ROUTES.includes(route)) route = "overview";

  state.ui.route = route;
  if (payload.activeGoalId !== undefined) state.ui.activeGoalId = payload.activeGoalId;

  // pages
  $$(".page").forEach((p) => p.classList.add("hidden"));
  const pageId =
    route === "goal-detail" ? "#page-goal-detail" : `#page-${route}`;
  $(pageId).classList.remove("hidden");

  // tabs + sidebar nav
  $$(".tab").forEach((b) => b.classList.toggle("active", b.dataset.route === route || (route === "goal-detail" && b.dataset.route === "goals")));
  $$(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.route === route || (route === "goal-detail" && b.dataset.route === "goals")));

  closeSidebar();
  persist();
  render();
}

/* ---------- Sidebar ---------- */
const sidebar = $("#sidebar");
const backdrop = $("#backdrop");

function openSidebar() {
  sidebar.classList.add("open");
  backdrop.classList.add("show");
  sidebar.setAttribute("aria-hidden", "false");
}
function closeSidebar() {
  sidebar.classList.remove("open");
  backdrop.classList.remove("show");
  sidebar.setAttribute("aria-hidden", "true");
}

$("#btnMenu").addEventListener("click", openSidebar);
$("#btnCloseSidebar").addEventListener("click", closeSidebar);
backdrop.addEventListener("click", closeSidebar);

$$(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => setRoute(btn.dataset.route));
});
$$(".tab").forEach((btn) => {
  btn.addEventListener("click", () => setRoute(btn.dataset.route));
});

/* ---------- Overview actions ---------- */
$("#btnGoGoals").addEventListener("click", () => setRoute("goals"));
$("#btnGoExpenses").addEventListener("click", () => setRoute("expenses"));

$("#btnClearSearch").addEventListener("click", () => {
  state.ui.search = "";
  $("#overviewSearch").value = "";
  persist();
  render();
});

$("#overviewSearch").addEventListener("input", (e) => {
  state.ui.search = e.target.value || "";
  persist();
  render();
});

/* ---------- Goals modal ---------- */
const goalModal = $("#goalModal");
$("#btnAddGoal").addEventListener("click", () => {
  $("#newGoalName").value = "";
  $("#newGoalTarget").value = "";
  $("#newGoalSaved").value = "";
  $("#newGoalEmoji").value = "";
  $("#newGoalColor").value = "#5B8CFF";
  goalModal.showModal();
});

$("#goalModalForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("#newGoalName").value.trim();
  const target = Number($("#newGoalTarget").value);
  const savedAmt = Number($("#newGoalSaved").value || 0);
  const color = $("#newGoalColor").value || "#5B8CFF";
  const emoji = ($("#newGoalEmoji").value || "🎯").trim().slice(0, 2) || "🎯";

  if (!name || !(target > 0)) return;

  state.goals.unshift({
    id: `g_${uid()}`,
    name,
    emoji,
    color,
    target,
    saved: clamp(savedAmt, 0, target),
    notes: "",
  });

  persist();
  goalModal.close();
  render();
});

/* ---------- Expenses form ---------- */
$("#txForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("#txName").value.trim();
  const amount = Number($("#txAmount").value);
  const categoryId = $("#txCategory").value;
  const accountId = $("#txAccount").value;
  const date = $("#txDate").value;

  if (!name || !(amount > 0) || !date) return;

  state.transactions.unshift({
    id: uid(),
    name,
    amount,
    categoryId,
    accountId,
    date,
  });

  // deduct from account balance (simple model)
  const acc = state.accounts.find((a) => a.id === accountId);
  if (acc) acc.balance = Number(acc.balance) - amount;

  $("#txName").value = "";
  $("#txAmount").value = "";
  $("#txDate").value = todayISO();

  persist();
  render();
});

$("#btnClearTx").addEventListener("click", () => {
  // reset to empty transactions for prototype
  state.transactions = [];
  persist();
  render();
});

$("#txFilter").addEventListener("change", (e) => {
  state.ui.txFilter = e.target.value;
  persist();
  render();
});

/* ---------- Goal detail ---------- */
$("#btnBackToGoals").addEventListener("click", () => setRoute("goals"));

$("#contribForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const goalId = state.ui.activeGoalId;
  const amt = Number($("#contribAmount").value);
  if (!goalId || !(amt > 0)) return;

  const goal = state.goals.find((g) => g.id === goalId);
  if (!goal) return;

  goal.saved = clamp(Number(goal.saved) + amt, 0, goal.target);

  // also reduce checking balance to simulate “contribute from checking”
  const checking = state.accounts.find((a) => a.id === "acc_checking");
  if (checking) checking.balance = Number(checking.balance) - amt;

  state.contributions.unshift({ id: uid(), goalId, amount: amt, date: todayISO() });
  $("#contribAmount").value = "";

  persist();
  render();
});

$("#btnSaveNotes").addEventListener("click", () => {
  const goalId = state.ui.activeGoalId;
  const goal = state.goals.find((g) => g.id === goalId);
  if (!goal) return;
  goal.notes = $("#goalNotes").value || "";
  persist();
  render();
});

/* ---------- Render helpers ---------- */
function renderOverview() {
  const checking = state.accounts.find((a) => a.id === "acc_checking")?.balance ?? 0;
  const savings = state.accounts.find((a) => a.id === "acc_savings")?.balance ?? 0;

  $("#statChecking").textContent = money(checking);
  $("#statSavings").textContent = money(savings);

  const goalContribTotal = state.contributions.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  $("#statGoalContrib").textContent = money(goalContribTotal);

  // left to spend = checking minus (optional) upcoming logic; for now show checking
  $("#statLeftToSpend").textContent = money(checking);

  // Top goals mini list (respect search)
  const q = (state.ui.search || "").toLowerCase().trim();

  const goals = state.goals
    .filter((g) => !q || g.name.toLowerCase().includes(q))
    .slice(0, 3);

  const mini = $("#miniGoalsList");
  mini.innerHTML = "";

  if (goals.length === 0) {
    mini.innerHTML = `<div class="muted small">No matches. Try a different search.</div>`;
  } else {
    goals.forEach((g) => {
      const p = pct(g.saved, g.target);
      const row = document.createElement("div");
      row.className = "mini-item";
      row.innerHTML = `
        <div class="mini-left">
          <div class="goal-emoji" style="border-color: rgba(255,255,255,0.12); background: rgba(255,255,255,0.04)">${g.emoji || "🎯"}</div>
          <div>
            <div class="mini-name">${escapeHtml(g.name)}</div>
            <div class="mini-sub">${money(g.saved)} / ${money(g.target)}</div>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
          <div class="goal-percent">${p}%</div>
          <div class="mini-bar"><div style="width:${clamp(p, 0, 100)}%; background: linear-gradient(90deg, ${g.color || "var(--accent)"}, #9B6BFF)"></div></div>
        </div>
      `;
      row.addEventListener("click", () => setRoute("goal-detail", { activeGoalId: g.id }));
      mini.appendChild(row);
    });
  }

  // Recent activity list (transactions filtered by search)
  const recentTx = state.transactions
    .filter((t) => {
      if (!q) return true;
      const cat = state.categories.find((c) => c.id === t.categoryId)?.name || "";
      return (
        t.name.toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q)
      );
    })
    .slice(0, 5);

  const recent = $("#recentTxList");
  recent.innerHTML = "";
  if (recentTx.length === 0) {
    recent.innerHTML = `<div class="muted small">No recent transactions yet.</div>`;
  } else {
    recentTx.forEach((t) => recent.appendChild(txRow(t)));
  }
}

function renderGoals() {
  const list = $("#goalsList");
  list.innerHTML = "";

  const q = (state.ui.search || "").toLowerCase().trim();
  const goals = state.goals.filter((g) => !q || g.name.toLowerCase().includes(q));

  if (goals.length === 0) {
    list.innerHTML = `<div class="muted small">No goals found. Add one with “+ Add goal”.</div>`;
    return;
  }

  goals.forEach((g) => {
    const p = pct(g.saved, g.target);
    const card = document.createElement("div");
    card.className = "goal-card";
    card.innerHTML = `
      <div class="goal-top">
        <div class="goal-left">
          <div class="goal-emoji" style="background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.12)">${g.emoji || "🎯"}</div>
          <div style="min-width:0;">
            <div class="goal-name">${escapeHtml(g.name)}</div>
            <div class="goal-meta">Goal: ${money(g.target)} • Saved: ${money(g.saved)}</div>
          </div>
        </div>
        <div class="goal-actions">
          <div class="goal-percent">${p}%</div>
          <div class="goal-expand" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M9 18l6-6-6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
      </div>
      <div class="progress">
        <div class="progress-fill" style="width:${clamp(p, 0, 100)}%; background: linear-gradient(90deg, ${g.color || "var(--accent)"}, var(--good));"></div>
      </div>
      <div class="row between" style="margin-top:10px;">
        <div class="muted small">${money(g.saved)} / ${money(g.target)}</div>
        <div class="muted small">${money(Math.max(0, g.target - g.saved))} remaining</div>
      </div>
    `;
    card.addEventListener("click", () => setRoute("goal-detail", { activeGoalId: g.id }));
    list.appendChild(card);
  });
}

function renderExpenses() {
  // Accounts
  const accWrap = $("#accountsList");
  accWrap.innerHTML = "";
  state.accounts.forEach((a) => {
    const el = document.createElement("div");
    el.className = "account";
    el.innerHTML = `
      <div class="account-left">
        <div class="account-name">${escapeHtml(a.name)}</div>
        <div class="account-sub">${escapeHtml(a.subtitle || "")}</div>
      </div>
      <div class="account-balance">${money(a.balance)}</div>
    `;
    accWrap.appendChild(el);
  });

  // Fill selects
  const catSel = $("#txCategory");
  const accSel = $("#txAccount");
  const filterSel = $("#txFilter");

  // category select options
  catSel.innerHTML = state.categories
    .map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
    .join("");

  // account select options
  accSel.innerHTML = state.accounts
    .map((a) => `<option value="${a.id}">${escapeHtml(a.name)}</option>`)
    .join("");

  // filter options
  const filterOpts = [
    `<option value="all">All categories</option>`,
    ...state.categories.map(
      (c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`
    ),
  ];
  filterSel.innerHTML = filterOpts.join("");
  filterSel.value = state.ui.txFilter || "all";

  // default date
  if (!$("#txDate").value) $("#txDate").value = todayISO();

  // transactions list
  const txWrap = $("#txList");
  txWrap.innerHTML = "";

  const filter = state.ui.txFilter || "all";
  const tx = state.transactions.filter((t) => filter === "all" || t.categoryId === filter);

  if (tx.length === 0) {
    txWrap.innerHTML = `<div class="muted small">No transactions yet. Add one above.</div>`;
  } else {
    tx.forEach((t) => txWrap.appendChild(txRow(t)));
  }

  // chart
  renderPieChart();
}

function renderGoalDetail() {
  const goalId = state.ui.activeGoalId;
  const goal = state.goals.find((g) => g.id === goalId);

  if (!goal) {
    // fallback
    setRoute("goals");
    return;
  }

  const p = pct(goal.saved, goal.target);
  $("#goalTitle").textContent = "Goal Progress";
  $("#goalSubtitle").textContent = "Track your progress and contribute.";
  $("#goalBigName").textContent = `${goal.emoji || "🎯"} ${goal.name}`;
  $("#goalBigMeta").textContent = `Goal: ${money(goal.target)}`;
  $("#goalPct").textContent = `${p}%`;

  $("#goalBigProgress").style.width = `${clamp(p, 0, 100)}%`;
  $("#goalBigProgress").style.background = `linear-gradient(90deg, ${goal.color || "var(--accent)"}, var(--good))`;

  $("#goalBigNumbers").textContent = `${money(goal.saved)} / ${money(goal.target)}`;
  $("#goalBigRemaining").textContent = `${money(Math.max(0, goal.target - goal.saved))} remaining`;

  $("#goalNotes").value = goal.notes || "";

  // contributions list
  const contribWrap = $("#goalContribList");
  contribWrap.innerHTML = "";

  const contribs = state.contributions.filter((c) => c.goalId === goalId).slice(0, 10);

  if (contribs.length === 0) {
    contribWrap.innerHTML = `<div class="muted small">No contributions yet. Add one above.</div>`;
  } else {
    contribs.forEach((c) => {
      const row = document.createElement("div");
      row.className = "tx";
      row.innerHTML = `
        <div class="tx-left">
          <div class="tx-title">Contribution</div>
          <div class="tx-sub">${escapeHtml(c.date)}</div>
        </div>
        <div class="tx-right">
          <div class="tx-amt">${money(c.amount)}</div>
          <div class="tx-tag">${escapeHtml(goal.name)}</div>
        </div>
      `;
      contribWrap.appendChild(row);
    });
  }
}

function txRow(t) {
  const cat = state.categories.find((c) => c.id === t.categoryId)?.name || "—";
  const acc = state.accounts.find((a) => a.id === t.accountId)?.name || "—";

  const row = document.createElement("div");
  row.className = "tx";
  row.innerHTML = `
    <div class="tx-left">
      <div class="tx-title">${escapeHtml(t.name)}</div>
      <div class="tx-sub">${escapeHtml(cat)} • ${escapeHtml(acc)} • ${escapeHtml(t.date)}</div>
    </div>
    <div class="tx-right">
      <div class="tx-amt">-${money(t.amount)}</div>
      <div class="tx-tag">${escapeHtml(cat)}</div>
    </div>
  `;
  return row;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ---------- Pie chart (canvas) ---------- */
function renderPieChart() {
  const canvas = $("#pieChart");
  const ctx = canvas.getContext("2d");

  // Gather totals by category from transactions
  const totals = new Map();
  state.categories.forEach((c) => totals.set(c.id, 0));

  state.transactions.forEach((t) => {
    totals.set(t.categoryId, (totals.get(t.categoryId) || 0) + Number(t.amount || 0));
  });

  const data = state.categories
    .map((c, i) => ({
      id: c.id,
      name: c.name,
      value: totals.get(c.id) || 0,
      color: pseudoColor(i),
    }))
    .filter((d) => d.value > 0);

  // Clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Empty state
  if (data.length === 0) {
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = "700 14px ui-sans-serif, system-ui";
    ctx.fillText("No spending yet — add a transaction.", 18, 36);
    ctx.restore();
    $("#pieLegend").innerHTML = `<div class="muted small">Legend will appear once you add spending.</div>`;
    return;
  }

  const totalSum = data.reduce((s, d) => s + d.value, 0);

  const cx = canvas.width * 0.36;
  const cy = canvas.height * 0.52;
  const r = Math.min(canvas.width, canvas.height) * 0.33;

  let start = -Math.PI / 2;

  // Soft background ring
  ctx.beginPath();
  ctx.arc(cx, cy, r + 10, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 16;
  ctx.stroke();

  // Draw slices
  data.forEach((d) => {
    const angle = (d.value / totalSum) * Math.PI * 2;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, start + angle);
    ctx.closePath();

    ctx.fillStyle = d.color;
    ctx.fill();

    // slice border
    ctx.strokeStyle = "rgba(11,16,32,0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();

    start += angle;
  });

  // Center label
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "800 16px ui-sans-serif, system-ui";
  ctx.fillText("Total", cx - 18, cy - 6);
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = "800 18px ui-sans-serif, system-ui";
  ctx.fillText(money(totalSum), cx - 48, cy + 18);
  ctx.restore();

  // Legend
  const legend = $("#pieLegend");
  legend.innerHTML = "";
  data
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
    .forEach((d) => {
      const el = document.createElement("div");
      el.className = "legend-item";
      el.innerHTML = `
        <div class="legend-left">
          <div class="legend-swatch" style="background:${d.color}"></div>
          <div class="legend-name">${escapeHtml(d.name)}</div>
        </div>
        <div class="legend-val">${money(d.value)}</div>
      `;
      legend.appendChild(el);
    });
}

function pseudoColor(i) {
  // deterministic colors (no external libs)
  const palette = [
    "rgba(91,140,255,0.95)",
    "rgba(46,229,157,0.92)",
    "rgba(255,176,32,0.92)",
    "rgba(155,107,255,0.92)",
    "rgba(255,91,110,0.90)",
    "rgba(88,223,255,0.90)",
    "rgba(255,140,200,0.88)",
    "rgba(180,255,110,0.88)",
  ];
  return palette[i % palette.length];
}

/* ---------- Main render ---------- */
function render() {
  const route = state.ui.route;

  // Always keep overview search input in sync
  $("#overviewSearch").value = state.ui.search || "";

  renderOverview();

  if (route === "goals") renderGoals();
  if (route === "expenses") renderExpenses();
  if (route === "goal-detail") renderGoalDetail();

  // Also refresh goals mini list, even when elsewhere (feels “real app”)
  if (route !== "goals") {
    // no-op; overview already handles mini list
  }
}

/* ---------- Init ---------- */
function init() {
  // Set default date in tx form
  $("#txDate").value = todayISO();

  // Wire sidebar nav routes
  // already wired

  // On first load, render proper route
  setRoute(state.ui.route || "overview");
  render();
}

init();