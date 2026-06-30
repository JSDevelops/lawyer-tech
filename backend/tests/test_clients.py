"""
test_clients.py — CRM/Clients API Tests
"""

import pytest
from httpx import AsyncClient


# ข้อมูล client ตัวอย่าง
SAMPLE_CLIENT = {
    "full_name": "นายสมชาย ใจดี",
    "phone": "081-234-5678",
    "email": "somchai@example.com",
    "id_card": "1234567890123",
    "address": "123 ถนนสาทร กรุงเทพฯ",
    "service_type": "private",
}


class TestClientCRUD:
    """CRUD operations สำหรับ /api/v1/clients"""

    async def test_create_client_success(self, test_client: AsyncClient, auth_headers: dict):
        """สร้าง client ใหม่สำเร็จ"""
        resp = await test_client.post("/api/v1/clients/", json=SAMPLE_CLIENT, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "id" in data
        assert "client_code" in data
        assert data["client_code"].startswith("CLT-")

    async def test_list_clients(self, test_client: AsyncClient, auth_headers: dict):
        """รายการ clients ต้อง return list"""
        # สร้าง client ก่อน
        await test_client.post("/api/v1/clients/", json=SAMPLE_CLIENT, headers=auth_headers)

        resp = await test_client.get("/api/v1/clients/", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data
        assert isinstance(data["data"], list)
        assert data["total"] >= 1

    async def test_get_client_by_id(self, test_client: AsyncClient, auth_headers: dict):
        """ดู client จาก ID"""
        # สร้างก่อน
        create_resp = await test_client.post("/api/v1/clients/", json=SAMPLE_CLIENT, headers=auth_headers)
        client_id = create_resp.json()["id"]

        resp = await test_client.get(f"/api/v1/clients/{client_id}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["id"] == client_id

    async def test_get_client_not_found(self, test_client: AsyncClient, auth_headers: dict):
        """ID ที่ไม่มีต้อง 404"""
        import uuid
        resp = await test_client.get(f"/api/v1/clients/{uuid.uuid4()}", headers=auth_headers)
        assert resp.status_code == 404

    async def test_update_client(self, test_client: AsyncClient, auth_headers: dict):
        """อัปเดตข้อมูล client"""
        create_resp = await test_client.post("/api/v1/clients/", json=SAMPLE_CLIENT, headers=auth_headers)
        client_id = create_resp.json()["id"]

        # ClientUpdate extends ClientCreate — full_name is required
        update_payload = {
            "full_name": SAMPLE_CLIENT["full_name"],  # required field
            "phone": "089-999-8888",
            "notes": "ลูกความ VIP",
        }
        resp = await test_client.put(f"/api/v1/clients/{client_id}", json=update_payload, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["phone"] == "089-999-8888"

    async def test_delete_client(self, test_client: AsyncClient, auth_headers: dict):
        """ลบ client สำเร็จ (Soft Delete)"""
        create_resp = await test_client.post("/api/v1/clients/", json={
            **SAMPLE_CLIENT,
            "full_name": "ลูกความที่จะลบ",
            "email": "todelete@test.th",
        }, headers=auth_headers)
        client_id = create_resp.json()["id"]

        resp = await test_client.delete(f"/api/v1/clients/{client_id}", headers=auth_headers)
        assert resp.status_code == 200

        # Soft delete: client hidden from list but GET still returns 404 on is_active=False search
        list_resp = await test_client.get("/api/v1/clients/?search=ลูกความที่จะลบ", headers=auth_headers)
        assert list_resp.status_code == 200
        # Soft-deleted client should not appear in list
        ids_in_list = [c["id"] for c in list_resp.json()["data"]]
        assert client_id not in ids_in_list

    async def test_search_clients(self, test_client: AsyncClient, auth_headers: dict):
        """ค้นหา client ด้วย keyword"""
        await test_client.post("/api/v1/clients/", json={
            **SAMPLE_CLIENT,
            "full_name": "นางสาวพิเศษ หาเจอ",
            "email": "findme@test.th",
        }, headers=auth_headers)

        resp = await test_client.get("/api/v1/clients/?search=พิเศษ", headers=auth_headers)
        assert resp.status_code == 200
        results = resp.json()["data"]
        assert any("พิเศษ" in c["full_name"] for c in results)

    async def test_create_client_unauthenticated(self, test_client: AsyncClient):
        """ไม่มี token ต้อง 403"""
        resp = await test_client.post("/api/v1/clients/", json=SAMPLE_CLIENT)
        assert resp.status_code in (401, 403)
