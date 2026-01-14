#!/bin/bash
# Create offline installation package for YUI ChatBox
set -e

VERSION="1.0.2"
OUTPUT_DIR="yui-chatbox-offline-${VERSION}"
WHEELS_DIR="${OUTPUT_DIR}/wheels"
STATIC_DIR="${OUTPUT_DIR}/static"

echo "======================================================================"
echo "YUI ChatBox - Offline Package Creator v${VERSION}"
echo "======================================================================"

# Clean previous builds
echo ""
echo "Cleaning previous builds..."
rm -rf "${OUTPUT_DIR}" "${OUTPUT_DIR}.tar.gz" dist build *.egg-info

# Create directories
mkdir -p "${WHEELS_DIR}"
mkdir -p "${STATIC_DIR}"

# Step 1: Build frontend static files
echo ""
echo "Step 1/7: Building frontend static files..."
if [ -d "frontend/dist" ]; then
    echo "Copying pre-built frontend files..."
    cp -r frontend/dist/* "${STATIC_DIR}/"
else
    echo "ERROR: Frontend not built. Please run 'cd frontend && npm run build' first"
    exit 1
fi

# Step 2: Build the package
echo ""
echo "Step 2/7: Building YUI ChatBox package..."
python -m build

# Step 3: Copy built wheel to output
echo ""
echo "Step 3/7: Copying built package..."
cp dist/yuichatbox-${VERSION}-py3-none-any.whl "${OUTPUT_DIR}/"

# Step 4: Download all Python dependencies as wheels
echo ""
echo "Step 4/7: Downloading Python dependencies..."
# Download from the wheel we just built - this will get all transitive dependencies
pip download "${OUTPUT_DIR}/yuichatbox-${VERSION}-py3-none-any.whl" -d "${WHEELS_DIR}"

# Ensure we have all the required packages
pip download \
    fastapi==0.109.0 \
    "uvicorn[standard]==0.27.0" \
    openai==1.10.0 \
    python-dotenv==1.0.0 \
    pydantic==2.5.3 \
    "pydantic-settings>=2.0.0" \
    httpx==0.26.0 \
    "click>=8.0.0" \
    "sqlalchemy>=2.0.0" \
    nanoid \
    PyPDF2==3.0.1 \
    python-docx==1.1.0 \
    Pillow==10.2.0 \
    python-magic==0.4.27 \
    aiofiles==23.2.1 \
    python-multipart==0.0.9 \
    -d "${WHEELS_DIR}"

# Step 5: Create installation script
echo ""
echo "Step 5/7: Creating installation script..."
cat > "${OUTPUT_DIR}/install.sh" << 'EOF'
#!/bin/bash
# Offline installation script for YUI ChatBox

set -e

echo "======================================================================"
echo "YUI ChatBox - Offline Installation"
echo "======================================================================"
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed"
    echo "Please install Python 3.8 or later"
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo "Found Python ${PYTHON_VERSION}"

# Check pip
if ! python3 -m pip --version &> /dev/null; then
    echo "ERROR: pip is not installed"
    echo "Please install pip first"
    exit 1
fi

# Install from local wheels
echo ""
echo "Installing YUI ChatBox and dependencies from local wheels..."
echo "This may take a few minutes..."
python3 -m pip install --no-index --find-links=./wheels yuichatbox-*.whl

# Verify installation
echo ""
echo "Verifying installation..."
if python3 -m yuichatbox --version &> /dev/null; then
    echo "✓ Installation verified successfully"
else
    echo "✗ Installation verification failed"
    exit 1
fi

echo ""
echo "======================================================================"
echo "Installation complete!"
echo "======================================================================"
echo ""
echo "Next steps:"
echo "1. Initialize configuration:"
echo "   python3 -m yuichatbox init-config"
echo ""
echo "2. Edit .env file with your API credentials:"
echo "   nano .env"
echo "   (Set OPENAI_API_KEY and OPENAI_BASE_URL)"
echo ""
echo "3. Start the server:"
echo "   python3 -m yuichatbox serve"
echo ""
echo "4. Open your browser and visit:"
echo "   http://localhost:8001"
echo ""
echo "For more help, run: python3 -m yuichatbox --help"
echo "======================================================================"
EOF

chmod +x "${OUTPUT_DIR}/install.sh"

# Step 6: Create Windows batch file
echo ""
echo "Step 6/7: Creating Windows installation script..."
cat > "${OUTPUT_DIR}/install.bat" << 'EOF'
@echo off
REM Offline installation script for YUI ChatBox (Windows)

echo ======================================================================
echo YUI ChatBox - Offline Installation (Windows)
echo ======================================================================
echo.

REM Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python 3 is not installed
    echo Please install Python 3.8 or later
    pause
    exit /b 1
)

echo Found Python
python --version

REM Check pip
python -m pip --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: pip is not installed
    echo Please install pip first
    pause
    exit /b 1
)

REM Install from local wheels
echo.
echo Installing YUI ChatBox and dependencies from local wheels...
echo This may take a few minutes...
python -m pip install --no-index --find-links=wheels yuichatbox-*.whl

if %errorlevel% neq 0 (
    echo Installation failed
    pause
    exit /b 1
)

echo.
echo ======================================================================
echo Installation complete!
echo ======================================================================
echo.
echo Next steps:
echo 1. Initialize configuration:
echo    python -m yuichatbox init-config
echo.
echo 2. Edit .env file with your API credentials
echo.
echo 3. Start the server:
echo    python -m yuichatbox serve
echo.
echo 4. Open your browser and visit:
echo    http://localhost:8001
echo.
echo For more help, run: python -m yuichatbox --help
echo ======================================================================
pause
EOF

# Step 7: Create README
echo ""
echo "Step 7/7: Creating documentation..."
cat > "${OUTPUT_DIR}/README.txt" << EOF
YUI ChatBox v${VERSION} - Offline Installation Package
======================================================================

This package contains everything needed to install YUI ChatBox
without internet access, including all Python dependencies and
pre-built frontend static files.

Contents:
---------
- yuichatbox-${VERSION}-py3-none-any.whl : Pre-built YUI ChatBox package
- wheels/ : All Python dependencies ($(ls -1 ${WHEELS_DIR} | wc -l) packages)
- static/ : Pre-built frontend static files (HTML/CSS/JS)
- install.sh : Automated installation script (Linux/macOS)
- install.bat : Automated installation script (Windows)
- README.txt : This file

System Requirements:
--------------------
- Python 3.8 or later
- pip (usually comes with Python)
- Linux, macOS, or Windows
- NO internet connection required
- NO Node.js or npm required (frontend pre-built)

Installation Instructions:
--------------------------

Linux/macOS:
  tar -xzf yui-chatbox-offline-${VERSION}.tar.gz
  cd yui-chatbox-offline-${VERSION}
  ./install.sh

Windows:
  1. Extract yui-chatbox-offline-${VERSION}.tar.gz
  2. Open Command Prompt in the extracted folder
  3. Run: install.bat

After Installation:
-------------------
1. Initialize configuration:
   python -m yuichatbox init-config

2. Edit .env file with your API credentials:
   - OPENAI_API_KEY: Your API key
   - OPENAI_BASE_URL: API endpoint URL
   Example:
     OPENAI_BASE_URL=https://api.openai.com/v1
     OPENAI_API_KEY=sk-...

3. Start the server:
   python -m yuichatbox serve

4. Open your browser and visit:
   http://localhost:8001

Features:
---------
- Multi-model support (OpenAI, DeepSeek, Claude, etc.)
- Conversation management with folders
- Message search and filtering
- Dark/Light theme
- Markdown and code highlighting
- Reasoning visualization for thinking models
- Database-backed persistence (SQLite)
- No external services required

Database:
---------
YUI ChatBox uses SQLite for data persistence. The database file
will be created at:
  ~/.yui/chatbox.db

All conversations, settings, and model sources are stored locally.

Troubleshooting:
----------------
- If 'yui' command not found, use:
  python -m yuichatbox --help

- To check installation:
  python -m yuichatbox --version

- For database issues:
  The database will be automatically created and migrated
  on first run

- For more help:
  python -m yuichatbox --help

Support:
--------
For issues, please check:
https://github.com/yourusername/yui-chatbox

Version Info:
-------------
Package Version: ${VERSION}
Build Date: $(date '+%Y-%m-%d %H:%M:%S')
Python Dependencies: $(ls -1 ${WHEELS_DIR} | wc -l) packages
Static Files: $(find ${STATIC_DIR} -type f | wc -l) files
EOF

# Create tarball
echo ""
echo "Creating tarball..."
tar -czf "${OUTPUT_DIR}.tar.gz" "${OUTPUT_DIR}"

# Calculate sizes
PACKAGE_SIZE=$(du -sh "${OUTPUT_DIR}.tar.gz" | cut -f1)
WHEELS_COUNT=$(ls -1 ${WHEELS_DIR} | wc -l)
STATIC_COUNT=$(find ${STATIC_DIR} -type f | wc -l)

# Summary
echo ""
echo "======================================================================"
echo "Offline package created successfully!"
echo "======================================================================"
echo "Package: ${OUTPUT_DIR}.tar.gz"
echo "Size: ${PACKAGE_SIZE}"
echo ""
echo "Package contents:"
echo "  ✓ YUI ChatBox wheel (pre-built)"
echo "  ✓ Python dependencies (${WHEELS_COUNT} packages)"
echo "  ✓ Frontend static files (${STATIC_COUNT} files)"
echo "  ✓ Installation scripts (Linux/macOS/Windows)"
echo "  ✓ Documentation"
echo ""
echo "To test installation:"
echo "  tar -xzf ${OUTPUT_DIR}.tar.gz"
echo "  cd ${OUTPUT_DIR}"
echo "  ./install.sh"
echo "======================================================================"
