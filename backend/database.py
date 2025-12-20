from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from bson import ObjectId

# MongoDB connection
MONGO_URL = "mongodb+srv://doan:abc@doan.h7dlpmc.mongodb.net/"
DATABASE_NAME = "smart_attendance"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DATABASE_NAME]

# Collections
users_collection = db.users
classes_collection = db.classes
attendance_collection = db.attendance
documents_collection = db.documents

# Pydantic models for API
class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)

    @classmethod
    def __modify_schema__(cls, field_schema):
        field_schema.update(type="string")

# User Models
class User(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    username: str
    email: str
    password_hash: str
    full_name: str
    role: str  # "student" or "teacher"
    student_id: Optional[str] = None  # For students
    face_embedding: Optional[List[float]] = None
    is_online: bool = False
    last_seen: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    full_name: str
    role: str
    student_id: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# Class Models
class Class(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    class_code: str
    class_name: str
    teacher_id: PyObjectId
    schedule: List[dict]  # [{"day": "Monday", "start_time": "08:00", "end_time": "10:00", "room": "A101"}]
    students: List[PyObjectId] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ClassCreate(BaseModel):
    class_code: str
    class_name: str
    teacher_id: str
    schedule: List[dict]

# Attendance Models
class Attendance(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    student_id: PyObjectId
    class_id: PyObjectId
    date: str  # "2025-12-18"
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    location: Optional[dict] = None  # {"latitude": float, "longitude": float}
    status: str = "absent"  # "present", "late", "absent"
    verification_method: str = "face"  # "face", "qr", "manual"
    created_at: datetime = Field(default_factory=datetime.utcnow)

class AttendanceCheckIn(BaseModel):
    student_id: str
    class_id: str
    location: Optional[dict] = None

# Document Models
class Document(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    class_id: PyObjectId
    title: str
    description: Optional[str] = None
    file_url: str
    uploaded_by: PyObjectId
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)

class DocumentCreate(BaseModel):
    class_id: str
    title: str
    description: Optional[str] = None
    uploaded_by: str

# Student Dashboard Models
class TodayScheduleItem(BaseModel):
    class_id: str
    class_name: str
    teacher_name: str
    start_time: str
    end_time: str
    room: str
    attendance_status: str

class StudentDashboard(BaseModel):
    student_name: str
    today_schedule: List[TodayScheduleItem]
    total_classes_today: int
    attended_today: int

# Real-time Models
class TeacherStatus(BaseModel):
    teacher_id: str
    teacher_name: str
    is_online: bool
    last_seen: datetime
    current_class: Optional[str] = None
