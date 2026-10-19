(() => {
  'use strict';
  const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);
  const play = document.querySelector('.play'), caption=document.querySelector('.caption'), hint = $('hint'), score = $('score');
  const actions = document.querySelector('.result-actions');
  const reduced = matchMedia(window.beijianDevice.reducedQuery).matches;
  const desktopLayout = matchMedia('(min-width:801px)');
  const W = 240, H = 480, L = 60, PX = 16, PY = 18, PW = 272, PH = 520;
  const projection = window.STELE_RENDER_DATA?.projection;
  const depth = window.STELE_RENDER_DATA?.depth;
  const PAPER_SCALE = 2;
  const project = (x,y) => ({x:projection.a*x+projection.c*y,y:projection.b*x+projection.d*y});
  const makeCanvas = (w, h) => Object.assign(document.createElement('canvas'), {width:w,height:h});
  const maskCanvas = makeCanvas(PW*PAPER_SCALE, PH*PAPER_SCALE), maskCtx = maskCanvas.getContext('2d');
  const ink = makeCanvas(PW*PAPER_SCALE, PH*PAPER_SCALE), inkCtx = ink.getContext('2d');
  const inkView = makeCanvas(PW*PAPER_SCALE, PH*PAPER_SCALE), inkViewCtx = inkView.getContext('2d');
  const paper = makeCanvas(PW*PAPER_SCALE, PH*PAPER_SCALE), paperCtx = paper.getContext('2d');
  const stoneImpression=makeCanvas(W*2,H*2),impressionCtx=stoneImpression.getContext('2d');
  [maskCtx,inkCtx,inkViewCtx,paperCtx].forEach(c=>c.scale(PAPER_SCALE,PAPER_SCALE));
  const paperPath = new Path2D();
  paperPath.moveTo(2,2);
  for(let x=2;x<=PW-2;x+=6)paperPath.lineTo(x,2+.4*Math.sin(x*.23)+.25*Math.sin(x*.91));
  for(let y=2;y<=PH-2;y+=6)paperPath.lineTo(PW-2+.5*Math.sin(y*.15)+.3*Math.sin(y*.77),y);
  for(let x=PW-2;x>=2;x-=6)paperPath.lineTo(x,PH-2+.45*Math.sin(x*.17)+.3*Math.sin(x*.61));
  for(let y=PH-2;y>=2;y-=6)paperPath.lineTo(1.5+.4*Math.sin(y*.19)+.3*Math.sin(y*.83),y);
  paperPath.closePath();
  let seed = 8143;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  function buildPaper(texture){
    paperCtx.clearRect(0,0,PW,PH);paperCtx.save();paperCtx.clip(paperPath);
    paperCtx.fillStyle='#e0dcd0';paperCtx.fillRect(0,0,PW,PH);
    if(texture)paperCtx.drawImage(texture,0,0,PW,PH);
    const paperLight=paperCtx.createLinearGradient(0,0,PW,PH);
    paperLight.addColorStop(0,'rgba(255,253,242,.08)');paperLight.addColorStop(.6,'rgba(112,102,79,.025)');paperLight.addColorStop(1,'rgba(250,246,232,.05)');
    paperCtx.fillStyle=paperLight;paperCtx.fillRect(0,0,PW,PH);
    for(let i=0;i<2400;i++){
      const x=random()*PW,y=random()*PH;
      paperCtx.strokeStyle=`rgba(${random()>.4?'93,83,62':'255,255,246'},${.015+random()*.025})`;paperCtx.lineWidth=.28;
      paperCtx.beginPath();paperCtx.moveTo(x,y);paperCtx.lineTo(x+.2+random()*.8,y+.6+random()*2.6);paperCtx.stroke();
    }
    paperCtx.restore();paperCtx.save();paperCtx.strokeStyle='rgba(255,253,235,.3)';paperCtx.lineWidth=.45;paperCtx.stroke(paperPath);
    for(let i=0;i<210;i++){
      const side=i%2,y=3+random()*(PH-6),x=side?PW-2:1.5,length=.3+random()*1.25;
      paperCtx.strokeStyle=`rgba(241,237,224,${.16+random()*.27})`;paperCtx.lineWidth=.16+random()*.2;
      paperCtx.beginPath();paperCtx.moveTo(x,y);paperCtx.lineTo(x+(side?1:-1)*length,y+(random()-.5)*1.1);paperCtx.stroke();
    }
    paperCtx.restore();
  }
  buildPaper();
  $('paper-texture').src=window.XUAN_PAPER_SRC;
  const paperReady=$('paper-texture').decode().then(()=>buildPaper($('paper-texture'))).catch(()=>{});
  let dryInkMask=null;
  const dryInkTexture=new Image();
  const inkMaterialReady=window.DRY_INK_SRC?(()=>{
    dryInkTexture.src=window.DRY_INK_SRC;
    return dryInkTexture.decode().then(()=>{
      dryInkMask=makeCanvas(W*2,H*2);const c=dryInkMask.getContext('2d');c.drawImage(dryInkTexture,0,0,W*2,H*2);
      const pixels=c.getImageData(0,0,W*2,H*2);
      for(let i=0;i<pixels.data.length;i+=4){
        const light=.2126*pixels.data[i]+.7152*pixels.data[i+1]+.0722*pixels.data[i+2];
        pixels.data[i+3]=Math.max(0,255-Math.max(0,light-38)*1.13);pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=0;
      }
      c.putImageData(pixels,0,0);
    }).catch(()=>{dryInkMask=null;});
  })():Promise.resolve();
  let phase='loading', phaseTime=0, round=0, art, layers=[], moving, drop, debris=[];
  let streak=0, best=0, misses=0, messageTime=0,stoneDust=[],captionAnimations=[];
  let pointer=null, lastBrush=null, keyHeld=false, keyTime=0, readyToPeel=false, inkDirty=true;
  let cells=[], covered=0, camera={x:0,y:0,s:1}, previous=0, frame=0;
  try { best = Math.max(0, Math.min(999, Number(localStorage.getItem('beijian-rubbing-best'))||0)); } catch (_) {}
  const designIds=['beijian','shanchuanji','shanchuan','songfengji','fenggu','shanchuanji','changle','songfengji'];
  const designs=designIds.map(id=>window.STELE_DESIGNS.find(d=>d.id===id)).filter(Boolean);
  const numerals=['一','二','三','四','五','六','七','八'];
  let roundRequest=0;
  const currentDesign=()=>designs[round%designs.length];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const ease=t=>1-Math.pow(1-t,3);
  const feedback=kind=>window.beijianFeedback?.play(kind);
  const dustTexture=makeCanvas(64,40),dustCtx=dustTexture.getContext('2d');
  for(let i=0;i<8;i++){
    const x=13+random()*38,y=12+random()*16,r=7+random()*11;
    const cloud=dustCtx.createRadialGradient(x,y,0,x,y,r);
    cloud.addColorStop(0,'rgba(196,187,171,.32)');cloud.addColorStop(1,'rgba(196,187,171,0)');
    dustCtx.fillStyle=cloud;dustCtx.fillRect(0,0,64,40);
  }
  function emitStoneDust(layer){
    if(reduced)return;
    for(const direction of [-1,1]){
      const edge=project(layer.x+(direction===1?layer.width:0),layer.y+L);
      stoneDust.push({x:edge.x,y:edge.y,direction,age:0,cloud:true,scale:1});
      stoneDust.push({x:edge.x+direction*5,y:edge.y-4,direction,age:-.05,cloud:true,scale:.65});
      for(let i=0;i<16;i++)stoneDust.push({x:edge.x,y:edge.y,direction,age:0,vx:direction*(10+random()*42),vy:-8-random()*22,size:.7+random()*1.05});
    }
  }
  function drawStoneDust(){
    ctx.save();
    for(const dust of stoneDust){
      if(dust.age<0)continue;
      const t=clamp(dust.age/.8,0,1);
      if(dust.cloud){
        const width=(24+t*90)*dust.scale,height=(14+t*38)*dust.scale;
        ctx.globalAlpha=(1-Math.exp(-t*22))*Math.pow(1-t,1.4)*(dust.scale===1?1:.75);
        ctx.drawImage(dustTexture,dust.x+dust.direction*(5+t*30)-width/2,dust.y-2-t*17-height/2,width,height);
      }else{
        ctx.globalAlpha=(1-t)*(1-t)*.85;ctx.fillStyle='#c7bda8';
        ctx.fillRect(dust.x+dust.vx*dust.age,dust.y+dust.vy*dust.age+28*dust.age*dust.age,dust.size,dust.size*.8);
      }
    }
    ctx.restore();
  }
  const stackHint=()=> '轻点落石，叠一方碑。';
  function updateCombo(){
    $('best').textContent=streak;
    $('combo').setAttribute('aria-label',`连续连齐${streak}层，最佳${best}层。`);
  }
  function say(text,accent=false){
    captionAnimations.forEach(animation=>animation.cancel());captionAnimations=[];
    hint.dataset.perfect='false';hint.removeAttribute('aria-label');messageTime=0;
    hint.textContent=text;hint.dataset.accent=String(accent);
  }
  function showPerfectCaption(){
    const label=streak>1?`严丝合缝 · 连齐 ${streak}`:'严丝合缝';
    say(label,true);hint.textContent='';hint.setAttribute('aria-label',label);
    hint.dataset.perfect='true';messageTime=1.5;
    const word=document.createElement('span');word.className='perfect-word';
    for(const [i,character]of [...'严丝合缝'].entries()){
      const glyph=document.createElement('span');glyph.className='perfect-character';glyph.textContent=character;word.append(glyph);
      if(!reduced)captionAnimations.push(glyph.animate([
        {opacity:0,clipPath:'inset(0 0 100% 0)',transform:'translateY(9px) scale(1.24)',filter:'blur(2px)',color:'#fff3c9',textShadow:'0 0 16px #e7ce94'},
        {opacity:1,clipPath:'inset(-16px -10px)',transform:'translateY(-3px) scale(1.08)',filter:'blur(0)',color:'#fff3c9',textShadow:'0 0 9px #e7ce9490',offset:.25},
        {opacity:1,clipPath:'inset(-16px -10px)',transform:'translateY(1px) scale(.98)',filter:'blur(0)',color:'#e8ce95',textShadow:'0 0 3px #e7ce9435',offset:.5},
        {opacity:1,clipPath:'inset(-16px -10px)',transform:'translateY(0) scale(1)',filter:'blur(0)',color:'#e0c58d',textShadow:'0 0 0 transparent'}
      ],{duration:720,delay:i*60,fill:'backwards',easing:'cubic-bezier(.2,.65,.25,1)'}));
    }
    hint.append(word);
    if(streak>1){
      const count=document.createElement('span');count.className='perfect-count';count.textContent=`连齐 ${streak}`;hint.append(count);
      if(!reduced)captionAnimations.push(count.animate([{opacity:0,transform:'translateY(3px)'},{opacity:1,transform:'translateY(0)'}],{duration:300,delay:340,fill:'backwards'}));
    }
  }
  function setPhase(value){phase=value;phaseTime=0;play.dataset.phase=value;if(value==='covering'||value==='peeling')feedback('paper');}
  function updateScore(){score.textContent=String(layers.length).padStart(2,'0');$('score-unit').textContent=' / 08 层';}
  function newMoving(){
    const top=layers[layers.length-1];
    moving={x:top.x-228,y:H-(layers.length+1)*L-30,width:top.width,direction:1};
    // Each slice keeps the stone's inscription coordinates as it moves.
    moving.uvX=top.x;
  }
  async function startRound(){
    const design=currentDesign();
    const request=++roundRequest;
    setPhase('loading');actions.hidden=true;say('石上片刻，纸上千年。');
    try{
      const [loaded]=await Promise.all([window.loadSteleArt(design),paperReady,inkMaterialReady]);
      if(request!==roundRequest)return;
      art=loaded;
    }catch(error){say('石碑图像暂未载入，请重新打开试玩文件。');return;}
    layers=[{x:0,width:W,index:0},{x:0,width:W,index:1}];
    streak=0;misses=0;stoneDust=[];debris=[];pointer=null;lastBrush=null;keyHeld=false;readyToPeel=false;
    actions.hidden=true;maskCtx.clearRect(0,0,PW,PH);inkDirty=true;
    $('edition').textContent=`${numerals[round%designs.length]} · ${design.label}`;
    updateScore();updateCombo();newMoving();setPhase('stack');positionCamera(1);say(stackHint());
    window.loadSteleArt(designs[(round+1)%designs.length]).catch(()=>{});
  }
  function dropStone(){
    if(phase!=='stack')return;
    const top=layers[layers.length-1], delta=moving.x-top.x;
    const overlap=Math.min(moving.x+moving.width,top.x+top.width)-Math.max(moving.x,top.x);
    const perfect=Math.abs(delta)<10;
    if(overlap<top.width*.5){
      misses++;streak=0;updateCombo();drop={from:{...moving},to:{x:moving.x+delta*.1,y:H+100},failed:true};
      say('再轻一点，这一层重来。');setPhase('dropping');return;
    }
    let left=top.x,right=top.x+top.width;
    if(perfect){
      streak++;
      if(streak>best){best=streak;try{localStorage.setItem('beijian-rubbing-best',best);}catch(_){}}
    }else{
      streak=0;
      if(delta>0)left=Math.min(28,left+delta);else right=Math.max(W-28,right+delta);
      say('轻点落石，叠一方碑。');
      const cutWidth=Math.min(Math.abs(delta),55);
      debris.push({x:delta>0?right:moving.x,y:H-(layers.length+1)*L,width:cutWidth,age:0,vx:delta>0?28:-28});
    }
    updateCombo();drop={from:{...moving},to:{x:left,y:H-(layers.length+1)*L,width:right-left,index:layers.length},failed:false,perfect};
    setPhase('dropping');
  }
  function prepareRubbing(){
    inkCtx.clearRect(0,0,PW,PH);inkCtx.fillStyle='#191c1b';
    layers.forEach(l=>inkCtx.fill(stoneOutline(PX+l.x,PY+H-(l.index+1)*L,l.width,l.index)));
    // Unproject the actual stone surface: its grain continues into the ink impression.
    impressionCtx.setTransform(1,0,0,1,0,0);impressionCtx.clearRect(0,0,W*2,H*2);
    const det=projection.a*projection.d-projection.b*projection.c;
    impressionCtx.setTransform(2*projection.d/det,-2*projection.b/det,-2*projection.c/det,2*projection.a/det,0,0);
    art.tiles.forEach(sprite=>impressionCtx.drawImage(sprite.image,sprite.x,sprite.y,sprite.width,sprite.height));
    impressionCtx.setTransform(1,0,0,1,0,0);
    const surface=impressionCtx.getImageData(0,0,W*2,H*2);
    for(let i=0;i<surface.data.length;i+=4){
      const light=.2126*surface.data[i]+.7152*surface.data[i+1]+.0722*surface.data[i+2];
      const tone=clamp(25+(light-80)*.16,17,40);
      surface.data[i]=tone;surface.data[i+1]=tone+2;surface.data[i+2]=tone+1;
    }
    impressionCtx.putImageData(surface,0,0);
    inkCtx.save();inkCtx.globalCompositeOperation='source-atop';inkCtx.drawImage(stoneImpression,PX,PY,W,H);inkCtx.restore();
    if(dryInkMask){inkCtx.save();inkCtx.globalCompositeOperation='destination-in';inkCtx.drawImage(dryInkMask,PX,PY,W,H);inkCtx.restore();}
    inkCtx.save();inkCtx.globalCompositeOperation='destination-out';inkCtx.drawImage(art.glyphMask,PX,PY,W,H);
    // The paper catches at a cut's lip: a sparse fibrous fringe, less than half a logical pixel.
    const glyph=art.glyphMask.getContext('2d').getImageData(0,0,W*2,H*2).data;
    inkCtx.fillStyle='rgba(0,0,0,.38)';
    for(let y=1;y<H*2-1;y++)for(let x=1;x<W*2-1;x++){
      const i=(y*W*2+x)*4+3;
      if(glyph[i]>240&&(glyph[i-4]<20||glyph[i+4]<20||glyph[i-W*8]<20||glyph[i+W*8]<20)&&random()<.27){
        inkCtx.fillRect(PX+x/2-.18,PY+y/2-.14,.25+random()*.5,.22+random()*.5);
      }
    }
    inkCtx.restore();
    // Fine stone joints and dry specks also transfer to the paper.
    inkCtx.save();inkCtx.globalCompositeOperation='destination-out';
    inkCtx.fillStyle='rgba(0,0,0,.10)';
    layers.forEach(l=>{if(l.index)for(let x=l.x+random()*9;x<l.x+l.width;x+=9+random()*14){
      inkCtx.fillRect(PX+x,PY+H-l.index*L-.1,Math.min(3+random()*12,l.x+l.width-x),.24);
    }});
    for(let i=0;i<(dryInkMask?1000:4700);i++){
      inkCtx.globalAlpha=.35+random()*.6;inkCtx.fillRect(PX+random()*W,PY+random()*H,random()*.65+.15,random()*.95+.2);
    }
    for(let i=0;i<1600;i++){
      const x=PX+random()*W,y=PY+random()*H;
      inkCtx.globalAlpha=.15+random()*.4;inkCtx.lineWidth=.18+random()*.25;
      inkCtx.beginPath();inkCtx.moveTo(x,y);inkCtx.quadraticCurveTo(x+.3,y+.8,x+(random()-.5)*1.1,y+.5+random()*1.6);inkCtx.strokeStyle='#000';inkCtx.stroke();
    }
    inkCtx.restore();
    if(art.topProfile?.length){
      // The print follows the same broken top edge as the rendered stone.
      inkCtx.save();inkCtx.globalCompositeOperation='destination-out';inkCtx.fillStyle='#000';
      inkCtx.beginPath();inkCtx.moveTo(PX,PY-1);inkCtx.lineTo(PX+W,PY-1);
      inkCtx.lineTo(PX+W,PY+art.topProfile[art.topProfile.length-1][1]);
      for(let i=art.topProfile.length-1;i>=0;i--){const [x,y]=art.topProfile[i];inkCtx.lineTo(PX+x,PY+y);}
      inkCtx.lineTo(PX,PY+art.topProfile[0][1]);inkCtx.closePath();inkCtx.fill();inkCtx.restore();
    }
    maskCtx.clearRect(0,0,PW,PH);covered=0;cells=[];
    for(let y=PY+8;y<PY+H;y+=12)for(let x=PX+8;x<PX+W;x+=12){
      const layer=layers[clamp(Math.floor((H-(y-PY))/L),0,7)];
      if(x-PX>layer.x&&x-PX<layer.x+layer.width)cells.push({x,y,hit:false});
    }
    inkDirty=true;readyToPeel=false;
  }
  function brushPoint(p){
    if(phase!=='rubbing')return;
    const previousPoint=lastBrush||p,dist=Math.hypot(p.x-previousPoint.x,p.y-previousPoint.y);
    const count=Math.max(1,Math.ceil(dist/8));
    for(let j=1;j<=count;j++){
      const x=previousPoint.x+(p.x-previousPoint.x)*j/count,y=previousPoint.y+(p.y-previousPoint.y)*j/count;
      const g=maskCtx.createRadialGradient(x,y,6,x,y,42);
      g.addColorStop(0,'rgba(0,0,0,.96)');g.addColorStop(.65,'rgba(0,0,0,.88)');g.addColorStop(1,'rgba(0,0,0,0)');
      maskCtx.fillStyle=g;maskCtx.fillRect(x-42,y-42,84,84);
      for(const cell of cells)if(!cell.hit&&(x-cell.x)**2+(y-cell.y)**2<1024){cell.hit=true;covered++;}
    }
    lastBrush=p;inkDirty=true;
    if(dist>3)feedback('rub');
    const progress=covered/cells.length;
    score.textContent=String(Math.min(100,Math.round(progress*100))).padStart(2,'0');$('score-unit').textContent=' % 显墨';
    if(progress>=.86&&!readyToPeel){readyToPeel=true;say('墨已显，松手揭纸。',true);}
  }
  function finishRubbing(){
    lastBrush=null;pointer=null;keyHeld=false;
    if(phase==='rubbing'&&readyToPeel){
      // Finish the tiny dry gaps after lifting, so every collected inscription is complete.
      maskCtx.fillStyle='#000';maskCtx.fillRect(0,0,PW,PH);inkDirty=true;
      setPhase('peeling');say('一纸留痕。');
    }
  }
  function paperTransform(){
    const p=phase==='peeling'?ease(clamp(phaseTime/(reduced?.3:1.05),0,1)):phase==='result'?1:0;
    return {x:-PX+p*7,y:-PY-p*17,angle:-.012*p,scale:1+p*.025};
  }
  function localPoint(event){
    const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)*canvas.width/rect.width,y=(event.clientY-rect.top)*canvas.height/rect.height;
    const sx=(x-camera.x)/camera.s,sy=(y-camera.y)/camera.s;
    const determinant=projection.a*projection.d-projection.b*projection.c;
    const lx=(projection.d*sx-projection.c*sy)/determinant,ly=(-projection.b*sx+projection.a*sy)/determinant;
    const t=paperTransform(),dx=lx-t.x,dy=ly-t.y;
    return{x:(dx*Math.cos(t.angle)+dy*Math.sin(t.angle))/t.scale,y:(-dx*Math.sin(t.angle)+dy*Math.cos(t.angle))/t.scale};
  }
  canvas.addEventListener('pointerdown',event=>{
    if(!event.isPrimary||event.button>0||pointer!==null)return;
    event.preventDefault();canvas.focus({preventScroll:true});
    if(phase==='stack'){dropStone();return;}
    if(phase==='result'){round++;startRound();return;}
    if(phase==='rubbing'){pointer=event.pointerId;canvas.setPointerCapture(pointer);lastBrush=null;brushPoint(localPoint(event));}
  });
  canvas.addEventListener('pointermove',event=>{if(event.pointerId===pointer)brushPoint(localPoint(event));});
  canvas.addEventListener('pointerup',event=>{if(event.pointerId===pointer)finishRubbing();});
  canvas.addEventListener('pointercancel',event=>{if(event.pointerId===pointer)finishRubbing();});
  canvas.addEventListener('lostpointercapture',event=>{if(event.pointerId===pointer)finishRubbing();});
  canvas.addEventListener('keydown',event=>{
    if(event.code!=='Space'&&event.code!=='Enter')return;event.preventDefault();
    if(event.repeat)return;
    if(phase==='stack')dropStone();
    else if(phase==='result'){round++;startRound();}
    else if(phase==='rubbing'){keyHeld=true;keyTime=0;lastBrush=null;}
  });
  canvas.addEventListener('keyup',event=>{if(event.code==='Space'||event.code==='Enter'){event.preventDefault();finishRubbing();}});
  window.addEventListener('blur',finishRubbing);
  $('next').addEventListener('click',()=>{round++;startRound();canvas.focus({preventScroll:true});});
  $('save').addEventListener('click',()=>{
    const output=makeCanvas(PW*4,PH*4),c=output.getContext('2d');
    const print=makeCanvas(PW*4,PH*4),pc=print.getContext('2d');
    pc.scale(4,4);pc.drawImage(ink,0,0,PW,PH);
    // Recut the original outlines at export resolution to keep the white strokes crisp.
    pc.globalCompositeOperation='destination-out';pc.fillStyle='#000';
    const design=currentDesign();
    if(art.maskSource)pc.drawImage(art.maskSource,PX,PY,W,H);
    else{
      const glyphs=design.layout||design.paths.map((path,i)=>({path,x:15,y:i?245:24,size:210}));
      glyphs.forEach(glyph=>{
        pc.save();pc.translate(PX+glyph.x,PY+glyph.y);pc.scale(glyph.size/500,glyph.size/500);pc.fill(new Path2D(glyph.path));pc.restore();
      });
    }
    c.scale(4,4);c.drawImage(paper,0,0,PW,PH);c.drawImage(print,0,0,PW,PH);
    const a=document.createElement('a');a.download=`碑间·${design.label}·拓片.png`;a.href=output.toDataURL('image/png');a.click();
    say('拓片已留存，轻点再叠一方。');
  });
  function stoneOutline(x,y,width,index){
    const chip=index===2?2.7:index===6?1.6:.3;
    return new Path2D(`M${x+.5} ${y} L${x+width-.4} ${y+.1} L${x+width} ${y+19} L${x+width-chip} ${y+21} L${x+width-.2} ${y+24} L${x+width-.5} ${y+L} L${x+.3} ${y+L} L${x} ${y+L-2} L${x+.25} ${y+2} Z`);
  }
  function drawSprite(sprite,x,y){
    ctx.drawImage(sprite.image,sprite.x+x,sprite.y+y,sprite.width,sprite.height);
  }
  function clipPolygon(points){
    ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.clip();
  }
  function stoneSlice(x,y,width,index,uvX=x,alpha=1){
    const sprite=art.tiles[index];
    const anchor=project(x-uvX,y);
    ctx.save();ctx.globalAlpha*=alpha;
    if(width>=W-.001&&Math.abs(uvX)<.001){
      drawSprite(sprite,anchor.x,anchor.y);
    }else{
      const tl=project(x,y),tr=project(x+width,y),bl=project(x,y+L),br=project(x+width,y+L);
      const back=p=>({x:p.x+depth.x,y:p.y+depth.y});
      // The same photographed light and carved surface survive a trim: only geometry is clipped.
      ctx.save();clipPolygon([tl,tr,br,bl]);drawSprite(sprite,anchor.x,anchor.y);ctx.restore();
      ctx.save();clipPolygon([tl,back(tl),back(tr),tr]);drawSprite(sprite,anchor.x,anchor.y);ctx.restore();
      const sideAnchor=project(x+width-W,y);
      ctx.save();clipPolygon([tr,back(tr),back(br),br]);drawSprite(sprite,sideAnchor.x,sideAnchor.y);ctx.restore();
    }
    ctx.restore();
  }
  function drawBase(){drawSprite(art.base,0,0);}
  function drawPaper(){
    const t=paperTransform();
    let cover=phase==='covering'?ease(clamp(phaseTime/(reduced?.25:1.1),0,1)):1;
    const lift=phase==='peeling'?ease(clamp(phaseTime/(reduced?.3:1.05),0,1)):phase==='result'?1:0;
    ctx.save();ctx.transform(projection.a,projection.b,projection.c,projection.d,0,0);
    ctx.translate(t.x,t.y-(1-cover)*150);ctx.rotate(t.angle+(1-cover)*-.045);ctx.scale(t.scale, t.scale*(.88+.12*cover));
    ctx.shadowColor='rgba(0,0,0,.52)';ctx.shadowBlur=5+(1-cover)*22+lift*14;ctx.shadowOffsetX=1.4+lift*4;ctx.shadowOffsetY=2.5+lift*7;
    ctx.save();ctx.translate(.5,.7);ctx.fillStyle='#c5beae';ctx.fill(paperPath);ctx.restore();
    ctx.drawImage(paper,0,0,PW,PH);ctx.shadowColor='transparent';
    if(phase==='covering'||phase==='rubbing'){
      ctx.globalAlpha=.022;ctx.drawImage(art.glyphMask,PX,PY,W,H);ctx.globalAlpha=1;
    }
    if(phase!=='covering'){
      if(inkDirty){inkViewCtx.clearRect(0,0,PW,PH);inkViewCtx.drawImage(ink,0,0,PW,PH);inkViewCtx.globalCompositeOperation='destination-in';inkViewCtx.drawImage(maskCanvas,0,0,PW,PH);inkViewCtx.globalCompositeOperation='source-over';inkDirty=false;}
      ctx.drawImage(inkView,0,0,PW,PH);
    }
    if(phase==='peeling'&&lift<.995){
      const wave=PH*(1-lift),light=ctx.createLinearGradient(0,wave-32,0,wave+36);
      light.addColorStop(0,'rgba(255,253,239,0)');light.addColorStop(.48,'rgba(255,253,239,.055)');light.addColorStop(.7,'rgba(75,66,51,.045)');light.addColorStop(1,'rgba(75,66,51,0)');
      ctx.save();ctx.clip(paperPath);ctx.fillStyle=light;ctx.fillRect(0,wave-32,PW,68);ctx.restore();
    }
    if(phase==='covering'&&cover<.99){
      const curl=ctx.createLinearGradient(0,PH-35,0,PH);curl.addColorStop(0,'rgba(120,111,90,0)');curl.addColorStop(.72,'rgba(120,111,90,.12)');curl.addColorStop(1,'rgba(255,252,229,.4)');
      ctx.save();ctx.clip(paperPath);ctx.fillStyle=curl;ctx.fillRect(0,PH-35,PW,35);ctx.restore();
    }
    if(phase==='rubbing'&&lastBrush){
      ctx.strokeStyle='rgba(103,91,69,.32)';ctx.lineWidth=.8;ctx.beginPath();ctx.arc(lastBrush.x,lastBrush.y,35,0,Math.PI*2);ctx.stroke();
    }
    ctx.restore();
  }
  function resize(){
    const mobile=matchMedia('(max-width:600px)').matches;
    canvas.width=mobile?700:900;canvas.height=mobile?1000:760;
    if(!projection||!depth)return;
    const bounds=canvas.getBoundingClientRect(),hud=document.querySelector('.scoreline').getBoundingClientRect();
    if(desktopLayout.matches)play.style.setProperty('--stage-height',`${Math.ceil(bounds.height)}px`);
    camera.cssScale=bounds.height/canvas.height;
    camera.origin=mobile?190:115;
    const projectedHeight=Math.abs(projection.b*W)+Math.abs(projection.d*H)+Math.abs(depth.y)+40;
    camera.s=Math.min(mobile?1.43:1.12,(canvas.height-camera.origin-45)/projectedHeight);
    const center=project(W/2,H/2);
    camera.x=canvas.width/2-(center.x+depth.x/2)*camera.s;
    camera.topSafe=(hud.bottom-bounds.top+24)*canvas.width/bounds.width;
    positionCamera(1);
  }
  function positionCamera(amount){
    if(!projection||!depth)return;
    const stacking=phase==='stack'||phase==='dropping';
    let target=camera.origin-(stacking?((8-layers.length)*L/2-15)*projection.d*camera.s:0);
    const safeY=stacking&&moving?camera.topSafe-(project(moving.x,moving.y).y+depth.y)*camera.s:-Infinity;
    target=Math.max(target,safeY);
    camera.y+=(target-camera.y)*amount;
    camera.y=Math.max(camera.y,safeY);
    const nearStone=['stack','dropping','completed','covering'].includes(phase);
    const baseBottom=(camera.y+(project(W/2,H).y+28)*camera.s)*camera.cssScale;
    const lift=nearStone?Math.min(0,baseBottom+36-canvas.height*camera.cssScale-25):0;
    if(desktopLayout.matches){
      if(caption.style.transform)caption.style.transform='';
    }else{
      caption.style.transform=`translateY(${Math.round(lift)}px)`;
    }
  }
  window.addEventListener('resize',resize);resize();
  new ResizeObserver(resize).observe(canvas);
  function render(){
    ctx.clearRect(0,0,canvas.width,canvas.height);if(!art)return;
    ctx.save();ctx.translate(canvas.width/2-12*camera.s,camera.y+(project(W/2,H).y+24)*camera.s);ctx.scale(camera.s,.23*camera.s);
    const floor=ctx.createRadialGradient(-20,-4,6,0,0,195);
    floor.addColorStop(0,'rgba(129,125,111,.11)');floor.addColorStop(.5,'rgba(99,98,88,.055)');floor.addColorStop(1,'rgba(99,98,88,0)');
    ctx.fillStyle=floor;ctx.fillRect(-200,-200,400,400);ctx.restore();
    ctx.save();ctx.translate(canvas.width/2,camera.y+(project(W/2,H).y+19)*camera.s);ctx.scale(camera.s,.15*camera.s);
    const shadow=ctx.createRadialGradient(0,0,4,0,0,175);
    shadow.addColorStop(0,'rgba(0,0,0,.64)');shadow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=shadow;
    ctx.fillRect(-180,-180,360,360);ctx.restore();
    ctx.save();ctx.translate(camera.x,camera.y);ctx.scale(camera.s,camera.s);
    if(phase==='peeling'||phase==='result')ctx.globalAlpha=.3;
    drawBase();layers.forEach(l=>stoneSlice(l.x,H-(l.index+1)*L,l.width,l.index));
    if(phase==='stack')stoneSlice(moving.x,moving.y,moving.width,layers.length,moving.uvX);
    if(phase==='dropping'){
      const t=ease(clamp(phaseTime/(drop.failed?.55:.25),0,1)),f=drop.from,to=drop.to;
      stoneSlice(f.x+(to.x-f.x)*t,f.y+(to.y-f.y)*t,f.width+((to.width||f.width)-f.width)*t,layers.length,drop.failed?f.uvX:f.uvX+(to.x-f.uvX)*t,drop.failed?1-t:1);
    }
    for(const d of debris){stoneSlice(d.x+d.vx*d.age,d.y+150*d.age*d.age,d.width,Math.min(7,layers.length),0,Math.max(0,1-d.age*2));}
    drawStoneDust();
    ctx.globalAlpha=1;
    if(['covering','rubbing','peeling','result'].includes(phase))drawPaper();
    ctx.restore();
  }
  function tick(time){
    const dt=previous?Math.min(.05,Math.max(0,(time-previous)/1000)):0;previous=time;phaseTime+=dt;
    stoneDust=stoneDust.filter(d=>(d.age+=dt)<.8);debris=debris.filter(d=>(d.age+=dt)<.55);
    if(messageTime>0&&(messageTime-=dt)<=0){
      if(phase==='stack')say(stackHint());
      else if(phase==='completed'||phase==='covering')say('成碑，覆纸。');
    }
    if(phase==='stack'){
      const speed=(125+layers.length*5+Math.min(round,6)*8)*(misses>1?.84:1);
      moving.x+=moving.direction*dt*speed;
      const top=layers[layers.length-1],min=top.x-228,max=top.x+228;
      if(moving.x>max){moving.x=max;moving.direction=-1;}if(moving.x<min){moving.x=min;moving.direction=1;}
    }else if(phase==='dropping'&&phaseTime>=(drop.failed?.55:.25)){
      if(drop.failed){feedback('miss');newMoving();setPhase('stack');}
      else{
        feedback(drop.perfect?'perfect':'land');
        if(drop.perfect){emitStoneDust(drop.to);showPerfectCaption();}
        layers.push(drop.to);updateScore();
        if(layers.length===8){setPhase('completed');if(!drop.perfect)say('成碑，覆纸。');}
        else{newMoving();setPhase('stack');}
      }
    }else if(phase==='completed'&&phaseTime>(reduced?.25:.65)){
      prepareRubbing();setPhase('covering');
    }else if(phase==='covering'&&phaseTime>(reduced?.25:1.1)){
      setPhase('rubbing');score.textContent='00';$('score-unit').textContent=' % 显墨';say('按住轻擦，让碑上的字显出来。');
    }else if(phase==='rubbing'&&keyHeld){
      keyTime+=dt;
      const t=keyTime*1.55,column=Math.floor(t/2),f=t%2;
      brushPoint({x:PX+18+Math.min(column,3)*66,y:PY+12+(f<1?f:2-f)*(H-24)});
      if(readyToPeel)finishRubbing();
    }else if(phase==='peeling'&&phaseTime>(reduced?.3:1.05)){
      setPhase('result');actions.hidden=false;score.textContent='成';$('score-unit').textContent='拓';say('石上片刻，纸上千年。');
    }
    positionCamera(reduced?1:Math.min(1,dt*8));
    render();frame=requestAnimationFrame(tick);
  }
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){cancelAnimationFrame(frame);finishRubbing();stoneDust=[];previous=0;}
    else{previous=0;frame=requestAnimationFrame(tick);}
  });
  window.beijianStack={
    setProgress(value,label){
      const n=Number(value);if(!Number.isFinite(n))return;
      const p=clamp(n,0,1);$('load-fill').style.transform=`scaleX(${p})`;$('load-track').classList.remove('is-preview');$('load-track').setAttribute('aria-valuemin','0');$('load-track').setAttribute('aria-valuemax','100');$('load-track').setAttribute('aria-valuenow',Math.round(p*100));$('load-track').setAttribute('aria-label','网站加载进度');$('load-percent').textContent=`${Math.round(p*100)}%`;$('load-label').textContent=label||'碑间正在准备';
    },
    setReady(onEnter){this.setProgress(1,'展览准备完成');document.querySelector('.loading-screen').classList.add('is-ready');$('enter').hidden=false;resize();$('enter').onclick=()=>{if(typeof onEnter==='function')onEnter();};}
  };
  if(!projection||!depth){say('石碑图像尚未准备好，请重新打开试玩文件。');return;}
  startRound();frame=requestAnimationFrame(tick);
})();
