"""Core Configuration — Settings & Environment"""

from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Lawyer Tech ERP"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    SECRET_KEY: str = "your-super-secret-key-change-in-production-min-32-chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/lawyertech_db"
    DATABASE_URL_SYNC: str = "postgresql://postgres:password@localhost:5432/lawyertech_db"

    # AI Keys
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    PINECONE_API_KEY: str = ""
    PINECONE_INDEX_NAME: str = "lawyer-tech-legal"

    # AWS S3
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "ap-southeast-1"
    AWS_S3_BUCKET: str = "lawyer-tech-documents"

    # Google Cloud Storage
    GCS_BUCKET_NAME: str = "lawyer-tech-docs"

    # LINE Integration
    LINE_ACCESS_TOKEN: str = ""
    LINE_CHANNEL_ID: str = ""
    LINE_CHANNEL_SECRET: str = ""
    LINE_REDIRECT_URI: str = "http://localhost:3000/auth/line/callback"

    # CORS
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001"]

    # Email
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = "noreply@lawyertech.th"
    MAIL_SERVER: str = "smtp.gmail.com"
    MAIL_PORT: int = 587

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

    def __init__(self, **values):
        super().__init__(**values)
        vercel_url = os.environ.get("POSTGRES_PRISMA_URL") or os.environ.get("POSTGRES_URL")
        if vercel_url:
            async_url = vercel_url
            if async_url.startswith("postgres://"):
                async_url = async_url.replace("postgres://", "postgresql+asyncpg://", 1)
            elif async_url.startswith("postgresql://"):
                async_url = async_url.replace("postgresql://", "postgresql+asyncpg://", 1)
            if "sslmode" not in async_url:
                async_url += ("&" if "?" in async_url else "?") + "sslmode=require"
            self.DATABASE_URL = async_url

            sync_url = vercel_url
            if sync_url.startswith("postgresql+asyncpg://"):
                sync_url = sync_url.replace("postgresql+asyncpg://", "postgresql://", 1)
            elif sync_url.startswith("postgres://"):
                sync_url = sync_url.replace("postgres://", "postgresql://", 1)
            if "sslmode" not in sync_url:
                sync_url += ("&" if "?" in sync_url else "?") + "sslmode=require"
            self.DATABASE_URL_SYNC = sync_url


settings = Settings()
