import { ClanSystem } from "../clan/ClanSystem.js";

function rr(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
function fillRR(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  rr(ctx, x, y, w, h, r);
  ctx.fill();
}
function strokeRR(ctx, x, y, w, h, r, color, line = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = line;
  rr(ctx, x, y, w, h, r);
  ctx.stroke();
}
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function fmtNum(n) { return Number(n || 0).toLocaleString("tr-TR"); }
function getPointer(input) { return input?.pointer || input?.p || input?.mouse || input?.state?.pointer || { x: 0, y: 0 }; }
function justPressed(input) {
  if (typeof input?.justPressed === "function") return !!input.justPressed();
  if (typeof input?.isJustPressed === "function") return !!input.isJustPressed("pointer") || !!input.isJustPressed("mouseLeft") || !!input.isJustPressed("touch");
  return !!input?._justPressed || !!input?.mousePressed;
}
function getRoleLabel(role) {
  if (role === "leader") return "Kurucu";
  if (role === "co_leader") return "Kurucu Yrd.";
  if (role === "officer") return "Subay";
  return "Üye";
}
function timeLeftText(pending) {
  if (!pending) return "";
  const remain = Math.max(0, (Number(pending.requestedAt || 0) + Number(pending.acceptAfterMs || 0)) - Date.now());
  const sec = Math.ceil(remain / 1000);
  return `${sec}s`;
}
function fitFont(base, mobile, min = 14) {
  return `${mobile ? Math.max(min, Math.floor(base * 0.72)) : base}px Arial`;
}
function fitBold(base, mobile, min = 15) {
  return `bold ${mobile ? Math.max(min, Math.floor(base * 0.72)) : base}px Arial`;
}
function textLine(ctx, text, x, y, maxWidth) {
  if (!maxWidth || ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, x, y);
    return;
  }
  let t = String(text);
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
  ctx.fillText(t + "…", x, y);
}
function getCanvasCssSize(canvas) {
  const rect = canvas?.getBoundingClientRect?.();
  const dpr = Math.max(1, window.devicePixelRatio || 1);

  let w = Math.round(rect?.width || 0);
  let h = Math.round(rect?.height || 0);

  if (!w || !h) {
    w = Math.round((canvas?.width || window.innerWidth) / dpr);
    h = Math.round((canvas?.height || window.innerHeight) / dpr);
  }

  return { w, h };
}

export class ClanScene {
  constructor({ store, input, i18n, assets, scenes }) {
    this.store = store;
    this.input = input;
    this.i18n = i18n;
    this.assets = assets;
    this.scenes = scenes;
    this.buttons = [];
    this.searchFocused = false;
    this.inviteFocused = false;
    this.search = "";
    this.inviteName = "";
    this.tab = "overview";
    this.layout = null;
  }

  onEnter() {
    this.bindKeyboard();
    const directory = ClanSystem.getDirectory(this.store);
    this.search = directory?.player?.search || "";
    this.inviteName = "";
  }
  onExit() { this.unbindKeyboard(); }

  bindKeyboard() {
    this._onKey = (e) => {
      if (this.searchFocused) {
        if (e.key === "Backspace") { this.search = this.search.slice(0, -1); this.writeDirectorySearch(); return; }
        if (e.key.length === 1) { this.search = (this.search + e.key).slice(0, 22); this.writeDirectorySearch(); return; }
      }
      if (this.inviteFocused) {
        if (e.key === "Backspace") { this.inviteName = this.inviteName.slice(0, -1); return; }
        if (e.key === "Enter") { ClanSystem.createInvite(this.store, this.inviteName); this.inviteName = ""; return; }
        if (e.key.length === 1) this.inviteName = (this.inviteName + e.key).slice(0, 18);
      }
    };
    window.addEventListener("keydown", this._onKey);
  }
  unbindKeyboard() {
    if (this._onKey) {
      window.removeEventListener("keydown", this._onKey);
      this._onKey = null;
    }
  }

  writeDirectorySearch() {
    const s = this.store.get();
    const cd = { ...(s.clanDirectory || {}) };
    const player = { ...(cd.player || {}) };
    player.search = this.search;
    cd.player = player;
    this.store.set({ clanDirectory: cd });
  }

  getState() { return this.store?.get ? this.store.get() : {}; }

  getLayout(ctx) {
    const state = this.getState();
    const size = getCanvasCssSize(ctx?.canvas);
    const cssW = size.w;
    const cssH = size.h;

    const safe = state?.ui?.safe || { x: 0, y: 0, w: cssW, h: cssH };
    const hudReservedTop = Number(state?.ui?.hudReservedTop || 86);
    const chatReservedBottom = Number(state?.ui?.chatReservedBottom || 58);

    const safeX = Number(safe.x || 0);
    const safeY = Number(safe.y || 0);
    const safeW = Math.max(0, Number(safe.w || cssW));
    const safeH = Math.max(0, Number(safe.h || cssH));

    const mobile = safeW <= 760;
    const pad = mobile ? 10 : Math.max(14, Math.floor(safeW * 0.035));
    const gap = mobile ? 10 : 16;
    const top = safeY + Math.max(mobile ? 8 : 10, hudReservedTop);
    const bottomPad = Math.max(mobile ? 66 : 84, chatReservedBottom + (mobile ? 8 : 12));

    if (mobile) {
      const leftX = safeX + pad;
      const leftY = top;
      const leftW = Math.max(120, safeW - pad * 2);
      const leftH = Math.min(188, Math.max(160, Math.floor(safeH * 0.28)));

      const rightX = leftX;
      const rightY = leftY + leftH + gap;
      const rightW = leftW;
      const rightH = Math.max(120, safeY + safeH - rightY - bottomPad);

      return {
        mobile,
        w: cssW,
        h: cssH,
        pad,
        gap,
        top,
        bottomPad,
        safeX,
        safeY,
        safeW,
        safeH,
        leftX,
        leftY,
        leftW,
        leftH,
        rightX,
        rightY,
        rightW,
        rightH,
      };
    }

    const leftX = safeX + pad;
    const leftY = top;
    const leftW = Math.min(300, safeW * 0.34);
    const leftH = Math.max(120, safeY + safeH - top - bottomPad);
    const rightX = leftX + leftW + gap;
    const rightY = top;
    const rightW = Math.max(120, safeX + safeW - rightX - pad);
    const rightH = leftH;

    return {
      mobile,
      w: cssW,
      h: cssH,
      pad,
      gap,
      top,
      bottomPad,
      safeX,
      safeY,
      safeW,
      safeH,
      leftX,
      leftY,
      leftW,
      leftH,
      rightX,
      rightY,
      rightW,
      rightH,
    };
  }

  update() {
    ClanSystem.tickPending(this.store);
    const pressed = justPressed(this.input);
    if (!pressed) return;
    const p = getPointer(this.input);
    const px = Number(p.x || 0);
    const py = Number(p.y || 0);
    this.searchFocused = false;
    this.inviteFocused = false;
    for (const btn of this.buttons) {
      if (px >= btn.x && px <= btn.x + btn.w && py >= btn.y && py <= btn.y + btn.h) { btn.onClick?.(); return; }
    }
  }

  render(ctx) {
    const state = this.getState();
    const clan = ClanSystem.getClan(this.store);
    const directory = ClanSystem.getDirectory(this.store);
    const L = this.layout = this.getLayout(ctx);

    ctx.fillStyle = "#061124";
    ctx.fillRect(0, 0, L.w, L.h);

    fillRR(ctx, L.leftX, L.leftY, L.leftW, L.leftH, L.mobile ? 18 : 26, "#0b1730");
    fillRR(ctx, L.rightX, L.rightY, L.rightW, L.rightH, L.mobile ? 18 : 26, "#0d1c39");
    strokeRR(ctx, L.leftX, L.leftY, L.leftW, L.leftH, L.mobile ? 18 : 26, "#1f3d6d", 2);
    strokeRR(ctx, L.rightX, L.rightY, L.rightW, L.rightH, L.mobile ? 18 : 26, "#274677", 2);

    this.buttons = [];
    this.drawLeftRail(ctx, L.leftX, L.leftY, L.leftW, L.leftH, state, clan, directory);
    if (!clan) this.drawDiscovery(ctx, L.rightX, L.rightY, L.rightW, L.rightH, state, directory);
    else this.drawClanView(ctx, L.rightX, L.rightY, L.rightW, L.rightH, state, clan);
  }

  drawLeftRail(ctx, x, y, w, h, state, clan, directory) {
    const player = state.player || {};
    const pending = directory?.player?.pendingRequest || null;
    const mobile = !!this.layout?.mobile;
    const px = mobile ? 14 : 18;
    const titleX = x + (mobile ? 18 : 22);

    ctx.fillStyle = "#fff";
    ctx.font = fitBold(28, mobile, 18);
    ctx.fillText("CLAN", titleX, y + (mobile ? 30 : 40));
    ctx.fillStyle = "#8fb3ff";
    ctx.font = fitFont(16, mobile, 12);
    ctx.fillText("Tam entegre clan ağı", titleX, y + (mobile ? 50 : 64));

    const card1H = mobile ? 88 : 116;
    fillRR(ctx, x + px, y + (mobile ? 64 : 86), w - px * 2, card1H, mobile ? 16 : 22, "#102346");
    ctx.fillStyle = "#fff";
    ctx.font = fitBold(22, mobile, 16);
    textLine(ctx, player.username || player.name || "Player", x + px + 16, y + (mobile ? 90 : 122), w - px * 2 - 32);
    ctx.fillStyle = "#9fc2ff";
    ctx.font = fitFont(18, mobile, 12);
    ctx.fillText(`Seviye ${player.level || 1}`, x + px + 16, y + (mobile ? 112 : 148));
    ctx.fillText(`Bakiye ${fmtNum(state.coins)} yTon`, x + px + 16, y + (mobile ? 132 : 174));

    const card2Y = y + (mobile ? 162 : 222);
    const card2H = mobile ? 98 : 128;
    fillRR(ctx, x + px, card2Y, w - px * 2, card2H, mobile ? 16 : 22, clan ? "#123323" : "#1a2442");
    ctx.fillStyle = clan ? "#7cf2a8" : "#dbe8ff";
    ctx.font = fitBold(20, mobile, 15);
    ctx.fillText(clan ? "Clan Avantajları Aktif" : "Clan Avantajları", x + px + 16, card2Y + (mobile ? 24 : 32));
    ctx.font = fitFont(16, mobile, 11);
    const lines = clan
      ? ["• Bina koruması açık", "• Ödül paylaşımı aktif", "• Davet ekranı açık"]
      : ["• Seviye 10'da clan kur", "• Başvuru gönder", "• Kabulde koruma açılır"];
    lines.forEach((line, i) => ctx.fillText(line, x + px + 16, card2Y + (mobile ? 48 : 62) + i * (mobile ? 16 : 24)));

    let actionBottom = y + h - (mobile ? 52 : 60);

    if (pending && !clan && !mobile) {
      fillRR(ctx, x + px, y + 366, w - px * 2, 136, 22, "#33241d");
      ctx.fillStyle = "#ffd6a5";
      ctx.font = fitBold(20, false, 20);
      ctx.fillText("Bekleyen Başvuru", x + px + 16, y + 398);
      ctx.font = fitFont(18, false, 18);
      ctx.fillText(`${pending.logo || "👑"} ${pending.clanName}`, x + px + 16, y + 426);
      ctx.fillText(`Tahmini onay: ${timeLeftText(pending)}`, x + px + 16, y + 452);

      const cancelBtn = { x: x + px + 16, y: y + 470, w: w - px * 2 - 32, h: 42, onClick: () => ClanSystem.cancelJoinRequest(this.store) };
      this.buttons.push(cancelBtn);
      fillRR(ctx, cancelBtn.x, cancelBtn.y, cancelBtn.w, cancelBtn.h, 14, "#70363a");
      ctx.fillStyle = "#fff";
      ctx.font = fitBold(18, false, 18);
      ctx.fillText("Başvuruyu İptal Et", cancelBtn.x + 42, cancelBtn.y + 27);
    } else if (pending && !clan && mobile) {
      const infoY = y + h - 92;
      ctx.fillStyle = "#ffd6a5";
      ctx.font = fitFont(14, true, 11);
      textLine(ctx, `Bekleyen: ${pending.clanName} • ${timeLeftText(pending)}`, x + 16, infoY, w - 32);
      const cancelBtn = { x: x + 14, y: y + h - 70, w: w - 28, h: 32, onClick: () => ClanSystem.cancelJoinRequest(this.store) };
      this.buttons.push(cancelBtn);
      fillRR(ctx, cancelBtn.x, cancelBtn.y, cancelBtn.w, cancelBtn.h, 12, "#70363a");
      ctx.fillStyle = "#fff";
      ctx.font = fitBold(15, true, 12);
      ctx.fillText("Başvuruyu İptal Et", cancelBtn.x + 16, cancelBtn.y + 21);
      actionBottom = cancelBtn.y;
    }

    if (clan) {
      const leaveBtn = { x: x + px, y: actionBottom, w: w - px * 2, h: mobile ? 34 : 42, onClick: () => ClanSystem.leaveClan(this.store) };
      this.buttons.push(leaveBtn);
      fillRR(ctx, leaveBtn.x, leaveBtn.y, leaveBtn.w, leaveBtn.h, 14, "#5f2531");
      ctx.fillStyle = "#fff";
      ctx.font = fitBold(18, mobile, 13);
      ctx.fillText("Clandan Ayrıl", leaveBtn.x + 20, leaveBtn.y + (mobile ? 22 : 27));
    } else {
      const createBtn = { x: x + px, y: actionBottom, w: w - px * 2, h: mobile ? 34 : 42, onClick: () => this.scenes?.go?.("clan_create") };
      this.buttons.push(createBtn);
      fillRR(ctx, createBtn.x, createBtn.y, createBtn.w, createBtn.h, 14, Number(player.level || 1) >= 10 ? "#1f8c5e" : "#38425d");
      ctx.fillStyle = "#fff";
      ctx.font = fitBold(18, mobile, 12);
      ctx.fillText(Number(player.level || 1) >= 10 ? "Clan Kurma Ekranı" : "Seviye 10'da Açılır", createBtn.x + 14, createBtn.y + (mobile ? 22 : 27));
    }
  }

  drawDiscovery(ctx, x, y, w, h, state, directory) {
    const player = state.player || {};
    const clans = ClanSystem.browseClans(this.store, this.search);
    const inbox = directory?.player?.inbox || [];
    const mobile = !!this.layout?.mobile;

    ctx.fillStyle = "#fff";
    ctx.font = fitBold(30, mobile, 18);
    ctx.fillText("Clan Ara ve Başvur", x + 18, y + (mobile ? 28 : 42));
    ctx.fillStyle = "#9ebfff";
    ctx.font = fitFont(18, mobile, 11);
    if (mobile) {
      ctx.fillText("Seviye 10'a kadar başvuru gönder.", x + 18, y + 50);
      ctx.fillText("Kabul gelince koruma açılır.", x + 18, y + 66);
    } else {
      ctx.fillText("Seviye 10'a kadar clan kurulmaz. Oyuncu clan arar, başvuru gönderir ve kabul bekler.", x + 24, y + 72);
    }

    const searchRect = { x: x + 18, y: y + (mobile ? 80 : 94), w: w - 36, h: mobile ? 40 : 48, onClick: () => { this.searchFocused = true; } };
    this.buttons.push(searchRect);
    fillRR(ctx, searchRect.x, searchRect.y, searchRect.w, searchRect.h, 16, this.searchFocused ? "#17376b" : "#12284a");
    strokeRR(ctx, searchRect.x, searchRect.y, searchRect.w, searchRect.h, 16, "#3b6fbc", 2);
    ctx.fillStyle = "#dbe8ff";
    ctx.font = fitFont(18, mobile, 12);
    textLine(ctx, this.search || "Clan adı veya tag ile ara...", searchRect.x + 14, searchRect.y + (mobile ? 25 : 30), searchRect.w - 28);

    let cy = y + (mobile ? 132 : 158);
    if (inbox.length) {
      const boxH = mobile ? 92 : 86;
      fillRR(ctx, x + 18, cy, w - 36, boxH, 18, "#142a4c");
      ctx.fillStyle = "#fff";
      ctx.font = fitBold(20, mobile, 14);
      ctx.fillText("Gelen Davet", x + 32, cy + (mobile ? 22 : 28));
      const inv = inbox[0];
      ctx.font = fitFont(18, mobile, 11);
      ctx.fillStyle = "#b6d0ff";
      textLine(ctx, `${inv.logo || "👑"} ${inv.clanName} [${inv.clanTag}]`, x + 32, cy + (mobile ? 42 : 56), w - 170);

      const btnY = mobile ? cy + 54 : cy + 22;
      const acceptBtn = { x: x + w - (mobile ? 156 : 220), y: btnY, w: mobile ? 56 : 86, h: 30, onClick: () => ClanSystem.acceptInboxInvite(this.store, inv.id) };
      const rejectBtn = { x: x + w - (mobile ? 90 : 124), y: btnY, w: mobile ? 56 : 86, h: 30, onClick: () => ClanSystem.declineInboxInvite(this.store, inv.id) };
      this.buttons.push(acceptBtn, rejectBtn);
      fillRR(ctx, acceptBtn.x, acceptBtn.y, acceptBtn.w, acceptBtn.h, 12, "#1c8d5e");
      fillRR(ctx, rejectBtn.x, rejectBtn.y, rejectBtn.w, rejectBtn.h, 12, "#693341");
      ctx.fillStyle = "#fff";
      ctx.font = fitBold(16, mobile, 11);
      ctx.fillText("Kabul", acceptBtn.x + (mobile ? 10 : 18), acceptBtn.y + 20);
      ctx.fillText("Reddet", rejectBtn.x + (mobile ? 8 : 18), rejectBtn.y + 20);
      cy += boxH + 10;
    }

    const visibleClans = mobile ? clans.slice(0, 3) : clans.slice(0, 5);
    const rowH = mobile ? 76 : 92;
    visibleClans.forEach((clan, idx) => {
      const rowY = cy + idx * (rowH + 10);
      fillRR(ctx, x + 18, rowY, w - 36, rowH, 18, "#122542");
      strokeRR(ctx, x + 18, rowY, w - 36, rowH, 18, "#264c7c", 1);

      const canJoin = Number(player.level || 1) >= Number(clan.minLevel || 1);
      const btnW = mobile ? 82 : 120;
      const btnH = mobile ? 30 : 40;
      const btnX = x + w - btnW - (mobile ? 24 : 48);
      const btnY = rowY + (mobile ? 38 : 26);

      ctx.fillStyle = "#fff";
      ctx.font = fitBold(22, mobile, 15);
      textLine(ctx, `${clan.logo || "👑"} ${clan.name}`, x + 32, rowY + (mobile ? 22 : 30), btnX - (x + 32) - 8);
      ctx.fillStyle = "#9fc2ff";
      ctx.font = fitFont(17, mobile, 11);
      textLine(ctx, `[${clan.tag}] Güç ${fmtNum(clan.power)} Üye ${clan.members}/${clan.memberCap}`, x + 32, rowY + (mobile ? 40 : 56), btnX - (x + 32) - 8);
      textLine(ctx, `Giriş ${clan.minLevel} • ${clan.description}`, x + 32, rowY + (mobile ? 58 : 78), w - 36 - 24 - btnW - 30);

      const btn = { x: btnX, y: btnY, w: btnW, h: btnH, onClick: () => ClanSystem.requestJoinClan(this.store, clan.id) };
      this.buttons.push(btn);
      fillRR(ctx, btn.x, btn.y, btn.w, btn.h, 12, canJoin ? "#1f8c5e" : "#55404a");
      ctx.fillStyle = "#fff";
      ctx.font = fitBold(18, mobile, 11);
      ctx.fillText(canJoin ? "Başvur" : "Yetmez", btn.x + (mobile ? 12 : 18), btn.y + (mobile ? 20 : 25));
    });

    if (!visibleClans.length) {
      fillRR(ctx, x + 18, cy, w - 36, 72, 18, "#122542");
      ctx.fillStyle = "#dbe8ff";
      ctx.font = fitBold(20, mobile, 13);
      ctx.fillText("Aramana uygun clan bulunamadı.", x + 32, cy + 42);
    }
  }

  drawClanView(ctx, x, y, w, h, state, clan) {
    const mobile = !!this.layout?.mobile;
    const tabs = mobile
      ? [{ id: "overview", label: "Genel" }, { id: "members", label: "Üyeler" }, { id: "manage", label: "Yönet" }, { id: "log", label: "Log" }]
      : [{ id: "overview", label: "Genel" }, { id: "members", label: "Üyeler" }, { id: "manage", label: "Yönetim" }, { id: "log", label: "Log" }];

    ctx.fillStyle = "#fff";
    ctx.font = fitBold(30, mobile, 18);
    textLine(ctx, `${clan.logo || "👑"} ${clan.name}`, x + 18, y + (mobile ? 28 : 42), w - 36);
    ctx.fillStyle = "#9ebfff";
    ctx.font = fitFont(18, mobile, 11);
    if (mobile) {
      ctx.fillText(`[${clan.tag}] Koruma aktif • Paylaşım açık`, x + 18, y + 50);
    } else {
      ctx.fillText(`[${clan.tag}] Global hazır • Bina koruması aktif • Clan ödül paylaşımı açık`, x + 24, y + 70);
    }

    let tx = x + 18;
    const tabY = y + (mobile ? 64 : 92);
    const tabGap = mobile ? 8 : 8;
    const tabW = mobile ? Math.floor((w - 36 - tabGap * 3) / 4) : 124;
    tabs.forEach((tab) => {
      const active = this.tab === tab.id;
      const btn = { x: tx, y: tabY, w: tabW, h: mobile ? 34 : 40, onClick: () => { this.tab = tab.id; } };
      this.buttons.push(btn);
      fillRR(ctx, btn.x, btn.y, btn.w, btn.h, 14, active ? "#1c5ab5" : "#13284c");
      ctx.fillStyle = "#fff";
      ctx.font = fitBold(17, mobile, 11);
      textLine(ctx, tab.label, btn.x + (mobile ? 8 : 24), btn.y + (mobile ? 22 : 24), btn.w - (mobile ? 16 : 30));
      tx += tabW + tabGap;
    });

    const contentY = tabY + (mobile ? 44 : 58);
    const contentH = h - (contentY - y);
    if (this.tab === "overview") this.drawOverviewTab(ctx, x, contentY, w, contentH, state, clan);
    if (this.tab === "members") this.drawMembersTab(ctx, x, contentY, w, contentH, state, clan);
    if (this.tab === "manage") this.drawManageTab(ctx, x, contentY, w, contentH, state, clan);
    if (this.tab === "log") this.drawLogTab(ctx, x, contentY, w, contentH, state, clan);
  }

  drawStatCard(ctx, x, y, w, h, title, value, sub, mobile = false) {
    fillRR(ctx, x, y, w, h, mobile ? 16 : 20, "#13284a");
    ctx.fillStyle = "#9fc2ff";
    ctx.font = fitFont(17, mobile, 11);
    textLine(ctx, title, x + 14, y + (mobile ? 18 : 24), w - 28);
    ctx.fillStyle = "#fff";
    ctx.font = fitBold(28, mobile, 15);
    textLine(ctx, value, x + 14, y + (mobile ? 40 : 56), w - 28);
    ctx.fillStyle = "#7fc9a0";
    ctx.font = fitFont(16, mobile, 10);
    textLine(ctx, sub, x + 14, y + (mobile ? 58 : 82), w - 28);
  }

  drawOverviewTab(ctx, x, y, w, h, state, clan) {
    const mobile = !!this.layout?.mobile;
    if (mobile) {
      const innerX = x + 10;
      const innerW = w - 20;
      const gap = 8;
      const cardW = Math.floor((innerW - gap) / 2);
      const cardH = 68;

      this.drawStatCard(ctx, innerX, y + 6, cardW, cardH, "Lvl", `${clan.level}`, `${fmtNum(clan.xp)} XP`, true);
      this.drawStatCard(ctx, innerX + cardW + gap, y + 6, cardW, cardH, "Kasa", `$${fmtNum(clan.bank)}`, `+${fmtNum(clan.dailyIncome)}/gün`, true);
      this.drawStatCard(ctx, innerX, y + 82, cardW, cardH, "Üye", `${clan.members.length}/${clan.limits.members}`, "Koruma açık", true);
      this.drawStatCard(ctx, innerX + cardW + gap, y + 82, cardW, cardH, "Güç", fmtNum(clan.power), "Global hazır", true);

      fillRR(ctx, innerX, y + 158, innerW, 78, 16, "#13284a");
      ctx.fillStyle = "#fff";
      ctx.font = fitBold(18, true, 13);
      ctx.fillText("Açıklama", innerX + 14, y + 180);
      ctx.fillStyle = "#dbe8ff";
      ctx.font = fitFont(14, true, 10);
      textLine(ctx, clan.description || "Açıklama yok", innerX + 14, y + 200, innerW - 28);
      textLine(ctx, "CoffeeShop + NightClub koruması aktif.", innerX + 14, y + 218, innerW - 28);

      const addBtn = { x: innerX, y: y + 244, w: innerW, h: 30, onClick: () => ClanSystem.addMockMember(this.store) };
      this.buttons.push(addBtn);
      fillRR(ctx, addBtn.x, addBtn.y, addBtn.w, addBtn.h, 12, "#1f8c5e");
      ctx.fillStyle = "#fff";
      ctx.font = fitBold(14, true, 11);
      ctx.fillText("Test Üye Ekle", addBtn.x + 14, addBtn.y + 20);

      fillRR(ctx, innerX, y + 282, innerW, 92, 16, "#13284a");
      ctx.fillStyle = "#fff";
      ctx.font = fitBold(18, true, 13);
      ctx.fillText("Boss Bölümü", innerX + 14, y + 304);
      const boss = ClanSystem.getBossSpinStatus(this.store);
      ctx.fillStyle = "#dbe8ff";
      ctx.font = fitFont(14, true, 10);
      textLine(ctx, `Durum: ${boss?.bossStatus || "idle"} • HP ${fmtNum(boss?.bossHp || 0)}/${fmtNum(boss?.bossMaxHp || 0)}`, innerX + 14, y + 326, innerW - 28);
      textLine(ctx, `Spin: ${boss?.spinsLeft || 0} • Enerji ${boss?.energyPerSpin || 0}`, innerX + 14, y + 344, innerW - 28);

      const startBtn = { x: innerX, y: y + 350, w: innerW, h: 18 + 12, onClick: () => ClanSystem.startBossRaid(this.store) };
      this.buttons.push(startBtn);
      fillRR(ctx, startBtn.x, startBtn.y, startBtn.w, startBtn.h, 12, "#6b4adb");
      ctx.fillStyle = "#fff";
      ctx.font = fitBold(14, true, 11);
      ctx.fillText("Boss Sezonu Başlat", startBtn.x + 14, startBtn.y + 20);
      return;
    }

    const gap = 14;
    const cardW = Math.floor((w - gap * 3) / 2);
    this.drawStatCard(ctx, x + 12, y + 10, cardW, 96, "Clan Level", `${clan.level}`, `${fmtNum(clan.xp)} / ${fmtNum(clan.xpNext)} XP`);
    this.drawStatCard(ctx, x + 12 + cardW + gap, y + 10, cardW, 96, "Clan Kasası", `$${fmtNum(clan.bank)}`, `Günlük gelir $${fmtNum(clan.dailyIncome)}`);
    this.drawStatCard(ctx, x + 12, y + 120, cardW, 96, "Üye Sayısı", `${clan.members.length}/${clan.limits.members}`, "Binalar korunuyor");
    this.drawStatCard(ctx, x + 12 + cardW + gap, y + 120, cardW, 96, "Clan Gücü", fmtNum(clan.power), "Global açılışa hazır");

    fillRR(ctx, x + 12, y + 232, w - 24, 132, 22, "#13284a");
    ctx.fillStyle = "#fff";
    ctx.font = "bold 22px Arial";
    ctx.fillText("Açıklama", x + 30, y + 266);
    ctx.font = "18px Arial";
    ctx.fillStyle = "#dbe8ff";
    ctx.fillText(clan.description || "Açıklama yok", x + 30, y + 296);
    ctx.fillText("Clan üyeleri CoffeeShop ve NightClub binalarında clan koruması alır.", x + 30, y + 326);

    const addBtn = { x: x + w - 224, y: y + 306, w: 180, h: 40, onClick: () => ClanSystem.addMockMember(this.store) };
    this.buttons.push(addBtn);
    fillRR(ctx, addBtn.x, addBtn.y, addBtn.w, addBtn.h, 14, "#1f8c5e");
    ctx.fillStyle = "#fff";
    ctx.font = "bold 18px Arial";
    ctx.fillText("Test Üye Ekle", addBtn.x + 34, addBtn.y + 25);

    fillRR(ctx, x + 12, y + 380, w - 24, 118, 22, "#13284a");
    ctx.fillStyle = "#fff";
    ctx.font = "bold 22px Arial";
    ctx.fillText("Boss Bölümü", x + 30, y + 414);
    const boss = ClanSystem.getBossSpinStatus(this.store);
    ctx.fillStyle = "#dbe8ff";
    ctx.font = "18px Arial";
    ctx.fillText(`Durum: ${boss?.bossStatus || "idle"} • HP ${fmtNum(boss?.bossHp || 0)} / ${fmtNum(boss?.bossMaxHp || 0)}`, x + 30, y + 444);
    ctx.fill
