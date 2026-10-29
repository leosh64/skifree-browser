import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import '../original-data.js';
import '../original-controls.js';
import '../original-world.js';
import '../original-collision.js';
import '../engine.js';
const D=globalThis.SkiOriginalData,C=globalThis.SkiOriginalCollision,K=globalThis.SkiOriginalControls,W=globalThis.SkiOriginalWorld;
const {SkiGame}=globalThis.SkiEngine;
const meta=JSON.parse(fs.readFileSync(new URL('../assets/manifest.json',import.meta.url)));
function game(){return new SkiGame('free',1991,meta,{width:640,height:480});}
function empty(){const g=game();g.objects=[];g._terrainTravel=null;return g;}
function ticks(g,n){for(let i=0;i<n;i++)g.step(.04);}
const fixtures=JSON.parse(fs.readFileSync(new URL('./fixtures/movement.json',import.meta.url)));
test('movement agrees with 682 isolated original-x86 instruction executions',()=>{
  const g=Object.create(SkiGame.prototype);
  for(const f of fixtures.samples){const p={vx:f.vx,vy:f.vy};g.motion(p,D.motion[f.state]);assert.deepEqual([p.vx,p.vy],f.expected,JSON.stringify(f));}
});
test('original idle state, tick duration and integrate-before-accelerate order',()=>{
  const g=empty();assert.equal(g.player.state,3);ticks(g,20);assert.equal(g.player.y,0);
  g.key('ArrowDown');g.step(.02);assert.equal(g.player.vy,0);g.step(.02);assert.equal(g.player.y,0);assert.equal(g.player.vy,1);
  ticks(g,15);assert.equal(g.player.y,120);assert.equal(g.player.vy,16);assert.equal(g.distance,7);assert.equal(g.speed,25);
});
test('fast mode doubles displacement but not velocity or acceleration',()=>{
  const a=empty(),b=empty();a.key('ArrowDown');b.key('ArrowDown');b.boost=true;ticks(a,60);ticks(b,60);
  assert.equal(b.player.y,a.player.y*2);assert.equal(b.player.vy,a.player.vy);assert.equal(b.timeMs,a.timeMs);
});
test('ground crash drains momentum without sliding and returns to state12',()=>{
  const g=empty(),p=g.player;g.setState(p,11);p.vx=-3;p.vy=4;ticks(g,4);
  assert.equal(p.x,0);assert.equal(p.y,0);assert.equal(p.vx,0);assert.equal(p.vy,0);assert.equal(p.state,11);ticks(g,1);assert.equal(p.state,12);
});
test('native Insert and mouse jumps have distinct impulses; backward steps work',()=>{
  const g=empty(),p=g.player;p.vy=12;g.key('Insert');assert.equal(p.vz,2);assert.equal(p.vy,8);assert.equal(p.state,13);ticks(g,1);assert.equal(p.z,2);assert.equal(p.vz,1);
  const m=empty();K.mouseClick(m);assert.equal(m.player.vz,4);ticks(m,10);assert.equal(m.player.z,0);
  const u=empty();u.key('ArrowUp');assert.equal(u.player.vy,-4);ticks(u,1);assert.equal(u.player.y,-4);assert.equal(u.player.state,3);
});
test('MSVC RNG reproduces the known seeded sequence',()=>{
  const g=Object.create(SkiGame.prototype);g.randomState=1;
  assert.deepEqual(Array.from({length:5},()=>g.randomInt(32768)),[41,18467,6334,26500,19169]);
});
test('pause freezes world; identical seeded key events replay identically',()=>{
  const a=game(),b=game();
  for(let i=0;i<600;i++){if(i===0||i%80===0){a.key('ArrowDown');b.key('ArrowDown');}if(i%80===30){a.key('ArrowLeft');b.key('ArrowLeft');}if(i%113===0){a.key('Insert');b.key('Insert');}ticks(a,1);ticks(b,1);}
  assert.deepEqual(a.player,b.player);assert.deepEqual(a.objects,b.objects);assert.equal(a.randomState,b.randomState);
  a.pause();const before=JSON.stringify(a);ticks(a,50);assert.equal(JSON.stringify(a),before);
});
test('pause ignores steering and jumps but still accepts F2, F3 and F',()=>{
  const g=empty(),p=g.player;g.pause();
  for(const code of ['ArrowUp','ArrowDown','ArrowLeft','Insert','Space','Home'])g.key(code);
  assert.equal(p.state,3);assert.equal(p.vy,0);assert.equal(p.vz,0);
  g.key('KeyF');assert.equal(g.boost,true);g.key('F3');assert.equal(g.state,'playing');
  g.pause();g.key('F2');assert.equal(g.boost,false);assert.equal(g.state,'playing');
});
test('wraparound scenery stays visible while crossing uses original signed comparisons',()=>{
  const g=empty(),p=g.player;p.y=p.prevY=32700;g.setState(p,0);
  const tree=g.addActor(13,49,0,-32736);tree.generated=true;
  W.updateActors(g);W.generateTerrain(g);assert.equal(tree.removed,false);
  p.y=-32760;p.prevY=32760;tree.y=tree.prevY=-32766;
  assert.ok(C.overlaps(g,p,tree));assert.equal(C.crossedY(p,tree),false);
  p.vy=16;g.styleActive=true;C.playerCollision(g,tree);
  assert.equal(p.state,0);assert.equal(g.score,0);
  assert.equal(C.crossedY({y:32760,prevY:-32760},{y:32766,prevY:32766}),false);
  assert.equal(C.crossedY({y:100,prevY:80},{y:95,prevY:95}),true);
});
test('original sprite AABBs and Y crossing replace circular collision tests',()=>{
  const g=empty(),p=g.player;p.x=0;p.y=100;p.prevY=80;p.vy=12;g.styleActive=true;
  const rock=g.addActor(14,45,0,95);rock.prevY=95;
  assert.ok(C.overlaps(g,p,rock));C.playerCollision(g,rock);assert.equal(p.state,11);assert.equal(g.score,-32);
  g.score=0;g.styleActive=false;g.setState(p,0);C.playerCollision(g,rock);assert.equal(g.score,0);
});
test('moguls, ramps and rainbow jumps use original different impulses',()=>{
  for(const [type,sprite,expected] of [[11,27,1],[15,47,4],[16,52,12]]){
    const g=empty(),p=g.player;p.x=0;p.y=100;p.prevY=90;p.vy=12;g.setState(p,0);g.styleActive=true;
    const obstacle=g.addActor(type,sprite,0,95);C.playerCollision(g,obstacle,true);
    assert.equal(p.vz,expected);assert.equal(p.state,13);assert.equal(g.score,type===11?0:1);
  }
});
test('dead trees ignite and burning trees can be extinguished for original points',()=>{
  const g=empty(),p=g.player;g.styleActive=true;p.y=100;p.prevY=90;p.z=1;p.vz=0;g.setState(p,13);
  const tree=g.addActor(13,50,0,95);C.playerCollision(g,tree,true);assert.equal(tree.type,9);assert.equal(tree.state,56);assert.equal(g.score,16);
  p.z=100;p.vz=0;g.setState(p,13);C.playerCollision(g,tree,true);assert.equal(tree.type,13);assert.equal(tree.sprite,50);assert.equal(g.score,1016);
});
test('original course geometry, single flag side checks, units and penalties',()=>{
  const g=game(),p=g.player;assert.equal(g.course.flags.SS.length,24);assert.equal(g.course.flags.GS.length,39);
  p.prevX=p.x=-448;p.prevY=639;p.y=641;g.timeMs=40;K.updateCourses(g);assert.ok(g.course.slalomActive);assert.equal(K.hud(g).distance,499);
  p.prevY=959;p.y=961;p.prevX=p.x=-450;g.timeMs+=40;K.updateCourses(g);
  assert.equal(g.course.flags.SS[0].passed,false);assert.equal(g.course.penaltyMs,5000);assert.equal(g.score,0);
  p.prevY=8639;p.y=8641;g.timeMs+=40;K.updateCourses(g);assert.equal(g.state,'scores');assert.equal(g.highScore.course,'SS');
  g.dismissHighScores();assert.equal(g.state,'playing');assert.equal(g.course.slalomActive,false);
});
test('restored fixed world and four boundary yetis; original capture/eating sequence',()=>{
  const g=game();assert.equal(g.objects.filter(a=>a.liftTower).length,13);assert.equal(g.objects.filter(a=>a.lift).length,24);
  const sentries=g.objects.filter(a=>a.sentry);assert.deepEqual(sentries.map(a=>[a.type,a.x,a.y]),[[7,-16060,0],[8,16060,0],[5,0,-2060],[6,0,32060]]);
  const m=sentries.find(a=>a.type===6);g.player.y=32001;W.updateActors(g);assert.equal(m.vy,-10); // approaches player above it, not a scalar chase speed
  m.x=g.player.x;m.y=g.player.y;m.z=0;C.collide(g,m,g.player,true);assert.equal(g.player.removed,true);assert.equal(m.state,50);assert.equal(g.caught,true);
  ticks(g,20);assert.ok(m.state>=52);ticks(g,70);assert.ok(m.state<50);assert.equal(g.state,'playing');
});
test('reset removes temporary state while preserving all original starting objects',()=>{
  const g=game();g.boost=true;g.styleActive=true;g.score=-32;ticks(g,10);g.reset('free',1991);
  assert.equal(g.player.state,3);assert.equal(g.player.x,0);assert.equal(g.player.y,0);assert.equal(g.score,0);assert.equal(g.boost,false);assert.equal(g.styleActive,false);
  assert.ok(g.objects.some(a=>a.sprite===53));assert.ok(g.objects.some(a=>a.sprite===54));
});
