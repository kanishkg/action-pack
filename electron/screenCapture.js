/**
 * Screen capture module - captures screenshots using desktopCapturer.
 */

const { desktopCapturer, screen } = require('electron');

/**
 * Capture the primary screen as a base64 PNG.
 * @returns {Promise<{screenshot: string, width: number, height: number}>}
 */
async function captureScreen() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;
  
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width, height }
  });
  
  if (sources.length === 0) {
    throw new Error('No screen sources available');
  }
  
  const screenshot = sources[0].thumbnail.toPNG().toString('base64');
  
  return {
    screenshot,
    width,
    height
  };
}

/**
 * Get the current cursor position.
 * @returns {{x: number, y: number}}
 */
function getCursorPosition() {
  return screen.getCursorScreenPoint();
}

module.exports = {
  captureScreen,
  getCursorPosition
};

