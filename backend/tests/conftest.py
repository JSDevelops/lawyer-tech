"""
conftest.py — Shared Fixtures for Lawyer Tech ERP Tests
========================================================
- ใช้ SQLite in-memory (aiosqlite) แทน PostgreSQL เพื่อ isolation
- ต้อง set DATABASE_URL ก่อน import app ทุกอย่าง
- Fixture: test_client, db_session, auth_token, auth_headers
"""

import os
import pytest
import pytest_asyncio
from typing import AsyncGenerator

# ======================================================
# CRITICAL: Set DATABASE_URL *before* any app imports
# database.py creates the engine at module level, so
# we must override the env var before it loads.
# ======================================================
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["DATABASE_URL_SYNC"] = "sqlite:///:memory:"

from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool

# Import app AFTER setting env vars
from app.core.database import Base, get_db
from app.core.security import create_access_token
from main import app

# ==========================================
# Test Database (SQLite in-memory)
# ==========================================
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_database():
    """สร้าง tables ทั้งหมดก่อนเริ่ม test session"""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture()
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """แต่ละ test ได้ session แยก + rollback อัตโนมัติ"""
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture()
async def test_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """HTTP test client พร้อม override db dependency"""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        yield client

    app.dependency_overrides.clear()


@pytest_asyncio.fixture()
async def test_user_data():
    """ข้อมูล user สำหรับ test"""
    return {
        "email": "testlawyer@lawyertech.th",
        "password": "TestPassword123!",
        "full_name": "ทนาย ทดสอบ",
        "phone": "081-000-0001",
        "role": "lawyer",
    }


@pytest_asyncio.fixture()
async def auth_token(test_client: AsyncClient, test_user_data: dict) -> str:
    """สร้าง user และ return JWT token"""
    resp = await test_client.post("/api/v1/auth/register", json=test_user_data)
    if resp.status_code == 400:
        resp = await test_client.post("/api/v1/auth/login", json={
            "email": test_user_data["email"],
            "password": test_user_data["password"],
        })
    assert resp.status_code == 200, f"Auth failed: {resp.text}"
    return resp.json()["access_token"]


@pytest_asyncio.fixture()
async def auth_headers(auth_token: str) -> dict:
    """Headers พร้อม Bearer token"""
    return {"Authorization": f"Bearer {auth_token}"}


@pytest_asyncio.fixture()
async def admin_token() -> str:
    """สร้าง admin JWT token โดยตรง"""
    import uuid
    return create_access_token({"sub": str(uuid.uuid4()), "role": "admin"})


@pytest_asyncio.fixture()
async def admin_headers(admin_token: str) -> dict:
    return {"Authorization": f"Bearer {admin_token}"}
