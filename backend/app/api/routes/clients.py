"""Clients Routes — CRM, KYC, Contact Management"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
import uuid

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.dependencies import get_tenant_id, build_tenant_filter
from app.models.models import Client

router = APIRouter()


class ClientCreate(BaseModel):
    full_name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    id_card: Optional[str] = None
    address: Optional[str] = None
    line_id: Optional[str] = None
    service_type: str = "free"
    kyc_status: str = "pending"
    occupation: Optional[str] = None
    company: Optional[str] = None
    notes: Optional[str] = None
    tags: List[str] = []


class ClientUpdate(ClientCreate):
    pass


def generate_client_code():
    return f"CLT-{str(uuid.uuid4())[:8].upper()}"


@router.get("/")
async def list_clients(
    search: Optional[str] = Query(None),
    service_type: Optional[str] = Query(None),
    kyc_status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    tenant_id=Depends(get_tenant_id),
):
    """รายชื่อลูกความทั้งหมด"""
    tenant_filters = build_tenant_filter(Client, tenant_id)
    query = select(Client).where(Client.is_active == True, *tenant_filters)
    
    if search:
        query = query.where(
            or_(
                Client.full_name.ilike(f"%{search}%"),
                Client.phone.ilike(f"%{search}%"),
                Client.email.ilike(f"%{search}%"),
            )
        )
    if service_type:
        query = query.where(Client.service_type == service_type)
    if kyc_status:
        query = query.where(Client.kyc_status == kyc_status)
    
    # Sort by created_at desc to show newest first
    query = query.order_by(Client.created_at.desc())
    
    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar()
    
    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    clients = result.scalars().all()
    
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "data": [
            {
                "id": str(c.id),
                "client_code": c.client_code,
                "full_name": c.full_name,
                "phone": c.phone,
                "email": c.email,
                "service_type": c.service_type,
                "kyc_status": c.kyc_status,
                "occupation": c.occupation,
                "company": c.company,
                "tags": c.tags,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in clients
        ]
    }


@router.post("/")
async def create_client(
    request: ClientCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    tenant_id=Depends(get_tenant_id),
):
    """เพิ่มลูกความใหม่"""
    client = Client(
        client_code=generate_client_code(),
        tenant_id=tenant_id,
        **request.model_dump()
    )
    db.add(client)
    await db.flush()
    return {"status": "success", "id": str(client.id), "client_code": client.client_code}


@router.get("/{client_id}")
async def get_client(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    tenant_id=Depends(get_tenant_id),
):
    """ดูรายละเอียดลูกความ"""
    try:
        client_uuid = uuid.UUID(client_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="ไม่พบลูกความ")
    tenant_filters = build_tenant_filter(Client, tenant_id)
    result = await db.execute(select(Client).where(Client.id == client_uuid, *tenant_filters))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="ไม่พบลูกความ")
    return {
        "id": str(client.id),
        "client_code": client.client_code,
        "full_name": client.full_name,
        "id_card": client.id_card,
        "phone": client.phone,
        "email": client.email,
        "address": client.address,
        "line_id": client.line_id,
        "service_type": client.service_type,
        "kyc_status": client.kyc_status,
        "occupation": client.occupation,
        "company": client.company,
        "tags": client.tags,
        "notes": client.notes,
        "created_at": client.created_at.isoformat() if client.created_at else None,
    }


@router.put("/{client_id}")
async def update_client(
    client_id: str,
    request: ClientUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    tenant_id=Depends(get_tenant_id),
):
    """แก้ไขข้อมูลลูกความ"""
    try:
        client_uuid = uuid.UUID(client_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="ไม่พบลูกความ")
    tenant_filters = build_tenant_filter(Client, tenant_id)
    result = await db.execute(select(Client).where(Client.id == client_uuid, *tenant_filters))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="ไม่พบลูกความ")
    
    update_data = request.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(client, key, value)
    
    return {
        "id": str(client.id),
        "full_name": client.full_name,
        "phone": client.phone,
        "email": client.email,
        "service_type": client.service_type,
        "kyc_status": client.kyc_status,
        "notes": client.notes,
        "tags": client.tags,
    }


@router.patch("/{client_id}/kyc")
async def update_client_kyc(
    client_id: str,
    kyc_status: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    tenant_id=Depends(get_tenant_id),
):
    """อัปเดตสถานะ KYC"""
    try:
        client_uuid = uuid.UUID(client_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="ไม่พบลูกความ")
    tenant_filters = build_tenant_filter(Client, tenant_id)
    result = await db.execute(select(Client).where(Client.id == client_uuid, *tenant_filters))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="ไม่พบลูกความ")
    client.kyc_status = kyc_status
    return {"status": "success", "message": "อัปเดตสถานะ KYC สำเร็จ"}


@router.delete("/{client_id}")
async def delete_client(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    tenant_id=Depends(get_tenant_id),
):
    """ลบลูกความ (Soft Delete)"""
    try:
        client_uuid = uuid.UUID(client_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="ไม่พบลูกความ")
    tenant_filters = build_tenant_filter(Client, tenant_id)
    result = await db.execute(select(Client).where(Client.id == client_uuid, *tenant_filters))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="ไม่พบลูกความ")
    client.is_active = False
    return {"status": "success", "message": "ลบลูกความสำเร็จ"}
