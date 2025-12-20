#!/usr/bin/env python3
"""
Test attendance summary calculation
"""

import sys
import os
sys.path.append('backend')

import asyncio
from datetime import date
from database import users_collection, classes_collection, attendance_collection

async def test_attendance_summary():
    print("🔍 Testing attendance summary...")

    # Get today's date
    today = date.today().isoformat()
    print(f"📅 Today: {today}")

    # Get first teacher
    teacher = await users_collection.find_one({"role": "teacher"})
    if not teacher:
        print("❌ No teacher found")
        return

    print(f"👨‍🏫 Teacher: {teacher['username']}")

    # Get teacher's classes
    classes = await classes_collection.find({"teacher_id": teacher["_id"]}).to_list(length=None)
    print(f"🏫 Classes: {len(classes)}")

    summary = []

    for cls in classes:
        class_id = cls["_id"]
        class_name = cls.get("name", "")
        student_ids = cls.get("student_ids", [])
        student_count = len(student_ids)

        print(f"\n📚 Class: {class_name}")
        print(f"   Students: {student_count}")
        print(f"   Student IDs sample: {student_ids[:3] if student_ids else 'None'}")

        # Count attendance for today
        attendance_query = {
            "class_id": class_id,
            "date": today,
            "status": {"$in": ["present", "late"]}
        }

        attendance_count = await attendance_collection.count_documents(attendance_query)

        # Also count total attendance records for this class today
        total_today = await attendance_collection.count_documents({
            "class_id": class_id,
            "date": today
        })

        print(f"   Attendance query: {attendance_query}")
        print(f"   Present/Late today: {attendance_count}")
        print(f"   Total records today: {total_today}")

        # Show sample attendance record
        sample_record = await attendance_collection.find_one({"class_id": class_id, "date": today})
        if sample_record:
            print(f"   Sample record: student {sample_record.get('student_id')} - {sample_record.get('status')}")

        absent_count = student_count - attendance_count

        summary.append({
            "class_id": str(class_id),
            "class_name": class_name,
            "total_students": student_count,
            "present_today": attendance_count,
            "absent_today": absent_count
        })

    print("
📊 Summary:"    for s in summary:
        print(f"  {s['class_name']}: {s['present_today']}/{s['total_students']} present")

if __name__ == "__main__":
    asyncio.run(test_attendance_summary())
