// THE CLIENT'S OWN SETUP SURFACE: what happens after the account, and nothing about signing in.
//
// The Easter Company sign-in is no longer drawn here. It is the site's own account page, vendored
// byte for byte and served by desktop/signin.cjs at e-server-signin://company/account/, with this
// client's seam in desktop/signin-adapter.mjs. This document is the other half of the setup
// window: the step where a provider account chooses its username and password, the server
// address, an update in flight, an offline server, and sign-out. The two documents never share a
// window at the same time (desktop/signin.cjs, documentFor).
const $=id=>document.getElementById(id),bridge=window.eServerSetup;
const problem=error=>{$('error').textContent=error.message||String(error);$('error').hidden=false;};
async function action(work){try{await work();}catch(error){problem(error);}}
function render(state){
 const ready=state.accountReady===true,finish=!!state.account&&!ready;
 const updating=['checking','downloading','verifying'].includes(state.phase);
 $('version').textContent=state.version;
 $('title').textContent=ready?state.title||'Your e-server.':finish?'Make it yours.':'Your e-server.';
 $('message').textContent=ready?state.message||'Connect to your private network, then enter your server HTTPS address.':finish?'Choose your username and password to finish your global account.':state.accountBusy?'Connecting to Easter Company…':'Connect to your private network, then enter your server HTTPS address.';
 $('account-finish').hidden=!finish||updating;
 $('account-status').hidden=!state.account||updating;
 $('account-name').textContent=state.account?.name||'';
 $('connect').hidden=!ready||!['setup','offline'].includes(state.phase);
 $('retry').hidden=!ready||!['offline','update-error'].includes(state.phase);$('installer').hidden=state.phase!=='update-error';
 for(const item of $('account-finish').elements)item.disabled=!!state.accountBusy;
 if(finish&&state.account.username){$('username').value=state.account.username;$('username').readOnly=true;}else $('username').readOnly=false;
 $('progress').hidden=!updating;
 if(Number.isFinite(state.percent))$('progress').value=state.percent;else $('progress').removeAttribute('value');
 $('progress').max=100;
 const error=state.accountError||state.error||'';$('error').textContent=error;$('error').hidden=!error;
 $('account-notice').textContent=state.accountNotice||'';$('account-notice').hidden=!state.accountNotice;
 if(ready&&!$('server').value)$('server').value=state.server||'https://easter-server.char-istrian.ts.net';
}
$('username').addEventListener('input',event=>{event.target.value=event.target.value.toLowerCase();});
$('account-finish').onsubmit=event=>{
 event.preventDefault();
 if($('new-password').value!==$('confirm-password').value){problem({message:'Passwords must match.'});return;}
 const password=$('new-password').value;$('new-password').value='';$('confirm-password').value='';
 void action(()=>bridge.finish($('username').value,password));
};
$('connect').onsubmit=event=>{event.preventDefault();void action(()=>bridge.connect($('server').value));};
$('signout').onclick=()=>action(()=>bridge.signOut());
$('retry').onclick=()=>bridge.retry();$('installer').onclick=()=>bridge.download();bridge.onState(render);bridge.state().then(render);
