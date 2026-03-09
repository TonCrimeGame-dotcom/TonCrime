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

Object.assign(this.root.style,{
position:"fixed",
left:"0",
top:"0",
width:"100%",
height:"100%",
zIndex:"80",
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

.clanWrap{
max-width:950px;
margin:auto;
padding:24px;
}

.clanCard{
background:#14141a;
border-radius:14px;
padding:16px;
margin-bottom:14px;
border:1px solid rgba(255,255,255,.05);
}

.clanBtn{
background:#1c1c22;
border:1px solid rgba(255,255,255,.08);
padding:10px 14px;
border-radius:10px;
color:white;
cursor:pointer;
margin-right:6px;
}

.clanBtn:hover{
transform:scale(1.05)
}

.clanTabs{
display:flex;
gap:6px;
flex-wrap:wrap;
margin-bottom:20px
}

.memberRow{
display:flex;
justify-content:space-between;
padding:10px;
background:#1a1a20;
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

.marketItem{
display:flex;
justify-content:space-between;
background:#1a1a20;
padding:10px;
border-radius:10px;
margin-bottom:6px
}

</style>

<div class="clanWrap">

<div class="clanCard">

<h2>${clan.name}</h2>

<div style="opacity:.7">

TAG ${clan.tag}  
LEVEL ${clan.level}  

</div>

<div style="margin-top:10px">

Members ${clan.members.length}/${clan.maxMembers}  
Bank ${clan.bank} TON  
XP ${clan.xp}

</div>

<div style="margin-top:6px">

Invite Code: ${clan.inviteCode}

</div>

</div>

<div class="clanTabs">

<button class="clanBtn" id="t_over">GENEL</button>
<button class="clanBtn" id="t_members">ÜYELER</button>
<button class="clanBtn" id="t_donate">BAĞIŞ</button>
<button class="clanBtn" id="t_upgrade">UPGRADE</button>
<button class="clanBtn" id="t_chat">CHAT</button>
<button class="clanBtn" id="t_market">MARKET</button>
<button class="clanBtn" id="t_boss">BOSS</button>
<button class="clanBtn" id="t_rank">RANK</button>

</div>

<div id="clanContent"></div>

<div style="margin-top:20px">

<button class="clanBtn" id="backHome">← HOME</button>

</div>

</div>
`

document.getElementById("backHome").onclick=()=>{

this.scenes.go("home")

}

document.getElementById("t_over").onclick=()=>{this.tab="overview";this.draw()}
document.getElementById("t_members").onclick=()=>{this.tab="members";this.draw()}
document.getElementById("t_donate").onclick=()=>{this.tab="donate";this.draw()}
document.getElementById("t_upgrade").onclick=()=>{this.tab="upgrade";this.draw()}
document.getElementById("t_chat").onclick=()=>{this.tab="chat";this.draw()}
document.getElementById("t_market").onclick=()=>{this.tab="market";this.draw()}
document.getElementById("t_boss").onclick=()=>{this.tab="boss";this.draw()}
document.getElementById("t_rank").onclick=()=>{this.tab="rank";this.draw()}

this.draw()

}

draw(){

const s=this.store.get()
const clan=s.clan
const el=document.getElementById("clanContent")

if(this.tab==="overview"){

el.innerHTML=`<div class="clanCard"><h3>Clan Log</h3><div id="clanLog"></div></div>`

const log=document.getElementById("clanLog")

clan.log.slice(-12).reverse().forEach(l=>{

const row=document.createElement("div")
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
<div style="font-size:12px;opacity:.6">${m.role}</div>

</div>

<div>LV ${m.level}</div>

`

list.appendChild(row)

})

}

if(this.tab==="donate"){

el.innerHTML=`

<div class="clanCard">

<h3>Donate</h3>

<button class="clanBtn" id="d10">+10 TON</button>
<button class="clanBtn" id="d50">+50 TON</button>
<button class="clanBtn" id="d100">+100 TON</button>

</div>

`

document.getElementById("d10").onclick=()=>{ClanSystem.donate(this.store,10);this.refresh()}
document.getElementById("d50").onclick=()=>{ClanSystem.donate(this.store,50);this.refresh()}
document.getElementById("d100").onclick=()=>{ClanSystem.donate(this.store,100);this.refresh()}

}

if(this.tab==="upgrade"){

el.innerHTML=`

<div class="clanCard">

<h3>Upgrades</h3>

<button class="clanBtn" id="up1">Member Limit +5</button>
<button class="clanBtn" id="up2">PvP Bonus</button>

</div>

`

document.getElementById("up1").onclick=()=>{ClanSystem.upgradeMembers(this.store);this.refresh()}
document.getElementById("up2").onclick=()=>{ClanSystem.upgradePvP(this.store);this.refresh()}

}

if(this.tab==="chat"){

const chat=clan.chat||[]

el.innerHTML=`

<div class="chatBox" id="chatBox"></div>

<input id="chatInput" placeholder="mesaj..." style="width:70%">
<button class="clanBtn" id="sendMsg">SEND</button>

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

ClanSystem.sendChat(this.store,txt)

this.refresh()

}

}

if(this.tab==="market"){

const market=clan.market||[]

el.innerHTML=`<div id="marketList"></div>`

const list=document.getElementById("marketList")

market.forEach((it,i)=>{

const row=document.createElement("div")
row.className="marketItem"

row.innerHTML=`

<div>${it.name}</div>
<div>${it.price} TON</div>
<button class="clanBtn" id="buy${i}">BUY</button>

`

list.appendChild(row)

document.getElementById("buy"+i).onclick=()=>{

ClanSystem.buyMarketItem(this.store,i)
this.refresh()

}

})

}

if(this.tab==="boss"){

const boss=clan.boss

el.innerHTML=`

<div class="clanCard">

<h3>Clan Boss</h3>

HP ${boss.hp} / ${boss.maxHp}

<br><br>

<button class="clanBtn" id="attackBoss">ATTACK</button>

</div>

`

document.getElementById("attackBoss").onclick=()=>{

ClanSystem.attackBoss(this.store,1000)

this.refresh()

}

}

if(this.tab==="rank"){

const power=ClanSystem.calcPower(clan)

el.innerHTML=`

<div class="clanCard">

<h3>Clan Power</h3>

${power}

</div>

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
