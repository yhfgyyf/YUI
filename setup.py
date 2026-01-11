"""Setup script for YUI ChatBox with automatic frontend build"""

import os
import subprocess
import sys
import shutil
from pathlib import Path
from setuptools import setup
from setuptools.command.build_py import build_py
from setuptools.command.develop import develop
from setuptools.command.sdist import sdist


class BuildFrontendMixin:
    """Mixin to build frontend during package installation"""

    def check_nodejs(self):
        """Check if Node.js is installed"""
        try:
            result = subprocess.run(
                ["node", "--version"],
                capture_output=True,
                text=True,
                check=True
            )
            version = result.stdout.strip()
            print(f"✓ Found Node.js {version}")
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False

    def build_frontend(self):
        """Build frontend and copy to package"""
        frontend_dir = Path(__file__).parent / "frontend"
        static_dir = Path(__file__).parent / "yuichatbox" / "static"

        # Check if frontend source exists
        if not frontend_dir.exists():
            print("⚠ WARNING: frontend/ directory not found. Skipping frontend build.")
            print("  This is expected when installing from a pre-built wheel.")
            return

        # Check Node.js
        if not self.check_nodejs():
            print("\n" + "=" * 70)
            print("ERROR: Node.js is required to build YUI ChatBox frontend.")
            print("=" * 70)
            print("\nPlease install Node.js from https://nodejs.org/")
            print("Minimum version: 16.x")
            print("\nAlternatively, you can:")
            print("  1. Install from a pre-built wheel:")
            print("     pip install yuichatbox --only-binary yuichatbox")
            print("  2. Pre-build the frontend manually:")
            print("     cd frontend && npm install && npm run build")
            print("=" * 70 + "\n")
            raise RuntimeError("Node.js not found")

        # Install npm dependencies
        print("\n📦 Installing frontend dependencies...")
        try:
            subprocess.run(
                ["npm", "install"],
                cwd=frontend_dir,
                check=True
            )
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to install npm dependencies: {e}")
            raise

        # Build frontend
        print("\n🔨 Building frontend...")
        try:
            subprocess.run(
                ["npm", "run", "build"],
                cwd=frontend_dir,
                check=True
            )
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to build frontend: {e}")
            raise

        # Copy dist to static
        dist_dir = frontend_dir / "dist"
        if dist_dir.exists():
            if static_dir.exists():
                shutil.rmtree(static_dir)
            shutil.copytree(dist_dir, static_dir)
            print(f"✓ Frontend built successfully: {static_dir}")
        else:
            raise RuntimeError(
                "Frontend build failed: dist/ directory not created. "
                "Check for build errors above."
            )


class BuildPyCommand(BuildFrontendMixin, build_py):
    """Custom build command that builds frontend first"""

    def run(self):
        self.build_frontend()
        build_py.run(self)


class DevelopCommand(BuildFrontendMixin, develop):
    """Custom develop command for editable installs"""

    def run(self):
        self.build_frontend()
        develop.run(self)


class SdistCommand(sdist):
    """Custom sdist to ensure frontend source is included"""

    def run(self):
        # Frontend source is included via MANIFEST.in
        print("📦 Creating source distribution (includes frontend source)...")
        sdist.run(self)


# Use setup.py for custom commands, metadata in pyproject.toml
setup(
    cmdclass={
        'build_py': BuildPyCommand,
        'develop': DevelopCommand,
        'sdist': SdistCommand,
    },
)
