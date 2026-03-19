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
  const state = {
    channel: null,
    botProfileMap: new Map(),
    botStatusMap: new Map(),
    messageMap: new Map(),
    profileModal: null,
    onlineTextEl: null,
  };

  ensureChatStyle();
  ensureProfileModal();

  const username = () => String(store.get()?.player?.username || "Player").trim() || "Player";
  const telegramId = () => String(store.get()?.player?.telegramId || window.Telegram?.WebApp?.initDataUnsafe?.user?.id || "").trim();
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
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function normalizeMessage(row) {
    const meta = row?.player_meta && typeof row.player_meta === "object" ? row.player_meta : {};
    const usernameVal = String(row?.username || meta.username || row?.user || "?").trim() || "?";
    return {
      id: String(row?.id || `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
      username: usernameVal,
      text: String(row?.text || row?.message || ""),
      type: String(row?.msg_type || row?.type || "chat"),
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
    return [...state.messageMap.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).slice(-MAX_MESSAGES);
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
    for (const val of state.botStatusMap.values()) if (val) bots += 1;
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

      if (m.type === "system" || m.type === "presence" || m.type === "market" || m.type === "pvp") {
        body.innerHTML = `<div class="tc-chat-system-badge tc-chat-system-${escapeHtml(m.type)}">${escapeHtml(m.text)}</div>`;
      } else {
        const sender = document.createElement("button");
        sender.type = "button";
        sender.className = "tc-chat-user";
        sender.innerHTML = `${escapeHtml(m.username)}${m.player_meta?.clan ? ` <small>[${escapeHtml(m.player_meta.clan)}]</small>` : ""}${m.player_meta?.premium ? '<span class="tc-chat-premium">PREMIUM</span>' : ''}${m.player_meta?.online ? '<span class="tc-chat-online">ONLINE</span>' : ''}`;
        sender.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          openProfileCard(m.player_meta || { username: m.username });
        });

        const text = document.createElement("div");
        text.className = "tc-chat-text";
        text.textContent = m.text;

        body.appendChild(sender);
        body.appendChild(text);
      }

      row.appendChild(meta);
      row.appendChild(body);
      msgBox.appendChild(row);
    }
    updateOnlineLabel();
    msgBox.scrollTop = msgBox.scrollHeight;
  }

  function setOpen(isOpen) {
    if (isOpen) {
      drawer.classList.add("open");
      toggleBtn.textContent = "Kapat";
    } else {
      drawer.classList.remove("open");
      toggleBtn.textContent = "Aç";
    }
    try { localStorage.setItem(KEY_OPEN, isOpen ? "1" : "0"); } catch {}
  }

  function getOpen() {
    try { return localStorage.getItem(KEY_OPEN) === "1"; } catch { return false; }
  }

  async function send() {
    const text = String(input.value || "").trim();
    if (!text) return;
    input.value = "";

    const payload = {
      username: username(),
      message: text,
      player_meta: playerMeta(),
      created_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from("chat_messages")
        .insert(payload);
      if (error) throw error;
      addMessage({
        ...payload,
        id: `local_${Date.now()}`,
      });
    } catch (err) {
      console.error("[CHAT] send failed:", err);
      addMessage({
        ...payload,
        id: `local_${Date.now()}`,
      });
    }
  }

  async function loadHistory() {
    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(MAX_MESSAGES);
      if (error) throw error;
      applyMessages(data || []);
    } catch (err) {
      console.error("[CHAT] history load failed:", err);
      applyMessages(loadFallbackMessages());
    }
  }

  function subscribeRealtime() {
    try {
      state.channel?.unsubscribe?.();
    } catch (_) {}

    state.channel = supabase
      .channel("toncrime-chat-room")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          if (payload?.new) addMessage(payload.new);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("[CHAT] realtime subscribed");
        }
      });
  }

  function hardBindPointer(el, handler) {
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handler(e);
    }, { capture: true });
  }

  function ensureProfileModal() {
    if (document.getElementById("tcChatProfileModal")) {
      state.profileModal = document.getElementById("tcChatProfileModal");
      return;
    }
    const modal = document.createElement("div");
    modal.id = "tcChatProfileModal";
    modal.className = "tc-chat-profile-modal hidden";
    modal.innerHTML = `
      <div class="tc-chat-profile-card">
        <button class="tc-chat-profile-close" type="button">✕</button>
        <div class="tc-chat-profile-title" id="tcChatProfileTitle">Oyuncu</div>
        <div class="tc-chat-profile-sub" id="tcChatProfileSub">Bilgi</div>
        <div class="tc-chat-profile-grid">
          <div><span>Durum</span><b id="tcChatProfileOnline">Offline</b></div>
          <div><span>Seviye</span><b id="tcChatProfileLevel">1</b></div>
          <div><span>Clan</span><b id="tcChatProfileClan">Yok</b></div>
          <div><span>Premium</span><b id="tcChatProfilePremium">Hayır</b></div>
          <div><span>Rating</span><b id="tcChatProfileRating">1000</b></div>
          <div><span>Skor</span><b id="tcChatProfileScore">0/0</b></div>
        </div>
        <div class="tc-chat-profile-actions">
          <button type="button" data-action="friend">Arkadaş ekle</button>
          <button type="button" data-action="pvp">PvP çağır</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal || e.target.classList.contains("tc-chat-profile-close")) {
        modal.classList.add("hidden");
      }
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const action = btn.getAttribute("data-action");
      if (action === "friend") {
        window.dispatchEvent(new CustomEvent("tc:toast", { detail: { text: "Arkadaş sistemi yakında" } }));
      }
      if (action === "pvp") {
        window.dispatchEvent(new CustomEvent("tc:toast", { detail: { text: "PvP daveti gönderildi" } }));
      }
    });
    state.profileModal = modal;
  }

  function openProfileCard(meta) {
    const modal = state.profileModal;
    if (!modal) return;
    const title = modal.querySelector("#tcChatProfileTitle");
    const sub = modal.querySelector("#tcChatProfileSub");
    const online = modal.querySelector("#tcChatProfileOnline");
    const level = modal.querySelector("#tcChatProfileLevel");
    const clan = modal.querySelector("#tcChatProfileClan");
    const premium = modal.querySelector("#tcChatProfilePremium");
    const rating = modal.querySelector("#tcChatProfileRating");
    const score = modal.querySelector("#tcChatProfileScore");
    title.textContent = meta?.username || "Oyuncu";
    sub.textContent = meta?.isBot ? "Bot profil kartı" : "Oyuncu profil kartı";
    online.textContent = meta?.online ? "Online" : "Offline";
    level.textContent = String(meta?.level || 1);
    clan.textContent = meta?.clan || "Yok";
    premium.textContent = meta?.premium ? "Evet" : "Hayır";
    rating.textContent = String(meta?.rating || 1000);
    score.textContent = `${Number(meta?.wins || 0)}W / ${Number(meta?.losses || 0)}L`;
    modal.classList.remove("hidden");
  }

  function ensureChatStyle() {
    if (document.getElementById("tc-chat-style-v2")) return;
    const style = document.createElement("style");
    style.id = "tc-chat-style-v2";
    style.textContent = `
      #chatTitle { display:flex; align-items:center; justify-content:space-between; width:100%; }
      .tc-chat-online-count { font-size:11px; color:rgba(120,255,170,.84); margin-left:auto; margin-right:8px; }
      .tc-chat-row { align-items:flex-start; }
      .tc-chat-body { flex:1; min-width:0; }
      .tc-chat-user { background:none; border:0; padding:0; color:#fff; font:800 13px system-ui; cursor:pointer; display:flex; gap:6px; align-items:center; }
      .tc-chat-user small { color:rgba(255,255,255,.7); font-size:11px; }
      .tc-chat-premium { font-size:9px; padding:1px 6px; border-radius:999px; background:linear-gradient(180deg,#ffe79b,#ffc63d); color:#111; }
      .tc-chat-online { font-size:9px; padding:1px 6px; border-radius:999px; border:1px solid rgba(100,255,150,.24); color:#8cffb3; }
      .tc-chat-text { color:rgba(255,255,255,.92); font-size:13px; line-height:1.25; word-break:break-word; margin-top:3px; }
      .tc-chat-system-badge { display:inline-block; max-width:100%; padding:8px 12px; border-radius:12px; font:800 12px system-ui; }
      .tc-chat-system-system, .tc-chat-system-presence { background:linear-gradient(180deg,rgba(20,80,40,.72),rgba(8,32,18,.84)); border:1px solid rgba(120,255,170,.18); color:#d7ffe8; }
      .tc-chat-system-market { background:linear-gradient(180deg,rgba(66,48,16,.74),rgba(34,20,6,.84)); border:1px solid rgba(255,210,120,.22); color:#ffe8b4; }
      .tc-chat-system-pvp { background:linear-gradient(180deg,rgba(52,26,78,.78),rgba(22,10,40,.86)); border:1px solid rgba(210,150,255,.22); color:#efd9ff; }
      .tc-chat-profile-modal { position:fixed; inset:0; background:rgba(0,0,0,.56); z-index:12000; display:grid; place-items:center; padding:20px; }
      .tc-chat-profile-modal.hidden { display:none; }
      .tc-chat-profile-card { width:min(92vw,360px); border-radius:18px; border:1px solid rgba(255,255,255,.12); background:rgba(12,16,24,.96); color:#fff; padding:16px; position:relative; box-shadow:0 20px 60px rgba(0,0,0,.45); }
      .tc-chat-profile-close { position:absolute; right:12px; top:12px; width:32px; height:32px; border-radius:10px; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.06); color:#fff; }
      .tc-chat-profile-title { font:900 18px system-ui; margin-bottom:4px; }
      .tc-chat-profile-sub { color:rgba(255,255,255,.68); font-size:12px; margin-bottom:12px; }
      .tc-chat-profile-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
      .tc-chat-profile-grid div { padding:10px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.04); }
      .tc-chat-profile-grid span { display:block; color:rgba(255,255,255,.62); font-size:11px; margin-bottom:4px; }
      .tc-chat-profile-grid b { font-size:13px; }
      .tc-chat-profile-actions { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:14px; }
      .tc-chat-profile-actions button { height:38px; border-radius:12px; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.08); color:#fff; font:800 12px system-ui; }
    `;
    document.head.appendChild(style);
  }

  hardBindPointer(toggleBtn, () => setOpen(!drawer.classList.contains("open")));
  hardBindPointer(header, (e) => {
    if (e.target === toggleBtn) return;
    setOpen(!drawer.classList.contains("open"));
  });
  hardBindPointer(sendBtn, () => send());

  input.addEventListener("pointerdown", (e) => e.stopPropagation(), { capture: true });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") send();
  });

  const titleWrap = document.getElementById("chatTitle");
  if (titleWrap && !titleWrap.querySelector(".tc-chat-online-count")) {
    const onlineEl = document.createElement("span");
    onlineEl.className = "tc-chat-online-count";
    onlineEl.textContent = "1 online";
    titleWrap.appendChild(onlineEl);
    state.onlineTextEl = onlineEl;
  } else {
    state.onlineTextEl = titleWrap?.querySelector(".tc-chat-online-count") || null;
  }

  function visLoop() {
    const currentScene = window.tcScenes?._currentKey || "";
    drawer.style.display = currentScene === "profile" ? "none" : "";
    requestAnimationFrame(visLoop);
  }

  window.addEventListener("tc:chat:local-message", (e) => {
    const row = e?.detail;
    if (!row) return;
    addMessage({
      ...row,
      id: row.id || `local_evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` ,
      created_at: row.created_at || new Date().toISOString(),
    });
  });

  window.addEventListener("tc:bot:profiles", (e) => {
    const detail = e.detail || {};
    const bots = Array.isArray(detail.bots) ? detail.bots : [];
    for (const bot of bots) {
      if (!bot?.name) continue;
      state.botProfileMap.set(bot.name, bot);
      state.botStatusMap.set(bot.name, bot.online !== false);
    }
    updateOnlineLabel();
  });

  loadHistory();
  subscribeRealtime();
  setOpen(getOpen());
  visLoop();

  window.__tcChatApi = { renderMessages, openProfileCard };
}
