'use strict';

/**
 * The window a hivelogic:// meeting link opens into.
 *
 * One singleton window, reused across repeated links the same way a real
 * desktop app would: a second link while a call window is already open
 * focuses and renavigates that same window instead of stacking up new ones.
 *
 * Electron is injected (BrowserWindow, windowOptions, installWindowOpenHandler)
 * rather than required directly, so the open/reuse/focus logic -- the part
 * worth getting right -- is unit-testable with a fake BrowserWindow, the same
 * pattern screen-annotate.js uses for its own window lifecycle.
 *
 * Deliberately NOT given its own `partition`/session: leaving webPreferences
 * without one means Electron hands it the app's default session, same as
 * mainWindow -- the one place this whole feature lives or dies on. A
 * separate session here would open the call signed OUT, exactly the bug this
 * feature exists to avoid.
 */
function createCallWindowManager({ BrowserWindow, windowOptions, installWindowOpenHandler }) {
  let callWindow = null;

  function isLive(win) {
    try {
      return !!win && !win.isDestroyed();
    } catch (_) {
      return false;
    }
  }

  function focus(win) {
    try {
      if (win.isMinimized()) win.restore();
    } catch (_) {}
    try {
      win.focus();
    } catch (_) {}
  }

  function open(url) {
    if (isLive(callWindow)) {
      callWindow.loadURL(url);
      focus(callWindow);
      return callWindow;
    }
    callWindow = new BrowserWindow(windowOptions);
    if (installWindowOpenHandler) installWindowOpenHandler(callWindow);
    callWindow.loadURL(url);
    callWindow.on('closed', () => {
      callWindow = null;
    });
    focus(callWindow);
    return callWindow;
  }

  function current() {
    return isLive(callWindow) ? callWindow : null;
  }

  return { open, current };
}

module.exports = { createCallWindowManager };
