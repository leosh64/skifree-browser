/* Browser host for the recovered SkiFree simulation. No added page chrome. */
(async function(){
  'use strict';
  const $=id=>document.getElementById(id),canvas=$('slope'),ctx=canvas.getContext('2d');
  const controls=globalThis.SkiOriginalControls,sprites={};
  let width=innerWidth,height=innerHeight,scale=1;
  function resize(){
    const rect=$('playfield').getBoundingClientRect();
    // Enlarge even ordinary windows: the native sprites are only ~20px tall.
    // Keep a useful slope area around a 480×360 reference, with at least 2× zoom.
    scale=Math.max(2,Math.ceil(Math.min(rect.width/480,rect.height/360)));
    width=Math.ceil(rect.width/scale);height=Math.ceil(rect.height/scale);
    canvas.width=width;canvas.height=height;
    canvas.style.width=(width*scale)+'px';canvas.style.height=(height*scale)+'px';
    document.documentElement.style.setProperty('--game-scale',String(scale));
    // A ten-entry score window must still fit on a small phone or short window.
    document.documentElement.style.setProperty('--score-scale',String(Math.min(scale,rect.width/320,rect.height/340)));
    ctx.imageSmoothingEnabled=false;
    if(game)game.viewport={width,height};
  }
  let game=null;resize();
  let failed=false;
  await Promise.all(Object.entries(globalThis.SKI_SPRITES).map(([id,meta])=>new Promise(resolve=>{
    const image=new Image();image.onload=()=>{sprites[id]=image;resolve();};image.onerror=()=>{failed=true;resolve();};image.src=meta.file;
  })));
  if(failed){ctx.fillStyle='#000';ctx.font='13px Arial';ctx.fillText('Unable to load SkiFree bitmap resources.',10,25);return;}
  game=new SkiEngine.SkiGame('free',Date.now()>>>0,SKI_SPRITES,{width,height});
  new ResizeObserver(resize).observe($('playfield'));
  const info=$('scores'),scoreText=$('score-list');
  let stored={};try{stored=JSON.parse(localStorage.getItem('skifree-original-scores')||'{}')||{};}catch{}
  const clock=ms=>{
    ms=Math.max(0,Math.trunc(ms));const hundredths=Math.floor(ms/10)%100,seconds=Math.floor(ms/1000)%60,minutes=Math.floor(ms/60000)%60,hours=Math.floor(ms/3600000);
    return [hours,minutes,seconds].map(n=>String(n).padStart(2,'0')).join(':')+'.'+String(hundredths).padStart(2,'0');
  };
  function showScores(event){
    const {course,value,isTime}=event;
    const previous=Array.isArray(stored[course])?stored[course].filter(Number.isFinite).slice(0,10):[];
    const rank=previous.findIndex(x=>isTime?value<x:value>x);
    const index=rank<0?previous.length:rank;
    previous.splice(index,0,value);stored[course]=previous.slice(0,10);
    try{localStorage.setItem('skifree-original-scores',JSON.stringify(stored));}catch{}
    const lines=stored[course].map((v,i)=>(isTime?clock(v):String(v).padStart(9,' '))+(i===index?" <-- that's you!":''));
    if(index>=10)lines.push('',(isTime?clock(value):String(value).padStart(9,' '))+' <-- try again!');
    scoreText.textContent=lines.join('\n');
    info.showModal();
  }
  function closeScores(){info.close();}
  $('scores-ok').addEventListener('click',closeScores);
  info.addEventListener('close',()=>{game.dismissHighScores();canvas.focus({preventScroll:true});});
  function updateStats(){
    const values=controls.hud(game);
    $('time').textContent=clock(values.timeMs);$('distance').textContent=String(values.distance).padStart(5,' ')+'m';
    $('speed').textContent=String(values.speed).padStart(5,' ')+'m/s';$('score').textContent=String(values.score).padStart(7,' ');
    // The original pause text replaces the window caption, not the ski slope.
    document.title=game.state==='paused'?'Ski Paused ... Press F3 to continue':'SkiFree';
  }
  const keys=new Set(['ArrowLeft','ArrowRight','ArrowDown','ArrowUp','F2','F3','KeyF','Enter','Home','End','PageUp','PageDown','Insert','Numpad0','Numpad1','Numpad2','Numpad3','Numpad4','Numpad6','Numpad7','Numpad8','Numpad9','Space']);
  document.addEventListener('keydown',e=>{
    if(info.open||!keys.has(e.code)||e.metaKey||e.ctrlKey||e.altKey)return;
    e.preventDefault();
    // Native WM_KEYDOWN includes OS repeat. Every event takes one table transition.
    if(e.repeat&&['F2','F3','KeyF'].includes(e.code))return;
    game.key(e.code);updateStats();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.state==='playing'){game.pause();updateStats();}});
  window.addEventListener('blur',()=>{if(!info.open&&game.state==='playing'){game.pause();updateStats();}});
  let lastTouch=0;
  function aim(e){
    if(game.state!=='playing')return;
    const r=canvas.getBoundingClientRect();controls.mouseAim(game,(e.clientX-r.left)/scale-Math.trunc(width/2),(e.clientY-r.top)/scale-Math.trunc(height/3));
  }
  canvas.addEventListener('pointerdown',e=>{
    canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);
    if(game.state==='paused'){game.pause();updateStats();return;}
    if(e.pointerType==='touch'){
      // Touch substitutes drag for hover and double tap for native mouse click.
      aim(e);const now=performance.now();if(lastTouch>0&&now-lastTouch<300)controls.mouseClick(game);lastTouch=now;
    }else{aim(e);controls.mouseClick(game);}
    updateStats();
  });
  canvas.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'||canvas.hasPointerCapture(e.pointerId))aim(e);});
  function render(){
    ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
    const camera=game.camera,cx=Math.trunc(width/2),cy=Math.trunc(height/3);
    const actors=game.objects.filter(a=>!a.removed);
    if(!game.player.removed)actors.push(game.player);
    // Native painter order uses ground Y, not height above the ground.
    const groundY=a=>SkiEngine.s16(a.y-camera.y);
    actors.sort((a,b)=>groundY(a)-groundY(b)||a.id-b.id);
    for(const a of actors){
      const image=sprites[a.sprite];if(!image)continue;
      const x=SkiEngine.s16(a.x-camera.x)+cx-Math.trunc(image.width/2),y=SkiEngine.s16(a.y-camera.y)+cy-a.z-image.height;
      if(x>width||x+image.width<0||y>height||y+image.height<0)continue;
      ctx.drawImage(image,Math.trunc(x),Math.trunc(y));
    }
  }
  let last=0,lastHud=0;
  function frame(now){
    if(!last)last=now;
    game.step(Math.min((now-last)/1000,.2));last=now;
    const scoreEvent=game.events.shift();if(scoreEvent?.kind==='high-scores')showScores(scoreEvent);
    if(now-lastHud>=327){updateStats();lastHud=now;}
    render();requestAnimationFrame(frame);
  }
  updateStats();requestAnimationFrame(frame);
  if(new URLSearchParams(location.search).has('test'))globalThis.__ski={game,render,updateStats,reset:()=>game.reset(),controls,get display(){return {scale,width,height};}};
})();
