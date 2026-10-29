e-server desktop client for Windows 10+ (x64), Ubuntu, Arch Linux and Linux AppImage (x86_64). Install the client, connect to your private network or VPN, and enter your e-server HTTPS address. No server credentials are bundled into these installers.

One Easter Company sign-in, before the server is chosen. The client signs you in once, and the e-server you connect to now takes that same account: the app proves the Easter Company session it already holds, so the server's PIN session is bound to it without asking you again.

One sign-in in the app instead of two. The server used to ask for an Easter Company account a second time on its own account page, because it could not see the one the app was already using. It no longer does: the app shows one sign-in, and that page has nothing left to draw.

The account in the server's top navigation is your global Easter Company account. Its name and its menu come from the account the server session is bound to, so it is the same identity in the app and on the server rather than a per-server label.

Signing out there ends both. The top-nav sign-out ends the server's session and the app's own Easter Company session, and revokes your Company token at the accounts service. If the app cannot be reached it says so instead of pretending: it ends what it can reach and tells you the app's session is still signed in, and what to do about it.

Unchanged from the previous release: the protected Electron renderer, system-browser provider sign-in, file uploads and downloads, camera/microphone/screen-sharing permission prompts, notifications, tray support, and verified per-user updates that stage in the background and wait for an idle client. Patch updates preserve state; minor updates clear the HTTP cache; major updates clear the server's local sign-in state; save active work before manually restarting for an update.

Windows installers are currently unsigned. SmartScreen may warn; verify the source repository and SHA256SUMS before running. Linux AppImage may require FUSE 2. macOS, ARM and mobile clients are not offered.
