#!/usr/bin/env python3
"""Standalone frontend build script for YUI ChatBox"""

import subprocess
import shutil
from pathlib import Path
import sys


def build_frontend():
    """Build frontend and copy to package"""
    root_dir = Path(__file__).parent.parent
    frontend_dir = root_dir / "frontend"
    static_dir = root_dir / "yuichatbox" / "static"

    print("=" * 70)
    print("YUI ChatBox - Frontend Build Script")
    print("=" * 70)

    if not frontend_dir.exists():
        print(f"❌ ERROR: frontend/ directory not found at {frontend_dir}")
        sys.exit(1)

    # Install dependencies
    print("\n📦 Installing npm dependencies...")
    try:
        subprocess.run(["npm", "install"], cwd=frontend_dir, check=True)
    except FileNotFoundError:
        print("❌ ERROR: npm not found. Please install Node.js:")
        print("  https://nodejs.org/")
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        print(f"❌ ERROR: Failed to install dependencies: {e}")
        sys.exit(1)

    # Build
    print("\n🔨 Building frontend...")
    try:
        subprocess.run(["npm", "run", "build"], cwd=frontend_dir, check=True)
    except subprocess.CalledProcessError as e:
        print(f"❌ ERROR: Build failed: {e}")
        sys.exit(1)

    # Copy to static
    dist_dir = frontend_dir / "dist"
    if not dist_dir.exists():
        print("❌ ERROR: Build output not found (frontend/dist/ doesn't exist)")
        sys.exit(1)

    print(f"\n📋 Copying build output to {static_dir}...")
    if static_dir.exists():
        shutil.rmtree(static_dir)
    shutil.copytree(dist_dir, static_dir)

    print("\n" + "=" * 70)
    print("✓ Frontend build complete!")
    print("=" * 70)
    print(f"Output: {static_dir}")
    print("\nYou can now run:")
    print("  yui serve")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    build_frontend()
