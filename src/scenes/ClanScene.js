import { ClanSystem } from "../clan/ClanSystem.js";

export class ClanScene {

constructor({store,input,assets,scenes,i18n}){

this.store=store
this.input=input
this.assets=assets
this.scenes=scenes
this.i18n=i18n

this.root=null
this.tab="overview"

}

onEnter(){

const s=this.store.get()
const clan=s.clan

this.root=document.createElement("div")
this.root.id="clanScene"

this.root.style.position="fixed"
this.root.style.left="0"
this.root.style.top="0"
this.root.style.width="100%"
this.root.style.height="100%"
this.root.style.zIndex="60"
this.root.style.color="white"
this.root.style.background="rgba(10,10,15,.92)"
this.root.style.backdropFilter="blur(10px)"
this.root.style.overflowY="auto"
this.root.style.fontFamily="system-ui"

document.body.appendChild(this.root)

this.render()

}

render(){

const s=this.store.get()
const clan=s.clan

this.root.innerHTML=`

<div style="max-width:900px;margin:auto;padding:24px">

<h1 style="margin-bottom:10px">${clan.name}</h1>

<div style="opacity:.7;margin-bottom:20px">

Tag ${clan.tag} • Seviye ${clan.level} • Üye ${clan.members.length}/${clan.maxMembers}

</div>

<div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap">

<button id="tab_overview">Genel</button>
<button id="tab_members">Üyeler</button>
<button id="tab_donate">Bağış</button>
<button id="tab_upgrade">Yükseltme</button>
<button id="tab_chat">Chat</button>
<button id="tab_missions">Görevler</button>

</div>

<div id="clanContent"></div>

<div style="margin-top:30px">

<button id="clanBack">← Geri</button>

</div>

</div>
`

document.getElementById("clanBack").onclick=()=>{

this.scenes.go("home")

}

document.getElementById("tab_overview").onclick=()=>{this.tab="overview";this.draw()}
document.getElementById("tab_members").onclick=()=>{this.tab="members";this.draw()}
document.getElementById("tab_donate").onclick=()=>{this.tab="donate";this.draw()}
document.getElementById("tab_upgrade").onclick=()=>{this.tab="upgrade";this.draw()}
document.getElementById("tab_chat").onclick=()=>{this.tab="chat";this.draw()}
document.getElementById("tab_missions").onclick=()=>{this.tab="missions";this.draw()}

this.draw()

}

draw(){

const s=this.store.get()
const clan=s.clan
const el=document.getElementById("clanContent")

if(this.tab==="overview"){

el.innerHTML=`

<div style="background:#14141a;padding:16px;border-radius:12px">

<div>Kasa: ${clan.bank} TON</div>
<div>Clan XP: ${clan.xp}</div>

</div>

<h3 style="margin-top:20px">Log</h3>

<div id="clanLog"></div>

`

const log=document.getElementById("clanLog")

clan.log.slice(-10).reverse().forEach(l=>{

const row=document.createElement("div")
row.textContent=l
row.style.opacity=".7"
row.style.fontSize="13px"
row.style.marginBottom="4px"

log.appendChild(row)

})

}

if(this.tab==="members"){

el.innerHTML=`<h3>Üyeler</h3><div id="members"></div>`

const list=document.getElementById("members")

clan.members.forEach(m=>{

const row=document.createElement("div")

row.style.display="flex"
row.style.justifyContent="space-between"
row.style.background="#14141a"
row.style.padding="10px"
row.style.marginBottom="6px"
row.style.borderRadius="8px"

row.innerHTML=`

<div>

<b>${m.name}</b>
<div style="font-size:12px;opacity:.6">${m.role}</div>

</div>

<div>Lv.${m.level}</div>

`

list.appendChild(row)

})

}

if(this.tab==="donate"){

el.innerHTML=`

<h3>Bağış</h3>

<button id="d10">+10 TON</button>
<button id="d100">+100 TON</button>

`

document.getElementById("d10").onclick=()=>{

ClanSystem.donate(this.store,10)
this.refresh()

}

document.getElementById("d100").onclick=()=>{

ClanSystem.donate(this.store,100)
this.refresh()

}

}

if(this.tab==="upgrade"){

el.innerHTML=`

<h3>Clan Yükseltme</h3>

<button id="up_members">Üye Limiti +5</button>
<button id="up_bank">Kasa Bonus</button>

`

document.getElementById("up_members").onclick=()=>{

ClanSystem.upgradeMembers(this.store)
this.refresh()

}

document.getElementById("up_bank").onclick=()=>{

ClanSystem.upgradeBank(this.store)
this.refresh()

}

}

if(this.tab==="chat"){

const chat=clan.chat||[]

el.innerHTML=`

<div id="chatBox" style="background:#14141a;padding:12px;border-radius:10px;height:200px;overflow:auto"></div>

<input id="chatInput" placeholder="Mesaj yaz"/>

<button id="chatSend">Gönder</button>

`

const box=document.getElementById("chatBox")

chat.forEach(m=>{

const row=document.createElement("div")
row.textContent=`${m.name}: ${m.msg}`

box.appendChild(row)

})

document.getElementById("chatSend").onclick=()=>{

const txt=document.getElementById("chatInput").value

if(!txt)return

const s=this.store.get()
const clan=s.clan

clan.chat=clan.chat||[]

clan.chat.push({

name:s.player.username,
msg:txt

})

this.store.set({clan})

this.refresh()

}

}

if(this.tab==="missions"){

el.innerHTML=`

<h3>Clan Görevleri</h3>

<div>Toplam PvP: ${clan.pvp || 0}/50</div>
<div>Bağış: ${clan.donation || 0}/500</div>

`

}

}

refresh(){

this.render()

}

onExit(){

if(this.root){

this.root.remove()
this.root=null

}

}

}
