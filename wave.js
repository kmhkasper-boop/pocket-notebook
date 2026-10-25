'use strict';
(()=>{const $=s=>document.querySelector(s);const P=window.PN;
let buf=null,name='edit',undo=[],redo=[],v0=0,v1=1,a=-1,b=-1,src=null,phStart=0,phOff=0,phEnd=0,raf=0;
const cv=$('#wcv');
const mk=(ch,len,sr)=>P.audio().createBuffer(ch,Math.max(1,len),sr);
const clone=x=>{const n=mk(x.numberOfChannels,x.length,x.sampleRate);for(let c=0;c<x.numberOfChannels;c++)n.getChannelData(c).set(x.getChannelData(c));return n;};
const hasSel=()=>a>=0&&b>a+1;
const rng=()=>hasSel()?[a,b]:[0,buf.length];
function setBuf(x,nm,keep){stop();buf=x;if(nm)name=nm;if(!keep){undo=[];redo=[];}v0=0;v1=1;a=b=-1;draw();}
function push(){undo.push(clone(buf));if(undo.length>30)undo.shift();redo=[];}
window.PNWave={get buf(){return buf},setBuf,get sel(){return[a,b]},set sel(v){[a,b]=v;draw();}};
function fillSrc(){const s=$('#wSrc');s.innerHTML='';P.S.tracks.forEach(t=>{const o=document.createElement('option');o.value=t.sampleId;o.textContent=t.name;s.appendChild(o);});if(!P.S.tracks.length)s.innerHTML='<option value="">(no recorded samples)</option>';}
addEventListener('pn-tab',e=>{if(e.detail==='wave'){fillSrc();draw();}});
$('#wLoadSrc').onclick=()=>{const id=$('#wSrc').value;if(!id||!P.samples[id])return P.toast('Record a sample on Beat tab first');const t=P.S.tracks.find(t=>t.sampleId===id);setBuf(clone(P.samples[id]),t?t.name:'sample');};
$('#wFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{setBuf(await P.decode(await f.arrayBuffer()),f.name.replace(/\.[^.]+$/,''));P.toast('Loaded '+f.name);}catch(err){P.toast('This browser cannot decode '+f.name);}e.target.value='';};
const tt=s=>(s/(buf?buf.sampleRate:44100)).toFixed(3)+'s';
function draw(){const d=devicePixelRatio,W=cv.clientWidth,H=cv.clientHeight;if(!W)return;cv.width=W*d;cv.height=H*d;const g=cv.getContext('2d');g.scale(d,d);g.fillStyle='#0c0e12';g.fillRect(0,0,W,H);
 if(!buf){$('#wInfo').textContent='Open a file or pick a recorded sample. Drag on the waveform to select.';return;}
 const L=buf.length,s0=v0*L,s1=v1*L,spp=(s1-s0)/W,X=i=>(i-s0)/spp,chs=buf.numberOfChannels,ch=[...Array(chs)].map((_,c)=>buf.getChannelData(c)),lh=H/chs;
 if(hasSel()){g.fillStyle='rgba(255,138,61,.22)';g.fillRect(X(a),0,X(b)-X(a),H);}
 for(let c=0;c<chs;c++){const dd=ch[c],mid=lh*c+lh/2;g.fillStyle='#7f8fb8';for(let x=0;x<W;x++){const i0=Math.floor(s0+x*spp),i1=Math.max(i0+1,Math.floor(s0+(x+1)*spp));let mn=0,mx=0;const st=Math.max(1,(i1-i0)>>7);for(let i=i0;i<i1&&i<L;i+=st){const v=dd[i];if(v<mn)mn=v;if(v>mx)mx=v;}g.fillRect(x,mid-mx*lh/2,1,Math.max(1,(mx-mn)*lh/2));}
  g.fillStyle='#333';g.fillRect(0,mid,W,1);}
 if(hasSel()){g.fillStyle='#ff8a3d';g.fillRect(X(a)-1,0,2,H);g.fillRect(X(b)-1,0,2,H);}
 if(src){const p=phOff+(P.ctx.currentTime-phStart)*buf.sampleRate;g.fillStyle='#3ddc84';g.fillRect(X(p)-1,0,2,H);}
 $('#wScroll').value=v1-v0<1?v0/(1-(v1-v0)):0;
 $('#wInfo').textContent=`${name} · ${buf.duration.toFixed(2)}s · ${buf.sampleRate}Hz · ${chs}ch`+(hasSel()?` · sel ${tt(a)}–${tt(b)} (${tt(b-a)})`:' · no selection (ops apply to all)');}
addEventListener('resize',draw);
// selection
let drag=null;
cv.onpointerdown=e=>{if(!buf)return;cv.setPointerCapture(e.pointerId);const W=cv.clientWidth,p=Math.round((v0+(v1-v0)*e.offsetX/W)*buf.length);
 const X=i=>(i/buf.length-v0)/(v1-v0)*W;let mode='new';if(hasSel()){if(Math.abs(e.offsetX-X(a))<16)mode='a';else if(Math.abs(e.offsetX-X(b))<16)mode='b';}
 drag={mode,p,x:e.offsetX};if(mode==='new'){a=b=-1;}draw();};
cv.onpointermove=e=>{if(!drag)return;const W=cv.clientWidth,p=Math.max(0,Math.min(buf.length,Math.round((v0+(v1-v0)*e.offsetX/W)*buf.length)));
 if(drag.mode==='new'){if(Math.abs(e.offsetX-drag.x)<4)return;a=Math.min(drag.p,p);b=Math.max(drag.p,p);}else if(drag.mode==='a'){a=Math.min(p,b-2);}else{b=Math.max(p,a+2);}draw();};
cv.onpointerup=cv.onpointercancel=()=>{drag=null;};
// zoom
const zoom=f=>{if(!buf)return;const c=hasSel()?(a+b)/2/buf.length:(v0+v1)/2;let w=Math.min(1,Math.max(64/buf.length,(v1-v0)*f));v0=Math.max(0,Math.min(1-w,c-w/2));v1=v0+w;draw();};
$('#wZi').onclick=()=>zoom(0.5);$('#wZo').onclick=()=>zoom(2);$('#wZf').onclick=()=>{v0=0;v1=1;draw();};
$('#wZs').onclick=()=>{if(!hasSel())return;v0=a/buf.length;v1=b/buf.length;const m=(v1-v0)*0.05;v0=Math.max(0,v0-m);v1=Math.min(1,v1+m);draw();};
$('#wScroll').oninput=e=>{const w=v1-v0;v0=(+e.target.value)*(1-w);v1=v0+w;draw();};
$('#wAll').onclick=()=>{if(buf){a=0;b=buf.length;draw();}};
// play
function stop(){if(src){try{src.stop()}catch(e){}src.onended=null;src=null;}cancelAnimationFrame(raf);draw();}
function playR(s,e){if(!buf)return;stop();const c=P.audio();src=c.createBufferSource();src.buffer=buf;src.connect(P.master);phStart=c.currentTime+0.02;phOff=s;src.start(phStart,s/buf.sampleRate,(e-s)/buf.sampleRate);src.onended=()=>{src=null;draw();};
 const loop=()=>{if(!src)return;draw();raf=requestAnimationFrame(loop);};loop();}
$('#wPlaySel').onclick=()=>hasSel()?playR(a,b):P.toast('No selection');$('#wPlayAll').onclick=()=>buf&&playR(0,buf.length);$('#wStop').onclick=stop;
// ops
const need=()=>{if(!buf){P.toast('Load audio first');return false;}stop();return true;};
const each=(fn)=>{const[s,e]=rng();for(let c=0;c<buf.numberOfChannels;c++){const d=buf.getChannelData(c);for(let i=s;i<e;i++)d[i]=fn(d[i],i-s,e-s);}};
function rebuild(keepFn){/* keepFn(i) -> bool for samples kept */}
$('#wTrim').onclick=()=>{if(!need()||!hasSel())return P.toast('Select a region');push();const n=mk(buf.numberOfChannels,b-a,buf.sampleRate);for(let c=0;c<buf.numberOfChannels;c++)n.getChannelData(c).set(buf.getChannelData(c).subarray(a,b));buf=n;a=b=-1;v0=0;v1=1;draw();};
$('#wDel').onclick=()=>{if(!need()||!hasSel())return P.toast('Select a region');if(b-a>=buf.length)return P.toast('Cannot delete everything');push();const n=mk(buf.numberOfChannels,buf.length-(b-a),buf.sampleRate);for(let c=0;c<buf.numberOfChannels;c++){const d=buf.getChannelData(c),o=n.getChannelData(c);o.set(d.subarray(0,a));o.set(d.subarray(b),a);}buf=n;b=-1;a=-1;v0=0;v1=1;draw();};
$('#wSil').onclick=()=>{if(!need())return;push();each(()=>0);draw();};
$('#wFin').onclick=()=>{if(!need())return;push();each((v,i,n)=>v*(i/n));draw();};
$('#wFout').onclick=()=>{if(!need())return;push();each((v,i,n)=>v*(1-i/n));draw();};
$('#wNorm').onclick=()=>{if(!need())return;const[s,e]=rng();let pk=0;for(let c=0;c<buf.numberOfChannels;c++){const d=buf.getChannelData(c);for(let i=s;i<e;i++)pk=Math.max(pk,Math.abs(d[i]));}if(!pk)return;push();const k=0.989/pk;each(v=>v*k);draw();P.toast('Normalized (×'+k.toFixed(2)+')');};
$('#wGain').onclick=()=>{if(!need())return;push();const k=Math.pow(10,(+$('#wDb').value||0)/20);each(v=>Math.max(-1,Math.min(1,v*k)));draw();};
$('#wUndo').onclick=()=>{if(!undo.length)return;stop();redo.push(buf);buf=undo.pop();a=b=-1;v0=0;v1=1;draw();};
$('#wRedo').onclick=()=>{if(!redo.length)return;stop();undo.push(buf);buf=redo.pop();a=b=-1;v0=0;v1=1;draw();};
// export
const nm=ext=>name.replace(/[^\w\- ]+/g,'').trim().replace(/ /g,'_')+'.'+ext;
$('#wWav').onclick=()=>buf&&P.download(P.wavBlob(buf),nm('wav'));
$('#wMp3').onclick=()=>buf&&P.download(P.mp3Blob(buf),nm('mp3'));
$('#wRec').onclick=async()=>{if(!buf)return;const mime=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/webm','audio/mp4'].find(m=>window.MediaRecorder&&MediaRecorder.isTypeSupported(m));if(!mime)return P.toast('MediaRecorder export not supported here');
 const c=P.audio(),dst=c.createMediaStreamDestination(),s=c.createBufferSource();s.buffer=buf;s.connect(dst);const r=new MediaRecorder(dst.stream,{mimeType:mime});const ch=[];r.ondataavailable=e=>e.data.size&&ch.push(e.data);
 const done=new Promise(res=>r.onstop=res);r.start();s.start();P.toast('Recording realtime ('+buf.duration.toFixed(1)+'s)…');s.onended=()=>setTimeout(()=>r.stop(),150);await done;
 const ext=mime.includes('ogg')?'ogg':mime.includes('mp4')?'m4a':'webm';await P.download(new Blob(ch,{type:mime.split(';')[0]}),nm(ext));};
$('#wToBeat').onclick=()=>{if(!buf)return;P.addSample(clone(buf),name.slice(0,20),true);P.toast('Added as beat track');};
$('#wToMulti').onclick=()=>{if(!buf)return;window.PNMulti&&PNMulti.addBuffer(clone(buf),name);P.toast('Added to multitrack');};
})();
