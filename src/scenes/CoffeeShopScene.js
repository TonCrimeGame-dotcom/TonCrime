// src/scenes/CoffeeShopScene.js

const ITEMS = [
  { id: "amnesia_haze", name: "Amnesia Haze", price: 10, energy: 3 },
  { id: "white_widow", name: "White Widow", price: 12, energy: 4 },
  { id: "northern_lights", name: "Northern Lights", price: 14, energy: 5 },
  { id: "super_skunk", name: "Super Skunk", price: 16, energy: 6 },
  { id: "purple_haze", name: "Purple Haze", price: 18, energy: 7 },
  { id: "orange_bud", name: "Orange Bud", price: 20, energy: 8 },
  { id: "blue_dream", name: "Blue Dream", price: 22, energy: 9 },
  { id: "gelato", name: "Gelato", price: 24, energy: 10 },
  { id: "gorilla_glue", name: "Gorilla Glue", price: 26, energy: 11 },
  { id: "green_crack", name: "Green Crack", price: 28, energy: 12 },

  { id: "ak47", name: "AK-47", price: 30, energy: 13 },
  { id: "super_silver", name: "Super Silver Haze", price: 32, energy: 14 },
  { id: "jack_herer", name: "Jack Herer", price: 34, energy: 15 },
  { id: "og_kush", name: "OG Kush", price: 36, energy: 16 },
  { id: "girl_scout", name: "Girl Scout Cookies", price: 38, energy: 17 },
  { id: "sour_diesel", name: "Sour Diesel", price: 40, energy: 18 },
  { id: "zkittlez", name: "Zkittlez", price: 42, energy: 19 },
  { id: "wedding_cake", name: "Wedding Cake", price: 44, energy: 20 },
  { id: "banana_kush", name: "Banana Kush", price: 46, energy: 21 },
  { id: "mimosa", name: "Mimosa", price: 48, energy: 22 },

  { id: "choco_haze", name: "Choco Haze", price: 50, energy: 23 },
  { id: "rainbow_belts", name: "Rainbow Belts", price: 53, energy: 24 },
  { id: "moon_rocks", name: "Moon Rocks", price: 56, energy: 25 },
  { id: "ice_hash", name: "Ice Hash", price: 59, energy: 26 },
  { id: "amsterdam_gold", name: "Amsterdam Gold", price: 62, energy: 27 },
  { id: "black_tuna", name: "Black Tuna", price: 65, energy: 28 },
  { id: "platinum_kush", name: "Platinum Kush", price: 68, energy: 29 },
  { id: "ghost_train", name: "Ghost Train Haze", price: 71, energy: 30 },
  { id: "diamond_resin", name: "Diamond Resin", price: 75, energy: 32 },
  { id: "dam_crown", name: "Dam Crown", price: 80, energy: 35 },
];

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export class CoffeeShopScene {

constructor({ store, input, i18n, assets, scenes }) {

this.store = store
this.input = input
this.assets = assets
this.scenes = scenes

this.scrollY = 0
this.maxScroll = 0

this.dragging = false
this.downY = 0
this.startScroll = 0
this.moved = 0
this.clickCandidate = false

this.hit = []
this.backHit = null

this.toastText = ""
this.toastUntil = 0

this.music = null

}

onEnter(){

const s = this.store.get()
const p = s.player || {}

if(!p.coffeeUses){

this.store.set({

player:{
...p,
coffeeUses:0
}

})

}

this.startMusic()

}

onExit(){

if(this.music){

this.music.pause()

}

}

startMusic(){

if(this.music) return

this.music = new Audio("./src/assets/reggae.mp3")
this.music.loop = true
this.music.volume = 0.35
this.music.play().catch(()=>{})

}

_showToast(text, ms = 1500){

this.toastText = text
this.toastUntil = Date.now()+ms

}

_buy(item){

const s = this.store.get()

const coins = Number(s.coins||0)

const p = s.player||{}

let energy = Number(p.energy||0)

const energyMax = Number(p.energyMax||100)

let uses = Number(p.coffeeUses||0)

if(coins < item.price){

this._showToast("Yetersiz coin")

return

}

if(energy >= energyMax){

this._showToast("Enerji full")

return

}

uses++

let energyGain = item.energy

// bağışıklık sistemi
if(uses >= 10){

energyGain = Math.floor(energyGain * 0.7)

}

const add = Math.min(energyGain, energyMax-energy)

energy += add

let newCoins = coins-item.price

// %30 dayak ihtimali
if(Math.random() < 0.30){

const stolenCoin = Math.floor(newCoins*0.20)

const stolenEnergy = Math.floor(energy*0.20)

newCoins -= stolenCoin

energy -= stolenEnergy

this._showToast("Sokakta dayak yedin! Paran ve enerjin çalındı")

}else{

this._showToast(`+${add} enerji`)

}

this.store.set({

coins:newCoins,

player:{

...p,

energy,

coffeeUses:uses

}

})

}

}
