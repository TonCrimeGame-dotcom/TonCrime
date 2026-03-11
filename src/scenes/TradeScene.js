export class TradeScene {
  constructor({ store, input, i18n, assets, scenes }) {
    this.store = store
    this.input = input
    this.i18n = i18n
    this.assets = assets
    this.scenes = scenes

    this.scrollY = 0
    this.tab = "explore"

    this.hit = []
  }

  onEnter() {
    this.scrollY = 0
  }

  update() {
    const p = this.input.pointer

    if (!p || !p.justReleased) return

    for (const h of this.hit) {
      if (
        p.x >= h.x &&
        p.x <= h.x + h.w &&
        p.y >= h.y &&
        p.y <= h.y + h.h
      ) {
        if (h.type === "tab") {
          this.tab = h.value
        }

        if (h.type === "back") {
          this.scenes.go("home")
        }

        if (h.type === "spin") {
          alert("Çark döndü (demo)")
        }

        if (h.type === "buy") {
          alert("Satın alındı (demo)")
        }
      }
    }
  }

  drawButton(ctx, x, y, w, h, text, type, value) {
    this.hit.push({ x, y, w, h, type, value })

    ctx.fillStyle = "#1b2330"
    ctx.fillRect(x, y, w, h)

    ctx.strokeStyle = "#3a86ff"
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, w, h)

    ctx.fillStyle = "#fff"
    ctx.font = "bold 14px Arial"
    ctx.textAlign = "center"
    ctx.fillText(text, x + w / 2, y + h / 2 + 5)
  }

  render(ctx) {
    const s = this.store.get()

    const W = ctx.canvas.width
    const H = ctx.canvas.height

    this.hit = []

    ctx.fillStyle = "#0b0f17"
    ctx.fillRect(0, 0, W, H)

    /* HEADER */

    ctx.fillStyle = "#111827"
    ctx.fillRect(0, 0, W, 90)

    this.drawButton(ctx, 20, 25, 80, 40, "← Geri", "back")

    ctx.fillStyle = "#fff"
    ctx.font = "bold 26px Arial"
    ctx.textAlign = "left"
    ctx.fillText("Black Market", 120, 50)

    /* TABS */

    const tabs = [
      ["explore", "Keşfet"],
      ["business", "İşletmeler"],
      ["inventory", "Envanter"],
      ["loot", "Sandık"],
      ["market", "Pazar"],
      ["buy", "Satın Al"],
    ]

    let tx = 20
    for (const t of tabs) {
      this.drawButton(ctx, tx, 110, 120, 40, t[1], "tab", t[0])
      tx += 130
    }

    let y = 180

    if (this.tab === "explore") {
      ctx.fillStyle = "#fff"
      ctx.font = "20px Arial"
      ctx.fillText("Keşfet", 30, y)

      y += 40

      this.drawButton(ctx, 30, y, 200, 60, "En Ucuz Mekanlar", "tab", "market")
      this.drawButton(ctx, 250, y, 200, 60, "Popüler Mekanlar", "tab", "market")

      y += 80

      this.drawButton(ctx, 30, y, 200, 60, "Sandık Fırsatları", "tab", "loot")
      this.drawButton(ctx, 250, y, 200, 60, "Günlük Çark", "spin")
    }

    if (this.tab === "inventory") {
      ctx.fillStyle = "#fff"
      ctx.font = "20px Arial"
      ctx.fillText("Envanter", 30, y)

      y += 40

      const items = s.inventory?.items || []

      for (const item of items) {
        ctx.fillStyle = "#1f2937"
        ctx.fillRect(20, y, W - 40, 80)

        ctx.fillStyle = "#fff"
        ctx.font = "bold 16px Arial"
        ctx.fillText(item.name, 40, y + 40)

        this.drawButton(ctx, W - 220, y + 20, 80, 40, "Kullan")
        this.drawButton(ctx, W - 120, y + 20, 80, 40, "Sat")

        y += 100
      }
    }

    if (this.tab === "loot") {
      ctx.fillStyle = "#fff"
      ctx.font = "20px Arial"
      ctx.fillText("Sandık & Çark", 30, y)

      y += 40

      this.drawButton(ctx, 30, y, 200, 60, "Ücretsiz Çark", "spin")
      this.drawButton(ctx, 250, y, 200, 60, "Premium Çark", "spin")

      y += 90

      this.drawButton(ctx, 30, y, 200, 60, "Mystery Crate", "buy")
      this.drawButton(ctx, 250, y, 200, 60, "Legendary Crate", "buy")
    }

    if (this.tab === "market") {
      ctx.fillStyle = "#fff"
      ctx.font = "20px Arial"
      ctx.fillText("Açık Pazar", 30, y)

      y += 40

      const shops = s.market?.shops || []

      for (const shop of shops) {
        ctx.fillStyle = "#1f2937"
        ctx.fillRect(20, y, W - 40, 80)

        ctx.fillStyle = "#fff"
        ctx.font = "bold 16px Arial"
        ctx.fillText(shop.name, 40, y + 40)

        this.drawButton(ctx, W - 150, y + 20, 120, 40, "Dükkana Gir")

        y += 100
      }
    }

    if (this.tab === "buy") {
      ctx.fillStyle = "#fff"
      ctx.font = "20px Arial"
      ctx.fillText("İşletme Satın Al", 30, y)

      y += 40

      this.drawButton(ctx, 30, y, 220, 70, "Nightclub 1000y")
      this.drawButton(ctx, 270, y, 220, 70, "Coffeeshop 850y")

      y += 90

      this.drawButton(ctx, 30, y, 220, 70, "Genel Ev 1200y")
      this.drawButton(ctx, 270, y, 220, 70, "Black Market 1500y")
    }
  }
}
