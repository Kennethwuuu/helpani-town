/* Original runtime Canvas art for Helpani Town's virtual companion habitats.
 * Compressed activity cycles; stylized animation rather than a wildlife simulation. */
import { WoodlandScene } from './woodland-scene.js?v=20261110-unified-care';

const W = 1600, H = 1000, TAU = Math.PI * 2;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const copy = (value) => structuredClone(value);
const length = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const nodes = {
  pangolin: { home:{x:290,y:816}, moss:{x:720,y:829}, soil:{x:942,y:844}, fern:{x:1280,y:814}, 'root-den':{x:495,y:806}, 'leaf-bed':{x:1160,y:829} },
  'sea-turtle': { reef:{x:360,y:659}, grass:{x:788,y:750}, blue:{x:1220,y:494}, surface:{x:950,y:380}, seagrass:{x:565,y:814}, 'rock-shelf':{x:1180,y:704} },
};
const names = {pangolin:'小松','sea-turtle':'阿潮'};
const facilities = {pangolin:'leaf-nest','sea-turtle':'rest-ledge'};
const slots = {pangolin:['root-den','leaf-bed'],'sea-turtle':['seagrass','rock-shelf']};
const labels = {
  pangolin: {walk:'小松沿着落叶间的小路慢慢探索。',sniff:'小松停下脚步，用长鼻吻闻闻泥土。',dig:'小松用前爪轻轻刨土，落叶跟着动了动。',settle:'小松找到落脚处，慢慢收起四肢和长尾。','shelter-rest':'小松自主走进新休息窝，安静地歇下来。','curled-rest':'小松收拢身体，在树根旁安静休息。',rise:'小松舒展开身体，准备继续看看。'},
  'sea-turtle': {swim:'阿潮划动前鳍，沿着浅湾慢慢游。',surface:'阿潮游近水面，探出鼻尖换气。',rest:'阿潮在礁石旁停留，前鳍轻轻舒展。',settle:'阿潮放慢鳍摆，靠近新的休息石台。','ledge-rest':'阿潮自主来到休息石台，安静地停一会儿。',rise:'阿潮展开前鳍，准备重新游进浅湾。'},
};
function ellipse(ctx,x,y,rx,ry,fill,rotation=0){ctx.beginPath();ctx.ellipse(x,y,rx,ry,rotation,0,TAU);ctx.fillStyle=fill;ctx.fill();}
function shape(ctx,d,fill,stroke,width=1){const p=new Path2D(d);if(fill){ctx.fillStyle=fill;ctx.fill(p);}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke(p);}return p;}
function line(ctx,points,color,width=1){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();}
function rng(seed){let s=seed>>>0;return()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296;};}
function canvas(){const c=document.createElement('canvas');c.width=W;c.height=H;return c;}
function leaf(ctx,x,y,size,angle,color){ctx.save();ctx.translate(x,y);ctx.rotate(angle);shape(ctx,`M0 0Q${size*.35} ${-size*.6} ${size} 0Q${size*.5} ${size*.5} 0 0`,color);ctx.restore();}
function fern(ctx,x,y,size,color){for(let f=-2;f<=2;f++){const ex=x+f*size*.28,ey=y-size*(1-Math.abs(f)*.12);line(ctx,[[x,y],[x+f*size*.1,y-size*.55],[ex,ey]],color,2);for(let k=1;k<9;k++){const t=k/9,px=lerp(x,ex,t*t),py=lerp(y,ey,t),s=size*.14*Math.sin(t*Math.PI);leaf(ctx,px,py,s,-2.9,color);leaf(ctx,px,py,s,-.2,color);}}}

/** Shares the established camera, touch, visibility, resize and lifecycle code. */
export class CompanionScene extends WoodlandScene {
  constructor(target, callbacks = {}) {
    super(target,callbacks);
    this.species = callbacks.species === 'sea-turtle' ? 'sea-turtle' : 'pangolin';
    const start=this.isTurtle?'grass':'moss',p=nodes[this.species][start];
    this.actor={x:p.x,y:p.y,facing:1,angle:0,phase:0,posture:0,mode:this.isTurtle?'rest':'sniff',duration:1.8,elapsed:0,node:start,goal:null,segment:null,usingFacility:null};
    this.effect=null;this.visitCount=0;
    this.background=canvas();this.drawBackground(this.background.getContext('2d'));
    this.foreground=canvas();this.drawForeground(this.foreground.getContext('2d'));
    this.status(this.actor.mode);
  }
  get isTurtle(){return this.species==='sea-turtle';}
  status(mode){const species=this.species||'pangolin';this.callbacks.onStatus?.(labels[species][mode]||labels[species][this.isTurtle?'swim':'walk']);}
  setPreview(slotId,facilityId=facilities[this.species]){this.preview=slotId?{slotId,facilityId}:null;}
  focusAnimal(){this.camera.zoom=Math.max(1.8,this.camera.zoom);this.camera.x=this.actor.x;this.camera.y=this.actor.y-85;this.clampCamera();}
  updateLayout(state){
    if(!state||state.layoutVersion<(this.targetState?.layoutVersion??-1))return;
    this.targetState=copy(state);
    if(this.layoutVersion===-1){this.layout={platform:state.layout.platform,bridge:false};this.layoutVersion=state.layoutVersion;this.nextPlatformVisit=Boolean(this.layout.platform);if(state.appliedVersion!==state.layoutVersion)this.callbacks.onLayoutApplied?.(state.layoutVersion);}
    else this.applyIfSafe();
  }
  isFacilityBusy(){const a=this.actor;return Boolean(a.usingFacility||slots[this.species].includes(a.node)||slots[this.species].includes(a.goal));}
  applyIfSafe(){
    const state=this.targetState;if(!state||state.layoutVersion<=this.layoutVersion||this.isFacilityBusy())return false;
    const changed=state.layout.platform!==this.layout.platform;
    this.layout={platform:state.layout.platform,bridge:false};this.layoutVersion=state.layoutVersion;
    if(changed&&this.layout.platform)this.nextPlatformVisit=true;
    this.callbacks.onLayoutApplied?.(this.layoutVersion);return true;
  }
  report(behavior,facilityId=null){
    const key=`${behavior}:${facilityId||''}:${facilityId?this.layoutVersion:0}`;
    if(this.reported.has(key))return;this.reported.add(key);
    this.callbacks.onObserve?.({behavior,facilityId,layoutVersion:this.layoutVersion});
  }
  action(mode,duration){this.actor.mode=mode;this.actor.duration=duration;this.actor.elapsed=0;this.actor.segment=null;this.status(mode);}
  go(target){
    const a=this.actor,end=nodes[this.species][target];if(!end)return;
    a.goal=target;
    if(length(a,end)<1){a.node=target;this.arrive();return;}
    const speed=this.isTurtle?112:88;
    a.segment={start:{x:a.x,y:a.y},end:{...end},endId:target,duration:Math.max(1.4,length(a,end)/speed),kind:this.isTurtle?'swim':'walk'};
    a.elapsed=0;a.duration=a.segment.duration;a.mode=a.segment.kind;
    a.targetFacing=end.x>=a.x?1:-1;
    a.targetAngle=this.isTurtle?clamp(Math.atan2((end.y-a.y)*a.targetFacing,Math.abs(end.x-a.x)),-.48,.48):clamp(Math.atan2((end.y-a.y)*a.targetFacing,Math.abs(end.x-a.x)),-.18,.18);
    this.status(a.mode);
  }
  arrive(){
    const a=this.actor;a.segment=null;
    if(a.node===this.layout.platform){a.usingFacility=facilities[this.species];this.nextPlatformVisit=false;this.action('settle',1.5);return;}
    a.goal=null;a.usingFacility=null;this.applyIfSafe();
    if(this.isTurtle){
      this.report('swim');
      if(a.node==='surface')this.action('surface',3.5);
      else this.action('rest',1.4+this.random()*2.2);
    }else{
      this.report('ground-explore');
      if(a.node==='soil'){this.action('dig',3.6);this.report('dig');}
      else if(a.node==='home')this.action('settle',1.5);
      else this.action('sniff',1.6+this.random()*1.5);
    }
  }
  chooseGoal(){
    this.applyIfSafe();
    if(this.nextPlatformVisit&&this.layout.platform){this.go(this.layout.platform);return;}
    const cycle=this.isTurtle?['surface','blue','grass','reef']:['soil','fern','home','moss'];
    let target=cycle[this.visitCount++%cycle.length];
    if(this.layout.platform&&this.visitCount%4===0)target=this.layout.platform;
    if(target===this.actor.node)target=this.isTurtle?'blue':'soil';
    this.go(target);
  }
  interact(kind='touch'){
    this.effect={kind:kind==='feed'?'feed':'touch',elapsed:0,duration:3};
    this.callbacks.onStatus?.(kind==='feed'?`${names[this.species]}收到你的虚拟照护粮，轻轻回应。`:this.isTurtle?'阿潮抬了抬头，轻摆前鳍回应你的虚拟互动。':'小松轻轻抬头，慢慢熟悉你的虚拟互动。');
    if(this.paused)this.paint(this.canvas,this.getFrame(),false,true);
    return true;
  }
  advance(dt){
    const a=this.actor;if(!a)return;
    if(this.effect){this.effect.elapsed+=dt;if(this.effect.elapsed>=this.effect.duration){this.effect=null;this.status(a.mode);}}
    a.elapsed+=dt;
    if(a.segment){
      const s=a.segment,t=clamp(a.elapsed/s.duration,0,1);
      const travel=t<.1?t*t/.2:t>.9?.9-(1-t)**2/.2:t-.05,p=clamp(travel/.9,0,1);
      const before={x:a.x,y:a.y};a.x=lerp(s.start.x,s.end.x,p);a.y=lerp(s.start.y,s.end.y,p);
      if(this.isTurtle)a.y+=Math.sin(p*Math.PI)*-28;
      const blend=1-Math.exp(-dt*7);a.facing=lerp(a.facing,a.targetFacing,blend);a.angle=lerp(a.angle,a.targetAngle,blend);a.posture=lerp(a.posture,0,blend);
      a.phase+=this.isTurtle?dt*3.2:length(before,a)*.054;
      if(t>=1){a.x=s.end.x;a.y=s.end.y;a.node=s.endId;this.arrive();}
      return;
    }
    const p=clamp(a.elapsed/a.duration,0,1),blend=1-Math.exp(-dt*5);
    a.angle=lerp(a.angle,a.mode==='surface'?-.67:0,blend);
    if(a.mode==='surface'&&a.elapsed>.8)this.report('surface');
    if(this.isTurtle)a.phase+=dt*(a.mode==='surface'?1.6:.8);
    if(a.mode==='settle')a.posture=smooth(p);else if(a.mode==='rise')a.posture=1-smooth(p);
    if(a.elapsed<a.duration)return;
    if(a.mode==='settle'){
      const mode=a.usingFacility?(this.isTurtle?'ledge-rest':'shelter-rest'):'curled-rest';
      this.action(mode,7+this.random()*3);this.report(mode,a.usingFacility);
    }else if(['shelter-rest','curled-rest','ledge-rest'].includes(a.mode))this.action('rise',1.5);
    else if(a.mode==='rise'){
      a.usingFacility=null;this.go(this.isTurtle?'reef':'moss');
    }else this.chooseGoal();
  }
  getFrame(){return{species:this.species,time:this.time,actor:copy(this.actor),layout:copy(this.layout),layoutVersion:this.layoutVersion,camera:copy(this.camera),preview:copy(this.preview),effect:copy(this.effect)};}
  snapshot(){
    const a=this.actor;return{species:this.species,name:names[this.species],time:Number(this.time.toFixed(3)),mode:a.mode,position:{x:Number(a.x.toFixed(2)),y:Number(a.y.toFixed(2))},node:a.node,goal:a.goal,facing:Number(a.facing.toFixed(3)),angle:Number(a.angle.toFixed(3)),posture:Number(a.posture.toFixed(3)),gaitPhase:Number(a.phase.toFixed(3)),usingFacility:a.usingFacility,layoutVersion:this.layoutVersion,layout:copy(this.layout),pendingVersion:this.targetState?.layoutVersion>this.layoutVersion?this.targetState.layoutVersion:null,camera:copy(this.camera),paused:this.paused,interaction:this.effect?.kind||null};
  }
  capture({watermark=true}={}){const target=canvas();this.paint(target,this.getFrame(),watermark,false);return target;}
  paint(target,frame,watermark=false,preview=false){
    if(!frame.actor)return;
    const ctx=target.getContext('2d'),w=target.width,h=target.height,turtle=frame.species==='sea-turtle';
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);ctx.save();ctx.translate(w/2,h/2);ctx.scale(w/W*frame.camera.zoom,h/H*frame.camera.zoom);ctx.translate(-frame.camera.x,-frame.camera.y);
    ctx.drawImage(this.background,0,0);this.drawAmbient(ctx,frame);
    if(frame.layout.platform)this.drawFacility(ctx,frame.layout.platform,false,frame.species);
    if(turtle)this.drawTurtle(ctx,frame);else this.drawPangolin(ctx,frame);
    this.drawFeedback(ctx,frame);ctx.drawImage(this.foreground,0,0);
    if(preview&&frame.preview)this.drawPreview(ctx,frame.preview,frame.time,frame.species);
    ctx.restore();
    if(watermark){ctx.save();ctx.scale(w/W,h/H);const gradient=ctx.createLinearGradient(0,870,0,1000);gradient.addColorStop(0,'#133e3300');gradient.addColorStop(1,'#113c35df');ctx.fillStyle=gradient;ctx.fillRect(0,870,W,130);ctx.fillStyle='#fff6dd';ctx.font='500 25px sans-serif';ctx.fillText(window.HelpaniI18n.t(turtle?'绿海龟 · 阿潮':'中华穿山甲 · 小松'),48,954);ctx.textAlign='right';ctx.font='21px sans-serif';ctx.fillText(window.HelpaniI18n.t('小镇影像 · 虚拟场景'),1552,954);ctx.restore();}
  }
  drawBackground(ctx){
    const turtle=this.isTurtle,random=rng(turtle?16711:72318);
    const g=ctx.createLinearGradient(0,0,0,H);
    if(turtle){g.addColorStop(0,'#b9d8ca');g.addColorStop(.23,'#d9e4cb');g.addColorStop(.24,'#6cae9f');g.addColorStop(.62,'#327b77');g.addColorStop(1,'#31594c');}
    else{g.addColorStop(0,'#657b74');g.addColorStop(.48,'#a8af86');g.addColorStop(.78,'#768064');g.addColorStop(1,'#475e48');}
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    if(turtle){
      ellipse(ctx,1160,92,43,43,'#f4e9bd');
      shape(ctx,'M0 196Q160 145 360 195T760 180T1160 190T1600 166V245H0Z','#719e8a');
      shape(ctx,'M0 221Q290 179 520 216T1000 211T1600 202V250H0Z','#508c7e');
      for(let i=0;i<15;i++){const x=random()*W;ctx.fillStyle='#dcf0c90b';ctx.beginPath();ctx.moveTo(x,242);ctx.lineTo(x+38,242);ctx.lineTo(x-200,950);ctx.lineTo(x-410,950);ctx.fill();}
      shape(ctx,'M0 843Q300 779 604 834T1130 806T1600 802V1000H0Z','#9fae84');
      shape(ctx,'M0 919Q300 841 635 893T1190 870T1600 891V1000H0Z','#c0bc8c');
      shape(ctx,'M1050 760Q1000 635 1153 595Q1289 554 1400 692L1473 815Z','#42665c');
      shape(ctx,'M1094 747Q1060 659 1163 630Q1263 602 1367 700L1398 767Z','#72917b');
      for(let i=0;i<100;i++){const x=random()*W,y=838+random()*162;ellipse(ctx,x,y,1+random()*3,1+random(),i%2?'#e4d8a788':'#64765755');}
      for(const [x,y,s] of [[210,830,170],[885,875,160],[1430,876,220],[620,906,90]])this.drawSeagrass(ctx,x,y,s,0,false);
      for(let i=0;i<11;i++){const x=50+random()*1450,y=400+random()*380;shape(ctx,`M${x} ${y}q12-8 24 0q-13 9-24 0m0 0-7-6v12Z`,'#97bca044');}
    }else{
      for(let layer=0;layer<3;layer++)for(let i=0;i<20;i++){const x=random()*W,width=8+random()*24;ctx.fillStyle=['#4e6e6340','#345b5148','#244b414d'][layer];shape(ctx,`M${x} 0h${width}l${30+random()*24} 785h${-width-50}Z`,ctx.fillStyle);}
      shape(ctx,'M0 694Q230 601 465 694T936 667T1600 642V1000H0Z','#4d6b51');
      shape(ctx,'M0 788Q330 756 626 799T1179 791T1600 817V1000H0Z','#827b56');
      shape(ctx,'M0 836Q300 794 607 838T1150 828T1600 879V1000H0Z','#a99a6c');
      shape(ctx,'M0 886Q350 832 704 879T1200 866T1600 922V1000H0Z','#8d8b5d');
      shape(ctx,'M274 0Q347 290 322 599Q300 719 213 817L420 821Q380 719 380 606L410 0Z','#425749');
      shape(ctx,'M296 0Q330 289 316 595L287 749L341 683L354 0Z','#5a6952');
      line(ctx,[[321,114],[308,376],[323,611]],'#78836566',5);
      shape(ctx,'M284 740Q390 731 458 824L422 831Q358 785 275 819L188 833Q224 780 284 740Z','#4c5c43');
      shape(ctx,'M1195 0L1235 0L1259 701L1337 817L1260 832L1204 737Z','#5b6c4b');
      for(let i=0;i<95;i++){const x=random()*W,y=790+random()*180;leaf(ctx,x,y,6+random()*15,random()*TAU,i%3?'#c7aa6d88':'#5b754f');}
      for(const [x,y,s]of[[80,885,220],[1410,853,155],[1060,817,130],[470,828,100]])fern(ctx,x,y,s,'#526c49');
      for(let i=0;i<16;i++)leaf(ctx,275+random()*130,600+random()*170,14+random()*18,random()*TAU,'#5d7950');
    }
  }
  drawForeground(ctx){
    if(this.isTurtle){this.drawSeagrass(ctx,95,1030,390,.2,true);this.drawSeagrass(ctx,1440,1040,340,.6,true);this.drawSeagrass(ctx,1050,1065,210,.4,true);shape(ctx,'M0 990Q210 927 325 1000H0Z','#405f48');}
    else{fern(ctx,55,1060,380,'#264d3c');fern(ctx,1505,1015,310,'#31563c');fern(ctx,1325,1020,205,'#436c43');shape(ctx,'M0 998Q180 935 388 1000Zm1600-45Q1460 928 1390 1000H1600Z','#33553d');}
    const vignette=ctx.createRadialGradient(800,500,300,800,500,1000);vignette.addColorStop(0,'#0b2a1a00');vignette.addColorStop(1,'#0a30202b');ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
  }
  drawSeagrass(ctx,x,y,height,time=0,front=false){
    for(let i=-3;i<=3;i++){const sway=Math.sin(time*.6+i*.8)*height*.07,ex=x+i*height*.15+sway,ey=y-height*(1-Math.abs(i)*.12);ctx.beginPath();ctx.moveTo(x+i*8,y);ctx.bezierCurveTo(x+i*20,y-height*.45,ex-height*.1,ey+height*.3,ex,ey);ctx.quadraticCurveTo(ex+18,ey+height*.4,x+i*8+12,y);ctx.fillStyle=front?(i%2?'#355d46':'#48744e'):(i%2?'#508568':'#639a71');ctx.fill();}
  }
  drawAmbient(ctx,frame){
    const t=frame.time;
    if(frame.species==='sea-turtle'){
      for(let i=0;i<18;i++){const x=80+i*83+Math.sin(t*.3+i)*13,y=310+(i*79-t*(5+i%3)+3000)%620;ctx.beginPath();ctx.arc(x,y,1.3+i%3,0,TAU);ctx.strokeStyle='#ccedce2e';ctx.lineWidth=1;ctx.stroke();}
      for(let i=0;i<7;i++){const y=235+Math.sin(t*1.2+i)*3;ctx.beginPath();ctx.moveTo(i*260-60,y);ctx.quadraticCurveTo(i*260+70,y-10,i*260+175,y);ctx.strokeStyle='#d2e5bb77';ctx.lineWidth=3;ctx.stroke();}
      this.drawSeagrass(ctx,855,875,126,t,false);
    }else{
      for(let i=0;i<12;i++){const x=180+(i*117+t*1.8)%1250,y=230+(i*73+Math.sin(t*.4+i)*25)%520;ellipse(ctx,x,y,1.5,1.5,'#efe2ae44');}
      const shaft=ctx.createLinearGradient(1280,10,720,900);shaft.addColorStop(0,'#fce8b100');shaft.addColorStop(.4,'#fce8b114');shaft.addColorStop(1,'#fce8b100');shape(ctx,'M1230 0H1440L900 950H580Z',shaft);
    }
  }
  drawFacility(ctx,slot,ghost=false,species=this.species){
    const p=nodes[species]?.[slot];if(!p)return;
    ctx.save();if(ghost)ctx.globalAlpha=.57;
    if(species==='sea-turtle'){
      const high=slot==='rock-shelf';ellipse(ctx,p.x,p.y+25,170,21,'#294e4044');
      shape(ctx,`M${p.x-145} ${p.y+14}Q${p.x-120} ${p.y-22} ${p.x-75} ${p.y-9}Q${p.x+14} ${p.y-29} ${p.x+132} ${p.y+1}L${p.x+157} ${p.y+70}Q${p.x+10} ${p.y+103} ${p.x-145} ${p.y+61}Z`,high?'#6e8b77':'#80977b','#4c7160',2);
      shape(ctx,`M${p.x-138} ${p.y+11}Q${p.x-62} ${p.y-9} ${p.x+130} ${p.y+2}L${p.x+142} ${p.y+22}Q${p.x+20} ${p.y+46} ${p.x-141} ${p.y+25}Z`,'#a6b48a');
      line(ctx,[[p.x-113,p.y+12],[p.x-42,p.y+5],[p.x+94,p.y+12]],'#d2d0a1',3);
      for(let i=0;i<7;i++)ellipse(ctx,p.x-96+i*31,p.y+44+Math.sin(i)*8,3,2,'#4c765b66');
      if(!high)this.drawSeagrass(ctx,p.x-152,p.y+62,97,0,false);
    }else{
      ellipse(ctx,p.x,p.y+14,163,32,'#514c3444');
      shape(ctx,`M${p.x-145} ${p.y+13}Q${p.x-90} ${p.y-47} ${p.x+22} ${p.y-36}Q${p.x+103} ${p.y-32} ${p.x+147} ${p.y+6}Q${p.x+37} ${p.y+39} ${p.x-145} ${p.y+13}Z`,'#6c6340');
      ellipse(ctx,p.x,p.y-4,129,22,'#b6a16a');
      for(let i=0;i<22;i++){const r=i*2.4;leaf(ctx,p.x+Math.cos(r)*(30+i*4.2),p.y-7+Math.sin(r)*15,17+i%8,r,'#b9a36c');}
      if(slot==='root-den'){
        shape(ctx,`M${p.x-161} ${p.y+5}Q${p.x-175} ${p.y-122} ${p.x-81} ${p.y-135}Q${p.x-20} ${p.y-134} ${p.x+28} ${p.y-98}L${p.x-35} ${p.y-90}Q${p.x-120} ${p.y-102} ${p.x-124} ${p.y+10}Z`,'#596346');
        line(ctx,[[p.x-144,p.y-19],[p.x-140,p.y-77],[p.x-87,p.y-111]],'#86905d',7);
      }
    }
    ctx.restore();
  }
  drawPreview(ctx,preview,time,species=this.species){
    const p=nodes[species]?.[preview.slotId];if(!p)return;
    ctx.save();const start=nodes[species][species==='sea-turtle'?'grass':'moss'];ctx.beginPath();ctx.moveTo(start.x,start.y);ctx.quadraticCurveTo((start.x+p.x)/2,start.y-40,p.x,p.y);ctx.strokeStyle='#f9e4a9';ctx.lineWidth=4;ctx.setLineDash([12,10]);ctx.lineDashOffset=-time*12;ctx.stroke();ctx.setLineDash([]);this.drawFacility(ctx,preview.slotId,true,species);ellipse(ctx,p.x,p.y+10,155,27,'#fce7a52b');ctx.restore();
  }
  drawPangolin(ctx,frame){
    const a=frame.actor,p=clamp(a.posture,0,1),face=clamp(a.facing,-1,1),moving=Boolean(a.segment),t=frame.time;
    const dig=a.mode==='dig',effect=frame.effect?Math.sin(clamp(frame.effect.elapsed/frame.effect.duration,0,1)*Math.PI):0;
    ellipse(ctx,a.x,a.y+7,125-p*35,17,'#243c2d40');
    ctx.save();ctx.translate(a.x,a.y);ctx.rotate(a.angle);ctx.scale(1.03,1.03);
    if(p<.999){
      ctx.save();ctx.globalAlpha=1-p;ctx.scale(face||.0001,1);
      const tailWave=Math.sin(a.phase*.6)*5;
      const tail=shape(ctx,`M-65-62Q-132-59-213 ${-8+tailWave}Q-165 ${-9+tailWave}-99-23L-51-33Z`,'#927746','#5d593c',2);
      ctx.save();ctx.clip(tail);for(let i=0;i<9;i++)line(ctx,[[-84-i*15,-60],[-93-i*15,-29],[-106-i*15,-12]],'#c3a064',2);ctx.restore();ctx.restore();
      const bob=moving?Math.sin(a.phase*2)*1.1:Math.sin(t*1.8)*.6;
      const leg=(front,far)=>{
        const phase=a.phase+(front?0:Math.PI)+(far?Math.PI:0),cycle=((phase/TAU)%1+1)%1;
        const hip=front?51:-52;let fx=hip,fy=(far?-5:0)-bob;
        if(moving){if(cycle<.64)fx+=19*(1-cycle/.64*2);else{const s=(cycle-.64)/.36;fx+=lerp(-19,19,s);fy-=Math.sin(s*Math.PI)*12;}}
        if(dig&&front){fx+=Math.cos(t*6+(far?Math.PI:0))*14+9;fy-=Math.max(0,Math.sin(t*6+(far?Math.PI:0)))*14;}
        const lateral=(far?-1:1)*11*Math.sqrt(Math.max(0,1-face*face)),project=x=>x*face+lateral;
        ctx.save();ctx.globalAlpha=1-p;const hY=-39+bob;
        ctx.beginPath();ctx.moveTo(project(hip),hY);ctx.quadraticCurveTo(project((hip+fx)/2+(front?-8:8)),-21+bob,project(fx),fy-3);ctx.strokeStyle=far?'#6f6240':'#8a774a';ctx.lineWidth=front?17:20;ctx.lineCap='round';ctx.stroke();ellipse(ctx,project(fx+4),fy-3,12,5,far?'#756641':'#9f8957');
        for(let i=0;i<3;i++)line(ctx,[[project(fx+7),fy-3+i*2],[project(fx+17),fy-3+i*2]],'#d6c291',1.7);ctx.restore();
      };
      leg(false,true);leg(true,true);
      ctx.save();ctx.globalAlpha=1-p;ctx.translate(0,bob);ctx.scale(face||.0001,1);
      const coat=ctx.createLinearGradient(0,-100,0,-20);coat.addColorStop(0,'#b29960');coat.addColorStop(.6,'#9d814d');coat.addColorStop(1,'#75613e');
      const back=shape(ctx,'M-83-34Q-100-80-40-99Q15-118 63-76L74-38Q13-11-83-34Z',coat,'#61573c',2);
      ctx.save();ctx.clip(back);
      for(let row=0;row<5;row++)for(let i=0;i<9;i++){const x=-94+i*25+(row%2)*13,y=-107+row*18;shape(ctx,`M${x} ${y}Q${x+13} ${y-5} ${x+27} ${y}Q${x+23} ${y+16} ${x+13} ${y+20}Q${x+3} ${y+15} ${x} ${y}Z`,row%2?'#b59a60':'#a98b52','#6e613e',1.4);line(ctx,[[x+6,y+3],[x+14,y+6],[x+22,y+3]],'#d0b47766',1);}
      ctx.restore();
      const nod=dig?.16+Math.sin(t*6)*.06:Math.sin(t*2)*.018-effect*.06;
      ctx.save();ctx.translate(54,-57);ctx.rotate(nod);
      shape(ctx,'M-11-18Q13-26 34-8L70 8Q76 13 65 17L18 21Q-9 16-15 3Z','#bba36a','#71623d',1.6);
      ellipse(ctx,2,-19,8,11,'#a88e58',-.25);ellipse(ctx,3,-20,4,6,'#786947',-.25);
      const blink=(t%7.5)>7.2?Math.sin((t%7.5-7.2)/.3*Math.PI):0;
      ellipse(ctx,22,-6,3,Math.max(.7,2.8*(1-blink)),'#2c3a2d');ellipse(ctx,21.3,-7,.7,.7,'#f5edd3');ellipse(ctx,69,10,4,3,'#403c2c');line(ctx,[[66,16],[56,18],[44,17]],'#74623e',1);ctx.restore();ctx.restore();
      // During a turn the barrel-like torso retains volume instead of flipping.
      if(Math.abs(face)<.98){ctx.save();ctx.globalAlpha=(1-Math.abs(face))*(1-p);ellipse(ctx,0,-60,47,45,'#9d844f');for(let r=0;r<4;r++)for(let k=-1;k<=1;k++){const x=k*23+(r%2)*11,y=-98+r*20;shape(ctx,`M${x-13} ${y}Q${x} ${y-4} ${x+13} ${y}Q${x+10} ${y+17} ${x} ${y+19}Q${x-10} ${y+17} ${x-13} ${y}Z`,'#b19861','#75613e',1);}ctx.restore();}
      leg(false,false);leg(true,false);
    }
    if(p>.001){
      ctx.save();ctx.globalAlpha=p;
      const curl=shape(ctx,'M-79-16Q-98-56-69-91Q-39-129 20-113Q76-100 86-52Q94-12 50 2Q-19 19-79-16Z','#aa8e57','#665b3b',2);
      ctx.save();ctx.clip(curl);for(let row=0;row<7;row++)for(let k=0;k<8;k++){const x=-100+k*27+(row%2)*13,y=-135+row*21;shape(ctx,`M${x} ${y}Q${x+14} ${y-6} ${x+28} ${y}Q${x+23} ${y+21} ${x+13} ${y+24}Q${x+2} ${y+20} ${x} ${y}Z`,row%2?'#b69a60':'#9f824c','#71603d',1.5);}ctx.restore();shape(ctx,'M66-11Q-7 40-71-14Q-25 8 32-13Q45-23 41-32','#8f7547','#675a3b',2);ctx.restore();
    }
    ctx.restore();
    if(dig){for(let i=0;i<6;i++){const phase=(t*1.9+i/6)%1;ellipse(ctx,a.x+face*(85-phase*34),a.y-Math.sin(phase*Math.PI)*24,3.5*(1-phase),2.4*(1-phase),'#b69b60');}}
  }
  drawTurtle(ctx,frame){
    const a=frame.actor,t=frame.time,face=clamp(a.facing,-1,1),moving=Boolean(a.segment),rest=clamp(a.posture,0,1),effect=frame.effect?Math.sin(clamp(frame.effect.elapsed/frame.effect.duration,0,1)*Math.PI):0;
    const bob=moving?Math.sin(a.phase)*3:Math.sin(t*.8)*1.3;
    if(a.y>670)ellipse(ctx,a.x+18,a.y+14,132,18,'#244e3e38');
    ctx.save();ctx.translate(a.x,a.y+bob);ctx.rotate(a.angle);ctx.scale(face||.0001,1);
    const stroke=Math.sin(a.phase)*(1-rest*.75),flap=stroke*27;
    shape(ctx,`M-78-74Q-131 ${-122-flap*.3}-148-90Q-127-54-80-44Z`,'#5b7b57','#3e5d43',2);
    const surfaceFin=a.mode==='surface'?70:0;
    shape(ctx,`M40-94Q75 ${-157-flap+surfaceFin} 136 ${-134-flap+surfaceFin}Q151 ${-128-flap+surfaceFin} 138 ${-111+surfaceFin}Q106-73 57-52Z`,'#68845a','#405d42',2);
    shape(ctx,'M-103-51Q-153-52-161-35Q-133-31-105-28Z','#6c8359','#415e43',2);
    shape(ctx,'M77-75Q115-102 150-82Q178-70 171-48Q163-22 127-29L75-40Z','#92a46c','#4e6b49',2);
    for(let i=0;i<5;i++)shape(ctx,`M${119+i%2*14} ${-86+Math.floor(i/2)*16}q6-4 12 2l-3 9-10-2Z`,'#abbb8066');
    const blink=t%8>7.7?Math.sin((t%8-7.7)/.3*Math.PI):0;
    ellipse(ctx,151,-65-effect*2,4,Math.max(.9,3.6*(1-blink)),'#203b31');ellipse(ctx,150,-66.2,1,1,'#e8f0cc');ellipse(ctx,171,-54,2,1.6,'#3e5941');line(ctx,[[170,-43],[158,-39],[145,-41]],'#50633f',1.4);
    const shellGradient=ctx.createLinearGradient(-80,-125,80,-20);shellGradient.addColorStop(0,'#a8ad76');shellGradient.addColorStop(.5,'#8a965e');shellGradient.addColorStop(1,'#536e47');
    const shell=shape(ctx,'M-112-56Q-122-103-70-127Q-16-154 52-122Q107-99 105-54Q105-17 40-6Q-58 13-103-22Q-114-34-112-56Z',shellGradient,'#344e3c',3);
    ctx.save();ctx.clip(shell);
    shape(ctx,'M-68-124L-30-137L0-120L5-90L-18-69L-60-81Z','#8e9b67','#506244',2);
    shape(ctx,'M0-120L39-129L74-105L62-77L21-71L5-90Z','#9ba66d','#506244',2);
    shape(ctx,'M-60-81L-18-69L-14-30L-51-10L-93-31L-94-63Z','#9ba66d','#506244',2);
    shape(ctx,'M-18-69L21-71L57-40L36-7L-14-5L-14-30Z','#89975d','#506244',2);
    shape(ctx,'M62-77L105-75L110-42L73-16L57-40L21-71Z','#7b8d55','#506244',2);
    for(let i=0;i<12;i++){const x=-106+i*19;line(ctx,[[x,-14],[x+5,-31]],'#4e663f',1.4);}ctx.restore();
    ctx.beginPath();ctx.ellipse(-4,-65,107,68,-.1,0,TAU);ctx.strokeStyle='#c4c18c88';ctx.lineWidth=3;ctx.stroke();
    shape(ctx,`M-73-32Q-118 ${11+flap*.4}-143 6Q-153-1-139-10Q-120-36-93-52Z`,'#819561','#3f5c41',2);
    shape(ctx,`M57-48Q95 ${-15+flap} 118 ${27+flap}Q124 ${49+flap} 104 ${46+flap}Q60 ${42+flap} 28-17Z`,'#859b65','#405f45',2);
    for(let i=0;i<4;i++)line(ctx,[[58+i*9,-17+i*7],[81+i*8,12+i*5+flap*.5]],'#b7bf8366',1.4);
    ctx.restore();
    if(Math.abs(face)<.95){ctx.save();ctx.translate(a.x,a.y+bob);ctx.rotate(a.angle);ctx.globalAlpha=1-Math.abs(face);ellipse(ctx,0,-65,68,69,'#889a64');ellipse(ctx,0,-104,27,24,'#a2b47c');ellipse(ctx,-13,-107,3,3,'#254133');ellipse(ctx,13,-107,3,3,'#254133');ctx.restore();}
    if(a.mode==='surface'){
      const s=Math.sin(t*2)*3;ctx.beginPath();ctx.ellipse(a.x+120*face,235,68+s,7+s*.2,0,0,TAU);ctx.strokeStyle='#dce8b699';ctx.lineWidth=2;ctx.stroke();
    }
  }
  drawFeedback(ctx,frame){
    if(frame.species==='sea-turtle'&&frame.actor.mode==='swim'){const a=frame.actor;for(let i=0;i<3;i++){const p=((frame.time*.8+i*.3)%1);ctx.beginPath();ctx.arc(a.x-a.facing*(120+p*42),a.y-48-p*20,2+p*3,0,TAU);ctx.strokeStyle=`rgba(205,230,199,${.4*(1-p)})`;ctx.lineWidth=1;ctx.stroke();}}
    if(!frame.effect)return;
    const a=frame.actor,p=clamp(frame.effect.elapsed/frame.effect.duration,0,1),fade=Math.sin(p*Math.PI);
    ctx.save();ctx.globalAlpha=fade;ctx.translate(a.x,a.y-160-p*35);
    if(frame.effect.kind==='touch')shape(ctx,'M0 7C-25-9-18-27-5-20L0-15L5-20C18-27 25-9 0 7Z','#ead4a0','#f9eed0',1.3);
    else{for(let i=0;i<5;i++){const angle=i*TAU/5;leaf(ctx,Math.cos(angle)*24,Math.sin(angle)*16,9,angle,'#e1ce95');}}
    ctx.restore();
  }
}
