# ChatBox Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │               React Frontend (Port 5173)              │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  │  │
│  │  │  Components │  │ Zustand Store│  │  API Client │  │  │
│  │  │             │  │              │  │             │  │  │
│  │  │ - Sidebar   │  │ - Convos     │  │ - Stream    │  │  │
│  │  │ - ChatPanel │  │ - Messages   │  │ - Fetch     │  │  │
│  │  │ - Settings  │  │ - Settings   │  │ - Abort     │  │  │
│  │  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘  │  │
│  │         │                │                  │         │  │
│  │         └────────────────┴──────────────────┘         │  │
│  │                          │                            │  │
│  │                   localStorage (Persist)              │  │
│  └───────────────────────────┬───────────────────────────┘  │
└────────────────────────────────┼──────────────────────────────┘
                                 │
                         HTTP/SSE (Proxy: /api/*)
                                 │
┌────────────────────────────────┼──────────────────────────────┐
│                                ▼                              │
│              FastAPI Backend (Port 8000)                      │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  ┌───────────┐  ┌───────────┐  ┌────────────────────┐  │ │
│  │  │  Health   │  │   Chat    │  │  Chat Stream (SSE) │  │ │
│  │  │  /health  │  │ /v1/chat  │  │  /v1/chat/stream   │  │ │
│  │  └───────────┘  └───────────┘  └────────────────────┘  │ │
│  │                                                         │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │            CORS Middleware                       │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  └─────────────────────────┬───────────────────────────────┘ │
└────────────────────────────┼─────────────────────────────────┘
                             │
                    HTTP/SSE (OpenAI Protocol)
                             │
┌────────────────────────────┼─────────────────────────────────┐
│                            ▼                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   OpenAI     │  │    vLLM      │  │     SGLang       │   │
│  │ API Endpoint │  │   Inference  │  │    Inference     │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

## Data Flow

### Message Sending Flow

```
1. User types message → ChatInput component
2. ChatInput calls onSend(message)
3. App.tsx handleSendMessage():
   - addMessage(user message) → Zustand store
   - Create empty assistant message
   - Call chatAPI.streamChatCompletion()
4. API client:
   - POST /api/v1/chat/stream
   - Open SSE connection
5. Backend:
   - Validate request
   - Forward to OpenAI/vLLM/SGLang
   - Stream response back as SSE
6. Frontend:
   - Receive delta events
   - updateMessage() with accumulated content
   - UI re-renders with new content
7. On completion:
   - setIsGenerating(false)
   - Message finalized in store
   - Auto-save to localStorage
```

### State Management Flow

```
┌──────────────────────────────────────────────────────┐
│                  Zustand Store                        │
│  ┌────────────────────────────────────────────────┐  │
│  │  conversations: Conversation[]                 │  │
│  │  currentConversationId: string | null          │  │
│  │  globalSettings: ModelSettings                 │  │
│  │  uiPreferences: UIPreferences                  │  │
│  │  isGenerating: boolean                         │  │
│  └────────────────────────────────────────────────┘  │
│                                                       │
│  Actions:                                             │
│  - createConversation()                               │
│  - addMessage()                                       │
│  - updateMessage()                                    │
│  - deleteMessage()                                    │
│  - updateGlobalSettings()                             │
│  - exportConversation()                               │
│  - importConversations()                              │
│                                                       │
│  Middleware:                                          │
│  - persist() → localStorage                           │
│    Key: "chatbox-storage"                             │
│    Auto-saves on state changes                        │
└──────────────────────────────────────────────────────┘
```

## Component Hierarchy

```
App
├── Sidebar
│   └── ConversationItem (multiple)
│       ├── Pin button
│       ├── Edit button
│       └── Delete button
│
├── TopBar
│   ├── App title
│   └── Settings button
│
├── ChatPanel
│   ├── Header
│   │   ├── Conversation title
│   │   ├── Regenerate button
│   │   └── Export button
│   │
│   ├── MessageList
│   │   └── Message (multiple)
│   │       ├── Avatar
│   │       ├── Content (Markdown)
│   │       │   ├── Text
│   │       │   ├── Code blocks (with syntax highlighting)
│   │       │   ├── Tables
│   │       │   └── Links
│   │       └── Actions
│   │           ├── Copy
│   │           ├── Edit
│   │           └── Delete
│   │
│   └── ChatInput
│       ├── Textarea (auto-expand)
│       └── Send/Stop button
│
└── SettingsPanel (modal)
    ├── Model Configuration
    │   ├── Model selector
    │   ├── Temperature slider
    │   ├── Top P slider
    │   ├── Max tokens input
    │   ├── System prompt textarea
    │   └── Seed input
    │
    ├── UI Preferences
    │   ├── Theme toggle
    │   ├── Font size selector
    │   └── Message density selector
    │
    └── Data Management
        ├── Export button
        └── Import button
```

## API Design

### Backend API

```python
# Endpoints
GET  /health                 → HealthResponse
POST /v1/chat               → ChatCompletion
POST /v1/chat/stream        → SSE Stream
GET  /v1/models             → ModelList

# Request Flow
1. Receive request
2. Validate payload (Pydantic)
3. Add system message if provided
4. Forward to OpenAI endpoint
5. Stream or return response
6. Handle errors gracefully

# SSE Event Format
data: {"delta": "Hello"}
data: {"delta": " world"}
data: {"done": true, "finish_reason": "stop"}

# Error Format
data: {"error": "Error message"}
```

### Frontend API Client

```typescript
class ChatAPI {
  // Streaming generator
  async *streamChatCompletion(
    messages: Message[],
    settings: ModelSettings
  ): AsyncGenerator<ChatStreamEvent>

  // Abort controller for stopping
  stopGeneration(): void

  // Health check
  healthCheck(): Promise<boolean>

  // List models
  listModels(): Promise<Model[]>
}
```

## Data Models

### Core Types

```typescript
// Message
{
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  createdAt: number;
  attachments?: Attachment[];
  toolCalls?: ToolCall[];
}

// Conversation
{
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  settings?: Partial<ModelSettings>;
  isPinned?: boolean;
  isArchived?: boolean;
}

// Model Settings
{
  model: string;
  temperature: number;
  top_p: number;
  max_tokens?: number;
  system?: string;
  seed?: number;
}
```

## Security Architecture

```
Frontend (Browser)
├── No API keys stored
├── All requests proxied through backend
├── Input sanitization (XSS prevention)
└── Markdown rendering with sanitization

Backend
├── API key in environment variable
├── CORS protection (allowed origins)
├── Request validation (Pydantic)
├── Rate limiting (future)
└── No logging of sensitive data

Communication
├── HTTPS in production
├── SSE for streaming (one-way)
└── Standard HTTP headers
```

## Scalability Considerations

### Current Architecture
- Single backend instance
- Stateless (no session storage)
- Client-side persistence only

### Future Enhancements

1. **Multi-user Support**
   - Add authentication (JWT)
   - Database for conversations (PostgreSQL)
   - User isolation

2. **Load Balancing**
   - Multiple backend instances
   - Nginx reverse proxy
   - Sticky sessions for streaming

3. **Caching**
   - Redis for model metadata
   - CDN for static assets
   - Response caching for common queries

4. **Monitoring**
   - Prometheus metrics
   - Grafana dashboards
   - Error tracking (Sentry)

## Extension Points

### Adding New Features

1. **File Uploads**
   - Add FileUpload component
   - Handle multipart/form-data in backend
   - Store files (S3/local)
   - Inject into message context

2. **Voice I/O**
   - Web Speech API integration
   - TTS for responses
   - Audio player component

3. **RAG (Retrieval)**
   - Vector database (Pinecone/Weaviate)
   - Document chunking
   - Similarity search
   - Context injection

4. **Function Calling**
   - Tool definition schema
   - Tool execution sandbox
   - Result display component
   - Tool call history

## Performance Optimization

### Frontend
- React.memo for expensive components
- Virtual scrolling for long message lists
- Debounced search
- Lazy loading images
- Code splitting (React.lazy)

### Backend
- Async I/O (FastAPI/asyncio)
- Connection pooling
- Response streaming
- Compression (gzip)
- Caching headers

### Network
- HTTP/2
- SSE compression
- CDN for static assets
- WebSocket fallback (future)

## Deployment Architecture

### Development
```
localhost:5173 (Vite) → localhost:8000 (FastAPI) → OpenAI API
```

### Production (Example)
```
nginx:443 (HTTPS)
  ├── /api/* → backend:8000 (Gunicorn + Uvicorn)
  └── /*     → frontend (static files)
```

### Docker Compose
```
frontend:5173 → backend:8000 → OpenAI/vLLM
     ↓
  volumes (dev)
```

### Kubernetes (Future)
```
Ingress
  ├── /api → Backend Service (3 replicas)
  └── /    → Frontend Service (static)
```
