const {chromium}=require('playwright');const fs=require('fs');
const U=process.env.U||'http://localhost:8124/';
const srv=require('http').createServer((q,r)=>{let u=q.url.split('?')[0];let p='/workspace/pocket-sampler'+(u==='/'?'/index.html':u);fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.html')?'text/html':'application/octet-stream'});r.end(d)})}).listen(8124);
(async()=>{const b=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
for(const vp of [[390,844],[844,390],[1280,800]]){
const c=await b.newContext({permissions:['microphone'],viewport:{width:vp[0],height:vp[1]},hasTouch:vp[0]<1000,deviceScaleFactor:2,acceptDownloads:true});
const p=await c.newPage();p.on('dialog',d=>d.accept());const errs=[];p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('pageerror',e=>errs.push('PE '+e.message));
const L=(...a)=>console.log(vp.join('x'),...a);
await p.goto(U);await p.click('body');
await p.click('#rec');await p.waitForTimeout(1200);await p.click('#rec');await p.waitForSelector('.track');
// WAVE
await p.click('#tabs button[data-v=wave]');await p.setInputFiles('#wFile','/tmp/pt/out.mp3');await p.waitForTimeout(800);
L('wave mp3',await p.evaluate(()=>PNWave.buf&&PNWave.buf.duration.toFixed(2)));
await p.setInputFiles('#wFile','/tmp/pt/out.wav');await p.waitForTimeout(800);
const cb=await (await p.$('#wcv')).boundingBox();
await p.mouse.move(cb.x+cb.width*0.2,cb.y+50);await p.mouse.down();await p.mouse.move(cb.x+cb.width*0.4,cb.y+60,{steps:5});await p.mouse.up();
L('sel',await p.evaluate(()=>PNWave.sel.map(x=>(x/PNWave.buf.sampleRate).toFixed(2))));
await p.click('#wZi');await p.click('#wZs');await p.click('#wPlaySel');await p.waitForTimeout(300);await p.click('#wStop');
await p.click('#wSil');const rms=await p.evaluate(()=>{const[a,b]=PNWave.sel,d=PNWave.buf.getChannelData(0);let s=0;for(let i=a;i<b;i++)s+=Math.abs(d[i]);return s});L('silenced sum',rms);
await p.click('#wUndo');L('undo restored',await p.evaluate(()=>{const d=PNWave.buf.getChannelData(0);let s=0;for(const v of d)s+=Math.abs(v);return s>0}));
await p.click('#wRedo');await p.click('#wUndo');await p.$eval('#wcv',e=>e.scrollIntoView());await p.click('#wAll');
await p.click('#wFin');await p.click('#wNorm');await p.fill('#wDb','-6');await p.click('#wGain');
await p.evaluate(()=>PNWave.sel=[44100,44100*3]);const d0=await p.evaluate(()=>PNWave.buf.duration);await p.click('#wDel');const d1=await p.evaluate(()=>PNWave.buf.duration);L('delete',d0.toFixed(2),'->',d1.toFixed(2));
await p.click('#wZf');await p.$eval('#wcv',e=>e.scrollIntoView());const cb2=await (await p.$('#wcv')).boundingBox();cb.y=cb2.y;await p.mouse.move(cb.x+cb.width*0.1,cb.y+50);await p.mouse.down();await p.mouse.move(cb.x+cb.width*0.6,cb.y+60,{steps:5});await p.mouse.up();
await p.click('#wTrim');L('trim',await p.evaluate(()=>PNWave.buf.duration.toFixed(2)));
await p.screenshot({path:`/tmp/pt/wave_${vp[0]}.png`});
for(const [id,ext] of [['#wWav','wav'],['#wMp3','mp3'],['#wRec','webm']]){const [d]=await Promise.all([p.waitForEvent('download',{timeout:30000}),p.click(id)]);await d.saveAs('/tmp/pt/w.'+ext);L('wave export',ext,d.suggestedFilename(),fs.statSync('/tmp/pt/w.'+ext).size);}
await p.click('#wToBeat');L('beat tracks',await p.evaluate(()=>PN.S.tracks.length));
await p.click('#wToMulti');
// MULTI
await p.click('#tabs button[data-v=multi]');await p.waitForTimeout(200);
await p.click('#mAddTrack');await p.selectOption('#mSrc',{index:1});await p.click('#mAdd');
await p.setInputFiles('#mFile','/tmp/pt/out.wav');await p.waitForTimeout(600);
L('clips',await p.evaluate(()=>PNMulti.state.clips.map(c=>c.track.slice(0,3)+'@'+c.start.toFixed(2)).join(' ')));
const clip=await p.$('.clip');let bb=await clip.boundingBox();
// move clip right & down to track 2
await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2);await p.mouse.down();await p.mouse.move(bb.x+bb.width/2+80,bb.y+bb.height/2+72,{steps:8});await p.mouse.up();
const c0=await p.evaluate(()=>{const m=PNMulti.state;const c=m.clips[0];return{start:c.start.toFixed(2),trackIdx:m.tracks.findIndex(t=>t.id===c.track)}});L('moved',JSON.stringify(c0));
await p.click('#mZo');await p.click('#mZo');let cl=await p.$(`.clip[data-id="${await p.evaluate(()=>PNMulti.state.clips[0].id)}"]`);bb=await cl.boundingBox();
// trim right edge
await p.click('#mZo');await p.click('#mZo');cl=await p.$(`.clip[data-id="${await p.evaluate(()=>PNMulti.state.clips[0].id)}"]`);bb=await cl.boundingBox();await p.mouse.move(bb.x+bb.width-5,bb.y+40);await p.mouse.down();await p.mouse.move(bb.x+bb.width-25,bb.y+40,{steps:5});await p.mouse.up();
cl=await p.$(`.clip[data-id="${await p.evaluate(()=>PNMulti.state.clips[0].id)}"]`);bb=await cl.boundingBox();
L('el at knob',await p.evaluate(([x,y])=>document.elementFromPoint(x,y).className,[bb.x+1,bb.y+5]));// fade in knob
await p.mouse.move(bb.x+1,bb.y+5);await p.mouse.down();await p.mouse.move(bb.x+31,bb.y+5,{steps:5});await p.mouse.up();
L('trim/fade',await p.evaluate(()=>{const c=PNMulti.state.clips[0];return [c.dur.toFixed(2),c.fadeIn.toFixed(2),c.offset]}));
await p.click('#mSnap');await p.click('#mZi');await p.click('#mPlay');await p.waitForTimeout(800);L('ph moved',await p.$eval('#mPh',e=>e.style.left));await p.click('#mPlay');
await p.screenshot({path:`/tmp/pt/multi_${vp[0]}.png`});
const mix=await p.evaluate(async()=>{const b=await PNMulti.mix();let pk=0;const d=b.getChannelData(0);for(const v of d)pk=Math.max(pk,Math.abs(v));return[b.duration.toFixed(2),pk.toFixed(2)]});L('mix',mix);
for(const [id,ext] of [['#mWav','wav'],['#mMp3','mp3']]){const [d]=await Promise.all([p.waitForEvent('download'),p.click(id)]);await d.saveAs('/tmp/pt/m.'+ext);L('multi export',ext,fs.statSync('/tmp/pt/m.'+ext).size);}
// save/load
await p.click('#tabs button[data-v=proj]');await p.fill('#projName','MT');await p.click('#projSave');await p.waitForTimeout(400);await p.click('#projNew');
await p.click('#projList .pr button:text("Load")');await p.waitForTimeout(400);
L('reloaded multi',await p.evaluate(()=>[PN.S.multi.tracks.length,PN.S.multi.clips.length,PN.S.multi.clips.every(c=>!!PN.samples[c.bufId])]));
const [d]=await Promise.all([p.waitForEvent('download'),p.click('#projExport')]);await d.saveAs('/tmp/pt/mt.json');await p.click('#projNew');await p.setInputFiles('#projImport','/tmp/pt/mt.json');await p.waitForTimeout(800);
L('imported multi',await p.evaluate(()=>[PN.S.multi.clips.length,PN.S.multi.clips.every(c=>!!PN.samples[c.bufId])]));
await p.click('#tabs button[data-v=multi]');
L('hscroll page',await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'tabs fit',await p.evaluate(()=>[...document.querySelectorAll('#tabs button')].every(b=>b.scrollWidth<=b.clientWidth+1)));
L('ERRORS',errs);await c.close();}
await b.close();srv.close();})();
