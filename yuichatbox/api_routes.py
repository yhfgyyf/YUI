"""
API routes for database operations
CRUD endpoints for conversations, messages, model sources, and settings
"""
import json
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from yuichatbox.database import (
    get_db, init_db,
    Folder as DBFolder,
    Conversation as DBConversation,
    Message as DBMessage,
    ModelSource as DBModelSource,
    AppSettings as DBAppSettings,
    serialize_folder,
    serialize_conversation,
    serialize_message,
    serialize_model_source,
    serialize_app_settings,
)

router = APIRouter(prefix="/api/db", tags=["database"])


# Pydantic models for request/response
class MessageCreate(BaseModel):
    id: str
    role: str
    content: str
    reasoning_content: Optional[str] = None
    createdAt: int
    attachments: Optional[List[dict]] = None
    toolCalls: Optional[List[dict]] = None


class ConversationCreate(BaseModel):
    id: str
    title: str
    createdAt: int
    updatedAt: int
    messages: List[MessageCreate] = []
    settings: Optional[dict] = None
    isPinned: bool = False
    isArchived: bool = False


class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    updatedAt: Optional[int] = None
    settings: Optional[dict] = None
    isPinned: Optional[bool] = None
    isArchived: Optional[bool] = None
    folderId: Optional[str] = None


class ModelSourceCreate(BaseModel):
    id: str
    name: str
    baseUrl: str
    apiKey: str
    models: List[dict]
    createdAt: int
    updatedAt: int


class ModelSourceUpdate(BaseModel):
    name: Optional[str] = None
    baseUrl: Optional[str] = None
    apiKey: Optional[str] = None
    models: Optional[List[dict]] = None
    updatedAt: Optional[int] = None


class AppSettingsUpdate(BaseModel):
    currentConversationId: Optional[str] = None
    globalSettings: Optional[dict] = None
    uiPreferences: Optional[dict] = None


class FolderCreate(BaseModel):
    id: str
    name: str
    color: Optional[str] = None
    createdAt: int
    updatedAt: int


class FolderUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    isPinned: Optional[bool] = None
    updatedAt: Optional[int] = None


class DataImport(BaseModel):
    """For importing data from localStorage"""
    conversations: List[dict]
    globalSettings: dict
    uiPreferences: dict
    currentConversationId: Optional[str] = None
    modelSources: List[dict]


# ==================== Conversations ====================

@router.get("/conversations")
def list_conversations(db: Session = Depends(get_db)):
    """Get all conversations (without messages for performance)"""
    conversations = db.query(DBConversation).order_by(DBConversation.updated_at.desc()).all()
    return [serialize_conversation(conv, include_messages=False) for conv in conversations]


@router.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: str, db: Session = Depends(get_db)):
    """Get a single conversation with all messages"""
    conv = db.query(DBConversation).filter(DBConversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return serialize_conversation(conv, include_messages=True)


@router.post("/conversations")
def create_conversation(conversation: ConversationCreate, db: Session = Depends(get_db)):
    """Create a new conversation"""
    # Check if already exists
    existing = db.query(DBConversation).filter(DBConversation.id == conversation.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Conversation already exists")

    # Create conversation
    db_conv = DBConversation(
        id=conversation.id,
        title=conversation.title,
        created_at=conversation.createdAt,
        updated_at=conversation.updatedAt,
        settings_json=json.dumps(conversation.settings) if conversation.settings else None,
        is_pinned=conversation.isPinned,
        is_archived=conversation.isArchived,
    )
    db.add(db_conv)

    # Create messages
    for msg_data in conversation.messages:
        db_msg = DBMessage(
            id=msg_data.id,
            conversation_id=conversation.id,
            role=msg_data.role,
            content=msg_data.content,
            reasoning_content=msg_data.reasoning_content,
            created_at=msg_data.createdAt,
            attachments_json=json.dumps(msg_data.attachments) if msg_data.attachments else None,
            tool_calls_json=json.dumps(msg_data.toolCalls) if msg_data.toolCalls else None,
        )
        db.add(db_msg)

    db.commit()
    db.refresh(db_conv)
    return serialize_conversation(db_conv, include_messages=True)


@router.patch("/conversations/{conversation_id}")
def update_conversation(
    conversation_id: str,
    updates: ConversationUpdate,
    db: Session = Depends(get_db)
):
    """Update conversation metadata"""
    conv = db.query(DBConversation).filter(DBConversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if updates.title is not None:
        conv.title = updates.title
    if updates.updatedAt is not None:
        conv.updated_at = updates.updatedAt
    if updates.settings is not None:
        conv.settings_json = json.dumps(updates.settings)
    if updates.isPinned is not None:
        conv.is_pinned = updates.isPinned
    if updates.isArchived is not None:
        conv.is_archived = updates.isArchived
    if updates.folderId is not None:
        conv.folder_id = updates.folderId

    db.commit()
    db.refresh(conv)
    return serialize_conversation(conv, include_messages=False)


@router.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: str, db: Session = Depends(get_db)):
    """Delete a conversation and all its messages"""
    conv = db.query(DBConversation).filter(DBConversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    db.delete(conv)
    db.commit()
    return {"ok": True, "id": conversation_id}


# ==================== Messages ====================

@router.post("/conversations/{conversation_id}/messages")
def add_message(
    conversation_id: str,
    message: MessageCreate,
    db: Session = Depends(get_db)
):
    """Add a message to a conversation"""
    # Check conversation exists
    conv = db.query(DBConversation).filter(DBConversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Create message
    db_msg = DBMessage(
        id=message.id,
        conversation_id=conversation_id,
        role=message.role,
        content=message.content,
        reasoning_content=message.reasoning_content,
        created_at=message.createdAt,
        attachments_json=json.dumps(message.attachments) if message.attachments else None,
        tool_calls_json=json.dumps(message.toolCalls) if message.toolCalls else None,
    )
    db.add(db_msg)

    # Update conversation timestamp
    conv.updated_at = int(datetime.now().timestamp() * 1000)

    db.commit()
    db.refresh(db_msg)
    return serialize_message(db_msg)


class MessageUpdate(BaseModel):
    content: Optional[str] = None
    reasoning_content: Optional[str] = None


@router.patch("/conversations/{conversation_id}/messages/{message_id}")
def update_message(
    conversation_id: str,
    message_id: str,
    updates: MessageUpdate,
    db: Session = Depends(get_db)
):
    """Update a message"""
    msg = db.query(DBMessage).filter(
        DBMessage.id == message_id,
        DBMessage.conversation_id == conversation_id
    ).first()

    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    if updates.content is not None:
        msg.content = updates.content
    if updates.reasoning_content is not None:
        msg.reasoning_content = updates.reasoning_content

    db.commit()
    db.refresh(msg)
    return serialize_message(msg)


@router.delete("/conversations/{conversation_id}/messages/{message_id}")
def delete_message(
    conversation_id: str,
    message_id: str,
    db: Session = Depends(get_db)
):
    """Delete a message"""
    msg = db.query(DBMessage).filter(
        DBMessage.id == message_id,
        DBMessage.conversation_id == conversation_id
    ).first()

    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    db.delete(msg)
    db.commit()
    return {"ok": True, "id": message_id}


# ==================== Model Sources ====================

@router.get("/model-sources")
def list_model_sources(db: Session = Depends(get_db)):
    """Get all model sources"""
    sources = db.query(DBModelSource).order_by(DBModelSource.created_at.desc()).all()
    return [serialize_model_source(source) for source in sources]


@router.post("/model-sources")
def create_model_source(source: ModelSourceCreate, db: Session = Depends(get_db)):
    """Create a new model source"""
    # Check if already exists
    existing = db.query(DBModelSource).filter(DBModelSource.id == source.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Model source already exists")

    db_source = DBModelSource(
        id=source.id,
        name=source.name,
        base_url=source.baseUrl,
        api_key=source.apiKey,
        models_json=json.dumps(source.models),
        created_at=source.createdAt,
        updated_at=source.updatedAt,
    )
    db.add(db_source)
    db.commit()
    db.refresh(db_source)
    return serialize_model_source(db_source)


@router.patch("/model-sources/{source_id}")
def update_model_source(
    source_id: str,
    updates: ModelSourceUpdate,
    db: Session = Depends(get_db)
):
    """Update a model source"""
    source = db.query(DBModelSource).filter(DBModelSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Model source not found")

    if updates.name is not None:
        source.name = updates.name
    if updates.baseUrl is not None:
        source.base_url = updates.baseUrl
    if updates.apiKey is not None:
        source.api_key = updates.apiKey
    if updates.models is not None:
        source.models_json = json.dumps(updates.models)
    if updates.updatedAt is not None:
        source.updated_at = updates.updatedAt

    db.commit()
    db.refresh(source)
    return serialize_model_source(source)


@router.delete("/model-sources/{source_id}")
def delete_model_source(source_id: str, db: Session = Depends(get_db)):
    """Delete a model source"""
    source = db.query(DBModelSource).filter(DBModelSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Model source not found")

    db.delete(source)
    db.commit()
    return {"ok": True, "id": source_id}


# ==================== App Settings ====================

@router.get("/settings")
def get_app_settings(db: Session = Depends(get_db)):
    """Get application settings"""
    settings = db.query(DBAppSettings).filter(DBAppSettings.id == 1).first()
    if not settings:
        # Return defaults if not found (shouldn't happen after init_db)
        return {
            "currentConversationId": None,
            "globalSettings": {
                "model": "",
                "temperature": 0.7,
                "top_p": 1.0,
                "max_tokens": None,
                "system": None,
            },
            "uiPreferences": {
                "theme": "light",
                "fontSize": "medium",
                "messageDensity": "comfortable",
                "sidebarWidth": 280,
            }
        }
    return serialize_app_settings(settings)


@router.patch("/settings")
def update_app_settings(updates: AppSettingsUpdate, db: Session = Depends(get_db)):
    """Update application settings"""
    settings = db.query(DBAppSettings).filter(DBAppSettings.id == 1).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")

    if updates.currentConversationId is not None:
        settings.current_conversation_id = updates.currentConversationId

    if updates.globalSettings is not None:
        settings.global_settings_json = json.dumps(updates.globalSettings)

    if updates.uiPreferences is not None:
        settings.ui_preferences_json = json.dumps(updates.uiPreferences)

    settings.updated_at = int(datetime.now().timestamp() * 1000)

    db.commit()
    db.refresh(settings)
    return serialize_app_settings(settings)


# ==================== Data Import ====================

@router.post("/import")
def import_data(data: DataImport, db: Session = Depends(get_db)):
    """Import data from localStorage (migration endpoint)"""
    imported_count = {
        "conversations": 0,
        "messages": 0,
        "modelSources": 0,
        "settings": 1,
    }

    # Import model sources
    for source_data in data.modelSources:
        existing = db.query(DBModelSource).filter(DBModelSource.id == source_data["id"]).first()
        if not existing:
            db_source = DBModelSource(
                id=source_data["id"],
                name=source_data["name"],
                base_url=source_data["baseUrl"],
                api_key=source_data["apiKey"],
                models_json=json.dumps(source_data["models"]),
                created_at=source_data["createdAt"],
                updated_at=source_data["updatedAt"],
            )
            db.add(db_source)
            imported_count["modelSources"] += 1

    # Import conversations and messages
    for conv_data in data.conversations:
        existing = db.query(DBConversation).filter(DBConversation.id == conv_data["id"]).first()
        if not existing:
            db_conv = DBConversation(
                id=conv_data["id"],
                title=conv_data["title"],
                created_at=conv_data["createdAt"],
                updated_at=conv_data["updatedAt"],
                settings_json=json.dumps(conv_data.get("settings")) if conv_data.get("settings") else None,
                is_pinned=conv_data.get("isPinned", False),
                is_archived=conv_data.get("isArchived", False),
            )
            db.add(db_conv)
            imported_count["conversations"] += 1

            # Import messages
            for msg_data in conv_data.get("messages", []):
                db_msg = DBMessage(
                    id=msg_data["id"],
                    conversation_id=conv_data["id"],
                    role=msg_data["role"],
                    content=msg_data["content"],
                    reasoning_content=msg_data.get("reasoning_content"),
                    created_at=msg_data["createdAt"],
                    attachments_json=json.dumps(msg_data.get("attachments")) if msg_data.get("attachments") else None,
                    tool_calls_json=json.dumps(msg_data.get("toolCalls")) if msg_data.get("toolCalls") else None,
                )
                db.add(db_msg)
                imported_count["messages"] += 1

    # Update settings
    settings = db.query(DBAppSettings).filter(DBAppSettings.id == 1).first()
    if settings:
        settings.current_conversation_id = data.currentConversationId
        settings.global_settings_json = json.dumps(data.globalSettings)
        settings.ui_preferences_json = json.dumps(data.uiPreferences)
        settings.updated_at = int(datetime.now().timestamp() * 1000)

    db.commit()
    return {
        "ok": True,
        "imported": imported_count
    }


@router.get("/export")
def export_all_data(db: Session = Depends(get_db)):
    """Export all data (for backup)"""
    conversations = db.query(DBConversation).all()
    sources = db.query(DBModelSource).all()
    settings = db.query(DBAppSettings).filter(DBAppSettings.id == 1).first()

    return {
        "conversations": [serialize_conversation(conv, include_messages=True) for conv in conversations],
        "modelSources": [serialize_model_source(source) for source in sources],
        **(serialize_app_settings(settings) if settings else {}),
        "exportedAt": int(datetime.now().timestamp() * 1000)
    }


# ==================== Folders ====================

@router.get("/folders")
def list_folders(db: Session = Depends(get_db)):
    """Get all folders ordered by pinned and creation time"""
    folders = db.query(DBFolder).order_by(
        DBFolder.is_pinned.desc(),  # Pinned folders first
        DBFolder.created_at.desc()  # Newest first
    ).all()
    return [serialize_folder(folder) for folder in folders]


@router.post("/folders")
def create_folder(folder: FolderCreate, db: Session = Depends(get_db)):
    """Create a new folder"""
    # Check if already exists
    existing = db.query(DBFolder).filter(DBFolder.id == folder.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Folder already exists")

    db_folder = DBFolder(
        id=folder.id,
        name=folder.name,
        color=folder.color,
        created_at=folder.createdAt,
        updated_at=folder.updatedAt,
    )
    db.add(db_folder)
    db.commit()
    db.refresh(db_folder)
    return serialize_folder(db_folder)


@router.patch("/folders/{folder_id}")
def update_folder(
    folder_id: str,
    updates: FolderUpdate,
    db: Session = Depends(get_db)
):
    """Update folder (rename, change color, pin/unpin)"""
    folder = db.query(DBFolder).filter(DBFolder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    if updates.name is not None:
        folder.name = updates.name
    if updates.color is not None:
        folder.color = updates.color
    if updates.isPinned is not None:
        folder.is_pinned = updates.isPinned
    if updates.updatedAt is not None:
        folder.updated_at = updates.updatedAt

    db.commit()
    db.refresh(folder)
    return serialize_folder(folder)


@router.delete("/folders/{folder_id}")
def delete_folder(folder_id: str, db: Session = Depends(get_db)):
    """Delete folder (conversations will be moved to 'uncategorized')"""
    # Prevent deletion of default folder
    if folder_id == 'default-uncategorized':
        raise HTTPException(status_code=400, detail="Cannot delete default folder")

    folder = db.query(DBFolder).filter(DBFolder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    # Move all conversations in this folder to 'uncategorized'
    db.query(DBConversation).filter(DBConversation.folder_id == folder_id).update(
        {"folder_id": "default-uncategorized"}
    )

    db.delete(folder)
    db.commit()
    return {"ok": True, "id": folder_id}


# ==================== Copy Conversation ====================

@router.post("/conversations/{conversation_id}/copy")
def copy_conversation(conversation_id: str, db: Session = Depends(get_db)):
    """Copy a conversation with all its messages"""
    from nanoid import generate

    # Get original conversation with all messages
    original = db.query(DBConversation).filter(DBConversation.id == conversation_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Create new conversation
    new_id = generate()
    new_conv = DBConversation(
        id=new_id,
        title=f"{original.title} (副本)",
        created_at=int(datetime.now().timestamp() * 1000),
        updated_at=int(datetime.now().timestamp() * 1000),
        settings_json=original.settings_json,  # Copy settings
        is_pinned=False,  # Don't inherit pinned status
        is_archived=False,
        folder_id=original.folder_id,  # Inherit folder
    )
    db.add(new_conv)

    # Copy all messages
    for original_msg in original.messages:
        new_msg = DBMessage(
            id=generate(),
            conversation_id=new_id,
            role=original_msg.role,
            content=original_msg.content,
            reasoning_content=original_msg.reasoning_content,
            created_at=original_msg.created_at,
            attachments_json=original_msg.attachments_json,
            tool_calls_json=original_msg.tool_calls_json,
        )
        db.add(new_msg)

    db.commit()
    db.refresh(new_conv)
    return serialize_conversation(new_conv, include_messages=True)
