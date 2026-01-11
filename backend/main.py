"""
ChatBox Backend Proxy Service
Proxies requests to OpenAI-compatible APIs with streaming support
"""
import os
import json
import asyncio
from typing import AsyncGenerator, Optional, List, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import httpx

# Load environment variables
load_dotenv()

# Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

if not OPENAI_API_KEY:
    print("WARNING: OPENAI_API_KEY not set in environment variables")


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


# HTTP Client
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        ok=True,
        base_url=OPENAI_BASE_URL
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
            # Return default models if API call fails
            return {
                "data": [
                    {"id": "gpt-5.2-pro", "object": "model"},
                    {"id": "gpt-5.2", "object": "model"},
                ]
            }

        return response.json()

    except Exception as e:
        # Return default models on error
        return {
            "data": [
                {"id": "gpt-5.2-pro", "object": "model"},
                {"id": "gpt-5.2", "object": "model"},
            ]
        }


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))

    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=True,
        log_level="info"
    )
