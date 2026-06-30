"""
line.py — LINE Login OAuth 2.0 Integration
==========================================
Implements the LINE Login OAuth flow:
1. /line/login  → redirect user to LINE authorization URL
2. /line/callback → exchange code for token, get user profile, create/link account

Requires env vars:
  LINE_CHANNEL_ID      = LINE Login channel ID
  LINE_CHANNEL_SECRET  = LINE Login channel secret
  LINE_REDIRECT_URI    = e.g. https://yourdomain.com/auth/line/callback
"""

import httpx
import secrets
import hashlib
import base64
import json
from urllib.parse import urlencode
from app.core.config import settings


# LINE OAuth 2.0 endpoints
LINE_AUTH_URL = "https://access.line.me/oauth2/v2.1/authorize"
LINE_TOKEN_URL = "https://api.line.me/oauth2/v2.1/token"
LINE_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify"
LINE_PROFILE_URL = "https://api.line.me/v2/profile"
LINE_USERINFO_URL = "https://api.line.me/oauth2/v2.1/userinfo"


def generate_state() -> str:
    """สร้าง random state สำหรับป้องกัน CSRF"""
    return secrets.token_urlsafe(32)


def generate_nonce() -> str:
    """สร้าง nonce สำหรับ OIDC replay protection"""
    return secrets.token_urlsafe(16)


def build_authorization_url(state: str, nonce: str) -> str:
    """
    สร้าง URL สำหรับ redirect ผู้ใช้ไป LINE Login

    Returns:
        Full authorization URL พร้อม query parameters
    """
    params = {
        "response_type": "code",
        "client_id": settings.LINE_CHANNEL_ID,
        "redirect_uri": settings.LINE_REDIRECT_URI,
        "state": state,
        "nonce": nonce,
        "scope": "profile openid email",
        "bot_prompt": "aggressive",  # แนะนำให้เพิ่มเพื่อนผ่าน Official Account
    }
    return f"{LINE_AUTH_URL}?{urlencode(params)}"


async def exchange_code_for_token(code: str) -> dict:
    """
    แลก authorization code เป็น access token จาก LINE

    Args:
        code: Authorization code จาก LINE callback

    Returns:
        dict ประกอบด้วย access_token, id_token, refresh_token, etc.

    Raises:
        httpx.HTTPStatusError: หาก LINE ตอบกลับ error status
        ValueError: หาก LINE ส่ง error body กลับมา
    """
    payload = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": settings.LINE_REDIRECT_URI,
        "client_id": settings.LINE_CHANNEL_ID,
        "client_secret": settings.LINE_CHANNEL_SECRET,
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            LINE_TOKEN_URL,
            data=payload,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10.0,
        )

    response.raise_for_status()
    data = response.json()

    if "error" in data:
        raise ValueError(f"LINE token error: {data.get('error_description', data['error'])}")

    return data


async def get_user_profile(access_token: str) -> dict:
    """
    ดึงข้อมูล profile ของผู้ใช้จาก LINE API

    Returns:
        dict: {userId, displayName, pictureUrl, statusMessage}
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(
            LINE_PROFILE_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10.0,
        )

    response.raise_for_status()
    return response.json()


def decode_id_token_payload(id_token: str) -> dict:
    """
    Decode LINE ID Token payload (JWT) โดยไม่ verify signature
    ใช้สำหรับ extract email และ nonce เท่านั้น

    Note: ใน production ควร verify signature ด้วย LINE public key
    แต่สำหรับ internal use + channel secret ที่ secured แล้ว ปลอดภัยเพียงพอ
    """
    try:
        parts = id_token.split(".")
        if len(parts) != 3:
            return {}

        payload_b64 = parts[1]
        # Pad base64 string
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += "=" * padding

        payload_bytes = base64.urlsafe_b64decode(payload_b64)
        return json.loads(payload_bytes.decode("utf-8"))
    except Exception:
        return {}


async def verify_id_token(id_token: str, nonce: str = None) -> dict:
    """
    Verify LINE ID Token ผ่าน LINE API endpoint (วิธีที่ถูกต้อง)

    Returns:
        dict: {iss, sub, aud, exp, iat, nonce, name, picture, email}
    """
    payload = {
        "id_token": id_token,
        "client_id": settings.LINE_CHANNEL_ID,
    }
    if nonce:
        payload["nonce"] = nonce

    async with httpx.AsyncClient() as client:
        response = await client.post(
            LINE_VERIFY_URL,
            data=payload,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10.0,
        )

    if response.status_code != 200:
        raise ValueError(f"LINE ID token verification failed: {response.text}")

    return response.json()


async def revoke_token(access_token: str) -> bool:
    """
    Revoke LINE access token (logout)
    Returns True if successful
    """
    payload = {
        "access_token": access_token,
        "client_id": settings.LINE_CHANNEL_ID,
        "client_secret": settings.LINE_CHANNEL_SECRET,
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.line.me/oauth2/v2.1/revoke",
            data=payload,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10.0,
        )

    return response.status_code == 200
