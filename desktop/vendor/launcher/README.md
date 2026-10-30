These account contracts, sign-in controls, PKCE loopback implementation, provider
broker and OS-keyring vault are reused from Easter Co. SMP's desktop launcher.
Source revision: 5fd2c7c35ab35272af6dd3f3177ac11e2e59647b.

The account client is loaded only by the main process. The shared sign-in controls
(signin-options.mjs) are served into the site's own account page, which this client
mounts as its sign-in (desktop/signin.cjs, desktop/vendor/site/README.md); the
account client is imported by that page's Microsoft module and by nothing in a
renderer. Keep these files unchanged when syncing upstream.
CompanyMicrosoft stops the Microsoft flow at Company identity; e-server never asks
for Minecraft entitlement and never hands over a Microsoft refresh token.
