/* Static transcription of ski32.exe 0x403a00..0x404070.
 * Broad phase: 0x401290 / 0x4014b0. No radius approximations.
 * REA Evidence ev_8e47a6041d27c2b97648b90761acd23af52c366f50cfadd81f4cfec064e740ef.
 * Sound callbacks and Win32 linked-list housekeeping are handled by the host.
 */
(function (root) {
  'use strict';
  const spriteForState = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,83,84,85,84,49,87,88,89];
  const actorOffsets = Object.freeze({type:0x18,state:0x1c,sprite:0x10,x:0x40,y:0x42,z:0x44,vx:0x46,vy:0x48,vz:0x4a});
  function dimensions(game, actor) {
    const meta = (game.spriteMeta || root.SKI_SPRITES || {})[actor.sprite];
    return {width:meta?.width || actor.width || 0,height:meta?.height || actor.height || 0};
  }
  const s16=n=>(n<<16)>>16;
  function rectangle(game, actor, x=actor.x, y=actor.y) {
    const {width,height} = dimensions(game,actor);
    const left=x-Math.trunc(width/2),bottom=y-(actor.z||0);
    return {left,right:left+width,top:bottom-height,bottom};
  }
  function overlaps(game,a,b) {
    if(a.removed||b.removed)return false;
    // Place b relative to a so that actors on either side of the 16-bit wrap still meet.
    const A=rectangle(game,a),B=rectangle(game,b,a.x+s16(b.x-a.x),a.y+s16(b.y-a.y));
    return A.right>B.left && A.left<B.right && A.bottom>B.top && A.top<B.bottom;
  }
  // 0x403a3e..0x403a96: crossing includes equality at either end,
  // except when both new and old Y are equal between the two actors.
  // The native code compares signed coordinates directly, not wrapped differences.
  function crossedY(a,b) {
    const current=a.y-b.y, previous=(a.prevY??a.y)-(b.prevY??b.y);
    return (current>=0&&previous<=0||current<=0&&previous>=0) && !(current===0&&previous===0);
  }
  function setState(game,actor,state) {
    if(typeof game.setState==='function')game.setState(actor,state);
    else {actor.state=state;actor.sprite=spriteForState[state];}
  }
  function score(game,n) {game.addScore(n);}
  function playerCollision(game,other,assumeOverlap=false) {
    const p=game.player;
    if(!p||p.removed||other.removed||(!assumeOverlap&&!overlaps(game,p,other)))return false;
    if(p.state===17)return true; // Existing airborne tumble ignores further contacts.
    const crossing=crossedY(p,other);
    const pz=p.z||0,oz=other.z||0;
    const topP=pz+dimensions(game,p).height,topO=oz+dimensions(game,other).height;
    switch(other.type) {
      case 2: case 12: case 17: // dog, gate, poop/static sign
        if(crossing)p.vy=Math.trunc(p.vy/2);
        if(other.sprite===82)score(game,-16);
        break;
      case 11: // Mogul patch; applies only in straight-down state 0.
        if(p.state===0){
          p.vz=1;
          if(p.vy>4)p.vy=Math.trunc(p.vy/2);
          setState(game,p,13);
        }
        break;
      case 15: // Snow jump: 0x403bb3..0x403bff.
        if(pz<=0){p.vz=4;score(game,1);setState(game,p,13);}
        else if(pz<topO){p.vz=Math.trunc(p.vy/2);score(game,1);}
        break;
      case 16: // Rainbow jump: 0x403c84..0x403ce2.
        if(crossing&&pz<Math.trunc(topO/2)&&p.vy>0){
          p.vz=p.vy;score(game,1);setState(game,p,13);
        }
        break;
      case 14: // Rock/stump; airborne contact differs from ground collision.
        if(pz>0){
          if(pz<=topO){
            if(crossing){p.vz=Math.trunc(p.vy/2);score(game,1);}
          }else if(other.sprite===86){other.removed=true;score(game,100);}
          break;
        }
        // fall through to the common solid-object handler.
      case 1: case 3: case 4: case 9: case 10: case 13: {
        if(pz<=topO&&oz<=topP){
          if(!crossing)break;
          // A tree's outer branches slow rather than fully crash the skier.
          if(other.type===13&&Math.abs(p.x-other.x)>Math.trunc(Math.max(dimensions(game,p).width,dimensions(game,other).width)/2)){
            p.vy=Math.trunc(p.vy/2);break;
          }
          const state=pz===0&&p.vz===0?11:17;
          setState(game,p,state);
          if(state===17&&other.sprite===50){
            other.type=9;setState(game,other,56);score(game,16);break;
          }
          // Skiing uphill into the stump creates the little disappearing stump.
          if(p.vy<0&&other.sprite===46){other.sprite=86;break;}
          score(game,-32);
        }else{
          if(other.type===9){
            score(game,1000);other.type=13;other.sprite=50;
          }else score(game,6);
        }
        break;
      }
      // Yeti contact is handled by the reciprocal type5..8 handler below.
    }
    return true;
  }
  function collide(game,actor,other,assumeOverlap=false) {
    if(actor===game.player)return playerCollision(game,other,assumeOverlap);
    if(actor.removed||other.removed||(!assumeOverlap&&!overlaps(game,actor,other)))return false;
    const otherTop=(other.z||0)+dimensions(game,other).height;
    switch(actor.type){
      case 1: // Other skier falls or jumps after contact.
        if(actor.state<25){if(other.type===0)score(game,20);setState(game,actor,other.z>0?26:25);}
        break;
      case 2: // Dog barks when struck by a moving actor.
        if(actor.state<29&&(other.vx!==0||other.vy!==0)){
          if(other.type===0)score(game,3);setState(game,actor,29);
        }
        break;
      case 3: // Snowboarder contact; no generic circular crash.
        if(other.type===0)score(game,20);
        if([0,1,3,13,14].includes(other.type)){
          if((actor.z||0)<otherTop&&actor.state!==34)setState(game,actor,34);
        }else if([15,16].includes(other.type)&&actor.z<otherTop){
          actor.vz=Math.trunc(actor.vy/2);setState(game,actor,33);
        }
        break;
      case 5: case 6: case 7: case 8:
        if(other===game.player){
          other.removed=true;actor.vx=0;actor.vy=0;
          actor.eatStartedAt=game.time;
          actor.eatingSince=game.tickCount*40;
          setState(game,actor,50);
          if(typeof game.onYetiCatch==='function')game.onYetiCatch(actor);
        }
        break;
      case 10:
        actor.vx=0;setState(game,actor,60);
        break;
    }
    return true;
  }
  root.SkiOriginalCollision={actorOffsets,spriteForState,dimensions,rectangle,overlaps,crossedY,playerCollision,collide};
})(globalThis);
