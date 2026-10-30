# Company account before server selection

The client starts at the shared Easter Company sign-in controls (since 2026-10-30 that is
Easter Co. SMP's own account page, vendored byte for byte and re-skinned: see the section below).
Direct username/email
and password, Microsoft, Google, Steam and Discord use the launcher's existing account
contracts. New provider accounts finish their username/password before unlocking the client.
Microsoft uses the launcher's native PKCE/state/loopback implementation, stopping at Company
identity: no Minecraft login, entitlement check, game mint or refresh-token handover occurs.

Global session credentials stay in the main process and its OS-keyring encrypted vault.
Without a secure keyring the session stays in memory. Saved sessions are verified at startup;
expiry locks the client again. There is no periodic global-account polling. Server selection,
remembered-server startup, retry and deep-link handling all enforce the main-process gate.
Remote server frames have no access to global-account IPC. Their browser partitions are
separated by Company identity as well as server origin. A selected server never receives the
global Company session token as page content, an argument, a URL or a stored value; its own
PIN and access checks remain in place. The one amendment to that rule is below.

The native File/Edit/View menu is removed. App controls remain in the tray menu. Ctrl+,
(Command+, on macOS development environments) opens server selection; the setup view also
has a sign-out action. Updates wait while that account/setup view is visible.

The default server already supports verified HTTPS. Older splash pages advertised their
internal reverse-proxy HTTP scheme. The client upgrades only the known default hostname on
HTTP port 80 to its HTTPS origin; other HTTP origins remain refused outside loopback tests.
The companion backend PR fixes the advertised scheme using only its trusted proxy peer.

## The sign-in is the site's sign-in, re-skinned (2026-10-30)

Owen, 2026-10-30: "ditch the e-server client login design it's awful ... make sure the
e-server client login for Easter Company accounts has the same layout and look as the
easter-co-smp website & launcher and also easter.company website, I like that design,
just ya know, make it theme'd for e-server - like we had before except that old design
was associated with the actual e-server instance login. However this login forum is for
the users actual Easter Company, not for access to the e-server."

So the client no longer draws a sign-in of its own. `desktop/shell.html` keeps the
client's own setup surface (the account's last step, the server address, updates and
sign-out) and the sign-in is Easter Co. SMP's account page: `site/account/index.html`
plus `account.mjs`, `signin-options.mjs` and the files they import, copied byte for
byte into `desktop/vendor/site/` and served unchanged. `desktop/vendor/site/README.md`
lists what was taken and from which site revision; `VENDORED.json` records the sha256
of each file; `tests/company-signin.test.cjs` checks those hashes on every `npm test`
and `cmp`s every file against the site's own copy whenever a site checkout is
available. Nothing in that tree is edited.

**Where it is served.** `site/account/account.mjs` refuses to draw a sign-in anywhere
but the pathname of its registered Microsoft redirect (`/account/`): a `file://`
document has an absolute file path instead, so the vendored page would draw that
refusal and never the panel. `desktop/signin.cjs` therefore registers one private
scheme (`e-server-signin://company`) with a standard+secure origin, answers exactly the
paths in its `FILES` table, and nothing else. `e-server-signin://company/account/` has
the pathname the page checks; `e-server-signin://company/` is answered with this
client's own setup surface, which is where the page leaves for on a successful sign-in
(`signedIn()` sends the browser to the site root) - so the site's own rule lands on the
next step of the client instead of a missing page. Responses pin the page down: no
network of any kind (`connect-src 'none'`), no inline script or style, no frames.

**What is not a copy.** Three slots on the site's page are answered by this client:

* `/web-account.mjs` - `desktop/signin-adapter.mjs`. On the site this is the browser
  seam (a Company session in `sessionStorage`, an API called with `fetch`). Here it
  answers the same six questions from the main process and its OS keyring, so the
  vendored module runs unchanged and no session value ever reaches a renderer. Every
  refusal is an answer (`{ok:false,error}`), never a rejected command, and the sentence
  is the account service's own `message` - the same one the site's browser seam draws.
* `/web.css` - `desktop/signin.css`. The site's web-mode overlay slot, and the last
  stylesheet in the page's head, which is where a re-skin belongs: e-server's palette
  (`#0d1117`/`#161b22`/`#21262d`/`#c9d1d9`/`#8b949e`/`#8b5cf6`, the same tokens as
  `api/page_utils.py` and `/root/e-app/configs/static/system.css`), e-server's
  typography, and the accent control. Not one box changes: the panel stays 520px wide
  with its own padding and radius, every control keeps its 46px floor and 9px radius,
  and the gaps are the site's.
* `/web.js`, `/downloads.js`, `/desktop.js` - the site's page controllers (the nav's
  account dialog, the download popover, the store entry). There are no site routes
  inside the client, so each is answered with an empty script, and the adapter removes
  the site's navigation and its legal links rather than leaving dead links.

The adapter's other two adjustments are the header and the window title: the fire
phoenix the page already carries stays, the wordmark beside it reads **e-server**, and
the title is the site module's own sentence for the page (`SIGN_IN_TITLE`, "Easter
Company account") without the site's name after the dash.

**One window, two documents.** `desktop/signin.cjs`'s `documentFor` decides which the
setup window holds: the site's sign-in page while no account exists, and the client's
own setup surface once there is one (a session that still has to choose a username
counts) or while a startup update is in flight - that surface is where "Try again" and
"Download latest installer" live, and it is now also where a retried check that
succeeds hands the window back to the sign-in page (the update check no longer needs an
account to be retried).

**Proving it.** `scripts/verify-company-signin.cjs` runs the *packaged* client with an
isolated HOME, `cmp`s the sign-in files read back out of `app.asar` against the site,
renders the site's own page as a control in the same Chromium build, and requires the
two panels to agree box for box with the same options in the same order and the same
sentences - then requires the client's copy to carry e-server's colours, its
typography, its wordmark and the 26px mark, with no horizontal overflow at 1280x800 and
at the window's 360x500 minimum. It also drives two refusals on both surfaces and
requires one sentence each. It cannot prove a successful sign-in (that needs a
household credential) or the Microsoft round trip through the operating system's
browser; both are manual release checks.

## The global bridge: one sign-in and one sign-out (2026-10-29)

The e-server page already calls two actions on the server window's preload bridge and falls
back honestly when either is missing (`api/profile_assets/handoff.mjs` and `signout.mjs` on
the server; the half here is `desktop/bridge.cjs`). Both are main-frame only, through the same
`remote(event)` guard every other `client:*` command uses: the connected server's main frame
gets an answer, anything else gets a refusal. Both answer a promise and never reject into the
page, because the page's fallback is its `catch` and a named code is more honest.

`window.eServerClient.bindSession(next)` — the main process POSTs the Company session token it
already holds to `/desktop/auth/company` on the connected origin as `Authorization: Bearer`,
with `{"next": "<path>"}`, `Content-Type: application/json`, `X-Easter-Desktop: e-server/1`
and `X-Easter-Desktop-Request: 1`. The PIN cookie rides along because the request is made
through the connected server's own Electron session, exactly like `/desktop/auth/microsoft`.
No redirect is followed and the call is bounded (`HANDOFF_TIMEOUT_MS`, 10 s). `200` resolves
`{ok: true, next}`; every refusal resolves `{ok: false, error}` with the server's own code —
`company_sign_in_required` (401), `account_incomplete` / `refused` (403), `bound` (409),
`rate_limited` (429), `too_large` (413), `invalid_request` (400), `unavailable` (503) — plus
`timeout`/`unavailable` when the request never reached an answer.

`window.eServerClient.signOut()` — the client's OWN half ends FIRST (`company.signOut()`: memory
token cleared, keyring entry removed, app back at its own sign-in screen), and only then does
the main process make `POST /profiles/logout` itself with `X-Easter-Desktop: e-server/1` and
`X-Easter-Desktop-Global-Signout: ended`, bounded (`SIGNOUT_TIMEOUT_MS`, 5 s) and resolving
`{ok, instance, global}`. If that request fails it still answers
`{ok: true, instance: 'ended', global: 'not_ended'}`: the client's half genuinely ended and it
must not claim the server's did. The tray's "Sign out of Easter Company" runs the same code
path, so the menu and the top-nav sign-out cannot drift apart; the confirmation dialog stays
with the tray, where a menu item is a destructive action, and the page's bridge call adds none.

THE TOKEN RULE, AMENDED IN PLACE. `desktop/company.cjs` line 2 used to read "Server origins
never receive this token", which was absolute while the app only spoke to the accounts service.
It is now narrower and still absolute: the token leaves the main process ONLY as the Bearer
credential of that one main-process POST, to the origin already connected, so that the server
can ask the accounts service who it is and bind the PIN session. It never reaches a renderer, a
URL, a redirect, a log line or an update payload — the page that triggers the call never sees
it, and `credential()` in `desktop/company.cjs` is the single door out of the main process.
`tests/bridge.test.cjs` greps the preload bridge for the word and asserts the answers carry no
credential, and the proof it did leave is the fake server that receives it.

Version 1.0.1 is prepared for Delta to review, merge and release. No tag or release is created
by this work. Native keyless integration covers login-before-server, IPC refusal, the removed
menu, server PIN/Microsoft flow and renderer isolation. Real provider accounts and fresh-OS
installer execution remain manual release checks.
