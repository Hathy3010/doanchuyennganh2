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

# GPS Invalid Attendance Collections
gps_invalid_attempts_collection = db.gps_invalid_attempts  # Track failed GPS attempts per student/class/day
gps_invalid_audit_logs_collection = db.gps_invalid_audit_logs  # Audit logging for GPS-invalid attempts
pending_notifications_collection = db.pending_notifications  # Store notifications for offline teachers

# Document Sharing Collections
highlights_collection = db.highlights  # Student highlights on documents
notes_collection = db.notes  # Student personal notes on documents
document_views_collection = db.document_views  # Track document views and reading positions
session_reports_collection = db.session_reports  # Attendance session reports
ai_explanations_collection = db.ai_explanations  # Saved AI explanations for highlights

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

    # Pydantic v2: provide JSON schema hook
    @classmethod
    def __get_pydantic_json_schema__(cls, core_schema=None):
        return {"type": "string", "format": "objectid"}

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
        validate_by_name = True
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

# DETAILED BACKEND FLOW ANALYSIS
# - Responsibilities:
#   * Định nghĩa models (User, Class, Attendance, Document) và collections.
#   * Backend endpoints nên map tới các models sau:
#       - GET /student/dashboard  -> queries users_collection, classes_collection, attendance_collection -> returns StudentDashboard
#       - POST /detect-face-pose-and-expression -> image processing service (can be separate microservice) -> returns { face_present, yaw, pitch, action, captured, message, expression_detected }
#       - POST /face/setup-frames -> accept images[] (base64) -> process embeddings -> update users_collection.face_embedding
#       - POST /attendance/checkin -> record attendance in attendance_collection (create/update)
#       - POST /auth/logout -> invalidate session/token
#
# - Data flow (Check-in / Face verification)
#   1) Frontend handleCheckIn -> show camera modal (verify mode)
#   2) Frontend takes frames and calls POST /detect_face_pose_and_expression per frame.
#   3) If detection returns captured=true and action matches expected action:
#        - accumulate base64 frames client-side
#   4) After all actions completed, frontend POST /face/setup-frames with images: [base64,...]
#   5) Backend /face/setup-frames:
#        - validate token -> locate user -> for each image: temp store, run face embedding extraction
#        - aggregate embeddings -> persist to users_collection.face_embedding or train a small classifier
#        - return { success: true, embedding_id? }
#
# NOTE:
#   * The POST /detect_face_pose_and_expression endpoint should delegate image analysis
#     to the pose_detect module. Example controller should call:
#       from pose_detect import detect_face_pose_and_expression
#       result = detect_face_pose_and_expression(image_base64, current_action)
#     Keep heavy processing inside pose_detect (or a separate microservice) and keep
#     controller lightweight (auth checks, fast response). 
#
# - Collections affected:
#   * users_collection: update face_embedding, last_seen, is_online
#   * classes_collection: read schedules, students list
#   * attendance_collection: insert/update attendance per class/day
#   * documents_collection: unrelated to face flow, used by classroom docs endpoints
#
# - Payload examples:
#   POST /detect-face-pose-and-expression
#     { image: "<base64>", current_action: "blink" }
#     -> { face_present: true, yaw: -3.1, pitch: 2.2, action: "blink", captured: true, message: "ok" }
#
#   POST /face/setup-frames
#     { images: ["<base64>", ...] }
#     -> { success: true, saved_count: 12 }
#
#   POST /attendance/checkin
#     { student_id: "<id>", class_id: "<id>", location: { latitude, longitude } }
#     -> { success: true, attendance_id: "<id>", status: "present" }
#
# - Notes / Best practices:
#   * Limit image size or accept multipart; prefer streaming for many frames.
#   * Face detection/embedding should be async/background job if processing heavy.
#   * Validate tokens and check authorization for teacher/student scope.
#   * Ensure atomic updates for attendance (upsert by student_id+class_id+date).


# ==========================================
# DOCUMENT SHARING MODELS
# ==========================================

# Enhanced Document Model for sharing feature
class DocumentShare(BaseModel):
    """Document model for realtime sharing feature"""
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    class_id: PyObjectId
    teacher_id: PyObjectId
    title: str
    description: Optional[str] = None
    file_path: str  # Path to stored file
    file_type: str  # pdf, docx, txt, md
    file_size: int  # bytes
    text_content: Optional[str] = None  # Extracted text for search/AI
    upload_time: datetime = Field(default_factory=datetime.utcnow)
    view_count: int = 0
    unique_viewers: List[PyObjectId] = []
    is_shared: bool = False  # Whether document has been shared with students
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        validate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class DocumentShareCreate(BaseModel):
    """Request model for creating a shared document"""
    class_id: str
    title: str
    description: Optional[str] = None

class DocumentShareResponse(BaseModel):
    """Response model for document"""
    id: str
    class_id: str
    teacher_id: str
    title: str
    description: Optional[str] = None
    file_type: str
    file_size: int
    upload_time: str
    view_count: int
    is_shared: bool

# Highlight Models
class Highlight(BaseModel):
    """Student highlight on a document"""
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    document_id: PyObjectId
    student_id: PyObjectId  # Private to student
    text_content: str
    start_position: int
    end_position: int
    color: str = "yellow"  # yellow, green, blue, red
    ai_explanation: Optional[dict] = None  # {content, generated_at, followup_questions}
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        validate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class HighlightCreate(BaseModel):
    """Request model for creating a highlight"""
    document_id: str
    text_content: str
    start_position: int
    end_position: int
    color: str = "yellow"

class HighlightResponse(BaseModel):
    """Response model for highlight"""
    id: str
    document_id: str
    text_content: str
    start_position: int
    end_position: int
    color: str
    ai_explanation: Optional[dict] = None
    created_at: str

# Note Models
class Note(BaseModel):
    """Student personal note on a document"""
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    document_id: PyObjectId
    student_id: PyObjectId  # Private to student
    content: str  # max 1000 chars
    position: int
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        validate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class NoteCreate(BaseModel):
    """Request model for creating a note"""
    document_id: str
    content: str = Field(..., max_length=1000)
    position: int

class NoteUpdate(BaseModel):
    """Request model for updating a note"""
    content: str = Field(..., max_length=1000)

class NoteResponse(BaseModel):
    """Response model for note"""
    id: str
    document_id: str
    content: str
    position: int
    created_at: str
    updated_at: str

# Document View Models
class DocumentView(BaseModel):
    """Track document views and reading position"""
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    document_id: PyObjectId
    student_id: PyObjectId
    first_viewed_at: datetime = Field(default_factory=datetime.utcnow)
    last_viewed_at: datetime = Field(default_factory=datetime.utcnow)
    reading_position: int = 0  # For resume reading
    time_spent_seconds: int = 0
    view_count: int = 1

    class Config:
        validate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

# Session Report Models
class SessionReport(BaseModel):
    """Attendance session report"""
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    class_id: PyObjectId
    date: str  # YYYY-MM-DD
    total_students: int
    present_count: int
    absent_count: int
    late_count: int
    attendance_rate: float  # percentage
    students: List[dict]  # [{student_id, student_name, status, check_in_time, gps_status, face_id_status, warnings}]
    generated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        validate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class SessionReportResponse(BaseModel):
    """Response model for session report"""
    id: str
    class_id: str
    date: str
    total_students: int
    present_count: int
    absent_count: int
    late_count: int
    attendance_rate: float
    students: List[dict]
    generated_at: str

# Semester Report Models
class SemesterReportRequest(BaseModel):
    """Request model for semester report"""
    class_id: str
    start_date: str  # YYYY-MM-DD
    end_date: str  # YYYY-MM-DD

class StudentAttendanceStats(BaseModel):
    """Student attendance statistics"""
    student_id: str
    student_name: str
    total_sessions: int
    attended_sessions: int
    missed_sessions: int
    late_sessions: int
    attendance_rate: float
    is_at_risk: bool  # True if rate < 80%
    remaining_absences: int

class SemesterReportResponse(BaseModel):
    """Response model for semester report"""
    class_id: str
    class_name: str
    start_date: str
    end_date: str
    total_sessions: int
    class_average_rate: float
    students: List[StudentAttendanceStats]
    at_risk_count: int

# AI Explanation Models
class AIExplanationRequest(BaseModel):
    """Request model for AI explanation"""
    highlight_id: str

class AIFollowupRequest(BaseModel):
    """Request model for AI follow-up question"""
    highlight_id: str
    question: str

class AIExplanationResponse(BaseModel):
    """Response model for AI explanation"""
    highlight_id: str
    explanation: str
    generated_at: str
    followup_questions: List[dict] = []

# WebSocket Notification Models
class DocumentNotification(BaseModel):
    """WebSocket notification for new document"""
    type: str = "document_shared"
    document_id: str
    title: str
    teacher_name: str
    class_name: str
    timestamp: str

class AttendanceWarningNotification(BaseModel):
    """WebSocket notification for attendance warning"""
    type: str = "attendance_warning"
    class_id: str
    class_name: str
    attendance_rate: float
    remaining_absences: int
    message: str

class SessionReportNotification(BaseModel):
    """WebSocket notification for session report ready"""
    type: str = "session_report_ready"
    class_id: str
    date: str
    attendance_rate: float
    timestamp: str
