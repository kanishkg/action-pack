/**
 * Model bridge - spawns Python server and handles communication.
 */

const { spawn } = require('child_process');
const path = require('path');

const SERVER_PORT = 8765;
const SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;

let pythonProcess = null;
let serverReady = false;

/**
 * Fetch with timeout (compatible with older Node versions).
 */
async function fetchWithTimeout(url, options = {}, timeout = 2000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Check if server is already running.
 * @returns {Promise<boolean>}
 */
async function isServerAlreadyRunning() {
  try {
    console.log('Checking if Python server is already running...');
    const response = await fetchWithTimeout(`${SERVER_URL}/health`);
    const isRunning = response.ok;
    console.log(`Server check result: ${isRunning ? 'running' : 'not running'}`);
    return isRunning;
  } catch (err) {
    console.log(`Server check failed: ${err.message}`);
    return false;
  }
}

/**
 * Start the Python prediction server.
 * @returns {Promise<void>}
 */
async function startServer() {
  // Check if server is already running (e.g., started by dev.sh)
  if (await isServerAlreadyRunning()) {
    console.log('Python server already running, connecting...');
    serverReady = true;
    return;
  }

  return new Promise((resolve, reject) => {
    const pythonDir = path.join(__dirname, '../python');
    
    console.log('Starting Python server...');
    
    pythonProcess = spawn('uv', ['run', 'python', '-m', 'uvicorn', 'server:app', '--port', String(SERVER_PORT)], {
      cwd: pythonDir,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('[Python]', output.trim());
      
      // Check if server is ready
      if (output.includes('Uvicorn running') || output.includes('Application startup complete')) {
        serverReady = true;
        resolve();
      }
    });
    
    pythonProcess.stderr.on('data', (data) => {
      const output = data.toString();
      console.log('[Python]', output.trim());
      
      // Uvicorn logs to stderr
      if (output.includes('Uvicorn running') || output.includes('Application startup complete')) {
        serverReady = true;
        resolve();
      }
    });
    
    pythonProcess.on('error', (err) => {
      console.error('Failed to start Python server:', err);
      reject(err);
    });
    
    pythonProcess.on('close', (code) => {
      console.log(`Python server exited with code ${code}`);
      serverReady = false;
      pythonProcess = null;
    });
    
    // Timeout after 30 seconds
    setTimeout(() => {
      if (!serverReady) {
        reject(new Error('Python server startup timeout'));
      }
    }, 30000);
  });
}

/**
 * Stop the Python server.
 */
function stopServer() {
  if (pythonProcess) {
    console.log('Stopping Python server...');
    pythonProcess.kill('SIGTERM');
    pythonProcess = null;
    serverReady = false;
  }
}

/**
 * Check if server is ready.
 * @returns {boolean}
 */
function isServerReady() {
  return serverReady;
}

/**
 * Request a prediction from the server.
 * @param {string} screenshot - Base64 encoded screenshot
 * @param {string[]} history - Recent action history
 * @param {number} cursorX - Cursor X position
 * @param {number} cursorY - Cursor Y position
 * @returns {Promise<Object>} Prediction response
 */
async function requestPrediction(screenshot, history, cursorX, cursorY) {
  if (!serverReady) {
    throw new Error('Server not ready');
  }
  
  const response = await fetch(`${SERVER_URL}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      screenshot,
      history,
      cursor_x: cursorX,
      cursor_y: cursorY
    })
  });
  
  if (!response.ok) {
    throw new Error(`Server error: ${response.status}`);
  }
  
  return await response.json();
}

/**
 * Check server health.
 * @returns {Promise<Object>}
 */
async function checkHealth() {
  const response = await fetch(`${SERVER_URL}/health`);
  return await response.json();
}

module.exports = {
  startServer,
  stopServer,
  isServerReady,
  requestPrediction,
  checkHealth
};
