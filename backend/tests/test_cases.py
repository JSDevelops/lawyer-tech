"""
test_cases.py — Case Management API Tests
"""

import pytest
from httpx import AsyncClient


# สร้าง client ก่อนแล้วใช้ ID ของเขาในการสร้าง case
SAMPLE_CLIENT_PAYLOAD = {
    "full_name": "นายลูกความ ทดสอบ",
    "phone": "082-111-2222",
    "email": "client_case@test.th",
}

SAMPLE_CASE_PAYLOAD = {
    "title": "คดีทดสอบ — กู้เงินไม่คืน",
    "description": "ลูกหนี้ยืมเงิน 500,000 บาท ไม่ชำระคืน",
    "category": "คดีแพ่ง",
    "priority": "high",
    "court_name": "ศาลแพ่งกรุงเทพใต้",
}


async def create_test_client(client: AsyncClient, headers: dict) -> str:
    """Helper: สร้าง client และ return ID"""
    resp = await client.post("/api/v1/clients/", json=SAMPLE_CLIENT_PAYLOAD, headers=headers)
    assert resp.status_code == 200
    return resp.json()["id"]


class TestCaseCRUD:
    """CRUD operations สำหรับ /api/v1/cases"""

    async def test_create_case_success(self, test_client: AsyncClient, auth_headers: dict):
        """สร้างคดีใหม่สำเร็จ"""
        client_id = await create_test_client(test_client, auth_headers)
        payload = {**SAMPLE_CASE_PAYLOAD, "client_id": client_id}

        resp = await test_client.post("/api/v1/cases/", json=payload, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == payload["title"]
        assert "case_number" in data
        assert data["case_number"].startswith("LT-")

    async def test_list_cases(self, test_client: AsyncClient, auth_headers: dict):
        """รายการคดีทั้งหมด"""
        client_id = await create_test_client(test_client, auth_headers)
        await test_client.post("/api/v1/cases/", json={**SAMPLE_CASE_PAYLOAD, "client_id": client_id}, headers=auth_headers)

        resp = await test_client.get("/api/v1/cases/", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data
        assert isinstance(data["data"], list)

    async def test_get_case_by_id(self, test_client: AsyncClient, auth_headers: dict):
        """ดูคดีจาก ID"""
        client_id = await create_test_client(test_client, auth_headers)
        create_resp = await test_client.post("/api/v1/cases/", json={**SAMPLE_CASE_PAYLOAD, "client_id": client_id}, headers=auth_headers)
        case_id = create_resp.json()["id"]

        resp = await test_client.get(f"/api/v1/cases/{case_id}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["id"] == case_id

    async def test_update_case_status(self, test_client: AsyncClient, auth_headers: dict):
        """เปลี่ยนสถานะคดี"""
        client_id = await create_test_client(test_client, auth_headers)
        create_resp = await test_client.post("/api/v1/cases/", json={**SAMPLE_CASE_PAYLOAD, "client_id": client_id}, headers=auth_headers)
        case_id = create_resp.json()["id"]

        # use PUT to update status field
        resp = await test_client.put(f"/api/v1/cases/{case_id}", json={"status": "active"}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "active"

    async def test_filter_cases_by_status(self, test_client: AsyncClient, auth_headers: dict):
        """กรองคดีตาม status"""
        client_id = await create_test_client(test_client, auth_headers)
        await test_client.post("/api/v1/cases/", json={
            **SAMPLE_CASE_PAYLOAD, "client_id": client_id, "status": "active"
        }, headers=auth_headers)

        resp = await test_client.get("/api/v1/cases/?status=active", headers=auth_headers)
        assert resp.status_code == 200
        cases = resp.json()["data"]
        assert all(c["status"] == "active" for c in cases)

    async def test_create_case_invalid_category(self, test_client: AsyncClient, auth_headers: dict):
        """ประเภทคดีที่ไม่ถูกต้องต้อง 422"""
        client_id = await create_test_client(test_client, auth_headers)
        resp = await test_client.post("/api/v1/cases/", json={
            **SAMPLE_CASE_PAYLOAD,
            "client_id": client_id,
            "category": "ประเภทปลอม",
        }, headers=auth_headers)
        assert resp.status_code == 422

    async def test_delete_case(self, test_client: AsyncClient, auth_headers: dict):
        """ลบคดี"""
        client_id = await create_test_client(test_client, auth_headers)
        create_resp = await test_client.post("/api/v1/cases/", json={**SAMPLE_CASE_PAYLOAD, "client_id": client_id}, headers=auth_headers)
        case_id = create_resp.json()["id"]

        resp = await test_client.delete(f"/api/v1/cases/{case_id}", headers=auth_headers)
        assert resp.status_code == 200

        get_resp = await test_client.get(f"/api/v1/cases/{case_id}", headers=auth_headers)
        assert get_resp.status_code == 404
