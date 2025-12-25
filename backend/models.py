from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

# Face ID Setup Models
class FaceSetupRequest(BaseModel):
    images: List[str] = Field(..., description="List of base64 encoded images for pose diversity calculation")

    class Config:
        schema_extra = {
            "example": {
                "images": [
                    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...",
                    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD..."
                ],
                "poses": ["front", "left", "right", "up", "down"]
            }
        }

# Pose Validation Models
class PoseValidationRequest(BaseModel):
    image: str = Field(..., description="Base64 encoded image")
    expected_pose: str = Field(..., description="Expected pose (front, left, right, up, down)")

    class Config:
        schema_extra = {
            "example": {
                "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...",
                "expected_pose": "front"
            }
        }

class PoseValidationResponse(BaseModel):
    is_valid: bool
    detected_pose: str
    expected_pose: str
    requirements: dict
    message: str

# Face Verification Models
class FaceVerificationRequest(BaseModel):
    image: str = Field(..., description="Base64 encoded image")
    class_id: str = Field(..., description="Class ID for attendance")

# User Models
class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    full_name: str
    role: str = Field(default="student", pattern="^(student|teacher)$")


class UserLogin(BaseModel):
    username: str
    password: str

class TokenData(BaseModel):
    username: Optional[str] = None

# Attendance Models
class AttendanceRecord(BaseModel):
    student_id: str
    class_id: str
    date: str
    check_in_time: datetime
    status: str = Field(default="present", pattern="^(present|late|absent)$")
    verification_method: str
    validations: dict
    warnings: List[str] = []
    location: dict
    created_at: datetime

# Database Models (for internal use)
class FaceEmbedding:
    def __init__(self, embedding_list: List[float]):
        self.data = embedding_list

    def to_numpy(self):
        import numpy as np
        return np.array(self.data)

    def to_list(self):
        return self.data
