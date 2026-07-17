"""
test_ai_rag.py — AI RAG & Legal Research API Tests
"""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from httpx import AsyncClient


@pytest.fixture(autouse=True)
def mock_ai_dependencies():
    """Mock external AI models and embeddings to prevent network calls during testing"""
    import os
    # Set dummy keys so langchain/SDK validators are satisfied
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


class TestAIRAG:
    """Tests for AI Assistant RAG endpoints"""

    async def test_seed_references_success(self, test_client: AsyncClient, auth_headers: dict):
        """ทดสอบการยิง API เพื่อ Seed ข้อมูลฎีกาตัวอย่าง"""
        resp = await test_client.post("/api/v1/ai/seed-references", headers=auth_headers)
        assert resp.status_code == 200, f"Seed failed: {resp.text}"
        data = resp.json()
        assert data["status"] == "success"
        assert "Successfully seeded" in data["message"] or "already has" in data["message"]

    async def test_legal_research_rag_fallback(self, test_client: AsyncClient, auth_headers: dict):
        """ทดสอบการใช้งาน Legal Research RAG แม้ยังไม่มีฐานข้อมูล (Fallback)
        
        Note: credit check is bypassed via mock since test tenant has no credits.
        AI credit logic is separately tested in test_ai_credits.py.
        """
        payload = {
            "question": "กู้ยืมเงินทางไลน์ไม่มีสัญญาฟ้องร้องได้ไหม",
            "category": "คดีแพ่ง"
        }
        # Mock the credit check/deduct function so test runs without a tenant with credits
        with patch("app.api.routes.ai_assistant.check_and_deduct_ai_credits", new_callable=AsyncMock) as mock_credits:
            mock_credits.return_value = (100, 100)  # (remaining, total)
            resp = await test_client.post("/api/v1/ai/legal-research", json=payload, headers=auth_headers)
        assert resp.status_code == 200, f"RAG failed: {resp.text}"
        data = resp.json()
        assert data["status"] == "success"
        assert "research_result" in data
        assert isinstance(data["references"], list)
