# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ChatBox is a full-stack web application similar to OpenWebUI, providing an AI chat interface with multi-session management, streaming responses, and local persistence. It consists of:

- **Backend**: FastAPI-based proxy service that forwards requests to OpenAI-compatible APIs
- **Frontend**: React 18 + TypeScript + Vite application with Zustand state management

## Architecture

### Backend (FastAPI)
- Single-file application in `backend/main.py`
- Proxies chat requests to OpenAI or compatible APIs (vLLM, SGLang, etc.)
- Supports both streaming (SSE) and non-streaming chat completions
- Handles CORS and environment-based configuration

### Frontend (React + TypeScript)
```
src/
├── components/      # UI components
│   ├── Message.tsx        # Individual message display with Markdown
│   ├── ChatInput.tsx      # Message input with streaming support
│   ├── Sidebar.tsx        # Conversation list management
│   ├── ChatPanel.tsx      # Main chat interface
│   └── SettingsPanel.tsx  # Model & UI configuration
├── store/          # Zustand state management
│   └── index.ts          # Global app state + persistence
├── services/       # API layer
│   └── api.ts           # Chat API client with streaming
├── types/          # TypeScript definitions
│   └── index.ts         # Shared types
└── utils/          # Helper functions
    ├── storage.ts       # localStorage utilities
    └── format.ts        # Formatting utilities
```

## Development Commands

### Backend Setup & Run
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env      # Configure your API key
python main.py            # Starts on http://localhost:8000
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

# Backend
# No build needed - run with uvicorn in production
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Key Components

### State Management (Zustand)
The entire app state is managed in `src/store/index.ts`:
- **Conversations**: Array of all chat sessions
- **Messages**: Nested within each conversation
- **Settings**: Global + per-conversation model parameters
- **UI Preferences**: Theme, font size, etc.
- **Persistence**: Auto-saved to localStorage via Zustand middleware

Key store methods:
- `createConversation()` - Creates new chat session
- `addMessage()` - Adds message to conversation
- `updateMessage()` - Updates message content (for streaming)
- `getEffectiveSettings()` - Merges global + conversation settings

### Streaming Chat Flow
1. User sends message → added to conversation
2. Empty assistant message created as placeholder
3. `chatAPI.streamChatCompletion()` called with conversation history
4. SSE events received → `updateMessage()` called with deltas
5. Message accumulates character-by-character until done

### API Service (`services/api.ts`)
- `streamChatCompletion()`: Async generator for SSE streaming
- `chatCompletion()`: Non-streaming completion
- `listModels()`: Fetch available models
- `stopGeneration()`: Abort current stream via AbortController

## Configuration

### Backend Environment Variables (`.env`)
```bash
OPENAI_API_KEY=your_key_here
OPENAI_BASE_URL=https://api.openai.com/v1  # Or vLLM/SGLang endpoint
HOST=0.0.0.0
PORT=8000
CORS_ORIGINS=http://localhost:5173
```

### Frontend Proxy
Vite dev server proxies `/api/*` to backend (see `vite.config.ts`):
```typescript
proxy: {
  '/api': {
    target: 'http://localhost:8000',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
}
```

## Adding New Features

### Add New Model Parameter
1. Update `ModelSettings` type in `types/index.ts`
2. Add UI control in `SettingsPanel.tsx`
3. Include parameter in `ChatCompletionRequest` in `services/api.ts`
4. Backend auto-forwards all parameters to OpenAI API

### Add New Message Action
1. Add handler in `useChatStore` (e.g., `editMessage`)
2. Pass handler down through components
3. Add UI button in `Message.tsx` or `ChatPanel.tsx`

### Custom Markdown Components
Extend `ReactMarkdown` components in `Message.tsx`:
```typescript
components={{
  img({ node, ...props }) {
    return <img {...props} className="max-w-full rounded" />;
  },
}}
```

## Testing Streaming Endpoint

```bash
# Test backend SSE endpoint directly
curl -N -X POST http://localhost:8000/v1/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }'
```

## Common Issues

### CORS Errors
- Ensure `CORS_ORIGINS` in backend `.env` includes frontend URL
- Check browser console for specific origin mismatch

### Streaming Not Working
- Verify backend SSE endpoint returns `text/event-stream` content type
- Check browser Network tab for 200 status + streaming response
- Ensure AbortController properly cancels on component unmount

### State Not Persisting
- Check browser localStorage: `chatbox-storage` key
- Zustand persist middleware auto-saves on state changes
- Clear localStorage to reset: `localStorage.clear()`

### Dark Mode Not Applied
- Theme persisted in `uiPreferences.theme`
- Applied via Tailwind `dark:` classes + `document.documentElement.classList`
- Toggle updates both store + DOM class

## Deployment Notes

### Frontend
- Build output: `frontend/dist/`
- Serve static files with Nginx/Apache
- Update API proxy target to production backend URL

### Backend
- Use production ASGI server: `uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4`
- Set `OPENAI_API_KEY` via environment (never commit to repo)
- For vLLM/SGLang: Point `OPENAI_BASE_URL` to local inference server

### Docker (Optional)
Create `Dockerfile` for backend:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY main.py .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Security Considerations

- **API Keys**: Never expose in frontend code - always proxy through backend
- **Input Validation**: Backend validates message format, frontend sanitizes user input
- **XSS Prevention**: ReactMarkdown + sanitization prevents code injection
- **CORS**: Restrict `CORS_ORIGINS` to trusted domains in production

## Extension Points

### Multi-Provider Support
Extend `ModelSettings` to include `provider` field (OpenAI/Azure/Local):
- Add provider selection in settings
- Route requests in backend based on provider
- Store provider-specific base URLs

### RAG Integration
- Add file upload component in `ChatInput`
- Process files in backend (PDF/Doc parsing)
- Inject context into system prompt or messages

### Tool/Function Calling
- Add `tools` field to `ChatCompletionRequest`
- Display tool calls in `Message.tsx` (check `message.toolCalls`)
- Handle tool execution in backend or frontend

### Voice Input/Output
- Add Web Speech API integration in `ChatInput`
- Stream TTS for assistant responses
- Display audio controls in message bubbles
