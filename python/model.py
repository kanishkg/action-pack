"""MLX-VLM model wrapper for action prediction.

Uses Qwen2.5-VL to predict the next user action from screenshots.
"""

import io
import json
import random
import re
import tempfile
import os
from PIL import Image

from schema import PredictionResponse

# Default model - quantized for memory efficiency
DEFAULT_MODEL = "mlx-community/Qwen2.5-VL-7B-Instruct-8bit"

# Sample text predictions for mock mode
MOCK_TEXT_PREDICTIONS = [
    "Hello, world!",
    "Thank you for your message.",
    "Sounds good!",
    "npm install",
    "git commit -m 'update'",
]

# Prompt template for action prediction
PROMPT_TEMPLATE = """You are an AI assistant that predicts the user's next action on their desktop.

Looking at this screenshot, the cursor is at position ({cursor_x}, {cursor_y}).

Recent actions: {history}

Predict the SINGLE most likely next action:
- If the cursor is in/near a text field, search bar, terminal, or code editor: predict TEXT to type
- If the cursor is over a button, link, or clickable UI element: predict a CLICK

Respond with ONLY a JSON object:
- For text: {{"action_type": "text", "text": "<text to type>", "confidence": <0.0-1.0>}}
- For click: {{"action_type": "click", "x": <number>, "y": <number>, "confidence": <0.0-1.0>}}

JSON response:"""


class ActionPredictor:
    """Predicts user actions from screenshots using MLX-VLM."""
    
    def __init__(self, model_path: str | None = None):
        """Initialize predictor.
        
        Args:
            model_path: Path to MLX-VLM model. If None, uses mock predictions.
        """
        self.model_path = model_path
        self.model = None
        self.processor = None
        
        if model_path:
            self._load_model()
    
    def _load_model(self):
        """Load the MLX-VLM model."""
        try:
            from mlx_vlm import load
            
            print(f"Loading MLX-VLM model: {self.model_path}")
            self.model, self.processor = load(self.model_path)
            print("Model loaded successfully")
        except Exception as e:
            print(f"Failed to load model: {e}")
            print("Falling back to mock predictions")
            self.model = None
            self.processor = None
    
    def predict(
        self,
        img_bytes: bytes,
        history: list[str],
        cursor_x: int,
        cursor_y: int
    ) -> PredictionResponse:
        """Predict the next user action.
        
        Args:
            img_bytes: Screenshot as PNG bytes
            history: Recent action history for context
            cursor_x: Current cursor X position
            cursor_y: Current cursor Y position
            
        Returns:
            PredictionResponse with predicted action
        """
        if self.model is None:
            return self._mock_predict(cursor_x, cursor_y)
        
        return self._real_predict(img_bytes, history, cursor_x, cursor_y)
    
    def _mock_predict(self, cursor_x: int, cursor_y: int) -> PredictionResponse:
        """Generate mock predictions for testing."""
        action_type = random.choice(["click", "text", "click", "click"])
        
        if action_type == "click":
            offset_x = random.randint(-150, 150)
            offset_y = random.randint(-150, 150)
            
            return PredictionResponse(
                action_type="click",
                x=max(0, cursor_x + offset_x),
                y=max(0, cursor_y + offset_y),
                text=None,
                confidence=random.uniform(0.3, 0.95)
            )
        else:
            return PredictionResponse(
                action_type="text",
                x=cursor_x,
                y=cursor_y,
                text=random.choice(MOCK_TEXT_PREDICTIONS),
                confidence=random.uniform(0.4, 0.9)
            )
    
    def _real_predict(
        self,
        img_bytes: bytes,
        history: list[str],
        cursor_x: int,
        cursor_y: int
    ) -> PredictionResponse:
        """Predict using the real MLX-VLM model."""
        from mlx_vlm import generate
        
        temp_path = None
        try:
            # Save image to temp file (mlx-vlm expects file path)
            image = Image.open(io.BytesIO(img_bytes))
            temp_fd, temp_path = tempfile.mkstemp(suffix=".png")
            os.close(temp_fd)
            image.save(temp_path, "PNG")
            
            # Build prompt with context
            history_str = ", ".join(history[-5:]) if history else "none"
            prompt = PROMPT_TEMPLATE.format(
                cursor_x=cursor_x,
                cursor_y=cursor_y,
                history=history_str
            )
            
            # Generate prediction - mlx_vlm.generate handles chat template internally
            result = generate(
                self.model,
                self.processor,
                prompt,
                image=temp_path,
                max_tokens=150,
                temp=0.1,  # Low temperature for more deterministic output
                verbose=False,
            )
            
            # Extract text from GenerationResult
            if hasattr(result, 'text'):
                output = result.text
            elif hasattr(result, 'generated_text'):
                output = result.generated_text
            elif isinstance(result, str):
                output = result
            else:
                # Try converting to string as fallback
                output = str(result)
            
            print(f"Model output: {output}")
            
            # Parse JSON from response
            parsed = self._parse_response(output, cursor_x, cursor_y)
            return parsed
            
        except Exception as e:
            print(f"Prediction error: {e}")
            import traceback
            traceback.print_exc()
            # Return low-confidence fallback
            return PredictionResponse(
                action_type="none",
                x=cursor_x,
                y=cursor_y,
                text=None,
                confidence=0.0
            )
        finally:
            # Clean up temp file
            if temp_path and os.path.exists(temp_path):
                os.unlink(temp_path)
    
    def _parse_response(
        self,
        response: str,
        cursor_x: int,
        cursor_y: int
    ) -> PredictionResponse:
        """Parse model response into PredictionResponse."""
        try:
            # Try to extract JSON from response
            # Model might include extra text, so find the JSON object
            json_match = re.search(r'\{[^{}]*\}', response)
            if not json_match:
                raise ValueError("No JSON object found in response")
            
            parsed = json.loads(json_match.group())
            
            action_type = parsed.get("action_type", "none")
            confidence = float(parsed.get("confidence", 0.5))
            
            if action_type == "click":
                return PredictionResponse(
                    action_type="click",
                    x=int(parsed.get("x", cursor_x)),
                    y=int(parsed.get("y", cursor_y)),
                    text=None,
                    confidence=confidence
                )
            elif action_type == "text":
                return PredictionResponse(
                    action_type="text",
                    x=cursor_x,
                    y=cursor_y,
                    text=str(parsed.get("text", "")),
                    confidence=confidence
                )
            else:
                return PredictionResponse(
                    action_type="none",
                    x=cursor_x,
                    y=cursor_y,
                    text=None,
                    confidence=0.0
                )
                
        except (json.JSONDecodeError, ValueError) as e:
            print(f"Failed to parse response: {e}")
            print(f"Raw response: {response}")
            return PredictionResponse(
                action_type="none",
                x=cursor_x,
                y=cursor_y,
                text=None,
                confidence=0.0
            )
