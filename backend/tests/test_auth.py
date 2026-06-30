"""
test_auth.py — Authentication API Tests
"""

import pytest
from httpx import AsyncClient


class TestRegister:
    """POST /api/v1/auth/register"""

    async def test_register_success(self, test_client: AsyncClient):
        """สมัครสมาชิกสำเร็จ"""
        payload = {
            "email": "new_lawyer@test.th",
            "password": "SecurePass123!",
            "full_name": "ทนาย ใหม่",
            "role": "lawyer",
        }
        resp = await test_client.post("/api/v1/auth/register", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["user"]["email"] == payload["email"]
        assert data["user"]["role"] == "lawyer"

    async def test_register_duplicate_email(self, test_client: AsyncClient):
        """สมัครด้วยอีเมลซ้ำต้อง return 400"""
        payload = {
            "email": "duplicate@test.th",
            "password": "Pass123!",
            "full_name": "ทนาย ซ้ำ",
        }
        # สมัครครั้งแรก
        resp1 = await test_client.post("/api/v1/auth/register", json=payload)
        assert resp1.status_code == 200

        # สมัครครั้งที่สอง — ต้องเกิด error
        resp2 = await test_client.post("/api/v1/auth/register", json=payload)
        assert resp2.status_code == 400
        assert "อีเมลนี้ถูกใช้งานแล้ว" in resp2.json()["detail"]

    async def test_register_missing_required_fields(self, test_client: AsyncClient):
        """ขาด field บังคับต้อง 422"""
        resp = await test_client.post("/api/v1/auth/register", json={"email": "only@email.com"})
        assert resp.status_code == 422


class TestLogin:
    """POST /api/v1/auth/login"""

    async def test_login_success(self, test_client: AsyncClient, test_user_data: dict):
        """login สำเร็จ"""
        # register ก่อน
        await test_client.post("/api/v1/auth/register", json=test_user_data)

        resp = await test_client.post("/api/v1/auth/login", json={
            "email": test_user_data["email"],
            "password": test_user_data["password"],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == test_user_data["email"]

    async def test_login_wrong_password(self, test_client: AsyncClient, test_user_data: dict):
        """รหัสผ่านผิดต้อง 401"""
        await test_client.post("/api/v1/auth/register", json=test_user_data)

        resp = await test_client.post("/api/v1/auth/login", json={
            "email": test_user_data["email"],
            "password": "WrongPassword!",
        })
        assert resp.status_code == 401

    async def test_login_nonexistent_user(self, test_client: AsyncClient):
        """user ไม่มีในระบบต้อง 401"""
        resp = await test_client.post("/api/v1/auth/login", json={
            "email": "ghost@notexist.th",
            "password": "whatever",
        })
        assert resp.status_code == 401


class TestGetMe:
    """GET /api/v1/auth/me"""

    async def test_get_me_authenticated(self, test_client: AsyncClient, auth_headers: dict):
        """ดูข้อมูลตัวเองสำเร็จ"""
        resp = await test_client.get("/api/v1/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "email" in data
        assert "full_name" in data
        assert "role" in data

    async def test_get_me_unauthenticated(self, test_client: AsyncClient):
        """ไม่มี token ต้อง 403"""
        resp = await test_client.get("/api/v1/auth/me")
        assert resp.status_code in (401, 403)

    async def test_get_me_invalid_token(self, test_client: AsyncClient):
        """Token ปลอมต้อง 401"""
        resp = await test_client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer this.is.fake"}
        )
        assert resp.status_code == 401
