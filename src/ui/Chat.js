import { fetchBackendJson, supabase } from "../supabase.js";

const CHAT_STARTING_LEVEL = 0;
const CHAT_DEMO_PATTERN = /^(test|demo|deneme|sample|ornek|ornk)([\s\d!?.-]|$)/i;

const COPY = {
  tr: {
    title: "Sohbet",
    shortTitle: "Sohbet",
    toggleOpen: "Ac",
    toggleClose: "Kapat",
    toggleOpenAria: "Sohbeti ac",
    toggleCloseAria: "Sohbeti kapat",
    headerAria: "Genel sohbet",
    placeholder: "Mesaj yaz...",
    inputAria: "Sohbet mesaji",
    send: "Gonder",
    sendAria: "Mesaj gonder",
    emptyTitle: "Henuz mesaj yok",
    emptyBody: "Ilk mesaji sen gonder.",
    openProfile: "Profili gor",
    closeProfile: "Profili kapat",
    profileLevel: "Seviye",
    profileClan: "Clan",
    profileRating: "Rating",
    profileWins: "Galibiyet",
    profileLosses: "Maglubiyet",
    profilePremium: "Premium",
    yes: "Evet",
    no: "Hayir",
    none: "-",
  },
  en: {
    title: "Global Chat",
    shortTitle: "Chat",
    toggleOpen: "Open",
    toggleClose: "Close",
    toggleOpenAria: "Open chat",
    toggleCloseAria: "Close chat",
    headerAria: "Global chat",
    placeholder: "Write a message...",
    inputAria: "Chat message",
    send: "Send",
    sendAria: "Send message",
    emptyTitle: "No messages yet",
    emptyBody: "Be the first to say hello.",
    openProfile: "View profile",
    closeProfile: "Close profile",
    profileLevel: "Level",
    profileClan: "Clan",
    profileRating: "Rating",
    profileWins: "Wins",
    profileLosses: "Losses",
    profilePremium: "Premium",
    yes: "Yes",
    no: "No",
    none: "-",
  },
};

const langOf = (store) => (store?.get?.()?.lang === "en" ? "en" : "tr");
const copyOf = (store) => COPY[langOf(store)] || COPY.tr;
const parseTime = (value) => {
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
};

const readLevel = (value, fallback = CHAT_STARTING_LEVEL) => {
  const num = Number(value);
  return Number.isFinite(num) ? Math.max(CHAT_STARTING_LEVEL, Math.floor(num)) : fallback;
};

const isDemoMessage = (row) => {
  const text = String(row?.text || row?.message || "").trim().toLowerCase();
  const username = String(row?.username || row?.player_meta?.username || "").trim().toLowerCase();
  return CHAT_DEMO_PATTERN.test(text) || CHAT_DEMO_PATTERN.test(username);
};

function makeProfileLine(label, value) {
  const line = document.createElement("div");
  line.className = "tc-profile-line";

  const labelEl = document.createElement("span");
  labelEl.className = "tc-profile-label";
  labelEl.textContent = label;

  const valueEl = document.createElement("span");
  valueEl.className = "tc-profile-value";
  valueEl.textContent = value;

  line.appendChild(labelEl);
  line.appendChild(valueEl);
  return line;
}

export function startChat(store) {
  const drawer = document.getElementById("chatDrawer");
  const header = document.getElementById("chatHeader");
  const titleEl = document.getElementById("chatTitle");
  const msgBox = document.getElementById("chatMessages");
  const input = document.getElementById("chatInput");
  const sendBtn = document.getElementById("chatSend");
  const toggleBtn = document.getElementById("chatToggle");

  if (!drawer || !header || !msgBox || !input || !sendBtn || !toggleBtn) {
    console.warn("[CHAT] chat elements were not found in index.html");
    return null;
  }

  if (window.__tcChatStarted) return window.__tcChatApi;
  window.__tcChatStarted = true;

  const KEY_OPEN = "toncrime_chat_open_v1";
  const LOCAL_CACHE_KEY = "toncrime_chat_fallback_v2";
  const MAX_MESSAGES = 180;
  const HISTORY_POLL_MS = 5000;

  const state = {
    channel: null,
    messageMap: new Map(),
    profileModal: null,
    profileMessage: null,
    historyTimer: null,
  };

  let chatAuthPromise = null;
  let chatTransport = "backend";

  ensureChatStyle();
  ensureProfileModal();
  header.querySelectorAll(".tc-online-count").forEach((el) => el.remove());
  msgBox.setAttribute("aria-live", "polite");
  msgBox.setAttribute("aria-atomic", "false");

  const username = () =>
    String(store?.get?.()?.player?.username || "Player").trim() || "Player";

  const telegramId = () =>
    String(
      store?.get?.()?.player?.telegramId ||
        window.Telegram?.WebApp?.initDataUnsafe?.user?.id ||
        ""
    ).trim();

  const playerMeta = () => {
    const snapshot = store?.get?.() || {};
    const player = snapshot.player || {};
    const clan = snapshot.clan || {};
    return {
      username: username(),
      telegramId: telegramId(),
      level: readLevel(player.level),
      premium: !!(snapshot.premium || player.premium || player.isPremium),
      clan: String(clan.name || clan.tag || ""),
      rating: Number(snapshot.pvp?.rating || 1000),
      wins: Number(snapshot.pvp?.wins || 0),
      losses: Number(snapshot.pvp?.losses || 0),
      online: true,
      isBot: false,
    };
  };

  async function ensureChatAuthOnce() {
    try {
      const session = await supabase.auth.getSession();
      const currentUser = session?.data?.session?.user;
      if (currentUser) return currentUser;
    } catch {}

    if (chatAuthPromise) return chatAuthPromise;

    chatAuthPromise = Promise.resolve(
      typeof window.tcEnsureAuthSession === "function"
        ? window.tcEnsureAuthSession().catch(() => null)
        : null
    ).finally(() => {
      chatAuthPromise = null;
    });
    return chatAuthPromise;
  }

  async function resolveChatTransport() {
    await ensureChatAuthOnce().catch(() => null);
    chatTransport = "backend";
    return "backend";
  }

  function loadFallbackMessages() {
    try {
      const raw = localStorage.getItem(LOCAL_CACHE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((item) => !isDemoMessage(item)) : [];
    } catch {
      return [];
    }
  }

  function saveFallbackMessages(arr) {
    try {
      localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(arr.slice(-MAX_MESSAGES)));
    } catch {}
  }

  function hhmm(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return "--:--";
    return `${String(date.getHours()).padStart(2, "0")}:${String(
      date.getMinutes()
    ).padStart(2, "0")}`;
  }

  function normalizeMessage(row) {
    const meta =
      row?.player_meta && typeof row.player_meta === "object"
        ? row.player_meta
        : {};
    const user =
      String(row?.username || meta.username || row?.user || "?").trim() || "?";

    return {
      id: String(
        row?.id || `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      ),
      username: user,
      text: String(row?.text || row?.message || ""),
      type: String(row?.type || row?.msg_type || "chat"),
      created_at: row?.created_at || new Date().toISOString(),
      player_meta: {
        ...meta,
        username: user,
        isBot: !!meta.isBot,
        premium: !!meta.premium,
        clan: String(meta.clan || ""),
        level: readLevel(meta.level),
        rating: Number(meta.rating || 1000),
        wins: Number(meta.wins || 0),
        losses: Number(meta.losses || 0),
        online: meta.online !== false,
      },
    };
  }

  function sortedMessages() {
    return [...state.messageMap.values()]
      .sort((a, b) => parseTime(a.created_at) - parseTime(b.created_at))
      .slice(-MAX_MESSAGES);
  }

  function visibleMessages() {
    return sortedMessages().filter(
      (message) =>
        String(message?.player_meta?.kind || "").toLowerCase() !== "activity" &&
        !isDemoMessage(message)
    );
  }

  function persistFallback() {
    saveFallbackMessages(sortedMessages());
  }

  function addMessage(row, shouldRender = true) {
    if (isDemoMessage(row)) return;
    const message = normalizeMessage(row);
    state.messageMap.set(message.id, message);
    if (shouldRender) renderMessages();
    persistFallback();
  }

  function applyMessages(rows = []) {
    state.messageMap.clear();
    for (const row of rows) {
      if (isDemoMessage(row)) continue;
      const message = normalizeMessage(row);
      state.messageMap.set(message.id, message);
    }
    renderMessages();
    persistFallback();
  }

  function updateToggleLabel() {
    const copy = copyOf(store);
    const isOpen = drawer.classList.contains("open");
    const titleLabel = titleEl?.querySelector(".tc-chat-title-label");
    if (titleLabel) titleLabel.textContent = isOpen ? copy.title : copy.shortTitle;
    toggleBtn.textContent = isOpen ? copy.toggleClose : copy.toggleOpen;
    toggleBtn.setAttribute(
      "aria-label",
      isOpen ? copy.toggleCloseAria : copy.toggleOpenAria
    );
    toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }

  function updateComposerState() {
    sendBtn.disabled = !String(input.value || "").trim();
  }

  function renderMessages() {
    const copy = copyOf(store);
    const currentUser = username().toLowerCase();
    const messages = visibleMessages();
    msgBox.innerHTML = "";

    if (!messages.length) {
      const empty = document.createElement("div");
      empty.className = "tc-chat-empty";

      const title = document.createElement("div");
      title.className = "tc-chat-empty-title";
      title.textContent = copy.emptyTitle;

      const body = document.createElement("div");
      body.className = "tc-chat-empty-body";
      body.textContent = copy.emptyBody;

      empty.appendChild(title);
      empty.appendChild(body);
      msgBox.appendChild(empty);
      return;
    }

    for (const message of messages) {
      const row = document.createElement("div");
      row.className = `msg tc-chat-row tc-chat-type-${message.type}${
        message.username.toLowerCase() === currentUser ? " tc-chat-self" : ""
      }`;

      const time = document.createElement("div");
      time.className = "meta tc-chat-time";
      time.textContent = hhmm(message.created_at);

      const bubble = document.createElement("div");
      bubble.className = "tc-chat-body";

      const line = document.createElement("div");
      line.className = "tc-chat-line";

      const nameBtn = document.createElement("button");
      nameBtn.type = "button";
      nameBtn.className = `tc-chat-user${
        message.player_meta?.premium ? " premium" : ""
      }`;
      nameBtn.textContent = message.username;
      nameBtn.title = copy.openProfile;
      nameBtn.setAttribute("aria-label", copy.openProfile);
      nameBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        openProfileCard(message);
      });

      if (message.player_meta?.premium) {
        const badge = document.createElement("span");
        badge.className = "tc-premium-badge";
        badge.setAttribute("aria-hidden", "true");
        badge.textContent = "\u2605";
        nameBtn.appendChild(badge);
      }

      line.appendChild(nameBtn);

      if (message.player_meta?.clan) {
        const clan = document.createElement("span");
        clan.className = "tc-chat-clan";
        clan.textContent = `[${message.player_meta.clan}]`;
        line.appendChild(clan);
      }

      const separator = document.createElement("span");
      separator.className = "tc-chat-separator";
      separator.textContent = ":";

      const text = document.createElement("span");
      text.className = "tc-chat-text";
      text.textContent = message.text;

      line.appendChild(separator);
      line.appendChild(text);
      bubble.appendChild(line);
      row.appendChild(time);
      row.appendChild(bubble);
      msgBox.appendChild(row);
    }

    msgBox.scrollTop = msgBox.scrollHeight;
  }

  function openProfileCard(message) {
    ensureProfileModal();
    if (!state.profileModal) return;

    const copy = copyOf(store);
    const meta = message.player_meta || {};
    const title = state.profileModal.querySelector(".tc-profile-title");
    const body = state.profileModal.querySelector(".tc-profile-body");

    state.profileMessage = message;
    if (title) title.textContent = message.username;

    if (body) {
      body.innerHTML = "";
      body.appendChild(makeProfileLine(copy.profileLevel, String(readLevel(meta.level))));
      body.appendChild(makeProfileLine(copy.profileClan, String(meta.clan || copy.none)));
      body.appendChild(makeProfileLine(copy.profileRating, String(Number(meta.rating || 1000))));
      body.appendChild(makeProfileLine(copy.profileWins, String(Number(meta.wins || 0))));
      body.appendChild(makeProfileLine(copy.profileLosses, String(Number(meta.losses || 0))));
      body.appendChild(makeProfileLine(copy.profilePremium, meta.premium ? copy.yes : copy.no));
    }

    state.profileModal.classList.add("open");
  }

  function closeProfileCard() {
    if (!state.profileModal) return;
    state.profileModal.classList.remove("open");
    state.profileMessage = null;
  }

  function updateProfileChrome() {
    if (!state.profileModal) return;
    const closeBtn = state.profileModal.querySelector(".tc-profile-close");
    if (closeBtn) closeBtn.setAttribute("aria-label", copyOf(store).closeProfile);
  }

  function ensureProfileModal() {
    if (state.profileModal) {
      updateProfileChrome();
      return;
    }

    let modal = document.getElementById("tcChatProfileModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "tcChatProfileModal";
      modal.className = "tc-profile-modal";
      modal.innerHTML = `
        <div class="tc-profile-card" role="dialog" aria-modal="true">
          <button class="tc-profile-close" type="button">\u00d7</button>
          <div class="tc-profile-title">Player</div>
          <div class="tc-profile-body"></div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeProfileCard();
    });

    const closeBtn = modal.querySelector(".tc-profile-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        closeProfileCard();
      });
    }

    state.profileModal = modal;
    updateProfileChrome();
  }

  async function loadHistory() {
    try {
      await resolveChatTransport();
      const json = await fetchBackendJson("/public/chat/history");
      applyMessages(
        Array.isArray(json?.items) ? json.items : Array.isArray(json?.messages) ? json.messages : []
      );
    } catch (err) {
      console.error("[CHAT] backend history failed:", err);
      applyMessages(loadFallbackMessages());
    }
  }

  async function cleanupDemoMessages() {
    try {
      localStorage.removeItem(LOCAL_CACHE_KEY);
    } catch {}
  }

  async function send() {
    const text = String(input.value || "").trim();
    if (!text) return;

    input.value = "";
    updateComposerState();

    const payload = {
      identity_key: typeof window.tcGetIdentityKey === "function" ? window.tcGetIdentityKey() : "",
      profile_key: typeof window.tcGetProfileKey === "function" ? window.tcGetProfileKey() : "",
      username: username(),
      text,
      player_meta: playerMeta(),
    };

    try {
      await resolveChatTransport();
      const json = await fetchBackendJson("/public/chat/send", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (json?.item || json?.message) addMessage(json.item || json.message);
    } catch (err) {
      console.error("[CHAT] backend send failed:", err);
      input.value = text;
      updateComposerState();
    }
  }

  async function setupRealtime() {
    const authUser = await ensureChatAuthOnce().catch(() => null);
    if (!authUser?.id) return;

    try {
      if (state.channel) {
        supabase.removeChannel(state.channel);
        state.channel = null;
      }

      state.channel = supabase
        .channel("tc-chat-room")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_messages" },
          (payload) => payload?.new && addMessage(payload.new)
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") console.log("[CHAT] realtime subscribed");
        });
    } catch (err) {
      console.warn("[CHAT] realtime subscribe failed:", err);
    }
  }

  function syncReservedBottom() {
    if (!store?.get || !store?.set) return;
    const snapshot = store.get() || {};
    const ui = snapshot.ui || {};
    const safe = ui.safe || {};
    const viewportH = window.innerHeight || 0;
    const safeBottom = Math.max(
      0,
      viewportH - Number((safe.y || 0) + (safe.h || viewportH))
    );
    const nextReserved = Math.max(16, safeBottom + 10);
    if (Math.abs(Number(ui.chatReservedBottom || 0) - nextReserved) <= 1) return;

    store.set({ ui: { ...ui, chatReservedBottom: nextReserved } });
  }

  function syncDrawerPlacement() {
    const snapshot = store?.get?.() || {};
    const ui = snapshot.ui || {};
    const safe = ui.safe || {};
    const viewportW = window.innerWidth || 0;
    const viewportH = window.innerHeight || 0;
    const safeLeft = Math.max(0, Number(safe.x || 0));
    const safeTop = Math.max(0, Number(safe.y || 0));
    const safeRight = Math.max(
      0,
      viewportW - Number((safe.x || 0) + (safe.w || viewportW))
    );
    const safeBottom = Math.max(
      0,
      viewportH - Number((safe.y || 0) + (safe.h || viewportH))
    );
    const compact = viewportW <= 420;
    const mobile = viewportW <= 720;
    const marginX = compact ? 12 : mobile ? 14 : 18;
    const marginY = compact ? 14 : mobile ? 16 : 20;
    const maxWidth = Math.max(
      compact ? 260 : 300,
      viewportW - safeLeft - safeRight - marginX * 2
    );
    const maxHeight = Math.max(
      compact ? 230 : 260,
      viewportH - safeTop - safeBottom - marginY * 2
    );
    const openWidth = Math.min(compact ? 308 : mobile ? 348 : 420, maxWidth);
    const openHeight = Math.min(compact ? 292 : mobile ? 332 : 376, maxHeight);
    const minLeft = safeLeft + marginX;
    const maxLeft = Math.max(minLeft, viewportW - safeRight - openWidth - marginX);
    const minBottom = safeBottom + marginY;
    const maxBottom = Math.max(
      minBottom,
      viewportH - safeTop - openHeight - marginY
    );
    const centeredLeft = Math.round((viewportW - openWidth) / 2);
    const centeredBottom = Math.round((viewportH - openHeight) / 2);
    const openLeft = Math.max(minLeft, Math.min(maxLeft, centeredLeft));
    const openBottom = Math.max(minBottom, Math.min(maxBottom, centeredBottom));
    const titleWidth = Math.ceil(
      titleEl?.scrollWidth || titleEl?.getBoundingClientRect?.().width || 76
    );
    const closedWidth = Math.max(compact ? 94 : 108, titleWidth + (compact ? 22 : 28));
    const closedHeight = compact ? 42 : mobile ? 44 : 46;

    drawer.style.setProperty("--tc-chat-open-left", `${openLeft}px`);
    drawer.style.setProperty("--tc-chat-open-bottom", `${openBottom}px`);
    drawer.style.setProperty("--tc-chat-open-width", `${openWidth}px`);
    drawer.style.setProperty("--tc-chat-open-height", `${openHeight}px`);
    drawer.style.setProperty("--tc-chat-closed-width", `${closedWidth}px`);
    drawer.style.setProperty("--tc-chat-closed-height", `${closedHeight}px`);
  }

  const scheduleLayoutSync = () =>
    requestAnimationFrame(() => {
      syncReservedBottom();
      syncDrawerPlacement();
    });

  function setOpen(nextOpen) {
    drawer.classList.toggle("open", !!nextOpen);
    updateToggleLabel();
    scheduleLayoutSync();
    try {
      localStorage.setItem(KEY_OPEN, nextOpen ? "1" : "0");
    } catch {}
  }

  function restoreOpenState() {
    try {
      setOpen(localStorage.getItem(KEY_OPEN) === "1");
    } catch {
      setOpen(false);
    }
  }

  function applyLanguage() {
    const copy = copyOf(store);
    document.documentElement.lang = langOf(store);

    if (titleEl) {
      titleEl.innerHTML =
        '<span class="tc-chat-title-mark" aria-hidden="true"></span>' +
        `<span class="tc-chat-title-label">${copy.title}</span>`;
    }

    header.setAttribute("aria-label", copy.headerAria);
    input.placeholder = copy.placeholder;
    input.setAttribute("aria-label", copy.inputAria);
    sendBtn.textContent = copy.send;
    sendBtn.setAttribute("aria-label", copy.sendAria);

    updateToggleLabel();
    updateComposerState();
    updateProfileChrome();
    renderMessages();

    if (state.profileMessage && state.profileModal?.classList.contains("open")) {
      openProfileCard(state.profileMessage);
    }

    scheduleLayoutSync();
  }

  function bindUi() {
    toggleBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      setOpen(!drawer.classList.contains("open"));
    });

    header.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      setOpen(!drawer.classList.contains("open"));
    });

    sendBtn.addEventListener("click", () => {
      send().catch((err) => console.error("[CHAT] send failed:", err));
    });

    input.addEventListener("input", updateComposerState);
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      send().catch((err) => console.error("[CHAT] send failed:", err));
    });

    window.addEventListener("resize", scheduleLayoutSync);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeProfileCard();
    });

    store?.subscribe?.((next, prev) => {
      if ((next?.lang || "tr") !== (prev?.lang || "tr")) applyLanguage();
    });
  }

  function startPolling() {
    if (state.historyTimer) clearInterval(state.historyTimer);
    state.historyTimer = setInterval(() => {
      loadHistory().catch((err) =>
        console.error("[CHAT] history refresh failed:", err)
      );
    }, HISTORY_POLL_MS);
  }

  restoreOpenState();
  bindUi();
  applyLanguage();
  setupRealtime().catch((err) => console.warn("[CHAT] realtime bootstrap failed:", err));
  cleanupDemoMessages()
    .finally(() => loadHistory())
    .catch((err) => console.error("[CHAT] initial history failed:", err));
  startPolling();

  const api = {
    send,
    loadHistory,
    closeProfileCard,
    setTransport(mode) {
      if (mode === "backend" || mode === "auto") {
        chatTransport = "backend";
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
      left: calc(var(--sal, 0px) + 8px);
      right: auto;
      bottom: calc(var(--sab, 0px) + 8px);
      height: var(--tc-chat-closed-height, 46px);
      width: var(--tc-chat-closed-width, 118px);
      max-width: calc(100vw - var(--sal, 0px) - var(--sar, 0px) - 16px);
      z-index: 6000;
      border-radius: 999px;
      overflow: hidden;
      background:
        linear-gradient(135deg, rgba(255,181,111,0.07) 0%, rgba(101,42,21,0.04) 32%, rgba(9,12,18,0.03) 100%);
      border: 1px solid rgba(255,255,255,0.09);
      box-shadow:
        0 16px 38px rgba(0,0,0,0.14),
        0 0 0 1px rgba(255,255,255,0.02) inset,
        inset 0 1px 0 rgba(255,255,255,0.06);
      backdrop-filter: blur(18px) saturate(1.02);
      -webkit-backdrop-filter: blur(18px) saturate(1.02);
      transform: translate3d(0, 0, 0) scale(0.98);
      transform-origin: left bottom;
      transition:
        left 420ms cubic-bezier(0.22, 1, 0.36, 1),
        bottom 420ms cubic-bezier(0.22, 1, 0.36, 1),
        transform 420ms cubic-bezier(0.22, 1, 0.36, 1),
        width 420ms cubic-bezier(0.22, 1, 0.36, 1),
        height 420ms cubic-bezier(0.22, 1, 0.36, 1),
        border-radius 360ms cubic-bezier(0.22, 1, 0.36, 1),
        border-color 220ms ease,
        background 220ms ease,
        box-shadow 220ms ease;
    }

    #chatDrawer::before {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        radial-gradient(circle at top left, rgba(255,213,145,0.1), transparent 34%),
        radial-gradient(circle at bottom right, rgba(105,198,255,0.05), transparent 28%),
        linear-gradient(180deg, rgba(255,255,255,0.022), transparent 26%);
    }

    #chatDrawer.open {
      left: var(--tc-chat-open-left, 50vw);
      bottom: var(--tc-chat-open-bottom, 20vh);
      width: var(--tc-chat-open-width, 360px);
      height: var(--tc-chat-open-height, 360px);
      border-radius: 26px;
      transform: translate3d(0, 0, 0) scale(1);
      background:
        linear-gradient(180deg, rgba(11,15,22,0.08) 0%, rgba(11,15,22,0.04) 100%);
      box-shadow:
        0 20px 48px rgba(0,0,0,0.16),
        0 0 0 1px rgba(255,255,255,0.02) inset,
        inset 0 1px 0 rgba(255,255,255,0.05);
    }

    #chatDrawer,
    #chatDrawer * {
      box-sizing: border-box;
      touch-action: auto;
      -webkit-user-select: none;
      user-select: none;
    }

    #chatHeader {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 12px;
      min-height: 58px;
      padding: 13px 14px 11px;
      color: rgba(255,255,255,0.96);
      cursor: pointer;
      background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.008));
      border-bottom: 1px solid rgba(255,255,255,0.05);
      transition: min-height 280ms ease, padding 280ms ease, background 220ms ease;
    }

    #chatHeader::after {
      content: "";
      position: absolute;
      left: 50%;
      top: 7px;
      width: 54px;
      height: 4px;
      border-radius: 999px;
      transform: translateX(-50%);
      background: rgba(255,255,255,0.2);
    }

    #chatDrawer:not(.open) #chatHeader::after {
      display: none;
    }

    #chatDrawer:not(.open) #chatHeader {
      min-height: var(--tc-chat-closed-height, 46px);
      width: 100%;
      padding: 10px 14px;
      border-bottom-color: transparent;
      background: linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.004));
    }

    #chatDrawer:not(.open) {
      border-radius: 999px;
      border-color: rgba(255,255,255,0.07);
      box-shadow:
        0 10px 24px rgba(0,0,0,0.1),
        0 0 0 1px rgba(255,255,255,0.02) inset,
        inset 0 1px 0 rgba(255,255,255,0.05);
      backdrop-filter: blur(14px) saturate(1.01);
      -webkit-backdrop-filter: blur(14px) saturate(1.01);
    }

    #chatDrawer:not(.open) #chatBody {
      display: flex;
      opacity: 0;
      transform: translate3d(-10px, 18px, 0) scale(0.92);
      transform-origin: bottom left;
      pointer-events: none;
    }

    #chatDrawer:not(.open) .tc-chat-title-mark {
      width: 9px;
      height: 9px;
      flex-basis: 9px;
      box-shadow:
        0 0 10px rgba(255,223,153,0.28),
        0 0 18px rgba(109,236,195,0.18);
    }

    #chatDrawer:not(.open) .tc-chat-title-label {
      letter-spacing: 0.34px;
    }

    #chatDrawer:not(.open) #chatTitle {
      gap: 8px;
      max-width: none;
      transform: scale(0.94);
    }

    #chatTitle {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      color: rgba(255,226,168,0.96);
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.18px;
      text-transform: uppercase;
      font-family: "Palatino Linotype", "Book Antiqua", Georgia, serif;
      text-shadow: 0 1px 10px rgba(255,189,92,0.12);
      transform-origin: left center;
      transition: transform 280ms ease, letter-spacing 280ms ease;
    }

    .tc-chat-title-mark {
      width: 10px;
      height: 10px;
      flex: 0 0 10px;
      border-radius: 999px;
      background: linear-gradient(180deg, rgba(255,215,126,0.95), rgba(84,236,191,0.86));
      box-shadow: 0 0 12px rgba(255,215,126,0.24), 0 0 18px rgba(84,236,191,0.16);
    }

    .tc-chat-title-label {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    #chatToggle {
      display: none;
    }

    #chatBody {
      height: calc(100% - 58px);
      display: flex;
      flex-direction: column;
      background: linear-gradient(180deg, rgba(7,10,14,0.03), rgba(7,10,14,0.06));
      opacity: 1;
      transform: translate3d(0, 0, 0) scale(1);
      transform-origin: bottom left;
      transition:
        opacity 260ms ease,
        transform 420ms cubic-bezier(0.22, 1, 0.36, 1);
    }

    #chatMessages {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: 8px 10px 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      color: #fff;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.18) transparent;
    }

    #chatMessages::-webkit-scrollbar {
      width: 8px;
    }

    #chatMessages::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.16);
      border-radius: 999px;
    }

    .tc-chat-empty {
      margin: auto 0;
      padding: 18px 16px;
      border-radius: 18px;
      border: 1px dashed rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.03);
      text-align: center;
    }

    .tc-chat-empty-title {
      margin-bottom: 6px;
      color: rgba(255,255,255,0.96);
      font-size: 14px;
      font-weight: 800;
    }

    .tc-chat-empty-body {
      color: rgba(255,255,255,0.66);
      font-size: 12px;
      line-height: 1.45;
    }

    .tc-chat-row {
      display: grid;
      grid-template-columns: 38px minmax(0, 1fr);
      gap: 8px;
      align-items: baseline;
    }

    .tc-chat-time {
      min-height: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: flex-start;
      padding: 0;
      border-radius: 0;
      border: 0;
      background: transparent;
      color: rgba(255,228,176,0.72);
      font-size: 10px;
      letter-spacing: 0.2px;
      font-family: "Palatino Linotype", "Book Antiqua", Georgia, serif;
      text-shadow: 0 1px 6px rgba(255,189,92,0.1);
    }

    .tc-chat-body {
      min-width: 0;
      padding: 2px 0;
      border-radius: 0;
      border: 0;
      background: transparent;
      box-shadow: none;
    }

    .tc-chat-self .tc-chat-body {
      border: 0;
      background: transparent;
    }

    .tc-chat-type-system .tc-chat-body {
      border: 0;
      background: transparent;
    }

    .tc-chat-line {
      display: flex;
      align-items: baseline;
      gap: 4px 6px;
      flex-wrap: wrap;
      min-width: 0;
    }

    .tc-chat-user {
      appearance: none;
      display: inline-flex;
      align-items: center;
      padding: 0;
      border: 0;
      background: none;
      color: rgba(255,225,160,0.98);
      font-size: 12.5px;
      font-weight: 800;
      cursor: pointer;
      font-family: "Palatino Linotype", "Book Antiqua", Georgia, serif;
      letter-spacing: 0.18px;
      text-shadow: 0 1px 8px rgba(255,189,92,0.12);
    }

    .tc-chat-user:hover {
      opacity: 0.92;
    }

    .tc-chat-user.premium {
      color: rgba(255,236,184,0.99);
    }

    .tc-premium-badge {
      margin-left: 6px;
      font-size: 11px;
      color: rgba(255,236,184,0.99);
    }

    .tc-chat-clan {
      display: inline-flex;
      align-items: center;
      min-height: auto;
      padding: 0;
      border-radius: 0;
      border: 0;
      background: transparent;
      color: rgba(255,208,128,0.78);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.14px;
      font-family: "Palatino Linotype", "Book Antiqua", Georgia, serif;
    }

    .tc-chat-separator {
      color: rgba(255,213,136,0.86);
      font-size: 12px;
      font-weight: 700;
      font-family: "Palatino Linotype", "Book Antiqua", Georgia, serif;
    }

    .tc-chat-text {
      display: inline;
      flex: 1 1 140px;
      min-width: 0;
      color: rgba(255,224,164,0.94);
      font-size: 12.5px;
      line-height: 1.35;
      white-space: normal;
      word-break: break-word;
      font-family: "Palatino Linotype", "Book Antiqua", Georgia, serif;
      text-shadow: 0 1px 8px rgba(255,189,92,0.1);
    }

    #chatInputRow {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      padding: 12px;
      border-top: 1px solid rgba(255,255,255,0.06);
      background: linear-gradient(180deg, rgba(255,255,255,0.022), rgba(255,255,255,0.008));
    }

    #chatInput {
      width: 100%;
      min-width: 0;
      height: 42px;
      padding: 0 14px;
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.06);
      color: rgba(255,255,255,0.96);
      outline: none;
      font-size: 13px;
      user-select: text;
      -webkit-user-select: text;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }

    #chatInput::placeholder {
      color: rgba(255,255,255,0.44);
    }

    #chatInput:focus {
      border-color: rgba(255,214,140,0.28);
      background: rgba(255,255,255,0.08);
      box-shadow: 0 0 0 3px rgba(255,214,140,0.08);
    }

    #chatSend {
      appearance: none;
      min-width: 86px;
      height: 42px;
      padding: 0 16px;
      border-radius: 14px;
      border: 1px solid rgba(255,222,161,0.16);
      background: linear-gradient(180deg, rgba(248,216,151,0.92), rgba(197,123,46,0.9));
      color: #24160a;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 12px 24px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.28);
    }

    #chatSend:disabled {
      opacity: 0.48;
      cursor: not-allowed;
      filter: saturate(0.6);
      box-shadow: none;
    }

    #chatSend:focus-visible,
    #chatInput:focus-visible,
    .tc-chat-user:focus-visible,
    .tc-profile-close:focus-visible {
      outline: 2px solid rgba(255,214,140,0.44);
      outline-offset: 2px;
    }

    .tc-profile-modal {
      position: fixed;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 6200;
      padding: 16px;
      background: rgba(4,7,12,0.26);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }

    .tc-profile-modal.open {
      display: flex;
    }

    .tc-profile-card {
      position: relative;
      width: min(360px, 100%);
      padding: 18px;
      border-radius: 22px;
      border: 1px solid rgba(255,255,255,0.1);
      background: linear-gradient(180deg, rgba(8,11,16,0.72), rgba(8,11,16,0.54));
      color: #fff;
      box-shadow: 0 24px 60px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.06);
      backdrop-filter: blur(18px) saturate(1.08);
      -webkit-backdrop-filter: blur(18px) saturate(1.08);
    }

    .tc-profile-close {
      position: absolute;
      right: 12px;
      top: 10px;
      width: 36px;
      height: 36px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.06);
      color: rgba(255,255,255,0.96);
      font-size: 24px;
      line-height: 1;
      cursor: pointer;
    }

    .tc-profile-title {
      padding-right: 42px;
      margin-bottom: 14px;
      font-size: 18px;
      font-weight: 800;
    }

    .tc-profile-body {
      display: grid;
      gap: 8px;
    }

    .tc-profile-line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 9px 10px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.06);
      background: rgba(255,255,255,0.04);
      font-size: 13px;
    }

    .tc-profile-label {
      color: rgba(255,255,255,0.7);
      font-weight: 700;
    }

    .tc-profile-value {
      color: rgba(255,255,255,0.98);
      font-weight: 700;
      text-align: right;
    }

    @media (max-width: 720px) {
      #chatDrawer {
        left: calc(var(--sal, 0px) + 6px);
        right: auto;
        bottom: calc(var(--sab, 0px) + 6px);
      }

      #chatDrawer.open {
        border-radius: 22px;
      }

      #chatHeader {
        min-height: 54px;
        padding: 12px 12px 10px;
      }

      #chatDrawer:not(.open) #chatHeader {
        min-height: 44px;
        padding: 9px 12px;
      }

      #chatDrawer:not(.open) {
        height: 44px;
      }

      #chatBody {
        height: calc(100% - 54px);
      }

      #chatMessages {
        padding: 8px 10px 10px;
      }

      #chatInputRow {
        padding: 10px;
      }

      #chatInput,
      #chatSend {
        height: 40px;
      }
    }

    @media (max-width: 420px) {
      #chatDrawer.open {
        border-radius: 20px;
      }

      #chatHeader {
        min-height: 52px;
        padding: 11px 10px 9px;
      }

      #chatDrawer:not(.open) {
        height: 42px;
      }

      #chatHeader::after {
        width: 46px;
      }

      #chatTitle {
        gap: 8px;
        font-size: 12px;
      }

      #chatBody {
        height: calc(100% - 52px);
      }

      .tc-chat-row {
        grid-template-columns: 38px minmax(0, 1fr);
        gap: 8px;
      }

      .tc-chat-time {
        min-height: 18px;
        padding: 0;
        font-size: 10px;
      }

      .tc-chat-body {
        padding: 2px 0;
        border-radius: 0;
      }

      .tc-chat-user {
        font-size: 12px;
      }

      .tc-chat-text {
        font-size: 12px;
      }

      #chatInputRow {
        grid-template-columns: minmax(0, 1fr) 78px;
        gap: 8px;
        padding: 9px 10px 10px;
      }

      #chatInput,
      #chatSend {
        height: 38px;
        border-radius: 12px;
        font-size: 12px;
      }

      .tc-profile-card {
        padding: 16px;
      }

      .tc-profile-line {
        font-size: 12px;
      }
    }
  `;
  document.head.appendChild(style);
}
