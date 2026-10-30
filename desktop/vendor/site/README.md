# The site's sign-in, vendored

These files are Easter Co. SMP's own sign-in, copied byte for byte out of
`/root/easter-co-smp.github.io/site` (revision `5fd2c7c`, 2026-10-29). Nothing here is edited.
`VENDORED.json` lists every file with the sha256 it had when it was taken, and
`tests/company-signin.test.cjs` checks each one on every `npm test`; when a site checkout is
available (`EASTER_SITE_DIR`, or the default path above) the same test `cmp`s each file against
the site's own copy, and `scripts/verify-company-signin.cjs` does it again against the packaged
build.

| Served as | From here | From the site |
| --- | --- | --- |
| `/account/` | `account/index.html` | `site/account/index.html` |
| `/account/account.mjs` | `account/account.mjs` | `site/account/account.mjs` |
| `/account/account.css` | `account/account.css` | `site/account/account.css` |
| `/account/microsoft-signin.mjs` | `account/microsoft-signin.mjs` | `site/account/microsoft-signin.mjs` |
| `/auth-return.mjs` | `auth-return.mjs` | `site/auth-return.mjs` |
| `/styles.css` | `styles.css` | `site/styles.css` |
| `/desktop.css` | `desktop.css` | `site/desktop.css` |
| `/assets/ec-logo.svg` | `assets/ec-logo.svg` | `site/assets/ec-logo.svg` |
| `/assets/favicon.ico`, `.png`, `apple-touch-icon.png` | `assets/…` | `site/assets/…` |
| `/signin-options.mjs` | `../launcher/signin-options.mjs` | `site/signin-options.mjs` |
| `/account-client.mjs` | `../launcher/account-client.mjs` | `site/account-client.mjs` |

The last two rows are served from the copies this client already carried (they are byte identical
to the site's, and the suite says so). They are not duplicated here: `site/account/account.mjs`
imports the panel and `site/account/microsoft-signin.mjs` imports the account client, so both
imports have to resolve for the page to load at all.

## What is NOT a copy, and why

Three slots on the page are answered by this client, because a desktop client's account is not a
browser tab's:

- **`/web-account.mjs`** — the seam. On the site it is `site/web-account.mjs`: a Company session
  kept in `sessionStorage` and an account API called with `fetch`. Here it is
  `desktop/signin-adapter.mjs`, which answers the same six questions from the main process and
  its OS keyring. Vendoring the site's file would have put a Company session in a renderer, which
  this client's whole account design exists to prevent.
- **`/web.css`** — the site's *web-mode* overlay slot and the last stylesheet in the page's head.
  It carries `desktop/signin.css`, the e-server skin: e-server's palette, its typography and its
  wordmark, with every box the site draws left exactly as the site draws it.
- **`/web.js`**, **`/downloads.js`**, **`/desktop.js`** — the site's own page controllers (the
  nav's account dialog, the download popover, the store entry). There are no site routes inside
  this client, so each is answered with an empty script.

`desktop/signin.cjs` holds that table and the private scheme the page is served on, and explains
why the page needs a pathname of `/account/` rather than a `file://` address.
