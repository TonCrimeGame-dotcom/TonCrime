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
function canvasCssSize(canvas) {
  const rect = canvas?.getBoundingClientRect?.();
  if (rect && rect.width > 0 && rect.height > 0) return { w: Math.round(rect.width), h: Math.round(rect.height) };
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  return {
    w: Math.max(1, Math.round((canvas?.width || 1) / dpr)),
    h: Math.max(1, Math.round((canvas?.height || 1) / dpr)),
  };
}
function justPressed(input) {
  if (typeof input?.justPressed === "function") return !!input.justPressed();
  if (typeof input?.isJustPressed === "function") return !!input.isJustPressed("pointer") || !!input.isJustPressed("mouseLeft") || !!input.isJustPressed("touch");
  return !!input?._justPressed || !!input?.mousePressed;
}
function justReleased(input) {
  if (typeof input?.justReleased === "function") return !!input.justReleased();
  return !!input?._justReleased;
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
function fitFont(base, mobile, min = 14) { return `${mobile ? Math.max(min, Math.floor(base * 0.72)) : base}px Arial`; }
function fitBold(base, mobile, min = 15) { return `bold ${mobile ? Math.max(min, Math.floor(base * 0.72)) : base}px Arial`; }
function textLine(ctx, text, x, y, maxWidth) {
  const value = String(text || "");
  if (!maxWidth || ctx.measureText(value).width <= maxWidth) {
    ctx.fillText(value, x, y);
    return;
  }
  let t = value;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
  ctx.fillText(t + "…", x, y);
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
    this.scrollY = 0;
    this.scrollMax = 0;
    this._dragScroll = null;
    this.scrollArea = null;
  }

  onEnter() {
    this.bindKeyboard();
    const directory = ClanSystem.getDirectory(this.store);
    this.search = directory?.player?.search || "";
    this.inviteName = "";
    this.scrollY = 0;
    this.scrollMax = 0;
    this._dragScroll = null;
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
    const size = canvasCssSize(ctx.canvas);
    const w = size.w;
    const h = size.h;
    const mobile = w < 760;
    const s = this.store?.get?.() || {};
    const safe = s.ui?.safe || { x: 0, y: 0, w, h };
    const hudTop = Number(s.ui?.hudReservedTop || (mobile ? 82 : 96));
    const chatBottom = Number(s.ui?.chatReservedBottom || (mobile ? 72 : 88));
    const pad = mobile ? 10 : Math.max(14, Math.floor(w * 0.035));
    const gap = mobile ? 10 : 16;
    const top = Math.max(safe.y + 8, safe.y + hudTop + 8);
    const bottomPad = Math.max(chatBottom + 8, Math.max(0, h - (safe.y + safe.h)) + chatBottom);

    if (mobile) {
      const leftX = safe.x + pad;
      const leftY = top;
      const leftW = safe.w - pad * 2;
      const leftH = 248;
      const rightX = leftX;
      const rightY = leftY + leftH + gap;
      const rightW = leftW;
      const rightH = Math.max(180, safe.y + safe.h - rightY - bottomPad + 4);
      return { mobile, w, h, pad, gap, top, bottomPad, leftX, leftY, leftW, leftH, rightX, rightY, rightW, rightH };
    }

    const leftX = safe.x + pad;
    const leftY = top;
    const leftW = Math.min(320, safe.w * 0.34);
    const leftH = safe.h - (top - safe.y) - bottomPad;
    const rightX = leftX + leftW + gap;
    const rightY = top;
    const rightW = safe.w - (rightX - safe.x) - pad;
    const rightH = leftH;
    return { mobile, w, h, pad, gap, top, bottomPad, leftX, leftY, leftW, leftH, rightX, rightY, rightW, rightH };
  }

  drawBackground(ctx, w, h) {
    const img =
      (typeof this.assets?.getImage === "function" ? this.assets.getImage("clan_bg") : null) ||
      this.assets?.images?.clan_bg ||
      this.assets?.images?.clan ||
      null;
    if (img) {
      const scale = Math.max(w / (img.width || 1), h / (img.height || 1));
      const dw = (img.width || 1) * scale;
      const dh = (img.height || 1) * scale;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = "#061124";
      ctx.fillRect(0, 0, w, h);
    }
    ctx.fillStyle = "rgba(2,7,18,0.16)";
    ctx.fillRect(0, 0, w, h);
  }

  update() {
    ClanSystem.tickPending(this.store);

    const p = getPointer(this.input);
    const px = Number(p.x || 0);
    const py = Number(p.y || 0);
    const isDown = typeof this.input?.isDown === "function" ? !!this.input.isDown() : !!this.input?._pressed;
    const pressed = justPressed(this.input);
    const released = justReleased(this.input);

    if (pressed && this.scrollArea && px >= this.scrollArea.x && px <= this.scrollArea.x + this.scrollArea.w && py >= this.scrollArea.y && py <= this.scrollArea.y + this.scrollArea.h) {
      this._dragScroll = { startY: py, startScrollY: this.scrollY, moved: 0 };
    }

    if (isDown && this._dragScroll) {
      const dy = py - this._dragScroll.startY;
      this._dragScroll.moved = Math.max(this._dragScroll.moved, Math.abs(dy));
      this.scrollY = clamp(this._dragScroll.startScrollY - dy, 0, this.scrollMax || 0);
    }

    if (released) {
      const drag = this._dragScroll;
      this._dragScroll = null;
      if (drag && drag.moved > 8) return;
    }

    if (!pressed) return;
    this.searchFocused = false;
    this.inviteFocused = false;
    for (const btn of this.buttons) {
      if (px >= btn.x && px <= btn.x + btn.w && py >= btn.y && py <= btn.y + btn.h) {
        btn.onClick?.();
        return;
      }
    }
  }

  estimateDiscoveryContentHeight(directory, h) {
    if (!this.layout?.mobile) return h;
    const clans = ClanSystem.browseClans(this.store, this.search);
    const inbox = directory?.player?.inbox || [];
    let contentH = 140 + Math.max(1, clans.length) * 98 + 24;
    if (inbox.length) contentH += 102;
    return Math.max(h, contentH);
  }

  estimateClanTabContentHeight(clan, viewportH) {
    if (!this.layout?.mobile) return viewportH;
    if (this.tab === "overview") return Math.max(viewportH, 470);
    if (this.tab === "members") return Math.max(viewportH, 16 + Math.max(1, clan.members.length) * 80 + 12);
    if (this.tab === "manage") return Math.max(viewportH, 260 + Math.max(1, clan.members.length) * 60 + 84);
    if (this.tab === "log") return Math.max(viewportH, 16 + Math.max(1, (clan.logs || []).length) * 56 + 12);
    return viewportH;
  }

  beginScrollArea(ctx, x, y, w, h, contentH) {
    this.scrollMax = Math.max(0, Math.ceil(contentH - h));
    this.scrollY = clamp(this.scrollY, 0, this.scrollMax);
    this.scrollArea = { x, y, w, h };
    ctx.save();
    rr(ctx, x, y, w, h, 16);
    ctx.clip();
  }
  endScrollArea(ctx) { ctx.restore(); }

  drawScrollBar(ctx) {
    const area = this.scrollArea;
    if (!area || !(this.scrollMax > 0)) return;
    const trackX = area.x + area.w - 6;
    const trackY = area.y + 8;
    const trackH = area.h - 16;
    const thumbH = Math.max(28, Math.floor((area.h / (area.h + this.scrollMax)) * trackH));
    const travel = Math.max(0, trackH - thumbH);
    const thumbY = trackY + (travel * this.scrollY / Math.max(1, this.scrollMax));
    fillRR(ctx, trackX, trackY, 3, trackH, 2, "rgba(255,255,255,0.12)");
    fillRR(ctx, trackX, thumbY, 3, thumbH, 2, "rgba(255,255,255,0.42)");
  }

  render(ctx) {
    const state = this.getState();
    const clan = ClanSystem.getClan(this.store);
    const directory = ClanSystem.getDirectory(this.store);
    const L = this.layout = this.getLayout(ctx);
    this.buttons = [];
    this.scrollArea = null;

    this.drawBackground(ctx, L.w, L.h);

    const closeSize = L.mobile ? 36 : 42;
    const closeBtn = {
      x: L.w - closeSize - 10,
      y: Math.max(72, L.top - (L.mobile ? 18 : 10)),
      w: closeSize,
      h: closeSize,
      onClick: () => this.scenes?.go?.("home"),
    };
    this.buttons.push(closeBtn);
    fillRR(ctx, closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, 12, "rgba(0,0,0,0.40)");
    strokeRR(ctx, closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, 12, "rgba(255,255,255,0.14)", 1);
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${L.mobile ? 22 : 24}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("X", closeBtn.x + closeBtn.w / 2, closeBtn.y + closeBtn.h / 2 + 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    fillRR(ctx, L.leftX, L.leftY, L.leftW, L.leftH, L.mobile ? 18 : 26, "rgba(7,18,45,0.42)");
    fillRR(ctx, L.rightX, L.rightY, L.rightW, L.rightH, L.mobile ? 18 : 26, "rgba(9,22,55,0.44)");
    strokeRR(ctx, L.leftX, L.leftY, L.leftW, L.leftH, L.mobile ? 18 : 26, "rgba(75,126,220,0.58)", 2);
    strokeRR(ctx, L.rightX, L.rightY, L.rightW, L.rightH, L.mobile ? 18 : 26, "rgba(75,126,220,0.58)", 2);

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

    const card1H = mobile ? 84 : 116;
    fillRR(ctx, x + px, y + (mobile ? 64 : 86), w - px * 2, card1H, mobile ? 16 : 22, "rgba(19,39,82,0.72)");
    ctx.fillStyle = "#fff";
    ctx.font = fitBold(22, mobile, 16);
    textLine(ctx, player.username || player.name || "Player", x + px + 16, y + (mobile ? 90 : 122), w - px * 2 - 32);
    ctx.fillStyle = "#9fc2ff";
    ctx.font = fitFont(18, mobile, 12);
    ctx.fillText(`Seviye ${player.level || 1}`, x + px + 16, y + (mobile ? 112 : 148));
    ctx.fillText(`Bakiye ${fmtNum(state.coins)} yTon`, x + px + 16, y + (mobile ? 132 : 174));

    const card2Y = y + (mobile ? 156 : 222);
    const card2H = mobile ? 84 : 128;
    fillRR(ctx, x + px, card2Y, w - px * 2, card2H, mobile ? 16 : 22, clan ? "rgba(21,70,45,0.72)" : "rgba(26,36,66,0.70)");
    ctx.fillStyle = clan ? "#7cf2a8" : "#dbe8ff";
    ctx.font = fitBold(20, mobile, 15);
    ctx.fillText(clan ? "Clan Avantajları Aktif" : "Clan Avantajları", x + px + 16, card2Y + (mobile ? 24 : 32));
    ctx.font = fitFont(16, mobile, 11);
    const lines = clan
      ? ["• Bina koruması açık", "• Ödül paylaşımı aktif", "• Davet ekranı açık"]
      : ["• Seviye 10'da clan kur", "• Başvuru gönder", "• Kabulde koruma açılır"];
    lines.forEach((line, i) => ctx.fillText(line, x + px + 16, card2Y + (mobile ? 46 : 62) + i * (mobile ? 16 : 24)));

    let actionBottom = y + h - (mobile ? 52 : 60);
    if (pending && !clan && mobile) {
      const infoY = y + h - 96;
      ctx.fillStyle = "#ffd6a5";
      ctx.font = fitFont(14, true, 11);
      textLine(ctx, `Bekleyen: ${pending.clanName} • ${timeLeftText(pending)}`, x + 16, infoY, w - 32);
      const cancelBtn = { x: x + 14, y: y + h - 70, w: w - 28, h: 34, onClick: () => ClanSystem.cancelJoinRequest(this.store) };
      this.buttons.push(cancelBtn);
      fillRR(ctx, cancelBtn.x, cancelBtn.y, cancelBtn.w, cancelBtn.h, 12, "rgba(112,54,58,0.88)");
      ctx.fillStyle = "#fff";
      ctx.font = fitBold(15, true, 12);
      ctx.fillText("Başvuruyu İptal Et", cancelBtn.x + 16, cancelBtn.y + 21);
      actionBottom = cancelBtn.y - 8;
    }

    if (clan) {
      const leaveBtn = { x: x + px, y: actionBottom, w: w - px * 2, h: mobile ? 36 : 42, onClick: () => ClanSystem.leaveClan(this.store) };
      this.buttons.push(leaveBtn);
      fillRR(ctx, leaveBtn.x, leaveBtn.y, leaveBtn.w, leaveBtn.h, 14, "rgba(95,37,49,0.90)");
      ctx.fillStyle = "#fff";
      ctx.font = fitBold(18, mobile, 13);
      ctx.fillText("Clandan Ayrıl", leaveBtn.x + 20, leaveBtn.y + (mobile ? 22 : 27));
    } else {
      const createBtn = { x: x + px, y: actionBottom, w: w - px * 2, h: mobile ? 36 : 42, onClick: () => this.scenes?.go?.("clan_create") };
      this.buttons.push(createBtn);
      fillRR(ctx, createBtn.x, createBtn.y, createBtn.w, createBtn.h, 14, Number(player.level || 1) >= 10 ? "rgba(31,140,94,0.92)" : "rgba(56,66,93,0.92)");
      ctx.fillStyle = "#fff";
      ctx.font = fitBold(18, mobile, 12);
      ctx.fillText(Number(player.level || 1) >= 10 ? "Clan Kur • 50 yTon" : "Seviye 10'da Açılır", createBtn.x + 14, createBtn.y + (mobile ? 22 : 27));
    }
  }

  drawDiscovery(ctx, x, y, w, h, state, directory) {
    const player = state.player || {};
    const clans = ClanSystem.browseClans(this.store, this.search);
    const inbox = directory?.player?.inbox || [];
    const mobile = !!this.layout?.mobile;

    if (mobile) {
      const viewportY = y + 12;
      const viewportH = h - 24;
      this.beginScrollArea(ctx, x + 8, viewportY, w - 16, viewportH, this.estimateDiscoveryContentHeight(directory, viewportH));
      y -= this.scrollY;
    } else {
      this.scrollArea = null;
      this.scrollMax = 0;
      this.scrollY = 0;
    }

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
    fillRR(ctx, searchRect.x, searchRect.y, searchRect.w, searchRect.h, 16, this.searchFocused ? "rgba(23,55,107,0.88)" : "rgba(18,40,74,0.84)");
    strokeRR(ctx, searchRect.x, searchRect.y, searchRect.w, searchRect.h, 16, "rgba(75,126,220,0.86)", 2);
    ctx.fillStyle = "#dbe8ff";
    ctx.font = fitFont(18, mobile, 12);
    textLine(ctx, this.search || "Clan adı veya tag ile ara...", searchRect.x + 14, searchRect.y + (mobile ? 25 : 30), searchRect.w - 28);

    let cy = y + (mobile ? 132 : 158);
    if (inbox.length) {
      const boxH = mobile ? 92 : 86;
      fillRR(ctx, x + 18, cy, w - 36, boxH, 18, "rgba(20,42,76,0.82)");
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
      fillRR(ctx, acceptBtn.x, acceptBtn.y, acceptBtn.w, acceptBtn.h, 12, "rgba(28,141,94,0.95)");
      fillRR(ctx, rejectBtn.x, rejectBtn.y, rejectBtn.w, rejectBtn.h, 12, "rgba(105,51,65,0.95)");
      ctx.fillStyle = "#fff";
      ctx.font = fitBold(16, mobile, 11);
      ctx.fillText("Kabul", acceptBtn.x + (mobile ? 10 : 18), acceptBtn.y + 20);
      ctx.fillText("Reddet", rejectBtn.x + (mobile ? 8 : 18), rejectBtn.y + 20);
      cy += boxH + 10;
    }

    const visibleClans = mobile ? clans : clans.slice(0, 5);
    const rowH = mobile ? 88 : 92;
    visibleClans.forEach((clan, idx) => {
      const rowY = cy + idx * (rowH + 10);
      fillRR(ctx, x + 18, rowY, w - 36, rowH, 18, "rgba(18,37,66,0.84)");
      strokeRR(ctx, x + 18, rowY, w - 36, rowH, 18, "rgba(75,126,220,0.48)", 1);

      const canJoin = Number(player.level || 1) >= Number(clan.minLevel || 1);
      const btnW = mobile ? 82 : 120;
      const btnH = mobile ? 30 : 40;
      const btnX = x + w - btnW - (mobile ? 24 : 48);
      const btnY = rowY + (mobile ? 48 : 26);

      ctx.fillStyle = "#fff";
      ctx.font = fitBold(22, mobile, 15);
      textLine(ctx, `${clan.logo || "👑"} ${clan.name}`, x + 32, rowY + (mobile ? 22 : 30), btnX - (x + 32) - 8);
      ctx.fillStyle = "#9fc2ff";
      ctx.font = fitFont(17, mobile, 11);
      textLine(ctx, `[${clan.tag}] Güç ${fmtNum(clan.power)} Üye ${clan.members}/${clan.memberCap}`, x + 32, rowY + (mobile ? 40 : 56), btnX - (x + 32) - 8);
      if (mobile) {
        textLine(ctx, `Giriş ${clan.minLevel}`, x + 32, rowY + 58, btnX - (x + 32) - 8);
        textLine(ctx, `${clan.description}`, x + 32, rowY + 74, btnX - (x + 32) - 8);
      } else {
        textLine(ctx, `Giriş ${clan.minLevel} • ${clan.description}`, x + 32, rowY + 78, w - 36 - 24 - btnW - 30);
      }

      const btn = { x: btnX, y: btnY, w: btnW, h: btnH, onClick: () => ClanSystem.requestJoinClan(this.store, clan.id) };
      this.buttons.push(btn);
      fillRR(ctx, btn.x, btn.y, btn.w, btn.h, 12, canJoin ? "rgba(31,140,94,0.95)" : "rgba(85,64,74,0.95)");
      ctx.fillStyle = "#fff";
      ctx.font = fitBold(18, mobile, 11);
      ctx.fillText(canJoin ? "Başvur" : "Yetmez", btn.x + (mobile ? 12 : 18), btn.y + (mobile ? 20 : 25));
    });

    if (!visibleClans.length) {
      fillRR(ctx, x + 18, cy, w - 36, 72, 18, "rgba(18,37,66,0.84)");
      ctx.fillStyle = "#dbe8ff";
      ctx.font = fitBold(20, mobile, 13);
      ctx.fillText("Aramana uygun clan bulunamadı.", x + 32, cy + 42);
    }

    if (mobile) {
      this.endScrollArea(ctx);
      this.drawScrollBar(ctx);
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
    ctx.fillText(`[${clan.tag}] Koruma aktif • Paylaşım açık`, x + 18, y + (mobile ? 50 : 70));

    let tx = x + 18;
    const tabY = y + (mobile ? 64 : 92);
    const tabGap = 8;
    const tabW = mobile ? Math.floor((w - 36 - tabGap * 3) / 4) : 124;
    tabs.forEach((tab) => {
      const active = this.tab === tab.id;
      const btn = { x: tx, y: tabY, w: tabW, h: mobile ? 34 : 40, onClick: () => { this.tab = tab.id; this.scrollY = 0; } };
      this.buttons.push(btn);
      fillRR(ctx, btn.x, btn.y, btn.w, btn.h, 14, active ? "rgba(28,90,181,0.95)" : "rgba(19,40,76,0.86)");
      ctx.fillStyle = "#fff";
      ctx.font = fitBold(17, mobile, 11);
      textLine(ctx, tab.label, btn.x + (mobile ? 8 : 24), btn.y + (mobile ? 22 : 24), btn.w - (mobile ? 16 : 30));
      tx += tabW + tabGap;
    });

    const contentY = tabY + (mobile ? 44 : 58);
    const contentH = h - (contentY - y);
    if (mobile) {
      const viewportY = contentY;
      const viewportH = Math.max(80, h - (viewportY - y) - 10);
      this.beginScrollArea(ctx, x + 8, viewportY, w - 16, viewportH, this.estimateClanTabContentHeight(clan, viewportH));
      const sy = contentY - this.scrollY;
      if (this.tab === "overview") this.drawOverviewTab(ctx, x, sy, w, contentH, state, clan);
      if (this.tab === "members") this.drawMembersTab(ctx, x, sy, w, contentH, state, clan);
      if (this.tab === "manage") this.drawManageTab(ctx, x, sy, w, contentH, state, clan);
      if (this.tab === "log") this.drawLogTab(ctx, x, sy, w, contentH, state, clan);
      this.endScrollArea(ctx);
      this.drawScrollBar(ctx);
      return;
    }

    this.scrollArea = null;
    this.scrollMax = 0;
    this.scrollY = 0;
    if (this.tab === "overview") this.drawOverviewTab(ctx, x, contentY, w, contentH, state, clan);
    if (this.tab === "members") this.drawMembersTab(ctx, x, contentY, w, contentH, state, clan);
    if (this.tab === "manage") this.drawManageTab(ctx, x, contentY, w, contentH, state, clan);
    if (this.tab === "log") this.drawLogTab(ctx, x, contentY, w, contentH, state, clan);
  }

  drawStatCard(ctx, x, y, w, h, title, value, sub, mobile = false) {
    fillRR(ctx, x, y, w, h, mobile ? 16 : 20, "rgba(19,40,74,0.80)");
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
      this.drawStatCard(ctx, innerX + cardW + gap, y + 6, cardW, cardH, "Kasa", `${fmtNum(clan.bank)}$`, `+${fmtNum(clan.dailyIncome)}/gün`, true);
      this.drawStatCard(ctx, innerX, y + 82, cardW, cardH, "Üye", `${clan.members.length}/${clan.limits.members}`, "Koruma açık", true);
      this.drawStatCard(ctx, innerX + cardW + gap, y + 82, cardW, cardH, "Güç", fmtNum(clan.power), "Global hazır", true);

      fillRR(ctx, innerX, y + 158, innerW, 82, 16, "rgba(19,40,74,0.80)");
      ctx.fillStyle = "#fff";
      ctx.font = fitBold(18, true, 13);
      ctx.fillText("Açıklama", innerX + 14, y + 180);
      ctx.fillStyle = "#dbe8ff";
      ctx.font = fitFont(14, true, 10);
      textLine(ctx, clan.description || "Açıklama yok", innerX + 14, y + 202, innerW - 28);
      textLine(ctx, "CoffeeShop + NightClub koruması aktif.", innerX + 14, y + 220, innerW - 28);

      fillRR(ctx, innerX, y + 250, innerW, 98, 16, "rgba(19,40,74,0.80)");
      ctx.fillStyle = "#fff";
      ctx.font = fitBold(18, true, 13);
      ctx.fillText("Boss Bölümü", innerX + 14, y + 272);
      const boss = ClanSystem.getBossSpinStatus(this.store);
      ctx.fillStyle = "#dbe8ff";
      ctx.font = fitFont(14, true, 10);
      textLine(ctx, `Durum: ${boss?.bossStatus || "idle"} • HP ${fmtNum(boss?.bossHp || 0)}/${fmtNum(boss?.bossMaxHp || 0)}`, innerX + 14, y + 294, innerW - 28);
      textLine(ctx, `Spin: ${boss?.spinsLeft || 0} • Enerji ${boss?.energyPerSpin || 0}`, innerX + 14, y + 314, innerW - 28);
      const startBtn = { x: innerX, y: y + 320, w: innerW, h: 28, onClick: () => ClanSystem.startBossRaid(this.store) };
      this.buttons.push(startBtn);
      fillRR(ctx, startBtn.x, startBtn.y, startBtn.w, startBtn.h, 12, "rgba(107,74,219,0.92)");
      ctx.fillStyle = "#fff";
      ctx.font = fitBold(14, true, 11);
      ctx.fillText("Boss Sezonu Başlat", startBtn.x + 14, startBtn.y + 19);
      return;
    }
    const gap = 14;
    const cardW = Math.floor((w - gap * 3) / 2);
    this.drawStatCard(ctx, x + 12, y + 10, cardW, 96, "Clan Level", `${clan.level}`, `${fmtNum(clan.xp)} / ${fmtNum(clan.xpNext)} XP`);
    this.drawStatCard(ctx, x + 12 + cardW + gap, y + 10, cardW, 96, "Clan Kasası", `${fmtNum(clan.bank)}$`, `Günlük gelir ${fmtNum(clan.dailyIncome)}$`);
    this.drawStatCard(ctx, x + 12, y + 120, cardW, 96, "Üye Sayısı", `${clan.members.length}/${clan.limits.members}`, "Binalar korunuyor");
    this.drawStatCard(ctx, x + 12 + cardW + gap, y + 120, cardW, 96, "Clan Gücü", fmtNum(clan.power), "Global açılışa hazır");
  }

  drawMembersTab(ctx, x, y, w, h, state, clan) {
    const mobile = !!this.layout?.mobile;
    let cy = y + 8;
    const visibleMembers = mobile ? clan.members : clan.members.slice(0, 6);
    visibleMembers.forEach((m) => {
      const rowH = mobile ? 70 : 74;
      fillRR(ctx, x + 10, cy, w - 20, rowH, 18, "rgba(19,40,74,0.80)");
      ctx.fillStyle = "#fff";
      ctx.font = fitBold(20, mobile, 13);
      textLine(ctx, m.name, x + 22, cy + 24, w - 180);
      ctx.fillStyle = "#9fc2ff";
      ctx.font = fitFont(17, mobile, 10);
      textLine(ctx, `${getRoleLabel(m.role)} • Lv ${m.level} • Güç ${fmtNum(m.power)}`, x + 22, cy + 44, w - 190);
      ctx.fillStyle = "#7ce8a4";
      ctx.fillText(`Pay %${m.rewardShare || 0}`, x + 22, cy + (mobile ? 60 : 52));
      if (m.id !== "player_main") {
        const promoteBtn = { x: x + w - (mobile ? 150 : 250), y: cy + 14, w: mobile ? 64 : 92, h: mobile ? 28 : 34, onClick: () => ClanSystem.promoteMember(this.store, m.id, "co_leader") };
        const kickBtn = { x: x + w - (mobile ? 78 : 148), y: cy + 14, w: mobile ? 56 : 92, h: mobile ? 28 : 34, onClick: () => ClanSystem.kickMember(this.store, m.id) };
        this.buttons.push(promoteBtn, kickBtn);
        fillRR(ctx, promoteBtn.x, promoteBtn.y, promoteBtn.w, promoteBtn.h, 12, "rgba(39,103,200,0.92)");
        fillRR(ctx, kickBtn.x, kickBtn.y, kickBtn.w, kickBtn.h, 12, "rgba(109,53,66,0.92)");
        ctx.fillStyle = "#fff";
        ctx.font = fitBold(15, mobile, 10);
        ctx.fillText(mobile ? "Yrd." : "Yardımcı", promoteBtn.x + (mobile ? 12 : 14), promoteBtn.y + (mobile ? 18 : 22));
        ctx.fillText("Çıkar", kickBtn.x + (mobile ? 10 : 24), kickBtn.y + (mobile ? 18 : 22));
      }
      cy += rowH + 8;
    });
  }

  drawManageTab(ctx, x, y, w, h, state, clan) {
    const mobile = !!this.layout?.mobile;
    fillRR(ctx, x + 10, y + 8, w - 20, mobile ? 92 : 108, mobile ? 16 : 20, "rgba(19,40,74,0.80)");
    ctx.fillStyle = "#fff";
    ctx.font = fitBold(22, mobile, 14);
    ctx.fillText("Davet Gönder", x + 22, y + 30);
    ctx.fillStyle = "#9fc2ff";
    ctx.font = fitFont(17, mobile, 10);
    ctx.fillText(mobile ? "Kurucu yardımcısı davet atabilir." : "Oyuncu adı yaz ve davet gönder. Kurucu yardımcısı davet atabilir.", x + 22, y + (mobile ? 48 : 66));
    const inputRect = { x: x + 22, y: y + (mobile ? 56 : 78), w: mobile ? w - 124 : w - 210, h: mobile ? 28 : 34, onClick: () => { this.inviteFocused = true; } };
    const sendBtn = { x: x + w - (mobile ? 94 : 164), y: y + (mobile ? 56 : 78), w: mobile ? 72 : 124, h: mobile ? 28 : 34, onClick: () => { ClanSystem.createInvite(this.store, this.inviteName); this.inviteName = ""; } };
    this.buttons.push(inputRect, sendBtn);
    fillRR(ctx, inputRect.x, inputRect.y, inputRect.w, inputRect.h, 12, this.inviteFocused ? "rgba(23,55,107,0.92)" : "rgba(16,32,64,0.86)");
    fillRR(ctx, sendBtn.x, sendBtn.y, sendBtn.w, sendBtn.h, 12, "rgba(31,140,94,0.95)");
    ctx.fillStyle = "#fff";
    ctx.font = fitFont(17, mobile, 11);
    textLine(ctx, this.inviteName || "Oyuncu adı...", inputRect.x + 10, inputRect.y + (mobile ? 19 : 22), inputRect.w - 20);
    ctx.fillText(mobile ? "Davet" : "Davet At", sendBtn.x + (mobile ? 12 : 25), sendBtn.y + (mobile ? 19 : 22));

    let cy = y + (mobile ? 106 : 136);
    ctx.fillStyle = "#fff";
    ctx.font = fitBold(22, mobile, 14);
    ctx.fillText("Ödül Paylaşımı", x + 22, cy + 6);
    cy += 14;

    const visibleMembers = mobile ? clan.members : clan.members.slice(0, 5);
    visibleMembers.forEach((m) => {
      const rowH = mobile ? 50 : 56;
      fillRR(ctx, x + 10, cy, w - 20, rowH, 16, "rgba(19,40,74,0.80)");
      ctx.fillStyle = "#fff";
      ctx.font = fitBold(18, mobile, 11);
      textLine(ctx, `${m.name} • ${getRoleLabel(m.role)}`, x + 22, cy + 20, w - 120);
      ctx.fillStyle = "#9fc2ff";
      ctx.font = fitFont(18, mobile, 10);
      ctx.fillText(`Pay %${m.rewardShare || 0}`, x + 22, cy + 38);
      const minusBtn = { x: x + w - (mobile ? 88 : 132), y: cy + 10, w: 28, h: 26, onClick: () => ClanSystem.setMemberRewardShare(this.store, m.id, clamp(Number(m.rewardShare || 0) - 1, 0, 25)) };
      const plusBtn = { x: x + w - (mobile ? 50 : 84), y: cy + 10, w: 28, h: 26, onClick: () => ClanSystem.setMemberRewardShare(this.store, m.id, clamp(Number(m.rewardShare || 0) + 1, 0, 25)) };
      this.buttons.push(minusBtn, plusBtn);
      fillRR(ctx, minusBtn.x, minusBtn.y, minusBtn.w, minusBtn.h, 10, "rgba(62,78,116,0.95)");
      fillRR(ctx, plusBtn.x, plusBtn.y, plusBtn.w, plusBtn.h, 10, "rgba(39,103,200,0.95)");
      ctx.fillStyle = "#fff";
      ctx.font = fitBold(18, mobile, 12);
      ctx.fillText("-", minusBtn.x + 10, minusBtn.y + 18);
      ctx.fillText("+", plusBtn.x + 8, plusBtn.y + 18);
      cy += rowH + 8;
    });
  }

  drawLogTab(ctx, x, y, w, h, state, clan) {
    const mobile = !!this.layout?.mobile;
    const logs = mobile ? (clan.logs || []) : (clan.logs || []).slice(0, 7);
    let cy = y + 8;
    logs.forEach((log) => {
      const rowH = mobile ? 48 : 56;
      fillRR(ctx, x + 10, cy, w - 20, rowH, 16, "rgba(19,40,74,0.80)");
      ctx.fillStyle = "#fff";
      ctx.font = fitFont(17, mobile, 10);
      textLine(ctx, log.text || "-", x + 22, cy + (mobile ? 20 : 24), w - 44);
      ctx.fillStyle = "#8fb3ff";
      ctx.fillText(String(log.type || "system").toUpperCase(), x + 22, cy + (mobile ? 38 : 44));
      cy += rowH + 8;
    });
  }
}
