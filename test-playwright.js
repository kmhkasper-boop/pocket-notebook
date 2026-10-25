const {chromium}=require('playwright');const fs=require('fs');
(async()=>{
const srv=require('http').createServer((q,r)=>{let p='/workspace/pocket-sampler'+(q.url.split('?')[0]==='/'?'/index.html':q.url.split('?')[0]);fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.html')?'text/html':'application/octet-stream'});r.end(d)})}).listen(8123);
const b=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
const c=await b.newContext({permissions:['microphone'],viewport:{width:390,height:844},deviceScaleFactor:2,acceptDownloads:true});
const p=await c.newPage();p.on('dialog',d=>d.accept());const errs=[];p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('pageerror',e=>errs.push('PE '+e.message));
await p.goto('http://localhost:8123/');await p.click('body');
await p.click('#rec');await p.waitForTimeout(1500);await p.click('#rec');await p.waitForSelector('.track');
console.log('tracks',await p.$$eval('.track',x=>x.length),'dur',await p.evaluate(()=>Object.values(PN.samples)[0].duration));
// import a generated wav as 2nd sample
await p.evaluate(()=>{const c=new OfflineAudioContext(1,22050,44100);return null});
const sts=await p.$$('.track .st');for(const i of [0,4,8,12])await sts[i].click();
// step on long-press velocity
await sts[2].hover();await p.mouse.down();await p.waitForTimeout(600);await p.mouse.up();
console.log('steps',await p.evaluate(()=>PN.S.tracks[0].steps.slice(0,16).join(',')));
// editor
await p.click('.track .nm');await p.waitForTimeout(500);
for(const t of ['Band-pass','Boom','Reverb'])await p.click(`#edCtl button:has-text("${t}")`);
await p.$eval('#edCtl input[type=range]',e=>{e.value=0.5;e.dispatchEvent(new Event('input'))});
await p.waitForTimeout(800);await p.screenshot({path:'/tmp/pt/editor.png'});await p.click('#edClose');
await p.click('#play');await p.waitForTimeout(1500);console.log('cur',await p.$$eval('.st.cur',x=>x.length));await p.screenshot({path:'/tmp/pt/beat.png'});
await p.click('#tabs button[data-v=synth]');await p.screenshot({path:'/tmp/pt/synth.png'});
await p.click('#tabs button[data-v=roll]');await p.waitForTimeout(200);
const wb=await (await p.$('#rollWrap')).boundingBox();const rb=await (await p.$('#roll')).boundingBox();const box={x:rb.x,y:wb.y-300+100};
await p.mouse.click(box.x+40+13,box.y+300);await p.mouse.move(box.x+40+13+26*2,box.y+300);
await p.mouse.down();await p.mouse.move(box.x+40+26*4,box.y+330);await p.mouse.move(box.x+40+26*6,box.y+330);await p.mouse.up();
console.log('notes',JSON.stringify(await p.evaluate(()=>PN.S.notes)));await p.screenshot({path:'/tmp/pt/roll.png'});
await p.click('#bars');console.log('bars',await p.evaluate(()=>[PN.S.bars,PN.S.notes.length]));
await p.click('#play');
await p.click('#tabs button[data-v=proj]');
for(const [id,ext] of [['#expWav','wav'],['#expMp3','mp3'],['#expMidi','mid'],['#projExport','json']]){const [d]=await Promise.all([p.waitForEvent('download'),p.click(id)]);await d.saveAs('/tmp/pt/out.'+ext);}
await p.fill('#projName','Test Beat');await p.click('#projSave');await p.waitForTimeout(500);
await p.click('#projNew');
console.log('after new',await p.evaluate(()=>PN.S.tracks.length));
await p.click('#projList .pr button:text("Load")');await p.waitForTimeout(300);console.log('after load',await p.evaluate(()=>[PN.S.tracks.length,PN.S.notes.length,PN.S.name]));
await p.setInputFiles('#projImport','/tmp/pt/out.json');await p.waitForTimeout(800);console.log('after import',await p.evaluate(()=>[PN.S.tracks.length,Object.keys(PN.samples).length]));
await p.setInputFiles('#importAudio','/tmp/pt/out.wav');await p.waitForTimeout(800);console.log('after audio import',await p.evaluate(()=>PN.S.tracks.length));
console.log('sw',await p.evaluate(()=>navigator.serviceWorker.getRegistration().then(r=>!!r)));
console.log('ERRORS',errs);await b.close();srv.close();})();
