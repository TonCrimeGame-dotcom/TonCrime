import { ClanSystem } from "../clan/ClanSystem.js";

const SYMBOLS = ["punch","kick","slap","head"];

const ICONS = {
 punch:{emoji:"👊",color:"#f59e0b",dmg:12,label:"YUMRUK"},
 kick:{emoji:"🦵",color:"#22c55e",dmg:14,label:"TEKME"},
 slap:{emoji:"🖐️",color:"#60a5fa",dmg:8,label:"TOKAT"},
 head:{emoji:"🧠",color:"#ef4444",dmg:16,label:"KAFA"}
};

function clamp(v,min,max){return Math.max(min,Math.min(max,v));}

export class ClanScene{

constructor({store,input,assets,scenes}){

this.store=store;
this.input=input;
this.assets=assets;
this.scenes=scenes;

this.reels=[
{pos:0,speed:0,target:0,stopping:false},
{pos:0,speed:0,target:0,stopping:false},
{pos:0,speed:0,target:0,stopping:false}
];

this.spin=false;
this.spinStart=0;

this.buttons=[];
}

onEnter(){}

update(){

if(this.spin){

const now=performance.now();

for(let i=0;i<3;i++){

let r=this.reels[i];

r.pos+=r.speed;

if(r.stopping){

let diff=r.target-r.pos;

if(Math.abs(diff)<0.05){

r.pos=r.target;
r.speed=0;

}else{

r.speed*=0.92;

}

}

}

}

}

startSpin(){

if(this.spin)return;

this.spin=true;
this.spinStart=performance.now();

for(let r of this.reels){

r.speed=0.35;
r.stopping=false;

}

setTimeout(()=>this.stopReel(0),1200);
setTimeout(()=>this.stopReel(1),1500);
setTimeout(()=>this.stopReel(2),1800);

}

stopReel(i){

let reel=this.reels[i];

let result=SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)];

reel.target=SYMBOLS.indexOf(result);

reel.stopping=true;

if(i===2){

setTimeout(()=>this.finishSpin(),400);

}

}

finishSpin(){

this.spin=false;

let result=this.reels.map(r=>SYMBOLS[Math.round(r.pos)%4]);

let dmg=0;

for(let r of result){

dmg+=ICONS[r].dmg;

}

let boss=this.store.get().clanBoss;

if(boss){

boss.hp-=dmg;

if(boss.hp<0)boss.hp=0;

}

}

pointerDown(x,y){

for(let b of this.buttons){

if(x>b.x&&x<b.x+b.w&&y>b.y&&y<b.y+b.h){

b.cb();

}

}

}

draw(ctx){

const w=ctx.canvas.width;
const h=ctx.canvas.height;

this.buttons=[];

ctx.fillStyle="#080808";
ctx.fillRect(0,0,w,h);

let boss=this.store.get().clanBoss||{hp:1000,maxHp:1000};

ctx.fillStyle="#fff";
ctx.font="26px Arial";
ctx.fillText("CLAN BOSS",40,50);

let hpPct=boss.hp/boss.maxHp;

ctx.fillStyle="#333";
ctx.fillRect(40,70,400,20);

ctx.fillStyle="#ef4444";
ctx.fillRect(40,70,400*hpPct,20);

ctx.fillStyle="#fff";
ctx.font="14px Arial";
ctx.fillText(`${boss.hp} / ${boss.maxHp}`,200,85);

const reelW=120;
const reelH=160;

const baseX=w/2-200;
const baseY=140;

for(let i=0;i<3;i++){

let r=this.reels[i];

let x=baseX+i*140;
let y=baseY;

ctx.fillStyle="#111";
ctx.fillRect(x,y,reelW,reelH);

ctx.strokeStyle="#444";
ctx.strokeRect(x,y,reelW,reelH);

for(let j=-1;j<=1;j++){

let index=(Math.floor(r.pos)+j+4)%4;

let sym=ICONS[SYMBOLS[index]];

let iy=y+80+j*60;

ctx.fillStyle=sym.color;
ctx.fillRect(x+10,iy-30,reelW-20,50);

ctx.fillStyle="#fff";
ctx.font="30px Arial";
ctx.fillText(sym.emoji,x+50,iy);

}

}

ctx.strokeStyle="#ffd166";
ctx.lineWidth=4;
ctx.beginPath();
ctx.moveTo(baseX-20,baseY+80);
ctx.lineTo(baseX+420,baseY+80);
ctx.stroke();

let btn={x:w/2-100,y:340,w:200,h:60};

ctx.fillStyle=this.spin?"#555":"#fbbf24";
ctx.fillRect(btn.x,btn.y,btn.w,btn.h);

ctx.fillStyle="#000";
ctx.font="22px Arial";
ctx.fillText(this.spin?"DÖNÜYOR":"SPIN",btn.x+60,btn.y+38);

this.buttons.push({...btn,cb:()=>this.startSpin()});

}

}
