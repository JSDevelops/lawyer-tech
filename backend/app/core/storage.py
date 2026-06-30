"""
storage.py — Unified Cloud Storage Module
==========================================
Primary:  Google Cloud Storage (GCS)
Fallback: Local filesystem (development/serverless)

Usage:
    from app.core.storage import storage

    # Upload
    result = await storage.upload(file_bytes, filename, content_type)
    # result = {"key": "documents/...", "url": "https://...", "backend": "gcs"}

    # Download URL (signed URL for GCS, local path for filesystem)
    url = await storage.get_signed_url(key, expiry_seconds=3600)

    # Delete
    await storage.delete(key)

Configuration (via .env):
    GCS_BUCKET_NAME                    GCS bucket name
    GOOGLE_APPLICATION_CREDENTIALS    Path to service account JSON key

Notes:
    - If GCS credentials are missing, falls back to local filesystem automatically
    - Signed URLs expire after `expiry_seconds` (default: 1 hour)
    - All file keys use a structured path: documents/{year}/{month}/{uuid}_{filename}
"""

import os
import uuid
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


# ==========================================
# Local Filesystem Storage (Fallback)
# ==========================================

class LocalStorage:
    """Local filesystem storage — สำหรับ development หรือเมื่อ GCS ไม่พร้อม"""

    def __init__(self, base_dir: str = "uploads"):
        self.base_dir = base_dir
        try:
            os.makedirs(base_dir, exist_ok=True)
        except Exception:
            self.base_dir = "/tmp/uploads"
            os.makedirs(self.base_dir, exist_ok=True)

    def _build_key(self, filename: str) -> str:
        now = datetime.utcnow()
        file_id = str(uuid.uuid4())[:8]
        safe_name = filename.replace(" ", "_")
        return f"documents/{now.year}/{now.month:02d}/{file_id}_{safe_name}"

    async def upload(self, file_bytes: bytes, filename: str, content_type: str = "application/octet-stream") -> dict:
        key = self._build_key(filename)
        local_path = os.path.join(self.base_dir, key)
        os.makedirs(os.path.dirname(local_path), exist_ok=True)

        with open(local_path, "wb") as f:
            f.write(file_bytes)

        url = f"/uploads/{key}"
        logger.info(f"[LocalStorage] Uploaded: {key}")
        return {"key": key, "url": url, "backend": "local", "size": len(file_bytes)}

    async def get_signed_url(self, key: str, expiry_seconds: int = 3600) -> str:
        """Local storage returns a static URL (no expiry)"""
        return f"/uploads/{key}"

    async def delete(self, key: str) -> bool:
        local_path = os.path.join(self.base_dir, key)
        try:
            if os.path.exists(local_path):
                os.remove(local_path)
                logger.info(f"[LocalStorage] Deleted: {key}")
                return True
        except Exception as e:
            logger.error(f"[LocalStorage] Delete failed for {key}: {e}")
        return False

    async def exists(self, key: str) -> bool:
        return os.path.exists(os.path.join(self.base_dir, key))

    @property
    def backend_name(self) -> str:
        return "local"


# ==========================================
# Google Cloud Storage
# ==========================================

class GCSStorage:
    """
    Google Cloud Storage backend

    Requires:
        GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account JSON
        GCS_BUCKET_NAME env var with the target bucket name
    """

    def __init__(self, bucket_name: str):
        self.bucket_name = bucket_name
        self._client = None
        self._bucket = None

    def _get_client(self):
        """Lazy init GCS client"""
        if self._client is None:
            from google.cloud import storage as gcs
            self._client = gcs.Client()
            self._bucket = self._client.bucket(self.bucket_name)
        return self._client, self._bucket

    def _build_key(self, filename: str) -> str:
        now = datetime.utcnow()
        file_id = str(uuid.uuid4())[:8]
        safe_name = filename.replace(" ", "_")
        return f"documents/{now.year}/{now.month:02d}/{file_id}_{safe_name}"

    async def upload(
        self,
        file_bytes: bytes,
        filename: str,
        content_type: str = "application/octet-stream",
    ) -> dict:
        """
        Upload file to GCS bucket

        Returns:
            dict: {key, url, backend, size}
        """
        import asyncio
        from functools import partial

        key = self._build_key(filename)

        def _sync_upload():
            _, bucket = self._get_client()
            blob = bucket.blob(key)
            blob.upload_from_string(file_bytes, content_type=content_type)
            return blob.public_url

        loop = asyncio.get_event_loop()
        public_url = await loop.run_in_executor(None, _sync_upload)

        # GCS public URL (if bucket is public) or use signed URL
        gcs_url = f"https://storage.googleapis.com/{self.bucket_name}/{key}"
        logger.info(f"[GCSStorage] Uploaded: gs://{self.bucket_name}/{key}")

        return {
            "key": key,
            "url": gcs_url,
            "backend": "gcs",
            "size": len(file_bytes),
        }

    async def get_signed_url(self, key: str, expiry_seconds: int = 3600) -> str:
        """
        สร้าง Signed URL สำหรับ download ที่มีอายุจำกัด

        Args:
            key: GCS object key (path ภายใน bucket)
            expiry_seconds: อายุของ URL (default 1 ชั่วโมง)

        Returns:
            Signed URL string
        """
        import asyncio
        from functools import partial

        def _sync_sign():
            _, bucket = self._get_client()
            blob = bucket.blob(key)
            expiration = timedelta(seconds=expiry_seconds)
            signed_url = blob.generate_signed_url(
                expiration=expiration,
                method="GET",
                version="v4",
            )
            return signed_url

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _sync_sign)

    async def delete(self, key: str) -> bool:
        """ลบไฟล์จาก GCS"""
        import asyncio

        def _sync_delete():
            _, bucket = self._get_client()
            blob = bucket.blob(key)
            blob.delete()
            return True

        loop = asyncio.get_event_loop()
        try:
            result = await loop.run_in_executor(None, _sync_delete)
            logger.info(f"[GCSStorage] Deleted: {key}")
            return result
        except Exception as e:
            logger.error(f"[GCSStorage] Delete failed for {key}: {e}")
            return False

    async def exists(self, key: str) -> bool:
        """ตรวจสอบว่าไฟล์มีอยู่ใน GCS หรือไม่"""
        import asyncio

        def _sync_exists():
            _, bucket = self._get_client()
            blob = bucket.blob(key)
            return blob.exists()

        loop = asyncio.get_event_loop()
        try:
            return await loop.run_in_executor(None, _sync_exists)
        except Exception:
            return False

    @property
    def backend_name(self) -> str:
        return "gcs"


# ==========================================
# Smart Storage Factory
# ==========================================

def _create_storage():
    """
    สร้าง storage backend ที่เหมาะสมตาม environment

    Logic:
    1. ถ้ามี GCS credentials และ bucket name → ใช้ GCS
    2. ถ้าไม่มี → fallback เป็น LocalStorage
    """
    bucket_name = getattr(settings, "GCS_BUCKET_NAME", "") or os.environ.get("GCS_BUCKET_NAME", "")
    credentials_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")

    has_gcs_config = bool(bucket_name)
    has_credentials = bool(credentials_path and os.path.exists(credentials_path))

    if has_gcs_config and has_credentials:
        try:
            # Verify GCS client can be instantiated
            from google.cloud import storage as gcs
            logger.info(f"[Storage] Using GCS backend: gs://{bucket_name}")
            return GCSStorage(bucket_name=bucket_name)
        except ImportError:
            logger.warning("[Storage] google-cloud-storage not installed, falling back to local")
        except Exception as e:
            logger.warning(f"[Storage] GCS init failed ({e}), falling back to local")
    elif has_gcs_config and not has_credentials:
        # Try Application Default Credentials (works on GCP, Cloud Run, etc.)
        try:
            from google.cloud import storage as gcs
            gcs.Client()  # Test ADC
            logger.info(f"[Storage] Using GCS backend with ADC: gs://{bucket_name}")
            return GCSStorage(bucket_name=bucket_name)
        except Exception:
            pass

    logger.info("[Storage] Using LocalStorage backend (development mode)")
    return LocalStorage()


# Singleton instance — imported by documents.py and other routes
storage = _create_storage()
