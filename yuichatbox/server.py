"""
ChatBox Backend Proxy Service
Proxies requests to OpenAI-compatible APIs with streaming support
"""
import os
import json
import asyncio
from typing import AsyncGenerator, Optional, List, Dict, Any
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import httpx

# Load environment variables
load_dotenv()

# Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
YUI_MODE = os.getenv("YUI_MODE", "production")

if not OPENAI_API_KEY:
    print("WARNING: OPENAI_API_KEY not set in environment variables")


def get_static_dir() -> Optional[Path]:
    """
    Get static directory path for frontend files.
    Returns None if not found (dev mode without build).
    """
    # Priority 1: Package static directory (production)
    pkg_static = Path(__file__).parent / "static"
    if pkg_static.exists() and (pkg_static / "index.html").exists():
        return pkg_static

    # Priority 2: Development build in frontend/dist
    dev_static = Path(__file__).parent.parent / "frontend" / "dist"
    if dev_static.exists() and (dev_static / "index.html").exists():
        return dev_static

    # Not found
    return None


# Pydantic Models
class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    model: str = "gpt-5.2"
    messages: List[Message]
    temperature: Optional[float] = Field(default=0.7, ge=0, le=2)
    top_p: Optional[float] = Field(default=1.0, ge=0, le=1)
    max_tokens: Optional[int] = Field(default=None, ge=1)
    stream: Optional[bool] = True
    system: Optional[str] = None
    seed: Optional[int] = None


class HealthResponse(BaseModel):
    ok: bool
    version: str = "1.0.0"
    base_url: str
    mode: str


# HTTP Client
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    from yuichatbox.database import init_db
    init_db()  # Initialize database
    app.state.http_client = httpx.AsyncClient(timeout=120.0)
    yield
    # Shutdown
    await app.state.http_client.aclose()


# FastAPI App
app = FastAPI(
    title="ChatBox Proxy API",
    description="Proxy service for OpenAI-compatible chat APIs",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware
# In production mode with static files, allow same-origin requests
cors_origins = CORS_ORIGINS.copy()
if YUI_MODE == "production":
    cors_origins.append("*")  # Allow all origins in production for flexibility

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include database API routes
from yuichatbox.api_routes import router as db_router
app.include_router(db_router)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        ok=True,
        base_url=OPENAI_BASE_URL,
        mode=YUI_MODE
    )


@app.post("/v1/chat")
async def chat_completion(request: ChatRequest):
    """Non-streaming chat completion"""
    try:
        # Prepare messages
        messages = [msg.model_dump() for msg in request.messages]

        # Add system message if provided
        if request.system:
            messages.insert(0, {"role": "system", "content": request.system})

        # Prepare request payload
        payload = {
            "model": request.model,
            "messages": messages,
            "temperature": request.temperature,
            "top_p": request.top_p,
            "stream": False,
        }

        if request.max_tokens:
            payload["max_tokens"] = request.max_tokens
        if request.seed:
            payload["seed"] = request.seed

        # Make request to OpenAI
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        }

        response = await app.state.http_client.post(
            f"{OPENAI_BASE_URL}/chat/completions",
            json=payload,
            headers=headers,
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=response.text
            )

        return response.json()

    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"HTTP error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")


async def stream_chat_response(request: ChatRequest) -> AsyncGenerator[str, None]:
    """Stream chat completion from OpenAI"""
    try:
        # Prepare messages
        messages = [msg.model_dump() for msg in request.messages]

        # Add system message if provided
        if request.system:
            messages.insert(0, {"role": "system", "content": request.system})

        # Prepare request payload
        payload = {
            "model": request.model,
            "messages": messages,
            "temperature": request.temperature,
            "top_p": request.top_p,
            "stream": True,
        }

        if request.max_tokens:
            payload["max_tokens"] = request.max_tokens
        if request.seed:
            payload["seed"] = request.seed

        # Headers
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        }

        # Stream request
        async with app.state.http_client.stream(
            "POST",
            f"{OPENAI_BASE_URL}/chat/completions",
            json=payload,
            headers=headers,
        ) as response:
            if response.status_code != 200:
                error_text = await response.aread()
                yield f"data: {json.dumps({'error': error_text.decode()})}\n\n"
                return

            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data = line[6:]  # Remove "data: " prefix

                    if data == "[DONE]":
                        yield f"data: {json.dumps({'done': True})}\n\n"
                        break

                    try:
                        chunk = json.loads(data)
                        delta = chunk.get("choices", [{}])[0].get("delta", {})
                        content = delta.get("content", "")

                        if content:
                            yield f"data: {json.dumps({'delta': content})}\n\n"

                        # Check if finished
                        finish_reason = chunk.get("choices", [{}])[0].get("finish_reason")
                        if finish_reason:
                            yield f"data: {json.dumps({'done': True, 'finish_reason': finish_reason})}\n\n"

                    except json.JSONDecodeError:
                        continue

    except httpx.HTTPError as e:
        yield f"data: {json.dumps({'error': f'HTTP error: {str(e)}'})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': f'Server error: {str(e)}'})}\n\n"


@app.post("/v1/chat/stream")
async def chat_stream(request: ChatRequest):
    """Streaming chat completion with SSE"""
    return StreamingResponse(
        stream_chat_response(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


@app.get("/v1/models")
async def list_models():
    """List available models (proxied from OpenAI)"""
    try:
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
        }

        response = await app.state.http_client.get(
            f"{OPENAI_BASE_URL}/models",
            headers=headers,
        )

        if response.status_code != 200:
            # Return empty list if API call fails
            return {"data": []}

        return response.json()

    except Exception as e:
        # Return empty list on error
        return {"data": []}


@app.get("/v1/default-source")
async def get_default_source():
    """Get default model source configuration from .env"""
    # Only return if both API key and base URL are configured
    if OPENAI_API_KEY and OPENAI_BASE_URL and OPENAI_API_KEY != "your_api_key_here":
        return {
            "configured": True,
            "name": "Default Source",
            "baseUrl": OPENAI_BASE_URL,
            "apiKey": OPENAI_API_KEY,
        }
    else:
        return {
            "configured": False,
        }


# Production mode: Serve static files and handle SPA routing
if YUI_MODE == "production":
    static_dir = get_static_dir()

    if static_dir:
        print(f"[YUI] Production mode: serving static files from {static_dir}")

        # Mount static assets
        assets_dir = static_dir / "assets"
        if assets_dir.exists():
            app.mount(
                "/assets",
                StaticFiles(directory=assets_dir),
                name="static"
            )

        # SPA fallback - serve index.html for all non-API routes
        @app.get("/{full_path:path}")
        async def serve_spa(full_path: str):
            """Serve SPA for all routes except API"""
            # Skip API routes (handled by FastAPI automatically)
            if full_path.startswith(("api/", "v1/", "health")):
                raise HTTPException(status_code=404, detail="Not found")

            # Check if it's a static file request
            file_path = static_dir / full_path
            if file_path.is_file():
                return FileResponse(file_path)

            # Otherwise serve index.html for client-side routing
            index_path = static_dir / "index.html"
            if index_path.exists():
                return FileResponse(index_path)
            else:
                raise HTTPException(
                    status_code=500,
                    detail="Frontend not built. Please build frontend first or run in dev mode."
                )
    else:
        print("[YUI] WARNING: Static files not found in production mode.")
        print("[YUI] Run 'yui serve --dev' for development mode with separate frontend server.")
else:
    print(f"[YUI] Development mode: static file serving disabled")
    print(f"[YUI] Frontend should be served by Vite dev server on port 5173")


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8001"))

    uvicorn.run(
        "server:app",
        host=host,
        port=port,
        reload=True,
        log_level="info"
    )
