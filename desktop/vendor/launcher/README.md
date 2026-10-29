These account contracts, sign-in controls, PKCE loopback implementation, provider
broker and OS-keyring vault are reused from Easter Co. SMP's desktop launcher.
Source revision: 5fd2c7c35ab35272af6dd3f3177ac11e2e59647b.

The account client is loaded only by the main process. The setup renderer receives
only the shared sign-in controls. Keep these files unchanged when syncing upstream.
CompanyMicrosoft stops the Microsoft flow at Company identity; e-server never asks
for Minecraft entitlement and never hands over a Microsoft refresh token.
