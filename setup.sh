#!/bin/bash

# ChatBox Complete Setup Script

echo "======================================"
echo "  ChatBox Setup Script"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "Checking prerequisites..."

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: Python 3 is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Python 3 found${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js found${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm found${NC}"

echo ""
echo "======================================"
echo "  Setting up Backend"
echo "======================================"
echo ""

cd backend

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
    echo -e "${GREEN}✓ Virtual environment created${NC}"
else
    echo -e "${YELLOW}Virtual environment already exists${NC}"
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt
echo -e "${GREEN}✓ Python dependencies installed${NC}"

# Setup .env
if [ ! -f ".env" ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo -e "${YELLOW}⚠ Please edit backend/.env and add your OPENAI_API_KEY${NC}"
else
    echo -e "${YELLOW}.env file already exists${NC}"
fi

cd ..

echo ""
echo "======================================"
echo "  Setting up Frontend"
echo "======================================"
echo ""

cd frontend

# Install dependencies
echo "Installing npm dependencies..."
npm install
echo -e "${GREEN}✓ npm dependencies installed${NC}"

cd ..

echo ""
echo "======================================"
echo "  Setup Complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Configure your API key:"
echo "   ${YELLOW}Edit backend/.env and add your OPENAI_API_KEY${NC}"
echo ""
echo "2. Start the backend:"
echo "   ${GREEN}cd backend && source venv/bin/activate && python main.py${NC}"
echo ""
echo "3. In a new terminal, start the frontend:"
echo "   ${GREEN}cd frontend && npm run dev${NC}"
echo ""
echo "4. Open your browser to:"
echo "   ${GREEN}http://localhost:5173${NC}"
echo ""
echo "For more information, see README.md"
echo ""
