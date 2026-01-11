# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YUI ChatBox is a full-stack AI chat application with advanced features like multi-model source management, reasoning process visualization, and streaming responses. It consists of:

- **Backend**: FastAPI-based proxy service (single-file `backend/main.py`) that forwards requests to OpenAI-compatible APIs
- **Frontend**: React 18 + TypeScript + Vite application with Zustand state management

**Key Differentiators:**
- Multi-source model management (OpenAI, DeepSeek, local vLLM, etc.)
- Automatic reasoning model detection and visualization
- Flexible extra parameters system (supports any custom parameter with type validation)

## Development Commands

### Backend Setup & Run
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env      # Configure API key and base URL
python main.py            # Starts on http://localhost:8001
```

### Frontend Setup & Run
```bash
cd frontend
npm install
npm run dev              # Starts on http://localhost:5173
```

### Build for Production
```bash
# Frontend
cd frontend
npm run build           # Output in frontend/dist/

# Backend (use uvicorn)
cd backend
uvicorn main:app --host 0.0.0.0 --port 8001 --workers 4
```

### Testing
```bash
# Test backend SSE endpoint directly
curl -N -X POST http://localhost:8001/v1/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-5.2",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }'

# Health check
curl http://localhost:8001/health
```

## Architecture

### State Management (Zustand)
The entire app state lives in `src/store/index.ts` with localStorage persistence:

**Key State Slices:**
- `conversations[]` - All chat sessions with messages
- `modelSources[]` - Configured model providers (each with base URL, API key, detected models)
- `globalSettings` - Default model parameters
- `uiPreferences` - Theme, font size, etc.

**Critical Methods:**
- `createConversation()` - Creates new chat, returns ID
- `addMessage()` - Adds message to conversation, returns Message object
- `updateMessage()` - Updates message content (used for streaming deltas)
- `getEffectiveSettings()` - Merges global + conversation-specific settings
- `addModelSource()` - Adds new model provider
- `updateModelSource()` - Updates detected models after API call

### Multi-Source Model Management

**Architecture Flow:**
1. User configures model sources in `ModelSourcesPanel.tsx`
2. Each source has: name, baseUrl, apiKey, and list of detected models
3. "Detect" button calls `/v1/models` endpoint for that source
4. Models are tagged with type (llm/embedding/reranker/multimodal) and `isReasoning` flag
5. Settings panel shows models from all sources combined

**Key Files:**
- `types/index.ts` - `ModelSource`, `DetectedModel` interfaces
- `components/ModelSourcesPanel.tsx` - UI for managing sources
- `store/index.ts` - Model source CRUD methods
- `services/api.ts` - API calls with per-source base URL

**When Adding Features:**
- Model selection UI must iterate `modelSources[]` and flatten all `.models[]`
- Each model dropdown should show source name (e.g., "gpt-4 (OpenAI)")
- Store `sourceId` with conversations to remember which provider to use

### Reasoning Model Support

**Three Detection Methods:**
1. API returns `reasoning_content` field in streaming response
2. Model is marked `isReasoning: true` in model source configuration
3. Response contains `<think>...</think>` tags (auto-detected)

**Streaming Flow with Reasoning:**
1. SSE event has `reasoning_delta` → append to `message.reasoning_content`
2. SSE event has `delta` → append to `message.content`
3. `Message.tsx` detects `reasoning_content` or `<think>` tags
4. Reasoning content rendered in collapsible amber-colored section
5. Final answer rendered normally below

**Key Implementation:**
- `services/api.ts:streamChatCompletion()` - Parses SSE events, extracts `reasoning_delta`
- `Message.tsx` - Splits content on `<think>` tags, renders reasoning section
- Backend `main.py:/v1/chat/stream` - Forwards `reasoning_content` from upstream API

### Streaming Architecture

**SSE Flow:**
1. User sends message → `ChatInput.tsx` calls `chatAPI.streamChatCompletion()`
2. Empty assistant message created as placeholder via `addMessage()`
3. Backend proxies request to model source's base URL
4. Backend streams SSE events: `data: {"delta": "text", "reasoning_delta": "..."}`
5. Frontend async generator yields deltas → `ChatPanel.tsx` calls `updateMessage()`
6. Message accumulates character-by-character until `done: true`

**AbortController Usage:**
- Each stream has an AbortController stored in component state
- Stop button calls `controller.abort()` → cancels fetch
- Component cleanup (`useEffect` return) aborts active streams

### Extra Parameters System

**Architecture:**
```typescript
interface ExtraParam {
  name: string;      // e.g., "top_k", "extra_body"
  value: string;     // Stored as string, converted at send time
  type: 'text' | 'json' | 'bool' | 'number';
  enabled: boolean;  // User can toggle without deleting
}
```

**Special Handling:**
- `extra_body` parameter type=json → parsed and **expanded** into request root
  - Example: `{"extra_body": {"chat_template_kwargs": {"enable_thinking": false}}}`
  - Becomes: `{"chat_template_kwargs": {"enable_thinking": false}}` in final request
- Other params → sent as-is with type conversion (bool/number parsed from string)

**Implementation:**
- `services/api.ts:buildRequestBody()` - Converts ExtraParam[] to request object
- Backend forwards all unknown fields to OpenAI API (transparent proxy)

## Configuration

### Backend Environment Variables (`.env`)
```bash
OPENAI_API_KEY=your_key_here
OPENAI_BASE_URL=http://127.0.0.1:8000/v1  # Default source (fallback)
HOST=0.0.0.0
PORT=8001
CORS_ORIGINS=http://localhost:5173
```

**Note:** Backend `.env` is now mostly for fallback. Primary model sources are configured in frontend.

### Frontend Proxy (Vite)
`vite.config.ts` proxies `/api/*` to backend:
```typescript
proxy: {
  '/api': {
    target: 'http://localhost:8001',  // Note: backend runs on 8001
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
}
```

## Common Development Tasks

### Add New Model Parameter
1. Update `ModelSettings` type in `types/index.ts`
2. Add UI control in `SettingsPanel.tsx`
3. Update `buildRequestBody()` in `services/api.ts` to include parameter
4. Backend auto-forwards unknown fields to OpenAI API

### Add New Message Action (e.g., Edit, Regenerate)
1. Add handler method in `useChatStore` (e.g., `editMessage`)
2. Pass handler down: `ChatPanel → MessageList → Message`
3. Add UI button in `Message.tsx` component
4. Update `Message` interface in `types/index.ts` if storing new state

### Add New Model Source Provider
1. User clicks "Add Source" in `ModelSourcesPanel`
2. Fills: name, baseUrl, apiKey
3. Clicks "Detect" → calls `handleTest()` → fetches `/v1/models` from that base URL
4. Detected models stored in `source.models[]`
5. User tags models with type and `isReasoning` checkbox

### Support New Reasoning Format
1. Update `Message.tsx` to detect new format (e.g., `<reasoning>` tag)
2. Update `streamChatCompletion()` if upstream API uses different field name
3. Consider adding to README.md troubleshooting section

## Common Issues

### Reasoning Process Not Showing
- Check browser console for: `"Model xxx is reasoning model: true"`
- Verify model has `isReasoning: true` in model source configuration
- Check if API returns `reasoning_content` field (inspect Network tab)
- Confirm `<think>...</think>` tags are present in response

### Extra Parameters Not Applied
- Ensure parameter's `enabled` checkbox is checked
- For JSON type, validate JSON syntax (use JSON validator)
- Check browser console request body logs
- `extra_body` must be type=json to auto-expand

### CORS Errors
- Ensure `CORS_ORIGINS` in backend `.env` includes frontend URL
- Restart backend after changing `.env`
- Check browser console for specific origin mismatch

### State Not Persisting
- localStorage key: `chatbox-storage`
- Zustand persist middleware auto-saves on state changes
- Clear to reset: `localStorage.removeItem('chatbox-storage')`

### Model Source Connection Failed
- Verify base URL is reachable: `curl <baseUrl>/models`
- Check API key is correct (if required)
- Ensure URL ends with `/v1` for OpenAI-compatible endpoints
- Check backend logs for error details

## API Endpoints

### Backend
```
GET  /health                    # Health check
POST /v1/chat                   # Non-streaming chat
POST /v1/chat/stream            # Streaming chat (SSE)
GET  /v1/models                 # List models from default source
```

### Model Source Detection
Frontend directly calls: `GET <sourceBaseUrl>/models` with Authorization header

## File Structure

**Critical Files:**
```
backend/
  main.py                    # Single-file FastAPI app

frontend/src/
  components/
    ModelSourcesPanel.tsx    # Multi-source management UI ⭐
    Message.tsx              # Reasoning content rendering ⭐
    ChatPanel.tsx            # Streaming orchestration
    SettingsPanel.tsx        # Extra parameters UI
  store/
    index.ts                 # Zustand store with persistence ⭐
  services/
    api.ts                   # SSE streaming, extra params handling ⭐
  types/
    index.ts                 # Core interfaces (ModelSource, ExtraParam) ⭐
```

## Security Considerations

- API keys stored in browser localStorage (encrypted at rest by browser)
- Backend proxies all requests (API keys never exposed to external APIs from frontend)
- CORS restricted to trusted origins in production
- Input sanitized before rendering (ReactMarkdown handles XSS prevention)

## Extension Points

### Multi-Provider Routing
Currently each model source has its own base URL. To add provider-specific logic:
- Add `provider: 'openai' | 'deepseek' | 'vllm'` to `ModelSource`
- Update `api.ts` to handle provider-specific request formats
- Add provider icons in `ModelSourcesPanel.tsx`

### RAG Integration
- Add file upload to `ChatInput.tsx`
- Process files in backend (extract text from PDF/Doc)
- Inject as system message or use `extra_body` to pass context

### Function/Tool Calling
- Add `tools: ToolDefinition[]` to `ModelSettings`
- Render `message.toolCalls[]` in `Message.tsx`
- Handle tool execution in backend or frontend callback
