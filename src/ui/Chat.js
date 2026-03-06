export function startChat(store) {
  const KEY_MSG = "toncrime_chat_messages_v1";
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

  function renderMessages() {
    const msgs = loadMessages();
    msgBox.innerHTML = "";
    for (const m of msgs) {
      const row = document.createElement("div");
      row.className = "msg";

      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = m.time ?? "--:--";

      const text = document.createElement("div");
      text.textContent = `${m.user ?? "?"}: ${m.text ?? ""}`;

      row.appendChild(meta);
      row.appendChild(text);
      msgBox.appendChild(row);
    }
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

  function nowHHMM() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function send() {
    const text = (input.value || "").trim();
    if (!text) return;

    const msgs = loadMessages();
    msgs.push({ user: username(), text, time: nowHHMM() });
    if (msgs.length > 200) msgs.splice(0, msgs.length - 200);

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

  renderMessages();
  setOpen(getOpen());
}
