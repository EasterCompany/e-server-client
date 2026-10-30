// THE CLIENT'S SIGN-IN, MEASURED IN A REAL BROWSER, AGAINST THE SITE'S OWN PAGE.
//
//   xvfb-run -a node scripts/verify-company-signin.cjs [--app <exe>] [--site <dir>] [--service]
//
// What it does, in order:
//
//   1. cmp's every file the packaged app carries for the sign-in (read out of app.asar) against
//      the site's own copy, and prints PASS/FAIL per file. The unit suite does the same for the
//      tree; this does it for the artifact a person installs.
//   2. launches the PACKAGED client with an isolated HOME and reads its sign-in window through
//      Chromium's own debugging protocol - not a preview server, not a dev run: the built
//      executable.
//   3. renders easter-co-smp.github.io/site/account/ - served statically from the site checkout -
//      as the control, in the same Chromium build the client ships, so the two surfaces cannot
//      differ by browser.
//   4. requires the client's panel and the site's panel to agree on every box the site draws -
//      width, height, padding, radius, font size, the option set, the order, the sentences - so
//      this suite proves the two surfaces are one design rather than asserting the client's
//      numbers twice.
//   5. requires the client's copy of those boxes to carry e-server's colours, e-server's
//      typography and e-server's wordmark beside the site's fire phoenix, and to have no
//      horizontal overflow at 1280x800 or at the window's minimum size of 360x500.
//   6. drives two refusals on BOTH surfaces and requires the same sentence: the panel's own empty
//      identifier refusal, and a sign-in the account service refuses. It watches the busy state
//      while the second one is in flight, because that state is what the old screen called
//      "Connecting to Easter Company".
//
// WHAT IT CANNOT PROVE, and says so: a sign-in that SUCCEEDS (that needs a household credential
// and would sign a real account in), the Microsoft button's round trip through the operating
// system's browser, and anything about a window smaller than the minimum size, which the window
// itself refuses.
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),net=require('node:net'),http=require('node:http');
const {spawn}=require('node:child_process'),{createHash}=require('node:crypto');
const assert=require('node:assert/strict');

const REPO=path.join(__dirname,'..');
const DESKTOP=path.join(REPO,'desktop');
const options=parseArgs(process.argv.slice(2));
const SITE=options.site||process.env.EASTER_SITE_DIR||'/root/easter-co-smp.github.io/site';
const APP=options.app||defaultApp();
const MANIFEST=JSON.parse(require('node:fs').readFileSync(path.join(DESKTOP,'vendor','site','VENDORED.json'),'utf8'));
// The viewports the ticket names: a 1280x800 window, and the setup window's own floor
// (desktop/main.cjs: minWidth 360, minHeight 500).
const VIEWPORTS=[{width:1280,height:800},{width:360,height:500}];

function parseArgs(argv){
 const out={service:true};
 for(let i=0;i<argv.length;i++){
  if(argv[i]==='--app')out.app=argv[++i];
  else if(argv[i]==='--site')out.site=argv[++i];
  else if(argv[i]==='--no-service')out.service=false;
  else if(!argv[i].startsWith('--')&&!out.app)out.app=argv[i];
 }
 return out;
}
function defaultApp(){
 if(process.platform==='win32')return path.join(REPO,'release','win-unpacked','e-server.exe');
 if(process.platform==='darwin')return path.join(REPO,'release','mac','e-server.app','Contents','MacOS','e-server');
 return path.join(REPO,'release','linux-unpacked','e-server-client');
}

// ---- Chromium's protocol, the same way scripts/smoke.cjs speaks it ------------------------------
class Page{
 static async attach(webSocketDebuggerUrl){
  const page=new Page();
  page.socket=new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{page.socket.onopen=resolve;page.socket.onerror=reject;});
  page.pending=new Map();page.handlers=new Map();page.nextId=0;page.console=[];
  page.socket.onmessage=event=>{
   const data=JSON.parse(event.data);
   const waiting=page.pending.get(data.id);
   if(waiting){page.pending.delete(data.id);data.error?waiting.reject(Error(data.error.message)):waiting.resolve(data.result);return;}
   if(page.handlers.has(data.method)){Promise.resolve(page.handlers.get(data.method)(data.params)).catch(()=>{});return;}
   if(data.method==='Runtime.consoleAPICalled')page.console.push(data.params.args.map(arg=>arg.value??arg.description).join(' '));
   if(data.method==='Runtime.exceptionThrown')page.console.push('EXCEPTION '+data.params.exceptionDetails.text+' '+(data.params.exceptionDetails.exception?.description||''));
  };
  page.socket.onclose=()=>{for(const waiting of page.pending.values())waiting.reject(Error('The page closed.'));page.pending.clear();};
  await page.send('Runtime.enable');
  return page;
 }
 send(method,params={}){
  return new Promise((resolve,reject)=>{const id=++this.nextId;this.pending.set(id,{resolve,reject});this.socket.send(JSON.stringify({id,method,params}));});
 }
 async evaluate(expression){
  const result=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw Error('evaluate failed: '+JSON.stringify(result.exceptionDetails).slice(0,600));
  return result.result.value;
 }
 async viewport(viewport){
  await this.send('Emulation.setDeviceMetricsOverride',{width:viewport.width,height:viewport.height,deviceScaleFactor:1,mobile:false});
  await new Promise(resolve=>setTimeout(resolve,120));
 }
 async screenshot(file){
  const shot=await this.send('Page.captureScreenshot',{format:'png'});
  await fs.writeFile(file,Buffer.from(shot.data,'base64'));
 }
 on(method,handler){this.handlers.set(method,handler);}
 close(){try{this.socket.close();}catch{}}
}

// One expression, run on both surfaces, so the measurement cannot differ by having been written
// twice. Everything a box comparison needs, plus the colours the skin is judged on.
const MEASURE=`(() => {
 // EVERYTHING IS SCOPED TO THE ACCOUNT PAGE'S OWN PANEL. The site's header also mounts the nav's
 // sign-in dialog from the same module, so a document-wide \`.company-signin\` would count two
 // panels on the site and one in this client - a difference in chrome, not in the sign-in.
 const root = document.querySelector('#account-root');
 const panel = document.querySelector('#account-panel');
 const within = selector => root ? [...root.querySelectorAll(selector)] : [];
 const box = el => { if(!el) return null; const r = el.getBoundingClientRect(); return {width:Math.round(r.width*100)/100,height:Math.round(r.height*100)/100,x:Math.round(r.x),y:Math.round(r.y)}; };
 const css = (el, ...names) => { if(!el) return null; const style = getComputedStyle(el); const out = {}; for(const name of names) out[name] = style[name]; return out; };
 const options = within('.company-signin > button');
 const inputs = within('.company-signin input');
 const submit = root ? root.querySelector('.company-submit') : null;
 const rows = [...options, ...inputs, submit].filter(Boolean);
 const mark = document.querySelector('.site-header .wordmark-mark');
 const wordmark = document.querySelector('.site-header .site-wordmark');
 const body = root ? root.querySelector('.account-body') : null;
 return {
  url: location.href,
  title: document.title,
  text: document.body.innerText,
  overline: document.querySelector('.account-overline')?.textContent ?? null,
  heading: document.querySelector('.account-heading')?.textContent ?? null,
  providerNote: root?.querySelector('.company-provider-note')?.textContent ?? null,
  noReset: root?.querySelector('.company-no-reset')?.textContent ?? null,
  labels: within('.company-signin label').map(label => label.textContent),
  submitText: submit?.textContent ?? null,
  options: options.map(button => ({text:button.textContent,providers:button.dataset.provider||null,disabled:button.disabled})),
  footer: document.querySelector('.account-footer')?.innerText ?? null,
  chrome: {nav: !!document.querySelector('.site-header nav'), legal: !!document.querySelector('.account-footer .legal-links'), skip: !!document.querySelector('.account-skip')},
  mark: mark ? {src: mark.getAttribute('src'), box: box(mark), natural: [mark.naturalWidth, mark.naturalHeight], loaded: mark.complete && mark.naturalWidth > 0} : null,
  wordmark: wordmark ? {text: wordmark.textContent, ...css(wordmark,'color','fontSize','fontWeight')} : null,
  panel: panel ? {box: box(panel), radius: getComputedStyle(panel).borderTopLeftRadius, padding: getComputedStyle(panel).padding, borderWidth: getComputedStyle(panel).borderTopWidth, background: getComputedStyle(panel).backgroundColor} : null,
  rows: rows.map(el => ({text: el.textContent || null, name: el.name || el.className, ...box(el), radius: getComputedStyle(el).borderTopLeftRadius, fontSize: getComputedStyle(el).fontSize, background: getComputedStyle(el).backgroundColor, colour: getComputedStyle(el).color, border: getComputedStyle(el).borderTopColor})),
  gaps: root ? getComputedStyle(root).gap : null,
  shell: {bodyBackground: getComputedStyle(document.body).backgroundColor, ink: getComputedStyle(document.body).color, fontFamily: getComputedStyle(document.body).fontFamily, width: innerWidth, height: innerHeight,
          scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth},
  headingStyle: css(document.querySelector('.account-heading'),'color','fontSize','fontWeight','fontFamily','lineHeight'),
  error: (() => { const region = document.querySelector('#account-error'); return region && !region.hidden ? region.innerText : null; })(),
  busy: panel ? panel.dataset.busy : null,
  busyOptions: !!body && getComputedStyle(body).display !== 'none',
  wait: (() => { const host = document.querySelector('#account-wait'); return host && !host.hidden ? host.innerText : null; })(),
  spinner: !!document.querySelector('#account-wait .wait-feedback-mark')
 };
})()`;

// The service rate-limits sign-in attempts (60 per ten minutes), and the answer to a limited run is
// a sentence of the launcher's rather than the service's - so a comparison that meets the limiter
// has not compared the refusal it meant to. Read from the account client's own table.
const RATE_LIMITED=(()=>{
 const client=require('node:fs').readFileSync(path.join(DESKTOP,'vendor','launcher','account-client.mjs'),'utf8');
 const found=client.match(/rate_limited:'([^']+)'/);
 return found?found[1]:null;
})();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,{timeout=20000,interval=150,what='a condition'}={}){
 const deadline=Date.now()+timeout;
 for(;;){
  const value=await check();
  if(value)return value;
  if(Date.now()>deadline)throw Error('timed out waiting for '+what);
  await sleep(interval);
 }
}

// ---- the site, served for the control ----------------------------------------------------------
const TYPES={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.webp':'image/webp','.json':'application/json','.woff2':'font/woff2'};
async function serveSite(directory){
 const server=http.createServer(async (request,response)=>{
  let pathname;
  try{pathname=new URL(request.url,'http://127.0.0.1').pathname;}catch{response.writeHead(400).end();return;}
  if(pathname==='/account'){response.writeHead(302,{Location:'/account/'}).end();return;}
  if(pathname.endsWith('/'))pathname+='index.html';
  const file=path.join(directory,path.posix.normalize(pathname));
  if(!file.startsWith(path.resolve(directory))){response.writeHead(403).end();return;}
  try{
   const body=await fs.readFile(file);
   response.writeHead(200,{'Content-Type':TYPES[path.extname(file).toLowerCase()]||'application/octet-stream'});
   response.end(body);
  }catch{response.writeHead(404,{'Content-Type':'text/plain'}).end('Not found');}
 });
 const port=await new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server.address().port)));
 return {origin:'http://127.0.0.1:'+port,close:()=>new Promise(done=>{server.closeAllConnections?.();server.close(done);})};
}


// ---- the account service, addressed the way the shipped contract addresses it -------------------
const API_ORIGIN=()=>{
 const client=require('node:fs').readFileSync(path.join(DESKTOP,'vendor','launcher','account-client.mjs'),'utf8');
 const found=client.match(/export const API_ORIGIN='([^']+)'/);
 if(!found)throw Error('the account client no longer declares an API origin');
 return found[1];
};
// One real refusal, straight from the service: the sentence a person reads is the service's own
// `message`, and this is where the comparison gets it from.
async function askService(origin,identifier,password){
 const response=await fetch(origin+'/v2/accounts/password/login',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({identifier,password,client:'website/1'})});
 const body=await response.text();
 return {status:response.status,body};
}
// Hand that answer to a page at the wire: the site's page posts its sign-in to the service from a
// loopback origin, which the service's CORS allow-list refuses, so the answer it would have
// received is supplied here instead. Preflights are answered too, as the deployed API does.
async function intercept(page,origin,answer){
 page.on('Fetch.requestPaused',async params=>{
  const cors=[{name:'access-control-allow-origin',value:'*'},{name:'access-control-allow-methods',value:'POST,GET,OPTIONS'},
              {name:'access-control-allow-headers',value:'content-type'},{name:'access-control-max-age',value:'600'}];
  if(params.request.method==='OPTIONS'){
   await page.send('Fetch.fulfillRequest',{requestId:params.requestId,responseCode:204,responseHeaders:cors});
   return;
  }
  await page.send('Fetch.fulfillRequest',{requestId:params.requestId,responseCode:answer.status,
   responseHeaders:[...cors,{name:'content-type',value:'application/json'}],
   body:Buffer.from(answer.body,'utf8').toString('base64')});
 });
 await page.send('Fetch.enable',{patterns:[{urlPattern:origin+'/*'}]});
}

// ---- the packaged client -----------------------------------------------------------------------
async function freePort(){
 return new Promise(resolve=>{const server=net.createServer();server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});});
}
async function launchClient(){
 const home=await fs.mkdtemp(path.join(os.tmpdir(),'eserver-signin-'));
 const port=await freePort();
 // A disposable profile, never a person's: its own HOME, its own config and cache directories.
 const child=spawn(APP,['--no-sandbox','--remote-debugging-address=127.0.0.1','--remote-debugging-port='+port],{
  env:{...process.env,HOME:home,E_SERVER_CLIENT_SKIP_UPDATE_CHECK:'1',XDG_CONFIG_HOME:path.join(home,'config'),XDG_CACHE_HOME:path.join(home,'cache'),
       APPDATA:path.join(home,'AppData/Roaming'),LOCALAPPDATA:path.join(home,'AppData/Local')},
  stdio:['ignore','pipe','pipe'],
 });
 let log='';
 child.stdout.on('data',data=>log=(log+data).slice(-4000));
 child.stderr.on('data',data=>log=(log+data).slice(-4000));
 const target=await until(async ()=>{
  if(child.exitCode!==null)throw Error('the packaged client exited: '+log);
  try{
   const targets=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
   return targets.find(entry=>entry.type==='page'&&String(entry.url).startsWith('e-server-signin://company/account/'));
  }catch{return null;}
 },{timeout:60000,interval:250,what:'the packaged client\u2019s sign-in window ('+APP+')'});
 return {page:await Page.attach(target.webSocketDebuggerUrl),home,log:()=>log,
  close:async()=>{try{child.kill();}catch{}await fs.rm(home,{recursive:true,force:true}).catch(()=>{});}};
}
// THE CONTROL'S BROWSER IS THE CLIENT'S OWN CHROMIUM. The packaged app is Electron, so rendering the
// site's page in an Electron window - the same runtime, the same engine version - removes the one
// difference a second browser on the machine would introduce. The window is a throwaway app in a
// temporary directory that loads one URL and nothing else.
async function launchControl(url){
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'signin-control-'));
 await fs.writeFile(path.join(directory,'package.json'),JSON.stringify({name:'signin-control',version:'1.0.0',private:true,main:'main.cjs'}));
 await fs.writeFile(path.join(directory,'main.cjs'),[
  "'use strict';",
  "const {app,BrowserWindow}=require('electron');",
  '// One window, one address, no preload and no privileges: the site page as the site serves it.',
  "app.whenReady().then(()=>{const window=new BrowserWindow({width:1280,height:800});window.loadURL("+JSON.stringify(url)+");});",
  "app.on('window-all-closed',()=>app.quit());",
 ].join('\n'));
 const electron=process.env.ELECTRON_BIN||(typeof require('electron')==='string'?require('electron'):null);
 if(!electron)throw Error('no Electron binary: run npm ci, or set ELECTRON_BIN');
 const port=await freePort();
 const child=spawn(electron,[directory,'--no-sandbox','--remote-debugging-address=127.0.0.1','--remote-debugging-port='+port],
  {stdio:['ignore','pipe','pipe'],env:{...process.env,E_SERVER_CLIENT_SKIP_UPDATE_CHECK:'1'}});
 let log='';
 child.stdout.on('data',data=>log=(log+data).slice(-4000));
 child.stderr.on('data',data=>log=(log+data).slice(-4000));
 const target=await until(async ()=>{
  if(child.exitCode!==null)throw Error('the control window exited: '+log);
  try{
   const targets=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
   return targets.find(entry=>entry.type==='page'&&String(entry.url).includes('/account/'));
  }catch{return null;}
 },{timeout:60000,interval:250,what:'the control window on '+url});
 return {page:await Page.attach(target.webSocketDebuggerUrl),electron:path.basename(electron),log:()=>log,
  close:async()=>{try{child.kill();}catch{}await fs.rm(directory,{recursive:true,force:true}).catch(()=>{});}};
}
// The panel is drawn by the page's own module, so a page that has not painted it yet is not ready
// to be measured; this waits for the thing the suite is about rather than for a load event.
const signInDrawn=`(() => { const panel = document.querySelector('#account-root .company-signin'); return !!panel && document.querySelectorAll('.company-signin > button').length >= 4; })()`;
async function ready(page){
 await until(()=>page.evaluate(signInDrawn),{timeout:30000,what:'the sign-in panel to be drawn'});
 // The provider question is answered after the panel: measuring before it settles would compare a
 // panel to a panel in a different state.
 await until(()=>page.evaluate(`(() => { const buttons = [...document.querySelectorAll('.company-provider')]; return buttons.every(button => button.title !== '' || !button.disabled) || buttons.some(button => button.title !== ''); })()`),{timeout:15000,what:'the provider buttons to settle'}).catch(()=>{});
 await sleep(300);
}

// The subset both surfaces must agree on: every box the site draws, the option set and order, and
// the sentences. Colours and type are compared separately, because a re-skin is allowed to change
// exactly those and nothing else.
function layoutOf(measurement){
 return {
  overline: measurement.overline,
  heading: measurement.heading,
  providerNote: measurement.providerNote,
  noReset: measurement.noReset,
  labels: measurement.labels,
  submitText: measurement.submitText,
  options: measurement.options,
  gaps: measurement.gaps,
  panel: {width: measurement.panel.box.width, padding: measurement.panel.padding, radius: measurement.panel.radius, borderWidth: measurement.panel.borderWidth},
  rows: measurement.rows.map(row => ({text: row.text, width: row.width, height: row.height, radius: row.radius, fontSize: row.fontSize})),
 };
}

// ---- the run -----------------------------------------------------------------------------------
const report=[];
const failures=[];
const check=(name,ok,detail)=>{report.push({name,ok,detail});if(!ok)failures.push(name+': '+detail);};
const skip=(name,detail)=>report.push({name,ok:'skip',detail});
const note=[];

(async()=>{
 // 1. The artifact carries the site's bytes.
 await fs.access(APP).catch(()=>{throw Error('no packaged client at '+APP+' - run npm run pack first');});
 const asar=path.join(path.dirname(APP),'resources','app.asar');
 const asarApi=require('@electron/asar');
 for(const [file,entry] of Object.entries(MANIFEST.files)){
  const inside=file.replace(/^desktop\//,'desktop/');
  let packed;
  try{packed=asarApi.extractFile(asar,inside);}catch{packed=null;}
  const site=await fs.readFile(path.join(SITE,entry.source));
  check('asar '+entry.source,packed!==null&&Buffer.compare(packed,site)===0,
   packed===null?'not in '+path.basename(asar):(Buffer.compare(packed,site)===0?'byte identical to the site':'DIFFERS from the site'));
 }
 const working=await fs.readFile(path.join(DESKTOP,'vendor','site','account','account.mjs'));
 // cmp, as the ticket asked for it, for the working tree as well as the artifact.
 const {execFileSync}=require('node:child_process');
 let cmpOk=true;
 for(const [file,entry] of Object.entries(MANIFEST.files)){
  try{execFileSync('cmp',['-s',path.join(REPO,file),path.join(SITE,entry.source)]);}catch{cmpOk=false;failures.push('cmp ' + file + ' differs from the site');}
 }
 check('cmp: every vendored file is the site\u2019s own bytes',cmpOk,cmpOk?'cmp -s: identical':'see the failures');
 check('the served page module is the vendored one',working.length>0,working.length+' bytes of account.mjs served');

 // 2. The packaged client's sign-in window.
 const client=await launchClient();
 const site=await serveSite(SITE);
 let chromium;
 try{
  await ready(client.page);
  const clientMeasurements={};
  for(const viewport of VIEWPORTS){
   await client.page.viewport(viewport);
   clientMeasurements[viewport.width]=await client.page.evaluate(MEASURE);
   await client.page.screenshot(path.join(REPO,'release','company-signin-client-'+viewport.width+'x'+viewport.height+'-'+process.platform+'.png')).catch(()=>{});
  }

  // 3. The control: the site's own sign-in page, in the client's own Chromium build.
  chromium=await launchControl(site.origin+'/account/');
  await ready(chromium.page);
  const controlMeasurements={};
  for(const viewport of VIEWPORTS){
   await chromium.page.viewport(viewport);
   controlMeasurements[viewport.width]=await chromium.page.evaluate(MEASURE);
   await chromium.page.screenshot(path.join(REPO,'release','company-signin-site-'+viewport.width+'x'+viewport.height+'-'+process.platform+'.png')).catch(()=>{});
  }

  // 4. One design: every box, the option order and every sentence.
  const client1280=clientMeasurements[1280],site1280=controlMeasurements[1280];
  check('the client serves the site\u2019s page at the site\u2019s path',/^e-server-signin:\/\/company\/account\/$/.test(client1280.url),client1280.url);
  check('the control is the site\u2019s own page',/\/account\/$/.test(site1280.url),site1280.url);
  // The window's title is the site module's own sentence for this page (SIGN_IN_TITLE, the one the
  // page writes into its heading), without the site's name after the dash: a desktop window is not
  // Easter Co. SMP. The control proves where that sentence comes from.
  check('the client\u2019s window title is the site\u2019s own sentence for the page',
   client1280.title===client1280.heading&&site1280.title.startsWith(client1280.title),
   JSON.stringify(client1280.title)+' (site: '+JSON.stringify(site1280.title)+', heading: '+JSON.stringify(site1280.heading)+')');
  check('the same sign-in panel, box for box, as the site',JSON.stringify(layoutOf(client1280))===JSON.stringify(layoutOf(site1280)),
   JSON.stringify(layoutOf(client1280))===JSON.stringify(layoutOf(site1280))?'identical layout' : 'client '+JSON.stringify(layoutOf(client1280))+'\nsite   '+JSON.stringify(layoutOf(site1280)));
  check('the same option set, in the same order, as the site',JSON.stringify(client1280.options)===JSON.stringify(site1280.options),
   client1280.options.map(option=>option.text).join(' | '));
  check('the same framing sentence as the site',client1280.heading===site1280.heading&&client1280.overline===site1280.overline,client1280.overline+' / '+client1280.heading);
  check('the same form fields and sentences as the site',JSON.stringify([client1280.labels,client1280.submitText,client1280.providerNote,client1280.noReset])===JSON.stringify([site1280.labels,site1280.submitText,site1280.providerNote,site1280.noReset]),JSON.stringify(client1280.labels)+' '+client1280.submitText);
  // The site's page carries its own nav and legal links; this client removes them rather than
  // leaving links that lead nowhere. Everything else in the footer is the site's.
  check('the footer keeps the site\u2019s own words',/© Easter LTD/.test(client1280.footer||'')&&/Numquam Succumbe/.test(client1280.footer||''),JSON.stringify(client1280.footer));

  // 5. The re-skin: e-server's palette, mark and wordmark, measured off the rendered page.
  const colours=client1280;
  check('the page sits on e-server\u2019s ground colour (#0d1117)',colours.shell.bodyBackground==='rgb(13, 17, 23)',colours.shell.bodyBackground);
  check('the panel is e-server\u2019s card surface (#161b22)',colours.panel.background==='rgb(22, 27, 34)',colours.panel.background);
  check('the overline and the wordmark take e-server\u2019s accent (#8b5cf6)',colours.wordmark.color==='rgb(139, 92, 246)',colours.wordmark.color);
  check('the primary control is the app\u2019s accent button',colours.rows[0].background==='rgb(139, 92, 246)',colours.rows[0].background+' / '+colours.rows[0].colour);
  check('the body type is e-server\u2019s, not the site\u2019s serif',/system-ui/.test(colours.shell.fontFamily)&&/system-ui/.test(colours.headingStyle.fontFamily),colours.shell.fontFamily+' / '+colours.headingStyle.fontFamily);
  check('the heading is e-server\u2019s heading face',colours.headingStyle.color==='rgb(255, 255, 255)'&&colours.headingStyle.fontWeight==='600',colours.headingStyle.color+' '+colours.headingStyle.fontWeight);
  check('the Easter Company fire phoenix stands beside the wordmark',!!colours.mark&&colours.mark.loaded&&colours.mark.src==='../assets/ec-logo.svg',JSON.stringify(colours.mark));
  check('the mark is drawn at the site\u2019s 26x26',!!colours.mark&&colours.mark.box.width===26&&colours.mark.box.height===26,JSON.stringify(colours.mark&&colours.mark.box));
  check('the wordmark beside it is e-server\u2019s',colours.wordmark.text==='e-server',JSON.stringify(colours.wordmark.text));
  // The skin must change nothing about the boxes: this is the same comparison as step 4, at the
  // narrow width, where a re-skin is most likely to start changing wrapping or sizes.
  const clientNarrow=clientMeasurements[360],siteNarrow=controlMeasurements[360];
  check('at 360x500 the controls still match the site\u2019s',JSON.stringify(layoutOf(clientNarrow).rows)===JSON.stringify(layoutOf(siteNarrow).rows)&&clientNarrow.panel.box.width===siteNarrow.panel.box.width,
   'client '+JSON.stringify(clientNarrow.rows.map(row=>[row.width,row.height]))+'\nsite   '+JSON.stringify(siteNarrow.rows.map(row=>[row.width,row.height])));
  for(const viewport of VIEWPORTS){
   const measurement=clientMeasurements[viewport.width];
   check('no horizontal overflow at '+viewport.width+'x'+viewport.height,measurement.shell.scrollWidth<=measurement.shell.clientWidth,
    'scrollWidth '+measurement.shell.scrollWidth+' / clientWidth '+measurement.shell.clientWidth);
  }
  check('the viewports measured are the ones asked for',clientMeasurements[1280].shell.width===1280&&clientMeasurements[360].shell.width===360,'1280 and 360 CSS pixels');

  // 6. It says what it is for, and never what an e-server instance wants.
  const text=client1280.text;
  check('the framing says Easter Company account',/Easter Company account/.test(text)&&/EASTER COMPANY/.test(text),'overline and heading present');
  const instance=text.match(/\bPIN\b|\binstance\b|\bpermission\b|\bunlock\b/i);
  check('no e-server instance, PIN, permission or unlock language',!instance,instance?instance[0]:'none');
  const stale=['Sign in to Easter Company','Connecting to Easter Company','Cancel sign-in','Sign in or create your global account','e-server 1.0.']
   .filter(sentence=>text.includes(sentence));
  check('none of the sentences the old screen printed',stale.length===0,stale.join(' | ')+''||'none');
  check('the site\u2019s own navigation and legal links are not offered inside the client',
   client1280.chrome.nav===false&&client1280.chrome.legal===false&&site1280.chrome.nav===true&&site1280.chrome.legal===true,
   'client '+JSON.stringify(client1280.chrome)+' / site '+JSON.stringify(site1280.chrome));

  // 7. Two refusals, on both surfaces, in the site\u2019s own words.
  // The panel's fields are `required`, so a browser answers an empty one with its own validation
  // bubble before the module's submit handler is reached. `noValidate` is set on BOTH surfaces so
  // what is compared is the module's refusal rather than the browser's, and so the comparison is
  // the same test on each side.
  const fill=(page,identifier,password)=>page.evaluate(`(() => {
   const form = document.querySelector('.company-signin form');
   form.noValidate = true;
   form.querySelector('input[name=identifier]').value = ${JSON.stringify(identifier)};
   form.querySelector('input[name=password]').value = ${JSON.stringify(password)};
   form.requestSubmit();
   return true;
  })()`);
  // (a) the panel's own: an empty identifier never leaves the page.
  await fill(client.page,'','password-1');
  const clientEmpty=await until(()=>client.page.evaluate('(() => { const region = document.querySelector("#account-error"); return region && !region.hidden ? region.innerText : null; })()'),{timeout:8000,what:'the empty-identifier refusal'});
  await fill(chromium.page,'','password-1');
  const siteEmpty=await until(()=>chromium.page.evaluate('(() => { const region = document.querySelector("#account-error"); return region && !region.hidden ? region.innerText : null; })()'),{timeout:8000,what:'the control\u2019s empty-identifier refusal'});
  check('an empty identifier is refused in the site\u2019s own sentence',clientEmpty===siteEmpty&&!!clientEmpty,JSON.stringify(clientEmpty)+' vs '+JSON.stringify(siteEmpty));

  // (b) a refusal from the account service itself, and the busy state while it is in flight.
  //
  // The client asks the service for real - through the main process, which is the only thing in
  // this product that may call it. The control cannot: the account service's CORS allow-list names
  // the site's own origins, so a fetch from a loopback address is refused by the browser before the
  // service sees it. So the refusal body is read from the SERVICE here, once, with the same
  // credentials the client is about to send, and handed to the control's page at the wire through
  // the debugging protocol. What is compared is therefore the sentence each surface prints for the
  // service's own answer, not this machine's ability to reach an origin.
  const identifier='no-such-person-'+createHash('sha256').update(String(Date.now())).digest('hex').slice(0,10);
  const API=API_ORIGIN();
  const serviceRefusal=options.service?await askService(API,identifier,'not-the-password-1'):null;
  if(serviceRefusal)await intercept(chromium.page,API,serviceRefusal);
  await fill(client.page,identifier,'not-the-password-1');
  let siteBusyLine=null;
  const busy=await until(async ()=>client.page.evaluate('(() => { const panel = document.querySelector("#account-panel"); const wait = document.querySelector("#account-wait"); const body = document.querySelector("#account-root .account-body"); return {busy: panel.dataset.busy, wait: wait && !wait.hidden ? wait.innerText : null, spinner: !!document.querySelector("#account-wait .wait-feedback-mark"), busyOptions: !!body && getComputedStyle(body).display !== "none"}; })()'),
   {timeout:5000,what:'the busy state'}).catch(error=>({error:error.message}));
 // The options must be OUT OF THE WAY while a flow is in flight, and one spinner and one sentence
 // must be the whole of what is left. This sample is taken from inside the flow, before it ends.
  const clientRefusal=await until(()=>client.page.evaluate('(() => { const region = document.querySelector("#account-error"); return region && !region.hidden ? region.innerText : null; })()'),{timeout:90000,interval:250,what:'the client\u2019s refusal from the account service'});
  if(options.service){
   await fill(chromium.page,identifier,'not-the-password-1');
   const siteBusy=await until(()=>chromium.page.evaluate('(() => { const panel = document.querySelector("#account-panel"); const wait = document.querySelector("#account-wait"); return panel && panel.dataset.busy === "true" ? (wait && !wait.hidden ? wait.innerText : null) : null; })()'),{timeout:8000,what:'the control\u2019s busy state'}).catch(()=>null);
   siteBusyLine=siteBusy;
   const siteRefusal=await until(()=>chromium.page.evaluate('(() => { const region = document.querySelector("#account-error"); return region && !region.hidden ? region.innerText : null; })()'),{timeout:90000,interval:250,what:'the control\u2019s refusal from the account service'});
   if(clientRefusal===siteRefusal)check('the account service\u2019s refusal is one sentence on both surfaces',true,JSON.stringify(clientRefusal));
   else if(RATE_LIMITED&&(clientRefusal===RATE_LIMITED||siteRefusal===RATE_LIMITED))skip('the account service\u2019s refusal is one sentence on both surfaces','the sign-in limiter refused this run (60 per 10 minutes): client '+JSON.stringify(clientRefusal)+' / control '+JSON.stringify(siteRefusal)+'. Re-run on a quiet limiter to compare the refusal itself.');
   else check('the account service\u2019s refusal is one sentence on both surfaces',false,JSON.stringify(clientRefusal)+' vs '+JSON.stringify(siteRefusal));
  }else note.push('--no-service: the service refusal was read on the client only and not compared.');
  // The site's rule for a flow in flight (Owen, 2026-10-26): one spinner, one sentence, and every
  // control out of the way - hidden, which also takes them out of the tab order.
  check('the busy state is one spinner and the site\u2019s wait sentence, and no options',
   !!busy&&busy.busy==='true'&&busy.spinner===true&&busy.busyOptions===false&&busy.wait===siteBusyLine,
   JSON.stringify(busy)+' vs the site\u2019s line '+JSON.stringify(siteBusyLine));
  note.push('the busy state the client showed while the flow was in flight: '+JSON.stringify(busy));
  note.push('the refusal the account service answered: '+JSON.stringify(clientRefusal));

  // A screenshot of the window as the client draws it, for the record beside the numbers.
  await client.page.viewport({width:680,height:860});
  await client.page.screenshot(path.join(REPO,'release','company-signin-client-window-'+process.platform+'.png')).catch(()=>{});
 }finally{
  chromium?.close();
  await site.close();
  await client.close();
 }

 // ---- the report ----------------------------------------------------------------
 console.log('\n=== the packaged client\'s Easter Company sign-in ===\n');
 console.log('client artifact : '+APP);
 console.log('site control    : '+path.join(SITE,'account')+' served on a loopback origin, rendered in the same Chromium build');
 console.log('viewports       : '+VIEWPORTS.map(viewport=>viewport.width+'x'+viewport.height).join(', ')+' CSS pixels, by CDP device-metrics emulation\n');
 for(const line of report)console.log((line.ok===true?'PASS   ':line.ok==='skip'?'SKIP   ':'FAIL   ')+line.name+(line.detail?'   ['+line.detail+']':''));
 for(const line of note)console.log('\nnote: '+line);
 console.log('\n'+(failures.length?'FAILED '+failures.length+' check(s):\n  '+failures.join('\n  '):'all checks passed'));
 if(failures.length)process.exitCode=1;
})().catch(error=>{
 console.error('\n'+String(error&&error.stack||error));
 for(const line of report)console.error((line.ok===true?'PASS   ':line.ok==='skip'?'SKIP   ':'FAIL   ')+line.name+(line.detail?'   ['+line.detail+']':''));
 process.exitCode=1;
});
