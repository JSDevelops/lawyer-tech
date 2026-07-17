import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from httpx import AsyncClient
from sqlalchemy import select
from app.models.models import Tenant, User

@pytest.fixture(autouse=True)
def mock_ai_dependencies():
    """Mock external AI models and embeddings to prevent network calls during testing"""
    import os
    os.environ["GOOGLE_API_KEY"] = "mock-google-key"
    os.environ["GEMINI_API_KEY"] = "mock-gemini-key"
    os.environ["OPENAI_API_KEY"] = "mock-openai-key"

    mock_vector = [0.1] * 768
    with patch("app.core.ai.get_embedding", new_callable=AsyncMock) as mock_embed:
        mock_embed.return_value = mock_vector
        
        # Patch the base RunnableSequence class invoke method (this is the class of chain)
        from langchain_core.runnables import RunnableSequence
        with patch.object(RunnableSequence, "invoke", new_callable=MagicMock) as mock_runnable_invoke:
            mock_runnable_invoke.return_value = "นี่คือผลลัพธ์การวิเคราะห์กฎหมายจำลองด้วย AI"
            yield mock_embed, mock_runnable_invoke


class TestAICredits:
    """ทดสอบระบบโควตาและการหักลบเครดิต AI"""

    async def test_ai_credits_flow(self, test_client: AsyncClient, auth_headers: dict, db_session):
        # 1. Fetch current user from token
        from app.core.security import decode_token
        import uuid
        
        token = auth_headers["Authorization"].split(" ")[1]
        payload = decode_token(token)
        user_id = payload["sub"]
        
        user_uuid = uuid.UUID(user_id)
        user_res = await db_session.execute(select(User).where(User.id == user_uuid))
        user = user_res.scalar_one()
        
        # 2. Create a test Tenant and associate with user
        tenant = Tenant(
            name="สำนักงานกฎหมายทดสอบ",
            subdomain="testoffice",
            status="active",
            ai_credits_total=10,
            ai_credits_used=0,
            ai_credits_remaining=10
        )
        db_session.add(tenant)
        await db_session.flush()
        
        user.tenant_id = tenant.id
        await db_session.commit()
        
        # 3. Call AI endpoint and expect successful call with decremented credits
        payload = {
            "message": "กติกากลางกฎหมายแพ่งเป็นอย่างไร"
        }
        
        resp = await test_client.post("/api/v1/ai/chat", json=payload, headers=auth_headers)
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        assert data["status"] == "success"
        assert data["ai_credits_remaining"] == 9
        assert data["ai_credits_total"] == 10
        
        # 4. Set credits to 0 to simulate exhaustion
        tenant_res = await db_session.execute(select(Tenant).where(Tenant.id == tenant.id))
        fresh_tenant = tenant_res.scalar_one()
        fresh_tenant.ai_credits_remaining = 0
        await db_session.commit()
        
        # 5. Call AI endpoint again and expect 403 Forbidden
        resp_exhausted = await test_client.post("/api/v1/ai/chat", json=payload, headers=auth_headers)
        assert resp_exhausted.status_code == 403
        data_err = resp_exhausted.json()
        assert "เครดิต AI ของสำนักงานกฎหมายท่านหมดลงแล้ว" in data_err["detail"]
