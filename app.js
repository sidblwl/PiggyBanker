/* PiggyBanker — Vanilla JS prototype */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const TX_PAGE_SIZE = 3;
const GOAL_PAGE_SIZE = 3;
const RECENT_PAGE_SIZE = 1;

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
    {
      id: "acc_checking",
      name: "Checking",
      balance: 1420.15,
      subtitle: "Manual balance",
    },
    {
      id: "acc_savings",
      name: "Savings",
      balance: 860.0,
      subtitle: "Manual balance",
    },
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
    {
      id: "g_tv",
      name: "TV",
      emoji: "📺",
      color: "#4F46E5",
      target: 200,
      saved: 100,
      notes: "",
    },
    {
      id: "g_car",
      name: "Car",
      emoji: "🚗",
      color: "#047857",
      target: 3000,
      saved: 240,
      notes: "",
    },
  ],
  transactions: [
    {
      id: uid(),
      name: "Target",
      amount: 24.99,
      categoryId: "cat_groceries",
      accountId: "acc_checking",
      date: todayISO(),
    },
    {
      id: uid(),
      name: "Chipotle",
      amount: 12.65,
      categoryId: "cat_food",
      accountId: "acc_checking",
      date: todayISO(),
    },
    {
      id: uid(),
      name: "Metro",
      amount: 2.0,
      categoryId: "cat_transport",
      accountId: "acc_checking",
      date: todayISO(),
    },
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
    editingTxId: null,
    txPage: 0,
    goalPage: 0,
    recentPage: 0,
  },
};

let state = load("budgetsplit_state_v2", DEFAULT_STATE);

state.accounts = (state.accounts || DEFAULT_STATE.accounts).map((a) => ({
  ...a,
  subtitle: "Manual balance",
}));

if (!state.ui) state.ui = DEFAULT_STATE.ui;
if (state.ui.editingTxId === undefined) state.ui.editingTxId = null;
if (state.ui.txPage === undefined) state.ui.txPage = 0;
if (state.ui.goalPage === undefined) state.ui.goalPage = 0;
if (state.ui.recentPage === undefined) state.ui.recentPage = 0;

function persist() {
  save("budgetsplit_state_v2", state);
}

/* ---------- Routing ---------- */
const ROUTES = ["overview", "goals", "expenses", "goal-detail"];

function setRoute(route, payload = {}) {
  if (!ROUTES.includes(route)) route = "overview";

  state.ui.route = route;

  if (payload.activeGoalId !== undefined) {
    state.ui.activeGoalId = payload.activeGoalId;
  }

  $$(".page").forEach((p) => p.classList.add("hidden"));

  const pageId =
    route === "goal-detail" ? "#page-goal-detail" : `#page-${route}`;

  $(pageId).classList.remove("hidden");

  $$(".tab").forEach((b) =>
    b.classList.toggle(
      "active",
      b.dataset.route === route ||
        (route === "goal-detail" && b.dataset.route === "goals")
    )
  );

  $$(".nav-item").forEach((b) =>
    b.classList.toggle(
      "active",
      b.dataset.route === route ||
        (route === "goal-detail" && b.dataset.route === "goals")
    )
  );

  closeSidebar();
  hideKeyboard();
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
$("#btnClearSearch").addEventListener("click", () => {
  state.ui.search = "";
  state.ui.goalPage = 0;
  state.ui.recentPage = 0;
  $("#overviewSearch").value = "";
  persist();
  render();
});

$("#overviewSearch").addEventListener("input", (e) => {
  state.ui.search = e.target.value || "";
  state.ui.goalPage = 0;
  state.ui.recentPage = 0;
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
  $("#newGoalColor").value = "#4F46E5";
  goalModal.showModal();
});

$("#goalModalForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const name = $("#newGoalName").value.trim();
  const target = Number($("#newGoalTarget").value);
  const savedAmt = Number($("#newGoalSaved").value || 0);
  const color = $("#newGoalColor").value || "#4F46E5";
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

  state.ui.goalPage = 0;

  persist();
  goalModal.close();
  hideKeyboard();
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

  const editingId = state.ui.editingTxId;

  if (editingId) {
    const tx = state.transactions.find((t) => t.id === editingId);

    if (tx) {
      const oldAccount = state.accounts.find((a) => a.id === tx.accountId);
      const newAccount = state.accounts.find((a) => a.id === accountId);

      if (oldAccount) {
        oldAccount.balance = Number(oldAccount.balance) + Number(tx.amount || 0);
      }

      if (newAccount) {
        newAccount.balance = Number(newAccount.balance) - amount;
      }

      tx.name = name;
      tx.amount = amount;
      tx.categoryId = categoryId;
      tx.accountId = accountId;
      tx.date = date;
    }

    state.ui.editingTxId = null;
  } else {
    state.transactions.unshift({
      id: uid(),
      name,
      amount,
      categoryId,
      accountId,
      date,
    });

    const acc = state.accounts.find((a) => a.id === accountId);

    if (acc) {
      acc.balance = Number(acc.balance) - amount;
    }
  }

  state.ui.txPage = 0;
  state.ui.recentPage = 0;
  resetTxForm();
  persist();
  render();

  if ($("#txModal").open) {
    renderTransactionPopup();
  }
});

$("#btnCancelEdit").addEventListener("click", () => {
  state.ui.editingTxId = null;
  resetTxForm();
  persist();
  render();
});

$("#btnClearTx").addEventListener("click", () => {
  state.ui.txFilter = "all";
  state.ui.txPage = 0;
  persist();
  render();

  if ($("#txModal").open) {
    renderTransactionPopup();
  }
});

$("#txFilter").addEventListener("change", (e) => {
  state.ui.txFilter = e.target.value;
  state.ui.txPage = 0;
  persist();
  render();

  if ($("#txModal").open) {
    renderTransactionPopup();
  }
});

function resetTxForm() {
  $("#txName").value = "";
  $("#txAmount").value = "";
  $("#txDate").value = todayISO();
  $("#txFormTitle").textContent = "Add transaction";
  $("#txSubmitBtn").textContent = "Add";
  $("#btnCancelEdit").classList.add("hidden");
}

function startEditTransaction(id) {
  const tx = state.transactions.find((t) => t.id === id);

  if (!tx) return;

  state.ui.editingTxId = id;

  $("#txName").value = tx.name;
  $("#txAmount").value = tx.amount;
  $("#txCategory").value = tx.categoryId;
  $("#txAccount").value = tx.accountId;
  $("#txDate").value = tx.date;
  $("#txFormTitle").textContent = "Edit transaction";
  $("#txSubmitBtn").textContent = "Update";
  $("#btnCancelEdit").classList.remove("hidden");

  $("#txModal").close();

  persist();
  render();
}

function deleteTransaction(id) {
  const tx = state.transactions.find((t) => t.id === id);

  if (!tx) return;

  const acc = state.accounts.find((a) => a.id === tx.accountId);

  if (acc) {
    acc.balance = Number(acc.balance) + Number(tx.amount || 0);
  }

  state.transactions = state.transactions.filter((t) => t.id !== id);

  if (state.ui.editingTxId === id) {
    state.ui.editingTxId = null;
    resetTxForm();
  }

  const matchingTx = getFilteredTransactions();
  const maxPage = Math.max(0, Math.ceil(matchingTx.length / TX_PAGE_SIZE) - 1);
  state.ui.txPage = clamp(state.ui.txPage, 0, maxPage);

  state.ui.recentPage = 0;

  persist();
  render();

  if ($("#txModal").open) {
    renderTransactionPopup();
  }
}

/* ---------- Transaction popup ---------- */
const txModal = $("#txModal");

$("#btnOpenTxPopup").addEventListener("click", () => {
  state.ui.txPage = 0;
  persist();
  renderTransactionPopup();
  txModal.showModal();
});

$("#btnCloseTxPopup").addEventListener("click", () => {
  txModal.close();
});

$("#btnPrevTxPage").addEventListener("click", () => {
  if (state.ui.txPage > 0) {
    state.ui.txPage--;
    persist();
    renderTransactionPopup();
  }
});

$("#btnNextTxPage").addEventListener("click", () => {
  const matchingTx = getFilteredTransactions();
  const maxPage = Math.max(0, Math.ceil(matchingTx.length / TX_PAGE_SIZE) - 1);

  if (state.ui.txPage < maxPage) {
    state.ui.txPage++;
    persist();
    renderTransactionPopup();
  }
});

function getFilteredTransactions() {
  const filter = state.ui.txFilter || "all";

  return state.transactions.filter(
    (t) => filter === "all" || t.categoryId === filter
  );
}

function renderTransactionPopup() {
  const txWrap = $("#txPopupList");
  const matchingTx = getFilteredTransactions();

  const maxPage = Math.max(0, Math.ceil(matchingTx.length / TX_PAGE_SIZE) - 1);
  state.ui.txPage = clamp(state.ui.txPage || 0, 0, maxPage);

  const start = state.ui.txPage * TX_PAGE_SIZE;
  const end = start + TX_PAGE_SIZE;
  const visibleTx = matchingTx.slice(start, end);

  txWrap.innerHTML = "";

  if (visibleTx.length === 0) {
    txWrap.innerHTML = `<div class="muted small">No transactions match this filter.</div>`;
    $("#txPopupInfo").textContent = "No matching transactions";
  } else {
    visibleTx.forEach((t) => txWrap.appendChild(txRow(t, { actions: true })));

    $("#txPopupInfo").textContent = `Showing ${start + 1}-${Math.min(
      end,
      matchingTx.length
    )} of ${matchingTx.length}`;
  }

  $("#txPageLabel").textContent = `Page ${state.ui.txPage + 1} of ${
    maxPage + 1
  }`;

  $("#btnPrevTxPage").disabled = state.ui.txPage === 0;
  $("#btnNextTxPage").disabled = state.ui.txPage === maxPage;

  persist();
}

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

  const checking = state.accounts.find((a) => a.id === "acc_checking");

  if (checking) {
    checking.balance = Number(checking.balance) - amt;
  }

  state.contributions.unshift({
    id: uid(),
    goalId,
    amount: amt,
    date: todayISO(),
  });

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
  const checking =
    state.accounts.find((a) => a.id === "acc_checking")?.balance ?? 0;

  const savings =
    state.accounts.find((a) => a.id === "acc_savings")?.balance ?? 0;

  $("#statChecking").textContent = money(checking);
  $("#statSavings").textContent = money(savings);

  const goalContribTotal = state.contributions.reduce(
    (sum, c) => sum + Number(c.amount || 0),
    0
  );

  $("#statGoalContrib").textContent = money(goalContribTotal);
  $("#statLeftToSpend").textContent = money(checking);

  const q = (state.ui.search || "").toLowerCase().trim();

  const goals = state.goals
    .filter((g) => !q || g.name.toLowerCase().includes(q))
    .slice(0, 2);

  const mini = $("#miniGoalsList");
  mini.innerHTML = "";

  if (goals.length === 0) {
    mini.innerHTML = `<div class="muted small">No matches. Use the Goals tab to add one.</div>`;
  } else {
    goals.forEach((g) => {
      const p = pct(g.saved, g.target);
      const row = document.createElement("div");

      row.className = "mini-item";

      row.innerHTML = `
        <div class="mini-left">
          <div class="goal-emoji">${g.emoji || "🎯"}</div>
          <div>
            <div class="mini-name">${escapeHtml(g.name)}</div>
            <div class="mini-sub">${money(g.saved)} / ${money(g.target)}</div>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
          <div class="goal-percent">${p}%</div>
          <div class="mini-bar">
            <div style="width:${clamp(
              p,
              0,
              100
            )}%; background: linear-gradient(90deg, ${
        g.color || "var(--accent)"
      }, #7C3AED)"></div>
          </div>
        </div>
      `;

      row.addEventListener("click", () =>
        setRoute("goal-detail", { activeGoalId: g.id })
      );

      mini.appendChild(row);
    });
  }

  const allRecentTx = state.transactions.filter((t) => {
    if (!q) return true;

    const cat =
      state.categories.find((c) => c.id === t.categoryId)?.name || "";

    return (
      t.name.toLowerCase().includes(q) ||
      cat.toLowerCase().includes(q)
    );
  });

  const maxRecentPage = Math.max(
    0,
    Math.ceil(allRecentTx.length / RECENT_PAGE_SIZE) - 1
  );

  state.ui.recentPage = clamp(state.ui.recentPage || 0, 0, maxRecentPage);

  const recentStart = state.ui.recentPage * RECENT_PAGE_SIZE;
  const recentTx = allRecentTx.slice(
    recentStart,
    recentStart + RECENT_PAGE_SIZE
  );

  const recent = $("#recentTxList");
  recent.innerHTML = "";

  $("#recentTxInfo").textContent = `Showing ${recentTx.length} of ${allRecentTx.length} transactions.`;

  if (recentTx.length === 0) {
    recent.innerHTML = `<div class="muted small">No recent transactions yet.</div>`;
  } else {
    recentTx.forEach((t) => recent.appendChild(txRow(t, { actions: false })));
  }

  const controls = document.createElement("div");
  controls.className = "row between recent-page-controls";

  controls.innerHTML = `
    <button class="pill" id="btnPrevRecentPage" type="button" ${
      state.ui.recentPage === 0 ? "disabled" : ""
    }>← Previous</button>

    <div class="muted small">
      Page ${state.ui.recentPage + 1} of ${maxRecentPage + 1}
    </div>

    <button class="pill" id="btnNextRecentPage" type="button" ${
      state.ui.recentPage === maxRecentPage ? "disabled" : ""
    }>Next →</button>
  `;

  recent.appendChild(controls);

  $("#btnPrevRecentPage").addEventListener("click", () => {
    if (state.ui.recentPage > 0) {
      state.ui.recentPage--;
      persist();
      renderOverview();
    }
  });

  $("#btnNextRecentPage").addEventListener("click", () => {
    if (state.ui.recentPage < maxRecentPage) {
      state.ui.recentPage++;
      persist();
      renderOverview();
    }
  });
}

function renderGoals() {
  const list = $("#goalsList");
  list.innerHTML = "";

  const q = (state.ui.search || "").toLowerCase().trim();

  const matchingGoals = state.goals.filter(
    (g) => !q || g.name.toLowerCase().includes(q)
  );

  const maxPage = Math.max(
    0,
    Math.ceil(matchingGoals.length / GOAL_PAGE_SIZE) - 1
  );

  state.ui.goalPage = clamp(state.ui.goalPage || 0, 0, maxPage);

  const start = state.ui.goalPage * GOAL_PAGE_SIZE;
  const visibleGoals = matchingGoals.slice(start, start + GOAL_PAGE_SIZE);

  if (visibleGoals.length === 0) {
    list.innerHTML = `<div class="muted small">No goals found. Add one with “+ Add goal”.</div>`;
    return;
  }

  visibleGoals.forEach((g) => {
    const p = pct(g.saved, g.target);
    const card = document.createElement("div");

    card.className = "goal-card";

    card.innerHTML = `
      <div class="goal-top">
        <div class="goal-left">
          <div class="goal-emoji">${g.emoji || "🎯"}</div>
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
        <div class="progress-fill" style="width:${clamp(
          p,
          0,
          100
        )}%; background: linear-gradient(90deg, ${
      g.color || "var(--accent)"
    }, var(--good));"></div>
      </div>

      <div class="row between" style="margin-top:8px;">
        <div class="muted small">${money(g.saved)} / ${money(g.target)}</div>
        <div class="muted small">${money(Math.max(0, g.target - g.saved))} remaining</div>
      </div>
    `;

    card.addEventListener("click", () =>
      setRoute("goal-detail", { activeGoalId: g.id })
    );

    list.appendChild(card);
  });

  const controls = document.createElement("div");
  controls.className = "row between goal-page-controls";

  controls.innerHTML = `
    <button class="pill" id="btnPrevGoalPage" type="button" ${
      state.ui.goalPage === 0 ? "disabled" : ""
    }>← Previous</button>

    <div class="muted small">
      Page ${state.ui.goalPage + 1} of ${maxPage + 1}
    </div>

    <button class="pill" id="btnNextGoalPage" type="button" ${
      state.ui.goalPage === maxPage ? "disabled" : ""
    }>Next →</button>
  `;

  list.appendChild(controls);

  $("#btnPrevGoalPage").addEventListener("click", () => {
    if (state.ui.goalPage > 0) {
      state.ui.goalPage--;
      persist();
      renderGoals();
    }
  });

  $("#btnNextGoalPage").addEventListener("click", () => {
    if (state.ui.goalPage < maxPage) {
      state.ui.goalPage++;
      persist();
      renderGoals();
    }
  });
}

function renderExpenses() {
  const accWrap = $("#accountsList");
  accWrap.innerHTML = "";

  state.accounts.forEach((a) => {
    const el = document.createElement("div");

    el.className = "account";

    el.innerHTML = `
      <div class="account-left">
        <div class="account-name">${escapeHtml(a.name)}</div>
        <div class="account-sub">${escapeHtml(a.subtitle || "Manual balance")}</div>
      </div>
      <div class="account-balance">${money(a.balance)}</div>
    `;

    accWrap.appendChild(el);
  });

  const catSel = $("#txCategory");
  const accSel = $("#txAccount");
  const filterSel = $("#txFilter");

  catSel.innerHTML = state.categories
    .map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
    .join("");

  accSel.innerHTML = state.accounts
    .map((a) => `<option value="${a.id}">${escapeHtml(a.name)}</option>`)
    .join("");

  const filterOpts = [
    `<option value="all">All categories</option>`,
    ...state.categories.map(
      (c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`
    ),
  ];

  filterSel.innerHTML = filterOpts.join("");
  filterSel.value = state.ui.txFilter || "all";

  if (!$("#txDate").value) {
    $("#txDate").value = todayISO();
  }

  if (state.ui.editingTxId) {
    $("#txFormTitle").textContent = "Edit transaction";
    $("#txSubmitBtn").textContent = "Update";
    $("#btnCancelEdit").classList.remove("hidden");
  } else {
    $("#txFormTitle").textContent = "Add transaction";
    $("#txSubmitBtn").textContent = "Add";
    $("#btnCancelEdit").classList.add("hidden");
  }

  const matchingTx = getFilteredTransactions();

  $("#txListInfo").textContent =
    matchingTx.length === 1
      ? "1 transaction matches the current filter."
      : `${matchingTx.length} transactions match the current filter.`;

  renderPieChart(matchingTx);

  if ($("#txModal").open) {
    renderTransactionPopup();
  }
}

function renderGoalDetail() {
  const goalId = state.ui.activeGoalId;
  const goal = state.goals.find((g) => g.id === goalId);

  if (!goal) {
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

  $("#goalBigProgress").style.background = `linear-gradient(90deg, ${
    goal.color || "var(--accent)"
  }, var(--good))`;

  $("#goalBigNumbers").textContent = `${money(goal.saved)} / ${money(
    goal.target
  )}`;

  $("#goalBigRemaining").textContent = `${money(
    Math.max(0, goal.target - goal.saved)
  )} remaining`;

  $("#goalNotes").value = goal.notes || "";

  const contribWrap = $("#goalContribList");
  contribWrap.innerHTML = "";

  const contribs = state.contributions
    .filter((c) => c.goalId === goalId)
    .slice(0, 4);

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

function txRow(t, options = { actions: true }) {
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
      ${
        options.actions
          ? `<div class="tx-actions">
              <button class="tx-action edit" type="button" data-edit="${escapeHtml(
                t.id
              )}">Edit</button>
              <button class="tx-action delete" type="button" data-delete="${escapeHtml(
                t.id
              )}">Delete</button>
            </div>`
          : ""
      }
    </div>
  `;

  if (options.actions) {
    row.querySelector("[data-edit]").addEventListener("click", (e) => {
      e.stopPropagation();
      startEditTransaction(t.id);
    });

    row.querySelector("[data-delete]").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteTransaction(t.id);
    });
  }

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

/* ---------- Pie chart ---------- */
function renderPieChart(sourceTransactions = state.transactions) {
  const canvas = $("#pieChart");
  const ctx = canvas.getContext("2d");

  const totals = new Map();

  state.categories.forEach((c) => totals.set(c.id, 0));

  sourceTransactions.forEach((t) => {
    totals.set(
      t.categoryId,
      (totals.get(t.categoryId) || 0) + Number(t.amount || 0)
    );
  });

  const data = state.categories
    .map((c, i) => ({
      id: c.id,
      name: c.name,
      value: totals.get(c.id) || 0,
      color: pseudoColor(i),
    }))
    .filter((d) => d.value > 0);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (data.length === 0) {
    ctx.save();
    ctx.fillStyle = "#475569";
    ctx.font = "800 16px ui-sans-serif, system-ui";
    ctx.fillText("No spending yet — add a transaction.", 18, 36);
    ctx.restore();

    $("#pieLegend").innerHTML = `<div class="muted small">Legend will appear once you add spending.</div>`;

    return;
  }

  const totalSum = data.reduce((s, d) => s + d.value, 0);

  const cx = canvas.width * 0.36;
  const cy = canvas.height * 0.52;
  const r = Math.min(canvas.width, canvas.height) * 0.31;

  let start = -Math.PI / 2;

  ctx.beginPath();
  ctx.arc(cx, cy, r + 9, 0, Math.PI * 2);
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 16;
  ctx.stroke();

  data.forEach((d) => {
    const angle = (d.value / totalSum) * Math.PI * 2;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, start + angle);
    ctx.closePath();

    ctx.fillStyle = d.color;
    ctx.fill();

    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.stroke();

    start += angle;
  });

  ctx.save();
  ctx.fillStyle = "#0F172A";
  ctx.font = "850 16px ui-sans-serif, system-ui";
  ctx.fillText("Total", cx - 18, cy - 6);

  ctx.fillStyle = "#475569";
  ctx.font = "850 18px ui-sans-serif, system-ui";
  ctx.fillText(money(totalSum), cx - 48, cy + 18);
  ctx.restore();

  const legend = $("#pieLegend");
  legend.innerHTML = "";

  data
    .sort((a, b) => b.value - a.value)
    .slice(0, 4)
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
  const palette = [
    "#4F46E5",
    "#047857",
    "#B45309",
    "#7C3AED",
    "#DC2626",
    "#0369A1",
    "#BE185D",
    "#4D7C0F",
  ];

  return palette[i % palette.length];
}

/* ---------- On-screen keyboard ---------- */
let activeKeyboardInput = null;

const keyboard = $("#keyboard");
const keyboardKeys = $("#keyboardKeys");
const keyboardLabel = $("#keyboardLabel");

function showKeyboardFor(input) {
  activeKeyboardInput = input;

  const openModal = document.querySelector("dialog[open] .modal-inner");

  if (openModal && !openModal.contains(keyboard)) {
    openModal.appendChild(keyboard);
    keyboard.classList.add("keyboard-in-modal");
  }

  if (!openModal && keyboard.classList.contains("keyboard-in-modal")) {
    document.body.appendChild(keyboard);
    keyboard.classList.remove("keyboard-in-modal");
  }

  const mode = input.dataset.keyboard || "text";

  keyboard.classList.remove("hidden");

  keyboardLabel.textContent =
    mode === "number" ? "Numeric keyboard" : "Text keyboard";

  const keys =
    mode === "number"
      ? ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", ".", "⌫", "Clear", "Done"]
      : [
          "Q", "W", "E", "R", "T", "Y",
          "A", "S", "D", "F", "G", "H",
          "J", "K", "L", "⌫",
          "Space", "Clear", "Done"
        ];

  keyboardKeys.innerHTML = "";

  keys.forEach((key) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "key";
    btn.textContent = key;

    if (key === "Space" || key === "Clear" || key === "Done") {
      btn.classList.add("wide");
    }

    if (key === "Done") {
      btn.classList.add("accent");
    }

    btn.addEventListener("click", () => handleKey(key));
    keyboardKeys.appendChild(btn);
  });
}

function handleKey(key) {
  if (!activeKeyboardInput) return;

  if (key === "Done") {
    hideKeyboard();
    return;
  }

  if (key === "Clear") {
    activeKeyboardInput.value = "";
    activeKeyboardInput.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  if (key === "⌫") {
    activeKeyboardInput.value = activeKeyboardInput.value.slice(0, -1);
    activeKeyboardInput.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  const value = key === "Space" ? " " : key;

  activeKeyboardInput.value += value;
  activeKeyboardInput.dispatchEvent(new Event("input", { bubbles: true }));
}

function hideKeyboard() {
  keyboard.classList.add("hidden");
  activeKeyboardInput = null;

  if (keyboard.classList.contains("keyboard-in-modal")) {
    document.body.appendChild(keyboard);
    keyboard.classList.remove("keyboard-in-modal");
  }
}

document.addEventListener("focusin", (e) => {
  if (e.target.matches("[data-keyboard]")) {
    showKeyboardFor(e.target);
  }
});

$("#btnHideKeyboard").addEventListener("click", hideKeyboard);

/* ---------- Main render ---------- */
function render() {
  const route = state.ui.route;

  $("#overviewSearch").value = state.ui.search || "";

  renderOverview();

  if (route === "goals") renderGoals();
  if (route === "expenses") renderExpenses();
  if (route === "goal-detail") renderGoalDetail();
}

/* ---------- Init ---------- */
function init() {
  $("#txDate").value = todayISO();
  setRoute(state.ui.route || "overview");
  render();
}

init();