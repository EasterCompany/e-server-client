# Company account before server selection

The client starts at the shared Easter Company sign-in controls. Direct username/email
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
global Company session token; its own PIN and access checks remain in place.

The native File/Edit/View menu is removed. App controls remain in the tray menu. Ctrl+,
(Command+, on macOS development environments) opens server selection; the setup view also
has a sign-out action. Updates wait while that account/setup view is visible.

The default server already supports verified HTTPS. Older splash pages advertised their
internal reverse-proxy HTTP scheme. The client upgrades only the known default hostname on
HTTP port 80 to its HTTPS origin; other HTTP origins remain refused outside loopback tests.
The companion backend PR fixes the advertised scheme using only its trusted proxy peer.

Version 1.0.1 is prepared for Delta to review, merge and release. No tag or release is created
by this work. Native keyless integration covers login-before-server, IPC refusal, the removed
menu, server PIN/Microsoft flow and renderer isolation. Real provider accounts and fresh-OS
installer execution remain manual release checks.
