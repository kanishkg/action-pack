/**
 * ActionTab Overlay - Renderer process
 * 
 * Displays click predictions and text tooltips.
 */

const overlay = document.getElementById('overlay');

// Listen for predictions from main process
window.electronAPI.onPrediction((prediction) => {
  // Clear previous prediction
  overlay.innerHTML = '';
  
  if (!prediction) return;
  
  if (prediction.action_type === 'click') {
    renderClickPrediction(prediction);
  } else if (prediction.action_type === 'text') {
    renderTextPrediction(prediction);
  }
});

// Listen for clear command
window.electronAPI.onClearPrediction(() => {
  overlay.innerHTML = '';
});

/**
 * Render a click prediction with circle and ripple effects.
 */
function renderClickPrediction({ x, y, confidence }) {
  const container = document.createElement('div');
  container.className = 'click-container';
  container.style.left = `${x}px`;
  container.style.top = `${y}px`;
  
  // Main circle
  const circle = document.createElement('div');
  circle.className = 'click-circle';
  circle.style.opacity = Math.max(0.5, confidence);
  
  // Multiple ripples for depth effect
  const ripple1 = document.createElement('div');
  ripple1.className = 'ripple';
  
  const ripple2 = document.createElement('div');
  ripple2.className = 'ripple';
  
  const ripple3 = document.createElement('div');
  ripple3.className = 'ripple';
  
  // Confidence label
  const label = document.createElement('div');
  label.className = 'confidence-label';
  label.textContent = `${Math.round(confidence * 100)}%`;
  
  container.appendChild(ripple1);
  container.appendChild(ripple2);
  container.appendChild(ripple3);
  container.appendChild(circle);
  container.appendChild(label);
  
  overlay.appendChild(container);
}

/**
 * Render a text prediction tooltip.
 */
function renderTextPrediction({ x, y, text, confidence }) {
  const tooltip = document.createElement('div');
  tooltip.className = 'text-tooltip';
  
  // Add confidence class
  if (confidence >= 0.7) {
    tooltip.classList.add('high-confidence');
  } else if (confidence < 0.5) {
    tooltip.classList.add('low-confidence');
  }
  
  // Position offset from cursor
  const offsetX = 20;
  const offsetY = 20;
  
  // Keep tooltip on screen
  const maxX = window.innerWidth - 380;
  const maxY = window.innerHeight - 60;
  
  tooltip.style.left = `${Math.min(x + offsetX, maxX)}px`;
  tooltip.style.top = `${Math.min(y + offsetY, maxY)}px`;
  
  // Text content
  const textContent = document.createElement('span');
  textContent.textContent = text;
  tooltip.appendChild(textContent);
  
  // Confidence bar
  const bar = document.createElement('div');
  bar.className = 'confidence-bar';
  bar.style.width = `${confidence * 100}%`;
  tooltip.appendChild(bar);
  
  overlay.appendChild(tooltip);
}

// Optional: Status indicator for debugging
function showStatus(message, state = 'ok') {
  let indicator = document.getElementById('status-indicator');
  
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'status-indicator';
    indicator.className = 'status-indicator';
    document.body.appendChild(indicator);
  }
  
  indicator.innerHTML = `
    <div class="status-dot ${state}"></div>
    <span>${message}</span>
  `;
  
  indicator.classList.add('visible');
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    indicator.classList.remove('visible');
  }, 3000);
}

// Listen for status updates
window.electronAPI.onStatusUpdate?.((status) => {
  showStatus(status.message, status.state);
});

console.log('ActionTab overlay loaded');

