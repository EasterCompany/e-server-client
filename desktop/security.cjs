'use strict';
const HEADER='X-Easter-Desktop',CLIENT='e-server/1';
function serverOrigin(value,{development=false}={}){
 let url;try{url=new URL(String(value).trim());}catch{throw Error('Enter the full HTTPS address of your e-server.');}
 const loopback=['127.0.0.1','localhost','[::1]'].includes(url.hostname);
 if(url.protocol!=='https:'&&!(development&&loopback&&url.protocol==='http:'))throw Error('Your e-server address must use HTTPS.');
 if(url.username||url.password||url.search||url.hash||!['','/'].includes(url.pathname))throw Error('Enter a server origin without a path, password or query.');
 return url.origin;
}
function externalURL(value){const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password)throw Error('Only HTTPS links can open in your browser.');return url.href;}
function connectionLink(value){const url=new URL(value);if(url.protocol!=='e-server:'||url.hostname!=='connect')throw Error('Invalid e-server connection link.');return serverOrigin(url.searchParams.get('server'));}
function trusted(event,origin){return event.senderFrame===event.sender.mainFrame&&new URL(event.senderFrame.url).origin===origin;}
function localFrame(event){return event.senderFrame===event.sender.mainFrame&&event.senderFrame.url.startsWith('file://');}
function updateLevel(from,to){const a=from.split('.').map(Number),b=to.split('.').map(Number);return a[0]!==b[0]?'major':a[1]!==b[1]?'minor':'patch';}
function relaunchOptions({platform=process.platform,env=process.env,execPath=process.execPath,argv=process.argv,packaged=true,appPath='',hidden=false}={}){
 const args=packaged?[]:[appPath];if(argv.includes('--no-sandbox'))args.push('--no-sandbox');if(hidden)args.push('--hidden-to-tray');
 return {execPath:platform==='linux'&&env.APPIMAGE?env.APPIMAGE:execPath,args};
}
module.exports={HEADER,CLIENT,serverOrigin,externalURL,connectionLink,trusted,localFrame,updateLevel,relaunchOptions};
