/* Binary-derived SkiFree simulation. See docs/reverse-engineering.md and original-*.js. */
(function(root){
  'use strict';
  const D=root.SkiOriginalData, W=root.SkiOriginalWorld, C=root.SkiOriginalCollision;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const s16=n=>(n<<16)>>16;
  class SkiGame{
    constructor(mode='free',seed=Date.now()>>>0,spriteMeta=root.SKI_SPRITES||{},viewport={width:640,height:480}){
      this.spriteMeta=spriteMeta;this.viewport=viewport;this.reset(mode,seed);
    }
    reset(mode='free',seed=Date.now()>>>0){
      this.seed=seed>>>0;this.randomState=this.seed;this.mode='free';this.objects=[];this.nextId=1;
      this.timeMs=0;this.time=0;this.tickCount=0;this.accumulator=0;this.tickMs=40;
      this.state='playing';this.boost=false;this.caught=false;this.score=0;this.events=[];this.highScore=null;
      this.distance=0;this.speed=0;this.lastInput={};this.player=this.actor(0,3,0,0,0);
      this.camera={x:0,y:0};
      root.SkiOriginalControls.initCourses(this);
      W.initWorld(this);
    }
    actor(type,value,x,y,z=0){
      const a={id:this.nextId++,type,x:s16(x),y:s16(y),z:s16(z),vx:0,vy:0,vz:0,removed:false};
      a.prevX=a.x;a.prevY=a.y;a.prevZ=a.z;
      if(type<11)this.setActorState(a,value??D.typeDefaultStates[type]);
      else{a.sprite=value;a.state=null;}
      return a;
    }
    addActor(type,value,x,y,z=0){const a=this.actor(type,value,x,y,z);this.objects.push(a);return a;}
    setActorState(a,state){a.state=state;a.sprite=D.stateSprites[state];return a;}
    setState(a,state){return this.setActorState(a,state);}
    randomInt(n){
      // The actual MSVC rand() at 0x406cda, then short modulo at 0x4020b0.
      this.randomState=(Math.imul(this.randomState,214013)+2531011)>>>0;
      const result=(this.randomState>>>16)&32767;
      return n>0?result%n:0;
    }
    random(){return this.randomInt(32768)/32768;}
    integrate(a){
      // 0x402be0: integrate first, then gravity. Fast mode doubles displacement only.
      const n=this.boost?2:1;
      a.x=s16(a.x+a.vx*n);a.y=s16(a.y+a.vy*n);
      const z=s16(a.z+a.vz*n);
      if(z>0){a.z=z;a.vz=s16(a.vz-1);}else{a.z=0;a.vz=0;}
      return a;
    }
    motion(a,row){
      // Exact signed-integer transcription of 0x403430, tables at 0x40a308.
      if(!row)return a;
      const [accY,maxY,accX,ratio,direction]=row;
      const sign=direction||Math.sign(a.vx);
      const horizontal=s16(sign*a.vx),target=s16(Math.trunc(ratio*Math.max(a.vy,0)/2));
      const vx=horizontal>target?Math.max(target,horizontal-2):Math.min(target,horizontal+accX);
      a.vx=s16(sign*vx);
      a.vy=s16(a.vy>maxY?Math.max(maxY,a.vy-2):Math.min(maxY,a.vy+accY));
      return a;
    }
    addScore(n){if(this.styleActive)this.score=(this.score+n)|0;}
    start(){if(this.state==='paused')this.state='playing';}
    pause(){if(this.state==='playing')this.state='paused';else if(this.state==='paused')this.state='playing';}
    jump(){root.SkiOriginalControls.applyKey(this,'Insert');}
    key(code){
      if(this.state==='paused'&&!['F2','F3','KeyF'].includes(code))return;
      root.SkiOriginalControls.applyKey(this,code);
    }
    showHighScores(course,value,isTime){
      this.highScore={course,value,isTime};this.events.push({kind:'high-scores',...this.highScore});
      this.state='scores';
    }
    dismissHighScores(){this.highScore=null;if(this.state==='scores')this.state='playing';}
    onYetiCatch(actor){this.caught=true;this.yeti=actor;}
    updatePlayer(){
      const p=this.player;if(p.removed)return;
      let state=p.state;
      if(state===11){
        // 0x4029d3: ground crash stays at its location while momentum drains.
        if(p.vx===0&&p.vy===0)state=12;
        p.vx-=Math.sign(p.vx);p.vy-=Math.sign(p.vy);
      }else{
        this.integrate(p);this.motion(p,D.motion[state]);
        if(state===7||state===9)state=3;
        else if(state===8||state===10)state=6;
        else if(state>=13&&state<=21&&p.z===0){
          state=D.landings[state-13];if(state===17)this.addScore(-64);
        }
      }
      this.setActorState(p,state);
      if(state>=7&&state<=21)this.addScore(D.airTickPoints[state-7]);
    }
    tick(){
      this.timeMs+=40;this.time=this.timeMs/1000;this.tickCount++;
      const all=[this.player,...this.objects];
      for(const a of all){a.prevX=a.x;a.prevY=a.y;a.prevZ=a.z;a.prevSprite=a.sprite;}
      this.updatePlayer();
      root.SkiOriginalControls.updateCourses(this);
      W.updateActors(this);
      const changed=a=>a.x!==a.prevX||a.y!==a.prevY||a.z!==a.prevZ||a.sprite!==a.prevSprite;
      const p=this.player;
      if(!p.removed){
        for(const a of this.objects){
          if(a.removed)continue;
          if(!changed(p)&&!changed(a))continue;
          if(C.overlaps(this,p,a)){
            C.playerCollision(this,a,true);
            if(!p.removed&&!a.removed)C.collide(this,a,p,true);
          }
          if(p.removed)break;
        }
      }
      // Reciprocal moving-NPC contacts use the same original collision dispatch.
      const v=this.viewport;
      const near=this.objects.filter(a=>!a.removed&&Math.abs(s16(a.x-p.x))<v.width/2+120&&Math.abs(s16(a.y-p.y))<v.height+120);
      for(let i=0;i<near.length;i++){
        const a=near[i];if(a.removed)continue;
        for(let j=i+1;j<near.length;j++){
          const b=near[j];if(b.removed||(a.type>=11&&b.type>=11))continue;
          if(!changed(a)&&!changed(b))continue;
          if(C.overlaps(this,a,b)){C.collide(this,a,b,true);if(!a.removed&&!b.removed)C.collide(this,b,a,true);}
        }
      }
      if(!p.removed){this.camera.x=p.x;this.camera.y=p.y;}
      W.generateTerrain(this);
      this.objects=this.objects.filter(a=>!a.removed);
      this.distance=Math.trunc(p.y/16);
      this.speed=Math.trunc(p.vy*1000/(16*40));
    }
    step(dt,input){
      if(this.state!=='playing')return;
      // Compatibility for deterministic fixtures; UI dispatches actual key events.
      if(input){
        if(input.down&&!this.lastInput.down)this.key('ArrowDown');
        if(input.brake&&!this.lastInput.brake)this.key('ArrowUp');
        if(input.jump&&!this.lastInput.jump)this.jump();
        if(input.steer&&input.steer!==this.lastInput.steer)this.key(input.steer<0?'ArrowLeft':'ArrowRight');
        this.lastInput={...input};
      }
      this.accumulator+=Math.max(0,Math.min(dt,.25));
      while(this.accumulator+1e-10>=.04&&this.state==='playing'){
        this.accumulator-=.04;this.tick();
      }
    }
  }
  root.SkiEngine={SkiGame,clamp,s16};
})(globalThis);
