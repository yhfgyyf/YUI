"""Configuration management for YUI ChatBox"""

import os
from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""

    # API Configuration
    openai_api_key: Optional[str] = Field(None, env='OPENAI_API_KEY')
    openai_base_url: str = Field(
        'https://api.openai.com/v1',
        env='OPENAI_BASE_URL'
    )

    # Server Configuration
    host: str = Field('0.0.0.0', env='HOST')
    port: int = Field(8001, env='PORT')

    # CORS Configuration
    cors_origins: str = Field(
        'http://localhost:5173',
        env='CORS_ORIGINS'
    )

    # Application Mode
    yui_mode: str = Field('production', env='YUI_MODE')

    class Config:
        env_file = '.env'
        env_file_encoding = 'utf-8'
        case_sensitive = False


def get_settings() -> Settings:
    """Get application settings"""
    return Settings()
