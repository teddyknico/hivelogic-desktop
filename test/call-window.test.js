'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createCallWindowManager } = require('../src/call-window');

// A fake BrowserWindow standing in for Electron's real one -- same style as
// screen-annotate.test.js's fake windows: just enough surface for the
// manager's own logic to exercise, with every call recorded for assertions.
function makeFakeBrowserWindowClass() {
  const instances = [];
  function FakeBrowserWindow(options) {
    this.options = options;
    this.destroyed = false;
    this.minimized = false;
    this.loadedUrls = [];
    this.focusCount = 0;
    this.restoreCount = 0;
    this.closedHandlers = [];
    this.openHandlerInstalled = false;
    instances.push(this);
  }
  FakeBrowserWindow.prototype.isDestroyed = function () { return this.destroyed; };
  FakeBrowserWindow.prototype.isMinimized = function () { return this.minimized; };
  FakeBrowserWindow.prototype.restore = function () { this.minimized = false; this.restoreCount++; };
  FakeBrowserWindow.prototype.focus = function () { this.focusCount++; };
  FakeBrowserWindow.prototype.loadURL = function (url) { this.loadedUrls.push(url); };
  FakeBrowserWindow.prototype.on = function (ev, fn) { if (ev === 'closed') this.closedHandlers.push(fn); };
  FakeBrowserWindow.prototype.destroy = function () {
    this.destroyed = true;
    this.closedHandlers.forEach((fn) => fn());
  };
  FakeBrowserWindow.instances = instances;
  return FakeBrowserWindow;
}

function makeManager() {
  const FakeBrowserWindow = makeFakeBrowserWindowClass();
  const installedOn = [];
  const manager = createCallWindowManager({
    BrowserWindow: FakeBrowserWindow,
    windowOptions: { width: 1100, height: 760 },
    installWindowOpenHandler: (win) => { win.openHandlerInstalled = true; installedOn.push(win); },
  });
  return { manager, FakeBrowserWindow, installedOn };
}

test('open() with no existing window creates one, installs the open handler, loads the URL, and focuses it', () => {
  const { manager, FakeBrowserWindow } = makeManager();
  const win = manager.open('https://hivelogic-live.vercel.app/hiveconnect/call.html?m=abc&desktop=1');
  assert.equal(FakeBrowserWindow.instances.length, 1);
  assert.equal(win, FakeBrowserWindow.instances[0]);
  assert.deepEqual(win.loadedUrls, ['https://hivelogic-live.vercel.app/hiveconnect/call.html?m=abc&desktop=1']);
  assert.equal(win.openHandlerInstalled, true);
  assert.equal(win.focusCount, 1);
});

test('a second open() while the window is still alive reuses it -- loads the new URL and focuses, no second window', () => {
  const { manager, FakeBrowserWindow } = makeManager();
  manager.open('https://hivelogic-live.vercel.app/hiveconnect/call.html?m=abc&desktop=1');
  const win = manager.open('https://hivelogic-live.vercel.app/hiveconnect/call.html?m=def&desktop=1');
  assert.equal(FakeBrowserWindow.instances.length, 1, 'a second link must reuse the window, not stack up a new one');
  assert.deepEqual(win.loadedUrls, [
    'https://hivelogic-live.vercel.app/hiveconnect/call.html?m=abc&desktop=1',
    'https://hivelogic-live.vercel.app/hiveconnect/call.html?m=def&desktop=1',
  ]);
  assert.equal(win.focusCount, 2);
});

test('a minimized window is restored on reuse', () => {
  const { manager } = makeManager();
  const first = manager.open('https://hivelogic-live.vercel.app/hiveconnect/call.html?m=abc&desktop=1');
  first.minimized = true;
  manager.open('https://hivelogic-live.vercel.app/hiveconnect/call.html?m=def&desktop=1');
  assert.equal(first.restoreCount, 1);
  assert.equal(first.minimized, false);
});

test('after the window is closed, the next open() builds a fresh one', () => {
  const { manager, FakeBrowserWindow } = makeManager();
  const first = manager.open('https://hivelogic-live.vercel.app/hiveconnect/call.html?m=abc&desktop=1');
  first.destroy();
  assert.equal(manager.current(), null);
  const second = manager.open('https://hivelogic-live.vercel.app/hiveconnect/call.html?m=def&desktop=1');
  assert.equal(FakeBrowserWindow.instances.length, 2);
  assert.notEqual(second, first);
});

test('current() reflects the live window, and null once it is destroyed', () => {
  const { manager } = makeManager();
  assert.equal(manager.current(), null);
  const win = manager.open('https://hivelogic-live.vercel.app/hiveconnect/call.html?m=abc&desktop=1');
  assert.equal(manager.current(), win);
  win.destroy();
  assert.equal(manager.current(), null);
});

test('open() never sets a partition/session override -- it shares whatever windowOptions is given, unchanged', () => {
  const FakeBrowserWindow = makeFakeBrowserWindowClass();
  const manager = createCallWindowManager({
    BrowserWindow: FakeBrowserWindow,
    windowOptions: { width: 1100, height: 760, webPreferences: { contextIsolation: true, nodeIntegration: false } },
  });
  const win = manager.open('https://hivelogic-live.vercel.app/hiveconnect/call.html?m=abc&desktop=1');
  assert.equal(win.options.webPreferences.partition, undefined);
  assert.equal(win.options.webPreferences.session, undefined);
});
