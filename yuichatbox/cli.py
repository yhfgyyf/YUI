"""CLI commands for YUI ChatBox"""

import click
import os
import sys
import subprocess
import signal
from pathlib import Path
from typing import List
import uvicorn


@click.group()
@click.version_option()
def cli():
    """YUI ChatBox - AI Chat Application with Multi-Model Support"""
    pass


@cli.command()
@click.option('--dev', is_flag=True, help='Run in development mode with hot reload')
@click.option('--host', default='0.0.0.0', help='Host to bind to')
@click.option('--port', type=int, default=8001, help='Port to bind to')
@click.option('--reload', is_flag=True, help='Enable auto-reload (backend only, production mode)')
def serve(dev: bool, host: str, port: int, reload: bool):
    """Start the YUI ChatBox server"""

    if dev:
        _serve_dev(host, port)
    else:
        _serve_prod(host, port, reload)


def _serve_prod(host: str, port: int, reload: bool):
    """Production mode: Single FastAPI server serving static files"""
    click.echo("=" * 70)
    click.echo("YUI ChatBox - Production Mode")
    click.echo("=" * 70)
    click.echo(f"Server URL: http://{host}:{port}")
    click.echo("Press Ctrl+C to stop")
    click.echo("=" * 70 + "\n")

    # Set production mode env var
    os.environ['YUI_MODE'] = 'production'

    # Check if static files exist
    from yuichatbox.server import get_static_dir
    static_dir = get_static_dir()
    if not static_dir:
        click.echo("⚠ WARNING: Frontend static files not found!", err=True)
        click.echo("", err=True)
        click.echo("The frontend has not been built yet. You have two options:", err=True)
        click.echo("", err=True)
        click.echo("Option 1: Run in development mode (recommended for development):", err=True)
        click.echo("  yui serve --dev", err=True)
        click.echo("", err=True)
        click.echo("Option 2: Build the frontend manually:", err=True)
        click.echo("  cd frontend && npm install && npm run build", err=True)
        click.echo("  Then run: yui serve", err=True)
        click.echo("", err=True)
        sys.exit(1)

    try:
        uvicorn.run(
            "yuichatbox.server:app",
            host=host,
            port=port,
            reload=reload,
            log_level="info"
        )
    except KeyboardInterrupt:
        click.echo("\n\nServer stopped.")


def _serve_dev(host: str, port: int):
    """Development mode: Backend + Frontend dev server"""
    click.echo("=" * 70)
    click.echo("YUI ChatBox - Development Mode")
    click.echo("=" * 70)

    # Find package directory
    package_dir = Path(__file__).parent.parent
    frontend_dir = package_dir / "frontend"

    if not frontend_dir.exists():
        click.echo(f"❌ ERROR: frontend/ directory not found at {frontend_dir}", err=True)
        click.echo("", err=True)
        click.echo("Development mode requires the source repository.", err=True)
        click.echo("Please install from source with:", err=True)
        click.echo("  git clone <repository>", err=True)
        click.echo("  cd yui-chatbox", err=True)
        click.echo("  pip install -e .", err=True)
        click.echo("", err=True)
        sys.exit(1)

    # Set development mode env var
    os.environ['YUI_MODE'] = 'development'

    # Check if node_modules exists
    if not (frontend_dir / "node_modules").exists():
        click.echo("📦 Installing frontend dependencies...")
        try:
            subprocess.run(["npm", "install"], cwd=frontend_dir, check=True)
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            click.echo(f"❌ ERROR: Failed to install npm dependencies: {e}", err=True)
            click.echo("", err=True)
            click.echo("Please ensure Node.js is installed:", err=True)
            click.echo("  https://nodejs.org/", err=True)
            click.echo("", err=True)
            sys.exit(1)

    processes: List[subprocess.Popen] = []

    def cleanup(signum=None, frame=None):
        """Gracefully shutdown both processes"""
        click.echo("\n\nShutting down...")
        for proc in processes:
            try:
                proc.terminate()
            except:
                pass
        for proc in processes:
            try:
                proc.wait(timeout=5)
            except:
                try:
                    proc.kill()
                except:
                    pass
        click.echo("Stopped.")
        sys.exit(0)

    # Register signal handlers
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    try:
        # Start backend
        click.echo(f"🚀 Starting backend server on http://{host}:{port}...")
        backend_proc = subprocess.Popen(
            [
                sys.executable, "-m", "uvicorn",
                "yuichatbox.server:app",
                "--host", host,
                "--port", str(port),
                "--reload"
            ],
            cwd=package_dir
        )
        processes.append(backend_proc)

        # Start frontend dev server
        click.echo("🎨 Starting frontend dev server on http://localhost:5173...")
        frontend_proc = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=frontend_dir
        )
        processes.append(frontend_proc)

        click.echo("\n" + "=" * 70)
        click.echo("YUI ChatBox is running!")
        click.echo("=" * 70)
        click.echo(f"Frontend: http://localhost:5173  (open this in your browser)")
        click.echo(f"Backend:  http://{host}:{port}")
        click.echo("=" * 70)
        click.echo("Press Ctrl+C to stop both servers")
        click.echo("=" * 70 + "\n")

        # Wait for processes
        for proc in processes:
            proc.wait()

    except KeyboardInterrupt:
        cleanup()
    except Exception as e:
        click.echo(f"\n❌ ERROR: {e}", err=True)
        cleanup()


@cli.command('init-config')
@click.option('--output', '-o', default='.env', help='Output file path')
@click.option('--force', '-f', is_flag=True, help='Overwrite existing file without asking')
def init_config(output: str, force: bool):
    """Initialize configuration file (.env)"""
    config_template = """# YUI ChatBox Configuration
# Backend API Configuration (fallback/default source)
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=http://127.0.0.1:8000/v1

# Server Configuration
HOST=0.0.0.0
PORT=8001

# CORS Configuration (comma-separated origins)
CORS_ORIGINS=http://localhost:5173,http://localhost:8001

# Application Mode (production or development)
# This is usually set automatically by the serve command
# YUI_MODE=production
"""

    output_path = Path(output)
    if output_path.exists() and not force:
        if not click.confirm(f"{output} already exists. Overwrite?"):
            click.echo("Aborted.")
            return

    output_path.write_text(config_template)
    click.echo(f"✓ Configuration file created: {output}")
    click.echo("")
    click.echo("Next steps:")
    click.echo("1. Edit the .env file with your API credentials:")
    click.echo(f"   nano {output}")
    click.echo("2. Start the server:")
    click.echo("   yui serve")
    click.echo("")


@cli.command()
def version():
    """Show version information"""
    from yuichatbox import __version__
    click.echo(f"YUI ChatBox v{__version__}")


if __name__ == '__main__':
    cli()
