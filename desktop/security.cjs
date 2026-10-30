'use strict';
const HEADER='X-Easter-Desktop',CLIENT='e-server/1';
function serverRequest(value,origin){
 try{const target=new URL(value),server=new URL(origin);const protocol=target.protocol.replace('wss:','https:').replace('ws:','http:');return !target.username&&!target.password&&target.hostname===server.hostname&&protocol===server.protocol;}catch{return false;}
}
function serverOrigin(value,{development=false}={}){
 let url;try{url=new URL(String(value).trim());}catch{throw Error('Enter the full HTTPS address of your e-server.');}
 const loopback=['127.0.0.1','localhost','[::1]'].includes(url.hostname);
 // Older download splashes advertised the reverse proxy's internal HTTP scheme.
 // This one known host has verified TLS; never downgrade or allow other HTTP hosts.
 if(url.protocol==='http:'&&url.hostname==='easter-server.char-istrian.ts.net'&&(!url.port||url.port==='80'))url.protocol='https:';
 if(url.protocol!=='https:'&&!(development&&loopback&&url.protocol==='http:'))throw Error('Your e-server address must use HTTPS.');
 if(url.username||url.password||url.search||url.hash||!['','/'].includes(url.pathname))throw Error('Enter a server origin without a path, password or query.');
 return url.origin;
}
function externalURL(value){const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password)throw Error('Only HTTPS links can open in your browser.');return url.href;}
function connectionLink(value){const url=new URL(value);if(url.protocol!=='e-server:'||url.hostname!=='connect')throw Error('Invalid e-server connection link.');return serverOrigin(url.searchParams.get('server'));}
function trusted(event,origin){return event.senderFrame===event.sender.mainFrame&&new URL(event.senderFrame.url).origin===origin;}
// THE CLIENT'S OWN UI, AND ONLY THE CLIENT'S OWN UI. Its two setup documents - the site's sign-in
// page and the client's own setup surface - are the only things served on this private scheme, and
// only this process answers that scheme (desktop/signin.cjs). A frame from any other protocol is
// not the client's setup, the connected server's https page included. This replaced a file://
// check when the sign-in page needed the pathname /account/ that site/account/account.mjs requires.
// The origin is the one desktop/signin.cjs serves, so this file does not become a second author of
// the address. Node's URL gives a non-special scheme an opaque origin ('null'), so the comparison
// is the scheme and host it was built from rather than `.origin`.
const {ORIGIN:SETUP_ORIGIN}=require('./signin.cjs');
function setupFrame(event){
 if(event.senderFrame!==event.sender.mainFrame)return false;
 try{const url=new URL(event.senderFrame.url);return url.protocol+'//'+url.hostname===SETUP_ORIGIN;}catch{return false;}
}
function updateLevel(from,to){const a=from.split('.').map(Number),b=to.split('.').map(Number);return a[0]!==b[0]?'major':a[1]!==b[1]?'minor':'patch';}
function relaunchOptions({platform=process.platform,env=process.env,execPath=process.execPath,argv=process.argv,packaged=true,appPath='',hidden=false}={}){
 const args=packaged?[]:[appPath];if(argv.includes('--no-sandbox'))args.push('--no-sandbox');if(hidden)args.push('--hidden-to-tray');
 return {execPath:platform==='linux'&&env.APPIMAGE?env.APPIMAGE:execPath,args};
}
module.exports={HEADER,CLIENT,serverRequest,serverOrigin,externalURL,connectionLink,trusted,setupFrame,updateLevel,relaunchOptions};
