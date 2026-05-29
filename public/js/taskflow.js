/* ═══════════════════════════════════════════════════════════════
   TaskFlow — Premium SPA  (EntryEase-quality UI)
   ═══════════════════════════════════════════════════════════════ */
if (window.__TASKFLOW_LOADED__) {
    console.warn("[taskflow] Already loaded — skipping.");
} else {
window.__TASKFLOW_LOADED__ = true;
window.__TASKFLOW_BOOT_ATTEMPTS__ = 0;
window.__TASKFLOW_SSO_DETAIL__ = window.__TASKFLOW_SSO_DETAIL__ || null;

// ── Init error ────────────────────────────────────────────────
function showInitError(msg) {
    const el = document.getElementById("taskflow-loader-error");
    if (el) { el.style.display = "block"; el.textContent = msg; }
    console.error("[taskflow]", msg);
}
window.addEventListener("module:error", e =>
    showInitError("Authentication failed: " + ((e.detail && (e.detail.error || e.detail.reason)) || "unknown"))
);

// ── SSO handshake ─────────────────────────────────────────────
function bootFromPortalUser(detail) {
    window.__TASKFLOW_BOOT_ATTEMPTS__ += 1;
    const user = (detail && detail.user) || window.PORTAL_USER || null;
    const token = (detail && detail.token) || window.SSO_TOKEN || null;
    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
    if (!csrfMeta) { showInitError("CSRF token missing."); return; }
    if (!token && !(user && user.id)) { showInitError("SSO identity missing."); return; }
    const isEmbedded = !!(detail && detail.embedded) || window.self !== window.top;
    window.__TASKFLOW_SSO_DETAIL__ = {
        user: user || null,
        token: token || null,
        embedded: isEmbedded,
        moduleExchangeCompleted: false,
    };

    const url = user && user.id ? "/sso/redirect" : "/sso/exchange";
    const body = user && user.id
        ? { id: user.id, name: user.name || "", email: user.email || "", role: user.role || "student", embedded: isEmbedded ? "1" : "0" }
        : { token, embedded: isEmbedded };

    fetch(url, {
        method: "POST", credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json",
                   "X-CSRF-TOKEN": csrfMeta.getAttribute("content"), "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify(body),
    })
    .then(r => {
        if (!r.ok) throw new Error("SSO exchange failed: " + r.status);
        return r.json();
    })
    .then(j => {
        if (!j || !j.user) throw new Error("Invalid SSO response");
        if (window.__TASKFLOW_SSO_DETAIL__) {
            window.__TASKFLOW_SSO_DETAIL__.user = j.user;
            window.__TASKFLOW_SSO_DETAIL__.moduleExchangeCompleted = true;
        }
        bootApp(j.user, isEmbedded);
    })
    .catch(e => {
        showInitError(e?.message || "Authentication failed.");
    });
}
window.addEventListener("module:ready", e => bootFromPortalUser(e.detail || {}));
if (window.__DEORIS_MODULE_READY_DETAIL__ || (window.PORTAL_USER && window.PORTAL_USER.id)) {
    bootFromPortalUser(window.__DEORIS_MODULE_READY_DETAIL__ || { user: window.PORTAL_USER, embedded: true });
} else if (window.__DEORIS_MODULE_ERROR_DETAIL__) {
    showInitError("Authentication failed: " + (window.__DEORIS_MODULE_ERROR_DETAIL__.error || "unknown"));
}

// ── Utilities ─────────────────────────────────────────────────
function esc(s) {
    if (s == null) return "";
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#x27;");
}
function fmtDate(iso) {
    if (!iso) return "—";
    return new Date(iso + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}
function fmtBytes(b) {
    if (!b) return "";
    if (b < 1024) return b + "B";
    if (b < 1048576) return (b / 1024).toFixed(1) + "KB";
    return (b / 1048576).toFixed(1) + "MB";
}
function daysUntil(iso) {
    const d = new Date(iso + "T00:00:00"), t = new Date();
    t.setHours(0, 0, 0, 0);
    return Math.ceil((d - t) / 86400000);
}
function countdownBadge(iso) {
    const d = daysUntil(iso);
    if (d < 0)   return `<span class="tf-badge tf-badge-overdue"><i class="fa-solid fa-circle-exclamation"></i>Overdue ${Math.abs(d)}d</span>`;
    if (d === 0) return `<span class="tf-badge tf-badge-today"><i class="fa-solid fa-clock"></i>Due Today</span>`;
    if (d <= 3)  return `<span class="tf-badge tf-badge-soon"><i class="fa-solid fa-hourglass-half"></i>Due in ${d}d</span>`;
    return `<span class="tf-badge tf-badge-ok"><i class="fa-solid fa-calendar-check"></i>Due in ${d}d</span>`;
}
function statusBadge(status) {
    const map = {
        pending:          "tf-badge-pending",
        submitted:        "tf-badge-submitted",
        graded:           "tf-badge-graded",
        late_submission:  "tf-badge-late",
        under_review:     "tf-badge-review",
        feedback_released:"tf-badge-released",
        draft:            "tf-badge-draft",
        published:        "tf-badge-published",
        closed:           "tf-badge-closed",
    };
    const icons = {
        pending: "fa-hourglass-half", submitted: "fa-paper-plane", graded: "fa-circle-check",
        late_submission: "fa-circle-exclamation", under_review: "fa-magnifying-glass",
        feedback_released: "fa-comment-dots", draft: "fa-pen", published: "fa-globe", closed: "fa-lock",
    };
    const cls  = map[status]  || "tf-badge-draft";
    const icon = icons[status] || "fa-circle";
    const label = (status || "").replace(/_/g, " ");
    return `<span class="tf-badge ${cls}"><i class="fa-solid ${icon}"></i>${esc(label)}</span>`;
}
function priorityBadge(p) {
    const map = { high: "tf-priority-high", medium: "tf-priority-medium", low: "tf-priority-low" };
    const icons = { high: "fa-arrow-up", medium: "fa-minus", low: "fa-arrow-down" };
    return `<span class="tf-priority ${map[p]||"tf-priority-medium}"}"><i class="fa-solid ${icons[p]||"fa-minus"}"></i>${esc(p||"medium")}</span>`;
}
function initials(name) {
    return (name || "U").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

// ── API helper ────────────────────────────────────────────────
function makeApi(csrf) {
    const BASE = window.TASKFLOW_API_BASE || window.location.origin;
    let attemptedSessionRepair = false;
    if (!window.__TASKFLOW_BASE_LOGGED__) {
        window.__TASKFLOW_BASE_LOGGED__ = true;
    }
    async function repairSessionIfNeeded() {
        if (attemptedSessionRepair) return false;
        attemptedSessionRepair = true;

        const sso = window.__TASKFLOW_SSO_DETAIL__ || {};
        const hasUser = !!(sso.user && sso.user.id);
        const hasToken = !!sso.token;
        const alreadyExchanged = !!sso.moduleExchangeCompleted;
        const endpoint = hasUser ? "/sso/redirect" : (hasToken ? "/sso/exchange" : null);
        if (!endpoint) return false;


        const repairBody = hasToken
            ? { token: sso.token, embedded: !!sso.embedded }
            : {
                id: sso.user.id,
                name: sso.user.name || "",
                email: sso.user.email || "",
                role: sso.user.role || "student",
                embedded: sso.embedded ? "1" : "0",
            };

        const repaired = await fetch(endpoint, {
            method: "POST",
            credentials: "same-origin",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "X-CSRF-TOKEN": csrf || "",
                "X-Requested-With": "XMLHttpRequest",
            },
            body: JSON.stringify(repairBody),
        }).then(r => r.ok).catch(() => false);


        return repaired;
    }

    return async function api(method, url, body, isFormData) {
        const headers = { "X-CSRF-TOKEN": csrf, "X-Requested-With": "XMLHttpRequest", Accept: "application/json" };
        if (!isFormData) headers["Content-Type"] = "application/json";
        if (url.includes("/bootstrap") || url.includes("/sso/")) {
        }
        const res = await fetch(BASE + url, {
            method, credentials: "include", headers,
            body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
        });
        if (!res.ok && res.status === 401) {
            const sso = window.__TASKFLOW_SSO_DETAIL__ || {};
            if (!!sso.moduleExchangeCompleted && !attemptedSessionRepair) {
                attemptedSessionRepair = true;
                const retryNoRepair = await fetch(BASE + url, {
                    method, credentials: "include", headers,
                    body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
                });
                if (retryNoRepair.ok) {
                    return retryNoRepair.status === 204 ? null : retryNoRepair.json();
                }
            }
            const repaired = await repairSessionIfNeeded();
            if (repaired) {
                const retry = await fetch(BASE + url, {
                    method, credentials: "include", headers,
                    body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
                });
                if (retry.ok) {
                    return retry.status === 204 ? null : retry.json();
                }
            }
        }
        if (!res.ok) {
            const t = await res.text(); let m = t;
            try { m = JSON.parse(t).message || t; } catch (_) {}
            throw new Error(m);
        }
        return res.status === 204 ? null : res.json();
    };
}

// ── Toast ─────────────────────────────────────────────────────
function toast(msg, type) {
    type = type || "success";
    const stack = document.getElementById("tf-toast-stack");
    if (!stack) return;
    const icons = { success: "fa-circle-check", error: "fa-circle-xmark", info: "fa-circle-info", warning: "fa-triangle-exclamation" };
    const t = document.createElement("div");
    t.className = "tf-toast " + type;
    t.innerHTML = `<i class="fa-solid ${icons[type] || "fa-circle-check"}"></i><span>${esc(msg)}</span>`;
    stack.appendChild(t);
    setTimeout(() => { t.classList.add("hiding"); setTimeout(() => t.remove(), 250); }, 3500);
}

// ── Modal ─────────────────────────────────────────────────────
function openModal(html) {
    const bd = document.createElement("div");
    bd.className = "tf-modal-backdrop";
    bd.innerHTML = `<div class="tf-modal">${html}</div>`;
    bd.addEventListener("click", e => { if (e.target === bd) bd.remove(); });
    document.body.appendChild(bd);
    bd.querySelectorAll(".tf-modal-close").forEach(b => b.addEventListener("click", () => bd.remove()));
    return bd;
}

// ── Navigation ────────────────────────────────────────────────
function navigate(page, state) {
    state.page = page;
    // Standalone nav buttons
    document.querySelectorAll(".tf-nav-btn").forEach(b => b.classList.toggle("active", b.dataset.page === page));
    // Sidebar links
    document.querySelectorAll(".tf-sidebar-nav a").forEach(a => a.classList.toggle("active", a.dataset.page === page));
    // Embedded tab buttons
    document.querySelectorAll(".tf-emb-tab").forEach(b => b.classList.toggle("active", b.dataset.page === page));
    // Pages
    document.querySelectorAll(".tf-page").forEach(el => el.classList.toggle("active", el.id === "tf-page-" + page));
}

// ── App shell ─────────────────────────────────────────────────
function buildAppShell(state) {
    const isInstructor = state.role === "instructor";
    const embedded     = state.embedded;
    const ini = initials(state.userName);
    const roleLabel = isInstructor ? "Instructor" : "Student";
    const roleCls   = isInstructor ? "tf-role-instructor" : "tf-role-student";

    const navItems = [
        { page: "dashboard",   icon: "fa-house",          label: "Dashboard" },
        { page: "assignments", icon: "fa-clipboard-list", label: "Assignments" },
        ...(isInstructor ? [{ page: "create", icon: "fa-plus-circle", label: "Create" }] : []),
        { page: "submissions", icon: "fa-inbox",          label: "Submissions" },
        { page: "feedback",    icon: "fa-comment-dots",   label: "Feedback" },
        { page: "calendar",    icon: "fa-calendar-days",  label: "Calendar" },
        ...(isInstructor ? [{ page: "analytics", icon: "fa-chart-bar", label: "Analytics" }] : []),
        { page: "activity",    icon: "fa-clock-rotate-left", label: "Activity" },
    ];

    const navBtns = navItems.map(n =>
        `<button class="tf-nav-btn${n.page === "dashboard" ? " active" : ""}" data-page="${n.page}" aria-label="${n.label}">
           <i class="fa-solid ${n.icon}"></i><span>${n.label}</span>
         </button>`
    ).join("");

    const sidebarLinks = navItems.map(n =>
        `<li><a data-page="${n.page}" class="${n.page === "dashboard" ? "active" : ""}" role="button" tabindex="0">
           <i class="fa-solid ${n.icon}"></i><span>${n.label}</span>
         </a></li>`
    ).join("");

    const pages = navItems.map(n =>
        `<div class="tf-page${n.page === "dashboard" ? " active" : ""}" id="tf-page-${n.page}" role="tabpanel" aria-label="${n.label}"></div>`
    ).join("");

    // ── Embedded mode: no navbar, no sidebar — just the sidebar nav as a
    //    compact top tab-bar so the portal chrome stays the only chrome.
    if (embedded) {
        const tabBtns = navItems.map(n =>
            `<button class="tf-emb-tab${n.page === "dashboard" ? " active" : ""}" data-page="${n.page}" aria-label="${n.label}">
               <i class="fa-solid ${n.icon}"></i><span>${n.label}</span>
             </button>`
        ).join("");

        return `
<div id="tf-toast-stack"></div>
<div class="tf-shell tf-shell-embedded">
  <nav class="tf-emb-nav" role="navigation" aria-label="TaskFlow navigation">
    <div class="tf-emb-nav-inner">
      <div class="tf-emb-tabs">${tabBtns}</div>
    </div>
  </nav>
  <main class="tf-emb-main" id="tf-main" role="main">
    ${pages}
  </main>
</div>`;
    }

    // ── Standalone mode: full navbar + sidebar
    return `
<div id="tf-toast-stack"></div>
<div class="tf-sidebar-overlay" id="tf-sidebar-overlay"></div>
<div class="tf-shell">
  <!-- Navbar -->
  <nav class="tf-navbar" role="navigation" aria-label="TaskFlow navigation">
    <div class="tf-navbar-inner">
      <div class="tf-brand">
        <button class="tf-hamburger" id="tf-hamburger" aria-label="Toggle sidebar">
          <i class="fa-solid fa-bars"></i>
        </button>
        <div class="tf-brand-badge"><i class="fa-solid fa-tasks"></i></div>
        <div>
          <div class="tf-brand-name">TaskFlow</div>
          <div class="tf-brand-sub">Assignment Manager</div>
        </div>
      </div>
      <div class="tf-nav-center">${navBtns}</div>
      <div class="tf-nav-user">
        <div class="tf-nav-avatar" aria-hidden="true">${esc(ini)}</div>
        <div>
          <div class="tf-nav-user-name">${esc(state.userName)}</div>
          <span class="tf-nav-role-badge ${roleCls}">${roleLabel}</span>
        </div>
      </div>
    </div>
  </nav>

  <!-- Body -->
  <div class="tf-body">
    <!-- Sidebar -->
    <aside class="tf-sidebar" id="tf-sidebar" aria-label="Sidebar navigation">
      <div class="tf-sidebar-brand">
        <h3><i class="fa-solid fa-tasks"></i> TaskFlow</h3>
        <p>Assignment Manager</p>
      </div>
      <div class="tf-sidebar-user">
        <div class="tf-sidebar-avatar" aria-hidden="true">${esc(ini)}</div>
        <div>
          <div class="tf-sidebar-user-name">${esc(state.userName)}</div>
          <div class="tf-sidebar-user-role">${roleLabel}</div>
        </div>
      </div>
      <div class="tf-sidebar-section">Navigation</div>
      <ul class="tf-sidebar-nav">${sidebarLinks}</ul>
      <div class="tf-sidebar-footer">TaskFlow &copy; ${new Date().getFullYear()}</div>
    </aside>

    <!-- Main content -->
    <main class="tf-main" id="tf-main" role="main">
      ${pages}
    </main>
  </div>
</div>`;
}

// ── Boot ──────────────────────────────────────────────────────
async function bootApp(user, isEmbedded) {
    const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
    const api  = makeApi(csrf);
    const rawRole = (user?.role || "student").toLowerCase();
    const role = (rawRole === "instructor" || rawRole === "teacher" || rawRole === "admin") ? "instructor" : "student";
    // Detect embedded: passed from SSO detail OR running inside an iframe
    const embedded = !!(isEmbedded || window.self !== window.top);

    const state = {
        role, embedded,
        userName: user?.name || "User", userEmail: (user?.email || "").toLowerCase(),
        userId: user?.id || null,
        assignments: [], submissions: [], feedback: [], activityLog: [], deadlines: [], analytics: null,
        calendar: { month: new Date().getMonth() + 1, year: new Date().getFullYear(), events: [] },
        page: "dashboard",
    };

    const root = document.getElementById("taskflow-root");
    if (!root) throw new Error("Mount point #taskflow-root not found.");

    async function loadData() {
        const d = await api("GET", "/taskflow/api/bootstrap");
        state.role        = d.role        || state.role;
        state.assignments = d.assignments || [];
        state.submissions = d.submissions || [];
        state.activityLog = d.activityLog || [];
        if (d.user?.name) state.userName = d.user.name;
    }
    async function loadCalendar() {
        const d = await api("GET", `/taskflow/api/calendar?month=${state.calendar.month}&year=${state.calendar.year}`);
        state.calendar.events = d.data || [];
        renderCalendar(state);
    }
    async function loadAnalytics() {
        try { const d = await api("GET", "/taskflow/api/analytics"); state.analytics = d; renderAnalytics(state); }
        catch (e) { toast("Could not load analytics: " + e.message, "error"); }
    }
    async function loadFeedback() {
        const d = await api("GET", "/taskflow/api/feedback?per_page=50");
        state.feedback = d.data || [];
        renderFeedback(state);
    }

    await loadData();
    root.style.cssText = "display:block;min-height:100vh;";
    root.innerHTML = buildAppShell(state);

    renderAll(state, api);
    wireEvents(state, api, loadData, loadCalendar, loadAnalytics, loadFeedback);
    console.log("[taskflow] Boot complete.");
}

// ── Render all pages ──────────────────────────────────────────
function renderAll(state, api) {
    renderDashboard(state);
    renderAssignments(state);
    renderSubmissions(state, api);
    renderFeedback(state);
    renderCalendar(state);
    renderActivity(state);
    if (state.role === "instructor") {
        renderCreate(state, api);
        renderAnalytics(state);
    }
}

// ── Dashboard ─────────────────────────────────────────────────
function renderDashboard(state) {
    const el = document.getElementById("tf-page-dashboard"); if (!el) return;
    const isInstructor = state.role === "instructor";
    const now = new Date().toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    const active   = state.assignments.filter(a => a.status === "published" || a.status === "pending").length;
    const graded   = state.assignments.filter(a => a.status === "graded").length;
    const overdue  = state.assignments.filter(a => a.isOverdue).length;
    const pendingGrade = isInstructor
        ? state.submissions.filter(s => ["submitted","late_submission","under_review"].includes(s.status)).length
        : state.submissions.length;

    const upcoming = state.assignments
        .filter(a => a.dueDate && daysUntil(a.dueDate) >= 0 && daysUntil(a.dueDate) <= 7)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, 5);

    const recentActivity = state.activityLog.slice(0, 6);

    el.innerHTML = `
<!-- Welcome banner -->
<div class="tf-welcome">
  <div class="tf-welcome-text">
    <h2>Hello, ${esc(state.userName.split(" ")[0])} <span style="font-size:22px;">👋</span></h2>
    <p><i class="fa-regular fa-calendar" style="margin-right:5px;opacity:.7;"></i>${now}</p>
  </div>
  <div class="tf-welcome-stats">
    <div class="tf-welcome-stat">
      <div class="tf-welcome-stat-label"><i class="fa-solid fa-clipboard-list" style="margin-right:4px;"></i>Active</div>
      <div class="tf-welcome-stat-val">${active}</div>
    </div>
    <div class="tf-welcome-stat">
      <div class="tf-welcome-stat-label"><i class="fa-solid fa-inbox" style="margin-right:4px;"></i>${isInstructor ? "Pending Review" : "Submitted"}</div>
      <div class="tf-welcome-stat-val">${pendingGrade}</div>
    </div>
    <div class="tf-welcome-stat">
      <div class="tf-welcome-stat-label"><i class="fa-solid fa-circle-exclamation" style="margin-right:4px;"></i>Overdue</div>
      <div class="tf-welcome-stat-val">${overdue}</div>
    </div>
  </div>
</div>

<!-- Metric cards -->
<div class="tf-metrics">
  <div class="tf-metric-card">
    <div class="tf-metric-icon ic-primary"><i class="fa-solid fa-clipboard-list"></i></div>
    <div class="tf-metric-body">
      <div class="tf-metric-value">${active}</div>
      <div class="tf-metric-label">Active Assignments</div>
      <div class="tf-metric-sub">Published &amp; pending</div>
    </div>
  </div>
  <div class="tf-metric-card">
    <div class="tf-metric-icon ic-green"><i class="fa-solid fa-circle-check"></i></div>
    <div class="tf-metric-body">
      <div class="tf-metric-value">${graded}</div>
      <div class="tf-metric-label">Graded</div>
      <div class="tf-metric-sub">Completed assignments</div>
    </div>
  </div>
  <div class="tf-metric-card">
    <div class="tf-metric-icon ic-red"><i class="fa-solid fa-circle-exclamation"></i></div>
    <div class="tf-metric-body">
      <div class="tf-metric-value">${overdue}</div>
      <div class="tf-metric-label">Overdue</div>
      <div class="tf-metric-sub">Past due date</div>
    </div>
  </div>
  <div class="tf-metric-card">
    <div class="tf-metric-icon ic-gold"><i class="fa-solid fa-inbox"></i></div>
    <div class="tf-metric-body">
      <div class="tf-metric-value">${pendingGrade}</div>
      <div class="tf-metric-label">${isInstructor ? "Pending Review" : "My Submissions"}</div>
      <div class="tf-metric-sub">${isInstructor ? "Need grading" : "Total submitted"}</div>
    </div>
  </div>
</div>

<!-- Two-column section -->
<div class="tf-grid-2">
  <!-- Upcoming deadlines -->
  <div class="tf-card">
    <div class="tf-card-header">
      <h2><i class="fa-solid fa-calendar-days"></i> Upcoming Deadlines</h2>
      <a class="tf-card-link" data-page="calendar" role="button" style="cursor:pointer;">
        <i class="fa-solid fa-calendar"></i> View Calendar
      </a>
    </div>    <div class="tf-card-body">
      ${upcoming.length ? upcoming.map(a => `
      <div class="tf-deadline-item">
        <div style="display:flex;align-items:flex-start;gap:10px;flex:1;min-width:0;">
          <div class="tf-deadline-dot" style="margin-top:5px;flex-shrink:0;"></div>
          <div style="min-width:0;">
            <div class="tf-deadline-title tf-truncate">${esc(a.title)}</div>
            <div class="tf-deadline-sub">
              <i class="fa-solid fa-book"></i>${esc(a.subject)}
              &nbsp;&middot;&nbsp;
              <i class="fa-solid fa-graduation-cap"></i>${esc(a.grade)}
            </div>
          </div>
        </div>
        <div style="flex-shrink:0;">${countdownBadge(a.dueDate)}</div>
      </div>`).join("") : `
      <div class="tf-empty-state">
        <i class="fa-solid fa-calendar-check"></i>
        <p>No upcoming deadlines this week.</p>
      </div>`}
    </div>
  </div>

  <!-- Recent activity -->
  <div class="tf-card">
    <div class="tf-card-header">
      <h2><i class="fa-solid fa-clock-rotate-left"></i> Recent Activity</h2>
      <a class="tf-card-link" data-page="activity" role="button" style="cursor:pointer;">
        <i class="fa-solid fa-arrow-right"></i> View All
      </a>
    </div>
    <div class="tf-card-body">
      <div class="tf-timeline">
        ${recentActivity.length ? recentActivity.map(l => {
          const dotIcon = l.type === "green" ? "fa-circle-check" : l.type === "blue" ? "fa-circle-info" : l.type === "red" ? "fa-circle-xmark" : l.type === "amber" ? "fa-triangle-exclamation" : l.type === "purple" ? "fa-star" : "fa-circle-dot";
          return `
        <div class="tf-timeline-item">
          <div class="tf-act-dot ${l.type || "gray"}"><i class="fa-solid ${dotIcon}"></i></div>
          <div style="flex:1;min-width:0;">
            <div class="tf-act-msg tf-truncate">${esc(l.message)}</div>
            <div class="tf-act-time"><i class="fa-regular fa-clock"></i>${l.at ? new Date(l.at).toLocaleString("en-PH") : ""}</div>
          </div>
        </div>`;}).join("") : `
        <div class="tf-empty-state">
          <i class="fa-solid fa-inbox"></i>
          <p>No activity yet.</p>
        </div>`}
      </div>
    </div>
  </div>
</div>

<!-- Quick actions -->
<div class="tf-card">
  <div class="tf-card-header">
    <h2><i class="fa-solid fa-bolt"></i> Quick Actions</h2>
  </div>
  <div class="tf-card-body">
    <div class="tf-quick-grid">
      ${isInstructor ? `
      <div class="tf-quick-card qc-highlight" data-page="create" role="button" tabindex="0">
        <div class="tf-quick-icon"><i class="fa-solid fa-plus"></i></div>
        <h3>Create Assignment</h3>
        <p>Post a new assignment for your students with due dates and instructions.</p>
        <div class="tf-quick-arrow"><i class="fa-solid fa-arrow-right"></i> Create Now</div>
      </div>
      <div class="tf-quick-card" data-page="submissions" role="button" tabindex="0">
        <div class="tf-quick-icon"><i class="fa-solid fa-inbox"></i></div>
        <h3>Review Submissions</h3>
        <p>${pendingGrade} submission${pendingGrade !== 1 ? "s" : ""} waiting for your grading and feedback.</p>
        <div class="tf-quick-arrow"><i class="fa-solid fa-arrow-right"></i> Review</div>
      </div>
      <div class="tf-quick-card" data-page="analytics" role="button" tabindex="0">
        <div class="tf-quick-icon"><i class="fa-solid fa-chart-bar"></i></div>
        <h3>Analytics</h3>
        <p>View class performance, submission trends, and student productivity.</p>
        <div class="tf-quick-arrow"><i class="fa-solid fa-arrow-right"></i> View</div>
      </div>` : `
      <div class="tf-quick-card" data-page="assignments" role="button" tabindex="0">
        <div class="tf-quick-icon"><i class="fa-solid fa-clipboard-list"></i></div>
        <h3>My Assignments</h3>
        <p>${active} active assignment${active !== 1 ? "s" : ""} to complete and submit.</p>
        <div class="tf-quick-arrow"><i class="fa-solid fa-arrow-right"></i> View</div>
      </div>
      <div class="tf-quick-card ${pendingGrade > 0 ? "qc-highlight" : ""}" data-page="submissions" role="button" tabindex="0">
        <div class="tf-quick-icon"><i class="fa-solid fa-paper-plane"></i></div>
        <h3>My Submissions</h3>
        <p>${pendingGrade} submission${pendingGrade !== 1 ? "s" : ""} recorded so far.</p>
        <div class="tf-quick-arrow"><i class="fa-solid fa-arrow-right"></i> View</div>
      </div>
      <div class="tf-quick-card" data-page="feedback" role="button" tabindex="0">
        <div class="tf-quick-icon"><i class="fa-solid fa-comment-dots"></i></div>
        <h3>My Feedback</h3>
        <p>View your grades and instructor comments on graded work.</p>
        <div class="tf-quick-arrow"><i class="fa-solid fa-arrow-right"></i> View</div>
      </div>`}
    </div>
  </div>
</div>`;
}

// ── Assignments page ──────────────────────────────────────────
function renderAssignments(state) {
    const el = document.getElementById("tf-page-assignments"); if (!el) return;
    const isInstructor = state.role === "instructor";

    el.innerHTML = `
<div class="tf-page-head">
  <div>
    <h1>Assignments</h1>
    <p>${state.assignments.length} total assignment${state.assignments.length !== 1 ? "s" : ""}</p>
  </div>
  ${isInstructor ? `<div class="tf-page-actions"><button class="tf-btn tf-btn-primary" data-page="create"><i class="fa-solid fa-plus"></i> New Assignment</button></div>` : ""}
</div>

<div class="tf-card">
  <div class="tf-filter-bar">
    <input class="tf-field" id="filter-search" placeholder="Search title or subject…" aria-label="Search assignments" style="max-width:240px;">
    <select class="tf-select" id="filter-status" aria-label="Filter by status" style="max-width:160px;">
      <option value="">All statuses</option>
      <option value="published">Published</option>
      <option value="draft">Draft</option>
      <option value="graded">Graded</option>
      <option value="closed">Closed</option>
      <option value="feedback_released">Feedback Released</option>
    </select>
    <select class="tf-select" id="filter-quarter" aria-label="Filter by quarter" style="max-width:120px;">
      <option value="">All quarters</option>
      <option value="Q1">Q1</option><option value="Q2">Q2</option>
      <option value="Q3">Q3</option><option value="Q4">Q4</option>
    </select>
    <select class="tf-select" id="filter-type" aria-label="Filter by type" style="max-width:160px;">
      <option value="">All types</option>
      <option value="written">Written Work</option>
      <option value="performance">Performance Task</option>
      <option value="quiz">Quiz</option>
      <option value="project">Project</option>
      <option value="exam">Examination</option>
    </select>
  </div>
  <div class="tf-card-body no-pad">
    <div class="tf-table-scroll">
      <table class="tf-table" aria-label="Assignments list">
        <thead><tr>
          <th>Title</th><th>Subject</th><th>Grade</th><th>Type</th>
          <th>Due Date</th><th>Points</th><th>Priority</th><th>Status</th>
          <th style="text-align:right;">Actions</th>
        </tr></thead>
        <tbody id="assignments-tbody">
          ${renderAssignmentRows(state.assignments, isInstructor)}
        </tbody>
      </table>
    </div>
  </div>
</div>`;

    const searchEl  = el.querySelector("#filter-search");
    const statusEl  = el.querySelector("#filter-status");
    const quarterEl = el.querySelector("#filter-quarter");
    const typeEl    = el.querySelector("#filter-type");
    function applyFilter() {
        const q  = searchEl.value.toLowerCase();
        const st = statusEl.value;
        const qt = quarterEl.value;
        const tp = typeEl.value;
        const filtered = state.assignments.filter(a =>
            (!q  || a.title.toLowerCase().includes(q) || a.subject.toLowerCase().includes(q)) &&
            (!st || a.status === st) && (!qt || a.quarter === qt) && (!tp || a.type === tp)
        );
        document.getElementById("assignments-tbody").innerHTML = renderAssignmentRows(filtered, isInstructor);
    }
    searchEl.addEventListener("input", applyFilter);
    statusEl.addEventListener("change", applyFilter);
    quarterEl.addEventListener("change", applyFilter);
    typeEl.addEventListener("change", applyFilter);
}

function renderAssignmentRows(assignments, isInstructor) {
    if (!assignments.length) {
        return `<tr><td colspan="9">
          <div class="tf-empty-state"><i class="fa-solid fa-clipboard-list"></i><p>No assignments found.</p></div>
        </td></tr>`;
    }
    return assignments.map(a => `
    <tr>
      <td>
        <div class="tf-bold">${esc(a.title)}</div>
        ${a.isOverdue ? `<div style="margin-top:3px;">${countdownBadge(a.dueDate)}</div>` : ""}
      </td>
      <td class="td-muted">${esc(a.subject)}</td>
      <td class="td-muted">${esc(a.grade)}</td>
      <td><span class="tf-badge tf-badge-draft" style="text-transform:capitalize;">${esc(a.type || "written")}</span></td>
      <td>
        <div class="tf-bold" style="font-size:13px;">${fmtDate(a.dueDate)}</div>
        ${a.dueDate && !a.isOverdue ? `<div style="margin-top:3px;">${countdownBadge(a.dueDate)}</div>` : ""}
      </td>
      <td class="tf-bold">${a.points}</td>
      <td>${priorityBadge(a.priority)}</td>
      <td>${statusBadge(a.status)}</td>
      <td>
        <div class="tf-action-row">
          <button class="tf-mini" data-view-assignment="${a.id}" aria-label="View ${esc(a.title)}"><i class="fa-solid fa-eye"></i> View</button>
          ${isInstructor
            ? `<button class="tf-mini reject" data-delete-assignment="${a.id}" aria-label="Delete"><i class="fa-solid fa-trash"></i></button>`
            : `<button class="tf-mini approve" data-submit-assignment="${a.id}" aria-label="Submit"><i class="fa-solid fa-paper-plane"></i> Submit</button>`}
        </div>
      </td>
    </tr>`).join("");
}

// ── Create Assignment ─────────────────────────────────────────
function renderCreate(state, api) {
    const el = document.getElementById("tf-page-create"); if (!el) return;
    el.innerHTML = `
<div class="tf-page-head">
  <div>
    <h1>Create Assignment</h1>
    <p>Post a new assignment for your students.</p>
  </div>
</div>

<div class="tf-card">
  <div class="tf-card-header">
    <h2><i class="fa-solid fa-plus-circle"></i> Assignment Details</h2>
  </div>
  <div class="tf-card-body">
    <form id="form-create-assignment" novalidate>
      <div class="tf-form-grid">
        <div class="tf-form-group">
          <label class="tf-label" for="na-title">Title <span class="req">*</span></label>
          <input class="tf-field" id="na-title" placeholder="Assignment title" maxlength="255" required aria-required="true">
        </div>
        <div class="tf-form-group">
          <label class="tf-label" for="na-subject">Subject <span class="req">*</span></label>
          <input class="tf-field" id="na-subject" placeholder="e.g. Mathematics 7" required aria-required="true">
        </div>
        <div class="tf-form-group">
          <label class="tf-label" for="na-grade">Grade Level <span class="req">*</span></label>
          <input class="tf-field" id="na-grade" placeholder="e.g. Grade 7" required aria-required="true">
        </div>
        <div class="tf-form-group">
          <label class="tf-label" for="na-type">Type</label>
          <select class="tf-select" id="na-type">
            <option value="written">Written Work</option>
            <option value="performance">Performance Task</option>
            <option value="quiz">Quiz</option>
            <option value="project">Project</option>
            <option value="exam">Examination</option>
          </select>
        </div>
        <div class="tf-form-group">
          <label class="tf-label" for="na-priority">Priority</label>
          <select class="tf-select" id="na-priority">
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div class="tf-form-group">
          <label class="tf-label" for="na-quarter">Quarter</label>
          <select class="tf-select" id="na-quarter">
            <option value="Q1">Q1</option><option value="Q2">Q2</option>
            <option value="Q3">Q3</option><option value="Q4" selected>Q4</option>
          </select>
        </div>
        <div class="tf-form-group">
          <label class="tf-label" for="na-due">Due Date <span class="req">*</span></label>
          <input class="tf-field" type="date" id="na-due" required aria-required="true">
        </div>
        <div class="tf-form-group">
          <label class="tf-label" for="na-points">Max Points <span class="req">*</span></label>
          <input class="tf-field" type="number" id="na-points" value="100" min="1" max="1000" required aria-required="true">
        </div>
        <div class="tf-form-group full">
          <label class="tf-label" for="na-desc">Instructions</label>
          <textarea class="tf-field" id="na-desc" placeholder="Describe the assignment, requirements, and submission guidelines…" maxlength="5000" rows="5"></textarea>
        </div>
      </div>
      <div id="create-error" role="alert" aria-live="polite" class="tf-err-text" style="display:none;margin-top:8px;"></div>
      <div class="tf-btn-row" style="margin-top:20px;">
        <button type="submit" class="tf-btn tf-btn-primary" id="btn-create-assignment">
          <i class="fa-solid fa-paper-plane"></i> Post Assignment
        </button>
        <button type="button" class="tf-btn tf-btn-secondary" id="btn-clear-assignment">
          <i class="fa-solid fa-rotate-left"></i> Clear
        </button>
      </div>
    </form>
  </div>
</div>`;
}

// ── Submissions page ──────────────────────────────────────────
function renderSubmissions(state, api) {
    const el = document.getElementById("tf-page-submissions"); if (!el) return;
    const isInstructor = state.role === "instructor";
    const pendingCount = isInstructor
        ? state.submissions.filter(s => ["submitted","late_submission","under_review"].includes(s.status)).length
        : 0;

    el.innerHTML = `
<div class="tf-page-head">
  <div>
    <h1>Submissions</h1>
    <p>${state.submissions.length} total submission${state.submissions.length !== 1 ? "s" : ""}${isInstructor && pendingCount > 0 ? ` &mdash; <strong style="color:var(--warning)">${pendingCount} pending review</strong>` : ""}</p>
  </div>
</div>

${isInstructor && pendingCount > 0 ? `
<div class="tf-notice warn">
  <i class="fa-solid fa-triangle-exclamation"></i>
  <span><strong>${pendingCount} submission${pendingCount !== 1 ? "s" : ""}</strong> waiting for your review and grading.</span>
</div>` : ""}
<div class="tf-card">
  <div class="tf-filter-bar">
    <select class="tf-select" id="sub-filter-status" aria-label="Filter by status" style="max-width:200px;">
      <option value="">All statuses</option>
      <option value="submitted">Submitted</option>
      <option value="late_submission">Late</option>
      <option value="under_review">Under Review</option>
      <option value="graded">Graded</option>
      <option value="feedback_released">Feedback Released</option>
    </select>
  </div>
  <div class="tf-card-body no-pad">
    <div class="tf-table-scroll">
      <table class="tf-table" aria-label="Submissions list">
        <thead><tr>
          <th>Assignment</th>
          <th>File</th>
          <th>Comment</th>
          <th>Score</th>
          <th>Status</th>
          <th>Submitted</th>
          ${isInstructor ? "<th style='text-align:right;'>Actions</th>" : ""}
        </tr></thead>
        <tbody id="submissions-tbody">
          ${renderSubmissionRows(state.submissions, state.assignments, isInstructor)}
        </tbody>
      </table>
    </div>
  </div>
</div>`;

    el.querySelector("#sub-filter-status").addEventListener("change", function () {
        const filtered = this.value ? state.submissions.filter(s => s.status === this.value) : state.submissions;
        document.getElementById("submissions-tbody").innerHTML = renderSubmissionRows(filtered, state.assignments, isInstructor);
    });
}

function renderSubmissionRows(submissions, assignments, isInstructor) {
    if (!submissions.length) {
        return `<tr><td colspan="${isInstructor ? 7 : 6}">
          <div class="tf-empty-state"><i class="fa-solid fa-inbox"></i><p>No submissions yet.</p></div>
        </td></tr>`;
    }
    return submissions.map(s => {
        const a = assignments.find(x => x.id === s.assignmentId);
        const fileInfo = s.hasFile
            ? `<span class="tf-truncate" style="max-width:140px;display:inline-block;" title="${esc(s.fileName)}">${esc(s.fileName)}</span>
               <span class="tf-subtle" style="font-size:11px;">(${fmtBytes(s.fileSize)})</span>`
            : `<span class="tf-subtle">—</span>`;
        return `<tr>
          <td>
            <div class="tf-bold">${esc(a?.title || "Assignment #" + s.assignmentId)}</div>
            ${a ? `<div class="tf-subtle" style="font-size:11px;">${esc(a.subject)} &middot; ${esc(a.grade)}</div>` : ""}
          </td>
          <td>
            ${fileInfo}
            ${s.hasFile ? `<a href="/taskflow/api/submissions/${s.id}/download" class="tf-mini" style="margin-left:4px;" aria-label="Download"><i class="fa-solid fa-download"></i></a>` : ""}
          </td>
          <td style="max-width:160px;" class="tf-truncate tf-subtle" title="${esc(s.comment)}">${esc(s.comment || "—")}</td>
          <td class="tf-bold">${s.score != null ? s.score + (a ? "/" + a.points : "") : "—"}</td>
          <td>${statusBadge(s.status)}</td>
          <td class="tf-subtle">${s.createdAt ? new Date(s.createdAt).toLocaleDateString("en-PH") : "—"}</td>
          ${isInstructor ? `
          <td>
            <div class="tf-action-row">
              ${!["graded","feedback_released"].includes(s.status)
                ? `<button class="tf-mini grade" data-grade-submission="${s.id}"><i class="fa-solid fa-star"></i> Grade</button>`
                : ""}
              ${s.status === "graded"
                ? `<button class="tf-mini release" data-release-feedback="${s.id}"><i class="fa-solid fa-comment-dots"></i> Release</button>`
                : ""}
              <button class="tf-mini reject" data-delete-submission="${s.id}"><i class="fa-solid fa-trash"></i></button>
            </div>
          </td>` : ""}
        </tr>`;
    }).join("");
}

// ── Feedback page ─────────────────────────────────────────────
function renderFeedback(state) {
    const el = document.getElementById("tf-page-feedback"); if (!el) return;
    const items = state.feedback || [];
    el.innerHTML = `
<div class="tf-page-head">
  <div>
    <h1>Feedback</h1>
    <p>${items.length} graded submission${items.length !== 1 ? "s" : ""} with feedback</p>
  </div>
</div>
${items.length ? items.map(f => {
    const pct = f.max_points ? Math.round((f.score / f.max_points) * 100) : null;
    const scoreColor = pct == null ? "var(--primary)" : pct >= 75 ? "var(--success)" : pct >= 50 ? "var(--warning)" : "var(--danger)";
    return `
<div class="tf-feedback-card">
  <div class="tf-feedback-head">
    <div>
      <div class="tf-feedback-title">${esc(f.assignment_title || "Assignment #" + f.assignment_id)}</div>
      <div class="tf-feedback-meta">
        <i class="fa-solid fa-hashtag" style="font-size:11px;"></i> Submission #${f.submission_id}
        &middot; ${f.graded_at ? new Date(f.graded_at).toLocaleDateString("en-PH") : ""}
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:12px;">
      <div style="text-align:right;">
        <div class="tf-feedback-score" style="color:${scoreColor};">${f.score != null ? f.score : "—"}</div>
        ${pct != null ? `<div class="tf-subtle" style="font-size:11px;">${pct}%</div>` : ""}
      </div>
      ${statusBadge(f.status)}
    </div>
  </div>
  <div class="tf-feedback-body">
    ${f.feedback
      ? `<div class="tf-feedback-text">${esc(f.feedback)}</div>`
      : `<p class="tf-subtle"><i class="fa-solid fa-comment-slash" style="margin-right:6px;"></i>No written feedback provided.</p>`}
  </div>
</div>`; }).join("") : `
<div class="tf-card">
  <div class="tf-card-body">
    <div class="tf-empty-state">
      <i class="fa-solid fa-comment-dots"></i>
      <p>No graded submissions yet. Feedback will appear here once your instructor grades your work.</p>
    </div>
  </div>
</div>`}`;
}

// ── Calendar page ─────────────────────────────────────────────
function renderCalendar(state) {
    const el = document.getElementById("tf-page-calendar"); if (!el) return;
    const { month, year, events } = state.calendar;
    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const dayNames   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const firstDay   = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const eventMap = {};
    (events || []).forEach(e => {
        if (!eventMap[e.date]) eventMap[e.date] = [];
        eventMap[e.date].push(e);
    });

    let cells = dayNames.map(d => `<div class="tf-cal-head">${d}</div>`).join("");
    for (let i = 0; i < firstDay; i++) cells += `<div class="tf-cal-day other-month"></div>`;

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr  = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
        const cellDate = new Date(year, month - 1, d);
        const isToday  = cellDate.getTime() === today.getTime();
        const dayEvs   = eventMap[dateStr] || [];
        const evHtml   = dayEvs.slice(0, 3).map(e => {
            const cls = e.status === "graded" ? "graded" : (new Date(e.date + "T00:00:00") < today ? "overdue" : "");
            return `<div class="tf-cal-event ${cls}" title="${esc(e.title)}">${esc(e.title)}</div>`;
        }).join("") + (dayEvs.length > 3 ? `<div class="tf-subtle" style="font-size:10px;">+${dayEvs.length - 3} more</div>` : "");

        cells += `<div class="tf-cal-day${isToday ? " today" : ""}">
          <div class="tf-cal-day-num">${d}</div>${evHtml}
        </div>`;
    }

    el.innerHTML = `
<div class="tf-page-head">
  <div><h1>Deadline Calendar</h1><p>Assignment due dates at a glance.</p></div>
</div>
<div class="tf-card">
  <div class="tf-card-header">
    <div class="tf-cal-nav">
      <button id="cal-prev" aria-label="Previous month"><i class="fa-solid fa-chevron-left"></i></button>
      <span class="tf-cal-month" aria-live="polite">${monthNames[month - 1]} ${year}</span>
      <button id="cal-next" aria-label="Next month"><i class="fa-solid fa-chevron-right"></i></button>
    </div>
    <div class="tf-cal-legend">
      <span><span class="tf-cal-legend-dot" style="background:var(--primary);"></span>Upcoming</span>
      <span><span class="tf-cal-legend-dot" style="background:var(--danger);"></span>Overdue</span>
      <span><span class="tf-cal-legend-dot" style="background:var(--success);"></span>Graded</span>
    </div>
  </div>
  <div class="tf-card-body">
    <div class="tf-cal-grid" role="grid" aria-label="Calendar for ${monthNames[month - 1]} ${year}">${cells}</div>
  </div>
</div>`;

    function fetchAndRender() {
        const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
        makeApi(csrf)("GET", `/taskflow/api/calendar?month=${state.calendar.month}&year=${state.calendar.year}`)
            .then(d => { state.calendar.events = d.data || []; renderCalendar(state); })
            .catch(() => renderCalendar(state));
    }
    el.querySelector("#cal-prev").addEventListener("click", () => {
        state.calendar.month--;
        if (state.calendar.month < 1) { state.calendar.month = 12; state.calendar.year--; }
        fetchAndRender();
    });
    el.querySelector("#cal-next").addEventListener("click", () => {
        state.calendar.month++;
        if (state.calendar.month > 12) { state.calendar.month = 1; state.calendar.year++; }
        fetchAndRender();
    });
}

// ── Analytics page ────────────────────────────────────────────
function renderAnalytics(state) {
    const el = document.getElementById("tf-page-analytics"); if (!el) return;
    const d = state.analytics;

    if (!d) {
        el.innerHTML = `
<div class="tf-page-head"><div><h1>Analytics</h1><p>Loading data…</p></div></div>
<div class="tf-card"><div class="tf-card-body">
  <div class="tf-empty-state"><i class="fa-solid fa-chart-bar" style="animation:pulse 1.5s infinite;"></i><p>Loading analytics…</p></div>
</div></div>`;
        return;
    }

    const s           = d.summary            || {};
    const assignments = d.assignment_analytics || [];
    const trend       = d.submission_trend    || [];
    const overdue     = d.overdue_report      || [];
    const productivity = d.student_productivity || [];

    const maxTrend = Math.max(...trend.map(t => t.total || 0), 1);
    const sparkBars = trend.slice(-30).map(t => {
        const h = Math.max(4, Math.round(((t.total || 0) / maxTrend) * 56));
        return `<div class="tf-spark-bar" style="height:${h}px;" title="${t.submission_date}: ${t.total} submissions"></div>`;
    }).join("");

    const maxSubs = Math.max(...assignments.map(a => a.total_submissions || 0), 1);
    const assignBars = assignments.slice(0, 10).map(a => `
    <div class="tf-chart-bar-row">
      <span class="tf-chart-bar-label" title="${esc(a.title)}">${esc(a.title)}</span>
      <div class="tf-chart-bar-track">
        <div class="tf-chart-bar-fill" style="width:${Math.round(((a.total_submissions||0)/maxSubs)*100)}%"></div>
      </div>
      <span class="tf-chart-bar-val">${a.total_submissions || 0}</span>
    </div>`).join("");

    const avgScore = assignments.length
        ? (assignments.reduce((sum, a) => sum + (parseFloat(a.avg_score) || 0), 0) / assignments.length).toFixed(1)
        : "—";

    el.innerHTML = `
<div class="tf-page-head">
  <div><h1>Analytics</h1><p>Academic performance overview for your class.</p></div>
</div>

<div class="tf-metrics">
  <div class="tf-metric-card">
    <div class="tf-metric-icon ic-primary"><i class="fa-solid fa-clipboard-list"></i></div>
    <div class="tf-metric-body">
      <div class="tf-metric-value">${s.total_assignments || 0}</div>
      <div class="tf-metric-label">Total Assignments</div>
    </div>
  </div>
  <div class="tf-metric-card">
    <div class="tf-metric-icon ic-gold"><i class="fa-solid fa-inbox"></i></div>
    <div class="tf-metric-body">
      <div class="tf-metric-value">${s.total_submissions || 0}</div>
      <div class="tf-metric-label">Total Submissions</div>
    </div>
  </div>
  <div class="tf-metric-card">
    <div class="tf-metric-icon ic-green"><i class="fa-solid fa-circle-check"></i></div>
    <div class="tf-metric-body">
      <div class="tf-metric-value">${s.graded_submissions || 0}</div>
      <div class="tf-metric-label">Graded</div>
    </div>
  </div>
  <div class="tf-metric-card">
    <div class="tf-metric-icon ic-red"><i class="fa-solid fa-circle-exclamation"></i></div>
    <div class="tf-metric-body">
      <div class="tf-metric-value">${s.overdue_assignments || 0}</div>
      <div class="tf-metric-label">Overdue</div>
    </div>
  </div>
</div>

<div class="tf-grid-2">
  <div class="tf-card">
    <div class="tf-card-header"><h2><i class="fa-solid fa-chart-line"></i> Submission Trend (30 days)</h2></div>
    <div class="tf-card-body">
      ${trend.length ? `
      <div class="tf-sparkline-wrap" aria-label="Submission trend chart">${sparkBars}</div>
      <div class="tf-subtle" style="margin-top:8px;font-size:11px;">
        ${trend[0]?.submission_date || ""} &rarr; ${trend[trend.length - 1]?.submission_date || ""}
      </div>` : `<div class="tf-empty-state"><i class="fa-solid fa-chart-line"></i><p>No submission data yet.</p></div>`}
    </div>
  </div>
  <div class="tf-card">
    <div class="tf-card-header"><h2><i class="fa-solid fa-triangle-exclamation"></i> Overdue Assignments</h2></div>
    <div class="tf-card-body no-pad">
      ${overdue.length ? `
      <div class="tf-table-scroll">
        <table class="tf-table">
          <thead><tr><th>Title</th><th>Days Overdue</th><th>Submissions</th></tr></thead>
          <tbody>${overdue.slice(0, 5).map(o => `
          <tr>
            <td class="tf-bold">${esc(o.title)}</td>
            <td>${statusBadge("late_submission").replace("late submission", o.days_overdue + "d overdue")}</td>
            <td>${o.submissions_received}</td>
          </tr>`).join("")}</tbody>
        </table>
      </div>` : `<div class="tf-empty-state"><i class="fa-solid fa-circle-check"></i><p>No overdue assignments.</p></div>`}
    </div>
  </div>
</div>

<div class="tf-grid-2">
  <div class="tf-card">
    <div class="tf-card-header"><h2><i class="fa-solid fa-chart-bar"></i> Submissions per Assignment</h2></div>
    <div class="tf-card-body">
      ${assignments.length
        ? `<div class="tf-chart-bar-wrap">${assignBars}</div>`
        : `<div class="tf-empty-state"><i class="fa-solid fa-chart-bar"></i><p>No data yet.</p></div>`}
    </div>
  </div>
  <div class="tf-card">
    <div class="tf-card-header"><h2><i class="fa-solid fa-users"></i> Student Productivity</h2></div>
    <div class="tf-card-body no-pad">
      ${productivity.length ? `
      <div class="tf-table-scroll">
        <table class="tf-table">
          <thead><tr><th>Student ID</th><th>Submissions</th><th>Avg Score</th><th>Late</th></tr></thead>
          <tbody>${productivity.slice(0, 8).map(p => `
          <tr>
            <td class="tf-bold">#${esc(String(p.portal_user_id))}</td>
            <td>${p.total_submissions}</td>
            <td class="tf-bold" style="color:${p.avg_score >= 75 ? "var(--success)" : p.avg_score >= 50 ? "var(--warning)" : "var(--danger)"};">
              ${p.avg_score != null ? p.avg_score : "—"}
            </td>
            <td>${p.late_submissions > 0 ? `<span class="tf-badge tf-badge-late">${p.late_submissions}</span>` : "0"}</td>
          </tr>`).join("")}</tbody>
        </table>
      </div>` : `<div class="tf-empty-state"><i class="fa-solid fa-users"></i><p>No student data yet.</p></div>`}
    </div>
  </div>
</div>`;
}

// ── Activity Log page ─────────────────────────────────────────
function renderActivity(state) {
    const el = document.getElementById("tf-page-activity"); if (!el) return;
    el.innerHTML = `
<div class="tf-page-head">
  <div><h1>Activity Log</h1><p>Recent system events and changes.</p></div>
</div>
<div class="tf-card">
  <div class="tf-card-body">
    <div class="tf-timeline" role="log" aria-label="Activity log" aria-live="polite">
      ${state.activityLog.length ? state.activityLog.map(l => {
        const dotIcon = l.type === "green" ? "fa-circle-check" : l.type === "blue" ? "fa-circle-info" : l.type === "red" ? "fa-circle-xmark" : l.type === "amber" ? "fa-triangle-exclamation" : l.type === "purple" ? "fa-star" : "fa-circle-dot";
        return `
      <div class="tf-timeline-item">
        <div class="tf-act-dot ${l.type || "gray"}"><i class="fa-solid ${dotIcon}"></i></div>
        <div style="flex:1;min-width:0;">
          <div class="tf-act-msg">${esc(l.message)}</div>
          <div class="tf-act-time"><i class="fa-regular fa-clock"></i>${l.at ? new Date(l.at).toLocaleString("en-PH") : ""}</div>
        </div>
      </div>`;}).join("") : `
      <div class="tf-empty-state">
        <i class="fa-solid fa-clock-rotate-left"></i>
        <p>No activity recorded yet.</p>
      </div>`}
    </div>
  </div>
</div>`;
}

// ── Submit Assignment Modal ───────────────────────────────────
function openSubmitModal(assignmentId, assignments, api, state, loadData, loadFeedback) {
    const a = assignments.find(x => x.id === assignmentId);
    if (!a) return;
    const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";

    const bd = openModal(`
<div class="tf-modal-head">
  <h2><i class="fa-solid fa-paper-plane" style="color:var(--primary);margin-right:8px;"></i>Submit Assignment</h2>
  <button class="tf-modal-close" aria-label="Close">&times;</button>
</div>
<div style="background:var(--bg);border-radius:10px;padding:14px;margin-bottom:18px;">
  <div class="tf-bold" style="font-size:15px;margin-bottom:4px;">${esc(a.title)}</div>
  <div class="tf-subtle" style="display:flex;gap:12px;flex-wrap:wrap;">
    <span><i class="fa-solid fa-book" style="font-size:11px;"></i> ${esc(a.subject)}</span>
    <span><i class="fa-solid fa-graduation-cap" style="font-size:11px;"></i> ${esc(a.grade)}</span>
    <span><i class="fa-solid fa-star" style="font-size:11px;"></i> ${a.points} pts</span>
  </div>
  <div style="margin-top:8px;">${a.dueDate ? countdownBadge(a.dueDate) : ""}</div>
</div>
<div class="tf-form-group" style="margin-bottom:16px;">
  <label class="tf-label" for="sub-comment">Comment <span class="tf-subtle">(optional)</span></label>
  <textarea class="tf-field" id="sub-comment" placeholder="Add a note to your instructor…" rows="3" maxlength="2000"></textarea>
</div>
<div class="tf-form-group" style="margin-bottom:16px;">
  <label class="tf-label">File Upload <span class="tf-subtle">(optional)</span></label>
  <div class="tf-upload-zone" id="upload-zone" role="button" aria-label="Upload file" tabindex="0">
    <input type="file" id="sub-file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,.jpg,.jpeg,.png" aria-label="Choose file">
    <div class="tf-upload-icon"><i class="fa-solid fa-cloud-arrow-up"></i></div>
    <div class="tf-upload-label">Drag &amp; drop or click to upload</div>
    <div class="tf-upload-hint">PDF, DOC, DOCX, PPT, XLS, ZIP, images — max 20MB</div>
    <div class="tf-upload-selected" id="upload-selected" style="display:none;"></div>
  </div>
  <div class="tf-progress-wrap" id="upload-progress-wrap" style="display:none;">
    <div class="tf-progress-bar" id="upload-progress-bar" style="width:0%"></div>
  </div>
</div>
<div id="submit-error" role="alert" aria-live="polite" class="tf-err-text" style="display:none;margin-bottom:10px;"></div>
<div class="tf-btn-row">
  <button class="tf-btn tf-btn-primary" id="btn-do-submit"><i class="fa-solid fa-paper-plane"></i> Submit Assignment</button>
  <button class="tf-btn tf-btn-secondary tf-modal-close">Cancel</button>
</div>`);

    const zone = bd.querySelector("#upload-zone");
    const fileInput = bd.querySelector("#sub-file");
    const selectedLabel = bd.querySelector("#upload-selected");

    zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("drag-over"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
    zone.addEventListener("drop", e => {
        e.preventDefault(); zone.classList.remove("drag-over");
        if (e.dataTransfer.files[0]) { fileInput.files = e.dataTransfer.files; updateFileLabel(); }
    });
    fileInput.addEventListener("change", updateFileLabel);
    function updateFileLabel() {
        const f = fileInput.files[0];
        if (f) { selectedLabel.style.display = "block"; selectedLabel.textContent = f.name + " (" + fmtBytes(f.size) + ")"; }
        else   { selectedLabel.style.display = "none"; }
    }

    bd.querySelector("#btn-do-submit").addEventListener("click", async function () {
        const errEl = bd.querySelector("#submit-error");
        const progressWrap = bd.querySelector("#upload-progress-wrap");
        const progressBar  = bd.querySelector("#upload-progress-bar");
        errEl.style.display = "none";

        const fd = new FormData();
        fd.append("_token", csrf);
        fd.append("assignmentId", assignmentId);
        fd.append("comment", bd.querySelector("#sub-comment").value.trim());
        if (fileInput.files[0]) fd.append("file", fileInput.files[0]);

        this.disabled = true; this.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Submitting…`;
        if (fileInput.files[0]) { progressWrap.style.display = "block"; progressBar.style.width = "30%"; }

        try {
            const res = await fetch((window.TASKFLOW_API_BASE || "") + "/taskflow/api/submissions", {
                method: "POST", credentials: "include",
                headers: { "X-CSRF-TOKEN": csrf, "X-Requested-With": "XMLHttpRequest", Accept: "application/json" },
                body: fd,
            });
            progressBar.style.width = "100%";
            if (!res.ok) {
                const t = await res.text(); let m = t;
                try { m = JSON.parse(t).message || t; } catch (_) {}
                throw new Error(m);
            }
            await loadData();
            renderAll(state, api);
            wireEvents(state, api, loadData, () => {}, () => {}, loadFeedback);
            bd.remove();
            toast("Assignment submitted successfully!");
        } catch (err) {
            errEl.style.display = "block"; errEl.textContent = err.message;
            toast(err.message, "error");
        } finally {
            this.disabled = false; this.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Submit Assignment`;
            progressWrap.style.display = "none"; progressBar.style.width = "0%";
        }
    });
}

// ── View Assignment Modal ─────────────────────────────────────
function openViewAssignmentModal(assignmentId, assignments) {
    const a = assignments.find(x => x.id === assignmentId);
    if (!a) return;
    openModal(`
<div class="tf-modal-head">
  <h2>${esc(a.title)}</h2>
  <button class="tf-modal-close" aria-label="Close">&times;</button>
</div>
<div class="tf-modal-grid">
  <div><div class="tf-modal-label">Subject</div><div class="tf-modal-value">${esc(a.subject)}</div></div>
  <div><div class="tf-modal-label">Grade Level</div><div class="tf-modal-value">${esc(a.grade)}</div></div>
  <div><div class="tf-modal-label">Type</div><div class="tf-modal-value" style="text-transform:capitalize;">${esc(a.type)}</div></div>
  <div><div class="tf-modal-label">Priority</div><div class="tf-modal-value">${priorityBadge(a.priority)}</div></div>
  <div><div class="tf-modal-label">Quarter</div><div class="tf-modal-value">${esc(a.quarter)}</div></div>
  <div><div class="tf-modal-label">Max Points</div><div class="tf-modal-value">${a.points}</div></div>
  <div><div class="tf-modal-label">Due Date</div><div class="tf-modal-value">${fmtDate(a.dueDate)}</div></div>
  <div><div class="tf-modal-label">Status</div><div class="tf-modal-value">${statusBadge(a.status)}</div></div>
</div>
${a.dueDate ? `<div style="margin-bottom:14px;">${countdownBadge(a.dueDate)}</div>` : ""}
${a.description ? `
<div class="tf-modal-section">
  <div class="tf-modal-label">Instructions</div>
  <div class="tf-modal-desc" style="margin-top:6px;">${esc(a.description)}</div>
</div>` : ""}
<div class="tf-btn-row" style="margin-top:16px;">
  <button class="tf-btn tf-btn-secondary tf-modal-close"><i class="fa-solid fa-xmark"></i> Close</button>
</div>`);
}

// ── Grade Modal ───────────────────────────────────────────────
function openGradeModal(submissionId, api, state, loadData, loadFeedback) {
    const s = state.submissions.find(x => x.id === submissionId);
    const a = s ? state.assignments.find(x => x.id === s.assignmentId) : null;

    const bd = openModal(`
<div class="tf-modal-head">
  <h2><i class="fa-solid fa-star" style="color:var(--accent-dark);margin-right:8px;"></i>Grade Submission</h2>
  <button class="tf-modal-close" aria-label="Close">&times;</button>
</div>
${a ? `
<div style="background:var(--bg);border-radius:10px;padding:14px;margin-bottom:18px;">
  <div class="tf-bold">${esc(a.title)}</div>
  <div class="tf-subtle">Max ${a.points} points &middot; ${esc(a.subject)} &middot; ${esc(a.grade)}</div>
</div>` : ""}
${s?.comment ? `
<div class="tf-modal-section">
  <div class="tf-modal-label">Student Comment</div>
  <div class="tf-modal-desc" style="margin-top:6px;">${esc(s.comment)}</div>
</div>` : ""}
<div class="tf-form-group" style="margin-bottom:14px;">
  <label class="tf-label" for="grade-score">Score (0–${a ? a.points : 1000}) <span class="req">*</span></label>
  <input class="tf-field" type="number" id="grade-score" min="0" max="${a ? a.points : 1000}" placeholder="Enter score" required>
</div>
<div class="tf-form-group" style="margin-bottom:14px;">
  <label class="tf-label" for="grade-feedback">Feedback <span class="tf-subtle">(optional)</span></label>
  <textarea class="tf-field" id="grade-feedback" rows="4" placeholder="Write constructive feedback for the student…" maxlength="5000"></textarea>
</div>
<div id="grade-error" role="alert" aria-live="polite" class="tf-err-text" style="display:none;margin-bottom:8px;"></div>
<div class="tf-btn-row">
  <button class="tf-btn tf-btn-primary" id="btn-do-grade"><i class="fa-solid fa-floppy-disk"></i> Save Grade</button>
  <button class="tf-btn tf-btn-secondary tf-modal-close">Cancel</button>
</div>`);

    bd.querySelector("#btn-do-grade").addEventListener("click", async function () {
        const errEl = bd.querySelector("#grade-error");
        const score = parseInt(bd.querySelector("#grade-score").value, 10);
        const feedback = bd.querySelector("#grade-feedback").value.trim();
        if (isNaN(score) || score < 0) { errEl.style.display = "block"; errEl.textContent = "Please enter a valid score."; return; }
        errEl.style.display = "none";
        this.disabled = true; this.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving…`;
        try {
            await api("PATCH", `/taskflow/api/submissions/${submissionId}/grade`, { score, feedback });
            await loadData(); await loadFeedback();
            renderAll(state, api);
            wireEvents(state, api, loadData, () => {}, () => {}, loadFeedback);
            bd.remove(); toast("Submission graded successfully!");
        } catch (err) { errEl.style.display = "block"; errEl.textContent = err.message; toast(err.message, "error"); }
        finally { this.disabled = false; this.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Save Grade`; }
    });
}

// ── Wire all events ───────────────────────────────────────────
function wireEvents(state, api, loadData, loadCalendar, loadAnalytics, loadFeedback) {

    // ── Sidebar & nav tab navigation ──────────────────────────
    function handleNavClick(page) {
        navigate(page, state);
        if (page === "calendar" && !state.calendar.events.length) loadCalendar();
        if (page === "analytics" && !state.analytics) loadAnalytics();
        if (page === "feedback") loadFeedback();
        // Close sidebar on mobile
        document.getElementById("tf-sidebar")?.classList.remove("open");
        document.getElementById("tf-sidebar-overlay")?.classList.remove("show");
    }

    document.querySelectorAll(".tf-nav-btn").forEach(btn => {
        btn.addEventListener("click", () => handleNavClick(btn.dataset.page));
    });
    document.querySelectorAll(".tf-sidebar-nav a").forEach(a => {
        a.addEventListener("click", () => handleNavClick(a.dataset.page));
        a.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleNavClick(a.dataset.page); } });
    });

    // ── Embedded tab buttons ───────────────────────────────────
    document.querySelectorAll(".tf-emb-tab").forEach(btn => {
        btn.addEventListener("click", () => handleNavClick(btn.dataset.page));
    });

    // ── Card links (dashboard quick nav) ──────────────────────
    document.querySelectorAll("[data-page]").forEach(el => {
        if (!el.classList.contains("tf-nav-btn") && !el.closest(".tf-sidebar-nav")) {
            el.addEventListener("click", () => handleNavClick(el.dataset.page));
        }
    });

    // ── Hamburger (mobile sidebar) ────────────────────────────
    const hamburger = document.getElementById("tf-hamburger");
    const sidebar   = document.getElementById("tf-sidebar");
    const overlay   = document.getElementById("tf-sidebar-overlay");
    if (hamburger && sidebar && overlay) {
        hamburger.addEventListener("click", () => {
            sidebar.classList.toggle("open");
            overlay.classList.toggle("show");
        });
        overlay.addEventListener("click", () => {
            sidebar.classList.remove("open");
            overlay.classList.remove("show");
        });
    }

    // ── View assignment ───────────────────────────────────────
    document.querySelectorAll("[data-view-assignment]").forEach(btn => {
        btn.addEventListener("click", () => openViewAssignmentModal(+btn.dataset.viewAssignment, state.assignments));
    });

    // ── Delete assignment ─────────────────────────────────────
    document.querySelectorAll("[data-delete-assignment]").forEach(btn => {
        btn.addEventListener("click", async () => {
            if (!confirm("Delete this assignment? This cannot be undone.")) return;
            try {
                await api("DELETE", `/taskflow/api/assignments/${btn.dataset.deleteAssignment}`);
                await loadData(); renderAll(state, api);
                wireEvents(state, api, loadData, loadCalendar, loadAnalytics, loadFeedback);
                toast("Assignment deleted.");
            } catch (e) { toast(e.message, "error"); }
        });
    });

    // ── Submit assignment (student) ───────────────────────────
    document.querySelectorAll("[data-submit-assignment]").forEach(btn => {
        btn.addEventListener("click", () =>
            openSubmitModal(+btn.dataset.submitAssignment, state.assignments, api, state, loadData, loadFeedback)
        );
    });

    // ── Grade submission ──────────────────────────────────────
    document.querySelectorAll("[data-grade-submission]").forEach(btn => {
        btn.addEventListener("click", () =>
            openGradeModal(+btn.dataset.gradeSubmission, api, state, loadData, loadFeedback)
        );
    });

    // ── Release feedback ──────────────────────────────────────
    document.querySelectorAll("[data-release-feedback]").forEach(btn => {
        btn.addEventListener("click", async () => {
            try {
                await api("PATCH", `/taskflow/api/submissions/${btn.dataset.releaseFeedback}/release-feedback`);
                await loadData(); await loadFeedback();
                renderAll(state, api);
                wireEvents(state, api, loadData, loadCalendar, loadAnalytics, loadFeedback);
                toast("Feedback released to student!");
            } catch (e) { toast(e.message, "error"); }
        });
    });

    // ── Delete submission ─────────────────────────────────────
    document.querySelectorAll("[data-delete-submission]").forEach(btn => {
        btn.addEventListener("click", async () => {
            if (!confirm("Delete this submission?")) return;
            try {
                await api("DELETE", `/taskflow/api/submissions/${btn.dataset.deleteSubmission}`);
                await loadData(); renderAll(state, api);
                wireEvents(state, api, loadData, loadCalendar, loadAnalytics, loadFeedback);
                toast("Submission deleted.");
            } catch (e) { toast(e.message, "error"); }
        });
    });

    // ── Create assignment form ────────────────────────────────
    const createForm = document.getElementById("form-create-assignment");
    if (createForm) {
        createForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            const errEl = document.getElementById("create-error");
            errEl.style.display = "none";
            const title   = document.getElementById("na-title").value.trim();
            const subject = document.getElementById("na-subject").value.trim();
            const grade   = document.getElementById("na-grade").value.trim();
            const dueDate = document.getElementById("na-due").value;
            const points  = parseInt(document.getElementById("na-points").value, 10);
            if (!title || !subject || !grade || !dueDate || isNaN(points)) {
                errEl.style.display = "block"; errEl.textContent = "Please fill in all required fields."; return;
            }
            const btn = document.getElementById("btn-create-assignment");
            btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Posting…`;
            try {
                await api("POST", "/taskflow/api/assignments", {
                    title, subject, grade,
                    type:     document.getElementById("na-type").value,
                    priority: document.getElementById("na-priority").value,
                    quarter:  document.getElementById("na-quarter").value,
                    due_date: dueDate, points,
                    description: document.getElementById("na-desc").value.trim(),
                });
                await loadData(); renderAll(state, api);
                wireEvents(state, api, loadData, loadCalendar, loadAnalytics, loadFeedback);
                navigate("assignments", state);
                toast("Assignment posted successfully!");
            } catch (err) {
                errEl.style.display = "block"; errEl.textContent = err.message;
                toast(err.message, "error");
            } finally {
                btn.disabled = false; btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Post Assignment`;
            }
        });

        const clearBtn = document.getElementById("btn-clear-assignment");
        if (clearBtn) {
            clearBtn.addEventListener("click", () => {
                createForm.reset();
                const errEl = document.getElementById("create-error");
                if (errEl) errEl.style.display = "none";
            });
        }
    }
}

} // end __TASKFLOW_LOADED__ guard
