#!/usr/bin/env python3
"""
Test teacher APIs without running full backend
"""

import sys
import os
sys.path.append('backend')

import asyncio
from database import users_collection, classes_collection

async def test_teacher_data():
    print("🔍 Testing teacher data...")

    # Count teachers
    teacher_count = await users_collection.count_documents({"role": "teacher"})
    print(f"👨‍🏫 Teachers in DB: {teacher_count}")

    # Count students
    student_count = await users_collection.count_documents({"role": "student"})
    print(f"🎓 Students in DB: {student_count}")

    # Get first teacher
    teacher = await users_collection.find_one({"role": "teacher"})
    if teacher:
        print(f"👨‍🏫 Sample teacher: {teacher['username']} (ID: {teacher['_id']})")

        # Find classes for this teacher
        classes = await classes_collection.find({"teacher_id": teacher["_id"]}).to_list(length=None)
        print(f"🏫 Classes for {teacher['username']}: {len(classes)}")

        for cls in classes:
            student_ids = cls.get("student_ids", [])
            print(f"  📚 {cls.get('name', '')}: {len(student_ids)} students")
            print(f"     Student IDs sample: {student_ids[:3] if student_ids else 'None'}")

            # Check if students exist
            if student_ids:
                first_student_id = student_ids[0]
                student = await users_collection.find_one({"_id": first_student_id, "role": "student"})
                if student:
                    print(f"     ✅ Sample student exists: {student['username']}")
                else:
                    print(f"     ❌ Sample student NOT found: {first_student_id}")

if __name__ == "__main__":
    asyncio.run(test_teacher_data())
