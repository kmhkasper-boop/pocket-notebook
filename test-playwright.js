const {chromium}=require('playwright');const fs=require('fs');
(async()=>{
const srv=require('http').createServer((q,r)=>{let p='/workspace/pocket-sampler'+(q.url.split('?')[0]==='/'?'/index.html':q.url.split('?')[0]);fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.html')?'text/html':'application/octet-stream'});r.end(d)})}).listen(8123);
const b=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
const c=await b.newContext({permissions:['microphone'],viewport:{width:390,height:844},deviceScaleFactor:2,acceptDownloads:true});
const p=await c.newPage();p.on('dialog',d=>d.accept());const errs=[];p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('pageerror',e=>errs.push('PE '+e.message));
await p.goto(process.env.U||'http://localhost:8123/');await p.click('body');
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
const wb=await (await p.$('#rollWrap')).boundingBox();const rb=await (await p.$('#roll')).boundingBox();const box={x:rb.x,y:wb.y-300+100};const cw=await p.evaluate(()=>PN.PR.cw),kw=await p.evaluate(()=>PN.PR.kw);
await p.mouse.click(box.x+kw+cw/2,box.y+300);await p.mouse.move(box.x+kw+cw*2.5,box.y+300);
await p.mouse.down();await p.mouse.move(box.x+kw+cw*4,box.y+300);await p.mouse.move(box.x+kw+cw*6,box.y+300);await p.mouse.up();
console.log('roll fits',await p.evaluate(()=>[document.querySelector('#roll').clientWidth,document.querySelector('#rollWrap').clientWidth,document.querySelector('#rollWrap').scrollWidth]));
console.log('notes',JSON.stringify(await p.evaluate(()=>PN.S.notes)));await p.screenshot({path:'/tmp/pt/roll.png'});
await p.click('#tabs button[data-v=beat]');await p.waitForTimeout(200);
const lay=async()=>p.evaluate(()=>({bars:PN.S.bars,rowsPerTrack:document.querySelectorAll('.track:not(.synthrow) .brow').length/document.querySelectorAll('.track:not(.synthrow)').length,barsShown:document.querySelector('.track .grid').querySelectorAll('.bar').length,hscroll:document.documentElement.scrollWidth>innerWidth,synthRow:!!document.querySelector('.synthrow'),stepW:document.querySelector('.st').getBoundingClientRect().width}));
console.log('4bar',JSON.stringify(await lay()));await p.screenshot({path:'/tmp/pt/b4.png'});
await p.click('.synthrow .solo');console.log('synthOn solo',await p.evaluate(()=>[PN.S.synthSolo]));await p.click('.synthrow .solo');
await p.click('.synthrow .mini');console.log('roll open',await p.$eval('#v-roll',e=>e.classList.contains('on')));await p.click('#tabs button[data-v=beat]');
await p.click('#bars');await p.waitForTimeout(200);console.log('8bar',JSON.stringify(await lay()));await p.screenshot({path:'/tmp/pt/b8.png'});
await p.setViewportSize({width:844,height:390});await p.waitForTimeout(200);console.log('land',JSON.stringify(await lay()));await p.screenshot({path:'/tmp/pt/land.png'});
await p.click('#tabs button[data-v=roll]');await p.waitForTimeout(200);console.log('roll land',await p.evaluate(()=>[document.querySelector('#roll').clientWidth,document.querySelector('#rollWrap').clientWidth]));await p.screenshot({path:'/tmp/pt/rollland.png'});
await p.setViewportSize({width:390,height:844});await p.click('#tabs button[data-v=beat]');
await p.click('.track .nm');await p.waitForTimeout(300);await p.$eval('.sheetbody',e=>e.scrollTop=2000);await p.waitForTimeout(100);console.log('sticky top',await p.$eval('#edPreview',e=>Math.round(e.getBoundingClientRect().top)),await p.$eval('.sheetbody',e=>Math.round(e.getBoundingClientRect().top)));await p.screenshot({path:'/tmp/pt/edsticky.png'});await p.click('#edClose');
await p.click('#bars');await p.click('#bars');console.log('bars',await p.evaluate(()=>[PN.S.bars,PN.S.notes.length]));
await p.click('#play');
await p.click('#tabs button[data-v=proj]');
for(const [id,ext] of [['#expWav','wav'],['#expMp3','mp3'],['#expMidi','mid'],['#projExport','json']]){const [d]=await Promise.all([p.waitForEvent('download'),p.click(id)]);await d.saveAs('/tmp/pt/out.'+ext);}
await p.fill('#projName','Test Beat');await p.click('#projSave');await p.waitForTimeout(500);
await p.click('#projNew');
console.log('after new',await p.evaluate(()=>PN.S.tracks.length));
await p.click('#projList .pr button:text("Load")');await p.waitForTimeout(300);console.log('after load',await p.evaluate(()=>[PN.S.tracks.length,PN.S.notes.length,PN.S.name]));
await p.setInputFiles('#projImport','/tmp/pt/legacy.json');await p.waitForTimeout(800);console.log('after import',await p.evaluate(()=>[PN.S.bars,PN.S.tracks.length,Object.keys(PN.samples).length]));
await p.setInputFiles('#importAudio','/tmp/pt/out.wav');await p.waitForTimeout(800);console.log('after audio import',await p.evaluate(()=>PN.S.tracks.length));
console.log('sw',await p.evaluate(()=>navigator.serviceWorker.getRegistration().then(r=>!!r)));
console.log('ERRORS',errs);await b.close();srv.close();})();
