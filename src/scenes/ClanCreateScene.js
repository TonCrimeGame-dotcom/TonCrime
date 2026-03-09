import { ClanSystem } from "../clan/ClanSystem.js";

export class ClanCreateScene {

constructor({store,input,assets,scenes,i18n}){

this.store=store
this.input=input
this.assets=assets
this.scenes=scenes
this.i18n=i18n
this.root=null

}

onEnter(){

this.root=document.createElement("div")

Object.assign(this.root.style,{
position:"fixed",
left:"0",
top:"0",
width:"100%",
height:"100%",
background:"#0b0b0f",
zIndex:"90",
color:"#fff",
fontFamily:"system-ui"
})

this.root.innerHTML=`

<div style="max-width:500px;margin:auto;padding:40px">

<h2>Create Clan</h2>

<input id="clanName" placeholder="Clan Name" style="width:100%;margin-bottom:10px">

<input id="clanTag" placeholder="TAG (3 letters)" style="width:100%;margin-bottom:20px">

<button id="createClan">Create Clan</button>

<br><br>

<button id="backHome">Back</button>

</div>

`

document.body.appendChild(this.root)

document.getElementById("createClan").onclick=()=>{

const name=document.getElementById("clanName").value
const tag=document.getElementById("clanTag").value

if(!name || !tag)return

ClanSystem.createClan(this.store,name,tag)

this.scenes.go("clan")

}

document.getElementById("backHome").onclick=()=>{

this.scenes.go("home")

}

}

onExit(){

if(this.root){

this.root.remove()
this.root=null

}

}

}
