import assert from 'node:assert/strict';
import test from 'node:test';
import '../original-data.js';
import '../original-controls.js';
const C=globalThis.SkiOriginalControls;
function mock(){
  const g={player:{x:0,y:0,z:0,vx:0,vy:0,vz:0,state:3,prevX:0,prevY:0},width:960,height:610,tickMs:40,timeMs:0,score:0,objects:[],randomCalls:[],events:[],
    randomInt(n){this.randomCalls.push(n);return 0;},
    addActor(type,sprite,x,y,z){const a={type,sprite,x,y,z};this.objects.push(a);return a;},
    setActorState(p,state){p.state=state;p.sprite=globalThis.SkiOriginalData.stateSprites[state];},
    reset(){this.resetCalled=true;},pause(){this.paused=!this.paused;}
  };C.initCourses(g);return g;
}
test('turn transitions exactly match the 22-entry native byte table',()=>{
  for(let state=0;state<22;state++){
    if(state===11||state===17)continue;
    for(const [index,key] of [[0,'ArrowLeft'],[1,'ArrowRight']]){
      const g=mock();g.player.state=state;C.applyKey(g,key);
      assert.equal(g.player.state,globalThis.SkiOriginalData.turns[state][index]);
    }
  }
});
test('native jump and uphill step alter discrete velocities',()=>{
  const g=mock();C.applyKey(g,'ArrowUp');assert.equal(g.player.state,9);assert.equal(g.player.vy,-4);
  g.player.state=0;g.player.vy=10;C.applyKey(g,'Insert');assert.equal(g.player.vz,2);assert.equal(g.player.vy,6);assert.equal(g.player.state,13);
  g.player.z=10;C.mouseClick(g);assert.equal(g.player.state,18);C.mouseClick(g);assert.equal(g.player.state,19);C.mouseClick(g);assert.equal(g.player.state,13);
});
test('course construction matches binary constants and RNG side effects',()=>{
  const g=mock();assert.equal(g.course.flags.SS.length,24);assert.equal(g.course.flags.GS.length,39);
  assert.deepEqual(g.course.flags.SS.slice(0,2).map(f=>[f.sprite,f.x,f.y]),[[23,-496,960],[24,-400,1280]]);
  assert.equal(g.course.flags.SS.at(-1).y,8320);assert.equal(g.course.flags.GS.at(-1).y,16240);
  assert.equal(g.randomCalls.length,117);assert.deepEqual(g.randomCalls.slice(0,3),[8,32,400]);
  assert.deepEqual(g.objects.slice(0,4).map(o=>[o.sprite,o.x,o.y]),[[53,-86,0],[54,-86,14],[55,92,30],[56,92,66]]);
});
test('slalom crossing interpolates start and applies only the original timed penalty',()=>{
  const g=mock(),p=g.player;p.x=p.prevX=-450;p.prevY=630;p.y=650;g.timeMs=40;C.updateCourses(g);
  assert.equal(g.course.slalomActive,true);assert.equal(g.course.startMs,20);assert.equal(g.course.elapsedMs,20);
  p.prevY=950;p.y=970;g.timeMs=80;C.updateCourses(g);
  assert.equal(g.course.flags.SS[0].passed,false);assert.equal(g.course.flags.SS[0].sprite,26);assert.equal(g.course.penaltyMs,5000);assert.equal(g.score,0);
  p.prevY=1270;p.y=1290;p.x=p.prevX=-390;g.timeMs=120;C.updateCourses(g);
  assert.equal(g.course.flags.SS[1].passed,true);assert.equal(g.course.flags.SS[1].sprite,25);assert.equal(g.score,0);
});
test('course finish emits high scores without ending skiing; HUD counts down in sixteenths',()=>{
  const g=mock(),p=g.player;g.course.slalomActive=true;g.course.startMs=0;p.y=800;p.vy=16;
  assert.deepEqual(C.hud(g),{distance:490,speed:25,timeMs:0,score:0});
  p.prevY=8639;p.y=8641;g.timeMs=10000;C.updateCourses(g);
  assert.equal(g.course.slalomActive,false);assert.equal(g.events[0].course,'SS');assert.equal(g.events[0].value,9980);assert.equal(g.events[0].isTime,true);
  assert.equal(C.hud(g).distance,540);assert.equal(g.state,undefined);
});
test('free style activates independently and never starts a race timer',()=>{
  const g=mock(),p=g.player;p.prevY=630;p.y=650;g.timeMs=40;C.updateCourses(g);
  assert.equal(g.styleActive,true);assert.equal(g.course.styleActive,true);assert.equal(C.hud(g).timeMs,0);
  p.prevY=16630;p.y=16650;g.score=123;C.updateCourses(g);assert.equal(g.events[0].course,'FS');assert.equal(g.events[0].value,123);assert.equal(g.events[0].isTime,false);
});
test('Free Style re-entry preserves positive and negative accumulated style points',()=>{
  for(const score of [500,-32]){
    const g=mock(),p=g.player;p.prevY=630;p.y=650;C.updateCourses(g);g.score=score;
    p.prevY=650;p.y=600;C.updateCourses(g);assert.equal(g.course.styleActive,false);
    p.prevY=630;p.y=650;C.updateCourses(g);
    assert.equal(g.course.styleActive,true);assert.equal(g.styleActive,true);assert.equal(g.score,score);
  }
});
