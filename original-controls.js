/* Native controls and course logic, ski32.exe SHA-256 3572d375...0ff35.
 * Binary anchors: 406170 (key switches), 406550 (mouse), 404b50 (courses),
 * 402c60/403180/403250 (course crossings), 401b80 (HUD).
 */
(function(root){
  'use strict';
  const trunc=Math.trunc;
  const courses={
    SS:{name:'Slalom',left:-576,right:-320,start:640,finish:8640,first:960,spacing:320,redX:-496,blueX:-400},
    GS:{name:'Tree Slalom',left:320,right:512,start:640,finish:16640,first:1040,spacing:400,redX:400,blueX:432},
    FS:{name:'Free Style',left:-160,right:160,start:640,finish:16640}
  };
  const leftTurns=[1,2,3,7,0,4,5,3,5,9,5,3,3,14,16,13,15,14,20,20,16,13];
  const rightTurns=[4,0,1,2,5,6,8,2,6,2,10,6,6,15,13,16,14,15,21,21,13,16];
  function setState(game,p,state){
    if(game.setActorState)game.setActorState(p,state);
    else if(game.setState)game.setState(p,state);
    else{p.state=state;p.sprite=(root.SkiOriginalData?.stateSprites||[])[state]??state+1;}
  }
  function pause(game){if(game.pause)game.pause();else game.paused=!game.paused;}
  function mouseClick(game){
    const p=game.player;if(!p||p.removed){game.reset();return true;}
    if(p.state===11||p.state===17)return true;
    let s=p.state;
    if(p.z===0){p.vz=4;s=13;}
    else s=({13:18,14:20,15:21,18:19,19:13})[s]??s;
    setState(game,p,s);return true;
  }
  function applyKey(game,code){
    const p=game.player;
    if(code==='F2'){game.reset();return true;}
    if(code==='F3'){pause(game);return true;}
    if(code==='KeyF'||code==='f'){game.boost=!game.boost;return true;}
    if(code==='Enter'){if(!p||p.removed)game.reset();return true;}
    if(!p||p.removed||p.state===11||p.state===17)return false;
    const s=p.state;
    let next=s;
    if(['ArrowLeft','Numpad4'].includes(code)){
      next=leftTurns[s]??s;if(next===7)p.vx=Math.max(p.vx-8,-8);
    }else if(['ArrowRight','Numpad6'].includes(code)){
      next=rightTurns[s]??s;if(next===8)p.vx=Math.min(p.vx+8,8);
    }else if(['ArrowDown','Numpad2'].includes(code)){
      next=p.z===0?0:({13:19,18:13,19:18,20:14,21:15})[s]??s;
    }else if(['ArrowUp','Numpad8'].includes(code)){
      if([3,7,12].includes(s)&&p.vy===0){next=9;p.vy=-4;}
      else if([6,8].includes(s)&&p.vy===0){next=10;p.vy=-4;}
      else next=({13:18,14:20,15:21,18:19,19:13})[s]??s;
    }else if(['Home','Numpad7'].includes(code)){
      if(p.z===0)next=3;
    }else if(['PageUp','Numpad9'].includes(code)){
      if(p.z===0)next=6;
    }else if(['End','Numpad1'].includes(code)){
      if(p.z===0)next=1;
    }else if(['PageDown','Numpad3'].includes(code)){
      if(p.z===0)next=4;
    }else if(['Insert','Numpad0','Space'].includes(code)){
      // Space is the sole keyboard convenience alias; native action is Insert/Num0.
      if(p.z===0){p.vz=2;next=13;if(p.vy>4)p.vy-=4;}
    }else return false;
    setState(game,p,next);return true;
  }
  function mouseState(dx,dy,airborne=false){
    if(airborne){
      if(dx<0)return dy<0?(dy<dx?16:14):(-dy>=dx?14:13);
      return dy<0?(-dy>dx?16:15):(dy<=dx?14:13);
    }
    if(dy<=0)return dx<0?3:6;
    if(dx===0)return 0;
    const r=trunc(4*dy/dx);
    if(r<=-12)return 0;if(r<=-6)return 1;if(r<=-3)return 2;if(r<=-1)return 3;
    if(r>=12)return 0;if(r>=6)return 4;if(r>=3)return 5;if(r>=1)return 6;
    return dx<0?3:6;
  }
  function mouseAim(game,dx,dy){
    const p=game.player;if(!p||p.removed||p.state===11||p.state===17)return;
    setState(game,p,mouseState(dx,dy,p.z!==0));
  }
  function initCourses(game){
    const c=game.course={slalomActive:false,treeActive:false,styleActive:false,startMs:0,elapsedMs:0,penaltyMs:0,flags:{SS:[],GS:[]},finished:{}};
    game.styleActive=false;
    const add=(type,sprite,x,y)=>game.addActor(type,sprite,x,y,0);
    // Original introductory resources, relative to the skier's initial x=y=0.
    add(17,53,-86,0);add(17,54,-86,14);add(17,55,92,30);add(17,56,92,66);
    const w=game.width||game.viewportWidth||game.viewport?.width||960,h=game.height||game.viewportHeight||game.viewport?.height||610;
    let signY=h-trunc(h/3)-60;if(signY>640)signY=520;
    add(17,61,Math.max(-trunc(w/2)+60,-320),signY);
    add(17,62,Math.min(w-trunc(w/2)-60,320),signY);
    add(17,63,0,signY);
    for(const key of ['SS','GS','FS']){
      const d=courses[key];
      add(17,57,d.left,d.start);add(17,58,d.right,d.start);
      if(key!=='FS'){
        let red=true;
        for(let y=d.first;y<d.finish;y+=d.spacing){
          const flag=add(12,red?23:24,red?d.redX:d.blueX,y);
          Object.assign(flag,{courseKey:key,red,checked:false,passed:false});
          c.flags[key].push(flag);red=!red;
          if(key==='GS'){
            // 404df8..404e38 consumes these values but emits no additional tree.
            game.randomInt(8);game.randomInt(32);game.randomInt(400);
          }
        }
      }
      add(17,59,d.left,d.finish);add(17,60,d.right,d.finish);
    }
    return c;
  }
  function atY(old,newValue,oldY,newY,y){
    return newValue-trunc((newValue-old)*(newY-y)/(newY-oldY));
  }
  function finish(game,key,value,isTime){
    game.course.finished[key]=value;
    if(game.showHighScores)game.showHighScores(key,value,isTime);
    else (game.events||(game.events=[])).push({type:'highscores',course:key,value,isTime});
  }
  function updateCourses(game){
    const p=game.player,c=game.course;if(!p||p.removed||!c)return;
    const oldY=p.prevY??p.y,oldX=p.prevX??p.x;
    const now=game.timeMs??game.tickCount*(game.tickMs||40),before=now-(game.tickMs||40);
    for(const [key,active] of [['SS','slalomActive'],['GS','treeActive'],['FS','styleActive']]){
      const d=courses[key];
      if(c[active]){
        if(key!=='FS')c.elapsedMs=now-c.startMs+c.penaltyMs;
        if(p.y>d.finish){
          c[active]=false;
          if(key==='FS'){game.styleActive=false;finish(game,key,game.score||0,false);}
          else{
            const end=oldY===p.y?now:atY(before,now,oldY,p.y,d.finish);
            c.elapsedMs=end-c.startMs+c.penaltyMs;finish(game,key,c.elapsedMs,true);
          }
        }else if(p.y<=d.start){c[active]=false;if(key==='FS')game.styleActive=false;}
        else if(key!=='FS'){
          // The original processes at most one next flag per tick.
          const flag=c.flags[key].find(f=>!f.checked);
          if(flag&&p.y>flag.y&&oldY!==p.y){
            const x=atY(oldX,p.x,oldY,p.y,flag.y);
            flag.checked=true;flag.passed=flag.red?x<=flag.x:x>=flag.x;
            flag.sprite=flag.passed?25:26;
            if(!flag.passed){c.penaltyMs+=5000;c.elapsedMs+=5000;}
          }
        }
      }else if(oldY<=d.start&&p.y>d.start){
        const x=atY(oldX,p.x,oldY,p.y,d.start);
        if(x>=d.left&&x<=d.right){
          c[active]=true;
          if(key==='FS')game.styleActive=true;
          else{
            c.startMs=atY(before,now,oldY,p.y,d.start);c.penaltyMs=0;c.elapsedMs=now-c.startMs;
            for(const f of c.flags[key]){f.checked=false;f.passed=false;f.sprite=f.red?23:24;}
          }
        }
      }
    }
  }
  function hud(game){
    const p=game.player,c=game.course||{};
    let dist=p?.y||0;
    if(c.slalomActive)dist=8640-dist;else if(c.treeActive||c.styleActive)dist=16640-dist;
    return {distance:trunc(dist/16),speed:p?trunc(p.vy*1000/(16*(game.tickMs||40))):0,timeMs:c.elapsedMs||0,score:game.score||0};
  }
  root.SkiOriginalControls={courses,leftTurns,rightTurns,applyKey,mouseState,mouseAim,mouseClick,initCourses,updateCourses,hud};
})(globalThis);
