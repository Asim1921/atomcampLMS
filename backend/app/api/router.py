from fastapi import APIRouter

from app.api.routes import admin, auth, courses, instructor, learners, onboarding, profile, status, tutor

api_router = APIRouter()
api_router.include_router(status.router, prefix="/api", tags=["status"])
api_router.include_router(auth.router, prefix="/api/auth", tags=["auth"])
api_router.include_router(profile.router, prefix="/api/profile", tags=["profile"])
api_router.include_router(onboarding.router, prefix="/api/onboarding", tags=["onboarding"])
api_router.include_router(learners.router, prefix="/api", tags=["learners"])
api_router.include_router(courses.router, prefix="/api", tags=["courses"])
api_router.include_router(tutor.router, prefix="/api", tags=["tutor"])
api_router.include_router(instructor.router, prefix="/api/instructor", tags=["instructor"])
api_router.include_router(admin.router, prefix="/api/admin", tags=["admin"])
