#!/usr/bin/env python3
"""
Seed sample data into MongoDB
- 5 teachers
- 45 students
- 2 classes
- Sample attendance + documents
"""

import sys
sys.path.append('.')

import asyncio
import numpy as np
from datetime import datetime, date
from database import (
    users_collection,
    classes_collection,
    attendance_collection,
    documents_collection,
)

# =======================
# FACE EMBEDDING (MOCK)
# =======================

def generate_sample_face_embedding(seed: int = 42) -> list:
    np.random.seed(seed)
    embedding = np.random.normal(0, 1, 512)
    embedding = embedding / np.linalg.norm(embedding)
    return embedding.tolist()


# =======================
# USER GENERATORS
# =======================

def generate_teachers(n=5):
    teachers = []
    for i in range(1, n + 1):
        teachers.append({
            "username": f"teacher{i}",
            "email": f"teacher{i}@university.edu",
            "password": "password123",
            "full_name": f"Giảng viên {i}",
            "role": "teacher",
            "is_online": False,
            "last_seen": datetime.utcnow(),
            "created_at": datetime.utcnow()
        })
    return teachers


def generate_students(n=45):
    students = []
    for i in range(1, n + 1):
        students.append({
            "username": f"student{i}",
            "email": f"student{i}@university.edu",
            "password": "password123",
            "full_name": f"Sinh viên {i}",
            "role": "student",
            "student_id": f"SV{str(i).zfill(3)}",
            "is_online": False,
            "last_seen": datetime.utcnow(),
            "created_at": datetime.utcnow()
        })
    return students


# =======================
# MAIN SEED FUNCTION
# =======================

async def seed_data():
    print("🌱 Seeding database...")

    # Clear old data
    await users_collection.delete_many({})
    await classes_collection.delete_many({})
    await attendance_collection.delete_many({})
    await documents_collection.delete_many({})
    print("🧹 Cleared existing data")

    # Create users
    teachers = generate_teachers(5)
    students = generate_students(45)
    users = teachers + students

    user_results = await users_collection.insert_many(users)
    teacher_ids = user_results.inserted_ids[:5]
    student_ids = user_results.inserted_ids[5:]

    print(f"👨‍🏫 Created {len(teacher_ids)} teachers")
    print(f"🎓 Created {len(student_ids)} students")

    # =======================
    # CLASSES
    # =======================
    classes = [
        {
            "class_code": "CS101",
            "name": "Lập trình Python",
            "subject": "Computer Science",
            "teacher_id": teacher_ids[0],
            "schedule": [
                {"day": "Monday", "start_time": "08:00", "end_time": "10:00", "room": "A101"},
                {"day": "Wednesday", "start_time": "14:00", "end_time": "16:00", "room": "A101"},
            ],
            "student_ids": student_ids[:23],
            "created_at": datetime.utcnow()
        },
        {
            "class_code": "CS102",
            "name": "Cơ sở dữ liệu",
            "subject": "Computer Science",
            "teacher_id": teacher_ids[1],
            "schedule": [
                {"day": "Tuesday", "start_time": "09:00", "end_time": "11:00", "room": "B202"},
                {"day": "Thursday", "start_time": "15:00", "end_time": "17:00", "room": "B202"},
            ],
            "student_ids": student_ids[23:],
            "created_at": datetime.utcnow()
        }
    ]

    class_results = await classes_collection.insert_many(classes)
    cs101_id = class_results.inserted_ids[0]
    cs102_id = class_results.inserted_ids[1]

    print("🏫 Created 2 classes")

    # =======================
    # ATTENDANCE (SAMPLE)
    # =======================
    today = date.today().isoformat()

    # Create more sample attendance records for testing
    attendance_records = []

    # CS101: Add 10 attendance records
    for i in range(10):
        attendance_records.append({
            "student_id": student_ids[i],
            "class_id": cs101_id,
            "date": today,
            "check_in_time": datetime.utcnow(),
            "status": "present" if i < 8 else "late",  # 8 present, 2 late
            "verification_method": "face_gps",
            "validations": {
                "face": {"is_valid": True, "similarity_score": 0.85 + i * 0.01},
                "gps": {"is_valid": i % 3 != 0, "distance_meters": 25.0 + i * 5}  # Some GPS warnings
            },
            "warnings": ["⚠️ Sai vị trí GPS"] if i % 3 == 0 else [],
            "location": {
                "latitude": 16.0046 + i * 0.001,
                "longitude": 108.2499 + i * 0.001
            },
            "created_at": datetime.utcnow()
        })

    # CS102: Add 8 attendance records
    for i in range(8):
        attendance_records.append({
            "student_id": student_ids[23 + i],  # CS102 students start at index 23
            "class_id": cs102_id,
            "date": today,
            "check_in_time": datetime.utcnow(),
            "status": "present" if i < 6 else "late",  # 6 present, 2 late
            "verification_method": "face_gps",
            "validations": {
                "face": {"is_valid": True, "similarity_score": 0.87 + i * 0.01},
                "gps": {"is_valid": i % 4 != 0, "distance_meters": 30.0 + i * 7}
            },
            "warnings": ["⚠️ Sai vị trí GPS"] if i % 4 == 0 else [],
            "location": {
                "latitude": 16.0032 + i * 0.001,
                "longitude": 108.2512 + i * 0.001
            },
            "created_at": datetime.utcnow()
        })

    await attendance_collection.insert_many(attendance_records)
    print(f"📊 Created {len(attendance_records)} sample attendance records")

    # =======================
    # DOCUMENTS
    # =======================
    documents = [
        {
            "class_id": cs101_id,
            "title": "Bài giảng tuần 1 - Python",
            "description": "Giới thiệu Python cơ bản",
            "file_url": "https://example.com/cs101/week1.pdf",
            "uploaded_by": teacher_ids[0],
            "uploaded_at": datetime.utcnow()
        },
        {
            "class_id": cs102_id,
            "title": "ER Diagram",
            "description": "Thiết kế cơ sở dữ liệu",
            "file_url": "https://example.com/cs102/er.pdf",
            "uploaded_by": teacher_ids[1],
            "uploaded_at": datetime.utcnow()
        }
    ]

    await documents_collection.insert_many(documents)
    print("📚 Created documents")

    print("✅ Seed completed successfully!")
    print("\n🔐 Accounts (password: password123)")
    print("Teachers: teacher1 → teacher5")
    print("Students: student1 → student45")
    print("All students require FaceID setup")


if __name__ == "__main__":
    asyncio.run(seed_data())
