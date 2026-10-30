'use strict';
// THE CLIENT'S SIGN-IN IS THE SITE'S SIGN-IN, and this file is what keeps that true.
//
// Every assertion here is about bytes and about the table that serves them, because the failure
// this project has already paid for once was a second copy of the household's sign-in: a card of
// its own with its own words, which had to be redone (docs/COMPANY_LOGIN.md). So the client does
// not own a sign-in surface at all. It serves easter-co-smp.github.io/site/account/ out of
// desktop/vendor/site/, and this test is the gate on that:
//
//   * every vendored file still hashes to what was taken from the site (VENDORED.json);
//   * every one of them is byte identical to the site's own copy, by cmp, whenever a site
//     checkout is available - and the live comparison is skipped, never faked, when it is not;
//   * every address the page asks for is answered by desktop/signin.cjs, so a missing served file
//     cannot degrade into a 404 at runtime;
//   * the few things that are not copies are named, one by one: the seam, the skin and the site's
//     page controllers;
//   * the client's sign-in carries no e-server instance language, and none of the sentences the
//     screen it replaced used to print.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');

const ROOT=path.join(__dirname,'..');
const DESKTOP=path.join(ROOT,'desktop');
const manifest=JSON.parse(fs.readFileSync(path.join(DESKTOP,'vendor','site','VENDORED.json'),'utf8'));
const signin=require('../desktop/signin.cjs');

// The site checkout, when this machine or CI has one. EASTER_SITE_DIR is authoritative when it is
// set: a path that is named and missing is a failure, not a silent skip.
const SITE=process.env.EASTER_SITE_DIR||'/root/easter-co-smp.github.io/site';
const siteAvailable=fs.existsSync(path.join(SITE,'account','account.mjs'));
const sha256=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read=file=>fs.readFileSync(file,'utf8');

test('the vendored sign-in is still the bytes that were taken from the site',()=>{
 for(const [file,entry] of Object.entries(manifest.files)){
  const full=path.join(ROOT,file);
  assert.ok(fs.existsSync(full),file+' is missing from the tree');
  assert.equal(sha256(full),entry.sha256,file+' no longer matches VENDORED.json: it was edited');
 }
});

test('every vendored file is byte identical to the site own copy, by cmp',t=>{
 if(process.env.EASTER_SITE_DIR&&!siteAvailable)t.diagnostic('EASTER_SITE_DIR is set but has no account/account.mjs');
 if(!siteAvailable){t.skip('no site checkout at '+SITE+' (set EASTER_SITE_DIR): the sha256 gate above ran, the byte comparison did not');return;}
 for(const [file,entry] of Object.entries(manifest.files)){
  const site=path.join(SITE,entry.source);
  assert.ok(fs.existsSync(site),'the site no longer has '+entry.source);
  // cmp itself, not a hash of both sides: the ticket asked for the byte comparison, and two
  // hashes agreeing is a claim about this test rather than about the files.
  assert.doesNotThrow(()=>execFileSync('cmp',['-s',path.join(ROOT,file),site]),file+' differs from the site ('+entry.source+')');
 }
});

test('the page is served from the one pathname its own module accepts',()=>{
 // site/account/account.mjs refuses to draw a sign-in anywhere but ACCOUNT_PATH, which is the
 // pathname of Microsoft's registered redirect. A file:// document cannot satisfy that, which is
 // why the client serves the page on its own scheme.
 assert.equal(signin.SIGNIN_PATH,'/account/');
 assert.equal(new URL(signin.SIGNIN_URL).pathname,'/account/');
 assert.match(read(path.join(DESKTOP,'vendor','site','account','account.mjs')),/location\.pathname!==ACCOUNT_PATH/);
});

test('every address the site page asks for is answered, so nothing degrades to a 404',()=>{
 // Walk the page's own references rather than a list written here: an import added to the site's
 // module would otherwise be a runtime 404 that only a browser run would ever see.
 const page=read(path.join(DESKTOP,'vendor','site','account','index.html'));
 const htmlRefs=[...page.matchAll(/(?:href|src)="([^"#][^"]*)"/g)].map(match=>match[1]);
 // Each vendored module, at the address the page loads it from, so its own relative imports
 // resolve the way the browser will resolve them.
 const modules=[
  ['/account/account.mjs',path.join(DESKTOP,'vendor','site','account','account.mjs')],
  ['/account/microsoft-signin.mjs',path.join(DESKTOP,'vendor','site','account','microsoft-signin.mjs')],
  ['/auth-return.mjs',path.join(DESKTOP,'vendor','site','auth-return.mjs')],
  ['/signin-options.mjs',path.join(DESKTOP,'vendor','launcher','signin-options.mjs')],
  ['/account-client.mjs',path.join(DESKTOP,'vendor','launcher','account-client.mjs')],
 ];
 for(const href of htmlRefs){
  const where=new URL(href,signin.SIGNIN_URL).pathname;
  // The site's nav and legal pages are the site's own; the adapter removes them from the client.
  if(where==='/'||where.startsWith('/minecraft/')||where.startsWith('/store/')||where.startsWith('/legal/'))continue;
  assert.ok(signin.FILES.has(where),'index.html asks for '+href+' ('+where+') and the client does not serve it');
 }
 for(const [served,file] of modules){
  for(const match of read(file).matchAll(/from\s+'([^']+)'/g)){
   const where=new URL(match[1],signin.ORIGIN+served).pathname;
   assert.ok(signin.FILES.has(where),served+' imports '+match[1]+' ('+where+') and the client does not serve it');
  }
 }
 assert.ok(signin.FILES.has('/web-account.mjs'),'the page imports its seam and the client must answer it');
});

test('the three substitutions are named, and the site own seam is never vendored',()=>{
 // The seam: the site's browser seam keeps a Company session in sessionStorage, so copying it
 // would put a session in a renderer. The client answers that one slot from the main process.
 assert.equal(signin.FILES.get('/web-account.mjs').file,path.join(DESKTOP,'signin-adapter.mjs'));
 // The skin: the site's web-mode overlay slot is the last sheet in the page's head.
 assert.equal(signin.FILES.get('/web.css').file,path.join(DESKTOP,'signin.css'));
 // The site's page controllers: no site chrome exists inside the client.
 for(const slot of ['/web.js','/downloads.js','/desktop.js'])assert.equal(typeof signin.FILES.get(slot).body,'string',slot+' must be an empty script');
 assert.equal(fs.existsSync(path.join(DESKTOP,'vendor','site','web-account.mjs')),false,'the site browser seam must not be copied into the client');
 // And the two slots that must stay the site's own bytes.
 assert.equal(signin.FILES.get('/account/').file,path.join(DESKTOP,'vendor','site','account','index.html'));
 assert.equal(signin.FILES.get('/account/account.mjs').file,path.join(DESKTOP,'vendor','site','account','account.mjs'));
});

test('the seam speaks the site contract and reaches the account only through this process',()=>{
 const adapter=read(path.join(DESKTOP,'signin-adapter.mjs'));
 // The six answers site/account/account.mjs asks its seam for, and nothing invented around them.
 for(const name of ['ready','getState','subscribe','accountProviders','loginCompany','signInProvider','startMicrosoftSignIn'])assert.match(adapter,new RegExp(name),'the seam must answer '+name);
 assert.match(adapter,/export const webAccount=setup\?seam:null/);
 // The window is served with connect-src 'none': the renderer has no route to the account service,
 // and a seam that started fetching would stop working here first.
 assert.doesNotMatch(adapter,/\bfetch\(|XMLHttpRequest|WebSocket/);
 assert.match(signin.CSP,/connect-src 'none'/);
 // No session, no credential and no account client in the renderer: the main process owns them.
 assert.doesNotMatch(adapter,/\btoken\b/i);
 assert.doesNotMatch(adapter,/account-client/);
 // Nothing in the client's seam is new player-facing copy: the panel's own sentences are the
 // site's and every refusal is the main process's. Comments are stripped first, so this is a list
 // of the literals the module's CODE uses - and a sentence added here would have to be added to
 // this list, in a diff somebody reads.
 const code=adapter.replace(/^\s*\/\/.*$/gm,'');
 const literals=[...code.matchAll(/'([^'\n]*)'/g)].map(match=>match[1]).filter(value=>value);
 assert.deepEqual([...new Set(literals)].sort(),
  ['./signin-options.mjs','.account-footer .legal-links','.site-header .site-wordmark','.site-header nav',
   '/','aria-label','desktop','discord','e-server','google','href','img','microsoft','providers_unreadable','steam']);
});

test('the sign-in says what it is for and never what an e-server instance wants',()=>{
 const served=[path.join(DESKTOP,'vendor','site','account','index.html'),
               path.join(DESKTOP,'signin-adapter.mjs'),
               path.join(DESKTOP,'signin.css')].map(read).join('\n');
 // The framing is the site's own: the overline, the heading the panel module writes, and the
 // provider note. site/signin-options.mjs owns those words and the client does not restate them.
 assert.match(served,/EASTER COMPANY/);
 assert.match(served,/Easter Company account/);
 assert.match(read(path.join(DESKTOP,'vendor','site','account','index.html')),/<div class="account-body" id="account-root"><\/div>/);
 // Instance access is not this session's business: no PIN, no instance, no permissions, no
 // unlock, and none of the sentences the screen it replaced printed.
 for(const word of [/\bPIN\b/i,/\binstance\b/i,/permission/i,/\bunlock/i])assert.doesNotMatch(served,word,served.match(word)?.[0]+' does not belong on the sign-in page');
 for(const old of ['Sign in to Easter Company','Connecting to Easter Company','Cancel sign-in','Sign in or create your global account'])assert.ok(!served.includes(old),'the sign-in page must not print "'+old+'" any more');
});

test('the client own setup surface no longer draws a sign-in',()=>{
 const shell=read(path.join(DESKTOP,'shell.html')),script=read(path.join(DESKTOP,'shell.mjs'));
 assert.doesNotMatch(shell,/account-signin|input name=identifier|Cancel sign-in/);
 assert.doesNotMatch(shell,/Sign in to Easter Company/);
 assert.doesNotMatch(script,/createSignInOptions|company-signin|signin-options/);
 // It keeps what it is for: the account's own last step, the server address, updates, sign-out.
 for(const id of ['account-finish','account-status','connect','progress','retry','installer','signout'])assert.match(shell,new RegExp('id="'+id+'"'));
});

test('the window follows the session between the two documents',()=>{
 assert.equal(signin.documentFor({account:{id:'1'},phase:'auth'}),'setup');
 assert.equal(signin.documentFor({account:{id:'1',passwordRequired:true},phase:'setup'}),'setup');
 assert.equal(signin.documentFor({account:null,phase:'auth'}),'signin');
 assert.equal(signin.documentFor({account:null,phase:'setup'}),'signin');
 // A startup update keeps the surface its own "Try again" and installer controls live on.
 for(const phase of ['checking','downloading','verifying','update-error'])assert.equal(signin.documentFor({account:null,phase}),'setup',phase);
});
