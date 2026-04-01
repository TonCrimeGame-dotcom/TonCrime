const COPY = {
  tr: {
    join: "{name} oyuna katildi",
    leave: "{name} oyundan cikti",
    premium: "{name} premium satin aldi",
    withdraw: "{name} {amount} TON cekim yapti",
    unknownUser: "Player",
  },
  en: {
    join: "{name} joined the game",
    leave: "{name} left the game",
    premium: "{name} purchased premium",
    withdraw: "{name} withdrew {amount} TON",
    unknownUser: "Player",
  },
};

const HISTORY_LIMIT = 180;
const HISTORY_POLL_MS = 4500;
const INITIAL_PREVIEW_LIMIT = 4;
const INITIAL_PREVIEW_WINDOW_MS = 10 * 60 * 1000;
const MAX_VISIBLE_ITEMS = 5;

function langOf(store) {
  return store?.get?.()?.lang === "en" ? "en" : "tr";
}

function copyOf(store) {
  return COPY[langOf(store)] || COPY.tr;
}

function nowIso() {
  return new Date().toISOString();
}

function parseTime(value) {
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function makeId(prefix = "activity") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function formatTemplate(template, values = {}) {
  return String(template || "").replace(/\{(\w+)\}/g, (_match, key) =>
    values[key] == null ? "" : String(values[key])
  );
}

function fmtTon(value, lang = "tr") {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "0";
  return numeric.toLocaleString(lang === "en" ? "en-US" : "tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: Number.isInteger(numeric) ? 0 : 3,
  });
}

function getBackendCandidates() {
  const raw = [
    window.TONCRIME_BACKEND_URL,
    window.__TONCRIME_BACKEND_URL__,
    localStorage.getItem("toncrime_backend_url"),
    localStorage.getItem("backendUrl"),
    "https://toncrime.onrender.com",
  ];

  const out = [];
  for (const item of raw) {
    const value = String(item || "").trim().replace(/\/$/, "");
    if (!value || out.includes(value)) continue;
    out.push(value);
  }
  return out;
}

function extractHistoryItems(json) {
  if (Array.isArray(json?.items)) return json.items;
  if (Array.isArray(json?.messages)) return json.messages;
  return [];
}

function extractSingleItem(json) {
  return json?.item || json?.message || null;
}

function playerNameOf(store, fallback = "") {
  const raw =
    String(store?.get?.()?.player?.username || "").trim() ||
    String(
      window.Telegram?.WebApp?.initDataUnsafe?.user?.username ||
        window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name ||
        ""
    ).trim() ||
    String(fallback || "").trim();

  return raw || copyOf(store).unknownUser;
}

function isActivityRow(row) {
  const meta = row?.player_meta;
  return !!meta && typeof meta === "object" && String(meta.kind || "").toLowerCase() === "activity";
}

function normalizeActivity(row, store) {
  const meta = row?.player_meta && typeof row.player_meta === "object" ? row.player_meta : null;
  if (!meta || String(meta.kind || "").toLowerCase() !== "activity") return null;

  const actor =
    String(meta.actor || meta.username || row?.username || "").trim() || playerNameOf(store);
  const event = String(meta.activityEvent || meta.event || "custom").trim().toLowerCase() || "custom";
  const activityId =
    String(meta.activityId || row?.id || "").trim() ||
    `${event}_${actor}_${parseTime(row?.created_at || meta.createdAt || nowIso())}`;

  return {
    id: String(row?.id || activityId),
    key: activityId,
    event,
    actor,
    createdAt: row?.created_at || meta.createdAt || nowIso(),
    amountTon: Number(meta.amountTon || meta.amount || 0),
    venueName: String(meta.venueName || "").trim(),
    message: String(meta.message || row?.text || "").trim(),
    messageTr: String(meta.messageTr || "").trim(),
    messageEn: String(meta.messageEn || "").trim(),
    sessionId: String(meta.sessionId || "").trim(),
  };
}

function normalizeLocalActivity(detail = {}, store) {
  const event = String(detail.event || "custom").trim().toLowerCase() || "custom";
  const actor = String(detail.actor || "").trim() || playerNameOf(store);
  const createdAt = detail.createdAt || nowIso();
  const key = String(detail.activityId || detail.id || makeId(event)).trim() || makeId(event);

  return {
    id: key,
    key,
    event,
    actor,
    createdAt,
    amountTon: Number(detail.amountTon || detail.amount || 0),
    venueName: String(detail.venueName || "").trim(),
    message: String(detail.message || "").trim(),
    messageTr: String(detail.messageTr || "").trim(),
    messageEn: String(detail.messageEn || "").trim(),
    sessionId: String(detail.sessionId || "").trim(),
  };
}

function fallbackTextOf(activity) {
  const copy = COPY.tr;
  switch (activity.event) {
    case "join":
      return formatTemplate(copy.join, { name: activity.actor });
    case "leave":
      return formatTemplate(copy.leave, { name: activity.actor });
    case "premium":
      return formatTemplate(copy.premium, { name: activity.actor });
    case "withdraw":
      return formatTemplate(copy.withdraw, {
        name: activity.actor,
        amount: fmtTon(activity.amountTon, "tr"),
      });
    default:
      return activity.messageTr || activity.messageEn || activity.message || "activity";
  }
}

function renderActivityText(activity, store) {
  const lang = langOf(store);
  const copy = copyOf(store);

  if (activity.event === "custom") {
    if (lang === "en" && activity.messageEn) return activity.messageEn;
    if (lang === "tr" && activity.messageTr) return activity.messageTr;
    return activity.messageEn || activity.messageTr || activity.message || "";
  }

  switch (activity.event) {
    case "join":
      return formatTemplate(copy.join, { name: activity.actor });
    case "leave":
      return formatTemplate(copy.leave, { name: activity.actor });
    case "premium":
      return formatTemplate(copy.premium, { name: activity.actor });
    case "withdraw":
      return formatTemplate(copy.withdraw, {
        name: activity.actor,
        amount: fmtTon(activity.amountTon, lang),
      });
    default:
      if (lang === "en" && activity.messageEn) return activity.messageEn;
      if (lang === "tr" && activity.messageTr) return activity.messageTr;
      return activity.messageEn || activity.messageTr || activity.message || "";
  }
}

async function fetchBackend(path, options = {}) {
  let lastErr = null;

  for (const base of getBackendCandidates()) {
    const url = `${base}${path}`;
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        lastErr = new Error(json?.error || `HTTP ${res.status}`);
        continue;
      }
      return json;
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr || new Error("activity backend unavailable");
}

export function startActivityTicker(store) {
  if (window.__tcActivityTickerStarted && window.tcActivityFeed) {
    return window.tcActivityFeed;
  }

  ensureStyle();

  let root = document.getElementById("tcActivityTicker");
  if (!root) {
    root = document.createElement("div");
    root.id = "tcActivityTicker";
    root.className = "tc-activity-ticker";
    root.setAttribute("aria-live", "polite");
    root.setAttribute("aria-atomic", "false");
    document.body.appendChild(root);
  }

  const sessionId = makeId("session");
  const state = {
    root,
    sessionId,
    seenKeys: new Set(),
    seenOrder: [],
    pollTimer: null,
    layoutUnsub: null,
    unloadSent: false,
    windowListeners: [],
  };

  function remember(key) {
    const value = String(key || "").trim();
    if (!value || state.seenKeys.has(value)) return;
    state.seenKeys.add(value);
    state.seenOrder.push(value);
    if (state.seenOrder.length > 800) {
      const removed = state.seenOrder.shift();
      if (removed) state.seenKeys.delete(removed);
    }
  }

  function isSeen(key) {
    const value = String(key || "").trim();
    return !!value && state.seenKeys.has(value);
  }

  function updateLayout() {
    const snapshot = store?.get?.() || {};
    const ui = snapshot.ui || {};
    const safe = ui.safe || {
      x: 0,
      y: 0,
      w: window.innerWidth || 0,
      h: window.innerHeight || 0,
    };
    const viewportW = window.innerWidth || safe.w || 0;
    const viewportH = window.innerHeight || safe.h || 0;
    const safeRight = Math.max(0, viewportW - (Number(safe.x || 0) + Number(safe.w || viewportW)));
    const safeBottom = Math.max(0, viewportH - (Number(safe.y || 0) + Number(safe.h || viewportH)));
    const right = safeRight + 18;
    const bottom = safeBottom + Math.max(18, Math.min(54, Number(ui.chatReservedBottom || 0) - 28 || 18));
    const maxWidth = Math.min(360, Math.max(220, Math.round((Number(safe.w || viewportW) || viewportW) * 0.52)));

    root.style.right = `${right}px`;
    root.style.bottom = `${bottom}px`;
    root.style.maxWidth = `${maxWidth}px`;
  }

  function pruneOverflow() {
    while (root.children.length > MAX_VISIBLE_ITEMS) {
      const oldest = root.firstElementChild;
      if (!oldest) return;
      removeNode(oldest, true);
    }
  }

  function removeNode(node, immediate = false) {
    if (!node) return;
    const timers = Array.isArray(node.__timers) ? node.__timers : [];
    for (const timer of timers) clearTimeout(timer);
    node.__timers = [];
    node.classList.add("fade");
    node.classList.remove("show");
    const removeNow = () => {
      try {
        node.remove();
      } catch {}
    };
    if (immediate) {
      removeNow();
      return;
    }
    window.setTimeout(removeNow, 260);
  }

  function updateVisibleTexts() {
    for (const node of root.children) {
      if (node?.__activity) node.textContent = renderActivityText(node.__activity, store);
    }
  }

  function showActivity(activity, delayMs = 0) {
    const text = renderActivityText(activity, store);
    if (!text) return;

    const mount = () => {
      const line = document.createElement("div");
      line.className = "tc-activity-item";
      line.textContent = text;
      line.__activity = activity;
      line.dataset.activityKey = activity.key;
      root.appendChild(line);
      pruneOverflow();

      requestAnimationFrame(() => {
        line.classList.add("show");
      });

      const visibleMs = activity.event === "leave" ? 4800 : 5600;
      const fadeTimer = window.setTimeout(() => {
        line.classList.add("fade");
      }, visibleMs);
      const removeTimer = window.setTimeout(() => {
        removeNode(line, true);
      }, visibleMs + 900);
      line.__timers = [fadeTimer, removeTimer];
    };

    if (delayMs > 0) {
      window.setTimeout(mount, delayMs);
      return;
    }
    mount();
  }

  function toPayload(activity) {
    return {
      username: activity.actor,
      text: fallbackTextOf(activity),
      player_meta: {
        kind: "activity",
        activityId: activity.key,
        activityEvent: activity.event,
        actor: activity.actor,
        amountTon: Number.isFinite(activity.amountTon) ? activity.amountTon : 0,
        venueName: activity.venueName,
        sessionId: activity.sessionId || state.sessionId,
        createdAt: activity.createdAt,
        message: activity.message,
        messageTr: activity.messageTr,
        messageEn: activity.messageEn,
      },
    };
  }

  async function publish(detail = {}, options = {}) {
    const activity = normalizeLocalActivity(
      {
        ...detail,
        sessionId: detail.sessionId || state.sessionId,
      },
      store
    );

    if (!isSeen(activity.key)) {
      remember(activity.key);
      if (options.showLocal !== false) showActivity(activity);
    }

    if (options.remote === false) return activity;

    try {
      const json = await fetchBackend("/public/chat/send", {
        method: "POST",
        body: JSON.stringify(toPayload(activity)),
      });
      const item = extractSingleItem(json);
      if (item && isActivityRow(item)) remember(normalizeActivity(item, store)?.key);
    } catch (err) {
      console.warn("[ACTIVITY] publish failed:", err);
    }

    return activity;
  }

  async function syncHistory({ preview = false } = {}) {
    try {
      const json = await fetchBackend(`/public/chat/history?limit=${HISTORY_LIMIT}`);
      const rows = extractHistoryItems(json);
      const activities = rows
        .filter(isActivityRow)
        .map((row) => normalizeActivity(row, store))
        .filter(Boolean)
        .sort((a, b) => parseTime(a.createdAt) - parseTime(b.createdAt));

      const fresh = [];
      for (const activity of activities) {
        if (isSeen(activity.key)) continue;
        remember(activity.key);
        fresh.push(activity);
      }

      if (!fresh.length) return;

      if (preview) {
        const now = Date.now();
        const previewItems = fresh
          .filter((activity) => now - parseTime(activity.createdAt) <= INITIAL_PREVIEW_WINDOW_MS)
          .slice(-INITIAL_PREVIEW_LIMIT);

        previewItems.forEach((activity, index) => {
          showActivity(activity, index * 220);
        });
        return;
      }

      fresh.slice(-MAX_VISIBLE_ITEMS).forEach((activity, index) => {
        showActivity(activity, index * 120);
      });
    } catch (err) {
      console.warn("[ACTIVITY] history sync failed:", err);
    }
  }

  function sendLeaveBeacon() {
    if (state.unloadSent) return;
    state.unloadSent = true;

    const activity = normalizeLocalActivity(
      {
        event: "leave",
        actor: playerNameOf(store),
        sessionId: state.sessionId,
        activityId: makeId("leave"),
      },
      store
    );
    const payload = JSON.stringify(toPayload(activity));
    const blob = new Blob([payload], { type: "application/json" });

    for (const base of getBackendCandidates()) {
      try {
        if (navigator.sendBeacon(`${base}/public/chat/send`, blob)) return;
      } catch {}
    }
  }

  function handleCustomEvent(event) {
    const detail = event?.detail && typeof event.detail === "object" ? event.detail : {};
    publish(detail).catch(() => {});
  }

  updateLayout();
  updateVisibleTexts();
  syncHistory({ preview: true });

  state.pollTimer = window.setInterval(() => {
    syncHistory();
  }, HISTORY_POLL_MS);

  state.layoutUnsub = store?.subscribe?.((next, prev) => {
    updateLayout();
    if ((next?.lang || "tr") !== (prev?.lang || "tr")) updateVisibleTexts();
  });

  const boundUpdateLayout = () => updateLayout();
  const boundPageHide = () => sendLeaveBeacon();
  const boundBeforeUnload = () => sendLeaveBeacon();
  const boundCustomEvent = (event) => handleCustomEvent(event);

  window.addEventListener("resize", boundUpdateLayout);
  window.addEventListener("pagehide", boundPageHide, { capture: true });
  window.addEventListener("beforeunload", boundBeforeUnload, { capture: true });
  window.addEventListener("tc:activity", boundCustomEvent);
  state.windowListeners.push(
    ["resize", boundUpdateLayout],
    ["pagehide", boundPageHide],
    ["beforeunload", boundBeforeUnload],
    ["tc:activity", boundCustomEvent]
  );

  window.setTimeout(() => {
    publish({
      event: "join",
      actor: playerNameOf(store),
      sessionId: state.sessionId,
      activityId: makeId("join"),
    }).catch(() => {});
  }, 1800);

  const api = {
    push(detail = {}) {
      return publish(detail);
    },
    dispose() {
      if (state.pollTimer) clearInterval(state.pollTimer);
      if (typeof state.layoutUnsub === "function") state.layoutUnsub();
      for (const [type, listener] of state.windowListeners) {
        window.removeEventListener(type, listener, type === "pagehide" || type === "beforeunload" ? { capture: true } : undefined);
      }
      window.__tcActivityTickerStarted = false;
      if (root?.parentNode) root.parentNode.removeChild(root);
    },
  };

  window.__tcActivityTickerStarted = true;
  window.tcActivityFeed = api;
  return api;
}

function ensureStyle() {
  if (document.getElementById("tcActivityTickerStyle")) return;

  const style = document.createElement("style");
  style.id = "tcActivityTickerStyle";
  style.textContent = `
    .tc-activity-ticker{
      position:fixed;
      right:18px;
      bottom:26px;
      z-index:5600;
      display:flex;
      flex-direction:column;
      align-items:flex-end;
      gap:8px;
      width:min(78vw, 360px);
      pointer-events:none;
    }
    .tc-activity-item{
      max-width:100%;
      color:rgba(255,244,218,.94);
      font:700 14px/1.35 "Trebuchet MS","Segoe UI",sans-serif;
      letter-spacing:.01em;
      text-align:right;
      text-shadow:
        0 1px 0 rgba(0,0,0,.52),
        0 0 14px rgba(0,0,0,.45),
        0 0 28px rgba(17,8,0,.34);
      opacity:0;
      transform:translate3d(0,10px,0);
      filter:drop-shadow(0 0 16px rgba(0,0,0,.18));
      transition:
        opacity .34s ease,
        transform .42s ease,
        filter .42s ease;
      will-change:opacity,transform,filter;
    }
    .tc-activity-item.show{
      opacity:1;
      transform:translate3d(0,0,0);
    }
    .tc-activity-item.fade{
      opacity:0;
      transform:translate3d(0,-8px,0);
      filter:drop-shadow(0 0 6px rgba(0,0,0,.08));
    }
    @media (max-width: 640px){
      .tc-activity-ticker{
        width:min(76vw, 300px);
        gap:7px;
      }
      .tc-activity-item{
        font-size:13px;
      }
    }
  `;
  document.head.appendChild(style);
}
