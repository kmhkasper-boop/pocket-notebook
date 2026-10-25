const {chromium}=require('playwright');const U=process.env.U||'http://localhost:8160/';const srv=process.env.U?null:require('./srv')('/workspace/pocket-sampler',8160);
(async()=>{const b=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});const c=await b.newContext({permissions:['microphone'],viewport:{width:390,height:844}});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
await p.goto(U);await p.click('body');await p.setInputFiles('#importAudio','/tmp/pt/w.wav');await p.waitForTimeout(400);const st=await p.$$('.st');for(const i of[0,4,8,12])await st[i].click();
const snap=()=>p.evaluate(()=>({state:PN.ctx.state,t:PN.ctx.currentTime.toFixed(2),next:PN.nextTime.toFixed(2),sched:PN.AUD.sched,resyncs:PN.AUD.resyncs,recreated:PN.AUD.recreated,playing:PN.playing,tracks:PN.S.tracks.length}));
await p.click('#play');await p.waitForTimeout(800);console.log('playing',JSON.stringify(await snap()));
await p.click('#rec');await p.waitForTimeout(1500);console.log('during rec',JSON.stringify(await snap()));await p.click('#rec');await p.waitForTimeout(1200);
const a=await snap();await p.waitForTimeout(800);const b2=await snap();console.log('after rec',JSON.stringify(b2),'scheduling advanced',b2.sched>a.sched,'time advanced',+b2.t>+a.t,'rendered new',await p.evaluate(()=>!!PN.rendered[PN.S.tracks[1].id]));
// simulate iOS interruption: suspend; should auto resume
await p.evaluate(()=>PN.ctx.suspend());await p.waitForTimeout(1000);const c1=await snap();console.log('after suspend',JSON.stringify(c1),'next>=t',+c1.next>=+c1.t);
// simulate stuck context: monkeypatch resume to no-op and suspend -> watchdog should recreate
await p.evaluate(()=>{const x=PN.ctx;x.resume=()=>Promise.resolve();return x.suspend();});await p.waitForTimeout(2500);const c2=await snap();console.log('after stuck',JSON.stringify(c2));
await p.waitForTimeout(600);const c3=await snap();console.log('still scheduling',c3.sched>c2.sched,c3.state);
// visibility
await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await p.waitForTimeout(300);console.log('final',JSON.stringify(await snap()),'ver',await p.textContent('#appVer'));
console.log('ERRORS',errs);await b.close();srv&&srv.close();})();
