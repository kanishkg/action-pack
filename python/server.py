"""FastAPI server for ActionTab predictions."""

import base64
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from model import ActionPredictor, DEFAULT_MODEL
from schema import PredictionRequest, PredictionResponse

# Global predictor instance
predictor: ActionPredictor | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize model on startup."""
    global predictor
    
    # Use MODEL_PATH env var, or default model, or None for mock mode
    mock_mode = os.environ.get("MOCK_MODE", "").lower() in ("1", "true", "yes")
    if mock_mode:
        model_path = None
    else:
        model_path = os.environ.get("MODEL_PATH", DEFAULT_MODEL)
    
    predictor = ActionPredictor(model_path)
    print(f"ActionTab server started (mock mode: {model_path is None})")
    
    yield
    
    print("ActionTab server shutting down")


app = FastAPI(
    title="ActionTab Prediction Server",
    description="MLX-VLM based action prediction for desktop automation",
    version="0.1.0",
    lifespan=lifespan
)

# Allow requests from Electron app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "mock_mode": predictor.model is None}


@app.post("/predict", response_model=PredictionResponse)
async def predict(req: PredictionRequest) -> PredictionResponse:
    """Predict the next user action based on screenshot and context.
    
    Args:
        req: Request containing base64 screenshot, action history, and cursor position
        
    Returns:
        Predicted action with type, coordinates, text, and confidence
    """
    # Decode screenshot
    try:
        img_bytes = base64.b64decode(req.screenshot)
    except Exception:
        img_bytes = b""  # Empty bytes for mock mode
    
    # Get prediction
    prediction = predictor.predict(
        img_bytes=img_bytes,
        history=req.history,
        cursor_x=req.cursor_x,
        cursor_y=req.cursor_y
    )
    
    return prediction


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8765)

