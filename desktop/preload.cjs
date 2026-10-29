'use strict';
const {contextBridge,ipcRenderer}=require('electron');
if(location.protocol==='file:'){
 contextBridge.exposeInMainWorld('eServerSetup',{
  connect:origin=>ipcRenderer.invoke('client:connect',origin),state:()=>ipcRenderer.invoke('client:state'),
  retry:()=>ipcRenderer.invoke('client:retry'),download:()=>ipcRenderer.invoke('client:installer'),
  login:(identifier,password)=>ipcRenderer.invoke('company:login',identifier,password),
  provider:provider=>ipcRenderer.invoke('company:provider',provider),providers:()=>ipcRenderer.invoke('company:providers'),
  finish:(username,password)=>ipcRenderer.invoke('company:finish',username,password),
  cancelAccount:()=>ipcRenderer.invoke('company:cancel'),signOut:()=>ipcRenderer.invoke('company:signout'),
  onState:callback=>{const listener=(_,state)=>callback(state);ipcRenderer.on('client:state',listener);return()=>ipcRenderer.removeListener('client:state',listener);}
 });
}else{
 contextBridge.exposeInMainWorld('eServerClient',{
  openExternal:value=>ipcRenderer.invoke('client:external',value),microsoft:()=>ipcRenderer.invoke('client:microsoft'),
  provider:value=>ipcRenderer.invoke('client:provider',value),
  signInFinished:()=>ipcRenderer.send('client:signin-finished'),cancelSignIn:()=>ipcRenderer.invoke('client:cancel-signin')
 });
 let last=0;
 for(const kind of ['keydown','pointerdown','input'])window.addEventListener(kind,()=>{if(Date.now()-last>300){last=Date.now();ipcRenderer.send('client:activity');}},{capture:true,passive:true});
}
