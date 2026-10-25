'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const uid=()=>Math.random().toString(36).slice(2,10);
const toast=m=>{const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>t.style.display='none',2200)};
const AC=window.AudioContext||window.webkitAudioContext;
let ctx=null, master=null;
function audio(){ if(!ctx){ctx=new AC();master=ctx.createGain();master.gain.value=0.9;const comp=ctx.createDynamicsCompressor();master.connect(comp);comp.connect(ctx.destination);} if(ctx.state!=='running')ctx.resume(); return ctx;}
// iOS unlock on first touch
const unlock=()=>{const c=audio();const b=c.createBuffer(1,1,22050),s=c.createBufferSource();s.buffer=b;s.connect(c.destination);s.start(0);};
document.addEventListener('pointerdown',unlock,{once:true,capture:true});
document.addEventListener('touchend',()=>ctx&&ctx.resume(),{capture:true});

// ---------- state ----------
const STEPS=128;
// Loop length options in 16th-note steps. Change this list to offer other lengths (e.g. [4,8,16,32,64]).
const LENGTHS=[4,8];
const defFx=()=>({start:0,end:1,vol:0.8,pitch:0,pan:0,lowcut:20,highcut:20000,bpOn:false,bpFreq:1000,bpQ:1,boomOn:false,boomFreq:55,boomDecay:0.5,boomAmt:0.6,drive:0,revOn:false,revMix:0.35,revGate:0.25});
const PRESETS={
 Bass:{wave:'sawtooth',wave2:'square',detune:8,mix2:0.5,octave:-1,cutoff:600,res:6,envAmt:1800,a:0.005,d:0.2,s:0.4,r:0.1,lfoRate:0,lfoAmt:0,vol:0.8},
 Lead:{wave:'sawtooth',wave2:'sawtooth',detune:12,mix2:0.6,octave:0,cutoff:2200,res:4,envAmt:2500,a:0.01,d:0.3,s:0.7,r:0.2,lfoRate:5,lfoAmt:300,vol:0.6},
 Pad:{wave:'sawtooth',wave2:'triangle',detune:18,mix2:0.7,octave:0,cutoff:1200,res:2,envAmt:800,a:0.6,d:0.8,s:0.8,r:1.2,lfoRate:0.3,lfoAmt:500,vol:0.5},
 Pluck:{wave:'square',wave2:'triangle',detune:4,mix2:0.4,octave:0,cutoff:500,res:8,envAmt:4000,a:0.002,d:0.18,s:0,r:0.15,lfoRate:0,lfoAmt:0,vol:0.7},
 Keys:{wave:'triangle',wave2:'sine',detune:6,mix2:0.5,octave:0,cutoff:3000,res:1,envAmt:1500,a:0.005,d:0.6,s:0.3,r:0.4,lfoRate:4,lfoAmt:60,vol:0.7}};
let customPresets=JSON.parse(localStorage.getItem('pn-presets')||'{}');
const freshState=()=>({name:'Untitled',bpm:100,swing:0,len:8,tracks:[],synth:{...PRESETS.Bass},preset:'Bass',notes:[],synthVol:0.7,synthMute:false});
let S=freshState(); const samples={}; // id -> AudioBuffer
const rendered={}; // trackId -> {key,buf}

// ---------- FX render (non-destructive) ----------
function distCurve(k){const n=2048,c=new Float32Array(n);for(let i=0;i<n;i++){const x=i/(n-1)*2-1;c[i]=Math.tanh(k*x)/Math.tanh(k);}return c;}
function noiseIR(c,sec){const len=Math.floor(c.sampleRate*sec),b=c.createBuffer(2,len,c.sampleRate);for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,1.5);}return b;}
async function renderFx(src,f){
 const sr=src.sampleRate, rate=Math.pow(2,f.pitch/12);
 const s0=Math.floor(f.start*src.length), s1=Math.max(s0+64,Math.floor(f.end*src.length));
 const dur=(s1-s0)/sr/rate;
 const tail=(f.revOn?f.revGate+0.05:0)+(f.boomOn?f.boomDecay*1.2:0)+0.01;
 const total=Math.min(dur+tail,30);
 const oc=new OfflineAudioContext(2,Math.ceil(total*sr),sr);
 const s=oc.createBufferSource();s.buffer=src;s.playbackRate.value=rate;
 let n=s;
 const hp=oc.createBiquadFilter();hp.type='highpass';hp.frequency.value=f.lowcut;hp.Q.value=0.7;n.connect(hp);n=hp;
 const lp=oc.createBiquadFilter();lp.type='lowpass';lp.frequency.value=f.highcut;lp.Q.value=0.7;n.connect(lp);n=lp;
 if(f.bpOn){const bp=oc.createBiquadFilter();bp.type='bandpass';bp.frequency.value=f.bpFreq;bp.Q.value=f.bpQ;n.connect(bp);n=bp;}
 const pre=oc.createGain();n.connect(pre);n=pre;
 if(f.boomOn){ // resonant pitched lowpass + decaying sine, triggered by the hit
  const sum=oc.createGain();
  const dry=oc.createGain();dry.gain.value=1-f.boomAmt*0.6;n.connect(dry);dry.connect(sum);
  const res=oc.createBiquadFilter();res.type='lowpass';res.frequency.value=f.boomFreq;res.Q.value=4+f.boomAmt*20;
  const rg=oc.createGain();rg.gain.value=f.boomAmt*1.2;n.connect(res);res.connect(rg);rg.connect(sum);
  const o=oc.createOscillator();o.type='sine';o.frequency.setValueAtTime(f.boomFreq*2.5,0);o.frequency.exponentialRampToValueAtTime(f.boomFreq,0.04);
  const og=oc.createGain();og.gain.setValueAtTime(0,0);og.gain.linearRampToValueAtTime(f.boomAmt,0.003);og.gain.setTargetAtTime(0,0.01,Math.max(0.02,f.boomDecay/4));
  o.connect(og);og.connect(sum);o.start(0);o.stop(total);n=sum;}
 if(f.drive>0){const ws=oc.createWaveShaper();ws.curve=distCurve(1+f.drive*40);ws.oversample='4x';const g=oc.createGain();g.gain.value=1/(1+f.drive*0.8);n.connect(ws);ws.connect(g);n=g;}
 const out=oc.createGain();out.gain.value=f.vol;
 if(f.revOn){const cv=oc.createConvolver();cv.buffer=noiseIR(oc,1.8);const wet=oc.createGain();wet.gain.setValueAtTime(f.revMix,0);wet.gain.setValueAtTime(f.revMix,f.revGate);wet.gain.linearRampToValueAtTime(0,f.revGate+0.03);
  const dry=oc.createGain();dry.gain.value=1-f.revMix*0.5;n.connect(dry);dry.connect(out);n.connect(cv);cv.connect(wet);wet.connect(out);} else n.connect(out);
 const pan=oc.createStereoPanner?oc.createStereoPanner():null; if(pan){pan.pan.value=f.pan;out.connect(pan);pan.connect(oc.destination);}else out.connect(oc.destination);
 s.start(0,s0/sr,(s1-s0)/sr);
 return oc.startRendering();
}
async function getRendered(t){const key=t.sampleId+JSON.stringify(t.fx);const r=rendered[t.id];if(r&&r.key===key)return r.buf;const src=samples[t.sampleId];if(!src)return null;const buf=await renderFx(src,t.fx);rendered[t.id]={key,buf};return buf;}
const renderAll=()=>Promise.all(S.tracks.map(getRendered));

// ---------- synth voice ----------
const mtof=m=>440*Math.pow(2,(m-69)/12);
function synthVoice(c,dest,midi,t,p,vel=1){
 const f=mtof(midi+12*(p.octave||0));
 const o1=c.createOscillator(),o2=c.createOscillator();o1.type=p.wave;o2.type=p.wave2;o1.frequency.value=f;o2.frequency.value=f;o1.detune.value=-p.detune;o2.detune.value=p.detune;
 const g1=c.createGain(),g2=c.createGain();g1.gain.value=1-p.mix2;g2.gain.value=p.mix2;
 const fl=c.createBiquadFilter();fl.type='lowpass';fl.Q.value=p.res;
 const base=Math.max(30,p.cutoff),peak=Math.min(18000,base+p.envAmt);
 fl.frequency.setValueAtTime(base,t);fl.frequency.linearRampToValueAtTime(peak,t+p.a+0.001);fl.frequency.setTargetAtTime(base+(peak-base)*p.s,t+p.a,p.d/3+0.001);
 const amp=c.createGain();const lvl=p.vol*vel*0.5;
 amp.gain.setValueAtTime(0,t);amp.gain.linearRampToValueAtTime(lvl,t+p.a+0.001);amp.gain.setTargetAtTime(lvl*p.s,t+p.a+0.001,p.d/3+0.001);
 o1.connect(g1);o2.connect(g2);g1.connect(fl);g2.connect(fl);fl.connect(amp);amp.connect(dest);
 let lfo=null;if(p.lfoRate>0&&p.lfoAmt>0){lfo=c.createOscillator();lfo.frequency.value=p.lfoRate;const lg=c.createGain();lg.gain.value=p.lfoAmt;lfo.connect(lg);lg.connect(fl.frequency);lfo.start(t);}
 o1.start(t);o2.start(t);
 return {release(rt){rt=Math.max(rt,t+0.005);amp.gain.cancelScheduledValues(rt);amp.gain.setTargetAtTime(0,rt,p.r/4+0.002);const end=rt+p.r*1.5+0.05;o1.stop(end);o2.stop(end);lfo&&lfo.stop(end);}};
}

// ---------- sequencer ----------
let playing=false,curStep=0,nextTime=0,timer=null;const visQ=[];
const stepDur=()=>60/S.bpm/4;
const anySolo=()=>S.tracks.some(x=>x.solo)||!!S.synthSolo;
const audible=t=>anySolo()?t.solo:!t.mute;
const synthOn=()=>anySolo()?!!S.synthSolo:!S.synthMute;
function playBuf(c,dest,buf,t,vel){const s=c.createBufferSource();s.buffer=buf;const g=c.createGain();g.gain.value=vel;s.connect(g);g.connect(dest);s.start(t);}
function scheduleStep(c,dest,step,t,synthDest){
 for(const tr of S.tracks){const v=tr.steps[step];if(v>0&&audible(tr)){const r=rendered[tr.id];if(r)playBuf(c,dest,r.buf,t,v);}}
 if(synthOn())for(const n of S.notes)if(n.s===step){const v=synthVoice(c,synthDest,n.p,t,S.synth,n.v||1);v.release(t+n.l*stepDur());}
}
let synthBus=null;
function sb(){if(!synthBus){synthBus=ctx.createGain();synthBus.connect(master);}synthBus.gain.value=S.synthVol;return synthBus;}
function tick(){const n=S.len;while(nextTime<ctx.currentTime+0.12){const sw=(curStep%2)?S.swing*stepDur()*0.5:0;scheduleStep(ctx,master,curStep,nextTime+sw,sb());visQ.push({s:curStep,t:nextTime+sw});nextTime+=stepDur();curStep=(curStep+1)%n;}}
async function play(){audio();await renderAll();playing=true;curStep=0;nextTime=ctx.currentTime+0.06;tick();timer=setInterval(tick,25);$('#play').classList.add('on');$('#play').textContent='■';requestAnimationFrame(vis);}
function stop(){playing=false;clearInterval(timer);visQ.length=0;$('#play').classList.remove('on');$('#play').textContent='▶';$$('.st.cur').forEach(e=>e.classList.remove('cur'));playStep=-1;drawRoll();}
let playStep=-1;
function vis(){if(!playing)return;let s=null;while(visQ.length&&visQ[0].t<=ctx.currentTime)s=visQ.shift().s;
 if(s!==null){playStep=s;$$('.st.cur').forEach(e=>e.classList.remove('cur'));$$(`.st[data-s="${s}"]`).forEach(e=>e.classList.add('cur'));if($('#v-roll').classList.contains('on'))drawRoll();}
 requestAnimationFrame(vis);}
$('#play').onclick=()=>playing?stop():play();
$('#bpm').onchange=e=>{S.bpm=Math.min(240,Math.max(40,+e.target.value||100));e.target.value=S.bpm;};
$('#swing').oninput=e=>S.swing=+e.target.value;
$('#bars').onclick=()=>{const i=LENGTHS.indexOf(S.len),nl=LENGTHS[(i+1)%LENGTHS.length],ol=S.len;S.len=nl;
 if(nl>ol){for(const t of S.tracks)if(!t.steps.slice(ol,nl).some(v=>v))for(let k=ol;k<nl;k++)t.steps[k]=t.steps[k%ol];
  if(!S.notes.some(n=>n.s>=ol&&n.s<nl))for(let off=ol;off<nl;off+=ol)S.notes.push(...S.notes.filter(n=>n.s<ol&&n.s+off<nl).map(n=>({...n,s:n.s+off,l:Math.min(n.l,ol)})));}
 if(curStep>=S.len)curStep=0;syncTop();renderTracks();sizeRoll();};
function syncTop(){$('#bpm').value=S.bpm;$('#swing').value=S.swing;$('#bars').textContent=S.len+' steps';$('#pname').textContent=S.name;$('#synthVol').value=S.synthVol;$('#synthMute').classList.toggle('on',S.synthMute);}

// ---------- tracks UI ----------
function renderTracks(){const box=$('#tracks');box.innerHTML='';$('#emptyHint').style.display=S.tracks.length?'none':'block';
 S.tracks.forEach((t,i)=>{const el=document.createElement('div');el.className='track';
  el.innerHTML=`<div class="hd"><button class="nm"></button><button class="mute ${t.mute?'on':''}">M</button><button class="solo ${t.solo?'on':''}">S</button><button class="up">↑</button><button class="dn">↓</button><button class="del">✕</button></div><div class="grid"></div>`;
  el.querySelector('.nm').textContent='✎ '+t.name;
  el.querySelector('.nm').onclick=()=>openEditor(t);
  el.querySelector('.mute').onclick=e=>{t.mute=!t.mute;e.target.classList.toggle('on',t.mute)};
  el.querySelector('.solo').onclick=e=>{t.solo=!t.solo;e.target.classList.toggle('on',t.solo)};
  el.querySelector('.up').onclick=()=>{if(i>0){S.tracks.splice(i-1,0,S.tracks.splice(i,1)[0]);renderTracks();}};
  el.querySelector('.dn').onclick=()=>{if(i<S.tracks.length-1){S.tracks.splice(i+1,0,S.tracks.splice(i,1)[0]);renderTracks();}};
  el.querySelector('.del').onclick=()=>{if(confirm('Delete track "'+t.name+'"?')){S.tracks.splice(i,1);delete rendered[t.id];if(!usedIds().includes(t.sampleId))delete samples[t.sampleId];renderTracks();}};
  const g=el.querySelector('.grid');
  let brow;for(let b=0;b<1;b++){brow=document.createElement('div');brow.className='brow';g.appendChild(brow);const bar=document.createElement('div');bar.className='bar';bar.style.gridTemplateColumns=`repeat(${S.len},1fr)`;
   for(let k=0;k<S.len;k++){const s=k,st=document.createElement('div');st.className='st'+((k%4===0)?' q':'');st.dataset.s=s;paintStep(st,t.steps[s]);
    let lp=null,long=false;
    st.onpointerdown=()=>{long=false;lp=setTimeout(()=>{long=true;const v=t.steps[s];t.steps[s]=v>=0.99?0.66:v>=0.6?0.33:1;paintStep(st,t.steps[s]);toast('Velocity '+Math.round(t.steps[s]*100)+'%');},450);};
    st.onpointerup=()=>{clearTimeout(lp);if(!long){t.steps[s]=t.steps[s]>0?0:1;paintStep(st,t.steps[s]);if(t.steps[s]&&!playing)preview(t);}};
    st.onpointerleave=st.onpointercancel=()=>clearTimeout(lp);
    st.oncontextmenu=e=>e.preventDefault();
    bar.appendChild(st);}
   brow.appendChild(bar);}
  box.appendChild(el);});
 if(S.notes.some(n=>n.s<S.len))box.appendChild(synthRow());}
function synthRow(){const el=document.createElement('div');el.className='track synthrow';
 el.innerHTML=`<div class="hd"><button class="nm"></button><button class="mute ${S.synthMute?'on':''}">M</button><button class="solo ${S.synthSolo?'on':''}">S</button></div><canvas class="mini"></canvas>`;
 el.querySelector('.nm').textContent='🎹 Synth · '+(S.preset||'custom');
 const open=()=>$('#tabs button[data-v=roll]').click();el.querySelector('.nm').onclick=open;el.querySelector('.mini').onclick=open;
 el.querySelector('.mute').onclick=e=>{S.synthMute=!S.synthMute;e.target.classList.toggle('on',S.synthMute);syncTop();};
 el.querySelector('.solo').onclick=e=>{S.synthSolo=!S.synthSolo;e.target.classList.toggle('on',S.synthSolo);};
 requestAnimationFrame(()=>drawMini(el.querySelector('.mini')));return el;}
function drawMini(cv){const d=devicePixelRatio,W=cv.clientWidth,H=cv.clientHeight;if(!W)return;cv.width=W*d;cv.height=H*d;const g=cv.getContext('2d');g.scale(d,d);const n=S.len,vis=S.notes.filter(x=>x.s<n);if(!vis.length)return;
 let lo=Math.min(...vis.map(x=>x.p)),hi=Math.max(...vis.map(x=>x.p));lo-=1;hi+=1;const rh=H/(hi-lo+1),cw=W/n;
 for(let b=0;b<=S.len;b+=4){g.fillStyle='#556';g.fillRect(b*cw,0,1,H);}
 g.fillStyle='#ff8a3d';for(const x of vis)g.fillRect(x.s*cw+0.5,(hi-x.p)*rh,Math.max(1.5,Math.min(x.l,n-x.s)*cw-1),Math.max(2,rh-1));}
function paintStep(st,v){st.classList.toggle('on',v>0);st.innerHTML=v>0&&v<0.99?`<div class="v" style="top:${v*100}%"></div>`:'';}
async function preview(t){audio();const b=await getRendered(t);if(b)playBuf(ctx,master,b,ctx.currentTime+0.01,1);}

function autoStart(buf){const d=buf.getChannelData(0);let pk=0;for(let i=0;i<d.length;i++)pk=Math.max(pk,Math.abs(d[i]));const th=pk*0.08;for(let i=0;i<d.length;i++)if(Math.abs(d[i])>th)return Math.max(0,(i-200)/d.length);return 0;}
function addSample(buf,name,raw){const id=uid();samples[id]=buf;const fx=defFx();fx.start=autoStart(buf);fx.end=Math.min(1,fx.start+2/buf.duration);if(buf.duration<=2.5)fx.end=1;if(raw){fx.start=0;fx.end=1;}
 const t={id:uid(),name,sampleId:id,steps:new Array(STEPS).fill(0),mute:false,solo:false,fx};S.tracks.push(t);renderTracks();return t;}

// ---------- recording / import ----------
async function listInputs(){try{const d=await navigator.mediaDevices.enumerateDevices();const sel=$('#inputSel'),cur=sel.value;sel.innerHTML='<option value="">Default mic</option>';d.filter(x=>x.kind==='audioinput').forEach((x,i)=>{const o=document.createElement('option');o.value=x.deviceId;o.textContent=x.label||('Input '+(i+1));sel.appendChild(o);});sel.value=cur;}catch(e){}}
if(navigator.mediaDevices){listInputs();navigator.mediaDevices.ondevicechange=listInputs;}
let mr=null,stream=null,chunks=[];
$('#rec').onclick=async()=>{const btn=$('#rec');audio();
 if(mr&&mr.state==='recording'){mr.stop();return;}
 if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){toast('Mic needs HTTPS + a supporting browser');return;}
 try{const dev=$('#inputSel').value;stream=await navigator.mediaDevices.getUserMedia({audio:{deviceId:dev?{exact:dev}:undefined,echoCancellation:false,noiseSuppression:false,autoGainControl:false}});}catch(e){toast('Mic blocked: '+e.message);return;}
 listInputs();chunks=[];
 const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg'].find(m=>window.MediaRecorder&&MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(m));
 mr=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);
 mr.ondataavailable=e=>e.data.size&&chunks.push(e.data);
 mr.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());btn.classList.remove('on');btn.textContent='● Rec';
  try{const ab=await new Blob(chunks,{type:mr.mimeType}).arrayBuffer();const buf=await decode(ab);addSample(buf,'Rec '+(S.tracks.length+1));toast('Recorded '+buf.duration.toFixed(1)+'s');}catch(e){toast('Decode failed: '+e.message);}};
 mr.start(100);btn.classList.add('on');btn.textContent='■ Stop';};
function decode(ab){audio();return new Promise((res,rej)=>{const p=ctx.decodeAudioData(ab,res,rej);if(p&&p.then)p.then(res,rej);});}
$('#importAudio').onchange=async e=>{for(const f of e.target.files){try{addSample(await decode(await f.arrayBuffer()),f.name.replace(/\.[^.]+$/,'').slice(0,24));}catch(err){toast('Cannot decode '+f.name);}}e.target.value='';};

// ---------- control builder ----------
function slider(box,label,obj,key,min,max,step,fmt,cb,log){const w=document.createElement('label');w.className='ctl';const v=document.createElement('b');const r=document.createElement('input');r.type='range';
 const toR=x=>log?Math.log(x/min)/Math.log(max/min):x, fromR=x=>log?min*Math.pow(max/min,x):x;
 r.min=log?0:min;r.max=log?1:max;r.step=log?0.001:step;r.value=toR(obj[key]);
 const show=()=>v.textContent=fmt?fmt(obj[key]):obj[key];w.append(label,v,r);show();
 r.oninput=()=>{let x=fromR(+r.value);if(log)x=Math.round(x);obj[key]=x;show();cb&&cb();};box.appendChild(w);return w;}
function toggle(box,label,obj,key,cb){const b=document.createElement('button');const p=()=>{b.textContent=label+': '+(obj[key]?'ON':'off');b.classList.toggle('on',!!obj[key]);};p();b.onclick=()=>{obj[key]=!obj[key];p();cb&&cb();};box.appendChild(b);}
function select(box,label,obj,key,opts,cb){const w=document.createElement('label');w.className='ctl';const s=document.createElement('select');opts.forEach(o=>{const e=document.createElement('option');e.textContent=o;s.appendChild(e)});s.value=obj[key];s.onchange=()=>{obj[key]=s.value;cb&&cb();};w.append(label,s);box.appendChild(w);}
const h4=(box,t)=>{const h=document.createElement('h4');h.textContent=t;box.appendChild(h);};
const hz=x=>x>=1000?(x/1000).toFixed(1)+'k':Math.round(x)+'';

// ---------- sample editor ----------
let edT=null,edTimer=null;
function openEditor(t){edT=t;$('#editor').classList.remove('hidden');$('#edName').value=t.name;const f=t.fx,box=$('#edCtl');box.innerHTML='';
 const ch=()=>{clearTimeout(edTimer);edTimer=setTimeout(async()=>{await getRendered(t);drawWave();},120);};
 h4(box,'Level');slider(box,'Volume',f,'vol',0,1.5,0.01,x=>Math.round(x*100)+'%',ch);slider(box,'Pitch',f,'pitch',-24,24,1,x=>(x>0?'+':'')+x+' st',ch);slider(box,'Pan',f,'pan',-1,1,0.01,x=>x.toFixed(2),ch);
 h4(box,'Filters');slider(box,'Low-cut',f,'lowcut',20,5000,1,hz,ch,true);slider(box,'High-cut',f,'highcut',200,20000,1,hz,ch,true);
 toggle(box,'Band-pass',f,'bpOn',ch);box.appendChild(document.createElement('span'));slider(box,'BP freq',f,'bpFreq',60,10000,1,hz,ch,true);slider(box,'BP Q',f,'bpQ',0.3,20,0.1,x=>x.toFixed(1),ch);
 h4(box,'Boom box (808 resonance)');toggle(box,'Boom',f,'boomOn',ch);box.appendChild(document.createElement('span'));slider(box,'Tune',f,'boomFreq',30,200,1,x=>x+' Hz',ch,true);slider(box,'Decay',f,'boomDecay',0.05,2,0.01,x=>x.toFixed(2)+'s',ch);slider(box,'Amount',f,'boomAmt',0,1,0.01,x=>Math.round(x*100)+'%',ch);
 h4(box,'Distortion');slider(box,'Drive',f,'drive',0,1,0.01,x=>Math.round(x*100)+'%',ch);
 h4(box,'Gated reverb');toggle(box,'Reverb',f,'revOn',ch);box.appendChild(document.createElement('span'));slider(box,'Mix',f,'revMix',0,1,0.01,x=>Math.round(x*100)+'%',ch);slider(box,'Gate',f,'revGate',0.05,1.5,0.01,x=>Math.round(x*1000)+' ms',ch);
 const rs=document.createElement('button');rs.textContent='Reset FX';rs.onclick=()=>{const s=f.start,e=f.end;Object.assign(f,defFx(),{start:s,end:e});openEditor(t);preview(t);};box.appendChild(rs);
 requestAnimationFrame(()=>{getRendered(t).then(drawWave);});}
$('#edName').oninput=e=>{if(edT){edT.name=e.target.value||'Track';}};
$('#edClose').onclick=()=>{$('#editor').classList.add('hidden');renderTracks();edT=null;};
$('#edPreview').onclick=()=>edT&&preview(edT);
function drawWave(){if(!edT)return;const cv=$('#wave'),W=cv.clientWidth*devicePixelRatio,H=cv.clientHeight*devicePixelRatio;cv.width=W;cv.height=H;const g=cv.getContext('2d');const b=samples[edT.sampleId];if(!b)return;
 const d=b.getChannelData(0),f=edT.fx;g.fillStyle='#0c0e12';g.fillRect(0,0,W,H);g.fillStyle='#55607a';
 for(let x=0;x<W;x++){const i0=Math.floor(x/W*d.length),i1=Math.floor((x+1)/W*d.length);let mn=0,mx=0;for(let i=i0;i<i1;i+=1+((i1-i0)>>6)){const v=d[i];if(v<mn)mn=v;if(v>mx)mx=v;}g.fillRect(x,H/2-mx*H/2,1,Math.max(1,(mx-mn)*H/2));}
 const r=rendered[edT.id];if(r){const rd=r.buf.getChannelData(0),sx=f.start*W,ex=f.end*W;g.fillStyle='rgba(255,138,61,.85)';const wlen=ex-sx,rl=rd.length*(Math.pow(2,f.pitch/12))/((f.end-f.start)*d.length);
  for(let x=0;x<wlen;x++){const i0=Math.floor(x/wlen*rd.length/rl),i1=Math.floor((x+1)/wlen*rd.length/rl);let mx=0;for(let i=i0;i<i1&&i<rd.length;i+=1+((i1-i0)>>6))mx=Math.max(mx,Math.abs(rd[i]));g.fillRect(sx+x,H/2-mx*H/2,1,Math.max(1,mx*H));}}
 g.fillStyle='rgba(0,0,0,.6)';g.fillRect(0,0,f.start*W,H);g.fillRect(f.end*W,0,W-f.end*W,H);
 g.fillStyle='#3ddc84';for(const p of[f.start,f.end]){g.fillRect(p*W-2*devicePixelRatio,0,4*devicePixelRatio,H);g.beginPath();g.arc(p*W,H/2,12*devicePixelRatio,0,7);g.fill();}}
(()=>{const cv=$('#wave');let h=null;
 cv.onpointerdown=e=>{if(!edT)return;const x=e.offsetX/cv.clientWidth,f=edT.fx;h=Math.abs(x-f.start)<Math.abs(x-f.end)?'start':'end';cv.setPointerCapture(e.pointerId);mv(e);};
 const mv=e=>{if(!h)return;const f=edT.fx;let x=Math.min(1,Math.max(0,e.offsetX/cv.clientWidth));if(h==='start')f.start=Math.min(x,f.end-0.005);else f.end=Math.max(x,f.start+0.005);delete rendered[edT.id];drawWave();};
 cv.onpointermove=mv;cv.onpointerup=cv.onpointercancel=async()=>{if(h){h=null;await getRendered(edT);drawWave();preview(edT);}};})();

// ---------- synth screen ----------
const allPresets=()=>({...PRESETS,...customPresets});
function renderPresetSel(){const s=$('#presetSel');s.innerHTML='';for(const n of Object.keys(allPresets())){const o=document.createElement('option');o.textContent=n;s.appendChild(o);}s.value=S.preset in allPresets()?S.preset:'';}
$('#presetSel').onchange=e=>{S.preset=e.target.value;S.synth={...allPresets()[S.preset]};renderSynth();};
$('#presetSave').onclick=()=>{const n=prompt('Preset name',S.preset+' 2');if(!n)return;customPresets[n]={...S.synth};localStorage.setItem('pn-presets',JSON.stringify(customPresets));S.preset=n;renderPresetSel();toast('Saved preset '+n);};
$('#presetDel').onclick=()=>{if(PRESETS[S.preset]){toast('Built-in presets can be edited but not deleted');return;}delete customPresets[S.preset];localStorage.setItem('pn-presets',JSON.stringify(customPresets));S.preset='Bass';renderPresetSel();};
function renderSynth(){renderPresetSel();const b=$('#synthCtl'),p=S.synth;b.innerHTML='';const W=['sine','triangle','sawtooth','square'];
 h4(b,'Oscillators');select(b,'Osc 1',p,'wave',W);select(b,'Osc 2',p,'wave2',W);slider(b,'Osc2 mix',p,'mix2',0,1,0.01,x=>Math.round(x*100)+'%');slider(b,'Detune',p,'detune',0,50,1,x=>x+' ct');slider(b,'Octave',p,'octave',-2,2,1);slider(b,'Volume',p,'vol',0,1,0.01,x=>Math.round(x*100)+'%');
 h4(b,'Filter');slider(b,'Cutoff',p,'cutoff',40,12000,1,hz,null,true);slider(b,'Resonance',p,'res',0.1,25,0.1,x=>x.toFixed(1));slider(b,'Env amount',p,'envAmt',0,8000,10,hz);
 h4(b,'Envelope');slider(b,'Attack',p,'a',0.001,2,0.001,x=>x.toFixed(3)+'s');slider(b,'Decay',p,'d',0.01,2,0.01,x=>x.toFixed(2)+'s');slider(b,'Sustain',p,'s',0,1,0.01,x=>Math.round(x*100)+'%');slider(b,'Release',p,'r',0.01,3,0.01,x=>x.toFixed(2)+'s');
 h4(b,'LFO → cutoff');slider(b,'Rate',p,'lfoRate',0,15,0.1,x=>x.toFixed(1)+' Hz');slider(b,'Depth',p,'lfoAmt',0,3000,10,hz);}
(function kbd(){const k=$('#kbd');const names=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];for(let m=48;m<72;m++){const b=document.createElement('button');const nm=names[m%12];b.textContent=nm+(nm==='C'?Math.floor(m/12)-1:'');if(nm.includes('#'))b.className='b';let v=null;
 b.onpointerdown=e=>{e.preventDefault();audio();v=synthVoice(ctx,sb(),m,ctx.currentTime,S.synth);};b.onpointerup=b.onpointerleave=b.onpointercancel=()=>{if(v){v.release(ctx.currentTime);v=null;}};k.appendChild(b);}})();
$('#synthVol').oninput=e=>{S.synthVol=+e.target.value;if(synthBus)synthBus.gain.value=S.synthVol;};
$('#synthMute').onclick=()=>{S.synthMute=!S.synthMute;syncTop();renderTracks();};

// ---------- piano roll ----------
const PR={lo:36,hi:84,cw:26,rh:20,kw:40};const roll=$('#roll');let drawMode=true;
{const b=document.createElement('button');b.id='rollMode';const p=()=>{b.textContent=drawMode?'✎ Draw mode':'✋ Scroll mode';b.classList.toggle('on',drawMode);roll.style.touchAction=drawMode?'none':'auto';};b.onclick=()=>{drawMode=!drawMode;p();};p();$('#v-roll .row').prepend(b);}
function sizeRoll(){const n=S.len;const ww=$('#rollWrap').clientWidth||innerWidth-20;PR.kw=ww<500?28:40;PR.cw=(ww-PR.kw)/n;roll.style.width=(PR.kw+n*PR.cw)+'px';roll.style.height=((PR.hi-PR.lo+1)*PR.rh)+'px';roll.width=(PR.kw+n*PR.cw)*devicePixelRatio;roll.height=(PR.hi-PR.lo+1)*PR.rh*devicePixelRatio;drawRoll();}
function drawRoll(){const g=roll.getContext('2d'),d=devicePixelRatio,n=S.len,rows=PR.hi-PR.lo+1;g.setTransform(d,0,0,d,0,0);g.fillStyle='#0c0e12';g.fillRect(0,0,roll.width,roll.height);
 for(let r=0;r<rows;r++){const m=PR.hi-r,blk=[1,3,6,8,10].includes(m%12);g.fillStyle=blk?'#14171e':'#1a1d26';g.fillRect(PR.kw,r*PR.rh,n*PR.cw,PR.rh-1);g.fillStyle=blk?'#333':'#ccc';g.fillRect(0,r*PR.rh,PR.kw-2,PR.rh-1);if(m%12===0){g.fillStyle='#111';g.font='9px sans-serif';g.fillText('C'+(m/12-1),2,r*PR.rh+14);}}
 for(let s=0;s<=n;s++){g.fillStyle=s%16===0?'#667':s%4===0?'#3a3f50':'#242836';g.fillRect(PR.kw+s*PR.cw,0,1,rows*PR.rh);}
 if(playStep>=0){g.fillStyle='rgba(255,255,255,.12)';g.fillRect(PR.kw+playStep*PR.cw,0,PR.cw,rows*PR.rh);}
 for(const nt of S.notes){if(nt.s>=n||nt.p<PR.lo||nt.p>PR.hi)continue;const x=PR.kw+nt.s*PR.cw,y=(PR.hi-nt.p)*PR.rh,w=Math.min(nt.l,n-nt.s)*PR.cw;g.fillStyle='#ff8a3d';g.fillRect(x+1,y+1,w-2,PR.rh-3);g.fillStyle='#b55a20';g.fillRect(x+w-6,y+1,4,PR.rh-3);}}
(()=>{let op=null;
 const pos=e=>{const r=roll.getBoundingClientRect();return{s:Math.floor((e.clientX-r.left-PR.kw)/PR.cw),p:PR.hi-Math.floor((e.clientY-r.top)/PR.rh),fx:(e.clientX-r.left-PR.kw)/PR.cw};};
 roll.onpointerdown=e=>{if(!drawMode)return;const q=pos(e);if(q.s<0||q.s>=S.len)return;audio();roll.setPointerCapture(e.pointerId);
  const hit=S.notes.find(n=>n.p===q.p&&q.s>=n.s&&q.s<n.s+n.l);
  if(hit){const edge=q.fx>hit.s+hit.l-0.5;op={n:hit,mode:edge?'resize':'tap',x:e.clientX,y:e.clientY};}
  else{const nn={s:q.s,l:1,p:q.p,v:1};S.notes.push(nn);op={n:nn,mode:'resize',x:e.clientX};const v=synthVoice(ctx,sb(),q.p,ctx.currentTime,S.synth);v.release(ctx.currentTime+0.2);}
  drawRoll();};
 roll.onpointermove=e=>{if(!op)return;const q=pos(e);if(op.mode==='tap'&&Math.hypot(e.clientX-op.x,e.clientY-op.y)>8){op.mode='move';op.off=q.s-op.n.s;}
  if(op.mode==='resize'){op.n.l=Math.max(1,Math.min(S.len-op.n.s,Math.ceil(q.fx-op.n.s)));drawRoll();}
  if(op.mode==='move'){op.n.s=Math.max(0,Math.min(S.len-op.n.l,q.s-op.off));op.n.p=Math.max(PR.lo,Math.min(PR.hi,q.p));drawRoll();}};
 roll.onpointerup=()=>{if(op&&op.mode==='tap'){S.notes.splice(S.notes.indexOf(op.n),1);drawRoll();}op=null;};
 roll.onpointercancel=()=>op=null;})();

// ---------- tabs ----------
$$('#tabs button').forEach(b=>b.onclick=()=>{$$('#tabs button').forEach(x=>x.classList.toggle('on',x===b));$$('.view').forEach(v=>v.classList.toggle('on',v.id==='v-'+b.dataset.v));if(b.dataset.v==='roll'){sizeRoll();const w=$('#rollWrap');if(!w.dataset.sc){w.scrollTop=(PR.hi-67)*PR.rh;w.dataset.sc=1;}}if(b.dataset.v==='proj')listProjects();if(b.dataset.v==='beat')renderTracks();window.dispatchEvent(new CustomEvent('pn-tab',{detail:b.dataset.v}));});
addEventListener('resize',()=>{if($('#v-roll').classList.contains('on'))sizeRoll();$$('.mini').forEach(drawMini);});

// ---------- export ----------
async function renderMix(loops){await renderAll();const sr=44100,n=S.len,sd=stepDur(),len=Math.ceil(n*sd*loops*sr);const oc=new OfflineAudioContext(2,len,sr);
 const m=oc.createGain();m.gain.value=0.9;const comp=oc.createDynamicsCompressor();m.connect(comp);comp.connect(oc.destination);const sbus=oc.createGain();sbus.gain.value=S.synthVol;sbus.connect(m);
 for(let L=0;L<loops;L++)for(let s=0;s<n;s++){const t=(L*n+s)*sd+((s%2)?S.swing*sd*0.5:0);scheduleStep(oc,m,s,t,sbus);}
 return oc.startRendering();}
function wavBlob(buf){const ch=buf.numberOfChannels,len=buf.length,sr=buf.sampleRate,ab=new ArrayBuffer(44+len*ch*2),v=new DataView(ab);const ws=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};
 ws(0,'RIFF');v.setUint32(4,36+len*ch*2,true);ws(8,'WAVE');ws(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,ch,true);v.setUint32(24,sr,true);v.setUint32(28,sr*ch*2,true);v.setUint16(32,ch*2,true);v.setUint16(34,16,true);ws(36,'data');v.setUint32(40,len*ch*2,true);
 const d=[...Array(ch)].map((_,c)=>buf.getChannelData(c));let o=44;for(let i=0;i<len;i++)for(let c=0;c<ch;c++){const x=Math.max(-1,Math.min(1,d[c][i]));v.setInt16(o,x<0?x*0x8000:x*0x7fff,true);o+=2;}return new Blob([ab],{type:'audio/wav'});}
const i16=a=>{const r=new Int16Array(a.length);for(let i=0;i<a.length;i++){const x=Math.max(-1,Math.min(1,a[i]));r[i]=x<0?x*0x8000:x*0x7fff;}return r;};
function mp3Blob(buf){const enc=new lamejs.Mp3Encoder(2,buf.sampleRate,192),L=i16(buf.getChannelData(0)),R=i16(buf.getChannelData(buf.numberOfChannels>1?1:0)),out=[];
 for(let i=0;i<L.length;i+=1152){const b=enc.encodeBuffer(L.subarray(i,i+1152),R.subarray(i,i+1152));if(b.length)out.push(new Uint8Array(b));}const e=enc.flush();if(e.length)out.push(new Uint8Array(e));return new Blob(out,{type:'audio/mpeg'});}
const DRUMMAP=[36,38,42,46,39,41,45,49,51,37,43,47,48,50,56,54];
function midiBlob(){const ppq=96,tps=ppq/4,n=S.len;const vlq=x=>{const b=[x&0x7f];while(x>>=7)b.unshift((x&0x7f)|0x80);return b;};
 const track=(evs,name)=>{evs.sort((a,b)=>a.t-b.t||a.o-b.o);const d=[0,0xff,0x03,name.length,...[...name].map(c=>c.charCodeAt(0)&0x7f)];let last=0;for(const e of evs){d.push(...vlq(e.t-last),...e.b);last=e.t;}d.push(0,0xff,0x2f,0);return[0x4d,0x54,0x72,0x6b,d.length>>>24,(d.length>>16)&255,(d.length>>8)&255,d.length&255,...d];};
 const us=Math.round(60e6/S.bpm);const tempo=track([{t:0,o:0,b:[0xff,0x51,3,us>>16,(us>>8)&255,us&255]},{t:0,o:0,b:[0xff,0x58,4,4,2,24,8]}],'Tempo');
 const drums=[];S.tracks.forEach((tr,i)=>{if(!audible(tr))return;const note=DRUMMAP[i%DRUMMAP.length];for(let s=0;s<n;s++)if(tr.steps[s]>0){const v=Math.max(1,Math.round(tr.steps[s]*127));drums.push({t:s*tps,o:1,b:[0x99,note,v]},{t:s*tps+tps/2,o:0,b:[0x89,note,0]});}});
 const syn=[{t:0,o:0,b:[0xc0,S.preset==='Pad'?89:S.preset==='Keys'?4:S.preset==='Lead'?81:S.preset==='Pluck'?45:38]}];if(synthOn())for(const nt of S.notes)if(nt.s<n){const p=Math.max(0,Math.min(127,nt.p+12*(S.synth.octave||0)));syn.push({t:nt.s*tps,o:1,b:[0x90,p,100]},{t:Math.min(n,nt.s+nt.l)*tps,o:0,b:[0x80,p,0]});}
 const hdr=[0x4d,0x54,0x68,0x64,0,0,0,6,0,1,0,3,0,ppq];return new Blob([new Uint8Array([...hdr,...tempo,...track(drums,'Drums'),...track(syn,'Synth')])],{type:'audio/midi'});}
async function download(blob,name){const f=new File([blob],name,{type:blob.type});
 if(navigator.canShare&&navigator.canShare({files:[f]})&&/iPhone|iPad|Android/i.test(navigator.userAgent)){try{await navigator.share({files:[f],title:name});return;}catch(e){if(e.name==='AbortError')return;}}
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},4000);}
const fname=ext=>(S.name||'pocket').replace(/[^\w\- ]+/g,'').trim().replace(/ /g,'_')+'.'+ext;
const st=m=>$('#expStatus').textContent=m;
$('#expWav').onclick=async()=>{st('Rendering…');const b=await renderMix(+$('#loops').value||1);await download(wavBlob(b),fname('wav'));st('WAV ready ('+b.duration.toFixed(1)+'s)');};
$('#expMp3').onclick=async()=>{st('Rendering…');const b=await renderMix(+$('#loops').value||1);st('Encoding MP3…');await new Promise(r=>setTimeout(r,30));await download(mp3Blob(b),fname('mp3'));st('MP3 ready');};
$('#expMidi').onclick=async()=>{await download(midiBlob(),fname('mid'));st('MIDI ready (drum tracks → GM drum notes C1, D1, F#1…, synth → ch 1)');};

// ---------- projects ----------
const idb=()=>new Promise((res,rej)=>{const r=indexedDB.open('pocketnb',1);r.onupgradeneeded=()=>r.result.createObjectStore('projects',{keyPath:'name'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
const tx=async(mode,fn)=>{const db=await idb();return new Promise((res,rej)=>{const t=db.transaction('projects',mode),s=t.objectStore('projects'),r=fn(s);t.oncomplete=()=>res(r&&r.result);t.onerror=()=>rej(t.error);});};
const usedIds=()=>[...new Set([...S.tracks.map(t=>t.sampleId),...((S.multi&&S.multi.clips)||[]).map(c=>c.bufId)])];
const usedSamples=()=>{const o={};for(const t of usedIds().map(id=>({sampleId:id}))){const b=samples[t.sampleId];if(b&&!o[t.sampleId])o[t.sampleId]={sr:b.sampleRate,ch:[...Array(b.numberOfChannels)].map((_,c)=>new Float32Array(b.getChannelData(c)))};}return o;};
function bufFrom(o){audio();const b=ctx.createBuffer(o.ch.length,o.ch[0].length,o.sr);o.ch.forEach((d,c)=>b.copyToChannel?b.copyToChannel(d,c):b.getChannelData(c).set(d));return b;}
function loadState(st,smp){stop();S=Object.assign(freshState(),st);if(st.len==null||!LENGTHS.includes(S.len)){S.len=LENGTHS.includes(8)?8:LENGTHS[LENGTHS.length-1];if(S.notes)S.notes=S.notes.filter(n=>n.s<S.len).map(n=>({...n,l:Math.min(n.l,S.len-n.s)}));}delete S.bars;for(const t of S.tracks){t.fx=Object.assign(defFx(),t.fx);if(t.steps.length<STEPS)t.steps=t.steps.concat(new Array(STEPS-t.steps.length).fill(0));}
 for(const k in samples)delete samples[k];for(const k in rendered)delete rendered[k];Object.assign(samples,smp);syncTop();renderTracks();renderSynth();sizeRoll();$('#projName').value=S.name;window.dispatchEvent(new Event('pn-load'));}
$('#projSave').onclick=async()=>{const n=$('#projName').value.trim()||S.name||'Untitled';S.name=n;syncTop();try{await tx('readwrite',s=>s.put({name:n,state:JSON.parse(JSON.stringify(S)),samples:usedSamples(),saved:Date.now()}));toast('Saved "'+n+'"');listProjects();}catch(e){toast('Save failed: '+e.message);}};
$('#projNew').onclick=()=>{if(confirm('Start a new empty project? Unsaved changes are lost.'))loadState(freshState(),{});};
async function listProjects(){const box=$('#projList');let all=[];try{all=await tx('readonly',s=>s.getAll());}catch(e){}box.innerHTML=all.length?'':'<p class="hint">No saved projects yet.</p>';
 all.sort((a,b)=>b.saved-a.saved).forEach(p=>{const r=document.createElement('div');r.className='pr';r.innerHTML='<span></span><button>Load</button><button>✕</button>';r.querySelector('span').textContent=p.name+' · '+new Date(p.saved).toLocaleString();
  r.children[1].onclick=()=>{const smp={};for(const k in p.samples)smp[k]=bufFrom(p.samples[k]);loadState(p.state,smp);toast('Loaded "'+p.name+'"');};
  r.children[2].onclick=async()=>{if(confirm('Delete project "'+p.name+'"?')){await tx('readwrite',s=>s.delete(p.name));listProjects();}};box.appendChild(r);});}
const b64=async blob=>{const u=new Uint8Array(await blob.arrayBuffer());let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s);};
$('#projExport').onclick=async()=>{const smp={};for(const id of usedIds())if(samples[id])smp[id]=await b64(wavBlob(samples[id]));
 await download(new Blob([JSON.stringify({app:'pocket-notebook',version:1,state:S,samples:smp})],{type:'application/json'}),fname('json'));};
$('#projImport').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const j=JSON.parse(await f.text());const smp={};for(const k in j.samples){const bin=atob(j.samples[k]),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);smp[k]=await decode(u.buffer);}loadState(j.state,smp);toast('Imported "'+S.name+'"');}catch(err){toast('Import failed: '+err.message);}e.target.value='';};

// ---------- boot ----------
syncTop();renderTracks();renderSynth();
if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('sw.js').catch(()=>{});
window.PN={PR,audio,decode,download,toast,fname,get ctx(){return ctx},get master(){return master},get S(){return S},samples,rendered,renderMix,wavBlob,mp3Blob,midiBlob,addSample,play,stop};
