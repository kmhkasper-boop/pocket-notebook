const {chromium}=require('playwright');const fs=require('fs');
let root;const srv=require('http').createServer((q,r)=>{let u=q.url.split('?')[0];let p=root+(u==='/'?'/index.html':u);fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.html')?'text/html':'application/octet-stream','cache-control':'max-age=600'});r.end(d)})}).listen(8150);
(async()=>{const b=await chromium.launch();
for(const [name,oldDir,newDir,probe] of [['notebook','/tmp/old-nb','/workspace/pocket-sampler',()=>document.querySelector('#bars').textContent+' | '+(document.querySelector('#appVer')||{}).textContent],
 ['wave','/tmp/old-pw','/workspace/pocket-wave',()=>((document.querySelector('#appVer')||{}).textContent||'no version shown')]]){
 root=oldDir;const c=await b.newContext({viewport:{width:390,height:844}});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8150/');await p.evaluate(()=>navigator.serviceWorker.ready);await p.reload();await p.waitForTimeout(500);
 console.log(name,'old controlled:',await p.evaluate(()=>!!navigator.serviceWorker.controller),'|',await p.evaluate(probe));
 root=newDir; // "deploy"
 await p.reload();await p.waitForTimeout(2500); // old SW serves cached page; browser fetches new sw.js -> installs, claims
 console.log(name,'after 1st reload:',await p.evaluate(probe));
 await p.reload();await p.waitForTimeout(1000);console.log(name,'after 2nd reload:',await p.evaluate(probe));
 // now new SW in control: next deploy should show immediately; test offline fallback
 await c.setOffline(true);await p.reload();await p.waitForTimeout(500);console.log(name,'offline:',await p.evaluate(probe));await c.setOffline(false);
 console.log(name,'errors',errs);await c.close();}
await b.close();srv.close();})();
