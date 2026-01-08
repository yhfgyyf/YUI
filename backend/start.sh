#!/bin/bash

# ChatBox Backend Startup Script

echo "Starting ChatBox Backend..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "Warning: .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "Please edit .env file and add your OPENAI_API_KEY"
    exit 1
fi

# Start server
echo "Starting server on port 8000..."
python main.py
