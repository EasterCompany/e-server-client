// THE CLIENT'S SEAM FOR THE SITE'S ACCOUNT PAGE. Served as /web-account.mjs.
//
// easter-co-smp.github.io/site/account/account.mjs is vendored here unchanged and it imports its
// account seam by that one path (`import {webAccount} from '../web-account.mjs'`). On the site
// that file is the browser seam: a Company session kept in this tab's sessionStorage and an
// account API called with fetch. This client already has an account seam of its own, and it is a
// stronger one - the session lives in the main process and its OS keyring, no session value ever
// reaches a renderer (desktop/company.cjs), and a refusal arrives as the account service's own
// sentence. So THIS FILE ANSWERS THAT ONE PATH, and it is the only
// substitution the client makes in the site's sign-in tree. Everything else on the page is the
// site's own bytes: desktop/vendor/site/README.md lists them, tests/company-signin.test.cjs cmp's
// every one of them against the site, and desktop/signin.cjs holds the table that serves them.
//
// WHAT THE PAGE ASKS THIS SEAM FOR, and what each answer means here:
//
//   ready                    the session has been read (desktop/main.cjs restores it before any
//                            window opens, so this is one IPC round trip).
//   getState()/.subscribe()  which whole answer is on screen. `account` is the main process's own
//                            account document, so a session that still has to choose a username
//                            still counts: the page leaves for the client's root, where that step
//                            lives, exactly as the site's page leaves for its own root.
//   accountProviders()       which broker providers this account service offers. `microsoft` is
//                            filtered out for the same reason the site's seam filters it: it has
//                            its own button and is not a broker.
//   loginCompany(id,secret)  the direct Easter Company username/password sign-in.
//   signInProvider(name)     a broker provider, in the operating system's browser.
//   startMicrosoftSignIn()   Microsoft, through the launcher's own PKCE/state/loopback flow
//                            (desktop/company-microsoft.cjs): no Minecraft sign-in, no
//                            entitlement lookup, and nothing Microsoft's kept.
//
// Nothing here rejects into the page. The site's panel reads an answer, not an exception, so every
// refusal is `{ok:false,error}` carrying the main process's sentence - which is the account
// service's own `message`, the same sentence the site's browser seam would draw. When there is no
// sentence at all the answer has no `error`, and the panel falls back to its own copy
// (SIGN_IN.failed / SIGN_IN.providerFailed) rather than this file inventing one.
//
// What is deliberately absent: sign-out, the store, profile edits and the provider-popup broker
// that the site's nav dialog needs. This page draws one thing - the options - and the client's
// sign-out lives in the tray, where a destructive action belongs.
//
// The page also gets the two adjustments below. They are presentation, they are the only DOM the
// client touches on the site's page, and both are made before the page's own module paints.
import {SIGN_IN_TITLE} from './signin-options.mjs';

const setup=window.eServerSetup;

// THE CLIENT'S CHROME ON THE SITE'S PAGE. The header keeps the fire phoenix the page already
// carries (assets/ec-logo.svg, vendored byte for byte) and the wordmark beside it is this
// client's: e-server, not Easter Co. SMP. The site's navigation and its legal links are site
// routes; there are none inside this client, and a link that cannot go anywhere is worse than no
// link, so they are removed rather than left dead. Nothing else on the page is touched: the
// framing, the panel, the sentences and the footer's own words are the site's.
function clientChrome(){
 const wordmark=document.querySelector('.site-header .site-wordmark');
 if(wordmark){
  const mark=wordmark.querySelector('img');
  wordmark.setAttribute('aria-label','e-server');
  wordmark.setAttribute('href','/');
  wordmark.replaceChildren(...(mark?[mark]:[]),document.createTextNode('e-server'));
 }
 document.querySelector('.site-header nav')?.remove();
 document.querySelector('.account-footer .legal-links')?.remove();
 // The window's title is the site's own sentence for this page (SIGN_IN_TITLE, the one the page
 // itself writes into its heading), without the site's name after the dash.
 document.title=SIGN_IN_TITLE;
}

// One cached answer, refreshed by the main process's own broadcast. `account` is the only field
// the vendored page reads.
let known={account:null};
const listeners=new Set();
const state=()=>({account:known.account||null});
const emit=()=>{for(const fn of listeners)fn(state());};
if(setup)setup.onState(next=>{known=next||{};emit();});

// `ready` is what a view awaits before it treats this seam as answered: the main process has
// already restored (and re-validated) any saved session before it opened this window, so the
// first read is the answer.
const ready=(async()=>{
 if(!setup)return;
 try{known=(await setup.state())||{};}catch{}
 emit();
})();

// The site's panel reads an answer and never an exception. Anything that did not arrive as one of
// the main process's own sentences is reported without an `error` field, which makes the panel
// draw its own sentence for that action rather than this file's.
const answer=async work=>{
 try{return await work();}catch(error){return {ok:false,error:error&&error.message?error.message:undefined};}
};

const seam={
 mode:'desktop',
 ready,
 getState:state,
 subscribe(fn){listeners.add(fn);fn(state());return()=>listeners.delete(fn);},
 // The site's seam draws only the providers the panel has a button for. A list that could not be
 // read is refused here so the page draws its own sentence (SIGN_IN.providerUnreadable) on the
 // buttons it could not check - it never claims a provider is unconfigured when the question
 // simply went unanswered.
 accountProviders:async()=>{
  const found=await setup.signinProviders();
  if(!found||found.ok!==true)throw Error('providers_unreadable');
  const list=Array.isArray(found.providers)?found.providers:[];
  return {providers:list.filter(provider=>['google','steam','discord'].includes(provider))};
 },
 loginCompany:(identifier,secret)=>answer(()=>setup.signinLogin(identifier,secret)),
 signInProvider:provider=>answer(()=>setup.signinProvider(provider)),
 startMicrosoftSignIn:()=>answer(()=>setup.signinProvider('microsoft')),
};

clientChrome();

// A page opened without the client's setup bridge is not in the client: exporting nothing makes
// the site's own module say so in its own words and offer no sign-in, which is the honest answer
// rather than a panel whose buttons could not do anything.
export const webAccount=setup?seam:null;
