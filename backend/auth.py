import os
import uuid
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
import jwt

from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, col
from sqlalchemy import delete
from backend.database import engine, User, PasswordReset

router = APIRouter(prefix="/auth", tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("JWT_SECRET")
if not SECRET_KEY:
    if os.getenv("ENVIRONMENT") == "development":
        SECRET_KEY = "dev-insecure-secret-key-3f41f0a4517bec3e138e39b68d91e835"
        import logging
        logging.warning("JWT_SECRET non impostato: usando una chiave di sviluppo temporanea.")
    else:
        raise RuntimeError("CRITICAL: JWT_SECRET non configurato nelle variabili d'ambiente.")

JWT_AUDIENCE = os.getenv("JWT_AUDIENCE", "anisearch-app")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    now = datetime.now(timezone.utc)
    to_encode = data.copy()
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({
        "exp": expire,
        "iat": now,
        "aud": JWT_AUDIENCE,
    })
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

class ProfileUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    avatar_url: Optional[str] = None
    password: Optional[str] = None

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@router.post("/register", response_model=Token)
async def register(user_data: UserCreate):
    async with AsyncSession(engine) as session:
        result = await session.exec(select(User).where((User.email == user_data.email) | (User.username == user_data.username)))
        if result.first():
            raise HTTPException(status_code=400, detail="Email o Username già in uso")
        
        user_id = str(uuid.uuid4())
        hashed_pw = get_password_hash(user_data.password)
        new_user = User(
            id=user_id,
            email=user_data.email,
            username=user_data.username,
            hashed_password=hashed_pw,
            created_at=datetime.now(timezone.utc).isoformat()
        )
        session.add(new_user)
        await session.commit()
        
        saved_username = user_data.username
        saved_email = user_data.email
        
        access_token = create_access_token(data={"sub": user_id, "username": saved_username})
        return {
            "access_token": access_token, 
            "token_type": "bearer",
            "user": {"id": user_id, "username": saved_username, "email": saved_email}
        }

@router.post("/login", response_model=Token)
async def login(user_data: UserLogin):
    async with AsyncSession(engine) as session:
        result = await session.exec(select(User).where(User.email == user_data.email))
        user = result.first()
        
        if not user or not user.hashed_password:
            raise HTTPException(status_code=401, detail="Credenziali non valide")
            
        if not verify_password(user_data.password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Credenziali non valide")
            
        access_token = create_access_token(data={"sub": user.id, "username": user.username})
        return {
            "access_token": access_token, 
            "token_type": "bearer",
            "user": {"id": user.id, "username": user.username, "email": user.email, "avatar": user.avatar_url}
        }

async def get_current_user(token: str) -> Optional[User]:
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            audience=JWT_AUDIENCE,
            options={"verify_exp": True, "verify_aud": True},
        )
        user_id = payload.get("sub")
        if user_id is None:
            return None
    except jwt.PyJWTError:
        return None
        
    async with AsyncSession(engine) as session:
        result = await session.exec(select(User).where(User.id == user_id))
        user = result.first()
        return user

from fastapi import Request

@router.get("/me")
async def get_me(request: Request):
    token = request.headers.get("Authorization")
    if not token or not token.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Non autenticato")
        
    token_str = token.split(" ")[1]
    user = await get_current_user(token_str)
    if not user:
        raise HTTPException(status_code=401, detail="Utente non trovato o token non valido")
        
    return {
        "id": user.id, 
        "username": user.username, 
        "email": user.email, 
        "avatar_url": user.avatar_url,
        "google_linked": bool(user.google_id),
        "discord_linked": bool(user.discord_id),
        "mal_linked": bool(user.mal_token),
        "anilist_linked": bool(user.anilist_token)
    }

@router.put("/profile")
async def update_profile(
    profile_data: ProfileUpdate, 
    token: str = Depends(lambda req: req.headers.get("Authorization"))
):
    if not token or not token.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Non autenticato")
        
    token_str = token.split(" ")[1]
    user = await get_current_user(token_str)
    if not user:
        raise HTTPException(status_code=401, detail="Utente non trovato")
        
    async with AsyncSession(engine) as session:
        result = await session.exec(select(User).where(User.id == user.id))
        db_user = result.first()
        
        if not db_user:
            raise HTTPException(status_code=404, detail="Utente non trovato nel database")
            
        if profile_data.username:
            existing = await session.exec(select(User).where(User.username == profile_data.username, User.id != user.id))
            if existing.first():
                raise HTTPException(status_code=400, detail="Username già in uso")
            db_user.username = profile_data.username
            
        if profile_data.email:
            existing = await session.exec(select(User).where(User.email == profile_data.email, User.id != user.id))
            if existing.first():
                raise HTTPException(status_code=400, detail="Email già in uso")
            db_user.email = profile_data.email
            
        if profile_data.avatar_url is not None:
            db_user.avatar_url = profile_data.avatar_url
            
        if profile_data.password:
            db_user.hashed_password = get_password_hash(profile_data.password)
            
        session.add(db_user)
        await session.commit()
        await session.refresh(db_user)
        
        return {
            "id": db_user.id, 
            "username": db_user.username, 
            "email": db_user.email, 
            "avatar_url": db_user.avatar_url,
            "message": "Profilo aggiornato con successo"
        }


# --- Password Reset ---
@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest):
    """Generate a password-reset token. Sends email if SMTP is configured, otherwise persists to DB and returns generic message in production."""
    async with AsyncSession(engine) as session:
        result = await session.exec(select(User).where(User.email == data.email))
        user = result.first()

        # Always return 200 to avoid email enumeration
        if not user:
            return {"detail": "Se l'email esiste nel sistema, riceverai le istruzioni per il reset."}

        token = secrets.token_urlsafe(32)
        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
        reset_entry = PasswordReset(token=token, user_id=user.id, expires_at=expires_at)
        session.add(reset_entry)
        await session.commit()

    # Try SMTP if configured
    smtp_host = os.getenv("SMTP_HOST")
    if smtp_host:
        import smtplib
        from email.mime.text import MIMEText
        smtp_port = int(os.getenv("SMTP_PORT", 587))
        smtp_user = os.getenv("SMTP_USER", "")
        smtp_pass = os.getenv("SMTP_PASS", "")
        from_addr = os.getenv("SMTP_FROM", smtp_user)
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
        reset_link = f"{frontend_url}/reset-password?token={token}"
        body = (
            f"Ciao {user.username},\n\n"
            f"Hai richiesto il reset della password per il tuo account AniSearch.\n"
            f"Clicca il link seguente (valido 30 minuti):\n\n"
            f"{reset_link}\n\n"
            "Se non hai richiesto questa operazione, ignora questa email.\n\n"
            "– Il Team AniSearch"
        )
        msg = MIMEText(body)
        msg["Subject"] = "AniSearch – Reset Password"
        msg["From"] = from_addr
        msg["To"] = data.email
        try:
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                if smtp_user:
                    server.login(smtp_user, smtp_pass)
                server.sendmail(from_addr, [data.email], msg.as_string())
            return {"detail": "Email di reset inviata. Controlla la tua casella di posta.", "email_sent": True}
        except Exception:
            pass  # Fall through to fallback response

    # If in development mode and SMTP is absent, return token for local debugging
    if os.getenv("ENVIRONMENT") == "development":
        return {
            "detail": "Nessun server email configurato. Token generato (visibile solo in ENVIRONMENT=development).",
            "reset_token": token,
            "expires_in_minutes": 30,
        }

    return {"detail": "Se l'email esiste nel sistema, riceverai le istruzioni per il reset."}


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest):
    """Reset the password using a valid token stored in DB."""
    now_iso = datetime.now(timezone.utc).isoformat()
    async with AsyncSession(engine) as session:
        # Pulizia preventiva dei token scaduti
        await session.exec(delete(PasswordReset).where(PasswordReset.expires_at < now_iso))  # type: ignore

        result = await session.exec(select(PasswordReset).where(PasswordReset.token == data.token))  # type: ignore
        entry = result.first()
        if not entry:
            raise HTTPException(status_code=400, detail="Token non valido o già utilizzato.")

        if entry.expires_at < now_iso:
            await session.delete(entry)
            await session.commit()
            raise HTTPException(status_code=400, detail="Token scaduto. Richiedi un nuovo reset della password.")

        if len(data.new_password) < 6:
            raise HTTPException(status_code=400, detail="La password deve essere di almeno 6 caratteri.")

        user_result = await session.exec(select(User).where(User.id == entry.user_id))
        user = user_result.first()
        if not user:
            raise HTTPException(status_code=404, detail="Utente non trovato.")

        user.hashed_password = get_password_hash(data.new_password)
        session.add(user)
        await session.delete(entry)
        await session.commit()

    return {"detail": "Password reimpostata con successo. Puoi ora accedere con la nuova password."}


@router.get("/google/login")
async def google_login():
    return {"configured": False, "detail": "Il Social Login con Google non è ancora configurato. Inserisci i Client ID nel backend."}

@router.get("/discord/login")
async def discord_login():
    return {"configured": False, "detail": "Il Social Login con Discord non è ancora configurato. Inserisci i Client ID nel backend."}
