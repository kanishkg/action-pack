/**
 * Action executor - performs mouse clicks and keyboard input using robotjs.
 */

const { clipboard } = require('electron');

let robot;

try {
  robot = require('robotjs');
} catch (err) {
  console.error('Failed to load robotjs:', err.message);
  console.error('Run: npm run rebuild');
  robot = null;
}

// Action history for context
const actionHistory = [];
const MAX_HISTORY = 20;

/**
 * Execute a predicted action.
 * @param {Object} prediction - The prediction to execute
 * @param {string} prediction.action_type - "click" | "text"
 * @param {number} [prediction.x] - X coordinate for clicks
 * @param {number} [prediction.y] - Y coordinate for clicks
 * @param {string} [prediction.text] - Text to type
 * @returns {boolean} Whether execution succeeded
 */
function executePrediction(prediction) {
  if (!robot) {
    console.error('robotjs not available, cannot execute action');
    return false;
  }
  
  try {
    if (prediction.action_type === 'click') {
      executeClick(prediction.x, prediction.y);
    } else if (prediction.action_type === 'text') {
      executeText(prediction.text);
    } else {
      console.log('Unknown action type:', prediction.action_type);
      return false;
    }
    
    // Log to history
    logAction(prediction);
    return true;
    
  } catch (err) {
    console.error('Failed to execute prediction:', err);
    return false;
  }
}

/**
 * Execute a mouse click at the specified coordinates.
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 */
function executeClick(x, y) {
  console.log(`Executing click at (${x}, ${y})`);
  robot.moveMouse(x, y);
  robot.mouseClick("left");
}

/**
 * Type the specified text using clipboard paste (more reliable on macOS).
 * @param {string} text - Text to type
 */
function executeText(text) {
  console.log(`Typing text: "${text}"`);
  
  // Save current clipboard content
  const previousClipboard = clipboard.readText();
  
  // Copy text to clipboard and paste
  clipboard.writeText(text);
  
  // Small delay to ensure clipboard is ready
  setTimeout(() => {
    // Cmd+V to paste on macOS
    robot.keyTap('v', 'command');
    
    // Restore previous clipboard after a delay
    setTimeout(() => {
      clipboard.writeText(previousClipboard);
    }, 100);
  }, 50);
}

/**
 * Log an action to history.
 * @param {Object} prediction - The executed prediction
 */
function logAction(prediction) {
  const entry = {
    type: prediction.action_type,
    x: prediction.x,
    y: prediction.y,
    text: prediction.text,
    timestamp: Date.now()
  };
  
  actionHistory.push(entry);
  
  // Keep history bounded
  if (actionHistory.length > MAX_HISTORY) {
    actionHistory.shift();
  }
}

/**
 * Get recent action history as strings for model context.
 * @returns {string[]} Recent actions formatted as strings
 */
function getActionHistory() {
  return actionHistory.map(action => {
    if (action.type === 'click') {
      return `click(${action.x}, ${action.y})`;
    } else if (action.type === 'text') {
      return `text("${action.text}")`;
    }
    return `${action.type}()`;
  });
}

module.exports = {
  executePrediction,
  getActionHistory
};

