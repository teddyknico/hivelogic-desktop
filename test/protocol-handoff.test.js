'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PROTOCOL_SCHEME,
  findProtocolUrl,
  parseProtocolUrl,
  buildCallUrl,
} = require('../src/protocol-handoff');

test('PROTOCOL_SCHEME is hivelogic', () => {
  assert.equal(PROTOCOL_SCHEME, 'hivelogic');
});

test('findProtocolUrl finds the scheme anywhere in argv, case-insensitively, and ignores everything else', () => {
  assert.equal(
    findProtocolUrl(['electron.exe', '--flag', 'HiveLogic://join?m=abc']),
    'HiveLogic://join?m=abc'
  );
  assert.equal(findProtocolUrl(['electron.exe', 'C:\\app', '--foo']), null);
  assert.equal(findProtocolUrl(null), null);
  assert.equal(findProtocolUrl(undefined), null);
  assert.equal(findProtocolUrl([]), null);
});

test('parseProtocolUrl accepts hivelogic://join with a token-shaped m and/or p', () => {
  assert.deepEqual(parseProtocolUrl('hivelogic://join?m=abc123'), { m: 'abc123' });
  assert.deepEqual(parseProtocolUrl('hivelogic://join?p=demo-pass_1'), { p: 'demo-pass_1' });
  assert.deepEqual(parseProtocolUrl('hivelogic://join?m=abc&p=xyz'), { m: 'abc', p: 'xyz' });
});

test('parseProtocolUrl rejects the wrong scheme, the wrong host, and a URL with neither m nor p', () => {
  assert.equal(parseProtocolUrl('https://hivelogic-live.vercel.app/join?m=abc'), null);
  assert.equal(parseProtocolUrl('hivelogic://leave?m=abc'), null);
  assert.equal(parseProtocolUrl('hivelogic://join'), null);
  assert.equal(parseProtocolUrl('not a url at all'), null);
  assert.equal(parseProtocolUrl(null), null);
  assert.equal(parseProtocolUrl(123), null);
});

test('parseProtocolUrl rejects a value that does not look like a real meeting id/passcode', () => {
  // Anything not opaque alphanumeric/dash/underscore -- a path segment, a
  // script tag, an overlong string -- never reaches a navigation target.
  assert.equal(parseProtocolUrl('hivelogic://join?m=' + encodeURIComponent('../../etc/passwd')), null);
  assert.equal(parseProtocolUrl('hivelogic://join?m=' + encodeURIComponent('<script>')), null);
  assert.equal(parseProtocolUrl('hivelogic://join?m=' + 'a'.repeat(129)), null);
  assert.equal(parseProtocolUrl('hivelogic://join?m='), null);
});

test('parseProtocolUrl caps overall URL length rather than parsing an arbitrarily long string', () => {
  assert.equal(parseProtocolUrl('hivelogic://join?m=abc&junk=' + 'a'.repeat(3000)), null);
});

test('buildCallUrl always lands on the trusted origin\'s call.html with desktop=1, carrying only validated params', () => {
  assert.equal(
    buildCallUrl('https://hivelogic-live.vercel.app', { m: 'abc123' }),
    'https://hivelogic-live.vercel.app/hiveconnect/call.html?m=abc123&desktop=1'
  );
  assert.equal(
    buildCallUrl('https://hivelogic-live.vercel.app', { p: 'demo' }),
    'https://hivelogic-live.vercel.app/hiveconnect/call.html?p=demo&desktop=1'
  );
  assert.equal(
    buildCallUrl('https://hivelogic-live.vercel.app', {}),
    'https://hivelogic-live.vercel.app/hiveconnect/call.html?desktop=1'
  );
});

test('the full path (argv -> parse -> build) never carries anything but m/p/desktop onto the trusted origin', () => {
  const argv = ['HiveLogic.exe', 'hivelogic://join?m=abc123&evil=https://attacker.test'];
  const url = findProtocolUrl(argv);
  const params = parseProtocolUrl(url);
  const target = buildCallUrl('https://hivelogic-live.vercel.app', params);
  assert.equal(target, 'https://hivelogic-live.vercel.app/hiveconnect/call.html?m=abc123&desktop=1');
});
