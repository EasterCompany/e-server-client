'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {CompanyAccount}=require('../desktop/company.cjs');
function fixture(overrides={}){
 let saved=null,now=100000;
 const signed={session:{token:'GLOBAL-SECRET',expiresAt:200000},account:{id:'34',username:'oceaster',passwordRequired:false}};
 const calls=[];
 const client={loginPassword:async(...args)=>{calls.push(['login',...args.slice(0,2)]);return signed;},me:async()=>signed.account,logout:async token=>{calls.push(['logout',token]);},usernameAvailable:async()=>({available:true}),setPassword:async()=>signed,...overrides.client};
 const vault={writeEncrypted:async(file,value)=>{saved=value;return true;},readEncrypted:async()=>saved,remove:async()=>{saved=null;},...overrides.vault};
 const toSession=value=>{if(!value?.session?.token||!Number.isFinite(value.session.expiresAt))throw Error('Invalid session');return {...value.session,account:value.account};};
 const account=new CompanyAccount({client,vault,file:'company.enc',toSession,publicAccount:session=>({id:session.account.id,name:session.account.username,passwordRequired:session.account.passwordRequired}),now:()=>now,microsoft:async()=>signed,provider:async()=>signed});
 return {account,signed,calls,saved:()=>saved,clock:value=>{now=value;}};
}
test('server selection is refused until a global account signs in; UI never gets its token',async()=>{
 const f=fixture();assert.throws(()=>f.account.require(),/Sign in/);
 await f.account.login('oceaster','password');assert.equal(f.account.authorized(),true);
 assert.equal(f.account.key(),'34');assert(!JSON.stringify(f.account.view()).includes('GLOBAL-SECRET'));
 assert.equal(f.saved().token,'GLOBAL-SECRET');
 f.clock(200001);assert.throws(()=>f.account.require(),/Sign in/);assert.equal(f.account.view().account,null);
});
test('restored credentials are verified before server selection becomes available',async()=>{
 const f=fixture();await f.account.login('oceaster','password');f.account.session=null;
 let release;f.account.client.me=()=>new Promise(resolve=>{release=resolve;});
 const restored=f.account.restore();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.account.authorized(),false);release(f.signed.account);await restored;assert.equal(f.account.authorized(),true);
});
test('a revoked global session cannot unlock a remembered server',async()=>{
 const f=fixture();await f.account.login('oceaster','password');f.account.session=null;
 f.account.client.me=async()=>{throw Object.assign(Error('Expired'),{status:401});};await f.account.restore();
 assert.equal(f.account.authorized(),false);assert.equal(f.saved(),null);
});
test('an unavailable keyring keeps the global session in memory only',async()=>{
 const f=fixture({vault:{writeEncrypted:async()=>false}});await f.account.login('oceaster','password');
 assert(f.account.authorized());assert.equal(f.saved(),null);assert.match(f.account.view().accountNotice,/app session only/);
});
test('new provider accounts must finish username/password before selecting a server',async()=>{
 const f=fixture();f.account.microsoft=async()=>({...f.signed,account:{...f.signed.account,passwordRequired:true}});
 await f.account.signIn('microsoft');assert.throws(()=>f.account.require(),/Sign in/);
 await f.account.finish('oceaster','long-password');assert(f.account.authorized());
});
test('sign-out revokes the global credential and removes the local vault',async()=>{
 const f=fixture();await f.account.login('oceaster','password');await f.account.signOut();
 assert.equal(f.account.authorized(),false);assert.equal(f.saved(),null);assert(f.calls.some(call=>call[0]==='logout'));
});
test('a late provider response cannot sign someone back in after cancellation',async()=>{
 const f=fixture();let release;f.account.provider=()=>new Promise(resolve=>{release=resolve;});
 const pending=f.account.signIn('google');f.account.cancel();release(f.signed);
 await assert.rejects(pending,/cancelled/);assert.equal(f.account.authorized(),false);
});
test('Microsoft global sign-in never invokes Minecraft or hands over a refresh token',async()=>{
 const {CompanyMicrosoft}=require('../desktop/company-microsoft.cjs');let args;
 const auth=new CompanyMicrosoft({accounts:{login:async(...value)=>{args=value;return 'signed';}},log:{append(){}}});
 auth.xboxSignIn=async()=>({xbox:{Token:'XBOX'},refreshToken:'MS-REFRESH'});
 auth.graphAccessToken=async()=>({accessToken:'GRAPH',refreshToken:'ROTATED'});
 auth.xstsAuthorize=auth.minecraftSignIn=auth.checkAccess=()=>{throw Error('Minecraft must not run');};
 assert.equal(await auth.exchange({access_token:'MS'}),'signed');assert.equal(args[0],'XBOX');assert.equal(args[3],'GRAPH');assert.equal(args[5],undefined);
});
