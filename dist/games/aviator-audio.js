(() => {
 'use strict';
 const tracks = {}, volumes = {background:.55,flight:.025,start:.65,crash:.70,win:.85,lose:.70,bet:.7};
 let unlocked=false,muted=false,phase='connecting',background=true,effects=true,master=.65;
 const active=new Set();let ducked=false,duckTimer;
 const files={background:'reference-background.m4a',start:'reference-takeoff.m4a',crash:'reference-flyaway.m4a',win:'reference-cashout.m4a',lose:'reference-flyaway.m4a',bet:'reference-bet.m4a',flight:'flight.wav'};
 for(const name of Object.keys(volumes)){
  const a=new Audio('aviator-audio/'+files[name]);a.preload=['start','win','lose','crash'].includes(name)?'auto':'none';a.loop=name==='background'||name==='flight';a.addEventListener('ended',()=>active.delete(name));tracks[name]=a;
 }
 function volume(){for(const [name,a] of Object.entries(tracks))a.volume=Math.min(1,volumes[name]*master*(name==='background'&&ducked?.14:1));}
 function stop(name){const a=tracks[name];a.pause();a.currentTime=0;active.delete(name);}
 function play(name){if(!unlocked||muted||document.hidden||(name!=='background'&&!effects))return;const a=tracks[name];if(!a)return;if(name==='lose')stop('crash');if(!a.loop){a.currentTime=0;ducked=true;volume();clearTimeout(duckTimer);duckTimer=setTimeout(()=>{ducked=false;volume();},(Number.isFinite(a.duration)?a.duration:1.5)*1000+80);}active.add(name);a.play().catch(()=>active.delete(name));}
 function sync(){
  if(muted||!unlocked||document.hidden||phase==='connecting'){Object.keys(tracks).forEach(stop);return;}
  if(background)play('background');else stop('background');
  if(phase==='flying'&&effects)play('flight');else stop('flight');
 }
 function setPhase(next){const previous=phase;phase=next;sync();if(next==='flying'&&previous==='waiting')play('start');if(next==='crashed'&&previous==='flying')play('crash');}
 function state(){return {unlocked,muted,phase,background,effects,master,active:[...active]};}
 function unlock(){if(unlocked)return;unlocked=true;volume();sync();}
 document.addEventListener('pointerdown',e=>{if(!e.target.closest('#sound'))unlock();},{passive:true});
 document.addEventListener('keydown',unlock,{once:true});
 document.addEventListener('visibilitychange',sync);
 window.addEventListener('pagehide',()=>Object.keys(tracks).forEach(stop));
 window.CWAviatorAudio={play,setPhase,state,unlock,setMuted(value){muted=!!value;sync();},setEffects(value){effects=!!value;if(!effects)Object.keys(tracks).filter(n=>n!=='background').forEach(stop);sync();},setBackground(value){background=!!value;sync();},setVolume(value){master=Math.max(0,Math.min(1,Number(value)||0));volume();}};
 volume();
})();
