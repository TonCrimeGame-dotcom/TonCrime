import { ClanSystem } from "../clan/ClanSystem.js";

export class ClanScene {
  constructor({ store, input, assets, scenes }) {
    this.store = store;
    this.input = input;
    this.assets = assets;
    this.scenes = scenes;

    this.tab = "boss";

    this.reels = [
      ["punch","kick","slap","head"],
      ["punch","kick","slap","head"],
      ["punch","kick","slap","head"]
    ];

    this.spinResult = ["punch","kick","slap"];

    this.reelOffsets=[0,0,0];
    this.spinning=false;
    this.spinTimer=0;
  }

  onEnter(){}

  onExit(){}

  update(dt){

    if(this.spinning){

      this.spinTimer+=dt;

      for(let i=0;i<3;i++){
        this.reelOffsets[i]+=dt*0.02*(i+1);
      }

      if(this.spinTimer>2000){

        this.spinning=false;

        const res = ClanSystem.spinBoss(this.store);

        this.spinResult=res.icons;

      }

    }

  }

  startSpin(){

    if(this.spinning) return;

    this.spinTimer=0;
    this.spinning=true;

  }

  draw(ctx){

    const w=ctx.canvas.width;
    const h=ctx.canvas.height;

    ctx.fillStyle="#0a0a0a";
    ctx.fillRect(0,0,w,h);

    this.drawTabs(ctx,w);

    if(this.tab==="boss"){
      this.drawBoss(ctx,w,h);
    }

  }

  drawTabs(ctx,w){

    const tabs=["boss","members","bank","upgrades","log"];

    ctx.font="20px Arial";

    tabs.forEach((t,i)=>{

      const x=40+i*120;

      ctx.fillStyle=this.tab===t?"#ffffff":"#888";
      ctx.fillText(t.toUpperCase(),x,40);

    });

  }

  drawBoss(ctx,w,h){

    const state=this.store.get();

    const boss=ClanSystem.getBoss(state);

    const centerX=w/2;

    const reelSize=110;

    const startX=centerX-170;

    const y=160;

    ctx.font="22px Arial";

    ctx.fillStyle="#fff";
    ctx.fillText("CLAN BOSS SLOT",centerX-90,100);

    ctx.fillStyle="#333";
    ctx.fillRect(centerX-200,120,400,20);

    const hpPercent=boss.hp/boss.maxHp;

    ctx.fillStyle="#ff3b3b";
    ctx.fillRect(centerX-200,120,400*hpPercent,20);

    ctx.fillStyle="#fff";
    ctx.fillText("BOSS HP: "+boss.hp+" / "+boss.maxHp,centerX-90,150);

    for(let i=0;i<3;i++){

      ctx.fillStyle="#111";
      ctx.fillRect(startX+i*(reelSize+20),y,reelSize,reelSize);

      const icon=this.spinning
        ? this.reels[i][Math.floor((this.reelOffsets[i]*10)%4)]
        : this.spinResult[i];

      this.drawIcon(ctx,icon,startX+i*(reelSize+20)+30,y+30);

    }

    ctx.fillStyle=this.spinning?"#555":"#0f0";
    ctx.fillRect(centerX-80,320,160,50);

    ctx.fillStyle="#000";
    ctx.font="26px Arial";
    ctx.fillText("SPIN",centerX-30,355);

  }

  drawIcon(ctx,icon,x,y){

    ctx.fillStyle="#fff";
    ctx.font="40px Arial";

    if(icon==="punch") ctx.fillText("👊",x,y);
    if(icon==="kick") ctx.fillText("🦶",x,y);
    if(icon==="slap") ctx.fillText("✋",x,y);
    if(icon==="head") ctx.fillText("🤕

",x,y);

  }

  pointerDown(x,y){

    const w=window.innerWidth;

    const centerX=w/2;

    if(
      x>centerX-80 &&
      x<centerX+80 &&
      y>320 &&
      y<370
    ){
      this.startSpin();
    }

  }

}
