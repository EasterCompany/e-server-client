import {createSignInOptions} from './vendor/launcher/signin-options.mjs';
const $=id=>document.getElementById(id),bridge=window.eServerSetup;
let providersLoaded=false;
const problem=error=>{$('error').textContent=error.message||String(error);$('error').hidden=false;};
async function action(work){try{await work();}catch(error){problem(error);}finally{options.clearPassword();}}
const options=createSignInOptions({onSubmit:(id,password)=>{options.clearPassword();return action(()=>bridge.login(id,password));},onMicrosoft:()=>action(()=>bridge.provider('microsoft')),onProvider:provider=>action(()=>bridge.provider(provider)),onProblem:lines=>problem({message:[].concat(lines).join('\n')})});
$('account-signin').append(options.node);
function render(state){
 const ready=state.accountReady===true,finish=!!state.account&&!ready;
 const updating=['checking','downloading','verifying'].includes(state.phase);
 $('version').textContent=state.version;
 $('title').textContent=ready?state.title||'Your e-server.':finish?'Make it yours.':'Sign in to Easter Company.';
 $('message').textContent=ready?state.message||'Connect to your private network, then enter your server HTTPS address.':finish?'Choose your username and password to finish your global account.':state.accountBusy?'Connecting to Easter Company…':'Sign in or create your global account before choosing an e-server.';
 $('account-signin').hidden=ready||finish||updating;
 $('account-finish').hidden=!finish||updating;
 $('account-status').hidden=!state.account||updating;
 $('account-name').textContent=state.account?.name||'';
 $('connect').hidden=!ready||!['setup','offline'].includes(state.phase);
 $('retry').hidden=!ready||!['offline','update-error'].includes(state.phase);$('installer').hidden=state.phase!=='update-error';
 $('cancel-signin').hidden=!state.accountBusy;
 options.lock(!!state.accountBusy);
 for(const item of $('account-finish').elements)item.disabled=!!state.accountBusy;
 if(finish&&state.account.username){$('username').value=state.account.username;$('username').readOnly=true;}else $('username').readOnly=false;
 $('progress').hidden=!updating;
 if(Number.isFinite(state.percent))$('progress').value=state.percent;else $('progress').removeAttribute('value');
 $('progress').max=100;
 const error=state.accountError||state.error||'';$('error').textContent=error;$('error').hidden=!error;
 $('account-notice').textContent=state.accountNotice||'';$('account-notice').hidden=!state.accountNotice;
 if(ready&&!$('server').value)$('server').value=state.server||'https://easter-server.char-istrian.ts.net';
 if(!ready&&!finish&&!providersLoaded&&!state.accountBusy){providersLoaded=true;bridge.providers().then(answer=>options.setProviders(answer.providers||[])).catch(()=>{providersLoaded=false;options.providersUnreadable();});}
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
$('cancel-signin').onclick=()=>bridge.cancelAccount();
$('retry').onclick=()=>bridge.retry();$('installer').onclick=()=>bridge.download();bridge.onState(render);bridge.state().then(render);
