/**
 * ActionTab - Main Electron process
 * 
 * Tab-complete for your desktop—predicts clicks and text, executes on hotkey.
 */

const { app, BrowserWindow, screen } = require('electron');
const path = require('path');

const { captureScreen, getCursorPosition } = require('./screenCapture');
const { registerHotkeys, unregisterHotkeys } = require('./hotkeyManager');
const { executePrediction, getActionHistory } = require('./actionExecutor');
const { startServer, stopServer, isServerReady, requestPrediction } = require('./modelBridge');

// Configuration
const CONFIDENCE_THRESHOLD = 0.3;
const CAPTURE_INTERVAL_MS = 1000;  // 1 FPS (slower since we pause on predictions)

// State
let overlayWindow = null;
let currentPrediction = null;
let captureLoopRunning = false;
let paused = false;  // Pause while waiting for user to accept/reject

/**
 * Create the transparent overlay window.
 */
function createOverlay() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;
  
  overlayWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  
  // Make window click-through
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  
  // Show on all workspaces (macOS)
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  
  // Load the overlay HTML
  overlayWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  
  // Prevent window from being closed by user
  overlayWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      overlayWindow.hide();
    }
  });
  
  console.log('Overlay window created');
}

/**
 * Send prediction to overlay.
 */
function sendPredictionToOverlay(prediction) {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('prediction', prediction);
  }
}

/**
 * Clear prediction display.
 */
function clearPredictionDisplay() {
  currentPrediction = null;
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('clear-prediction');
  }
}

/**
 * Resume the capture loop after user decision.
 */
function resumeCaptureLoop() {
  if (paused) {
    paused = false;
    console.log('Resuming capture loop');
    // Small delay before next capture to let action complete
    setTimeout(captureLoop, 500);
  }
}

/**
 * Handle accept hotkey - execute current prediction.
 */
function handleAccept() {
  if (currentPrediction) {
    console.log('Executing prediction:', currentPrediction);
    executePrediction(currentPrediction);
    clearPredictionDisplay();
    resumeCaptureLoop();
  } else {
    console.log('No prediction to execute');
  }
}

/**
 * Handle dismiss hotkey - clear current prediction.
 */
function handleDismiss() {
  console.log('Dismissing prediction');
  clearPredictionDisplay();
  resumeCaptureLoop();
}

/**
 * Main capture loop - takes screenshots and gets predictions.
 * Pauses after showing a prediction until user accepts or rejects.
 */
async function captureLoop() {
  if (!captureLoopRunning || paused) return;
  
  try {
    if (!isServerReady()) {
      console.log('Waiting for server...');
      setTimeout(captureLoop, CAPTURE_INTERVAL_MS);
      return;
    }
    
    // Capture screen
    const { screenshot } = await captureScreen();
    const cursorPos = getCursorPosition();
    const history = getActionHistory();
    
    // Get prediction from server
    const prediction = await requestPrediction(
      screenshot,
      history,
      cursorPos.x,
      cursorPos.y
    );
    
    // Filter by confidence threshold
    if (prediction.confidence >= CONFIDENCE_THRESHOLD && prediction.action_type !== 'none') {
      currentPrediction = prediction;
      sendPredictionToOverlay(prediction);
      
      // Pause and wait for user to accept or reject
      paused = true;
      console.log('Prediction shown, waiting for user input...');
      return;  // Don't schedule next capture
    } else {
      // Below threshold or no action - continue capturing
      clearPredictionDisplay();
    }
    
  } catch (err) {
    console.error('Capture loop error:', err.message);
  }
  
  // Schedule next capture (only if not paused)
  if (captureLoopRunning && !paused) {
    setTimeout(captureLoop, CAPTURE_INTERVAL_MS);
  }
}

/**
 * Start the capture loop.
 */
function startCaptureLoop() {
  if (captureLoopRunning) return;
  captureLoopRunning = true;
  console.log('Starting capture loop');
  captureLoop();
}

/**
 * Stop the capture loop.
 */
function stopCaptureLoop() {
  captureLoopRunning = false;
  console.log('Stopping capture loop');
}

/**
 * Initialize the application.
 */
async function initialize() {
  console.log('ActionTab starting...');
  
  // Create overlay window
  createOverlay();
  
  // Register hotkeys
  registerHotkeys({
    onAccept: handleAccept,
    onDismiss: handleDismiss
  });
  
  // Start Python server
  try {
    await startServer();
    console.log('Python server started');
  } catch (err) {
    console.error('Failed to start Python server:', err.message);
    console.log('Continuing anyway - server may start later');
  }
  
  // Start capture loop after a brief delay
  setTimeout(startCaptureLoop, 2000);
  
  console.log('ActionTab ready!');
  console.log('  - Ctrl+Space: Accept prediction');
  console.log('  - Escape: Dismiss prediction');
}

// App lifecycle
app.whenReady().then(initialize);

app.on('will-quit', () => {
  unregisterHotkeys();
  stopCaptureLoop();
  stopServer();
});

app.on('window-all-closed', () => {
  // Keep app running even if windows are closed
  // App quits via Cmd+Q or programmatically
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

// macOS: Re-create window when dock icon is clicked
app.on('activate', () => {
  if (overlayWindow === null || overlayWindow.isDestroyed()) {
    createOverlay();
  } else {
    overlayWindow.show();
  }
});

