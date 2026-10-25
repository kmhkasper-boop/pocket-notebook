'use strict';
(()=>{const $=s=>document.querySelector(s);const P=window.PN;const uid=()=>Math.random().toString(36).slice(2,10);
const HW=96;let pps=40,snapMode='beat',selClip=null,selTrack=null,ph=0,playing=false,t0=0,from=0,nodes=[],raf=0;
const M=()=>{const S=P.S;if(!S.multi||!S.multi.tracks)S.multi={tracks:[],clips:[]};if(!S.multi.tracks.length)S.multi.tracks.push(newTrack(1));return S.multi;};
function newTrack(n){return{id:uid(),name:'Track '+n,vol:0.8,mute:false,solo:false};}
const buf=c=>P.samples[c.bufId];
const end=()=>Math.max(0,...M().clips.map(c=>c.start+c.dur));
const snap=t=>{const beat=60/P.S.bpm,q=snapMode==='beat'?beat:snapMode==='bar'?beat*4:0;return q?Math.round(t/q)*q:t;};
const audible=tr=>M().tracks.some(x=>x.solo)?tr.solo:!tr.mute;
function fillSrc(){const s=$('#mSrc');s.innerHTML='';const add=(v,t)=>{const o=document.createElement('option');o.value=v;o.textContent=t;s.appendChild(o);};
 if(window.PNWave&&PNWave.buf)add('w','Wave editor output');P.S.tracks.forEach(t=>add('s:'+t.sampleId,'Sample: '+t.name));if(!s.options.length)add('','(record/import or use File)');}
function addClip(bufId,name,trackId,start){const m=M();const tr=trackId||selTrack||m.tracks[0].id;const b=P.samples[bufId];const c={id:uid(),track:tr,bufId,name:name||'clip',start:snap(start??ph),offset:0,dur:b.duration,fadeIn:0,fadeOut:0,gain:1};m.clips.push(c);selClip=c.id;render();return c;}
window.PNMulti={addBuffer(b,name){const id=uid();P.samples[id]=b;return addClip(id,name);},render,get state(){return M()},play,stop};
$('#mAdd').onclick=()=>{const v=$('#mSrc').value;if(!v)return P.toast('Nothing to add');if(v==='w')return PNMulti.addBuffer(PNWave.buf,'edit');const id=v.slice(2);const t=P.S.tracks.find(t=>t.sampleId===id);addClip(id,t?t.name:'sample');};
$('#mFile').onchange=async e=>{for(const f of e.target.files){try{PNMulti.addBuffer(await P.decode(await f.arrayBuffer()),f.name.replace(/\.[^.]+$/,''));}catch(err){P.toast('Cannot decode '+f.name);}}e.target.value='';};
$('#mAddTrack').onclick=()=>{const m=M();const t=newTrack(m.tracks.length+1);m.tracks.push(t);selTrack=t.id;render();};
$('#mZi').onclick=()=>{pps=Math.min(400,pps*1.5);render();};$('#mZo').onclick=()=>{pps=Math.max(5,pps/1.5);render();};
$('#mSnap').onclick=()=>{snapMode={off:'beat',beat:'bar',bar:'off'}[snapMode];$('#mSnap').textContent='Snap: '+snapMode;};
$('#mDelClip').onclick=()=>{const m=M();const i=m.clips.findIndex(c=>c.id===selClip);if(i<0)return P.toast('Tap a clip first');m.clips.splice(i,1);selClip=null;render();};
$('#mSplit').onclick=()=>{const m=M();const c=m.clips.find(c=>c.id===selClip);if(!c||ph<=c.start+0.01||ph>=c.start+c.dur-0.01)return P.toast('Select a clip and put the playhead inside it');
 const cut=ph-c.start;const n={...c,id:uid(),start:ph,offset:c.offset+cut,dur:c.dur-cut,fadeIn:0};c.dur=cut;c.fadeOut=0;m.clips.push(n);render();};
function laneW(){return Math.max(30,end()+10)*pps;}
function render(){const m=M(),rows=$('#mRows'),W=laneW();rows.innerHTML='';rows.style.position='relative';
 const ru=$('#mRuler');ru.innerHTML='';ru.style.width=W+'px';const beat=60/P.S.bpm,bar=beat*4,step=bar*Math.max(1,Math.ceil(40/(bar*pps)));
 for(let t=0,i=0;t*pps<W;t+=step,i++){const sp=document.createElement('span');sp.style.left=t*pps+'px';sp.textContent=(Math.round(t/bar)+1)+'';ru.appendChild(sp);}
 m.tracks.forEach((tr,ti)=>{const r=document.createElement('div');r.className='mrow';r.dataset.track=tr.id;
  r.innerHTML=`<div class="mhd ${selTrack===tr.id?'sel':''}"><input class="t"><div class="b"><button class="mute ${tr.mute?'on':''}">M</button><button class="solo ${tr.solo?'on':''}">S</button><button class="x">✕</button></div><input type="range" min="0" max="1.5" step="0.01"></div><div class="lane"></div>`;
  const hd=r.firstChild,ln=r.lastChild;hd.querySelector('.t').value=tr.name;hd.querySelector('.t').onchange=e=>tr.name=e.target.value;
  hd.onclick=e=>{if(e.target.tagName!=='INPUT'||e.target.type!=='range'){selTrack=tr.id;document.querySelectorAll('.mhd').forEach(h=>h.classList.toggle('sel',h===hd));}};
  hd.querySelector('.mute').onclick=e=>{tr.mute=!tr.mute;e.target.classList.toggle('on',tr.mute);};hd.querySelector('.solo').onclick=e=>{tr.solo=!tr.solo;e.target.classList.toggle('on',tr.solo);};
  hd.querySelector('.x').onclick=()=>{if(m.tracks.length<2)return P.toast('Keep at least one track');if(!confirm('Delete '+tr.name+' and its clips?'))return;m.tracks.splice(ti,1);m.clips=m.clips.filter(c=>c.track!==tr.id);render();};
  const vr=hd.querySelector('input[type=range]');vr.value=tr.vol;vr.oninput=()=>{tr.vol=+vr.value;nodes.filter(n=>n.track===tr.id).forEach(n=>n.g.gain.value=tr.vol);};
  ln.style.width=W+'px';ln.style.backgroundSize=(beat*4*pps)+'px 100%';
  m.clips.filter(c=>c.track===tr.id).forEach(c=>ln.appendChild(clipEl(c)));rows.appendChild(r);});
 const phd=document.createElement('div');phd.id='mPh';rows.appendChild(phd);posPh();}
function clipEl(c){const el=document.createElement('div');el.className='clip'+(c.id===selClip?' sel':'');el.dataset.id=c.id;
 el.innerHTML='<canvas></canvas><div class="eg l" style="left:0"></div><div class="eg r" style="right:0"></div><div class="fk l"></div><div class="fk r"></div><span class="nm"></span>';el.querySelector('.nm').textContent=c.name;upd(el,c);
 el.onpointerdown=e=>down(e,el,c);return el;}
function upd(el,c){el.style.left=c.start*pps+'px';const w=Math.max(4,c.dur*pps);el.style.width=w+'px';el.querySelector('.fk.l').style.left=(c.fadeIn*pps-9)+'px';el.querySelector('.fk.r').style.left=(w-c.fadeOut*pps-9)+'px';
 const cv=el.querySelector('canvas'),d=Math.min(2,devicePixelRatio),H=62;cv.width=Math.min(8000,w*d);cv.height=H*d;const g=cv.getContext('2d');g.scale(cv.width/w,d);const b=buf(c);if(!b)return;
 const dd=b.getChannelData(0),sr=b.sampleRate;g.fillStyle='#8ea2d8';for(let x=0;x<w;x++){const i0=Math.floor((c.offset+x/pps)*sr),i1=Math.floor((c.offset+(x+1)/pps)*sr);let mx=0;const st=Math.max(1,(i1-i0)>>6);for(let i=i0;i<i1&&i<dd.length;i+=st)mx=Math.max(mx,Math.abs(dd[i]));g.fillRect(x,H/2-mx*H/2*c.gain,1,Math.max(1,mx*H*c.gain));}
 g.strokeStyle='#3ddc84';g.lineWidth=1.5;g.beginPath();g.moveTo(0,H);g.lineTo(c.fadeIn*pps,2);g.lineTo(w-c.fadeOut*pps,2);g.lineTo(w,H);g.stroke();}
function down(e,el,c){e.stopPropagation();e.preventDefault();el.setPointerCapture(e.pointerId);selClip=c.id;document.querySelectorAll('.clip').forEach(x=>x.classList.toggle('sel',x===el));selTrack=c.track;
 const R=el.getBoundingClientRect(),lx=e.clientX-R.left,ly=e.clientY-R.top,w=R.width,fiX=c.fadeIn*pps,foX=w-c.fadeOut*pps,ez=Math.min(18,w/4);
 let mode='mv';if(ly<22&&Math.abs(lx-fiX)<14&&lx<=foX)mode='fi';else if(ly<22&&Math.abs(lx-foX)<14)mode='fo';else if(lx<ez)mode='tl';else if(lx>w-ez)mode='tr';
 const o={x:e.clientX,st:c.start,off:c.offset,dur:c.dur,fi:c.fadeIn,fo:c.fadeOut},B=buf(c).duration;let moved=false;
 el.onpointermove=ev=>{const dx=(ev.clientX-o.x)/pps;if(Math.abs(ev.clientX-o.x)>3)moved=true;
  if(mode==='mv'){c.start=Math.max(0,snap(o.st+dx));const r=document.elementsFromPoint(ev.clientX,ev.clientY).find(x=>x.classList&&x.classList.contains('mrow'));if(r&&r.dataset.track!==c.track){c.track=r.dataset.track;r.querySelector('.lane').appendChild(el);}}
  else if(mode==='tl'){let ns=Math.max(0,snap(o.st+dx));let d=ns-o.st;d=Math.max(-o.off,Math.min(o.dur-0.02,d));c.start=o.st+d;c.offset=o.off+d;c.dur=o.dur-d;c.fadeIn=Math.min(c.fadeIn,c.dur-c.fadeOut);}
  else if(mode==='tr'){c.dur=Math.max(0.02,Math.min(B-c.offset,snap(o.st+o.dur+dx)-c.start));c.fadeOut=Math.min(c.fadeOut,c.dur-c.fadeIn);}
  else if(mode==='fi')c.fadeIn=Math.max(0,Math.min(c.dur-c.fadeOut,o.fi+dx));else c.fadeOut=Math.max(0,Math.min(c.dur-c.fadeIn,o.fo-dx));
  upd(el,c);};
 el.onpointerup=el.onpointercancel=()=>{el.onpointermove=null;if(moved)render();};}
$('#mRuler').onclick=e=>{const r=$('#mRuler').getBoundingClientRect();ph=Math.max(0,(e.clientX-r.left)/pps);if(playing){stop();play();}else posPh();};
function posPh(){const p=$('#mPh');if(p)p.style.left=(HW+ph*pps)+'px';}
function sched(c,dest,when,fromT,mkNode){const m=M();const tg={};for(const tr of m.tracks){if(!audible(tr))continue;const g=c.createGain();g.gain.value=tr.vol;g.connect(dest);tg[tr.id]=g;mkNode&&mkNode({track:tr.id,g});}
 for(const cl of m.clips){const g0=tg[cl.track],b=buf(cl);if(!g0||!b)continue;const e=cl.start+cl.dur;if(e<=fromT)continue;const skip=Math.max(0,fromT-cl.start);
  const s=c.createBufferSource();s.buffer=b;const g=c.createGain();s.connect(g);g.connect(g0);const at=when+Math.max(0,cl.start-fromT);
  const env=t=>{const x=t-cl.start;let v=1;if(cl.fadeIn>0&&x<cl.fadeIn)v=x/cl.fadeIn;if(cl.fadeOut>0&&x>cl.dur-cl.fadeOut)v=Math.min(v,(cl.dur-x)/cl.fadeOut);return Math.max(0,v)*cl.gain;};
  const T=t=>when+(t-fromT);const pts=[cl.start+skip,cl.start+cl.fadeIn,e-cl.fadeOut,e].filter((t,i)=>i===0||t>cl.start+skip).sort((a,b)=>a-b);
  g.gain.setValueAtTime(env(pts[0]),T(pts[0]));for(const t of pts.slice(1))g.gain.linearRampToValueAtTime(env(t),T(t));
  s.start(at,cl.offset+skip,cl.dur-skip);nodes.push({s});}}
function play(){const c=P.audio();if(ph>=end())ph=0;nodes=[];from=ph;t0=c.currentTime+0.05;sched(c,P.master,t0,from,n=>nodes.push(n));playing=true;$('#mPlay').textContent='■';$('#mPlay').classList.add('on');
 const loop=()=>{if(!playing)return;ph=from+Math.max(0,c.currentTime-t0);posPh();if(ph>end()+0.1){stop();return;}raf=requestAnimationFrame(loop);};loop();}
function stop(){playing=false;cancelAnimationFrame(raf);nodes.forEach(n=>{try{n.s&&n.s.stop()}catch(e){}try{n.g&&n.g.disconnect()}catch(e){}});nodes=[];$('#mPlay').textContent='▶';$('#mPlay').classList.remove('on');posPh();}
$('#mPlay').onclick=()=>playing?stop():play();
async function mix(){const len=end();if(len<=0)throw new Error('No clips');const sr=44100,oc=new OfflineAudioContext(2,Math.ceil(len*sr),sr);sched(oc,oc.destination,0,0);return oc.startRendering();}
const fn=ext=>(P.S.name||'pocket').replace(/[^\w\- ]+/g,'').trim().replace(/ /g,'_')+'_multitrack.'+ext;
$('#mWav').onclick=async()=>{try{await P.download(P.wavBlob(await mix()),fn('wav'));}catch(e){P.toast(e.message);}};
$('#mMp3').onclick=async()=>{try{await P.download(P.mp3Blob(await mix()),fn('mp3'));}catch(e){P.toast(e.message);}};
PNMulti.mix=mix;
addEventListener('pn-tab',e=>{if(e.detail==='multi'){fillSrc();render();}else if(playing)stop();});
addEventListener('pn-load',()=>{stop();ph=0;selClip=null;selTrack=null;render();});
})();
