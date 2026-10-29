'use strict';
// THE TWO BRIDGE ACTIONS THE SERVER PAGE ALREADY CALLS (2026-10-29).
//
// Owen: "the user drop down and button in the top nav should be directly linked to the
// global account, so logging out there logs out globally of e-server app - not just that
// e-server instance." The e-server page's own two files are the contract and they were
// measured against the deployed server, not guessed:
//
//   * api/profile_assets/handoff.mjs asks `window.eServerClient.bindSession(next)` and
//     sends the browser to answer.next when `answer.ok === true`; any other answer, or a
//     bridge that threw, falls back to /account (one form, not two).
//   * api/profile_assets/signout.mjs asks `window.eServerClient.signOut()` and reads
//     `answer.ok`, `answer.instance` and `answer.global` ('ended' | 'not_ended' | 'none').
//     When `global` is not 'ended' it says so, in the page the person lands on. It never
//     claims the global half ended unless this side said so.
//
// So this module is the MAIN PROCESS's half of that contract, and it holds all of it that
// can be exercised without Electron: the exact request each action sends, the answer it
// resolves for every shape the server really returns, and the ORDER of a sign-out. Its
// caller (desktop/main.cjs) supplies the transport - the connected server's Electron
// session, so the PIN cookie rides along exactly as it does for every other /desktop
// request - and the Company token, and nothing else.
//
// THE TOKEN RULE, AMENDED HERE AND NOT BROKEN (desktop/company.cjs line 2):
// "Server origins never receive this token" was the whole rule while the app only talked
// to the accounts service. It is now narrower and still absolute: the token leaves the
// main process ONLY as the Authorization header of this one POST, to the origin that is
// already connected. It never enters a renderer, a URL, a redirect, a log line, an update
// payload or an answer this module resolves - `{ok, error, next, detail}` carries no
// credential, and tests/bridge.test.cjs greps that.

/** The supported-client hint every native request to this server carries. */
const HEADER = 'X-Easter-Desktop', CLIENT = 'e-server/1';
/** What tells the server this is the app's own request, not a page fetch (api.desktop_client.pin). */
const REQUEST_HEADER = 'X-Easter-Desktop-Request';
/** The one fact only this process can state about its own session (api.profile_routes.logout). */
const GLOBAL_SIGNOUT_HEADER = 'X-Easter-Desktop-Global-Signout';
const HANDOFF_PATH = '/desktop/auth/company', SIGNOUT_PATH = '/profiles/logout';

// NAMED BOUNDS. A hung server must not hang the app: the handoff is bounded like the other
// /desktop/auth calls (20 s in main.cjs's ask()), and a sign-out is shorter because the app
// has already locked itself and the person is waiting to be told the truth about it.
const HANDOFF_TIMEOUT_MS = 10000, SIGNOUT_TIMEOUT_MS = 5000;

// Every refusal the deployed server names, by the status that carries it. 403 has two codes
// (account_incomplete, and `refused` from the household decision), so the body's own `error`
// wins whenever it names one and this table is only the fallback.
const REFUSAL_BY_STATUS = {
  400: 'invalid_request', 401: 'company_sign_in_required', 403: 'account_incomplete',
  409: 'bound', 413: 'too_large', 429: 'rate_limited', 503: 'unavailable',
};
const REFUSAL_CODES = new Set([...Object.values(REFUSAL_BY_STATUS), 'refused']);
// Client-side outcomes for a call that never reached an answer. The page falls back on any
// of them; these names are for the person reading the app's own diagnostics.
const OFFLINE = 'unavailable', TIMEOUT = 'timeout', LOCAL = 'bridge_failed';

/**
 * A path on that origin, never a scheme-relative URL that leaves it - the rule the server's
 * own handoff.mjs applies to `answer.next` before it navigates there. `null` when it is not
 * one, so a caller can tell "no path" from "the root".
 */
function path(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : null;
}
function landing(value) {
  return path(value) || '/';
}

/** The refusal shape. `detail` is the server's sentence; `error` is the code the page can branch on. */
function refusal(status, body) {
  const document = body && typeof body === 'object' ? body : {};
  const named = typeof document.error === 'string' && REFUSAL_CODES.has(document.error) ? document.error : '';
  return {
    ok: false,
    error: named || REFUSAL_BY_STATUS[status] || OFFLINE,
    status,
    detail: typeof document.detail === 'string' ? document.detail : '',
  };
}

/** A response body, read once and never trusted to be JSON. */
async function document(response) {
  try {
    const text = typeof response.text === 'function' ? await response.text() : '';
    return text ? JSON.parse(text) : {};
  } catch (error) {
    return {};
  }
}

/**
 * One bounded request, with no redirect followed.
 *
 * `redirect: 'manual'` is the contract, not a nicety: following a redirect would replay a
 * request that either carries a live credential or reports a sign-out, on an origin this
 * process did not choose. A 3xx is therefore an answer this module refuses rather than a
 * hop it takes - and an opaque-redirect body is never read.
 */
async function call(send, url, init, timeout) {
  const response = await send(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(timeout) });
  const status = response.type === 'opaqueredirect' ? 0 : response.status;
  return { status, body: status === 0 ? {} : await document(response) };
}

/** Why a call produced no answer, named honestly rather than as a mystery rejection. */
function reason(error) {
  const name = error && error.name;
  return name === 'TimeoutError' || name === 'AbortError' ? TIMEOUT : OFFLINE;
}

/**
 * `window.eServerClient.bindSession(next)`: prove the Company session this app already holds.
 *
 * Answers `{ok: true, next}` when the server bound the PIN session to that account, and
 * `{ok: false, error, status, detail}` for every refusal - never a rejection, because the
 * page's fallback is the thrown path and a named code is more honest than a mystery.
 * The profile the server also returns is deliberately not passed on: the page needs a
 * destination, and this bridge hands the renderer no account document it did not ask for.
 */
async function bindSession({ origin, token, next, send = globalThis.fetch, timeout = HANDOFF_TIMEOUT_MS } = {}) {
  const target = landing(next);
  try {
    if (typeof token !== 'string' || !token) return { ok: false, error: 'company_sign_in_required', status: 0, detail: '' };
    if (typeof origin !== 'string' || !origin) return { ok: false, error: OFFLINE, status: 0, detail: '' };
    const { status, body } = await call(send, origin + HANDOFF_PATH, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        [HEADER]: CLIENT,
        [REQUEST_HEADER]: '1',
      },
      body: JSON.stringify({ next: target }),
    }, timeout);
    // The server answers the destination it accepted, which may differ from the one asked
    // for; when it names none, the path this call asked for is what the page already has.
    if (status === 200 && body && body.ok === true) return { ok: true, next: path(body.next) || target };
    return refusal(status, body);
  } catch (error) {
    return { ok: false, error: reason(error), status: 0, detail: '' };
  }
}

/**
 * The report, and only the report: `POST /profiles/logout` from THIS process, after this
 * process has already ended its own session. The header carries one fact about the client's
 * own session and is never authority for anything on that side.
 *
 * Answers `{ok, instance, global}`. When the request could not complete the answer is still
 * `{ok: true, instance: 'ended', global: 'not_ended'}`: the client's half genuinely did end,
 * and it must not claim the server's did.
 */
async function report({ origin, send = globalThis.fetch, timeout = SIGNOUT_TIMEOUT_MS } = {}) {
  const local = { ok: true, instance: 'ended', global: 'not_ended' };
  if (typeof origin !== 'string' || !origin) return local;
  try {
    const { status, body } = await call(send, origin + SIGNOUT_PATH, {
      method: 'POST',
      credentials: 'include',
      headers: { [HEADER]: CLIENT, [GLOBAL_SIGNOUT_HEADER]: 'ended' },
    }, timeout);
    if (status !== 200 || !body || body.ok !== true) return local;
    // 'ended' is the server's echo of this client's own report. 'app' (it could not see the
    // report) and 'none' (it thinks there is no app) are both NOT ended, and saying so is
    // the whole point: a sign-out that leaves somebody signed in is a lie found later.
    return { ok: true, instance: 'ended', global: body.global === 'ended' ? 'ended' : 'not_ended' };
  } catch (error) {
    return local;
  }
}

/**
 * `window.eServerClient.signOut(next)`: end the client's own session FIRST, then report it.
 *
 * The order is the contract - the server's answer may only say 'ended' about a global
 * session that is already gone here, so `endOwn` is awaited before the request is made.
 * If the client's own half cannot be ended, nothing is reported and the answer says the
 * sign-out did not complete, because a PIN session left alive is not a sign-out either.
 */
async function endSession({ endOwn, origin, send = globalThis.fetch, timeout = SIGNOUT_TIMEOUT_MS } = {}) {
  try {
    await endOwn();
  } catch (error) {
    return { ok: false, error: LOCAL, instance: 'not_ended', global: 'not_ended' };
  }
  return report({ origin, send, timeout });
}

module.exports = {
  HEADER, CLIENT, REQUEST_HEADER, GLOBAL_SIGNOUT_HEADER, HANDOFF_PATH, SIGNOUT_PATH,
  HANDOFF_TIMEOUT_MS, SIGNOUT_TIMEOUT_MS, REFUSAL_BY_STATUS,
  landing, bindSession, report, endSession,
};
