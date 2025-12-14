# ActionTab

**Tab-complete for your desktop** — predicts clicks and text, executes on hotkey.

ActionTab uses screen capture and an MLX-VLM model to predict your next action (click or text input), displaying a visual overlay. Press `Ctrl+Space` to execute the prediction.

## Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10+
- **uv** ([install](https://docs.astral.sh/uv/getting-started/installation/))
- **macOS** (for screen capture and MLX support)

### Installation

```bash
# Install Node dependencies
npm install

# Install Python dependencies
cd python
uv sync
```

### Running

**Option 1: Development script (recommended)**

```bash
./scripts/dev.sh
```

**Option 2: Manual startup**

Terminal 1 - Start Python server:
```bash
cd python
uv run python -m uvicorn server:app --port 8765
```

Terminal 2 - Start Electron app:
```bash
npm start
```

## Usage

| Hotkey | Action |
|--------|--------|
| `Ctrl+Space` | Accept and execute current prediction |
| `Escape` | Dismiss current prediction |

### Visual Indicators

- **Click prediction**: Blue pulsing circle with ripple effect at predicted location
- **Text prediction**: Dark tooltip near cursor showing predicted text
- **Confidence bar**: Shows model confidence (green = high, orange = low)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Electron App                             │
├─────────────────────────────────────────────────────────────────┤
│  Main Process                                                    │
│  ├── ScreenCapture       (periodic screenshots)                  │
│  ├── HotkeyManager       (global shortcuts)                      │
│  ├── ActionExecutor      (robotjs clicks/typing)                 │
│  └── ModelBridge         (spawns & talks to Python)              │
├─────────────────────────────────────────────────────────────────┤
│  Renderer Process (Overlay Window)                               │
│  └── Transparent overlay with predictions                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP (localhost:8765)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Python MLX Server                           │
│  ├── FastAPI endpoint                                            │
│  └── MLX-VLM model (mock mode by default)                        │
└─────────────────────────────────────────────────────────────────┘
```

## Configuration

Edit values in `electron/main.js`:

| Setting | Default | Description |
|---------|---------|-------------|
| `CONFIDENCE_THRESHOLD` | 0.3 | Hide predictions below this confidence |
| `CAPTURE_INTERVAL_MS` | 500 | Screenshot frequency (2 FPS) |

## Using a Real Model

1. Install MLX dependencies:
   ```bash
   cd python
   uv sync --extra mlx
   ```

2. Set the model path when starting:
   ```bash
   MODEL_PATH=/path/to/your/model uv run python -m uvicorn server:app --port 8765
   ```

3. Update `python/model.py` to implement `_real_predict()` with your model's specific prompting.

## Permissions (macOS)

ActionTab requires:
- **Screen Recording** - for capturing screenshots
- **Accessibility** - for simulating mouse clicks and keyboard input

Grant these in **System Preferences → Security & Privacy → Privacy**.

## Project Structure

```
actiontab/
├── package.json
├── electron/
│   ├── main.js              # Entry point, orchestrates everything
│   ├── preload.js           # Secure IPC bridge
│   ├── screenCapture.js     # desktopCapturer logic
│   ├── hotkeyManager.js     # globalShortcut registration
│   ├── actionExecutor.js    # robotjs wrapper
│   └── modelBridge.js       # Python server communication
├── renderer/
│   ├── index.html           # Overlay window HTML
│   ├── overlay.js           # Prediction rendering
│   └── styles.css           # Animations
├── python/
│   ├── pyproject.toml       # Python dependencies (uv)
│   ├── server.py            # FastAPI server
│   ├── model.py             # Prediction logic (mock/real)
│   └── schema.py            # Pydantic models
└── scripts/
    └── dev.sh               # Development runner
```

## Troubleshooting

**"Failed to load robotjs"**
```bash
npm run rebuild
```

**Python server not starting**
- Ensure Python 3.10+ is installed
- Check that port 8765 is available
- Run `cd python && uv sync` to install dependencies

**No predictions showing**
- Check Python server is running: `curl http://localhost:8765/health`
- Verify screen recording permission is granted
- Check console for errors: `npm run dev`

## License

MIT
