'use strict';
const {contextBridge,ipcRenderer}=require('electron');
// THE CLIENT'S OWN TWO DOCUMENTS, and nothing else: they are the only things served on this
// private scheme, by this process alone (desktop/signin.cjs, desktop/security.cjs setupFrame).
if(location.protocol==='e-server-signin:'){
 contextBridge.exposeInMainWorld('eServerSetup',{
  connect:origin=>ipcRenderer.invoke('client:connect',origin),state:()=>ipcRenderer.invoke('client:state'),
  retry:()=>ipcRenderer.invoke('client:retry'),download:()=>ipcRenderer.invoke('client:installer'),
  finish:(username,password)=>ipcRenderer.invoke('company:finish',username,password),
  signOut:()=>ipcRenderer.invoke('company:signout'),
  // The site's account page signs in through these three (desktop/signin-adapter.mjs). Each
  // answers `{ok:true}` or `{ok:false,error}` - a refusal arrives as a sentence, which is what the
  // site's own panel reads, never as a rejected command.
  signinLogin:(identifier,secret)=>ipcRenderer.invoke('signin:login',identifier,secret),
  signinProvider:provider=>ipcRenderer.invoke('signin:provider',provider),
  signinProviders:()=>ipcRenderer.invoke('signin:providers'),
  onState:callback=>{const listener=(_,state)=>callback(state);ipcRenderer.on('client:state',listener);return()=>ipcRenderer.removeListener('client:state',listener);}
 });
}else{
 contextBridge.exposeInMainWorld('eServerClient',{
  openExternal:value=>ipcRenderer.invoke('client:external',value),microsoft:()=>ipcRenderer.invoke('client:microsoft'),
  provider:value=>ipcRenderer.invoke('client:provider',value),
  signInFinished:()=>ipcRenderer.send('client:signin-finished'),cancelSignIn:()=>ipcRenderer.invoke('client:cancel-signin'),
  // The e-server page's own two calls (api/profile_assets/handoff.mjs and signout.mjs). They
  // take a destination and nothing else: no Company session, no account document and no server
  // origin crosses this bridge in either direction, because the main process already holds all
  // three. Each answers a promise the page awaits, and main.cjs answers only the connected
  // server's main frame (remote(event)), so a frame that is not this page gets a refusal rather
  // than an answer.
  bindSession:next=>ipcRenderer.invoke('client:handoff',next),signOut:()=>ipcRenderer.invoke('client:signout')
 });
 let last=0;
 for(const kind of ['keydown','pointerdown','input'])window.addEventListener(kind,()=>{if(Date.now()-last>300){last=Date.now();ipcRenderer.send('client:activity');}},{capture:true,passive:true});
}
