"""AI Core — Factory for LLMs and Generative Models using Global Settings"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import google.generativeai as genai
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI

from app.core.config import settings
from app.models.models import SystemSetting

async def get_ai_config(db: AsyncSession = None):
    """Retrieve system settings from DB or fallback to environment settings"""
    config = {
        "gemini_api_key": settings.GEMINI_API_KEY,
        "gemini_model": "gemini-2.0-flash",
        "openai_api_key": settings.OPENAI_API_KEY,
        "openai_model": "gpt-4o",
        "prefer_provider": "gemini" # gemini or openai
    }
    
    if db is not None:
        try:
            result = await db.execute(select(SystemSetting))
            setting = result.scalars().first()
            if setting:
                # Override with DB values if they exist and are not masked
                if setting.gemini_api_key_override and "••" not in setting.gemini_api_key_override:
                    config["gemini_api_key"] = setting.gemini_api_key_override
                if setting.gemini_model:
                    config["gemini_model"] = setting.gemini_model
                    
                if setting.openai_api_key and "••" not in setting.openai_api_key:
                    config["openai_api_key"] = setting.openai_api_key
                if setting.openai_model:
                    config["openai_model"] = setting.openai_model
                
                # Determine preference based on populated fields
                if config["openai_api_key"] and not config["gemini_api_key"]:
                    config["prefer_provider"] = "openai"
                elif config["openai_api_key"] and config["gemini_api_key"]:
                    # If both are populated, check if the model name suggests OpenAI
                    if any(m in config["openai_model"].lower() for m in ["gpt", "o1", "o3"]):
                        config["prefer_provider"] = "openai"
                    else:
                        config["prefer_provider"] = "gemini"
        except Exception as e:
            print(f"⚠️ Error loading SystemSetting: {e}")
            
    return config

async def get_llm(db: AsyncSession = None):
    """Factory to get the correct LangChain LLM instance (Gemini or OpenAI)"""
    config = await get_ai_config(db)
    
    if config["prefer_provider"] == "openai" and config["openai_api_key"]:
        print(f"🤖 Initializing OpenAI Chat Model: {config['openai_model']}")
        return ChatOpenAI(
            model=config["openai_model"],
            openai_api_key=config["openai_api_key"],
            temperature=0.3
        )
    else:
        print(f"🤖 Initializing Gemini Chat Model: {config['gemini_model']}")
        return ChatGoogleGenerativeAI(
            model=config["gemini_model"],
            google_api_key=config["gemini_api_key"],
            temperature=0.3
        )

async def get_genai_model(db: AsyncSession = None):
    """Dynamic setup for google-generativeai raw SDK"""
    config = await get_ai_config(db)
    genai.configure(api_key=config["gemini_api_key"])
    return genai.GenerativeModel(config["gemini_model"])
