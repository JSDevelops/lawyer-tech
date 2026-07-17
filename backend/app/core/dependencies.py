"""Tenant-aware FastAPI Dependencies for Multi-tenant Data Isolation"""

import uuid
from typing import Optional
from fastapi import Depends, HTTPException, status

from app.core.security import get_current_user


async def get_tenant_id(current_user: dict = Depends(get_current_user)) -> Optional[uuid.UUID]:
    """
    Extract tenant_id from JWT payload.
    Returns None for SuperAdmin users (they can see all data).
    Returns UUID for normal firm users.
    """
    role = current_user.get("role", "")
    if role == "superadmin":
        return None  # SuperAdmin bypasses tenant filtering
    
    tid = current_user.get("tenant_id")
    if not tid:
        return None
    
    try:
        return uuid.UUID(str(tid))
    except (ValueError, AttributeError):
        return None


async def require_tenant(current_user: dict = Depends(get_current_user)) -> uuid.UUID:
    """
    Like get_tenant_id but raises 403 if there is no tenant_id.
    Use this on endpoints that MUST be tenant-scoped.
    SuperAdmin is exempt.
    """
    role = current_user.get("role", "")
    if role == "superadmin":
        # SuperAdmin can pass, but return a sentinel; caller should handle None
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SuperAdmin ไม่สามารถดำเนินการนี้ได้โดยตรง"
        )

    tid = current_user.get("tenant_id")
    if not tid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ไม่สามารถระบุสำนักงาน กรุณาติดต่อผู้ดูแลระบบ"
        )
    try:
        return uuid.UUID(str(tid))
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="tenant_id ไม่ถูกต้อง"
        )


def build_tenant_filter(model, tenant_id: Optional[uuid.UUID]):
    """
    Return a list of SQLAlchemy WHERE conditions for tenant isolation.
    If tenant_id is None (SuperAdmin), returns empty list (no filter).
    Otherwise filters by tenant_id = tenant_id OR tenant_id IS NULL (legacy rows).
    """
    from sqlalchemy import or_
    if tenant_id is None:
        return []  # SuperAdmin: no restriction
    return [or_(model.tenant_id == tenant_id, model.tenant_id.is_(None))]
