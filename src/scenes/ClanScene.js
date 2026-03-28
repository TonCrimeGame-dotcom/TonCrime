import { ClanSystem } from "../clan/ClanSystem.js";

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

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

function fillRR(ctx, x, y, w, h, r, fill) {
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function strokeRR(ctx, x, y, w, h, r, stroke, lw = 1) {
  rr(ctx, x, y, w, h, r);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
}

function fitFont(size, weight = 500) {
  return `${weight} ${size}px Arial`;
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString("tr-TR");
}

function getPointer(input) {
  return input?.pointer || input?.p || input?.mouse || input?.state?.pointer || { x: 0, y: 0 };
}

function justPressed(input) {
  if (typeof input?.justPressed === "function") return !!input.justPressed();
  if (typeof input?.isJustPressed === "function") {
    return !!input.isJustPressed("pointer") || !!input.isJustPressed("mouseLeft") || !!input.isJustPressed("touch");
  }
  return !!input?._justPressed || !!input?.mousePressed;
}

function justReleased(input) {
  if (typeof input?.justReleased === "function") return !!input.justReleased();
  return !!input?._justReleased;
}

function canvasCssSize(canvas) {
  const rect = canvas?.getBoundingClientRect?.();
  if (rect?.width > 0 && rect?.height > 0) {
    return { w: Math.round(rect.width), h: Math.round(rect.height) };
  }
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  return {
    w: Math.max(1, Math.round((canvas?.width || window.innerWidth) / dpr)),
    h: Math.max(1, Math.round((canvas?.height || window.innerHeight) / dpr)),
  };
}

function textFit(ctx, text, x, y, maxWidth) {
  const value = String(text || "");
  if (!maxWidth || ctx.measureText(value).width <= maxWidth) {
    ctx.fillText(value, x, y);
    return;
  }
  let t = value;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  ctx.fillText(`${t}…`, x, y);
}

function wrapText(ctx, text, maxWidth, maxLines = 3) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (let i = 0; i < words.length; i += 1) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (!line || ctx.measureText(next).width <= maxWidth) {
      line = next;
    } else {
      lines.push(line);
      line = words[i];
    }
    if (lines.length >= maxLines) break;
  }

  if (line && lines.length < maxLines) lines.push(line);

  if (lines.length === maxLines && words.length) {
    const original = lines[maxLines - 1] || "";
    let t = original;
    while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
    lines[maxLines - 1] = `${t}…`;
  }

  return lines;
}

function getRoleLabel(role) {
  if (role === "leader") return "Kurucu";
  if (role === "co_leader") return "Yardımcı";
  if (role === "officer") return "Subay";
  return "Üye";
}

function timeLeftText(pending) {
  if (!pending) return "";
  const remain = Math.max(0, (Number(pending.requestedAt || 0) + Number(pending.acceptAfterMs || 0)) - Date.now());
  const sec = Math.ceil(remain / 1000);
  if (sec < 60) return `${sec} sn`;
  const min = Math.ceil(sec / 60);
  return `${min} dk`;
}

export class ClanScene {
  constructor({ store, input, i18n, assets, scenes }) {
    this.store = store;
    this.input = input;
    this.i18n = i18n;
    this.assets = assets;
    this.scenes = scenes;

    this.buttons = [];
    this.layout = null;
    this.tab = "overview";
    this.search = "";
    this.inviteName = "";
    this.searchFocused = false;
    this.inviteFocused = false;

    this.scrollY = 0;
    this.scrollMax = 0;
    this.scrollArea = null;
    this._dragScroll = null;
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

  onExit() {
    this.unbindKeyboard();
  }

  bindKeyboard() {
    this._onKey = (e) => {
      if (this.searchFocused) {
        if (e.key === "Backspace") {
          this.search = this.search.slice(0, -1);
          this.writeDirectorySearch();
          return;
        }
        if (e.key.length === 1) {
          this.search = (this.search + e.key).slice(0, 24);
          this.writeDirectorySearch();
          return;
        }
      }

      if (this.inviteFocused) {
        if (e.key === "Backspace") {
          this.inviteName = this.inviteName.slice(0, -1);
          return;
        }
        if (e.key === "Enter") {
          ClanSystem.createInvite(this.store, this.inviteName);
          this.inviteName = "";
          return;
        }
        if (e.key.length === 1) {
          this.inviteName = (this.inviteName + e.key).slice(0, 18);
        }
      }
    };
    window.addEventListener("keydown", this._onKey);
  }

  unbindKeyboard() {
    if (!this._onKey) return;
    window.removeEventListener("keydown", this._onKey);
    this._onKey = null;
  }

  writeDirectorySearch() {
    const s = this.store.get();
    const clanDirectory = { ...(s.clanDirectory || {}) };
    const player = { ...(clanDirectory.player || {}) };
    player.search = this.search;
    clanDirectory.player = player;
    this.store.set({ clanDirectory });
  }

  getState() {
    return this.store?.get ? this.store.get() : {};
  }

  getBackgroundImage() {
    return (
      (typeof this.assets?.getImage === "function" && (this.assets.getImage("clan_bg") || this.assets.getImage("clan"))) ||
      this.assets?.images?.clan_bg ||
      this.assets?.images?.clan ||
      null
    );
  }

  getLayout(ctx) {
    const size = canvasCssSize(ctx.canvas);
    const w = size.w;
    const h = size.h;
    const state = this.getState();
    const safe = state.ui?.safe || { x: 0, y: 0, w, h };
    const mobile = safe.w < 760;
    const hudTop = Number(state.ui?.hudReservedTop || (mobile ? 84 : 96));
    const chatBottom = Number(state.ui?.chatReservedBottom || (mobile ? 74 : 88));
    const side = mobile ? 10 : Math.max(16, Math.floor(safe.w * 0.03));
    const top = Math.max(safe.y + 8, safe.y + hudTop + 6);
    const bottom = safe.y + safe.h - Math.max(8, chatBottom - 8);
    const panelX = safe.x + side;
    const panelY = top;
    const panelW = safe.w - side * 2;
    const panelH = Math.max(320, bottom - top);
    const headerH = mobile ? 148 : 154;
    const heroH = mobile ? 150 : 170;
    const contentY = panelY + headerH + heroH + 14;
    const contentH = panelY + panelH - contentY - 14;

    return {
      mobile,
      w,
      h,
      safe,
      panelX,
      panelY,
      panelW,
      panelH,
      headerH,
      heroH,
      contentY,
      contentH,
      pad: mobile ? 14 : 18,
    };
  }

  drawBackground(ctx, w, h) {
    const bg = this.getBackgroundImage();
    if (bg?.width && bg?.height) {
      const scale = Math.max(w / bg.width, h / bg.height);
      const dw = bg.width * scale;
      const dh = bg.height * scale;
      ctx.drawImage(bg, (w - dw) / 2, (h - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = "#130a08";
      ctx.fillRect(0, 0, w, h);
    }

    const topShade = ctx.createLinearGradient(0, 0, 0, h);
    topShade.addColorStop(0, "rgba(8,5,4,0.22)");
    topShade.addColorStop(0.5, "rgba(18,9,5,0.12)");
    topShade.addColorStop(1, "rgba(6,3,2,0.28)");
    ctx.fillStyle = topShade;
    ctx.fillRect(0, 0, w, h);
  }

  beginScrollArea(ctx, x, y, w, h, contentH) {
    this.scrollMax = Math.max(0, Math.ceil(contentH - h));
    this.scrollY = clamp(this.scrollY, 0, this.scrollMax);
    this.scrollArea = { x, y, w, h };
    ctx.save();
    rr(ctx, x, y, w, h, 18);
    ctx.clip();
  }

  endScrollArea(ctx) {
    ctx.restore();
  }

  drawScrollBar(ctx) {
    if (!this.scrollArea || this.scrollMax <= 0) return;
    const { x, y, w, h } = this.scrollArea;
    const trackX = x + w - 5;
    const trackY = y + 8;
    const trackH = h - 16;
    const thumbH = Math.max(36, Math.floor((h / (h + this.scrollMax)) * trackH));
    const travel = Math.max(0, trackH - thumbH);
    const thumbY = trackY + (travel * this.scrollY / Math.max(1, this.scrollMax));
    fillRR(ctx, trackX, trackY, 3, trackH, 3, "rgba(255,255,255,0.10)");
    fillRR(ctx, trackX, thumbY, 3, thumbH, 3, "rgba(245,195,111,0.88)");
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

  estimateContentHeight(clan, directory, layout) {
    if (!clan) {
      const clans = ClanSystem.browseClans(this.store, this.search);
      const inbox = directory?.player?.inbox || [];
      return 120 + (inbox.length ? 112 : 0) + Math.max(1, clans.length) * (layout.mobile ? 118 : 108) + 40;
    }

    if (this.tab === "overview") return layout.mobile ? 470 : 410;
    if (this.tab === "members") return 20 + Math.max(1, clan.members.length) * (layout.mobile ? 82 : 74) + 20;
    if (this.tab === "manage") return 180 + Math.max(1, clan.members.length) * (layout.mobile ? 60 : 58) + 32;
    if (this.tab === "log") return 20 + Math.max(1, (clan.logs || []).length) * (layout.mobile ? 58 : 54) + 20;
    return 420;
  }

  render(ctx) {
    const state = this.getState();
    const clan = ClanSystem.getClan(this.store);
    const directory = ClanSystem.getDirectory(this.store);
    const L = this.layout = this.getLayout(ctx);

    this.buttons = [];
    this.scrollArea = null;

    this.drawBackground(ctx, L.w, L.h);
    this.drawShell(ctx, state, clan, directory, L);
  }

  drawShell(ctx, state, clan, directory, L) {
    const x = L.panelX;
    const y = L.panelY;
    const w = L.panelW;
    const h = L.panelH;
    const pad = L.pad;

    fillRR(ctx, x, y, w, h, 24, "rgba(18,11,8,0.18)");
    strokeRR(ctx, x, y, w, h, 24, "rgba(243,187,102,0.62)", 1.8);

    const gloss = ctx.createLinearGradient(x, y, x, y + h);
    gloss.addColorStop(0, "rgba(255,255,255,0.07)");
    gloss.addColorStop(1, "rgba(255,255,255,0.02)");
    fillRR(ctx, x + 1, y + 1, w - 2, h - 2, 23, gloss);

    const closeSize = L.mobile ? 38 : 42;
    const closeBtn = {
      x: x + w - pad - closeSize,
      y: y + 14,
      w: closeSize,
      h: closeSize,
      onClick: () => this.scenes?.go?.("home"),
    };
    this.buttons.push(closeBtn);

    fillRR(ctx, closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, 12, "rgba(12,12,14,0.42)");
    strokeRR(ctx, closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, 12, "rgba(255,255,255,0.14)", 1);
    ctx.fillStyle = "#ffffff";
    ctx.font = fitFont(L.mobile ? 26 : 28, 700);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("×", closeBtn.x + closeBtn.w / 2, closeBtn.y + closeBtn.h / 2 + 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.font = fitFont(L.mobile ? 20 : 24, 700);
    ctx.fillText("CLAN", x + pad, y + 34);

    ctx.fillStyle = "rgba(255,220,170,0.86)";
    ctx.font = fitFont(L.mobile ? 12 : 14, 500);
    ctx.fillText("TonCrime clan ağı", x + pad, y + 56);

    this.drawHero(ctx, state, clan, directory, L);
    this.drawTabs(ctx, clan, L);

    const viewportX = x + 10;
    const viewportY = L.contentY;
    const viewportW = w - 20;
    const viewportH = L.contentH;
    const contentH = this.estimateContentHeight(clan, directory, L);

    this.beginScrollArea(ctx, viewportX, viewportY, viewportW, viewportH, contentH);

    const drawY = viewportY - this.scrollY;
    if (!clan) this.drawDiscovery(ctx, state, directory, viewportX + 2, drawY + 2, viewportW - 6, contentH - 4, L);
    else this.drawClanContent(ctx, state, clan, viewportX + 2, drawY + 2, viewportW - 6, contentH - 4, L);

    this.endScrollArea(ctx);
    this.drawScrollBar(ctx);
  }

  drawHero(ctx, state, clan, directory, L) {
    const x = L.panelX + L.pad;
    const y = L.panelY + 70;
    const w = L.panelW - L.pad * 2;
    const h = L.heroH;
    const player = state.player || {};
    const pending = directory?.player?.pendingRequest || null;

    fillRR(ctx, x, y, w, h, 22, "rgba(10,12,16,0.28)");
    strokeRR(ctx, x, y, w, h, 22, "rgba(255,193,111,0.42)", 1.2);

    const leftPad = 16;
    const rightBtnW = L.mobile ? Math.min(148, w * 0.42) : 158;
    const titleMaxW = Math.max(120, w - leftPad * 2 - rightBtnW - 16);

    if (clan) {
      ctx.fillStyle = "rgba(255,255,255,0.98)";
      ctx.font = fitFont(L.mobile ? 18 : 22, 700);
      textFit(ctx, `${clan.logo || "👑"} ${clan.name}`, x + leftPad, y + 28, titleMaxW);

      ctx.fillStyle = "rgba(255,213,156,0.82)";
      ctx.font = fitFont(L.mobile ? 11 : 13, 500);
      textFit(ctx, `[${clan.tag}] Koruma aktif • Paylaşım açık`, x + leftPad, y + 48, titleMaxW);

      const playerCardY = y + (L.mobile ? 64 : 70);
      const cardGap = 10;
      const smallW = Math.floor((w - leftPad * 2 - cardGap) / 2);
      const smallH = 58;

      this.drawMiniInfo(ctx, x + leftPad, playerCardY, smallW, smallH, "Oyuncu", player.username || player.name || "Player", `Seviye ${player.level || 1}`);
      this.drawMiniInfo(ctx, x + leftPad + smallW + cardGap, playerCardY, smallW, smallH, "Bakiye", `${fmtNum(state.coins)} yTon`, `${clan.members.length}/${clan.limits?.members || clan.members.length} üye`);

      const leaveBtn = {
        x: x + w - rightBtnW - 14,
        y: y + 18,
        w: rightBtnW,
        h: 38,
        onClick: () => ClanSystem.leaveClan(this.store),
      };
      this.buttons.push(leaveBtn);
      fillRR(ctx, leaveBtn.x, leaveBtn.y, leaveBtn.w, leaveBtn.h, 14, "rgba(255,255,255,0.09)");
      strokeRR(ctx, leaveBtn.x, leaveBtn.y, leaveBtn.w, leaveBtn.h, 14, "rgba(255,255,255,0.16)", 1);
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = fitFont(L.mobile ? 13 : 14, 700);
      ctx.fillText("Clandan Ayrıl", leaveBtn.x + 18, leaveBtn.y + 24);
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.98)";
      ctx.font = fitFont(L.mobile ? 18 : 22, 700);
      textFit(ctx, player.username || player.name || "Player", x + leftPad, y + 28, titleMaxW);

      ctx.fillStyle = "rgba(255,213,156,0.82)";
      ctx.font = fitFont(L.mobile ? 11 : 13, 500);
      textFit(ctx, `Seviye ${player.level || 1} • ${fmtNum(state.coins)} yTon`, x + leftPad, y + 48, titleMaxW);

      this.drawMiniInfo(ctx, x + leftPad, y + (L.mobile ? 64 : 70), Math.floor((w - leftPad * 2 - 10) / 2), 58, "Clan Avantajı", "Koruma / paylaşım", "Kabul sonrası aktif");
      this.drawMiniInfo(ctx, x + leftPad + Math.floor((w - leftPad * 2 - 10) / 2) + 10, y + (L.mobile ? 64 : 70), Math.floor((w - leftPad * 2 - 10) / 2), 58, "Başvuru", pending ? pending.clanName : "Aktif değil", pending ? `${timeLeftText(pending)} kaldı` : "İstediğin clan'a gönder");

      const createBtn = {
        x: x + w - rightBtnW - 14,
        y: y + 18,
        w: rightBtnW,
        h: 38,
        onClick: () => this.scenes?.go?.("clan_create"),
      };
      this.buttons.push(createBtn);
      fillRR(ctx, createBtn.x, createBtn.y, createBtn.w, createBtn.h, 14, Number(player.level || 1) >= 10 ? "rgba(243,187,102,0.18)" : "rgba(255,255,255,0.07)");
      strokeRR(ctx, createBtn.x, createBtn.y, createBtn.w, createBtn.h, 14, "rgba(243,187,102,0.42)", 1);
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = fitFont(L.mobile ? 13 : 14, 700);
      ctx.fillText(Number(player.level || 1) >= 10 ? "Clan Kur • 50 yTon" : "Seviye 10'da Açılır", createBtn.x + 14, createBtn.y + 24);

      if (pending) {
        const cancelBtn = {
          x: x + w - rightBtnW - 14,
          y: y + 64,
          w: rightBtnW,
          h: 32,
          onClick: () => ClanSystem.cancelJoinRequest(this.store),
        };
        this.buttons.push(cancelBtn);
        fillRR(ctx, cancelBtn.x, cancelBtn.y, cancelBtn.w, cancelBtn.h, 12, "rgba(255,255,255,0.07)");
        strokeRR(ctx, cancelBtn.x, cancelBtn.y, cancelBtn.w, cancelBtn.h, 12, "rgba(255,255,255,0.14)", 1);
        ctx.fillStyle = "rgba(255,237,210,0.96)";
        ctx.font = fitFont(L.mobile ? 12 : 13, 700);
        ctx.fillText("Başvuruyu İptal Et", cancelBtn.x + 14, cancelBtn.y + 21);
      }
    }
  }

  drawMiniInfo(ctx, x, y, w, h, label, value, sub) {
    fillRR(ctx, x, y, w, h, 16, "rgba(255,255,255,0.05)");
    strokeRR(ctx, x, y, w, h, 16, "rgba(255,255,255,0.10)", 1);
    ctx.fillStyle = "rgba(255,213,156,0.78)";
    ctx.font = fitFont(11, 500);
    textFit(ctx, label, x + 12, y + 18, w - 24);
    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.font = fitFont(16, 700);
    textFit(ctx, value, x + 12, y + 36, w - 24);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = fitFont(11, 500);
    textFit(ctx, sub, x + 12, y + 52, w - 24);
  }

  drawTabs(ctx, clan, L) {
    if (!clan) return;

    const tabs = [
      { id: "overview", label: "Genel" },
      { id: "members", label: "Üyeler" },
      { id: "manage", label: "Yönet" },
      { id: "log", label: "Log" },
    ];

    const x = L.panelX + L.pad;
    const y = L.panelY + L.headerH + L.heroH - 6;
    const w = L.panelW - L.pad * 2;
    const gap = 8;
    const tabW = Math.floor((w - gap * (tabs.length - 1)) / tabs.length);

    tabs.forEach((tab, index) => {
      const tx = x + index * (tabW + gap);
      const btn = {
        x: tx,
        y,
        w: tabW,
        h: L.mobile ? 36 : 40,
        onClick: () => {
          this.tab = tab.id;
          this.scrollY = 0;
        },
      };
      this.buttons.push(btn);
      const active = this.tab === tab.id;
      fillRR(ctx, tx, y, tabW, btn.h, 14, active ? "rgba(243,187,102,0.20)" : "rgba(255,255,255,0.05)");
      strokeRR(ctx, tx, y, tabW, btn.h, 14, active ? "rgba(243,187,102,0.62)" : "rgba(255,255,255,0.10)", 1);
      ctx.fillStyle = active ? "rgba(255,248,236,0.98)" : "rgba(255,255,255,0.82)";
      ctx.font = fitFont(L.mobile ? 12 : 13, 700);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tab.label, tx + tabW / 2, y + btn.h / 2 + 1);
    });

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  drawSectionTitle(ctx, title, sub, x, y, w) {
    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.font = fitFont(18, 700);
    textFit(ctx, title, x, y, w);
    if (!sub) return;
    ctx.fillStyle = "rgba(255,213,156,0.76)";
    ctx.font = fitFont(12, 500);
    textFit(ctx, sub, x, y + 18, w);
  }

  drawCard(ctx, x, y, w, h) {
    fillRR(ctx, x, y, w, h, 18, "rgba(10,12,16,0.28)");
    strokeRR(ctx, x, y, w, h, 18, "rgba(255,255,255,0.10)", 1);
  }

  drawDiscovery(ctx, state, directory, x, y, w, h, L) {
    const player = state.player || {};
    const inbox = directory?.player?.inbox || [];
    const clans = ClanSystem.browseClans(this.store, this.search);

    this.drawSectionTitle(ctx, "Clan Ara", "Arka plan görünür kaldı, liste daha sade ve okunaklı.", x + 8, y + 20, w - 16);

    const searchY = y + 42;
    const searchRect = {
      x: x + 8,
      y: searchY,
      w: w - 16,
      h: 42,
      onClick: () => { this.searchFocused = true; },
    };
    this.buttons.push(searchRect);
    fillRR(ctx, searchRect.x, searchRect.y, searchRect.w, searchRect.h, 16, this.searchFocused ? "rgba(243,187,102,0.14)" : "rgba(255,255,255,0.05)");
    strokeRR(ctx, searchRect.x, searchRect.y, searchRect.w, searchRect.h, 16, this.searchFocused ? "rgba(243,187,102,0.48)" : "rgba(255,255,255,0.10)", 1);
    ctx.fillStyle = this.search ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.52)";
    ctx.font = fitFont(13, 500);
    textFit(ctx, this.search || "Clan adı veya tag ile ara...", searchRect.x + 14, searchRect.y + 26, searchRect.w - 28);

    let cy = searchRect.y + 56;

    if (inbox.length) {
      const invite = inbox[0];
      const boxH = L.mobile ? 102 : 96;
      this.drawCard(ctx, x + 8, cy, w - 16, boxH);
      this.drawSectionTitle(ctx, "Gelen Davet", `${invite.logo || "👑"} ${invite.clanName} [${invite.clanTag}]`, x + 22, cy + 22, w - 200);
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = fitFont(12, 500);
      textFit(ctx, `Gönderen ${invite.from || "Clan"}`, x + 22, cy + 58, w - 220);

      const acceptBtn = { x: x + w - 164, y: cy + boxH - 44, w: 70, h: 30, onClick: () => ClanSystem.acceptInboxInvite(this.store, invite.id) };
      const rejectBtn = { x: x + w - 86, y: cy + boxH - 44, w: 70, h: 30, onClick: () => ClanSystem.declineInboxInvite(this.store, invite.id) };
      this.buttons.push(acceptBtn, rejectBtn);
      fillRR(ctx, acceptBtn.x, acceptBtn.y, acceptBtn.w, acceptBtn.h, 12, "rgba(243,187,102,0.18)");
      fillRR(ctx, rejectBtn.x, rejectBtn.y, rejectBtn.w, rejectBtn.h, 12, "rgba(255,255,255,0.07)");
      strokeRR(ctx, acceptBtn.x, acceptBtn.y, acceptBtn.w, acceptBtn.h, 12, "rgba(243,187,102,0.42)", 1);
      strokeRR(ctx, rejectBtn.x, rejectBtn.y, rejectBtn.w, rejectBtn.h, 12, "rgba(255,255,255,0.14)", 1);
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = fitFont(12, 700);
      ctx.fillText("Kabul", acceptBtn.x + 16, acceptBtn.y + 20);
      ctx.fillText("Reddet", rejectBtn.x + 14, rejectBtn.y + 20);
      cy += boxH + 12;
    }

    if (!clans.length) {
      this.drawCard(ctx, x + 8, cy, w - 16, 72);
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = fitFont(15, 700);
      ctx.fillText("Uygun clan bulunamadı", x + 22, cy + 32);
      ctx.fillStyle = "rgba(255,255,255,0.66)";
      ctx.font = fitFont(12, 500);
      ctx.fillText("Başka bir arama dene.", x + 22, cy + 52);
      return;
    }

    clans.forEach((item, index) => {
      const rowH = L.mobile ? 106 : 96;
      const rowY = cy + index * (rowH + 12);
      this.drawCard(ctx, x + 8, rowY, w - 16, rowH);

      const btnW = L.mobile ? 86 : 94;
      const btnH = 34;
      const btnX = x + w - btnW - 18;
      const btnY = rowY + rowH - btnH - 14;
      const canJoin = Number(player.level || 1) >= Number(item.minLevel || 1);
      const joinBtn = {
        x: btnX,
        y: btnY,
        w: btnW,
        h: btnH,
        onClick: () => ClanSystem.requestJoinClan(this.store, item.id),
      };
      this.buttons.push(joinBtn);

      ctx.fillStyle = "rgba(255,255,255,0.98)";
      ctx.font = fitFont(16, 700);
      textFit(ctx, `${item.logo || "👑"} ${item.name}`, x + 22, rowY + 26, w - btnW - 54);
      ctx.fillStyle = "rgba(255,213,156,0.78)";
      ctx.font = fitFont(12, 500);
      textFit(ctx, `[${item.tag}] • Güç ${fmtNum(item.power)} • Üye ${item.members}/${item.memberCap}`, x + 22, rowY + 46, w - btnW - 54);
      ctx.fillStyle = "rgba(255,255,255,0.70)";
      ctx.font = fitFont(12, 500);
      const descLines = wrapText(ctx, `${item.description} • Giriş seviye ${item.minLevel}`, w - btnW - 54, 2);
      descLines.forEach((line, li) => ctx.fillText(line, x + 22, rowY + 66 + li * 16));

      fillRR(ctx, btnX, btnY, btnW, btnH, 12, canJoin ? "rgba(243,187,102,0.18)" : "rgba(255,255,255,0.06)");
      strokeRR(ctx, btnX, btnY, btnW, btnH, 12, canJoin ? "rgba(243,187,102,0.42)" : "rgba(255,255,255,0.12)", 1);
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = fitFont(12, 700);
      ctx.fillText(canJoin ? "Başvur" : "Yetmez", btnX + 20, btnY + 22);
    });
  }

  drawClanContent(ctx, state, clan, x, y, w, h, L) {
    if (this.tab === "overview") this.drawOverviewTab(ctx, clan, x, y, w, L);
    if (this.tab === "members") this.drawMembersTab(ctx, clan, x, y, w, L);
    if (this.tab === "manage") this.drawManageTab(ctx, clan, x, y, w, L);
    if (this.tab === "log") this.drawLogTab(ctx, clan, x, y, w, L);
  }

  drawStatCard(ctx, x, y, w, h, label, value, sub) {
    this.drawCard(ctx, x, y, w, h);
    ctx.fillStyle = "rgba(255,213,156,0.78)";
    ctx.font = fitFont(12, 500);
    textFit(ctx, label, x + 14, y + 22, w - 28);
    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.font = fitFont(17, 700);
    textFit(ctx, value, x + 14, y + 46, w - 28);
    ctx.fillStyle = "rgba(255,255,255,0.68)";
    ctx.font = fitFont(11, 500);
    textFit(ctx, sub, x + 14, y + 64, w - 28);
  }

  drawOverviewTab(ctx, clan, x, y, w, L) {
    this.drawSectionTitle(ctx, "Clan Özeti", "PVP ekranındaki sıcak tonlara geçirildi.", x + 8, y + 20, w - 16);

    const gap = 10;
    const cardW = Math.floor((w - 16 - gap) / 2);
    const row1Y = y + 40;
    const row2Y = row1Y + 84;

    this.drawStatCard(ctx, x + 8, row1Y, cardW, 74, "Seviye", `${clan.level}`, `${fmtNum(clan.xp)} XP`);
    this.drawStatCard(ctx, x + 8 + cardW + gap, row1Y, cardW, 74, "Kasa", `${fmtNum(clan.bank)}$`, `+${fmtNum(clan.dailyIncome)}/gün`);
    this.drawStatCard(ctx, x + 8, row2Y, cardW, 74, "Üyeler", `${clan.members.length}/${clan.limits?.members || clan.members.length}`, "Koruma aktif");
    this.drawStatCard(ctx, x + 8 + cardW + gap, row2Y, cardW, 74, "Güç", fmtNum(clan.power), "Global hazır");

    const aboutY = row2Y + 88;
    this.drawCard(ctx, x + 8, aboutY, w - 16, 88);
    this.drawSectionTitle(ctx, "Açıklama", null, x + 22, aboutY + 20, w - 44);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = fitFont(12, 500);
    const aboutLines = wrapText(ctx, clan.description || "Açıklama yok", w - 44, 3);
    aboutLines.forEach((line, li) => ctx.fillText(line, x + 22, aboutY + 46 + li * 16));

    const boss = ClanSystem.getBossSpinStatus(this.store);
    const bossY = aboutY + 102;
    this.drawCard(ctx, x + 8, bossY, w - 16, 122);
    this.drawSectionTitle(ctx, "Boss Bölümü", `Durum: ${boss?.bossStatus || "idle"}`, x + 22, bossY + 20, w - 180);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = fitFont(12, 500);
    ctx.fillText(`HP ${fmtNum(boss?.bossHp || 0)} / ${fmtNum(boss?.bossMaxHp || 0)}`, x + 22, bossY + 50);
    ctx.fillText(`Spin ${boss?.spinsLeft || 0} • Enerji ${boss?.energyPerSpin || 0}`, x + 22, bossY + 68);

    const raidBtn = {
      x: x + 22,
      y: bossY + 82,
      w: Math.min(190, w - 44),
      h: 30,
      onClick: () => ClanSystem.startBossRaid(this.store),
    };
    this.buttons.push(raidBtn);
    fillRR(ctx, raidBtn.x, raidBtn.y, raidBtn.w, raidBtn.h, 12, "rgba(243,187,102,0.18)");
    strokeRR(ctx, raidBtn.x, raidBtn.y, raidBtn.w, raidBtn.h, 12, "rgba(243,187,102,0.42)", 1);
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = fitFont(12, 700);
    ctx.fillText("Boss Sezonu Başlat", raidBtn.x + 16, raidBtn.y + 20);
  }

  drawMembersTab(ctx, clan, x, y, w, L) {
    this.drawSectionTitle(ctx, "Üyeler", "Yazılar üst üste binmeden daha geniş satırlar.", x + 8, y + 20, w - 16);
    let cy = y + 40;

    clan.members.forEach((member) => {
      const rowH = L.mobile ? 74 : 68;
      this.drawCard(ctx, x + 8, cy, w - 16, rowH);

      ctx.fillStyle = "rgba(255,255,255,0.98)";
      ctx.font = fitFont(15, 700);
      textFit(ctx, member.name, x + 20, cy + 24, w - 180);
      ctx.fillStyle = "rgba(255,213,156,0.76)";
      ctx.font = fitFont(11, 500);
      textFit(ctx, `${getRoleLabel(member.role)} • Lv ${member.level} • Güç ${fmtNum(member.power)} • Pay %${member.rewardShare || 0}`, x + 20, cy + 44, w - 180);

      if (member.id !== "player_main") {
        const promoteBtn = {
          x: x + w - 154,
          y: cy + 18,
          w: 64,
          h: 28,
          onClick: () => ClanSystem.promoteMember(this.store, member.id, "co_leader"),
        };
        const kickBtn = {
          x: x + w - 82,
          y: cy + 18,
          w: 56,
          h: 28,
          onClick: () => ClanSystem.kickMember(this.store, member.id),
        };
        this.buttons.push(promoteBtn, kickBtn);
        fillRR(ctx, promoteBtn.x, promoteBtn.y, promoteBtn.w, promoteBtn.h, 11, "rgba(255,255,255,0.07)");
        fillRR(ctx, kickBtn.x, kickBtn.y, kickBtn.w, kickBtn.h, 11, "rgba(255,255,255,0.07)");
        strokeRR(ctx, promoteBtn.x, promoteBtn.y, promoteBtn.w, promoteBtn.h, 11, "rgba(255,255,255,0.14)", 1);
        strokeRR(ctx, kickBtn.x, kickBtn.y, kickBtn.w, kickBtn.h, 11, "rgba(255,255,255,0.14)", 1);
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.font = fitFont(11, 700);
        ctx.fillText("Yükselt", promoteBtn.x + 10, promoteBtn.y + 18);
        ctx.fillText("At", kickBtn.x + 20, kickBtn.y + 18);
      }

      cy += rowH + 10;
    });
  }

  drawManageTab(ctx, clan, x, y, w, L) {
    this.drawSectionTitle(ctx, "Yönetim", "Mavi/yeşil/bordo yerine sıcak cam panel düzeni.", x + 8, y + 20, w - 16);

    this.drawCard(ctx, x + 8, y + 40, w - 16, 108);
    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.font = fitFont(15, 700);
    ctx.fillText("Davet Gönder", x + 22, y + 66);
    ctx.fillStyle = "rgba(255,255,255,0.66)";
    ctx.font = fitFont(12, 500);
    ctx.fillText("Oyuncu adı yaz ve clan daveti gönder.", x + 22, y + 86);

    const inputRect = {
      x: x + 22,
      y: y + 98,
      w: w - 148,
      h: 34,
      onClick: () => { this.inviteFocused = true; },
    };
    const sendBtn = {
      x: x + w - 116,
      y: y + 98,
      w: 88,
      h: 34,
      onClick: () => {
        ClanSystem.createInvite(this.store, this.inviteName);
        this.inviteName = "";
      },
    };
    this.buttons.push(inputRect, sendBtn);

    fillRR(ctx, inputRect.x, inputRect.y, inputRect.w, inputRect.h, 12, this.inviteFocused ? "rgba(243,187,102,0.12)" : "rgba(255,255,255,0.05)");
    strokeRR(ctx, inputRect.x, inputRect.y, inputRect.w, inputRect.h, 12, this.inviteFocused ? "rgba(243,187,102,0.40)" : "rgba(255,255,255,0.10)", 1);
    fillRR(ctx, sendBtn.x, sendBtn.y, sendBtn.w, sendBtn.h, 12, "rgba(243,187,102,0.18)");
    strokeRR(ctx, sendBtn.x, sendBtn.y, sendBtn.w, sendBtn.h, 12, "rgba(243,187,102,0.42)", 1);

    ctx.fillStyle = this.inviteName ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.50)";
    ctx.font = fitFont(12, 500);
    textFit(ctx, this.inviteName || "Oyuncu adı...", inputRect.x + 12, inputRect.y + 22, inputRect.w - 24);
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = fitFont(12, 700);
    ctx.fillText("Davet At", sendBtn.x + 16, sendBtn.y + 22);

    let cy = y + 160;
    clan.members.forEach((member) => {
      const rowH = 52;
      this.drawCard(ctx, x + 8, cy, w - 16, rowH);
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = fitFont(13, 700);
      textFit(ctx, `${member.name} • ${getRoleLabel(member.role)}`, x + 20, cy + 22, w - 160);
      ctx.fillStyle = "rgba(255,255,255,0.66)";
      ctx.font = fitFont(11, 500);
      ctx.fillText(`Pay %${member.rewardShare || 0}`, x + 20, cy + 40);

      const minusBtn = {
        x: x + w - 94,
        y: cy + 12,
        w: 28,
        h: 28,
        onClick: () => ClanSystem.setMemberRewardShare(this.store, member.id, clamp(Number(member.rewardShare || 0) - 1, 0, 25)),
      };
      const plusBtn = {
        x: x + w - 54,
        y: cy + 12,
        w: 28,
        h: 28,
        onClick: () => ClanSystem.setMemberRewardShare(this.store, member.id, clamp(Number(member.rewardShare || 0) + 1, 0, 25)),
      };
      this.buttons.push(minusBtn, plusBtn);
      fillRR(ctx, minusBtn.x, minusBtn.y, minusBtn.w, minusBtn.h, 10, "rgba(255,255,255,0.06)");
      fillRR(ctx, plusBtn.x, plusBtn.y, plusBtn.w, plusBtn.h, 10, "rgba(243,187,102,0.16)");
      strokeRR(ctx, minusBtn.x, minusBtn.y, minusBtn.w, minusBtn.h, 10, "rgba(255,255,255,0.12)", 1);
      strokeRR(ctx, plusBtn.x, plusBtn.y, plusBtn.w, plusBtn.h, 10, "rgba(243,187,102,0.36)", 1);
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = fitFont(16, 700);
      ctx.fillText("-", minusBtn.x + 10, minusBtn.y + 19);
      ctx.fillText("+", plusBtn.x + 8, plusBtn.y + 19);

      cy += rowH + 8;
    });
  }

  drawLogTab(ctx, clan, x, y, w, L) {
    this.drawSectionTitle(ctx, "Log", "Daha rahat okunan kısa satırlar.", x + 8, y + 20, w - 16);
    let cy = y + 40;
    const logs = clan.logs || [];

    if (!logs.length) {
      this.drawCard(ctx, x + 8, cy, w - 16, 64);
      ctx.fillStyle = "rgba(255,255,255,0.86)";
      ctx.font = fitFont(14, 700);
      ctx.fillText("Henüz log yok", x + 22, cy + 28);
      return;
    }

    logs.forEach((log) => {
      const rowH = L.mobile ? 54 : 50;
      this.drawCard(ctx, x + 8, cy, w - 16, rowH);
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = fitFont(12, 500);
      textFit(ctx, log.text || "-", x + 18, cy + 24, w - 120);
      ctx.fillStyle = "rgba(255,213,156,0.72)";
      ctx.font = fitFont(10, 700);
      ctx.fillText(String(log.type || "system").toUpperCase(), x + 18, cy + 42);
      cy += rowH + 8;
    });
  }
}
