"""Avatar upload + course favorites (authenticated)."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.api.routes.auth import _user_out, get_current_user
from app.api.routes.courses import _course_summary, _owner_name_map
from app.core.config import settings
from app.db.models import Course, Favorite, User
from app.db.session import get_db
from app.schemas.auth import UserOut
from app.schemas.courses import CourseSummary

router = APIRouter()

_CONTENT_TO_EXT = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
}


@router.post("/avatar", response_model=UserOut)
async def upload_avatar(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    file: UploadFile = File(...),
):
    ct = (file.content_type or "").split(";")[0].strip().lower()
    ext = _CONTENT_TO_EXT.get(ct)
    if not ext:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Use PNG, JPEG, or WebP.",
        )
    data = await file.read()
    if len(data) > 2 * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Max file size is 2 MB.")

    dest = Path(settings.uploads_dir)
    dest.mkdir(parents=True, exist_ok=True)
    fn = f"{user.id}.{ext}"
    (dest / fn).write_bytes(data)
    base = str(request.base_url).rstrip("/")
    user.avatar_url = f"{base}/uploads/{fn}"
    db.add(user)
    db.commit()
    db.refresh(user)
    return _user_out(user)


@router.get("/favorites", response_model=list[CourseSummary])
def list_favorites(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (
        db.query(Favorite)
        .filter(Favorite.user_id == user.id)
        .order_by(Favorite.created_at.desc())
        .all()
    )
    course_ids = [r.course_id for r in rows]
    if not course_ids:
        return []
    courses = db.query(Course).filter(Course.id.in_(course_ids)).all()
    by_id = {c.id: c for c in courses}
    owners = _owner_name_map(db, course_ids)
    out: list[CourseSummary] = []
    for cid in course_ids:
        c = by_id.get(cid)
        if c:
            out.append(_course_summary(db, c, owners, user.id))
    return out


@router.post("/favorites/{course_id}", status_code=status.HTTP_201_CREATED)
def add_favorite(
    course_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    c = db.get(Course, course_id)
    if not c:
        raise HTTPException(status_code=404, detail="Course not found.")
    existing = (
        db.query(Favorite)
        .filter(Favorite.user_id == user.id, Favorite.course_id == course_id)
        .first()
    )
    if existing:
        return {"ok": True}
    db.add(Favorite(user_id=user.id, course_id=course_id))
    db.commit()
    return {"ok": True}


@router.delete("/favorites/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_favorite(
    course_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = (
        db.query(Favorite)
        .filter(Favorite.user_id == user.id, Favorite.course_id == course_id)
        .first()
    )
    if row:
        db.delete(row)
        db.commit()
    return None
