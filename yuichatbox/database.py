"""
Database models and utilities for YUI ChatBox
SQLite database with SQLAlchemy ORM
"""
import json
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Integer, Boolean, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship, Session
from pathlib import Path
import os

# Database file location
DB_DIR = Path.home() / ".yui"
DB_DIR.mkdir(exist_ok=True)
DB_PATH = DB_DIR / "chatbox.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"

# SQLAlchemy setup
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# Database Models
class Folder(Base):
    __tablename__ = "folders"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    color = Column(String, nullable=True)
    is_pinned = Column(Boolean, default=False, nullable=False)
    created_at = Column(Integer, nullable=False)
    updated_at = Column(Integer, nullable=False)

    # Relationship
    conversations = relationship("Conversation", back_populates="folder")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    created_at = Column(Integer, nullable=False)
    updated_at = Column(Integer, nullable=False)
    settings_json = Column(Text, nullable=True)  # Partial<ModelSettings>
    is_pinned = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    folder_id = Column(String, ForeignKey("folders.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")
    folder = relationship("Folder", back_populates="conversations")


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, index=True)
    conversation_id = Column(String, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False)  # system, user, assistant, tool
    content = Column(Text, nullable=False)
    reasoning_content = Column(Text, nullable=True)
    created_at = Column(Integer, nullable=False)
    attachments_json = Column(Text, nullable=True)  # JSON array
    tool_calls_json = Column(Text, nullable=True)  # JSON array

    # Relationship
    conversation = relationship("Conversation", back_populates="messages")


class ModelSource(Base):
    __tablename__ = "model_sources"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    base_url = Column(String, nullable=False)
    api_key = Column(String, nullable=False)
    models_json = Column(Text, nullable=False)  # JSON array of DetectedModel[]
    created_at = Column(Integer, nullable=False)
    updated_at = Column(Integer, nullable=False)


class AppSettings(Base):
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, default=1)  # Always 1 (singleton)
    current_conversation_id = Column(String, nullable=True)
    global_settings_json = Column(Text, nullable=False)  # ModelSettings
    ui_preferences_json = Column(Text, nullable=False)  # UIPreferences
    updated_at = Column(Integer, nullable=False)


# Database migration
def migrate_database():
    """Execute database migrations"""
    import sqlite3

    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    try:
        # Check if folder_id column exists in conversations table
        cursor.execute("PRAGMA table_info(conversations)")
        columns = [col[1] for col in cursor.fetchall()]
        folder_id_exists = 'folder_id' in columns

        if not folder_id_exists:
            print("Running database migration: adding folder support...")

            # Read and execute migration SQL (creates folders table and default folder)
            migration_file = Path(__file__).parent / "migrations" / "add_folders.sql"
            with open(migration_file, 'r', encoding='utf-8') as f:
                migration_sql = f.read()

            cursor.executescript(migration_sql)

            # Add folder_id column to conversations
            cursor.execute("ALTER TABLE conversations ADD COLUMN folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL")

            # Migrate existing conversations to default folder
            cursor.execute("UPDATE conversations SET folder_id = 'default-uncategorized' WHERE folder_id IS NULL")

            # Create index for better query performance
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_conversations_folder_id ON conversations(folder_id)")

            conn.commit()
            print("Migration completed successfully!")
        
        # Check if is_pinned column exists in folders table
        cursor.execute("PRAGMA table_info(folders)")
        folder_columns = [col[1] for col in cursor.fetchall()]
        is_pinned_exists = 'is_pinned' in folder_columns
        
        if not is_pinned_exists:
            print("Running database migration: adding folder pinning support...")
            cursor.execute("ALTER TABLE folders ADD COLUMN is_pinned BOOLEAN DEFAULT 0 NOT NULL")
            conn.commit()
            print("Folder pinning migration completed!")

    except Exception as e:
        print(f"Migration error: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


# Database initialization
def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)

    # Execute migrations
    migrate_database()

    # Create default settings if not exists
    db = SessionLocal()
    try:
        settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
        if not settings:
            default_settings = AppSettings(
                id=1,
                current_conversation_id=None,
                global_settings_json=json.dumps({
                    "model": "",
                    "temperature": 0.7,
                    "top_p": 1.0,
                    "max_tokens": None,
                    "system": None,
                }),
                ui_preferences_json=json.dumps({
                    "theme": "light",
                    "fontSize": "medium",
                    "messageDensity": "comfortable",
                    "sidebarWidth": 280,
                }),
                updated_at=int(datetime.now().timestamp() * 1000)
            )
            db.add(default_settings)
            db.commit()
    finally:
        db.close()


# Dependency for FastAPI
def get_db():
    """Get database session for FastAPI dependency injection"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Helper functions for JSON serialization
def serialize_folder(folder: Folder) -> Dict[str, Any]:
    """Convert Folder model to dict"""
    return {
        "id": folder.id,
        "name": folder.name,
        "color": folder.color,
        "isPinned": folder.is_pinned or False,
        "createdAt": folder.created_at,
        "updatedAt": folder.updated_at,
    }


def serialize_conversation(conv: Conversation, include_messages: bool = True) -> Dict[str, Any]:
    """Convert Conversation model to dict"""
    result = {
        "id": conv.id,
        "title": conv.title,
        "createdAt": conv.created_at,
        "updatedAt": conv.updated_at,
        "isPinned": conv.is_pinned or False,
        "isArchived": conv.is_archived or False,
        "folderId": conv.folder_id,
        "messages": [],  # Always include messages field (empty array if not loading)
    }

    if conv.settings_json:
        result["settings"] = json.loads(conv.settings_json)

    if include_messages:
        result["messages"] = [serialize_message(msg) for msg in conv.messages]

    return result


def serialize_message(msg: Message) -> Dict[str, Any]:
    """Convert Message model to dict"""
    result = {
        "id": msg.id,
        "role": msg.role,
        "content": msg.content,
        "createdAt": msg.created_at,
    }

    if msg.reasoning_content:
        result["reasoning_content"] = msg.reasoning_content

    if msg.attachments_json:
        result["attachments"] = json.loads(msg.attachments_json)

    if msg.tool_calls_json:
        result["toolCalls"] = json.loads(msg.tool_calls_json)

    return result


def serialize_model_source(source: ModelSource) -> Dict[str, Any]:
    """Convert ModelSource model to dict"""
    return {
        "id": source.id,
        "name": source.name,
        "baseUrl": source.base_url,
        "apiKey": source.api_key,
        "models": json.loads(source.models_json),
        "createdAt": source.created_at,
        "updatedAt": source.updated_at,
    }


def serialize_app_settings(settings: AppSettings) -> Dict[str, Any]:
    """Convert AppSettings model to dict"""
    return {
        "currentConversationId": settings.current_conversation_id,
        "globalSettings": json.loads(settings.global_settings_json),
        "uiPreferences": json.loads(settings.ui_preferences_json),
    }
