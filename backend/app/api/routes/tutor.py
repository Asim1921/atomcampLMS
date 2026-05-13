from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.ai import TutorChatRequest
from app.services.tutor import stream_tutor_reply

router = APIRouter()


@router.post("/tutor/chat")
async def tutor_chat(body: TutorChatRequest, db: Session = Depends(get_db)):
    gen = stream_tutor_reply(db, body.learner_id, body.message)

    async def byte_stream():
        async for chunk in gen:
            yield chunk.encode("utf-8")

    return StreamingResponse(byte_stream(), media_type="text/plain; charset=utf-8")
