from typing import Optional, List
import os
import re
import uuid
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, desc

from app.database import get_db
from app.models.media import MediaPost
from app.schemas.media import (
    MediaPostCreate,
    MediaPostUpdate,
    MediaPostResponse,
)
from app.api.deps import require_admin
from app.core.logging import logger

router = APIRouter(prefix="/media", tags=["Media & Blog"])

MEDIA_UPLOAD_DIR = "app/static/uploads/media"


def generate_slug(text: str) -> str:
    cleaned = re.sub(r"[^\w\s-]", "", text.lower()).strip()
    return re.sub(r"[-\s]+", "-", cleaned)


@router.get("/posts", response_model=List[MediaPostResponse])
async def list_media_posts(
    category: Optional[str] = None,
    search: Optional[str] = None,
    published_only: bool = True,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """
    Public and admin endpoint to list media & blog posts.
    Website passes published_only=True to view active publications.
    """
    stmt = select(MediaPost)

    if published_only:
        stmt = stmt.where(MediaPost.is_published == True)  # noqa: E712

    if category and category.lower() != "all":
        stmt = stmt.where(MediaPost.category.ilike(category))

    if search:
        search_pattern = f"%{search}%"
        stmt = stmt.where(
            or_(
                MediaPost.title.ilike(search_pattern),
                MediaPost.summary.ilike(search_pattern),
                MediaPost.content.ilike(search_pattern),
                MediaPost.author.ilike(search_pattern),
            )
        )

    stmt = stmt.order_by(desc(MediaPost.published_at), desc(MediaPost.created_at))
    stmt = stmt.offset(offset).limit(limit)

    result = await db.execute(stmt)
    posts = result.scalars().all()
    return [MediaPostResponse.model_validate(p) for p in posts]


@router.get("/posts/{slug_or_id}", response_model=MediaPostResponse)
async def get_media_post(
    slug_or_id: str,
    increment_view: bool = True,
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve an individual media post by its unique URL slug or UUID.
    Increments page view count by default.
    """
    post: Optional[MediaPost] = None

    # Check if slug_or_id is a valid UUID
    try:
        val_uuid = UUID(slug_or_id)
        stmt = select(MediaPost).where(MediaPost.id == val_uuid)
        res = await db.execute(stmt)
        post = res.scalar_one_or_none()
    except (ValueError, AttributeError):
        pass

    # If not found by UUID, query by slug
    if not post:
        stmt = select(MediaPost).where(MediaPost.slug == slug_or_id)
        res = await db.execute(stmt)
        post = res.scalar_one_or_none()

    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media post not found",
        )

    if increment_view:
        post.views_count = (post.views_count or 0) + 1
        await db.commit()
        await db.refresh(post)

    return MediaPostResponse.model_validate(post)


@router.post("/posts", response_model=MediaPostResponse, status_code=status.HTTP_201_CREATED)
async def create_media_post(
    payload: MediaPostCreate,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    """
    Admin: Publish a new media post / blog article.
    """
    slug = payload.slug.strip() if payload.slug else generate_slug(payload.title)
    if not slug:
        slug = f"post-{uuid.uuid4().hex[:8]}"

    # Ensure slug uniqueness
    stmt = select(MediaPost).where(MediaPost.slug == slug)
    res = await db.execute(stmt)
    if res.scalar_one_or_none():
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"

    post_data = payload.model_dump()
    post_data["slug"] = slug
    if not post_data.get("published_at"):
        post_data["published_at"] = datetime.utcnow()

    post = MediaPost(**post_data)
    db.add(post)
    await db.commit()
    await db.refresh(post)

    logger.info("media_post_created", id=str(post.id), slug=post.slug, title=post.title)
    return MediaPostResponse.model_validate(post)


@router.put("/posts/{post_id}", response_model=MediaPostResponse)
async def update_media_post(
    post_id: UUID,
    payload: MediaPostUpdate,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    """
    Admin: Update existing media post details.
    """
    stmt = select(MediaPost).where(MediaPost.id == post_id)
    res = await db.execute(stmt)
    post = res.scalar_one_or_none()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media post not found",
        )

    update_dict = payload.model_dump(exclude_unset=True)

    # Check slug conflict if slug is updated
    if "slug" in update_dict and update_dict["slug"]:
        new_slug = generate_slug(update_dict["slug"])
        slug_stmt = select(MediaPost).where(MediaPost.slug == new_slug, MediaPost.id != post_id)
        slug_res = await db.execute(slug_stmt)
        if slug_res.scalar_one_or_none():
            new_slug = f"{new_slug}-{uuid.uuid4().hex[:4]}"
        update_dict["slug"] = new_slug

    for key, value in update_dict.items():
        setattr(post, key, value)

    post.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(post)

    logger.info("media_post_updated", id=str(post.id), title=post.title)
    return MediaPostResponse.model_validate(post)


@router.patch("/posts/{post_id}/toggle-publish", response_model=MediaPostResponse)
async def toggle_media_publish_status(
    post_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    """
    Admin: 1-click toggle between published and draft status.
    """
    stmt = select(MediaPost).where(MediaPost.id == post_id)
    res = await db.execute(stmt)
    post = res.scalar_one_or_none()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media post not found",
        )

    post.is_published = not post.is_published
    post.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(post)

    logger.info("media_post_publish_toggled", id=str(post.id), is_published=post.is_published)
    return MediaPostResponse.model_validate(post)


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_media_post(
    post_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    """
    Admin: Permanently delete a media post.
    """
    stmt = select(MediaPost).where(MediaPost.id == post_id)
    res = await db.execute(stmt)
    post = res.scalar_one_or_none()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media post not found",
        )

    await db.delete(post)
    await db.commit()
    logger.info("media_post_deleted", id=str(post_id))
    return None


@router.post("/upload")
async def upload_media_image(
    file: UploadFile = File(...),
    admin: dict = Depends(require_admin),
):
    """
    Admin: Upload article featured banner / media photos.
    Saves to /static/uploads/media and returns public URL path.
    """
    os.makedirs(MEDIA_UPLOAD_DIR, exist_ok=True)

    allowed_exts = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported image extension '{ext}'. Allowed: {', '.join(allowed_exts)}",
        )

    file_id = uuid.uuid4().hex
    saved_filename = f"{file_id}{ext}"
    dest_path = os.path.join(MEDIA_UPLOAD_DIR, saved_filename)

    contents = await file.read()
    with open(dest_path, "wb") as f:
        f.write(contents)

    public_url = f"/static/uploads/media/{saved_filename}"
    return {
        "url": public_url,
        "filename": saved_filename,
        "size": len(contents),
    }
