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

Object.assign(this.root.style,{
position:"fixed",
left:"0",
top:"0",
width:"100%",
height:"100%",
zIndex:"70",
background:"#0b0b0f",
color:"#fff",
fontFamily:"system-ui",
overflowY:"auto"
})

document.body.appendChild(this.root)

this.render()

}

render(){

const s=this.store.get()
const clan=s.clan

this.root.innerHTML=`

<style>

.clanPanel{
background:#14141a;
border-radius:14px;
padding:16px;
border:1px solid rgba(255,255,255,.06);
margin-bottom:14px;
}

.clanBtn{
background:#1c1c22;
border:1px solid rgba(255,255,255,.08);
padding:10px 14px;
border-radius:10px;
color:white;
cursor:pointer;
}

.clanBtn:hover{
transform:scale(1.03)
}

.clanTabBar{
display:flex;
gap:8px;
flex-wrap:wrap;
margin-bottom:20px
}

.memberRow{
display:flex;
justify-content:space-between;
background:#1a1a20;
padding:10px;
border-radius:10px;
margin-bottom:6px
}

.chatBox{
height:220px;
overflow:auto;
background:#14141a;
padding:10px;
border-radius:10px;
margin-bottom:10px
}

</style>

<div style="max-width:900px;margin:auto;padding:24px">

<div class="clanPanel">

<h2 style="margin:0">${clan.name}</h2>

<div style="opacity:.7;font-size:13px">

TAG ${clan.tag} • LEVEL ${clan.level}

</div>

<div style="margin-top:10px">

Members ${clan.members.length}/${clan.maxMembers}  
Bank ${clan.bank} TON  
XP ${clan.xp}

</div>

</div>

<div class="clanTabBar">

<button class="clanBtn" id="tab_overview">GENEL</button>
<button class="clanBtn" id="tab_members">ÜYELER</button>
<button class="clanBtn" id="tab_donate">BAĞIŞ</button>
<button class="clanBtn" id="tab_upgrade">YÜKSELTME</button>
<button class="clanBtn" id="tab_chat">CHAT</button>
<button class="clanBtn" id="tab_war">SAVAŞ</button>

</div>

<div id="clanContent"></div>

<div style="margin-top:20px">

<button class="clanBtn" id="clanBack">← Geri</button>

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
document.getElementById("tab_war").onclick=()=>{this.tab="war";this.draw()}

this.draw()

}

draw(){

const s=this.store.get()
const clan=s.clan
const el=document.getElementById("clanContent")

if(this.tab==="overview"){

el.innerHTML=`

<div class="clanPanel">

<h3>Clan Log</h3>

<div id="clanLog"></div>

</div>

`

const log=document.getElementById("clanLog")

clan.log.slice(-12).reverse().forEach(l=>{

const row=document.createElement("div")
row.style.fontSize="13px"
row.style.opacity=".7"
row.textContent=l

log.appendChild(row)

})

}

if(this.tab==="members"){

el.innerHTML=`<div id="memberList"></div>`

const list=document.getElementById("memberList")

clan.members.forEach(m=>{

const row=document.createElement("div")
row.className="memberRow"

row.innerHTML=`

<div>

<b>${m.name}</b>

<div style="font-size:12px;opacity:.6">

${m.role}

</div>

</div>

<div>

Lv ${m.level}

</div>

`

list.appendChild(row)

})

}

if(this.tab==="donate"){

el.innerHTML=`

<div class="clanPanel">

<h3>Bağış Yap</h3>

<button class="clanBtn" id="d10">+10 TON</button>
<button class="clanBtn" id="d50">+50 TON</button>
<button class="clanBtn" id="d100">+100 TON</button>

</div>

`

document.getElementById("d10").onclick=()=>{

ClanSystem.donate(this.store,10)
this.refresh()

}

document.getElementById("d50").onclick=()=>{

ClanSystem.donate(this.store,50)
this.refresh()

}

document.getElementById("d100").onclick=()=>{

ClanSystem.donate(this.store,100)
this.refresh()

}

}

if(this.tab==="upgrade"){

el.innerHTML=`

<div class="clanPanel">

<h3>Clan Upgrade</h3>

<button class="clanBtn" id="upMembers">Üye Limiti +5</button>

<button class="clanBtn" id="upBank">Kasa Bonus</button>

</div>

`

document.getElementById("upMembers").onclick=()=>{

ClanSystem.upgradeMembers(this.store)
this.refresh()

}

document.getElementById("upBank").onclick=()=>{

ClanSystem.upgradeBank(this.store)
this.refresh()

}

}

if(this.tab==="chat"){

const chat=clan.chat||[]

el.innerHTML=`

<div class="chatBox" id="chatBox"></div>

<input id="chatInput" placeholder="mesaj yaz..." style="width:70%">

<button class="clanBtn" id="sendMsg">Gönder</button>

`

const box=document.getElementById("chatBox")

chat.forEach(m=>{

const row=document.createElement("div")
row.textContent=m.name+" : "+m.msg

box.appendChild(row)

})

document.getElementById("sendMsg").onclick=()=>{

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

if(this.tab==="war"){

el.innerHTML=`

<div class="clanPanel">

<h3>Clan War</h3>

Enemy Clan: Shadow Syndicate

Power: 240000

<br><br>

<button class="clanBtn" id="startWar">Savaşı Başlat</button>

</div>

`

document.getElementById("startWar").onclick=()=>{

const clan=this.store.get().clan

clan.log.push("Clan savaşı başlatıldı")

this.store.set({clan})

this.refresh()

}

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
