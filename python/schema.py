"""Pydantic schemas for ActionTab prediction I/O."""

from pydantic import BaseModel


class PredictionRequest(BaseModel):
    """Request payload for action prediction."""
    screenshot: str  # base64 encoded PNG
    history: list[str]  # recent actions for context
    cursor_x: int
    cursor_y: int


class PredictionResponse(BaseModel):
    """Response payload with predicted action."""
    action_type: str  # "click" | "text" | "scroll" | "none"
    x: int | None = None
    y: int | None = None
    text: str | None = None
    confidence: float

