export function startChat(store) {
  const KEY_MSG = "toncrime_chat_messages_v2";
  const KEY_OPEN = "toncrime_chat_open_v1";

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

  const username = () => store.get()?.player?.username ?? "Player";

  function injectChatStyle() {
    if (document.getElementById("tc-chat-bot-style")) return;
    const style = document.createElement("style");
    style.id = "tc-chat-bot-style";
    style.textContent = `
      #chatMessages .msg {
        display: grid;
        grid-template-columns: 50px 1fr;
        gap: 8px;
        align-items: start;
      }
      #chatMessages .msg.tc-system-row {
        grid-template-columns: 50px 1fr;
      }
      #chatMessages .msg .meta {
        opacity: 0.82;
      }
      .tc-chat-userline {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 2px;
        flex-wrap: wrap;
      }
      .tc-chat-namebtn {
        appearance: none;
        border: 0;
        background: transparent;
        padding: 0;
        margin: 0;
        color: rgba(255,255,255,0.96);
        font: inherit;
        font-weight: 800;
        cursor: pointer;
        text-align: left;
      }
      .tc-chat-namebtn.tc-premium {
        color: #ffd166;
        text-shadow: 0 0 10px rgba(255,209,102,0.18);
      }
      .tc-chat-badge {
        font-size: 10px;
        line-height: 1;
        padding: 3px 6px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.08);
        color: rgba(255,255,255,0.84);
      }
      .tc-chat-clan {
        color: #8fd3ff;
      }
      .tc-chat-text {
        color: rgba(255,255,255,0.94);
        word-break: break-word;
      }
      .tc-chat-system {
        padding: 7px 10px;
        border-radius: 10px;
        background: linear-gradient(180deg, rgba(82,115,255,0.14), rgba(0,0,0,0.08));
        border: 1px solid rgba(143,169,255,0.16);
        color: #bed0ff;
        font: 700 12px/1.35 system-ui, Arial, sans-serif;
        letter-spacing: 0.15px;
      }
      .tc-chat-system.info {
        background: linear-gradient(180deg, rgba(82,115,255,0.14), rgba(0,0,0,0.08));
        border-color: rgba(143,169,255,0.16);
        color: #bed0ff;
      }
      .tc-chat-system.market {
        background: linear-gradient(180deg, rgba(255,167,84,0.16), rgba(0,0,0,0.08));
        border-color: rgba(255,197,120,0.18);
        color: #ffd7a1;
      }
      .tc-chat-system.presence {
        background: linear-gradient(180deg, rgba(72,214,138,0.16), rgba(0,0,0,0.08));
        border-color: rgba(120,245,185,0.16);
        color: #b7ffd9;
      }
      .tc-chat-system.pvp {
        background: linear-gradient(180deg, rgba(255,95,95,0.16), rgba(0,0,0,0.08));
        border-color: rgba(255,138,138,0.16);
        color: #ffc3c3;
      }
      .tc-chat-overlay {
        position: fixed;
        inset: 0;
        z-index: 10050;
        display: none;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,0.45);
        backdrop-filter: blur(8px);
        padding: 16px;
      }
      .tc-chat-overlay.open {
        display: flex;
      }
      .tc-chat-profile {
        width: min(420px, calc(100vw - 24px));
        border-radius: 18px;
        border: 1px solid rgba(255,255,255,0.12);
        background: linear-gradient(180deg, rgba(24,28,40,0.96), rgba(10,12,18,0.98));
        box-shadow: 0 20px 50px rgba(0,0,0,0.35);
        color: #fff;
        overflow: hidden;
      }
      .tc-chat-profile-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 14px 14px 10px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      .tc-chat-profile-title {
        font: 900 16px system-ui, Arial, sans-serif;
      }
      .tc-chat-profile-close {
        appearance: none;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.06);
        color: #fff;
        border-radius: 10px;
        width: 34px;
        height: 34px;
        cursor: pointer;
      }
      .tc-chat-profile-body {
        padding: 14px;
      }
      .tc-chat-profile-top {
        display: grid;
        grid-template-columns: 62px 1fr;
        gap: 12px;
        align-items: center;
        margin-bottom: 14px;
      }
      .tc-chat-avatar {
        width: 62px;
        height: 62px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        font: 900 28px system-ui, Arial;
        background: radial-gradient(circle at 35% 30%, rgba(255,255,255,0.18), rgba(255,255,255,0.04));
        border: 1px solid rgba(255,255,255,0.12);
      }
      .tc-chat-profile-name {
        font: 900 18px system-ui, Arial;
      }
      .tc-chat-profile-sub {
        margin-top: 5px;
        color: rgba(255,255,255,0.72);
        font: 700 12px system-ui, Arial;
      }
      .tc-chat-profile-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 14px;
      }
      .tc-chat-profile-card {
        border-radius: 14px;
        padding: 10px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.04);
      }
      .tc-chat-profile-label {
        color: rgba(255,255,255,0.60);
        font: 700 11px system-ui, Arial;
        margin-bottom: 4px;
      }
      .tc-chat-profile-value {
        color: rgba(255,255,255,0.96);
        font: 800 13px system-ui, Arial;
      }
      .tc-chat-profile-actions {
        display: flex;
        gap: 10px;
      }
      .tc-chat-action-btn {
        flex: 1 1 auto;
        appearance: none;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.08);
        color: #fff;
        border-radius: 12px;
        min-height: 40px;
        cursor: pointer;
        font: 800 13px system-ui, Arial;
      }
      .tc-chat-action-btn.gold {
        background: linear-gradient(180deg, rgba(255,193,77,0.28), rgba(116,80,20,0.28));
        border-color: rgba(255,210,120,0.18);
      }
    `;
    document.head.appendChild(style);
  }

  injectChatStyle();

  const modal = document.createElement("div");
  modal.className = "tc-chat-overlay";
  modal.innerHTML = `
    <div class="tc-chat-profile">
      <div class="tc-chat-profile-head">
        <div class="tc-chat-profile-title">Oyuncu Profili</div>
        <button class="tc-chat-profile-close" type="button">✕</button>
      </div>
      <div class="tc-chat-profile-body"></div>
    </div>
  `;
  document.body.appendChild(modal);
  const modalBody = modal.querySelector(".tc-chat-profile-body");
  const closeModalBtn = modal.querySelector(".tc-chat-profile-close");

  function loadMessages() {
    try {
      const raw = localStorage.getItem(KEY_MSG);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveMessages(arr) {
    try {
      localStorage.setItem(KEY_MSG, JSON.stringify(arr));
    } catch {}
  }

  function getBotByName(name) {
    const bots = store.get()?.bots || [];
    return bots.find((b) => String(b.name || "").toLowerCase() === String(name || "").toLowerCase()) || null;
  }

  function getOpen() {
    try {
      return localStorage.getItem(KEY_OPEN) === "1";
    } catch {
      return false;
    }
  }

  function nowHHMM() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function ensureMessageShape(message = {}) {
    const kind = String(message.kind || "chat");
    return {
      id: String(message.id || `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
      kind,
      systemType: String(message.systemType || "info"),
      user: String(message.user || "?"),
      text: String(message.text || ""),
      time: String(message.time || nowHHMM()),
      premium: !!message.premium,
      clan: String(message.clan || ""),
      online: message.online !== false,
      profileId: String(message.profileId || ""),
      isBot: !!message.isBot,
    };
  }

  function renderMessages() {
    const msgs = loadMessages();
    msgBox.innerHTML = "";
    for (const m0 of msgs) {
      const m = ensureMessageShape(m0);
      const row = document.createElement("div");
      row.className = `msg ${m.kind === "system" ? "tc-system-row" : ""}`;

      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = m.time ?? "--:--";
      row.appendChild(meta);

      const content = document.createElement("div");

      if (m.kind === "system") {
        const text = document.createElement("div");
        text.className = `tc-chat-system ${m.systemType || "info"}`;
        text.textContent = m.text || "";
        content.appendChild(text);
      } else {
        const line = document.createElement("div");
        line.className = "tc-chat-userline";

        const nameBtn = document.createElement("button");
        nameBtn.type = "button";
        nameBtn.className = `tc-chat-namebtn ${m.premium ? "tc-premium" : ""}`;
        nameBtn.textContent = `${m.user ?? "?"}:`;
        nameBtn.dataset.user = m.user || "?";
        line.appendChild(nameBtn);

        if (m.premium) {
          const prem = document.createElement("span");
          prem.className = "tc-chat-badge";
          prem.textContent = "PREMIUM";
          line.appendChild(prem);
        }

        if (m.clan) {
          const clan = document.createElement("span");
          clan.className = "tc-chat-badge tc-chat-clan";
          clan.textContent = `[${m.clan}]`;
          line.appendChild(clan);
        }

        if (m.online) {
          const online = document.createElement("span");
          online.className = "tc-chat-badge";
          online.textContent = "ONLINE";
          line.appendChild(online);
        }

        const text = document.createElement("div");
        text.className = "tc-chat-text";
        text.textContent = m.text || "";

        content.appendChild(line);
        content.appendChild(text);
      }

      row.appendChild(content);
      msgBox.appendChild(row);
    }
    msgBox.scrollTop = msgBox.scrollHeight;
  }

  function pushExternalMessage(message) {
    const msgs = loadMessages();
    msgs.push(ensureMessageShape(message));
    if (msgs.length > 250) msgs.splice(0, msgs.length - 250);
    saveMessages(msgs);
    renderMessages();
  }

  function setOpen(isOpen) {
    if (isOpen) {
      drawer.classList.add("open");
      toggleBtn.textContent = "Kapat";
    } else {
      drawer.classList.remove("open");
      toggleBtn.textContent = "Aç";
    }
    try {
      localStorage.setItem(KEY_OPEN, isOpen ? "1" : "0");
    } catch {}
  }

  function saveFriend(name) {
    const state = store.get() || {};
    const social = { ...(state.social || {}) };
    const friends = Array.isArray(social.friends) ? social.friends.slice() : [];
    if (!friends.includes(name)) friends.push(name);
    store.set({ social: { ...social, friends } });
  }

  function isFriend(name) {
    const state = store.get() || {};
    return !!(state.social?.friends || []).includes(name);
  }

  function renderProfile(userName) {
    const state = store.get() || {};
    const playerName = String(state.player?.username || "Player");
    const isSelf = String(userName) === playerName;
    let profile = null;

    if (isSelf) {
      profile = {
        name: playerName,
        premium: !!(state.premium || state.player?.premium || state.player?.isPremium),
        clan: String(state.clan?.tag || state.clan?.name || ""),
        online: true,
        level: Number(state.player?.level || 1),
        rating: Number(state.pvp?.rating || 1000),
        avatar: "🕴️",
      };
    } else {
      const bot = getBotByName(userName);
      profile = {
        name: userName,
        premium: !!bot?.premium,
        clan: String(bot?.clan || ""),
        online: !!bot?.online,
        level: Number(bot?.level || (10 + Math.floor(Math.random() * 50))),
        rating: Number(bot?.rating || (900 + Math.floor(Math.random() * 500))),
        avatar: String(bot?.avatar || "🤖"),
        bio: String(bot?.bio || "Şehirde aktif bir oyuncu."),
      };
    }

    modalBody.innerHTML = `
      <div class="tc-chat-profile-top">
        <div class="tc-chat-avatar">${profile.avatar}</div>
        <div>
          <div class="tc-chat-profile-name">${profile.name}</div>
          <div class="tc-chat-profile-sub">${profile.online ? "Şu anda online" : "Şu anda offline"}${profile.bio ? " • " + profile.bio : ""}</div>
        </div>
      </div>
      <div class="tc-chat-profile-grid">
        <div class="tc-chat-profile-card">
          <div class="tc-chat-profile-label">Premium</div>
          <div class="tc-chat-profile-value">${profile.premium ? "Aktif" : "Yok"}</div>
        </div>
        <div class="tc-chat-profile-card">
          <div class="tc-chat-profile-label">Clan</div>
          <div class="tc-chat-profile-value">${profile.clan || "Yok"}</div>
        </div>
        <div class="tc-chat-profile-card">
          <div class="tc-chat-profile-label">Seviye</div>
          <div class="tc-chat-profile-value">LVL ${profile.level}</div>
        </div>
        <div class="tc-chat-profile-card">
          <div class="tc-chat-profile-label">PvP Rating</div>
          <div class="tc-chat-profile-value">${profile.rating}</div>
        </div>
      </div>
      <div class="tc-chat-profile-actions">
        <button class="tc-chat-action-btn gold" type="button" data-action="friend">${isFriend(profile.name) ? "Arkadaş eklendi" : "Arkadaş ekle"}</button>
        <button class="tc-chat-action-btn" type="button" data-action="close">Kapat</button>
      </div>
    `;
    modal.classList.add("open");

    modalBody.querySelector('[data-action="friend"]')?.addEventListener("click", () => {
      if (!isFriend(profile.name)) {
        saveFriend(profile.name);
        window.tcChat?.addMessage?.({
          kind: "system",
          systemType: "info",
          text: `${profile.name} arkadaş listene eklendi.`,
        });
      }
      renderProfile(profile.name);
    });

    modalBody.querySelector('[data-action="close"]')?.addEventListener("click", closeProfile);
  }

  function closeProfile() {
    modal.classList.remove("open");
  }

  function send() {
    const text = (input.value || "").trim();
    if (!text) return;

    pushExternalMessage({
      user: username(),
      text,
      time: nowHHMM(),
      kind: "chat",
      premium: !!(store.get()?.premium || store.get()?.player?.premium || store.get()?.player?.isPremium),
      clan: String(store.get()?.clan?.tag || store.get()?.clan?.name || ""),
      online: true,
      isBot: false,
    });

    input.value = "";

    const lower = text.toLowerCase();
    const bots = (store.get()?.bots || []).filter((b) => b.online);
    if (lower.includes("pvp") && lower.includes("online")) {
      const responder = bots[0] || (store.get()?.bots || [])[0];
      const answer = bots.length
        ? `var ben onlineyim, ${Math.max(1, bots.length - 1)} kişi daha var`
        : "şu an pek kimse yok ama birazdan girerler";
      setTimeout(() => {
        pushExternalMessage({
          user: responder?.name || "ShadowWolf",
          text: answer,
          kind: "chat",
          premium: !!responder?.premium,
          clan: String(responder?.clan || ""),
          online: true,
          isBot: true,
        });
      }, 900 + Math.random() * 900);
    }
  }

  function hardBindPointer(el, handler) {
    el.addEventListener(
      "pointerdown",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        handler(e);
      },
      { capture: true }
    );
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

  msgBox.addEventListener("click", (e) => {
    const btn = e.target.closest(".tc-chat-namebtn");
    if (!btn) return;
    renderProfile(btn.dataset.user || btn.textContent || "?");
  });

  closeModalBtn.addEventListener("click", closeProfile);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeProfile();
  });

  function visLoop() {
    const currentScene = window.tcScenes?._currentKey || "";
    drawer.style.display = currentScene === "profile" ? "none" : "";
    requestAnimationFrame(visLoop);
  }

  window.addEventListener("tc:chat:refresh", renderMessages);
  window.addEventListener("tc:chat:add", (ev) => {
    try {
      pushExternalMessage(ev?.detail || {});
    } catch (_) {}
  });

  window.tcChat = window.tcChat || {};
  window.tcChat.refresh = renderMessages;
  window.tcChat.addMessage = pushExternalMessage;
  window.tcChat.openProfile = renderProfile;

  renderMessages();
  setOpen(getOpen());
  visLoop();
}
