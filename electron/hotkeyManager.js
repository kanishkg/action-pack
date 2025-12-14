/**
 * Hotkey manager - registers global shortcuts.
 */

const { globalShortcut } = require('electron');

/**
 * Register all global hotkeys.
 * @param {Object} handlers - Callback handlers for each hotkey
 * @param {Function} handlers.onAccept - Called when user accepts prediction (Option+Space)
 * @param {Function} handlers.onDismiss - Called when user dismisses prediction (Escape)
 */
function registerHotkeys(handlers) {
  // Accept prediction with Option+Space (Alt+Space)
  const acceptRegistered = globalShortcut.register('Alt+Space', () => {
    console.log('Hotkey: Accept prediction (Option+Space)');
    if (handlers.onAccept) {
      handlers.onAccept();
    }
  });
  
  if (!acceptRegistered) {
    console.error('Failed to register Option+Space hotkey');
  }
  
  // Dismiss prediction with Escape
  const dismissRegistered = globalShortcut.register('Escape', () => {
    console.log('Hotkey: Dismiss prediction (Escape)');
    if (handlers.onDismiss) {
      handlers.onDismiss();
    }
  });
  
  if (!dismissRegistered) {
    console.error('Failed to register Escape hotkey');
  }
  
  console.log('Hotkeys registered: Option+Space (accept), Escape (dismiss)');
}

/**
 * Unregister all global hotkeys.
 */
function unregisterHotkeys() {
  globalShortcut.unregisterAll();
  console.log('All hotkeys unregistered');
}

module.exports = {
  registerHotkeys,
  unregisterHotkeys
};

