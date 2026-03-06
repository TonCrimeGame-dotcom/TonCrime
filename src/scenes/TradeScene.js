function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function fmtTon(n) {
  const v = Number(n || 0);
  return `${v.toFixed(2)} TON`;
}

function dayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nowTs() {
  return Date.now();
}

const DAY_MS = 24 * 60 * 60 * 1000;
const BUILDING_PRICE_TON = 100;
const DAILY_PRODUCTION = 50;

const BUILDING_TYPES = [
  {
    id: "brothel",
    name: "Genel Ev",
    products: ["VIP Oda", "Özel Gösteri", "Gece Paketi", "Lüks Paket"],
  },
  {
    id: "coffeeshop",
    name: "Coffeeshop",
    products: ["Amnesia Haze", "White Widow", "OG Kush", "Premium Mix"],
  },
  {
    id: "nightclub",
    name: "Nightclub",
    products: ["Bira", "Tekila", "VIP Şişe", "Özel Kokteyl"],
  },
];

const SEEDED_MARKET = [
  {
    id: "npc_1",
    sellerUsername: "PatronNoir",
    venueName: "Noir Club",
    buildingType: "Nightclub",
    productName: "VIP Şişe",
    priceTon: 3.5,
    quantity: 18,
    seeded: true,
  },
  {
    id: "npc_2",
    sellerUsername: "KaraMasa",
    venueName: "Amsterdam Gold",
    buildingType: "Coffeeshop",
    productName: "White Widow",
    priceTon: 2.25,
    quantity: 26,
    seeded: true,
  },
  {
    id: "npc_3",
    sellerUsername: "QueenLuna",
    venueName: "Ruby House",
    buildingType: "Genel Ev",
    productName: "Gece Paketi",
    priceTon: 5.0,
    quantity: 9,
    seeded: true,
  },
];

export class TradeScene {
  constructor({ store, scenes, assets }) {
    this.store = store;
    this.scenes = scenes;
    this.assets = assets;

    this.root = null;
    this.activeTab = "business";
  }

  onEnter() {
    this._ensureState();
    this._tickTrade();
    this._ensureDom();
    this._show();
    this._render();
  }

  onExit() {
    this._hide();
  }

  update() {}

  render(ctx, w, h) {
    const bg = this._getBg();

    if (bg) {
      const iw = bg.width || 1;
      const ih = bg.height || 1;
      const scale = Math.max(w / iw, h / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (w - dw) / 2;
      const dy = (h - dh) / 2;
      ctx.drawImage(bg, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = "#0b0b0f";
      ctx.fillRect(0, 0, w, h);
    }

    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, w, h);
  }

  _getBg() {
    if (typeof this.assets?.getImage === "function") {
      return this.assets.getImage("blackmarket_bg") || this.assets.getImage("blackmarket");
    }
    if (typeof this.assets?.get === "function") {
      return this.assets.get("blackmarket_bg") || this.assets.get("blackmarket");
    }
    return this.assets?.images?.blackmarket_bg || this.assets?.images?.blackmarket || null;
  }

  _ensureState() {
    const s = this.store.get();
    if (s.trade) return;

    this.store.set({
      trade: {
        tonBalance: 0,
        withdrawableTon: 0,
        withdrawnTon: 0,
        walletAddress: "",
        lastWithdrawDayKey: null,
        serverTreasuryBurned: 0,
        buildings: [],
        marketListings: [],
      },
    });
  }

  _getState() {
    this._ensureState();
    return this.store.get();
  }

  _setTrade(nextTrade) {
    this.store.set({ trade: nextTrade });
  }

  _canOwnBusiness() {
    const s = this._getState();
    const level = Number(s.player?.level || 0);
    const premium = !!s.premium;
    return level >= 50 || premium;
  }

  _getBuildingTypeMeta(typeId) {
    return BUILDING_TYPES.find((x) => x.id === typeId) || BUILDING_TYPES[0];
  }

  _nextProduct(building) {
    const meta = this._getBuildingTypeMeta(building.typeId);
    const products = meta.products || [];
    if (!products.length) return building.productName || "Ürün";
    const idx = Math.max(0, products.indexOf(building.productName));
    return products[(idx + 1) % products.length];
  }

  _tickTrade() {
    const s = this._getState();
    const trade = s.trade;
    const now = nowTs();

    const nextBuildings = (trade.buildings || []).map((b) => {
      const last = Number(b.lastProductionAt || now);
      const passedDays = Math.floor((now - last) / DAY_MS);
      if (passedDays <= 0) return b;

      let burned = Number(b.burnedTotal || 0);
      let unclaimed = Number(b.unclaimedQty || 0);

      for (let i = 0; i < passedDays; i++) {
        if (unclaimed > 0) burned += unclaimed;
        unclaimed = DAILY_PRODUCTION;
      }

      return {
        ...b,
        unclaimedQty: unclaimed,
        burnedTotal: burned,
        lastProductionAt: last + passedDays * DAY_MS,
      };
    });

    const burnedBefore = (trade.buildings || []).reduce((a, b) => a + Number(b.burnedTotal || 0), 0);
    const burnedAfter = nextBuildings.reduce((a, b) => a + Number(b.burnedTotal || 0), 0);
    const burnDelta = Math.max(0, burnedAfter - burnedBefore);

    const nextListings = (trade.marketListings || []).map((l) => {
      const last = Number(l.lastMarketTickAt || now);
      const steps = Math.floor((now - last) / (6 * 60 * 60 * 1000));
      if (steps <= 0 || Number(l.quantity || 0) <= 0) return l;

      let quantity = Number(l.quantity || 0);
      let sold = Number(l.soldQty || 0);
      let earned = 0;

      for (let i = 0; i < steps; i++) {
        if (quantity <= 0) break;
        const soldNow = clamp(Math.floor(Math.random() * 6), 0, quantity);
        quantity -= soldNow;
        sold += soldNow;
        earned += soldNow * Number(l.priceTon || 0);
      }

      return {
        ...l,
        quantity,
        soldQty: sold,
        earnedTonPending: Number(l.earnedTonPending || 0) + earned,
        lastMarketTickAt: last + steps * (6 * 60 * 60 * 1000),
      };
    });

    const pendingFromListings = nextListings.reduce((a, l) => a + Number(l.earnedTonPending || 0), 0);

    this._setTrade({
      ...trade,
      buildings: nextBuildings,
      marketListings: nextListings,
      withdrawableTon: pendingFromListings,
      serverTreasuryBurned: Number(trade.serverTreasuryBurned || 0) + burnDelta,
    });
  }

  _buyBuilding(typeId) {
    const s = this._getState();
    const trade = s.trade;

    if (!this._canOwnBusiness()) {
      alert("Bina satın almak için level 50+ olmalı veya premium açık olmalı.");
      return;
    }

    if (Number(trade.tonBalance || 0) < BUILDING_PRICE_TON) {
      alert("Yetersiz TONcoin. Bina fiyatı 100 TON.");
      return;
    }

    const meta = this._getBuildingTypeMeta(typeId);
    const countSame = (trade.buildings || []).filter((x) => x.typeId === typeId).length + 1;

    const venueName =
      meta.id === "brothel"
        ? `Genel Ev ${countSame}`
        : meta.id === "coffeeshop"
        ? `Coffeeshop ${countSame}`
        : `Nightclub ${countSame}`;

    const building = {
      id: `b_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
      typeId: meta.id,
      typeName: meta.name,
      venueName,
      ownerUsername: s.player?.username || "Player",
      productName: meta.products[0],
      priceTon: 1.0,
      stockPerDay: DAILY_PRODUCTION,
      unclaimedQty: DAILY_PRODUCTION,
      burnedTotal: 0,
      collectedTotal: 0,
      soldTotal: 0,
      createdAt: Date.now(),
      lastProductionAt: Date.now(),
    };

    this._setTrade({
      ...trade,
      tonBalance: Number(trade.tonBalance || 0) - BUILDING_PRICE_TON,
      buildings: [...(trade.buildings || []), building],
    });

    this._render();
  }

  _renameBuilding(id) {
    const s = this._getState();
    const trade = s.trade;
    const b = (trade.buildings || []).find((x) => x.id === id);
    if (!b) return;

    const nextName = window.prompt("Mekan ismi gir:", b.venueName || "");
    if (!nextName) return;

    const cleaned = String(nextName).trim().slice(0, 24);
    if (!cleaned) return;

    this._setTrade({
      ...trade,
      buildings: (trade.buildings || []).map((x) =>
        x.id === id ? { ...x, venueName: cleaned } : x
      ),
    });

    this._render();
  }

  _changeProduct(id) {
    const s = this._getState();
    const trade = s.trade;

    this._setTrade({
      ...trade,
      buildings: (trade.buildings || []).map((x) =>
        x.id === id ? { ...x, productName: this._nextProduct(x) } : x
      ),
    });

    this._render();
  }

  _setPrice(id) {
    const s = this._getState();
    const trade = s.trade;
    const b = (trade.buildings || []).find((x) => x.id === id);
    if (!b) return;

    const raw = window.prompt("1 ürün satış fiyatı (TON):", String(b.priceTon ?? 1));
    if (raw == null) return;

    const num = clamp(Number(raw), 0.01, 999999);
    if (!Number.isFinite(num)) return;

    this._setTrade({
      ...trade,
      buildings: (trade.buildings || []).map((x) =>
        x.id === id ? { ...x, priceTon: Number(num.toFixed(2)) } : x
      ),
    });

    this._render();
  }

  _collectProduction(id) {
    this._tickTrade();
    const s = this._getState();
    const trade = s.trade;
    const b = (trade.buildings || []).find((x) => x.id === id);
    if (!b) return;

    const qty = Number(b.unclaimedQty || 0);
    if (qty <= 0) {
      alert("Toplanacak üretim yok.");
      return;
    }

    const listing = {
      id: `l_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
      buildingId: b.id,
      sellerUsername: b.ownerUsername,
      venueName: b.venueName,
      buildingType: b.typeName,
      productName: b.productName,
      priceTon: Number(b.priceTon || 1),
      quantity: qty,
      soldQty: 0,
      earnedTonPending: 0,
      lastMarketTickAt: Date.now(),
      seeded: false,
    };

    this._setTrade({
      ...trade,
      buildings: (trade.buildings || []).map((x) =>
        x.id === id
          ? {
              ...x,
              unclaimedQty: 0,
              collectedTotal: Number(x.collectedTotal || 0) + qty,
            }
          : x
      ),
      marketListings: [...(trade.marketListings || []), listing],
    });

    this._render();
  }

  _setWallet() {
    const s = this._getState();
    const trade = s.trade;
    const raw = window.prompt("TON cüzdan adresi:", trade.walletAddress || "");
    if (raw == null) return;

    this._setTrade({
      ...trade,
      walletAddress: String(raw).trim(),
    });

    this._render();
  }

  _withdraw() {
    this._tickTrade();
    const s = this._getState();
    const trade = s.trade;
    const today = dayKey();

    if (!trade.walletAddress) {
      alert("Önce TON cüzdan adresi gir.");
      return;
    }

    if (trade.lastWithdrawDayKey === today) {
      alert("Günlük çekim hakkı bugün kullanıldı.");
      return;
    }

    const amount = Number(trade.withdrawableTon || 0);
    if (amount <= 0) {
      alert("Çekilebilir bakiye yok.");
      return;
    }

    this._setTrade({
      ...trade,
      withdrawableTon: 0,
      withdrawnTon: Number(trade.withdrawnTon || 0) + amount,
      lastWithdrawDayKey: today,
      marketListings: (trade.marketListings || []).map((l) => ({
        ...l,
        earnedTonPending: 0,
      })),
    });

    alert(`${amount.toFixed(2)} TON için çekim talebi oluşturuldu.`);
    this._render();
  }

  _seedTonForDev() {
    const s = this._getState();
    const trade = s.trade;
    this._setTrade({
      ...trade,
      tonBalance: Number(trade.tonBalance || 0) + 500,
    });
    this._render();
  }

  _businessHtml() {
    const s = this._getState();
    const trade = s.trade;
    const level = Number(s.player?.level || 0);
    const premium = !!s.premium;
    const canOwn = this._canOwnBusiness();

    const buildingCards = BUILDING_TYPES.map(
      (b) => `
        <div class="tcTradeCard">
          <div class="tcTradeCardTitle">${b.name}</div>
          <div class="tcTradeMuted">Fiyat: <b>100 TON</b></div>
          <div class="tcTradeMuted">Günlük üretim: <b>50 adet</b></div>
          <div class="tcTradeMuted">Sadece kendi ürününü satar</div>
          <button class="tcTradeBtn" data-act="buy-building" data-type="${b.id}">
            Satın Al
          </button>
        </div>
      `
    ).join("");

    const ownedHtml =
      (trade.buildings || []).length === 0
        ? `<div class="tcTradeEmpty">Henüz bina yok.</div>`
        : (trade.buildings || [])
            .map((b) => {
              const burned = Number(b.burnedTotal || 0);
              const unclaimed = Number(b.unclaimedQty || 0);
              return `
                <div class="tcTradeOwned">
                  <div class="tcTradeOwnedHead">
                    <div>
                      <div class="tcTradeOwnedTitle">${b.venueName}</div>
                      <div class="tcTradeMuted">${b.typeName} • Ürün: <b>${b.productName}</b></div>
                      <div class="tcTradeMuted">Sahip: <b>${b.ownerUsername}</b></div>
                    </div>
                    <div class="tcTradePrice">${fmtTon(b.priceTon)} / adet</div>
                  </div>

                  <div class="tcTradeOwnedStats">
                    <div>Toplanmayı bekleyen: <b>${unclaimed}</b></div>
                    <div>Yanan ürün: <b>${burned}</b></div>
                    <div>Toplanan toplam: <b>${Number(b.collectedTotal || 0)}</b></div>
                  </div>

                  <div class="tcTradeActions">
                    <button class="tcTradeBtn" data-act="rename" data-id="${b.id}">Mekan İsmi</button>
                    <button class="tcTradeBtn" data-act="change-product" data-id="${b.id}">Ürün Değiştir</button>
                    <button class="tcTradeBtn" data-act="set-price" data-id="${b.id}">Fiyat Belirle</button>
                    <button class="tcTradeBtn tcTradeBtnGold" data-act="collect" data-id="${b.id}">Üretimi Topla</button>
                  </div>
                </div>
              `;
            })
            .join("");

    return `
      <div class="tcTradeSection">
        <div class="tcTradeInfoGrid">
          <div class="tcTradeInfoBox">
            <div class="tcTradeInfoTitle">Giriş Şartı</div>
            <div class="tcTradeInfoText">Level 50+ veya premium</div>
            <div class="tcTradeInfoText">Şu an: LVL ${level} • Premium: ${premium ? "Açık" : "Kapalı"}</div>
            <div class="tcTradeInfoText">${canOwn ? "Patron paneli açık" : "Patron paneli kilitli"}</div>
          </div>

          <div class="tcTradeInfoBox">
            <div class="tcTradeInfoTitle">TON Bakiye</div>
            <div class="tcTradeInfoText">${fmtTon(trade.tonBalance || 0)}</div>
            <button class="tcTradeBtn" data-act="dev-ton">Test için +500 TON</button>
          </div>

          <div class="tcTradeInfoBox">
            <div class="tcTradeInfoTitle">Günlük Çekim</div>
            <div class="tcTradeInfoText">Çekilebilir: ${fmtTon(trade.withdrawableTon || 0)}</div>
            <div class="tcTradeInfoText">Cüzdan: ${trade.walletAddress || "Tanımlı değil"}</div>
            <div class="tcTradeActions">
              <button class="tcTradeBtn" data-act="set-wallet">Cüzdan Gir</button>
              <button class="tcTradeBtn tcTradeBtnGold" data-act="withdraw">Parayı Çek</button>
            </div>
          </div>

          <div class="tcTradeInfoBox">
            <div class="tcTradeInfoTitle">Server Kasası</div>
            <div class="tcTradeInfoText">Yanan ürün toplamı: ${Number(trade.serverTreasuryBurned || 0)}</div>
            <div class="tcTradeInfoText">24 saatte toplanmayan üretim direkt kasaya gider.</div>
          </div>
        </div>
      </div>

      <div class="tcTradeSection">
        <div class="tcTradeSectionTitle">Yeni Bina Satın Al</div>
        <div class="tcTradeCardGrid">${buildingCards}</div>
      </div>

      <div class="tcTradeSection">
        <div class="tcTradeSectionTitle">İş Hayatım</div>
        ${ownedHtml}
      </div>
    `;
  }

  _marketHtml() {
    this._tickTrade();
    const s = this._getState();
    const trade = s.trade;

    const ownListings = (trade.marketListings || []).filter((x) => Number(x.quantity || 0) > 0);
    const allListings = [...ownListings, ...SEEDED_MARKET];

    const marketHtml =
      allListings.length === 0
        ? `<div class="tcTradeEmpty">Açık pazarda ilan yok.</div>`
        : allListings
            .map((l) => {
              const seller = l.sellerUsername || "Patron";
              const venue = l.venueName || "Mekan";
              const type = l.buildingType || "-";
              const sold = Number(l.soldQty || 0);

              return `
                <div class="tcTradeMarketRow">
                  <div class="tcTradeMarketMain">
                    <div class="tcTradeOwnedTitle">${l.productName}</div>
                    <div class="tcTradeMuted">Mekan: <b>${venue}</b> • Tür: <b>${type}</b></div>
                    <div class="tcTradeMuted">Kullanıcı: <b>${seller}</b></div>
                  </div>

                  <div class="tcTradeMarketSide">
                    <div class="tcTradePrice">${fmtTon(l.priceTon)} / adet</div>
                    <div class="tcTradeMuted">Stok: <b>${Number(l.quantity || 0)}</b></div>
                    ${l.seeded ? "" : `<div class="tcTradeMuted">Satılan: <b>${sold}</b></div>`}
                  </div>
                </div>
              `;
            })
            .join("");

    return `
      <div class="tcTradeSection">
        <div class="tcTradeInfoGrid">
          <div class="tcTradeInfoBox">
            <div class="tcTradeInfoTitle">Açık Pazar</div>
            <div class="tcTradeInfoText">Patronların topladığı ürünler burada listelenir.</div>
            <div class="tcTradeInfoText">Üretici mekan ve kullanıcı adı görünür.</div>
          </div>

          <div class="tcTradeInfoBox">
            <div class="tcTradeInfoTitle">Kurallar</div>
            <div class="tcTradeInfoText">• Bina limiti yok</div>
            <div class="tcTradeInfoText">• Bina fiyatı 100 TON</div>
            <div class="tcTradeInfoText">• 24 saat içinde toplanmayan üretim yanar</div>
          </div>
        </div>
      </div>

      <div class="tcTradeSection">
        <div class="tcTradeSectionTitle">Pazar İlanları</div>
        ${marketHtml}
      </div>
    `;
  }

  _render() {
    if (!this.root) return;

    this._tickTrade();

    const s = this._getState();
    const trade = s.trade;

    const body = this.root.querySelector("#tcTradeBody");
    const tonEl = this.root.querySelector("#tcTradeTon");
    const wEl = this.root.querySelector("#tcTradeWithdrawable");
    const titleEl = this.root.querySelector("#tcTradeTabTitle");
    const tabBusiness = this.root.querySelector('[data-tab="business"]');
    const tabMarket = this.root.querySelector('[data-tab="market"]');

    if (tonEl) tonEl.textContent = fmtTon(trade.tonBalance || 0);
    if (wEl) wEl.textContent = fmtTon(trade.withdrawableTon || 0);
    if (titleEl) titleEl.textContent = this.activeTab === "business" ? "İş Hayatım" : "Açık Pazar";

    if (tabBusiness) tabBusiness.classList.toggle("active", this.activeTab === "business");
    if (tabMarket) tabMarket.classList.toggle("active", this.activeTab === "market");

    if (body) {
      body.innerHTML = this.activeTab === "business" ? this._businessHtml() : this._marketHtml();
    }
  }

  _show() {
    if (!this.root) return;
    this.root.style.display = "block";
  }

  _hide() {
    if (!this.root) return;
    this.root.style.display = "none";
  }

  _ensureDom() {
    if (this.root) return;

    const root = document.createElement("div");
    root.id = "tcTradeRoot";
    root.style.cssText = `
      position: fixed;
      left: 12px;
      right: 12px;
      top: 96px;
      bottom: 58px;
      z-index: 7000;
      display: none;
      pointer-events: auto;
      border-radius: 18px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.12);
      background:
        linear-gradient(rgba(0,0,0,0.62), rgba(0,0,0,0.72)),
        url('./src/assets/BlackMarket.png') center center / cover no-repeat;
      backdrop-filter: blur(4px);
      color: rgba(255,255,255,0.94);
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      box-shadow: 0 16px 42px rgba(0,0,0,0.42);
    `;

    root.innerHTML = `
      <style>
        #tcTradeRoot * { box-sizing: border-box; }
        .tcTradeHead {
          padding: 12px;
          border-bottom: 1px solid rgba(255,255,255,0.10);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          background: rgba(0,0,0,0.28);
        }
        .tcTradeHeadLeft { min-width: 0; }
        .tcTradeHeadTitle {
          font-size: 18px;
          font-weight: 900;
          letter-spacing: 0.2px;
        }
        .tcTradeMuted,
        .tcTradeInfoText {
          font-size: 12px;
          color: rgba(255,255,255,0.82);
          line-height: 1.35;
        }
        .tcTradeHeadStats {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .tcTradeChip {
          padding: 8px 10px;
          border-radius: 12px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.10);
          font-size: 12px;
          white-space: nowrap;
        }
        .tcTradeTabs {
          display: flex;
          gap: 8px;
          padding: 12px;
          border-bottom: 1px solid rgba(255,255,255,0.10);
          background: rgba(0,0,0,0.22);
        }
        .tcTradeTab {
          appearance: none;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.92);
          border-radius: 12px;
          height: 38px;
          padding: 0 14px;
          font-weight: 900;
          cursor: pointer;
        }
        .tcTradeTab.active {
          background: rgba(255,255,255,0.16);
        }
        .tcTradeClose {
          appearance: none;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.92);
          border-radius: 12px;
          height: 38px;
          padding: 0 14px;
          font-weight: 900;
          cursor: pointer;
        }
        .tcTradeScroll {
          height: calc(100% - 126px);
          overflow: auto;
          padding: 12px;
          background: rgba(0,0,0,0.16);
        }
        .tcTradeSection {
          margin-bottom: 14px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(0,0,0,0.40);
          border-radius: 16px;
          padding: 12px;
          backdrop-filter: blur(3px);
        }
        .tcTradeSectionTitle {
          font-size: 14px;
          font-weight: 900;
          margin-bottom: 10px;
        }
        .tcTradeInfoGrid,
        .tcTradeCardGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .tcTradeInfoBox,
        .tcTradeCard,
        .tcTradeOwned,
        .tcTradeMarketRow {
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(0,0,0,0.34);
          border-radius: 14px;
          padding: 12px;
        }
        .tcTradeCardTitle,
        .tcTradeOwnedTitle,
        .tcTradeInfoTitle {
          font-weight: 900;
          font-size: 13px;
          margin-bottom: 6px;
        }
        .tcTradeBtn {
          appearance: none;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.92);
          border-radius: 12px;
          height: 34px;
          padding: 0 12px;
          font-weight: 900;
          cursor: pointer;
        }
        .tcTradeBtnGold {
          background: rgba(242,211,107,0.16);
        }
        .tcTradeActions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 10px;
        }
        .tcTradeOwnedHead,
        .tcTradeMarketRow {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
        }
        .tcTradeOwnedStats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin-top: 10px;
          font-size: 12px;
        }
        .tcTradePrice {
          font-weight: 900;
          font-size: 13px;
          white-space: nowrap;
        }
        .tcTradeEmpty {
          padding: 14px;
          text-align: center;
          border: 1px dashed rgba(255,255,255,0.16);
          border-radius: 14px;
          color: rgba(255,255,255,0.72);
          font-size: 13px;
          background: rgba(0,0,0,0.24);
        }
        @media (max-width: 820px) {
          .tcTradeInfoGrid,
          .tcTradeCardGrid,
          .tcTradeOwnedStats {
            grid-template-columns: 1fr;
          }
          .tcTradeOwnedHead,
          .tcTradeMarketRow,
          .tcTradeHead {
            flex-direction: column;
            align-items: stretch;
          }
          .tcTradeHeadStats {
            justify-content: flex-start;
          }
        }
      </style>

      <div class="tcTradeHead">
        <div class="tcTradeHeadLeft">
          <div class="tcTradeHeadTitle">TİCARET</div>
          <div class="tcTradeMuted">
            Level 50+ veya premium patron olabilir. Binalar günde 50 üretir. 24 saat içinde toplanmazsa ürün yanar.
          </div>
        </div>

        <div class="tcTradeHeadStats">
          <div class="tcTradeChip">TON: <b id="tcTradeTon">0 TON</b></div>
          <div class="tcTradeChip">Çekilebilir: <b id="tcTradeWithdrawable">0 TON</b></div>
          <button class="tcTradeClose" id="tcTradeBackBtn" type="button">Geri</button>
        </div>
      </div>

      <div class="tcTradeTabs">
        <button class="tcTradeTab active" data-tab="business" type="button">1- İş Hayatım</button>
        <button class="tcTradeTab" data-tab="market" type="button">2- Açık Pazar</button>
        <div style="margin-left:auto; align-self:center; font-weight:900;" id="tcTradeTabTitle">İş Hayatım</div>
      </div>

      <div class="tcTradeScroll" id="tcTradeBody"></div>
    `;

    document.body.appendChild(root);
    this.root = root;

    root.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      if (target.id === "tcTradeBackBtn") {
        this.scenes.go("home");
        return;
      }

      const tab = target.getAttribute("data-tab");
      if (tab) {
        this.activeTab = tab;
        this._render();
        return;
      }

      const act = target.getAttribute("data-act");
      const id = target.getAttribute("data-id");
      const type = target.getAttribute("data-type");

      if (act === "buy-building" && type) this._buyBuilding(type);
      if (act === "rename" && id) this._renameBuilding(id);
      if (act === "change-product" && id) this._changeProduct(id);
      if (act === "set-price" && id) this._setPrice(id);
      if (act === "collect" && id) this._collectProduction(id);
      if (act === "set-wallet") this._setWallet();
      if (act === "withdraw") this._withdraw();
      if (act === "dev-ton") this._seedTonForDev();
    });
  }
}