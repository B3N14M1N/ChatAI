from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from backend.app.core.schemas import UserCreate, UserOut, AuthRequest, AuthResponse
from backend.app.core.db import DatabaseConnector, DatabaseHandler
from app.core import security
from typing import Optional

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# Dependency
async def get_db_handler():
    connector = DatabaseConnector()
    await connector.connect()
    await connector.init_db()
    handler = DatabaseHandler(connector)
    try:
        yield handler
    finally:
        await connector.close()

@router.post("/register", response_model=UserOut)
async def register(user: UserCreate, db: DatabaseHandler = Depends(get_db_handler)):
    existing = await db.get_user_by_email(user.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    password_hash = security.hash_password(user.password)
    user_id = await db.create_user(user.email, password_hash)
    return UserOut(id=user_id, email=user.email)

# For demonstration, a fake JWT token is returned. Replace with real JWT logic.
@router.post("/login", response_model=AuthResponse)
async def login(auth: AuthRequest, db: DatabaseHandler = Depends(get_db_handler)):
    user = await db.get_user_by_email(auth.email)
    if not user or not security.verify_password(auth.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    # Create JWT access token
    token = security.create_access_token({"sub": str(user["id"])})
    return AuthResponse(access_token=token, token_type="bearer")
@router.get("/me", response_model=UserOut)
async def read_current_user(
    token: str = Depends(oauth2_scheme),
    db_handler: DatabaseHandler = Depends(get_db_handler)
):
    try:
        payload = security.decode_access_token(token)
        user_id = int(payload.get("sub"))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )
    user = await db_handler.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut(**user)
