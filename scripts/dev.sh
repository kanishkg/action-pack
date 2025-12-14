#!/bin/bash

# ActionTab Development Script
# Runs both the Python server and Electron app

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🚀 Starting ActionTab..."

# Sync Python dependencies
echo "📦 Syncing Python dependencies..."
cd "$PROJECT_DIR/python"
uv sync

# Start Electron app (it will spawn the Python server itself)
echo "⚡ Starting Electron app..."
cd "$PROJECT_DIR"
npm start &
ELECTRON_PID=$!

# Trap to cleanup on exit
cleanup() {
  echo ""
  echo "Shutting down..."
  kill $ELECTRON_PID 2>/dev/null || true
  exit 0
}

trap cleanup SIGINT SIGTERM

echo ""
echo "✅ ActionTab is running!"
echo "   Electron app manages the Python server on http://localhost:8765"
echo ""
echo "Press Ctrl+C to stop"

# Wait for either process to exit
wait
