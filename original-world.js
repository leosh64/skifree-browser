/* Recovered from ski32.exe: 4025c0..402850, 403540..4039f2,
 * 404290..4046c2 and 404b50..4050f7. See docs/reverse-engineering.md. */
(function(root){
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const s16=n=>(n<<16)>>16;
  const stateSprites=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,83,84,85,84,49,87,88,89];
  const defaults=[6,22,27,31,39,42,42,42,42,56,60];
  const skierMotion=[[1,1,0,0,0,0,22],[1,1,1,4,-1,0,23],[1,1,1,4,1,0,24],[0,0,0,0,0,0,25],[0,0,0,0,0,0,26]];
  const boardMotion=[[2,18,2,1,-1,0,31],[2,18,2,1,1,0,32],[1,22,0,0,0,0,33],[1,4,0,0,0,0,34],[1,4,0,0,0,0,35],[1,4,0,0,0,0,36],[1,4,0,0,0,0,37],[1,4,0,0,0,0,38]];
  function meta(g,id){return g.spriteMeta?.[id]||root.SKI_SPRITES?.[id]||{width:16,height:16};}
  function viewport(g){const v=g.viewport||{};return {width:v.width||640,height:v.height||480};}
  function visible(g,a,pad=120){
    const v=viewport(g),p=g.player,dy=s16(a.y-p.y);
    return Math.abs(s16(a.x-p.x))<v.width/2+pad&&dy>-v.height/3-pad&&dy<v.height*2/3+pad;
  }
  function initWorld(g){
    // Original lift towers are static bitmap64 at x=-128 every2048 units.
    for(let y=-1024;y<=23552;y+=2048){
      const tower=g.addActor(13,64,-128,y,0);tower.fixed=true;tower.liftTower=true;
      if(y>-1024){const chair=g.addActor(4,39,-112,y,32);Object.assign(chair,{fixed:true,lift:true,vy:-2});}
      if(y<23552){const chair=g.addActor(4,41,-144,y,32);Object.assign(chair,{fixed:true,lift:true,vy:2});}
    }
    for(const [type,x,y] of [[7,-16060,0],[8,16060,0],[5,0,-2060],[6,0,32060]]){
      const a=g.addActor(type,42,x,y,0);a.fixed=true;a.sentry=true;
    }
    g._terrainTravel={x:g.player.x,y:g.player.y,dx:0,dy:0};
  }
  function fixedIntegrate(a){
    a.prevX=a.x;a.prevY=a.y;a.prevZ=a.z;
    a.x=s16(a.x+(a.vx||0));a.y=s16(a.y+(a.vy||0));a.z=s16((a.z||0)+(a.vz||0));
  }
  function stepLift(g,a){
    fixedIntegrate(a);
    if(a.y<=-1024){a.x=-144;a.vy=2;g.setActorState(a,41);}
    else if(a.y>=23552){a.x=-112;a.vy=-2;g.setActorState(a,39);}
    else if(a.state===39&&visible(g,a)&&g.randomInt(1000)===0){
      const rider=g.addActor(3,33,a.x,a.y,a.z);rider.generated=true;g.setActorState(a,40);
    }
  }
  function stepSentry(g,a){
    fixedIntegrate(a);
    if(a.z>0)a.vz--;else{a.z=0;a.vz=0;}
    if(a.z!==0)return;
    const time=g.timeMs??g.tickCount*40;
    if(a.state>=50&&a.state<=55){
      const elapsed=time-(a.eatingSince??0);
      const next=a.state===50?51:a.state===51?(elapsed>=500?52:50):a.state===52?(elapsed>700?53:52):a.state===53?(elapsed>1000?54:53):a.state===54?55:elapsed>=3000?42:54;
      g.setActorState(a,next);return;
    }
    let vx=0,vy=0,follow=false;
    const p=g.player;
    if(a.type===5){if(a.y>-2000)vy=-10;else follow=p.y<-2000;}
    if(a.type===6){if(a.y<32000)vy=26;else follow=p.y>32000;}
    if(a.type===7){if(a.x>-16000)vx=-16;else follow=p.x<-16000;}
    if(a.type===8){if(a.x<16000)vx=16;else follow=p.x>16000;}
    if(follow&&!p.removed){
      const v=viewport(g),dx=p.x-a.x,dy=p.y-a.y;
      // Offscreen sentries are brought to the opposite viewport edge to pursue.
      if(dx>v.width)a.x=s16(p.x-v.width);else if(dx<-v.width)a.x=s16(p.x+v.width);
      if(dy>v.height)a.y=s16(p.y-v.height);else if(dy<-v.height)a.y=s16(p.y+v.height);
      vx=clamp(dx,-16,16);vy=clamp(dy,-10,26);
      if(vx||vy)a.vz=1;
    }
    a.vx=vx;a.vy=vy;
    let state;
    if(vy<0)state=a.state===48?49:48;
    else if(vx<0)state=a.state===44?45:44;
    else if(vx===0&&vy===0){state=g.randomInt(10)===0?43:42;if(state===43)a.vz=4;}
    else state=a.state===46?47:46;
    g.setActorState(a,state);
  }
  function updateActors(g){
    for(const a of [...g.objects]){
      if(a.removed)continue;
      if(a.type===4){stepLift(g,a);continue;}
      if(a.type>=5&&a.type<=8){stepSentry(g,a);continue;}
      if(a.fixed||a.type>=11)continue;
      if(!visible(g,a,240)){a.removed=true;continue;}
      if(a.type===1){
        if(a.state>=25)continue;
        g.integrate(a);g.motion(a,skierMotion[a.state-22]);
        if(g.randomInt(12)===0)g.setActorState(a,22+g.randomInt(3));
      }else if(a.type===2){
        let next=a.state;
        if(a.state===27){a.vy=g.randomInt(3)-1;next=28;}
        else if(a.state===28){a.vx=4;next=27;}
        else if(a.state===29){a.vx=0;a.vy=0;next=g.randomInt(32)===0?27:30;}
        else if(a.state===30){
          if(g.randomInt(100)===0){const dropping=g.addActor(17,82,a.x-4,a.y-2,a.z);dropping.generated=true;next=27;}else next=29;
        }
        g.integrate(a);g.setActorState(a,next);
      }else if(a.type===3){
        g.integrate(a);g.motion(a,boardMotion[a.state-31]);
        let next=a.state;
        if(a.state===31&&g.randomInt(10)===0)next=32;
        else if(a.state===32&&g.randomInt(10)===0)next=31;
        else if(a.state===33&&a.z===0)next=32;
        else if(a.state>=34)next=a.state===38?32:a.state+1;
        g.setActorState(a,next);
      }else if(a.type===9){g.setActorState(a,a.state===59?56:a.state+1);}
      else if(a.type===10){
        let next=a.state;
        if(a.state===60&&g.randomInt(100)===0){a.vx=g.randomInt(2)*2-1;next=61;}
        else if(a.state===61){if(g.randomInt(10)===0){a.vx=0;next=60;}else next=a.vx>=0?63:62;}
        else if(a.state===62||a.state===63)next=61;
        g.integrate(a);g.setActorState(a,next);
      }
    }
  }
  function terrainSprite(type,random){
    if(type===11)return 27;
    if(type===13){const r=random(8);return r===0?50:r===1?51:49;}
    if(type===14)return random(4)===0?46:45;
    if(type===15)return random(3)===0?48:47;
    if(type===16)return 52;
    return null;
  }
  function terrainType(x,y,random){
    let density=32,type;
    if(x>=-576&&x<=-320&&y>=640&&y<=8640){density=64;type=11;}
    else if(x>=320&&x<=512&&y>=640&&y<=16640){density=16;type=random(64)===0?2:13;}
    else if(x>=-160&&x<=160&&y>=640&&y<=16640){
      const r=random(100);type=r<2?10:r<20?13:r<50?15:r<60?11:r<80?14:16;
    }else{
      const r=random(1000);type=r<50?10:r<500?13:r<700?15:r<750?11:r<950?14:r<970?16:r<990?1:2;
    }
    return {type,density};
  }
  function terrainDensity(x,y){
    if(x>=-576&&x<=-320&&y>=640&&y<=8640)return 64;
    if(x>=320&&x<=512&&y>=640&&y<=16640)return 16;
    return 32;
  }
  function generateTerrain(g){
    const v=viewport(g),p=g.player,t=g._terrainTravel;
    if(!t)return;
    t.dx+=s16(p.x-t.x);t.dy+=s16(p.y-t.y);t.x=p.x;t.y=p.y;
    function spawn(edge){
      const left=p.x-v.width/2,right=p.x+v.width/2,top=p.y-v.height/3,bottom=p.y+v.height*2/3;
      const x=edge===0?left-60:edge===1?right+60:left+g.randomInt(Math.max(1,Math.floor(v.width)));
      const y=edge===2?top-60:edge===3?bottom+60:top+g.randomInt(Math.max(1,Math.floor(v.height)));
      const density=terrainDensity(s16(x),s16(y));
      const area=g.objects.reduce((sum,a)=>{if(a.removed||!visible(g,a))return sum;const m=meta(g,a.sprite);return sum+m.width*m.height;},0);
      if(area>(v.width+240)*(v.height+240)/density)return;
      const selection=terrainType(s16(x),s16(y),n=>g.randomInt(n));
      const type=selection.type;
      const value=type<11?defaults[type]:terrainSprite(type,n=>g.randomInt(n));
      const a=g.addActor(type,value,s16(x),s16(y),0);a.generated=true;
    }
    while(t.dy>60){spawn(3);t.dy-=60;}while(t.dy<-60){spawn(2);t.dy+=60;}
    while(t.dx>60){spawn(1);t.dx-=60;}while(t.dx<-60){spawn(0);t.dx+=60;}
    // Native per-tick random snowboarder entry: 1/666, from right edge.
    if(g.randomInt(666)===0){
      const a=g.addActor(3,31,s16(p.x+v.width/2+60),s16(p.y-v.height/3+g.randomInt(Math.max(1,Math.floor(v.height)))),0);a.generated=true;
    }
    for(const a of g.objects)if(a.generated&&!visible(g,a,240))a.removed=true;
  }
  root.SkiOriginalWorld={initWorld,updateActors,generateTerrain,stateSprites,defaults,skierMotion,boardMotion,terrainType,terrainSprite};
})(globalThis);
