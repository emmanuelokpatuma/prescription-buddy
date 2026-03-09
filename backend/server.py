from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'vitality-medication-app-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Resend for email
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')

# Create the main app
app = FastAPI(title="Vitality - Medication Reminder API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# =============================================================================
# MODELS
# =============================================================================

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "patient"  # patient or caregiver

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    role: str
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class MedicationCreate(BaseModel):
    name: str
    dosage: str
    frequency: str  # daily, twice_daily, three_times_daily, weekly
    times: List[str]  # ["08:00", "12:00", "18:00"]
    pill_color: str = "#4F46E5"
    pill_shape: str = "round"  # round, oval, capsule, square
    instructions: str = ""
    refill_reminder: bool = True
    total_pills: int = 30
    pills_remaining: int = 30
    start_date: str = ""
    end_date: str = ""

class MedicationUpdate(BaseModel):
    name: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    times: Optional[List[str]] = None
    pill_color: Optional[str] = None
    pill_shape: Optional[str] = None
    instructions: Optional[str] = None
    refill_reminder: Optional[bool] = None
    total_pills: Optional[int] = None
    pills_remaining: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class MedicationResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    medication_id: str
    user_id: str
    name: str
    dosage: str
    frequency: str
    times: List[str]
    pill_color: str
    pill_shape: str
    instructions: str
    refill_reminder: bool
    total_pills: int
    pills_remaining: int
    start_date: str
    end_date: str
    created_at: str
    updated_at: str

class MedicationLogCreate(BaseModel):
    medication_id: str
    scheduled_time: str
    status: str  # taken, missed, skipped
    notes: str = ""

class MedicationLogResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    log_id: str
    user_id: str
    medication_id: str
    medication_name: str
    dosage: str
    scheduled_time: str
    actual_time: str
    status: str
    notes: str
    date: str

class CaregiverLinkCreate(BaseModel):
    patient_email: EmailStr

class CaregiverLinkResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    link_id: str
    caregiver_id: str
    caregiver_name: str
    caregiver_email: str
    patient_id: str
    patient_name: str
    patient_email: str
    status: str
    created_at: str

class DailyScheduleResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    date: str
    medications: List[dict]
    stats: dict

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_time_period(time_str: str) -> str:
    """Get time period (morning, afternoon, evening) from time string"""
    try:
        hour = int(time_str.split(":")[0])
        if 5 <= hour < 12:
            return "morning"
        elif 12 <= hour < 17:
            return "afternoon"
        else:
            return "evening"
    except:
        return "morning"

async def send_caregiver_alert(caregiver_email: str, patient_name: str, medication_name: str, scheduled_time: str):
    """Send email alert to caregiver when medication is missed"""
    if not RESEND_API_KEY:
        logger.warning("Resend API key not configured - skipping email")
        return
    
    try:
        import resend
        resend.api_key = RESEND_API_KEY
        
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #EF4444;">Missed Medication Alert</h2>
            <p style="font-size: 16px; color: #1C1917;">
                <strong>{patient_name}</strong> missed their scheduled medication.
            </p>
            <div style="background-color: #FEF2F2; border-left: 4px solid #EF4444; padding: 16px; margin: 20px 0;">
                <p style="margin: 0; font-size: 18px;"><strong>Medication:</strong> {medication_name}</p>
                <p style="margin: 8px 0 0 0; font-size: 16px;"><strong>Scheduled Time:</strong> {scheduled_time}</p>
            </div>
            <p style="color: #57534E; font-size: 14px;">
                This alert was sent by Vitality Medication Reminder.
            </p>
        </div>
        """
        
        params = {
            "from": SENDER_EMAIL,
            "to": [caregiver_email],
            "subject": f"Missed Medication Alert: {patient_name}",
            "html": html_content
        }
        
        await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Sent caregiver alert to {caregiver_email}")
    except Exception as e:
        logger.error(f"Failed to send caregiver alert: {e}")

# =============================================================================
# AUTH ENDPOINTS
# =============================================================================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserRegister):
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    user_doc = {
        "user_id": user_id,
        "email": user_data.email,
        "password_hash": hash_password(user_data.password),
        "name": user_data.name,
        "role": user_data.role,
        "created_at": now,
        "updated_at": now
    }
    
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id, user_data.email)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            user_id=user_id,
            email=user_data.email,
            name=user_data.name,
            role=user_data.role,
            created_at=now
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(login_data: UserLogin):
    user = await db.users.find_one({"email": login_data.email}, {"_id": 0})
    if not user or not verify_password(login_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_token(user["user_id"], user["email"])
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            user_id=user["user_id"],
            email=user["email"],
            name=user["name"],
            role=user["role"],
            created_at=user["created_at"]
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        user_id=current_user["user_id"],
        email=current_user["email"],
        name=current_user["name"],
        role=current_user["role"],
        created_at=current_user["created_at"]
    )

# =============================================================================
# MEDICATION ENDPOINTS
# =============================================================================

@api_router.post("/medications", response_model=MedicationResponse)
async def create_medication(med_data: MedicationCreate, current_user: dict = Depends(get_current_user)):
    medication_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    med_doc = {
        "medication_id": medication_id,
        "user_id": current_user["user_id"],
        "name": med_data.name,
        "dosage": med_data.dosage,
        "frequency": med_data.frequency,
        "times": med_data.times,
        "pill_color": med_data.pill_color,
        "pill_shape": med_data.pill_shape,
        "instructions": med_data.instructions,
        "refill_reminder": med_data.refill_reminder,
        "total_pills": med_data.total_pills,
        "pills_remaining": med_data.pills_remaining,
        "start_date": med_data.start_date or now[:10],
        "end_date": med_data.end_date,
        "created_at": now,
        "updated_at": now
    }
    
    await db.medications.insert_one(med_doc)
    
    return MedicationResponse(**med_doc)

@api_router.get("/medications", response_model=List[MedicationResponse])
async def get_medications(current_user: dict = Depends(get_current_user)):
    medications = await db.medications.find(
        {"user_id": current_user["user_id"]}, 
        {"_id": 0}
    ).to_list(100)
    
    return [MedicationResponse(**med) for med in medications]

@api_router.get("/medications/{medication_id}", response_model=MedicationResponse)
async def get_medication(medication_id: str, current_user: dict = Depends(get_current_user)):
    medication = await db.medications.find_one(
        {"medication_id": medication_id, "user_id": current_user["user_id"]},
        {"_id": 0}
    )
    
    if not medication:
        raise HTTPException(status_code=404, detail="Medication not found")
    
    return MedicationResponse(**medication)

@api_router.put("/medications/{medication_id}", response_model=MedicationResponse)
async def update_medication(
    medication_id: str, 
    med_data: MedicationUpdate,
    current_user: dict = Depends(get_current_user)
):
    medication = await db.medications.find_one(
        {"medication_id": medication_id, "user_id": current_user["user_id"]},
        {"_id": 0}
    )
    
    if not medication:
        raise HTTPException(status_code=404, detail="Medication not found")
    
    update_data = {k: v for k, v in med_data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.medications.update_one(
        {"medication_id": medication_id},
        {"$set": update_data}
    )
    
    updated = await db.medications.find_one({"medication_id": medication_id}, {"_id": 0})
    return MedicationResponse(**updated)

@api_router.delete("/medications/{medication_id}")
async def delete_medication(medication_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.medications.delete_one(
        {"medication_id": medication_id, "user_id": current_user["user_id"]}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Medication not found")
    
    # Also delete related logs
    await db.medication_logs.delete_many({"medication_id": medication_id})
    
    return {"message": "Medication deleted successfully"}

# =============================================================================
# MEDICATION LOG ENDPOINTS
# =============================================================================

@api_router.post("/medications/log", response_model=MedicationLogResponse)
async def log_medication(log_data: MedicationLogCreate, current_user: dict = Depends(get_current_user)):
    # Get medication details
    medication = await db.medications.find_one(
        {"medication_id": log_data.medication_id, "user_id": current_user["user_id"]},
        {"_id": 0}
    )
    
    if not medication:
        raise HTTPException(status_code=404, detail="Medication not found")
    
    log_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    log_doc = {
        "log_id": log_id,
        "user_id": current_user["user_id"],
        "medication_id": log_data.medication_id,
        "medication_name": medication["name"],
        "dosage": medication["dosage"],
        "scheduled_time": log_data.scheduled_time,
        "actual_time": now.isoformat(),
        "status": log_data.status,
        "notes": log_data.notes,
        "date": now.strftime("%Y-%m-%d")
    }
    
    await db.medication_logs.insert_one(log_doc)
    
    # Update pills remaining if taken
    if log_data.status == "taken":
        new_remaining = max(0, medication["pills_remaining"] - 1)
        await db.medications.update_one(
            {"medication_id": log_data.medication_id},
            {"$set": {"pills_remaining": new_remaining}}
        )
    
    # Send caregiver alert if missed
    if log_data.status == "missed":
        # Find caregivers linked to this patient
        caregiver_links = await db.caregiver_links.find(
            {"patient_id": current_user["user_id"], "status": "active"},
            {"_id": 0}
        ).to_list(10)
        
        for link in caregiver_links:
            await send_caregiver_alert(
                link["caregiver_email"],
                current_user["name"],
                medication["name"],
                log_data.scheduled_time
            )
    
    return MedicationLogResponse(**log_doc)

@api_router.get("/medications/history/{date}", response_model=List[MedicationLogResponse])
async def get_medication_history(date: str, current_user: dict = Depends(get_current_user)):
    logs = await db.medication_logs.find(
        {"user_id": current_user["user_id"], "date": date},
        {"_id": 0}
    ).to_list(100)
    
    return [MedicationLogResponse(**log) for log in logs]

@api_router.get("/medications/history", response_model=List[MedicationLogResponse])
async def get_all_history(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    logs = await db.medication_logs.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).sort("actual_time", -1).to_list(limit)
    
    return [MedicationLogResponse(**log) for log in logs]

# =============================================================================
# DAILY SCHEDULE ENDPOINT
# =============================================================================

@api_router.get("/schedule/{date}", response_model=DailyScheduleResponse)
async def get_daily_schedule(date: str, current_user: dict = Depends(get_current_user)):
    # Get all active medications
    medications = await db.medications.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).to_list(100)
    
    # Get logs for the date
    logs = await db.medication_logs.find(
        {"user_id": current_user["user_id"], "date": date},
        {"_id": 0}
    ).to_list(100)
    
    # Create a map of logged medications
    logged_map = {}
    for log in logs:
        key = f"{log['medication_id']}_{log['scheduled_time']}"
        logged_map[key] = log
    
    # Build schedule
    schedule_items = []
    for med in medications:
        for time in med["times"]:
            key = f"{med['medication_id']}_{time}"
            log_entry = logged_map.get(key)
            
            schedule_items.append({
                "medication_id": med["medication_id"],
                "name": med["name"],
                "dosage": med["dosage"],
                "time": time,
                "period": get_time_period(time),
                "pill_color": med["pill_color"],
                "pill_shape": med["pill_shape"],
                "instructions": med["instructions"],
                "pills_remaining": med["pills_remaining"],
                "refill_warning": med["pills_remaining"] <= 7 and med["refill_reminder"],
                "status": log_entry["status"] if log_entry else "pending",
                "logged_at": log_entry["actual_time"] if log_entry else None
            })
    
    # Sort by time
    schedule_items.sort(key=lambda x: x["time"])
    
    # Calculate stats
    taken = sum(1 for item in schedule_items if item["status"] == "taken")
    missed = sum(1 for item in schedule_items if item["status"] == "missed")
    pending = sum(1 for item in schedule_items if item["status"] == "pending")
    
    return DailyScheduleResponse(
        date=date,
        medications=schedule_items,
        stats={
            "total": len(schedule_items),
            "taken": taken,
            "missed": missed,
            "pending": pending,
            "adherence_rate": round(taken / len(schedule_items) * 100, 1) if schedule_items else 0
        }
    )

# =============================================================================
# CAREGIVER ENDPOINTS
# =============================================================================

@api_router.post("/caregivers/link", response_model=CaregiverLinkResponse)
async def link_patient(link_data: CaregiverLinkCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "caregiver":
        raise HTTPException(status_code=403, detail="Only caregivers can link patients")
    
    # Find patient by email
    patient = await db.users.find_one({"email": link_data.patient_email}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found. They need to register first.")
    
    if patient["role"] != "patient":
        raise HTTPException(status_code=400, detail="User is not registered as a patient")
    
    # Check if link already exists
    existing = await db.caregiver_links.find_one({
        "caregiver_id": current_user["user_id"],
        "patient_id": patient["user_id"]
    }, {"_id": 0})
    
    if existing:
        raise HTTPException(status_code=400, detail="Link already exists")
    
    link_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    link_doc = {
        "link_id": link_id,
        "caregiver_id": current_user["user_id"],
        "caregiver_name": current_user["name"],
        "caregiver_email": current_user["email"],
        "patient_id": patient["user_id"],
        "patient_name": patient["name"],
        "patient_email": patient["email"],
        "status": "active",
        "created_at": now
    }
    
    await db.caregiver_links.insert_one(link_doc)
    
    return CaregiverLinkResponse(**link_doc)

@api_router.get("/caregivers/patients", response_model=List[CaregiverLinkResponse])
async def get_linked_patients(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "caregiver":
        raise HTTPException(status_code=403, detail="Only caregivers can view linked patients")
    
    links = await db.caregiver_links.find(
        {"caregiver_id": current_user["user_id"]},
        {"_id": 0}
    ).to_list(50)
    
    return [CaregiverLinkResponse(**link) for link in links]

@api_router.get("/caregivers/patient/{patient_id}/schedule/{date}")
async def get_patient_schedule(
    patient_id: str,
    date: str,
    current_user: dict = Depends(get_current_user)
):
    # Verify caregiver has access
    link = await db.caregiver_links.find_one({
        "caregiver_id": current_user["user_id"],
        "patient_id": patient_id,
        "status": "active"
    }, {"_id": 0})
    
    if not link:
        raise HTTPException(status_code=403, detail="Not authorized to view this patient")
    
    # Get patient's medications
    medications = await db.medications.find(
        {"user_id": patient_id},
        {"_id": 0}
    ).to_list(100)
    
    # Get logs for the date
    logs = await db.medication_logs.find(
        {"user_id": patient_id, "date": date},
        {"_id": 0}
    ).to_list(100)
    
    logged_map = {}
    for log in logs:
        key = f"{log['medication_id']}_{log['scheduled_time']}"
        logged_map[key] = log
    
    schedule_items = []
    for med in medications:
        for time in med["times"]:
            key = f"{med['medication_id']}_{time}"
            log_entry = logged_map.get(key)
            
            schedule_items.append({
                "medication_id": med["medication_id"],
                "name": med["name"],
                "dosage": med["dosage"],
                "time": time,
                "period": get_time_period(time),
                "pill_color": med["pill_color"],
                "status": log_entry["status"] if log_entry else "pending"
            })
    
    schedule_items.sort(key=lambda x: x["time"])
    
    taken = sum(1 for item in schedule_items if item["status"] == "taken")
    
    return {
        "patient_name": link["patient_name"],
        "date": date,
        "medications": schedule_items,
        "stats": {
            "total": len(schedule_items),
            "taken": taken,
            "adherence_rate": round(taken / len(schedule_items) * 100, 1) if schedule_items else 0
        }
    }

@api_router.delete("/caregivers/unlink/{link_id}")
async def unlink_patient(link_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.caregiver_links.delete_one({
        "link_id": link_id,
        "caregiver_id": current_user["user_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Link not found")
    
    return {"message": "Patient unlinked successfully"}

# =============================================================================
# EMERGENCY LIST ENDPOINT
# =============================================================================

@api_router.get("/emergency-list")
async def get_emergency_list(current_user: dict = Depends(get_current_user)):
    medications = await db.medications.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).to_list(100)
    
    emergency_list = []
    for med in medications:
        emergency_list.append({
            "name": med["name"],
            "dosage": med["dosage"],
            "frequency": med["frequency"],
            "times": med["times"],
            "instructions": med["instructions"]
        })
    
    return {
        "user_name": current_user["name"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "medications": emergency_list
    }

# =============================================================================
# STATS ENDPOINT
# =============================================================================

@api_router.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    # Get medication count
    med_count = await db.medications.count_documents({"user_id": current_user["user_id"]})
    
    # Get today's date
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get today's logs
    today_logs = await db.medication_logs.find(
        {"user_id": current_user["user_id"], "date": today},
        {"_id": 0}
    ).to_list(100)
    
    taken_today = sum(1 for log in today_logs if log["status"] == "taken")
    missed_today = sum(1 for log in today_logs if log["status"] == "missed")
    
    # Get medications needing refill
    low_stock = await db.medications.count_documents({
        "user_id": current_user["user_id"],
        "pills_remaining": {"$lte": 7},
        "refill_reminder": True
    })
    
    # Get 7-day adherence
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
    week_logs = await db.medication_logs.find(
        {"user_id": current_user["user_id"], "date": {"$gte": week_ago}},
        {"_id": 0}
    ).to_list(500)
    
    week_taken = sum(1 for log in week_logs if log["status"] == "taken")
    week_total = len(week_logs)
    
    return {
        "total_medications": med_count,
        "taken_today": taken_today,
        "missed_today": missed_today,
        "low_stock_count": low_stock,
        "weekly_adherence": round(week_taken / week_total * 100, 1) if week_total else 0,
        "streak_days": 0  # Can be implemented later
    }

# =============================================================================
# ROOT & HEALTH
# =============================================================================

@api_router.get("/")
async def root():
    return {"message": "Vitality Medication Reminder API", "version": "1.0.0"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# Include router
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
