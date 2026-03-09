from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import io

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

# Stripe Configuration
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', '')
STRIPE_PUBLISHABLE_KEY = os.environ.get('STRIPE_PUBLISHABLE_KEY', '')

# Subscription Plans
SUBSCRIPTION_PLANS = {
    "plus": {
        "name": "Vitality Plus",
        "price": 2.99,
        "currency": "usd",
        "features": [
            "SMS reminders (50/month)",
            "Email weekly reports", 
            "Unlimited caregiver links",
            "PDF export"
        ],
        "sms_limit": 50
    }
}

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
    except (ValueError, IndexError):
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
    
    # Send caregiver alert if missed (in-app notification)
    if log_data.status == "missed":
        # Find caregivers linked to this patient
        caregiver_links = await db.caregiver_links.find(
            {"patient_id": current_user["user_id"], "status": "active"},
            {"_id": 0}
        ).to_list(10)
        
        for link in caregiver_links:
            # Create in-app notification for caregiver
            await create_caregiver_notification(
                caregiver_id=link["caregiver_id"],
                notification_type="missed_medication",
                title="Missed Medication Alert",
                message=f"{current_user['name']} missed their {medication['name']} ({medication['dosage']}) scheduled for {log_data.scheduled_time}",
                patient_name=current_user["name"]
            )
    
    return MedicationLogResponse(**log_doc)

@api_router.get("/medications/history/{date}", response_model=List[MedicationLogResponse])
async def get_medication_history(date: str, current_user: dict = Depends(get_current_user)):
    logs = await db.medication_logs.find(
        {"user_id": current_user["user_id"], "date": date},
        {"_id": 0}
    ).to_list(100)
    
    return [MedicationLogResponse(**log) for log in logs]

@api_router.get("/history", response_model=List[MedicationLogResponse])
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
# DRUG INTERACTIONS DATABASE (Common interactions - FREE local database)
# =============================================================================

DRUG_INTERACTIONS = {
    # Format: drug_name_lowercase: [(interacting_drug, severity, description)]
    "warfarin": [
        ("aspirin", "high", "Increased risk of bleeding"),
        ("ibuprofen", "high", "Increased risk of bleeding"),
        ("vitamin k", "moderate", "May reduce warfarin effectiveness"),
        ("paracetamol", "low", "High doses may increase bleeding risk"),
    ],
    "metformin": [
        ("alcohol", "moderate", "Increased risk of lactic acidosis"),
        ("contrast dye", "high", "May cause kidney problems"),
    ],
    "lisinopril": [
        ("potassium", "moderate", "May cause high potassium levels"),
        ("ibuprofen", "moderate", "May reduce blood pressure control"),
        ("aspirin", "low", "May reduce effectiveness"),
    ],
    "aspirin": [
        ("warfarin", "high", "Increased risk of bleeding"),
        ("ibuprofen", "moderate", "Increased stomach bleeding risk"),
        ("methotrexate", "high", "May increase methotrexate toxicity"),
    ],
    "ibuprofen": [
        ("aspirin", "moderate", "Increased stomach bleeding risk"),
        ("warfarin", "high", "Increased risk of bleeding"),
        ("lisinopril", "moderate", "May reduce blood pressure control"),
        ("methotrexate", "high", "May increase methotrexate toxicity"),
    ],
    "omeprazole": [
        ("clopidogrel", "high", "May reduce clopidogrel effectiveness"),
        ("methotrexate", "moderate", "May increase methotrexate levels"),
    ],
    "simvastatin": [
        ("grapefruit", "moderate", "May increase side effects"),
        ("amiodarone", "high", "Increased risk of muscle damage"),
        ("erythromycin", "high", "Increased risk of muscle damage"),
    ],
    "amlodipine": [
        ("simvastatin", "moderate", "May increase simvastatin levels"),
        ("grapefruit", "low", "May increase amlodipine levels"),
    ],
    "levothyroxine": [
        ("calcium", "moderate", "Take 4 hours apart"),
        ("iron", "moderate", "Take 4 hours apart"),
        ("antacids", "moderate", "Take 4 hours apart"),
    ],
    "methotrexate": [
        ("ibuprofen", "high", "May increase methotrexate toxicity"),
        ("aspirin", "high", "May increase methotrexate toxicity"),
        ("omeprazole", "moderate", "May increase methotrexate levels"),
    ],
    "clopidogrel": [
        ("omeprazole", "high", "May reduce clopidogrel effectiveness"),
        ("aspirin", "moderate", "Increased bleeding risk but often prescribed together"),
    ],
    "prednisone": [
        ("ibuprofen", "moderate", "Increased stomach ulcer risk"),
        ("aspirin", "moderate", "Increased stomach ulcer risk"),
        ("diabetes medications", "moderate", "May increase blood sugar"),
    ],
    "gabapentin": [
        ("morphine", "moderate", "Increased sedation"),
        ("alcohol", "moderate", "Increased sedation"),
    ],
    "amoxicillin": [
        ("warfarin", "moderate", "May increase bleeding risk"),
        ("methotrexate", "moderate", "May increase methotrexate levels"),
    ],
}

def check_drug_interactions(medications: List[str]) -> List[dict]:
    """Check for interactions between a list of medications"""
    interactions = []
    med_names = [m.lower().strip() for m in medications]
    
    for i, med1 in enumerate(med_names):
        # Check if this medication has known interactions
        if med1 in DRUG_INTERACTIONS:
            for interacting_drug, severity, description in DRUG_INTERACTIONS[med1]:
                # Check if the interacting drug is in the user's medication list
                for med2 in med_names:
                    if interacting_drug in med2 or med2 in interacting_drug:
                        # Avoid duplicates
                        interaction_key = tuple(sorted([med1, med2]))
                        existing = [i for i in interactions if tuple(sorted([i["drug1"], i["drug2"]])) == interaction_key]
                        if not existing:
                            interactions.append({
                                "drug1": med1.title(),
                                "drug2": med2.title(),
                                "severity": severity,
                                "description": description
                            })
    
    return interactions

@api_router.get("/interactions/check")
async def check_interactions(current_user: dict = Depends(get_current_user)):
    """Check for drug interactions among user's medications"""
    medications = await db.medications.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0, "name": 1}
    ).to_list(100)
    
    med_names = [m["name"] for m in medications]
    interactions = check_drug_interactions(med_names)
    
    return {
        "medications_checked": med_names,
        "interactions_found": len(interactions),
        "interactions": interactions
    }

@api_router.post("/interactions/check-new")
async def check_new_medication_interactions(
    medication_name: str,
    current_user: dict = Depends(get_current_user)
):
    """Check if a new medication will interact with existing ones"""
    medications = await db.medications.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0, "name": 1}
    ).to_list(100)
    
    existing_meds = [m["name"] for m in medications]
    all_meds = existing_meds + [medication_name]
    interactions = check_drug_interactions(all_meds)
    
    # Filter to only show interactions involving the new medication
    new_med_interactions = [
        i for i in interactions 
        if medication_name.lower() in i["drug1"].lower() or medication_name.lower() in i["drug2"].lower()
    ]
    
    return {
        "new_medication": medication_name,
        "existing_medications": existing_meds,
        "interactions_found": len(new_med_interactions),
        "interactions": new_med_interactions
    }

# =============================================================================
# IN-APP NOTIFICATIONS FOR CAREGIVERS
# =============================================================================

class NotificationResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    notification_id: str
    user_id: str
    type: str
    title: str
    message: str
    patient_name: str
    read: bool
    created_at: str

@api_router.get("/notifications", response_model=List[NotificationResponse])
async def get_notifications(current_user: dict = Depends(get_current_user)):
    """Get all notifications for the current user"""
    notifications = await db.notifications.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return [NotificationResponse(**n) for n in notifications]

@api_router.get("/notifications/unread-count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    """Get count of unread notifications"""
    count = await db.notifications.count_documents({
        "user_id": current_user["user_id"],
        "read": False
    })
    return {"unread_count": count}

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Mark a notification as read"""
    result = await db.notifications.update_one(
        {"notification_id": notification_id, "user_id": current_user["user_id"]},
        {"$set": {"read": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification marked as read"}

@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read"""
    await db.notifications.update_many(
        {"user_id": current_user["user_id"]},
        {"$set": {"read": True}}
    )
    return {"message": "All notifications marked as read"}

async def create_caregiver_notification(
    caregiver_id: str,
    notification_type: str,
    title: str,
    message: str,
    patient_name: str
):
    """Create an in-app notification for a caregiver"""
    notification_doc = {
        "notification_id": str(uuid.uuid4()),
        "user_id": caregiver_id,
        "type": notification_type,
        "title": title,
        "message": message,
        "patient_name": patient_name,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification_doc)

# =============================================================================
# WEEKLY PROGRESS REPORT (Share Progress Feature)
# =============================================================================

@api_router.get("/progress/weekly")
async def get_weekly_progress(current_user: dict = Depends(get_current_user)):
    """Get weekly adherence progress for sharing"""
    today = datetime.now(timezone.utc)
    week_ago = today - timedelta(days=7)
    
    # Get all logs for the past 7 days
    logs = await db.medication_logs.find(
        {
            "user_id": current_user["user_id"],
            "date": {"$gte": week_ago.strftime("%Y-%m-%d")}
        },
        {"_id": 0}
    ).to_list(500)
    
    # Get medications
    medications = await db.medications.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).to_list(100)
    
    # Calculate daily stats
    daily_stats = {}
    for i in range(7):
        date = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        day_logs = [log for log in logs if log["date"] == date]
        taken = sum(1 for log in day_logs if log["status"] == "taken")
        missed = sum(1 for log in day_logs if log["status"] == "missed")
        skipped = sum(1 for log in day_logs if log["status"] == "skipped")
        total = taken + missed + skipped
        
        daily_stats[date] = {
            "taken": taken,
            "missed": missed,
            "skipped": skipped,
            "total": total,
            "adherence_rate": round(taken / total * 100, 1) if total > 0 else 0
        }
    
    # Overall stats
    total_taken = sum(1 for log in logs if log["status"] == "taken")
    total_missed = sum(1 for log in logs if log["status"] == "missed")
    total_skipped = sum(1 for log in logs if log["status"] == "skipped")
    total_doses = total_taken + total_missed + total_skipped
    
    # Calculate streak
    streak = 0
    for i in range(30):
        date = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        day_logs = [log for log in logs if log["date"] == date]
        if not day_logs:
            # Check if there were medications scheduled
            # For simplicity, break if no logs
            if i > 0:
                break
        else:
            missed_count = sum(1 for log in day_logs if log["status"] == "missed")
            if missed_count == 0:
                streak += 1
            else:
                break
    
    return {
        "user_name": current_user["name"],
        "period": {
            "start": week_ago.strftime("%Y-%m-%d"),
            "end": today.strftime("%Y-%m-%d")
        },
        "summary": {
            "total_doses": total_doses,
            "taken": total_taken,
            "missed": total_missed,
            "skipped": total_skipped,
            "adherence_rate": round(total_taken / total_doses * 100, 1) if total_doses > 0 else 0,
            "current_streak": streak
        },
        "daily_breakdown": daily_stats,
        "medications": [{"name": m["name"], "dosage": m["dosage"]} for m in medications],
        "generated_at": today.isoformat()
    }

# =============================================================================
# SUBSCRIPTION & PAYMENT ENDPOINTS
# =============================================================================

from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest

class SubscriptionCheckoutRequest(BaseModel):
    plan_id: str = "plus"
    origin_url: str

class SubscriptionResponse(BaseModel):
    is_subscribed: bool
    plan: Optional[str] = None
    plan_name: Optional[str] = None
    features: Optional[List[str]] = None
    sms_remaining: int = 0
    subscription_end: Optional[str] = None

@api_router.get("/subscription/plans")
async def get_subscription_plans():
    """Get available subscription plans"""
    return {
        "plans": SUBSCRIPTION_PLANS,
        "stripe_publishable_key": STRIPE_PUBLISHABLE_KEY
    }

@api_router.get("/subscription/status", response_model=SubscriptionResponse)
async def get_subscription_status(current_user: dict = Depends(get_current_user)):
    """Get current user's subscription status"""
    subscription = await db.subscriptions.find_one(
        {"user_id": current_user["user_id"], "status": "active"},
        {"_id": 0}
    )
    
    if not subscription:
        return SubscriptionResponse(
            is_subscribed=False,
            sms_remaining=0
        )
    
    plan = SUBSCRIPTION_PLANS.get(subscription.get("plan_id", "plus"), {})
    
    return SubscriptionResponse(
        is_subscribed=True,
        plan=subscription.get("plan_id"),
        plan_name=plan.get("name", "Vitality Plus"),
        features=plan.get("features", []),
        sms_remaining=subscription.get("sms_remaining", 0),
        subscription_end=subscription.get("current_period_end")
    )

@api_router.post("/subscription/checkout")
async def create_subscription_checkout(
    request: Request,
    checkout_data: SubscriptionCheckoutRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a Stripe checkout session for subscription"""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    plan = SUBSCRIPTION_PLANS.get(checkout_data.plan_id)
    if not plan:
        raise HTTPException(status_code=400, detail="Invalid plan")
    
    # Check if already subscribed
    existing = await db.subscriptions.find_one({
        "user_id": current_user["user_id"],
        "status": "active"
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already subscribed")
    
    try:
        host_url = str(request.base_url).rstrip('/')
        webhook_url = f"{host_url}/api/webhook/stripe"
        
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        success_url = f"{checkout_data.origin_url}/subscription/success?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{checkout_data.origin_url}/pricing"
        
        checkout_request = CheckoutSessionRequest(
            amount=float(plan["price"]),
            currency=plan["currency"],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "user_id": current_user["user_id"],
                "user_email": current_user["email"],
                "plan_id": checkout_data.plan_id,
                "type": "subscription"
            }
        )
        
        session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Create payment transaction record
        transaction_doc = {
            "transaction_id": str(uuid.uuid4()),
            "session_id": session.session_id,
            "user_id": current_user["user_id"],
            "user_email": current_user["email"],
            "plan_id": checkout_data.plan_id,
            "amount": plan["price"],
            "currency": plan["currency"],
            "status": "pending",
            "payment_status": "initiated",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.payment_transactions.insert_one(transaction_doc)
        
        return {
            "checkout_url": session.url,
            "session_id": session.session_id
        }
        
    except Exception as e:
        logger.error(f"Failed to create checkout session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/subscription/checkout/status/{session_id}")
async def get_checkout_status(
    session_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Check the status of a checkout session"""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    try:
        host_url = str(request.base_url).rstrip('/')
        webhook_url = f"{host_url}/api/webhook/stripe"
        
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
        
        # Update transaction record
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "status": status.status,
                "payment_status": status.payment_status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # If payment successful, create/update subscription
        if status.payment_status == "paid":
            transaction = await db.payment_transactions.find_one(
                {"session_id": session_id},
                {"_id": 0}
            )
            
            if transaction and not transaction.get("subscription_created"):
                # Create subscription record
                plan = SUBSCRIPTION_PLANS.get(transaction.get("plan_id", "plus"), {})
                subscription_doc = {
                    "subscription_id": str(uuid.uuid4()),
                    "user_id": transaction["user_id"],
                    "plan_id": transaction.get("plan_id", "plus"),
                    "status": "active",
                    "sms_remaining": plan.get("sms_limit", 50),
                    "current_period_start": datetime.now(timezone.utc).isoformat(),
                    "current_period_end": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                
                # Remove any existing subscription
                await db.subscriptions.delete_many({"user_id": transaction["user_id"]})
                await db.subscriptions.insert_one(subscription_doc)
                
                # Mark transaction as subscription created
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {"subscription_created": True}}
                )
                
                logger.info(f"Subscription created for user {transaction['user_id']}")
        
        return {
            "status": status.status,
            "payment_status": status.payment_status,
            "amount_total": status.amount_total,
            "currency": status.currency
        }
        
    except Exception as e:
        logger.error(f"Failed to check checkout status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    try:
        body = await request.body()
        signature = request.headers.get("Stripe-Signature", "")
        
        host_url = str(request.base_url).rstrip('/')
        webhook_url = f"{host_url}/api/webhook/stripe"
        
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        logger.info(f"Webhook received: {webhook_response.event_type}")
        
        # Handle subscription events
        if webhook_response.payment_status == "paid":
            session_id = webhook_response.session_id
            metadata = webhook_response.metadata
            
            if metadata.get("type") == "subscription":
                user_id = metadata.get("user_id")
                plan_id = metadata.get("plan_id", "plus")
                
                # Check if subscription already created
                existing = await db.subscriptions.find_one({
                    "user_id": user_id,
                    "status": "active"
                })
                
                if not existing:
                    plan = SUBSCRIPTION_PLANS.get(plan_id, {})
                    subscription_doc = {
                        "subscription_id": str(uuid.uuid4()),
                        "user_id": user_id,
                        "plan_id": plan_id,
                        "status": "active",
                        "sms_remaining": plan.get("sms_limit", 50),
                        "current_period_start": datetime.now(timezone.utc).isoformat(),
                        "current_period_end": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    await db.subscriptions.insert_one(subscription_doc)
                    logger.info(f"Subscription created via webhook for user {user_id}")
        
        return {"status": "received"}
        
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error", "message": str(e)}

# =============================================================================
# PDF EXPORT (Premium Feature)
# =============================================================================

@api_router.get("/export/pdf")
async def export_medications_pdf(current_user: dict = Depends(get_current_user)):
    """Export medications to PDF (Premium feature)"""
    # Check subscription
    subscription = await db.subscriptions.find_one({
        "user_id": current_user["user_id"],
        "status": "active"
    })
    
    if not subscription:
        raise HTTPException(status_code=403, detail="Premium subscription required for PDF export")
    
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        
        # Get user's medications
        medications = await db.medications.find(
            {"user_id": current_user["user_id"]},
            {"_id": 0}
        ).to_list(100)
        
        # Create PDF in memory
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        elements = []
        styles = getSampleStyleSheet()
        
        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            textColor=colors.HexColor('#4F46E5')
        )
        elements.append(Paragraph(f"Medication List - {current_user['name']}", title_style))
        elements.append(Paragraph(f"Generated: {datetime.now().strftime('%B %d, %Y')}", styles['Normal']))
        elements.append(Spacer(1, 20))
        
        if medications:
            # Create table data
            data = [['Medication', 'Dosage', 'Frequency', 'Times', 'Instructions']]
            for med in medications:
                data.append([
                    med['name'],
                    med['dosage'],
                    med['frequency'].replace('_', ' ').title(),
                    ', '.join(med['times']),
                    med.get('instructions', '-') or '-'
                ])
            
            # Create table
            table = Table(data, colWidths=[100, 80, 80, 80, 150])
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4F46E5')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E5E7EB')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F9FAFB')]),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ]))
            elements.append(table)
        else:
            elements.append(Paragraph("No medications found.", styles['Normal']))
        
        # Disclaimer
        elements.append(Spacer(1, 30))
        disclaimer_style = ParagraphStyle(
            'Disclaimer',
            parent=styles['Normal'],
            fontSize=8,
            textColor=colors.gray
        )
        elements.append(Paragraph(
            "This document is for informational purposes only. Always follow your doctor's instructions.",
            disclaimer_style
        ))
        
        doc.build(elements)
        buffer.seek(0)
        
        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=medications_{datetime.now().strftime('%Y%m%d')}.pdf"
            }
        )
        
    except ImportError:
        raise HTTPException(status_code=500, detail="PDF generation not available")
    except Exception as e:
        logger.error(f"PDF export error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate PDF")

# =============================================================================
# SMS REMINDERS (Premium Feature - Mocked for now)
# =============================================================================

@api_router.post("/sms/send-reminder")
async def send_sms_reminder(
    medication_id: str,
    phone_number: str,
    current_user: dict = Depends(get_current_user)
):
    """Send SMS reminder (Premium feature - currently mocked)"""
    # Check subscription
    subscription = await db.subscriptions.find_one({
        "user_id": current_user["user_id"],
        "status": "active"
    })
    
    if not subscription:
        raise HTTPException(status_code=403, detail="Premium subscription required for SMS reminders")
    
    if subscription.get("sms_remaining", 0) <= 0:
        raise HTTPException(status_code=403, detail="SMS limit reached for this month")
    
    # Get medication
    medication = await db.medications.find_one(
        {"medication_id": medication_id, "user_id": current_user["user_id"]},
        {"_id": 0}
    )
    
    if not medication:
        raise HTTPException(status_code=404, detail="Medication not found")
    
    # MOCKED: In production, integrate with Twilio
    # For now, just log and decrement counter
    logger.info(f"[MOCKED SMS] To: {phone_number}, Message: Time to take {medication['name']} ({medication['dosage']})")
    
    # Decrement SMS counter
    await db.subscriptions.update_one(
        {"user_id": current_user["user_id"], "status": "active"},
        {"$inc": {"sms_remaining": -1}}
    )
    
    return {
        "success": True,
        "message": "SMS reminder sent (mocked)",
        "sms_remaining": subscription["sms_remaining"] - 1,
        "note": "SMS is currently mocked. Add Twilio API key to enable real SMS."
    }

# =============================================================================
# EMAIL REPORTS (Premium Feature - Mocked for now)
# =============================================================================

@api_router.post("/email/weekly-report")
async def send_weekly_email_report(
    email: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Send weekly email report (Premium feature - currently mocked)"""
    # Check subscription
    subscription = await db.subscriptions.find_one({
        "user_id": current_user["user_id"],
        "status": "active"
    })
    
    if not subscription:
        raise HTTPException(status_code=403, detail="Premium subscription required for email reports")
    
    target_email = email or current_user["email"]
    
    # MOCKED: In production, integrate with Resend
    logger.info(f"[MOCKED EMAIL] Weekly report would be sent to: {target_email}")
    
    return {
        "success": True,
        "message": f"Weekly report sent to {target_email} (mocked)",
        "note": "Email is currently mocked. Add Resend API key to enable real emails."
    }

# =============================================================================
# ROOT & HEALTH
# =============================================================================

@api_router.get("/")
async def root():
    return {"message": "Vitality Medication Reminder API", "version": "2.0.0"}

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
