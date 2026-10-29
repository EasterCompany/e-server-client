'use strict';
// Global identity stays in the main process. Server origins never receive this token.
class CompanyAccount{
 constructor({client,toSession,publicAccount,vault,file,changed=()=>{},microsoft,provider,now=Date.now}){
  Object.assign(this,{client,toSession,publicAccount,vault,file,changed,microsoft,provider,now});
  this.session=null;this.busy=false;this.error='';this.notice='';this.controller=null;this.timer=null;this.generation=0;
 }
 authorized(){return !!this.session&&this.session.expiresAt>this.now()&&!this.session.account.passwordRequired;}
 key(){this.require();return this.session.account.id;}
 require(){if(!this.authorized())throw Error('Sign in to your Easter Company account before choosing a server.');}
 view(){return {account:this.session&&this.session.expiresAt>this.now()?this.publicAccount(this.session):null,accountReady:this.authorized(),accountBusy:this.busy,accountError:this.error,accountNotice:this.notice};}
 emit(){this.changed(this.view());}
 arm(){clearTimeout(this.timer);if(this.session){this.timer=setTimeout(()=>{this.session=null;this.error='Your Easter Company session expired. Sign in again.';this.emit();},Math.max(1,Math.min(this.session.expiresAt-this.now(),2147483647)));this.timer.unref?.();}}
 async remember(signed){
  const next=this.toSession(signed);
  if(!next||next.expiresAt<=this.now())throw Error('Your Easter Company session expired. Sign in again.');
  this.session=next;this.arm();
  const saved=await this.vault.writeEncrypted(this.file,next).catch(()=>false);
  this.notice=saved?'':'A secure OS keyring is unavailable. Your account stays signed in for this app session only.';
  if(!saved)await this.vault.remove(this.file);
  this.emit();return this.view();
 }
 async restore(){
  const mark=this.generation;this.busy=true;this.controller=new AbortController();this.emit();
  try{
   const saved=await this.vault.readEncrypted(this.file);
   if(!saved)return;
   let next;try{next=this.toSession({session:{token:saved.token,expiresAt:saved.expiresAt},account:saved.account});}catch{return;}
   if(!next||next.expiresAt<=this.now()){await this.vault.remove(this.file);return;}
   const account=await this.client.me(next.token,this.controller.signal);
   if(mark!==this.generation)return;
   this.session={...next,account};this.arm();
  }catch(error){this.session=null;this.error=error.message;if(error.status===401||error.code==='invalid_session')await this.vault.remove(this.file);}
  finally{this.busy=false;this.controller=null;this.emit();}
 }
 async run(action){
  if(this.busy)throw Error('An account request is already in progress.');
  const mark=this.generation;this.busy=true;this.error='';this.controller=new AbortController();this.emit();
  try{const signed=await action(this.controller.signal);if(mark!==this.generation)throw Error('Sign-in cancelled.');return await this.remember(signed);}
  catch(error){this.error=error.name==='AbortError'?'Sign-in cancelled.':error.message;throw Error(this.error);}
  finally{this.busy=false;this.controller=null;this.emit();}
 }
 login(identifier,password){return this.run(signal=>this.client.loginPassword(identifier,password,signal));}
 signIn(provider){return this.run(signal=>provider==='microsoft'?this.microsoft(signal):this.provider(provider,signal));}
 async finish(username,password){
  if(!this.session||this.session.expiresAt<=this.now())throw Error('Sign in again to finish your account.');
  const token=this.session.token;
  return this.run(async signal=>{
   if(typeof password!=='string'||password.length<8||password.length>128)throw Error('Use a password of 8–128 characters.');
   const named=this.session.account.username?undefined:String(username||'').trim().toLowerCase();
   if(named!==undefined){const probe=await this.client.usernameAvailable(named,signal);if(!probe.available)throw Error(probe.reason==='username_policy'?'Use 3–20 letters, numbers, underscores or dashes.':'That username is already taken.');}
   return this.client.setPassword(token,password,false,named);
  });
 }
 cancel(){this.generation++;this.controller?.abort();}
 async signOut(){const previous=this.session;this.cancel();clearTimeout(this.timer);this.session=null;this.error='';this.notice='';await this.vault.remove(this.file);this.emit();if(previous)void this.client.logout(previous.token).catch(()=>{});}
}
module.exports={CompanyAccount};
