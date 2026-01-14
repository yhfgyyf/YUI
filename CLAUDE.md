# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YUI ChatBox is a full-stack AI chat application with advanced features like multi-model source management, reasoning process visualization, and streaming responses. It consists of:

- **Backend**: FastAPI-based proxy service (`yuichatbox/server.py`) that forwards requests to OpenAI-compatible APIs
- **Frontend**: React 18 + TypeScript + Vite application with Zustand state management

**Key Differentiators:**
- Multi-source model management (OpenAI, DeepSeek, local vLLM, etc.)
- Automatic reasoning model detection and visualization
- Flexible extra parameters system (supports any custom parameter with type validation)
- File upload and context-aware dialogue (PDF, Word, text, images)

## Development Commands

### Backend Setup & Run (pip install method - recommended)
```bash
# Install the package (includes all dependencies)
pip install -e .          # Editable install from project root

# Initialize configuration
python -m yuichatbox init-config

# Edit .env file to configure API keys and endpoints
nano .env

# Start production server
python -m yuichatbox serve

# Start development server (with hot reload)
python -m yuichatbox serve --dev
```

### Alternative: Manual Backend Run
```bash
# If running backend directly (not recommended for production)
cd yuichatbox
python server.py          # Starts on http://localhost:8001
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

# Backend (recommended: use CLI)
python -m yuichatbox serve

# Alternative: Direct uvicorn (if not using pip install)
uvicorn yuichatbox.server:app --host 0.0.0.0 --port 8001 --workers 4
```

### Testing
```bash
# Health check
curl http://localhost:8001/health

# Test backend SSE endpoint directly
curl -N -X POST http://localhost:8001/v1/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-5.2",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }'

# Test file upload
curl -X POST http://localhost:8001/v1/files/upload \
  -F "conversation_id=test-conv-123" \
  -F "file=@/path/to/test.pdf"

# Test chat with file context
curl -N -X POST http://localhost:8001/v1/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-5.2",
    "messages": [{"role": "user", "content": "Summarize the document"}],
    "attachments": [{
      "id": "file123",
      "name": "test.pdf",
      "type": "application/pdf",
      "size": 12345,
      "text_content": "Sample document content..."
    }],
    "stream": true
  }'
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

### File Upload and Context-Aware Dialogue (v1.0.2)

**Architecture Overview:**
The file upload feature allows users to upload files (text, PDF, Word, images) and have the AI answer questions based on file contents. The backend automatically extracts text from files and builds structured context using XML templates.

**Supported File Formats:**
- **Text files**: `.txt` - Direct content reading
- **PDF documents**: `.pdf` - Extracted using PyPDF2 with page markers
- **Word documents**: `.docx` - Extracted using python-docx with paragraph structure
- **Images**: `.jpg`, `.jpeg`, `.png` - EXIF metadata and basic info (no OCR)

**Upload Flow:**
```
User selects file → Frontend uploads to /v1/files/upload → Backend saves to uploads/{conversation_id}/
→ Backend parses file content → Returns Attachment object with text_content
→ User sends message → Frontend passes attachments array to API
→ Backend builds XML file context → Merges with system prompt → Sends to model
```

**File Context Template:**
Backend automatically builds structured context using XML tags:
```xml
You have been provided with the following file(s) for context:

<file name="document.pdf" type="application/pdf">
[Note: Content truncated to 50000 characters]

[Extracted text content...]
</file>

<file name="data.txt" type="text/plain">
[Extracted text content...]
</file>

Please answer the user's question based on these files. Include relevant quotes or references from the files in your response.
```

**Key Implementation Details:**

1. **File Parsing Module** (`yuichatbox/file_parsers.py`):
   ```python
   class FileParseResult:
       success: bool
       text: str
       metadata: Optional[Dict[str, Any]]
       error: Optional[str]
       truncated: bool  # True if content > 50,000 chars

   def parse_file(file_path: str) -> FileParseResult
   ```

2. **Backend File Handling** (`yuichatbox/server.py`):
   - `POST /v1/files/upload` - Accepts multipart/form-data, returns Attachment
   - `DELETE /v1/files/{conversation_id}/{file_id}` - Delete single file
   - `DELETE /v1/files/conversation/{conversation_id}` - Delete all files for conversation
   - `build_file_context(attachments)` - Constructs XML-formatted context string

3. **Frontend Components**:
   - `ChatInput.tsx` - File upload button (Paperclip icon), multi-file selection
   - `Message.tsx` - Display attachments with warning icons (⚠️ parse error, ✂️ truncated)
   - `App.tsx` - Passes attachments array to API (backend builds context)
   - `services/api.ts` - Upload/delete file functions, passes attachments to streamChatCompletion

4. **Data Types** (`types/index.ts`):
   ```typescript
   interface Attachment {
     id: string;
     name: string;
     type: string;
     size: number;
     url?: string;
     text_content?: string;      // Extracted text from file
     metadata?: Record<string, any>;  // File-specific metadata
     parse_error?: string;       // Error message if parsing failed
     truncated?: boolean;        // True if content was truncated
   }
   ```

**Limitations and Safety:**
- **File size limit**: 10MB per file (configurable via `MAX_FILE_SIZE` env var)
- **Content truncation**: Text extraction limited to 50,000 characters per file
- **No OCR**: Images only provide EXIF metadata, not text recognition
- **MIME type validation**: Uses `python-magic` to verify real file type (prevent extension spoofing)
- **Unique IDs**: Uses `nanoid` for collision-resistant file IDs

**File Storage:**
```
uploads/
  {conversation_id}/
    {file_id}_{original_filename}.{ext}
```

Files are automatically cleaned up when conversations are deleted via `store/index.ts:deleteConversation()`.

**Environment Variables:**
```bash
UPLOAD_DIR=./uploads           # File storage directory
MAX_FILE_SIZE=10485760         # 10MB in bytes
```

**Critical Architecture Decision:**
Backend is responsible for building file context (not frontend). Frontend only uploads files and passes the attachments array to the API. This ensures:
- Consistent XML formatting across all requests
- Frontend remains simple and focused on UI
- File context logic is centralized and testable
- Easy to modify prompt template without frontend changes

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

### Add Support for New File Format
1. Add new parsing function to `yuichatbox/file_parsers.py`:
   ```python
   def parse_new_format(file_path: str) -> FileParseResult:
       # Extract text from new format
       # Return FileParseResult with text, metadata, etc.
   ```
2. Update `parse_file()` router to detect new MIME type
3. Add file extension to accepted types in `ChatInput.tsx`:
   ```typescript
   accept=".txt,.pdf,.docx,.doc,.jpg,.jpeg,.png,.new"
   ```
4. Test with sample files to ensure proper extraction
5. Update README.md supported formats list

### Debug File Upload Issues
1. Check browser Network tab for upload request/response
2. Verify file appears in `uploads/{conversation_id}/` directory
3. Check backend logs for parsing errors
4. Inspect `Attachment.parse_error` field in frontend
5. Test with smaller files to rule out size limits
6. Verify MIME type detection: `file --mime-type <file>`

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

### File Upload Not Working
- Check file size (must be < 10MB by default)
- Verify accepted file formats: `.txt`, `.pdf`, `.docx`, `.jpg`, `.jpeg`, `.png`
- Check browser console for upload errors
- Verify backend `uploads/` directory exists and is writable
- Check backend logs for parsing errors
- Ensure conversation exists before uploading files
- Test with simple text file first to rule out format-specific issues

### File Content Not Appearing in Responses
- Verify file has `text_content` field (check browser DevTools)
- Check for `parse_error` field in attachment (⚠️ icon in UI)
- Ensure backend `build_file_context()` is being called (check logs)
- Verify attachments array is passed to API in request body
- Check if content was truncated (✂️ icon in UI) - model may have context limits
- Inspect Network tab to see if file context is in request payload

## API Endpoints

### Backend
```
GET  /health                              # Health check
POST /v1/chat                             # Non-streaming chat
POST /v1/chat/stream                      # Streaming chat (SSE)
GET  /v1/models                           # List models from default source

# File Upload Endpoints (v1.0.2)
POST /v1/files/upload                     # Upload file, parse content
DELETE /v1/files/{conversation_id}/{file_id}      # Delete single file
DELETE /v1/files/conversation/{conversation_id}   # Delete all files for conversation
```

### Model Source Detection
Frontend directly calls: `GET <sourceBaseUrl>/models` with Authorization header

## File Structure

**Critical Files:**
```
yuichatbox/
  server.py                  # FastAPI backend server ⭐
  file_parsers.py            # File parsing module (PDF, Word, text, images) ⭐

frontend/src/
  components/
    ModelSourcesPanel.tsx    # Multi-source management UI ⭐
    Message.tsx              # Reasoning content rendering, file attachments ⭐
    ChatPanel.tsx            # Streaming orchestration
    ChatInput.tsx            # User input, file upload UI ⭐
    SettingsPanel.tsx        # Extra parameters UI
  store/
    index.ts                 # Zustand store with persistence ⭐
  services/
    api.ts                   # SSE streaming, file upload, extra params ⭐
  types/
    index.ts                 # Core interfaces (ModelSource, Attachment, etc.) ⭐
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

### RAG Integration (Already Implemented in v1.0.2)
File upload functionality is already implemented with support for text, PDF, Word, and images:
- File upload UI in `ChatInput.tsx` (Paperclip button)
- Backend parsing in `yuichatbox/file_parsers.py`
- XML-formatted context injection via `build_file_context()`
- See "File Upload and Context-Aware Dialogue" section for details

**Future Enhancement Ideas:**
- Add vector database for semantic search across uploaded files
- Implement OCR for images using Tesseract or cloud APIs
- Support additional formats (Excel, CSV, Markdown)
- Add citation tracking to link responses back to specific file sections
- Implement file caching to avoid re-parsing on subsequent questions

### Function/Tool Calling
- Add `tools: ToolDefinition[]` to `ModelSettings`
- Render `message.toolCalls[]` in `Message.tsx`
- Handle tool execution in backend or frontend callback
