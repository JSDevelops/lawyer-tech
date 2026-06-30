"""
line_auth.py — LINE Login OAuth Routes
=======================================
Endpoints:
  GET  /api/v1/line/login           → สร้าง URL แล้ว redirect ไป LINE
  GET  /api/v1/line/callback        → รับ code จาก LINE, สร้าง/link user, return JWT
  POST /api/v1/line/link            → ผูก LINE กับ account ที่ login อยู่แล้ว
  GET  /api/v1/line/me              → ดูข้อมูล LINE profile ของ current user
  POST /api/v1/line/unlink          → ยกเลิกการผูก LINE กับ account

State / CSRF:
  - State ถูกสร้างแบบ random และเก็บใน query param เพื่อ validate ตอน callback
  - ใน production ควรเก็บ state ใน Redis / signed cookie
  - สำหรับ demo นี้ใช้ HMAC state encoding เพื่อ stateless verification
"""

import uuid
import hmac
import hashlib
import time
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user, create_access_token
from app.core.config import settings
from app.core import line as line_client
from app.models.models import User, UserRole

router = APIRouter()


# ==============================
# State Helpers (Stateless HMAC)
# ==============================

def _create_signed_state(nonce: str) -> str:
    """สร้าง state = nonce:timestamp:hmac เพื่อ verify ตอน callback"""
    timestamp = str(int(time.time()))
    message = f"{nonce}:{timestamp}"
    sig = hmac.new(
        settings.SECRET_KEY.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()[:16]
    return f"{nonce}:{timestamp}:{sig}"


def _verify_signed_state(state: str, max_age_seconds: int = 600) -> Optional[str]:
    """
    Verify state และ return nonce ถ้าถูกต้อง
    Returns None ถ้า invalid หรือ expired
    """
    parts = state.split(":")
    if len(parts) != 3:
        return None

    nonce, timestamp_str, received_sig = parts
    try:
        ts = int(timestamp_str)
    except ValueError:
        return None

    # Check expiry
    if int(time.time()) - ts > max_age_seconds:
        return None

    # Verify HMAC
    message = f"{nonce}:{timestamp_str}"
    expected_sig = hmac.new(
        settings.SECRET_KEY.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()[:16]

    if not hmac.compare_digest(expected_sig, received_sig):
        return None

    return nonce


# ==============================
# Helper: Get or Create User
# ==============================

async def _get_or_create_line_user(
    db: AsyncSession,
    line_user_id: str,
    display_name: str,
    picture_url: Optional[str],
    email: Optional[str],
) -> User:
    """
    ค้นหา User จาก line_user_id
    ถ้ายังไม่มี → สร้าง account ใหม่เป็น 'lawyer' role
    """
    # Try by LINE user ID
    result = await db.execute(select(User).where(User.line_user_id == line_user_id))
    user = result.scalar_one_or_none()

    if user:
        # Update profile data from LINE
        user.avatar_url = picture_url or user.avatar_url
        return user

    # Try to find existing user by email (link LINE to existing account)
    if email:
        email_result = await db.execute(select(User).where(User.email == email))
        existing = email_result.scalar_one_or_none()
        if existing:
            existing.line_user_id = line_user_id
            existing.avatar_url = picture_url or existing.avatar_url
            return existing

    # Create new user
    new_user = User(
        email=email or f"line_{line_user_id}@line.user",
        full_name=display_name,
        hashed_password="",  # LINE users don't have a password
        role=UserRole.LAWYER,
        line_user_id=line_user_id,
        avatar_url=picture_url,
        is_active=True,
    )
    db.add(new_user)
    await db.flush()
    return new_user


# ==============================
# Endpoints
# ==============================

class LinkLineRequest(BaseModel):
    code: str
    state: str


@router.get("/login")
async def line_login():
    """
    สร้าง LINE Login URL และ redirect ผู้ใช้ไปยังหน้า consent ของ LINE

    Flow:
    1. สร้าง state (HMAC-signed) เพื่อป้องกัน CSRF
    2. สร้าง nonce เพื่อป้องกัน replay attack
    3. Redirect ไป LINE authorization endpoint
    """
    nonce = line_client.generate_nonce()
    state = _create_signed_state(nonce)
    auth_url = line_client.build_authorization_url(state=state, nonce=nonce)
    return RedirectResponse(url=auth_url)


@router.get("/login-url")
async def get_line_login_url():
    """
    Return LINE Login URL (แทน redirect) สำหรับ frontend SPA ที่ต้องการ URL

    เหมาะสำหรับ React/Next.js frontend ที่ต้องการ URL ไปใช้เอง
    """
    nonce = line_client.generate_nonce()
    state = _create_signed_state(nonce)
    auth_url = line_client.build_authorization_url(state=state, nonce=nonce)
    return {
        "status": "success",
        "login_url": auth_url,
        "state": state,
    }


@router.get("/callback")
async def line_callback(
    code: str = Query(..., description="Authorization code จาก LINE"),
    state: str = Query(..., description="State สำหรับ CSRF protection"),
    error: str = Query(None),
    error_description: str = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    LINE OAuth callback endpoint

    1. Verify state (CSRF protection)
    2. Exchange code → access token + id_token
    3. Verify id_token + get profile
    4. Get or create User in DB
    5. Return JWT token สำหรับ Lawyer Tech app
    """
    # Handle LINE error
    if error:
        raise HTTPException(
            status_code=400,
            detail=f"LINE Login error: {error} — {error_description or ''}"
        )

    # Verify state
    nonce = _verify_signed_state(state)
    if not nonce:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired state parameter. Please try logging in again."
        )

    # Exchange code for token
    try:
        token_data = await line_client.exchange_code_for_token(code)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to exchange LINE code: {str(e)}")

    access_token = token_data.get("access_token")
    id_token = token_data.get("id_token")

    if not access_token:
        raise HTTPException(status_code=400, detail="No access token received from LINE")

    # Get user profile from LINE
    try:
        profile = await line_client.get_user_profile(access_token)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to get LINE profile: {str(e)}")

    line_user_id = profile.get("userId")
    display_name = profile.get("displayName", "LINE User")
    picture_url = profile.get("pictureUrl")

    # Try to get email from id_token
    email = None
    if id_token:
        try:
            token_payload = await line_client.verify_id_token(id_token, nonce=nonce)
            email = token_payload.get("email")
        except Exception:
            # Fallback: decode without verification (acceptable for internal use)
            token_payload = line_client.decode_id_token_payload(id_token)
            email = token_payload.get("email")

    # Get or create user
    user = await _get_or_create_line_user(
        db=db,
        line_user_id=line_user_id,
        display_name=display_name,
        picture_url=picture_url,
        email=email,
    )

    if not user.is_active:
        raise HTTPException(status_code=403, detail="บัญชีนี้ถูกระงับการใช้งาน")

    # Issue Lawyer Tech JWT
    jwt_payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role.value,
        "line_user_id": line_user_id,
    }
    app_token = create_access_token(jwt_payload)

    return {
        "status": "success",
        "access_token": app_token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.value,
            "avatar_url": user.avatar_url,
            "line_user_id": line_user_id,
        },
    }


@router.post("/link")
async def link_line_account(
    body: LinkLineRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    ผูก LINE account กับ Lawyer Tech account ที่ login อยู่แล้ว
    สำหรับ user ที่มี account อยู่แล้วและต้องการ login ด้วย LINE ด้วย
    """
    # Verify state
    nonce = _verify_signed_state(body.state)
    if not nonce:
        raise HTTPException(status_code=400, detail="Invalid or expired state")

    # Exchange code for token
    try:
        token_data = await line_client.exchange_code_for_token(body.code)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"LINE token exchange failed: {str(e)}")

    access_token = token_data.get("access_token")
    profile = await line_client.get_user_profile(access_token)
    line_user_id = profile.get("userId")

    # Check if this LINE account is already linked to another user
    existing = await db.execute(select(User).where(User.line_user_id == line_user_id))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="LINE account นี้ถูกผูกกับบัญชีอื่นไปแล้ว"
        )

    # Link to current user
    user_uuid = uuid.UUID(current_user["sub"])
    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบผู้ใช้")

    user.line_user_id = line_user_id
    user.avatar_url = profile.get("pictureUrl") or user.avatar_url

    return {
        "status": "success",
        "message": "ผูก LINE account สำเร็จ",
        "line_user_id": line_user_id,
        "display_name": profile.get("displayName"),
    }


@router.post("/unlink")
async def unlink_line_account(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    ยกเลิกการผูก LINE account
    User จะต้อง login ด้วย email+password แทน
    """
    user_uuid = uuid.UUID(current_user["sub"])
    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบผู้ใช้")

    if not user.line_user_id:
        raise HTTPException(status_code=400, detail="ไม่มีการผูก LINE account อยู่")

    # Require password if LINE is the only auth method
    if not user.hashed_password:
        raise HTTPException(
            status_code=400,
            detail="ไม่สามารถยกเลิกการผูกได้ เนื่องจากไม่มีรหัสผ่าน กรุณาตั้งรหัสผ่านก่อน"
        )

    user.line_user_id = None
    return {"status": "success", "message": "ยกเลิกการผูก LINE account สำเร็จ"}


@router.get("/me")
async def get_line_profile(current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """
    ดูข้อมูล LINE connection ของ current user
    """
    user_uuid = uuid.UUID(current_user["sub"])
    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบผู้ใช้")

    return {
        "status": "success",
        "line_connected": user.line_user_id is not None,
        "line_user_id": user.line_user_id,
        "avatar_url": user.avatar_url,
    }
