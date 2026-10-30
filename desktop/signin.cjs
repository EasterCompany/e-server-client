'use strict';
// THE SITE'S SIGN-IN PAGE, SERVED INTO THE CLIENT, ON AN ADDRESS IT CAN RECOGNISE.
//
// The Easter Company account sign-in in this client is not a client UI. It is
// easter-co-smp.github.io/site/account/index.html and the module behind it (account.mjs,
// signin-options.mjs and the files they import), copied here byte for byte under
// desktop/vendor/site/ and served unchanged. `tests/company-signin.test.cjs` compares every one
// of those files with the site's own copy using cmp, and `desktop/vendor/site/README.md` records
// what was taken and from which site revision. Nothing in that tree is edited: every difference
// this client needs lives in desktop/signin-adapter.mjs (the seam the page talks to),
// desktop/signin.css (the e-server skin) and the two DOM adjustments the adapter makes.
//
// WHY A PRIVATE SCHEME RATHER THAN file://.
//
// site/account/account.mjs refuses to draw a sign-in anywhere but its own registered path: it
// compares `location.pathname` with the literal in microsoft-signin.mjs and, when the page is not
// there, says so and offers nothing ("A Microsoft button in either case would send the authority
// a URI nobody registered and fail after the player had already signed in"). A file:// document's
// pathname is an absolute file path, so the vendored page would draw that refusal inside the
// client and never the panel Owen asked for. The scheme below gives the page the path it expects
// — e-server-signin://company/account/ has pathname /account/ — while staying unreachable from
// anything but this process: it is registered standard+secure, it is answered only by the table
// in FILES below, and it is not an OS-registered protocol other software can open.
//
// WHAT THE CLIENT ANSWERS FOR, and what it deliberately does not:
//
//   the site's sign-in surface      byte-identical files from the export above.
//   /web-account.mjs                the seam slot. The site's own module is the browser's account
//                                   seam (a Company session kept in sessionStorage and an API
//                                   called with fetch); this client's session lives in the main
//                                   process and its OS keyring, so the slot is answered by the
//                                   client adapter. This is the one substituted file, and the
//                                   header of desktop/signin-adapter.mjs says so.
//   /web.css                        the site's web-mode overlay slot, answered with the e-server
//                                   skin (desktop/signin.css). It is the last stylesheet in the
//                                   page's own head, which is where a re-skin belongs.
//   /web.js, /downloads.js, /desktop.js
//                                   the site's own page controllers: the nav's account dialog, the
//                                   download popover and the store entry. This client has no site
//                                   routes, so each is answered with an empty script rather than a
//                                   404 that would fail the page.
//   /                               the client's own setup surface (desktop/shell.html), because
//                                   the site's page leaves for its root once it is signed in
//                                   (site/account/account.mjs, signedIn(): "signedIn() sends the
//                                   browser to the site root"). In this client the root is the
//                                   next step of the client, and nothing else has to move it.
//
// The response headers pin the page down: no network of any kind, no inline script or style, no
// frames, no form target. The seam crosses contextBridge, which is unaffected by connect-src.
const fs=require('node:fs/promises'),path=require('node:path');

const SCHEME='e-server-signin';
const HOST='company';
const ORIGIN=SCHEME+'://'+HOST;
// The path site/account/account.mjs requires (ACCOUNT_PATH in the site's microsoft-signin.mjs).
const SIGNIN_PATH='/account/';
const SIGNIN_URL=ORIGIN+SIGNIN_PATH;
// The root of this scheme, answered with the client's own setup surface.
const SETUP_URL=ORIGIN+'/';

const VENDOR=path.join(__dirname,'vendor','site');
const VENDORED_ACCOUNT=path.join(VENDOR,'account');
// The two files this client has always carried from the launcher's own export. They are byte
// identical to the site's copies today, and the suite cmp's them against the site rather than
// trusting that sentence.
const LAUNCHER=path.join(__dirname,'vendor','launcher');

const TYPES={
 '.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.webp':'image/webp',
};
const typeOf=file=>TYPES[path.extname(file).toLowerCase()]||'application/octet-stream';
// The site's page controllers, answered as empty scripts. A comment keeps the response honest
// when somebody reads it in a debugging session, and `export {}` is deliberately absent: two of
// the three are loaded as classic scripts and a bare export would be a syntax error in them.
const NO_SITE_CHROME='// This client serves no site chrome: desktop/signin.cjs explains why.\n';

// One table, so the served surface is auditable in a glance and a test can walk it. Every entry
// is either a file on disk or a body written here; nothing else is answered, and a path this
// table does not name is a 404 rather than a guess.
const FILES=new Map([
 // The page itself, at the one pathname its own module accepts.
 [SIGNIN_PATH,{file:path.join(VENDORED_ACCOUNT,'index.html')}],
 ['/account/index.html',{file:path.join(VENDORED_ACCOUNT,'index.html')}],
 ['/account/account.mjs',{file:path.join(VENDORED_ACCOUNT,'account.mjs')}],
 ['/account/account.css',{file:path.join(VENDORED_ACCOUNT,'account.css')}],
 ['/account/microsoft-signin.mjs',{file:path.join(VENDORED_ACCOUNT,'microsoft-signin.mjs')}],
 ['/auth-return.mjs',{file:path.join(VENDOR,'auth-return.mjs')}],
 ['/signin-options.mjs',{file:path.join(LAUNCHER,'signin-options.mjs')}],
 ['/account-client.mjs',{file:path.join(LAUNCHER,'account-client.mjs')}],
 ['/styles.css',{file:path.join(VENDOR,'styles.css')}],
 ['/desktop.css',{file:path.join(VENDOR,'desktop.css')}],
 ['/assets/ec-logo.svg',{file:path.join(VENDOR,'assets','ec-logo.svg')}],
 ['/assets/favicon.ico',{file:path.join(VENDOR,'assets','favicon.ico')}],
 ['/assets/favicon.png',{file:path.join(VENDOR,'assets','favicon.png')}],
 ['/assets/apple-touch-icon.png',{file:path.join(VENDOR,'assets','apple-touch-icon.png')}],
 // The client's two slots on the site's page.
 ['/web-account.mjs',{file:path.join(__dirname,'signin-adapter.mjs')}],
 ['/web.css',{file:path.join(__dirname,'signin.css')}],
 // The site's page controllers: no site chrome exists in this client.
 ['/web.js',{body:NO_SITE_CHROME}],
 ['/downloads.js',{body:NO_SITE_CHROME}],
 ['/desktop.js',{body:NO_SITE_CHROME}],
 // The client's own setup surface, at the root the signed-in page leaves for.
 ['/',{file:path.join(__dirname,'shell.html')}],
 ['/shell.css',{file:path.join(__dirname,'shell.css')}],
 ['/shell.mjs',{file:path.join(__dirname,'shell.mjs')}],
 ['/icon.png',{file:path.join(__dirname,'icon.png')}],
]);

// The page's own CSP. connect-src 'none' is a statement rather than a precaution: this page
// reaches the account service through the main process and never with fetch, so a build that
// started calling the API from the renderer would stop working here first.
const CSP=["default-src 'none'","script-src 'self'","style-src 'self'","img-src 'self' data:",
 "connect-src 'none'","font-src 'self'","base-uri 'none'","form-action 'none'","frame-src 'none'","object-src 'none'"].join('; ');

// WHICH DOCUMENT THE SETUP WINDOW HOLDS.
//
// Two surfaces, never both: the site's sign-in page while nobody is signed in, and the client's
// own setup surface once an account exists or while a startup update is in flight. The update
// phases keep the setup surface for the reason its own actions exist: "Try again" and "Download
// latest installer" are how a person gets out of an update that failed, and they live there.
// `account` is the seam's own session document, so an account that still has to choose a
// username and password (passwordRequired) counts as signed in here: the setup surface is where
// that step lives.
function documentFor({account,phase}={}){
 if(account)return 'setup';
 return ['checking','downloading','verifying','update-error'].includes(phase)?'setup':'signin';
}

// The registration has to happen before the app is ready; the handler can only be installed
// after it. Both are called by desktop/main.cjs, which is the only place a window is created.
function registerScheme(){
 const {protocol}=require('electron');
 protocol.registerSchemesAsPrivileged([{scheme:SCHEME,privileges:{standard:true,secure:true,supportFetchAPI:false,corsEnabled:false,bypassCSP:false,allowServiceWorkers:false}}]);
}

async function answer(request){
 let url;
 try{url=new URL(request.url);}catch{return new Response('Not found',{status:404});}
 if(url.protocol!==SCHEME+':'||url.hostname!==HOST)return new Response('Not found',{status:404});
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
 const entry=FILES.get(url.pathname);
 if(!entry)return new Response('Not found',{status:404});
 const headers={'Content-Security-Policy':CSP,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(entry.file){
  let body;
  try{body=await fs.readFile(entry.file);}catch{return new Response('Not found',{status:404});}
  headers['Content-Type']=typeOf(entry.file);
  return new Response(request.method==='HEAD'?null:body,{status:200,headers});
 }
 headers['Content-Type']='text/javascript; charset=utf-8';
 return new Response(request.method==='HEAD'?null:entry.body,{status:200,headers});
}

// THE HANDLER BELONGS TO A SESSION, NOT TO THE APP. protocol.handle on Electron's default
// session answers that session only, and the setup window deliberately runs in its own partition
// ('setup', below in desktop/main.cjs, so a sign-in window shares no storage or cache with the
// server windows). Registering the scheme globally and handling it there refused the page with an
// unknown protocol - which Electron hands to the operating system, so the first launch printed
// xdg-open's "x-www-browser: command not found" and the window landed on about:blank. The caller
// passes the session the setup window uses.
function install(session){
 if(!session||typeof session.protocol?.handle!=='function')throw Error('The sign-in page needs the session it is served on.');
 session.protocol.handle(SCHEME,request=>answer(request));
}

module.exports={SCHEME,ORIGIN,SIGNIN_PATH,SIGNIN_URL,SETUP_URL,FILES,CSP,registerScheme,install,documentFor};
