"""Database Connection — SQLAlchemy Async + PGVector"""

import ssl
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings


# SQLite (used in tests) does not support pool_size, max_overflow, or SSL
_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

if _is_sqlite:
    connect_args = {"check_same_thread": False}
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        connect_args=connect_args,
    )
else:
    connect_args = {}
    if "localhost" not in settings.DATABASE_URL and "127.0.0.1" not in settings.DATABASE_URL:
        ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        connect_args["ssl"] = ssl_context
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
        connect_args=connect_args,
    )

# Session Factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# Base Model
class Base(DeclarativeBase):
    pass


# Dependency
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
