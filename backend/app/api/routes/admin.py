from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.admin_insights import build_admin_payload

router = APIRouter()


@router.get("/summary")
async def admin_summary(db: Session = Depends(get_db)):
    return await build_admin_payload(db)
