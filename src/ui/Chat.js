import { supabase } from "../supabase.js";

export function startChat(store) {
  const drawer = document.getElementById("chatDrawer");
  const header = document.getElementById("chatHeader");
  const toggleBtn = document.getElementById("chatToggle");
  const msgBox = document.getElementById("chatMessages");
  const input = document.getElementById("chatInput");
  const sendBtn = document.getElementById("chatSend");

  if (!drawer || !header || !toggleBtn || !msgBox || !input || !sendBtn) {
    console.warn("[CHAT] index.html chat elementleri bulunamadı");
    return;
  }

  if (window.__tcChatStarted) return window.__tcChatApi;
  window.__tcChatStarted = true;

  const KEY_OPEN = "toncrime_chat_open_v1";
  const LOCAL_CACHE_KEY = "toncrime_chat_fallback_v2";
  const MAX_MESSAGES = 180;
  const HISTORY_POLL_MS = 5000;

  const state = {
    channel: null,
    botProfileMap: new Map(),
    botStatusMap: new Map(),
    messageMap: new Map(),
    profileModal: null,
    onlineTextEl: null,
    historyTimer: null,
  };

  let chatAuthPromise = null;
  let chatTransport = "auto"; // auto | supabase | backend
  let warnedHistoryFallback = false;
  let warnedSendFallback = false;

  async function ensureChatAuthOnce() {
    try {
      const session = await supabase.auth.getSession();
      const currentUser = session?.data?.session?.user;
      if (currentUser) return currentUser;
    } catch {}

    if (chatTransport === "backend") return null;

    if (chatAuthPromise) return chatAuthPromise;
    chatAuthPromise = Promise.resolve(null).finally(() => {
      chatAuthPromise = null;
    });
    return chatAuthPromise;
  }

  async function resolveChatTransport() {
    if (chatTransport === "backend") return "backend";

    if (chatTransport === "supabase") {
      try {
        const session = await supabase.auth.getSession();
        if (session?.data?.session?.user) return "supabase";
      } catch {}
      chatTransport = "backend";
      return "backend";
    }

    const authUser = await ensureChatAuthOnce().catch(() => null);
    if (authUser) {
      chatTransport = "supabase";
      return "supabase";
    }

    chatTransport = "backend";
    return "backend";
  }

  function switchToBackend(reason, kind = "history") {
    chatTransport = "backend";

    if (kind === "send") {
      if (!warnedSendFallback) {
        warnedSendFallback = true;
        console.warn(
          "[CHAT] supabase send unavailable, backend moduna geçildi:",
          reason?.message || reason || "auth unavailable"
        );
      }
      return;
    }

    if (!warnedHistoryFallback) {
      warnedHistoryFallback = true;
      console.warn(
        "[CHAT] supabase history unavailable, backend moduna geçildi:",
        reason?.message || reason || "auth unavailable"
      );
    }
  }

  ensureChatStyle();
  ensureProfileModal();

  const username = () =>
    String(store.get()?.player?.username || "Player").trim() || "Player";

  const telegramId = () =>
    String(
      store.get()?.player?.telegramId ||
        window.Telegram?.WebApp?.initDataUnsafe?.user?.id ||
        ""
    ).trim();

  const playerMeta = () => {
    const s = store.get() || {};
    const p = s.player || {};
    const clan = s.clan || {};
    return {
      username: username(),
      telegramId: telegramId(),
      level: Number(p.level || 1),
      premium: !!(s.premium || p.premium || p.isPremium),
      clan: String(clan.name || clan.tag || ""),
      rating: Number(s.pvp?.rating || 1000),
      wins: Number(s.pvp?.wins || 0),
      losses: Number(s.pvp?.losses || 0),
      online: true,
      isBot: false,
    };
  };

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
      const val = String(item || "")
        .trim()
        .replace(/\/$/, "");
      if (!val) continue;
      if (!out.includes(val)) out.push(val);
    }
    return out;
  }

  async function fetchChatBackend(path, options = {}) {
    let lastErr = null;
    const candidates = getBackendCandidates();

    for (const base of candidates) {
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

    throw lastErr || new Error("chat backend unavailable");
  }

  function loadFallbackMessages() {
    try {
      const raw = localStorage.getItem(LOCAL_CACHE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveFallbackMessages(arr) {
    try {
      localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(arr.slice(-MAX_MESSAGES)));
    } catch {}
  }

  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function hhmm(value) {
    const d = value ? new Date(value) : new Date();
    if (Number.isNaN(d.getTime())) return "--:--";
    return `${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes()
    ).padStart(2, "0")}`;
  }

  function normalizeMessage(row) {
    const meta =
      row?.player_meta && typeof row.player_meta === "object"
        ? row.player_meta
        : {};

    const usernameVal =
      String(row?.username || meta.username || row?.user || "?").trim() || "?";

    return {
      id: String(
        row?.id || `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      ),
      username: usernameVal,
      text: String(row?.text || row?.message || ""),
      type: String(row?.type || "chat"),
      created_at: row?.created_at || new Date().toISOString(),
      player_meta: {
        ...meta,
        username: usernameVal,
        isBot: !!meta.isBot,
        premium: !!meta.premium,
        clan: String(meta.clan || ""),
        level: Number(meta.level || 1),
        rating: Number(meta.rating || 1000),
        wins: Number(meta.wins || 0),
        losses: Number(meta.losses || 0),
        online: meta.online !== false,
      },
    };
  }

  function sortMessages() {
    return [...state.messageMap.values()]
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .slice(-MAX_MESSAGES);
  }

  function persistFallback() {
    saveFallbackMessages(sortMessages());
  }

  function addMessage(row, shouldRender = true) {
    const msg = normalizeMessage(row);
    state.messageMap.set(msg.id, msg);

    if (msg.player_meta?.isBot) {
      state.botProfileMap.set(msg.username, msg.player_meta);
      state.botStatusMap.set(msg.username, msg.player_meta.online !== false);
    }

    if (shouldRender) renderMessages();
    persistFallback();
  }

  function applyMessages(rows = []) {
    state.messageMap.clear();
    for (const row of rows) addMessage(row, false);
    renderMessages();
    persistFallback();
  }

  function currentOnlineText() {
    const humans = 1;
    let bots = 0;
    for (const val of state.botStatusMap.values()) {
      if (val) bots += 1;
    }
    return `${humans + bots} online`;
  }

  function updateOnlineLabel() {
    if (!state.onlineTextEl) return;
    state.onlineTextEl.textContent = currentOnlineText();
  }

  function renderMessages() {
    const msgs = sortMessages();
    msgBox.innerHTML = "";

    for (const m of msgs) {
      const row = document.createElement("div");
      row.className = `msg tc-chat-row tc-chat-type-${m.type}`;

      const meta = document.createElement("div");
      meta.className = "meta tc-chat-time";
      meta.textContent = hhmm(m.created_at);

      const body = document.createElement("div");
      body.className = "tc-chat-body";

      const top = document.createElement("div");
      top.className = "tc-chat-topline";

      const nameBtn = document.createElement("button");
      nameBtn.type = "button";
      nameBtn.className = `tc-chat-user ${m.player_meta?.premium ? "premium" : ""}`;
      nameBtn.innerHTML = `${escapeHtml(m.username)}${
        m.player_meta?.premium ? ' <span class="tc-premium-badge">★</span>' : ""
      }`;

      nameBtn.addEventListener("click", () => openProfileCard(m));

      const clanEl = document.createElement("span");
      clanEl.className = "tc-chat-clan";
      clanEl.textContent = m.player_meta?.clan ? `[${m.player_meta.clan}]` : "";

      top.appendChild(nameBtn);
      if (clanEl.textContent) top.appendChild(clanEl);

      const text = document.createElement("div");
      text.className = "tc-chat-text";
      text.textContent = m.text;

      body.appendChild(top);
      body.appendChild(text);

      row.appendChild(meta);
      row.appendChild(body);
      msgBox.appendChild(row);
    }

    msgBox.scrollTop = msgBox.scrollHeight;
    updateOnlineLabel();
  }

  function openProfileCard(msg) {
    ensureProfileModal();
    if (!state.profileModal) return;

    const meta = msg.player_meta || {};
    const title = state.profileModal.querySelector(".tc-profile-title");
    const body = state.profileModal.querySelector(".tc-profile-body");

    if (title) title.textContent = msg.username;
    if (body) {
      body.innerHTML = `
        <div class="tc-profile-line"><b>Seviye:</b> ${Number(meta.level || 1)}</div>
        <div class="tc-profile-line"><b>Clan:</b> ${escapeHtml(meta.clan || "-")}</div>
        <div class="tc-profile-line"><b>Rating:</b> ${Number(meta.rating || 1000)}</div>
        <div class="tc-profile-line"><b>Galibiyet:</b> ${Number(meta.wins || 0)}</div>
        <div class="tc-profile-line"><b>Mağlubiyet:</b> ${Number(meta.losses || 0)}</div>
        <div class="tc-profile-line"><b>Premium:</b> ${meta.premium ? "Evet" : "Hayır"}</div>
        <div class="tc-profile-line"><b>Durum:</b> ${
          meta.online !== false ? "Online" : "Offline"
        }</div>
      `;
    }

    state.profileModal.classList.add("open");
  }

  function closeProfileCard() {
    if (!state.profileModal) return;
    state.profileModal.classList.remove("open");
  }

  function ensureProfileModal() {
    if (state.profileModal) return;

    let modal = document.getElementById("tcChatProfileModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "tcChatProfileModal";
      modal.className = "tc-profile-modal";
      modal.innerHTML = `
        <div class="tc-profile-card">
          <button class="tc-profile-close" type="button">×</button>
          <div class="tc-profile-title">Player</div>
          <div class="tc-profile-body"></div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeProfileCard();
    });

    const closeBtn = modal.querySelector(".tc-profile-close");
    if (closeBtn) closeBtn.addEventListener("click", closeProfileCard);

    state.profileModal = modal;
  }

  async function loadHistory() {
    const transport = await resolveChatTransport();

    if (transport === "backend") {
      try {
        const json = await fetchChatBackend("/public/chat/history");
        const rows = Array.isArray(json?.messages) ? json.messages : [];
        applyMessages(rows);
      } catch (err) {
        console.error("[CHAT] backend history failed:", err);
        applyMessages(loadFallbackMessages());
      }
      return;
    }

    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(MAX_MESSAGES);

      if (error) throw error;
      applyMessages(data || []);
    } catch (err) {
      switchToBackend(err, "history");
      return loadHistory();
    }
  }

  async function send() {
    const text = String(input.value || "").trim();
    if (!text) return;

    input.value = "";

    const payload = {
      username: username(),
      text,
      player_meta: playerMeta(),
    };

    const transport = await resolveChatTransport();

    if (transport === "backend") {
      try {
        const json = await fetchChatBackend("/public/chat/send", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (json?.message) addMessage(json.message);
      } catch (err) {
        console.error("[CHAT] backend send failed:", err);
      }
      return;
    }

    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .insert(payload)
        .select("*")
        .single();

      if (error) throw error;
      if (data) addMessage(data);
    } catch (err) {
      switchToBackend(err, "send");
      input.value = text;
      return send();
    }
  }

  function setupRealtime() {
    try {
      if (state.channel) {
        supabase.removeChannel(state.channel);
        state.channel = null;
      }

      state.channel = supabase
        .channel("tc-chat-room")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
          },
          (payload) => {
            if (payload?.new) addMessage(payload.new);
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            console.log("[CHAT] realtime subscribed");
          }
        });
    } catch (err) {
      console.warn("[CHAT] realtime subscribe failed:", err);
    }
  }

  function setOpen(nextOpen) {
    drawer.classList.toggle("open", !!nextOpen);
    try {
      localStorage.setItem(KEY_OPEN, nextOpen ? "1" : "0");
    } catch {}
  }

  function restoreOpenState() {
    try {
      const raw = localStorage.getItem(KEY_OPEN);
      setOpen(raw === "1");
    } catch {
      setOpen(false);
    }
  }

  function bindUi() {
    toggleBtn.addEventListener("click", () => {
      setOpen(!drawer.classList.contains("open"));
    });

    header.addEventListener("click", (e) => {
      if (e.target === input || e.target === sendBtn) return;
      setOpen(!drawer.classList.contains("open"));
    });

    sendBtn.addEventListener("click", () => {
      send().catch((err) => console.error("[CHAT] send failed:", err));
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        send().catch((err) => console.error("[CHAT] send failed:", err));
      }
    });
  }

  function startPolling() {
    if (state.historyTimer) clearInterval(state.historyTimer);
    state.historyTimer = setInterval(() => {
      loadHistory().catch((err) => console.error("[CHAT] history refresh failed:", err));
    }, HISTORY_POLL_MS);
  }

  function ensureHeaderOnlineText() {
    let el = drawer.querySelector(".tc-online-count");
    if (!el) {
      el = document.createElement("div");
      el.className = "tc-online-count";
      header.appendChild(el);
    }
    state.onlineTextEl = el;
    updateOnlineLabel();
  }

  restoreOpenState();
  bindUi();
  ensureHeaderOnlineText();
  setupRealtime();
  loadHistory().catch((err) => console.error("[CHAT] initial history failed:", err));
  startPolling();

  const api = {
    send,
    loadHistory,
    closeProfileCard,
    setTransport(mode) {
      if (mode === "supabase" || mode === "backend" || mode === "auto") {
        chatTransport = mode;
      }
    },
  };

  window.__tcChatApi = api;
  return api;
}

function ensureChatStyle() {
  if (document.getElementById("tcChatStyle")) return;

  const style = document.createElement("style");
  style.id = "tcChatStyle";
  style.textContent = `
    #chatDrawer {
      position: fixed;
      left: 10px;
      right: 10px;
      bottom: 10px;
      z-index: 1000;
      border-radius: 16px;
      overflow: hidden;
      background: rgba(5, 8, 12, 0.92);
      border: 1px solid rgba(255,255,255,0.08);
      box-shadow: 0 12px 30px rgba(0,0,0,0.38);
      transform: translateY(calc(100% - 42px));
      transition: transform 0.22s ease;
      backdrop-filter: blur(10px);
    }

    #chatDrawer.open {
      transform: translateY(0);
    }

    #chatHeader {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 12px;
      color: #fff;
      font-weight: 700;
      cursor: pointer;
      background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
    }

    .tc-online-count {
      margin-left: auto;
      font-size: 12px;
      color: #7dffb2;
      opacity: 0.95;
    }

    #chatMessages {
      max-height: 240px;
      overflow-y: auto;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      color: #fff;
    }

    .tc-chat-row {
      display: grid;
      grid-template-columns: 44px 1fr;
      gap: 8px;
      align-items: start;
    }

    .tc-chat-time {
      font-size: 11px;
      opacity: 0.7;
      padding-top: 6px;
    }

    .tc-chat-body {
      min-width: 0;
      border-radius: 12px;
      background: rgba(255,255,255,0.05);
      padding: 8px 10px;
    }

    .tc-chat-topline {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
      flex-wrap: wrap;
    }

    .tc-chat-user {
      appearance: none;
      border: 0;
      background: none;
      color: #fff;
      font-size: 13px;
      font-weight: 700;
      padding: 0;
      cursor: pointer;
    }

    .tc-chat-user.premium {
      color: #ffd76a;
    }

    .tc-premium-badge {
      color: #ffd76a;
    }

    .tc-chat-clan {
      font-size: 11px;
      color: #88d7ff;
      opacity: 0.9;
    }

    .tc-chat-text {
      font-size: 13px;
      line-height: 1.35;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .tc-profile-modal {
      position: fixed;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 1200;
      background: rgba(0,0,0,0.55);
      padding: 16px;
    }

    .tc-profile-modal.open {
      display: flex;
    }

    .tc-profile-card {
      width: min(360px, 100%);
      border-radius: 18px;
      background: #0b1017;
      color: #fff;
      border: 1px solid rgba(255,255,255,0.08);
      box-shadow: 0 20px 40px rgba(0,0,0,0.45);
      padding: 16px;
      position: relative;
    }

    .tc-profile-close {
      position: absolute;
      right: 10px;
      top: 8px;
      appearance: none;
      border: 0;
      background: none;
      color: #fff;
      font-size: 26px;
      cursor: pointer;
    }

    .tc-profile-title {
      font-size: 18px;
      font-weight: 800;
      margin-bottom: 10px;
    }

    .tc-profile-line {
      font-size: 14px;
      margin: 6px 0;
      opacity: 0.95;
    }

    #chatComposer {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      padding: 10px;
      border-top: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.02);
    }

    #chatInput {
      width: 100%;
      min-width: 0;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.06);
      color: #fff;
      padding: 10px 12px;
      outline: none;
    }

    #chatSend {
      appearance: none;
      border: 0;
      border-radius: 12px;
      padding: 10px 14px;
      font-weight: 700;
      color: #05110a;
      background: linear-gradient(180deg, #65f29f, #37c977);
      cursor: pointer;
    }
  `;

  document.head.appendChild(style);
}
