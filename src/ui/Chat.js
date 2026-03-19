
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

  injectChatStyle();

  const username = () => store.get()?.player?.username ?? "Player";
  const friendSet = new Set();

  function nowHHMM() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

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

  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function systemClass(type) {
    switch (String(type || "")) {
      case "market": return "tc-chat-system-market";
      case "presence": return "tc-chat-system-presence";
      case "pvp": return "tc-chat-system-pvp";
      case "rare": return "tc-chat-system-rare";
      default: return "tc-chat-system-info";
    }
  }

  function makeUserMarkup(m) {
    const premium = m.premium ? `<span class="tc-chat-premium">PREM</span>` : "";
    const clan = m.clan ? `<span class="tc-chat-clan">[${escapeHtml(m.clan)}]</span>` : "";
    const online = m.online !== false ? `<span class="tc-chat-online">ONLINE</span>` : `<span class="tc-chat-offline">OFFLINE</span>`;
    return `
      <button class="tc-chat-userbtn" type="button"
        data-profile-id="${escapeHtml(m.profileId || "")}"
        data-user="${escapeHtml(m.user || "?")}"
        data-premium="${m.premium ? "1" : "0"}"
        data-clan="${escapeHtml(m.clan || "")}"
        data-online="${m.online !== false ? "1" : "0"}"
        data-level="${escapeHtml(String(m.level || 1))}"
        data-rating="${escapeHtml(String(m.rating || 1000))}"
        data-avatar="${escapeHtml(m.avatar || "🙂")}"
        data-bio="${escapeHtml(m.bio || "")}">
        ${escapeHtml(m.avatar || "🙂")} <span>${escapeHtml(m.user || "?")}</span>
      </button>
      ${clan}
      ${premium}
      ${online}
    `;
  }

  function appendMessage(m) {
    const row = document.createElement("div");
    row.className = `msg ${m.kind === "system" ? "tc-chat-system-row" : "tc-chat-user-row"}`;

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = m.time ?? "--:--";
    row.appendChild(meta);

    const body = document.createElement("div");
    body.className = "tc-chat-body";

    if (m.kind === "system") {
      body.innerHTML = `<div class="tc-chat-system-pill ${systemClass(m.systemType)}">${escapeHtml(m.text || "")}</div>`;
    } else {
      body.innerHTML = `
        <div class="tc-chat-headline">${makeUserMarkup(m)}</div>
        <div class="tc-chat-text">${escapeHtml(m.text || "")}</div>
      `;
    }

    row.appendChild(body);
    msgBox.appendChild(row);
    msgBox.scrollTop = msgBox.scrollHeight;
  }

  function renderMessages() {
    const msgs = loadMessages();
    msgBox.innerHTML = "";
    for (const m of msgs) appendMessage(m);
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

  function getOpen() {
    try {
      return localStorage.getItem(KEY_OPEN) === "1";
    } catch {
      return false;
    }
  }

  function send() {
    const text = (input.value || "").trim();
    if (!text) return;

    const msgs = loadMessages();
    const payload = {
      id: `local_${Date.now()}`,
      kind: "chat",
      user: username(),
      text,
      time: nowHHMM(),
      premium: false,
      clan: "",
      online: true,
      profileId: "player_main",
      isBot: false,
      level: Number(store.get()?.player?.level || 1),
      rating: Number(store.get()?.pvp?.rating || 1000),
      avatar: "🙂",
      bio: "Şehirde dolaşıyor.",
    };
    msgs.push(payload);
    if (msgs.length > 350) msgs.splice(0, msgs.length - 350);

    saveMessages(msgs);
    input.value = "";
    renderMessages();
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

  function closeProfileCard() {
    const old = drawer.querySelector(".tc-chat-profile-card");
    if (old) old.remove();
  }

  function openProfileCard(data) {
    closeProfileCard();
    const card = document.createElement("div");
    card.className = "tc-chat-profile-card";
    const isFriend = friendSet.has(data.profileId);
    card.innerHTML = `
      <button class="tc-chat-profile-close" type="button">✕</button>
      <div class="tc-chat-profile-avatar">${escapeHtml(data.avatar || "🙂")}</div>
      <div class="tc-chat-profile-name">${escapeHtml(data.user || "?")}</div>
      <div class="tc-chat-profile-meta">
        <span>${data.online === "1" ? "🟢 Online" : "⚫ Offline"}</span>
        <span>Lv ${escapeHtml(data.level || "1")}</span>
        <span>Rating ${escapeHtml(data.rating || "1000")}</span>
      </div>
      <div class="tc-chat-profile-badges">
        ${data.premium === "1" ? '<span class="tc-chat-premium">Premium</span>' : '<span class="tc-chat-offline">Standart</span>'}
        ${data.clan ? `<span class="tc-chat-clan">Clan ${escapeHtml(data.clan)}</span>` : '<span class="tc-chat-offline">Clan yok</span>'}
      </div>
      <div class="tc-chat-profile-bio">${escapeHtml(data.bio || "Şehirde aktif.")}</div>
      <div class="tc-chat-profile-actions">
        <button class="tc-chat-profile-action" data-action="friend">${isFriend ? "Arkadaş eklendi" : "Arkadaş ekle"}</button>
        <button class="tc-chat-profile-action" data-action="pvp">PvP çağır</button>
      </div>
    `;
    drawer.appendChild(card);

    card.querySelector(".tc-chat-profile-close")?.addEventListener("click", closeProfileCard);
    card.querySelector('[data-action="friend"]')?.addEventListener("click", () => {
      friendSet.add(data.profileId);
      card.querySelector('[data-action="friend"]').textContent = "Arkadaş eklendi";
    });
    card.querySelector('[data-action="pvp"]')?.addEventListener("click", () => {
      const msgs = loadMessages();
      msgs.push({
        id: `sys_${Date.now()}`,
        kind: "system",
        systemType: "pvp",
        user: "SYSTEM",
        text: `${data.user} PvP için çağrıldı`,
        time: nowHHMM(),
      });
      saveMessages(msgs);
      renderMessages();
      closeProfileCard();
    });
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
    const btn = e.target.closest(".tc-chat-userbtn");
    if (!btn) return;
    openProfileCard(btn.dataset);
  });

  function visLoop() {
    const currentScene = window.tcScenes?._currentKey || "";
    drawer.style.display = currentScene === "profile" ? "none" : "";
    requestAnimationFrame(visLoop);
  }

  window.addEventListener("tc:chat:refresh", renderMessages);
  window.addEventListener("tc:chat:add", () => {
    renderMessages();
  });

  window.tcChat = window.tcChat || {};
  window.tcChat.refresh = renderMessages;
  window.tcChat.openProfile = openProfileCard;

  renderMessages();
  setOpen(getOpen());
  visLoop();

  function injectChatStyle() {
    if (document.getElementById("tc-chat-upgrade-style")) return;
    const style = document.createElement("style");
    style.id = "tc-chat-upgrade-style";
    style.textContent = `
      #chatMessages .msg { align-items:flex-start; }
      .tc-chat-body { flex:1; min-width:0; }
      .tc-chat-system-row .tc-chat-body { padding-top:1px; }
      .tc-chat-system-pill {
        display:inline-block;
        padding:8px 12px;
        border-radius:12px;
        font-weight:800;
        font-size:12px;
        letter-spacing:.2px;
        border:1px solid rgba(255,255,255,0.12);
        backdrop-filter: blur(6px);
      }
      .tc-chat-system-market { background:rgba(0,110,255,0.14); color:#d8e8ff; border-color:rgba(90,170,255,0.28); }
      .tc-chat-system-presence { background:rgba(20,160,120,0.14); color:#dcfff2; border-color:rgba(80,255,190,0.22); }
      .tc-chat-system-pvp { background:rgba(255,90,90,0.15); color:#ffe3e3; border-color:rgba(255,120,120,0.28); }
      .tc-chat-system-rare { background:rgba(180,90,255,0.16); color:#f4e3ff; border-color:rgba(210,140,255,0.34); }
      .tc-chat-system-info { background:rgba(255,255,255,0.08); color:#fff; }
      .tc-chat-headline { display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-bottom:4px; }
      .tc-chat-userbtn {
        appearance:none; border:0; background:transparent; color:#fff; font-weight:900; padding:0; cursor:pointer;
      }
      .tc-chat-userbtn:hover { text-decoration:underline; }
      .tc-chat-premium, .tc-chat-clan, .tc-chat-online, .tc-chat-offline {
        display:inline-flex; align-items:center; height:18px; padding:0 6px; border-radius:999px; font-size:10px; font-weight:900;
      }
      .tc-chat-premium { background:linear-gradient(180deg,#ffe79b,#ffc63d); color:#111; }
      .tc-chat-clan { background:rgba(124,182,255,0.18); color:#dbe8ff; }
      .tc-chat-online { background:rgba(41,223,101,0.18); color:#d9ffe7; }
      .tc-chat-offline { background:rgba(255,255,255,0.10); color:#ddd; }
      .tc-chat-text { color:rgba(255,255,255,0.94); word-break:break-word; }
      .tc-chat-profile-card {
        position:absolute; left:10px; right:10px; bottom:54px; z-index:10001;
        background:rgba(10,10,14,0.92); border:1px solid rgba(255,255,255,0.14); border-radius:16px;
        padding:14px; backdrop-filter:blur(10px); box-shadow:0 14px 28px rgba(0,0,0,0.35);
      }
      .tc-chat-profile-close {
        position:absolute; right:10px; top:10px; width:30px; height:30px; border-radius:10px; border:1px solid rgba(255,255,255,0.14);
        background:rgba(255,255,255,0.06); color:#fff; cursor:pointer;
      }
      .tc-chat-profile-avatar { font-size:34px; margin-bottom:6px; }
      .tc-chat-profile-name { color:#fff; font-size:16px; font-weight:900; margin-bottom:6px; }
      .tc-chat-profile-meta, .tc-chat-profile-badges { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px; color:#ddd; font-size:12px; }
      .tc-chat-profile-bio { color:#cfcfcf; font-size:12px; margin-bottom:10px; }
      .tc-chat-profile-actions { display:flex; gap:8px; }
      .tc-chat-profile-action {
        flex:1; height:34px; border-radius:12px; border:1px solid rgba(255,255,255,0.14);
        background:rgba(255,255,255,0.08); color:#fff; font-weight:800; cursor:pointer;
      }
    `;
    document.head.appendChild(style);
  }
}
