'use strict';

/**
 * Meeting-link handoff -- the hivelogic:// custom protocol.
 *
 * A guest/invite call link (public/hiveconnect/call.html in the main web
 * app) tries this exact scheme before it ever shows the join gate (see
 * hivelogic-launcher.js over there). When this app is installed and
 * registered as its handler, the OS launches (or wakes) this app with the
 * link instead of leaving the person in a browser tab -- and because this
 * app already opens the whole real HiveLogic web app in one shared session,
 * the person stays genuinely signed in, instead of landing as a bare
 * anonymous guest in a second, disconnected app (the thing the earlier,
 * abandoned standalone-app attempt at this got wrong).
 *
 * Deliberately free of `require('electron')`, same as screen-annotate.js:
 * main.js owns the registry call (app.setAsDefaultProtocolClient) and the
 * argv/second-instance plumbing; everything here is pure string handling so
 * it can be unit-tested without a real Electron process.
 */

const PROTOCOL_SCHEME = 'hivelogic';

// Meeting ids and one-time passcodes are opaque tokens minted server-side
// (see public/hiveconnect/app.js's hvMeetingUrl()/makeGuestCallLink() in the
// main web app) -- never a path, never free text. Anything that doesn't
// look like one of those tokens is rejected before it gets anywhere near a
// navigation target, rather than trusted just because it arrived inside a
// hivelogic:// URL.
const SAFE_TOKEN = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Scan a process's argv (this app's own at startup, or another instance's
 * handed over via the 'second-instance' event) for a hivelogic:// URL.
 *
 * Checks every entry, not a fixed index: Windows hands the protocol URL to
 * the new process as a plain command-line argument, and its position varies
 * with how the app was packaged/launched (argv[1] unpackaged, further along
 * once electron-builder's own launch args are in front of it).
 */
function findProtocolUrl(argv, scheme = PROTOCOL_SCHEME) {
  if (!Array.isArray(argv)) return null;
  const prefix = `${scheme}://`;
  for (const arg of argv) {
    if (typeof arg === 'string' && arg.toLowerCase().startsWith(prefix)) return arg;
  }
  return null;
}

/**
 * Parse a hivelogic://join?m=...&p=... URL into { m, p }, or null if it
 * isn't one -- wrong scheme, wrong host, or a value that doesn't look like
 * a real meeting id/passcode.
 */
function parseProtocolUrl(rawUrl, scheme = PROTOCOL_SCHEME) {
  if (typeof rawUrl !== 'string' || rawUrl.length > 2048) return null;
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (_) {
    return null;
  }
  if (parsed.protocol !== `${scheme}:`) return null;
  // Chromium's URL parser puts a custom scheme's authority-like segment in
  // `hostname` on some builds and leaves it in `pathname` on others, since
  // "join" here isn't a real host -- accept it from either.
  const host = (parsed.hostname || parsed.pathname.replace(/^\/+/, '')).toLowerCase();
  if (host !== 'join') return null;

  const params = {};
  const m = parsed.searchParams.get('m');
  const p = parsed.searchParams.get('p');
  if (m && SAFE_TOKEN.test(m)) params.m = m;
  if (p && SAFE_TOKEN.test(p)) params.p = p;
  if (!params.m && !params.p) return null;
  return params;
}

/**
 * Build the real web app's call URL for a parsed { m, p } pair --
 * `<trustedOrigin>/hiveconnect/call.html?...&desktop=1`. `desktop=1` is what
 * tells call.html not to try handing itself off again from inside here (see
 * its own isDesktopApp check).
 */
function buildCallUrl(trustedOrigin, params) {
  const usp = new URLSearchParams();
  if (params && params.m) usp.set('m', params.m);
  if (params && params.p) usp.set('p', params.p);
  usp.set('desktop', '1');
  return `${trustedOrigin}/hiveconnect/call.html?${usp.toString()}`;
}

module.exports = {
  PROTOCOL_SCHEME,
  SAFE_TOKEN,
  findProtocolUrl,
  parseProtocolUrl,
  buildCallUrl,
};
