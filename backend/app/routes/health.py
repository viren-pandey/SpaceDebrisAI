from fastapi import APIRouter

router = APIRouter()

@router.get("/health")
def health():
    return {"status": "Your Backend is Successfully Running On The Server"}
