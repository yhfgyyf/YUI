# Quick Start Guide

Get ChatBox running in 5 minutes!

## Automatic Setup (Recommended)

```bash
# Run the setup script
./setup.sh

# Edit backend/.env and add your API key
nano backend/.env

# Start backend (terminal 1)
cd backend
source venv/bin/activate
python main.py

# Start frontend (terminal 2)
cd frontend
npm run dev

# Open browser to http://localhost:5173
```

## Manual Setup

### 1. Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and set OPENAI_API_KEY=your_key_here

# Start server
python main.py
```

### 2. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

### 3. Access Application

Open browser to: http://localhost:5173

## Using with Local Inference Engines

### vLLM

```bash
# Terminal 1: Start vLLM
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Llama-2-7b-chat-hf \
  --port 8000

# Terminal 2: Configure backend
cd backend
# Edit .env:
# OPENAI_BASE_URL=http://localhost:8000/v1
# OPENAI_API_KEY=dummy

python main.py

# Terminal 3: Start frontend
cd frontend
npm run dev
```

### SGLang

```bash
# Terminal 1: Start SGLang
python -m sglang.launch_server \
  --model-path meta-llama/Llama-2-7b-chat-hf \
  --port 8000

# Terminal 2: Configure backend (same as vLLM)
cd backend
# Edit .env:
# OPENAI_BASE_URL=http://localhost:8000/v1
# OPENAI_API_KEY=dummy

python main.py

# Terminal 3: Start frontend
cd frontend
npm run dev
```

## Troubleshooting

### Backend won't start
- Check Python version: `python --version` (need 3.11+)
- Verify .env file exists and has OPENAI_API_KEY set
- Check port 8000 is free: `lsof -i :8000`

### Frontend won't start
- Check Node version: `node --version` (need 18+)
- Delete node_modules and reinstall: `rm -rf node_modules && npm install`
- Check port 5173 is free: `lsof -i :5173`

### Can't connect to backend
- Verify backend is running: `curl http://localhost:8000/health`
- Check CORS settings in backend/.env
- Open browser console for error details

### Streaming not working
- Check backend logs for errors
- Verify API key is valid
- Test direct API call: `curl -N http://localhost:8000/v1/chat/stream ...`

## Next Steps

- Read [README.md](./README.md) for full documentation
- Check [CLAUDE.md](./CLAUDE.md) for development guide
- Customize settings in the app (click settings icon)
- Export/import conversations for backup

Enjoy chatting! 🚀
