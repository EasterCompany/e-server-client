'use strict';
const $=id=>document.getElementById(id),bridge=window.eServerSetup;
function render(state){
 $('version').textContent=state.version;$('title').textContent=state.title||'Your e-server.';$('message').textContent=state.message||'Connect to your private network, then enter your server address.';
 $('connect').hidden=!['setup','offline'].includes(state.phase);$('retry').hidden=!['offline','update-error'].includes(state.phase);$('installer').hidden=state.phase!=='update-error';
 $('progress').hidden=!['checking','downloading','verifying'].includes(state.phase);if(Number.isFinite(state.percent))$('progress').value=state.percent;else $('progress').removeAttribute('value');
 $('progress').max=100;$('error').textContent=state.error||'';$('error').hidden=!state.error;if(state.server&&!$('server').value)$('server').value=state.server;
}
$('connect').onsubmit=async event=>{event.preventDefault();try{await bridge.connect($('server').value);}catch(error){$('error').textContent=error.message;$('error').hidden=false;}};
$('retry').onclick=()=>bridge.retry();$('installer').onclick=()=>bridge.download();bridge.onState(render);bridge.state().then(render);
