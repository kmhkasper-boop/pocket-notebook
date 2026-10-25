const {chromium}=require('playwright');const fs=require('fs');const U=process.env.U||'http://localhost:8130/';const srv=process.env.U?null:require('./srv')('/workspace/pocket-sampler',8130);
(async()=>{const b=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
for(const vp of [[390,844],[844,390],[1280,800]]){const c=await b.newContext({permissions:['microphone'],viewport:{width:vp[0],height:vp[1]},deviceScaleFactor:2,acceptDownloads:true});
const p=await c.newPage();p.on('dialog',d=>d.accept());const errs=[];p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('pageerror',e=>errs.push('PE '+e.message));const L=(...a)=>console.log(vp.join('x'),...a);
await p.goto(U);await p.click('body');L('tabs',await p.$$eval('#tabs button',x=>x.map(e=>e.textContent).join('|')),'len',await p.textContent('#bars'));
await p.click('#rec');await p.waitForTimeout(1200);await p.click('#rec');await p.waitForSelector('.track');
await p.setInputFiles('#importAudio','/tmp/pt/w.wav');await p.waitForTimeout(500);
const sts=await p.$$('.track:first-child .st');L('steps shown',sts.length,'w',Math.round((await sts[0].boundingBox()).width),'h',Math.round((await sts[0].boundingBox()).height));
for(const i of [0,2,4,6])await sts[i].click();
await p.click('.track .nm');await p.waitForTimeout(300);await p.click('#edCtl button:has-text("Boom")');await p.click('#edClose');
await p.click('#tabs button[data-v=roll]');await p.waitForTimeout(200);const wb=await (await p.$('#rollWrap')).boundingBox();const [cw,kw]=await p.evaluate(()=>[PN.PR.cw,PN.PR.kw]);
await p.mouse.click(wb.x+kw+cw/2,wb.y+100);await p.mouse.move(wb.x+kw+cw*2.5,wb.y+150);await p.mouse.down();await p.mouse.move(wb.x+kw+cw*5,wb.y+150,{steps:4});await p.mouse.up();
L('notes',JSON.stringify(await p.evaluate(()=>PN.S.notes.map(n=>[n.s,n.l]))),'roll w',await p.$eval('#roll',e=>e.clientWidth),'wrap',await p.$eval('#rollWrap',e=>e.clientWidth));
await p.click('#tabs button[data-v=beat]');L('synth row',!!await p.$('.synthrow'));
await p.click('#play');await p.waitForTimeout(1000);L('playing cur',await p.$$eval('.st.cur',x=>x.length));await p.click('#play');
await p.click('#bars');L('toggle ->',await p.textContent('#bars'),await p.$$eval('.track:first-child .st',x=>x.length),'notes',JSON.stringify(await p.evaluate(()=>PN.S.notes.map(n=>[n.s,n.l]))));
await p.click('#bars');L('toggle ->',await p.textContent('#bars'));
L('hscroll',await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth));await p.screenshot({path:`/tmp/pt/nb_${vp[0]}.png`});
await p.click('#tabs button[data-v=proj]');
for(const [id,ext] of [['#expWav','wav'],['#expMp3','mp3'],['#expMidi','mid'],['#projExport','json']]){const [d]=await Promise.all([p.waitForEvent('download'),p.click(id)]);await d.saveAs('/tmp/pt/nb.'+ext);}
await p.fill('#projName','NB');await p.click('#projSave');await p.waitForTimeout(300);await p.click('#projNew');await p.click('#projList .pr button:text("Load")');await p.waitForTimeout(300);
L('reload',await p.evaluate(()=>[PN.S.len,PN.S.tracks.length,PN.S.notes.length]));
await p.setInputFiles('#projImport','/tmp/pt/legacy.json');await p.waitForTimeout(600);L('legacy import',await p.evaluate(()=>[PN.S.len,PN.S.tracks.length,PN.S.tracks[0].steps.slice(0,8).join(''),Math.max(0,...PN.S.notes.map(n=>n.s+n.l))]));
L('ERRORS',errs);await c.close();}
await b.close();srv&&srv.close();})();
