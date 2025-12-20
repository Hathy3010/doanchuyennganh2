#!/usr/bin/env python3
"""
Debug classes in database
"""

import asyncio
import sys
sys.path.append('backend')
from database import classes_collection, users_collection

async def debug_classes():
    print("=== Checking Classes in Database ===")

    # Check classes
    classes = await classes_collection.find({}).to_list(length=10)
    print(f"Found {len(classes)} classes:")

    for i, cls in enumerate(classes):
        print(f"{i+1}. {cls['class_code']} - {cls['class_name']}")
        students = cls.get('students', [])
        print(f"   Students: {[str(s) for s in students]}")
        print(f"   Schedule: {cls['schedule']}")
        print()

    # Check specific student
    print("=== Checking Student ===")
    student = await users_collection.find_one({"username": "student1"})
    if student:
        print(f"Student: {student['username']}")
        print(f"Student ID: {student['_id']} (type: {type(student['_id'])})")
        print(f"Role: {student.get('role')}")

        # Try the same query as dashboard
        print("\n=== Testing Query ===")
        matching_classes = await classes_collection.find({"students": {"$in": [student["_id"]]}}).to_list(length=10)
        print(f"Classes for student1: {len(matching_classes)}")

        for cls in matching_classes:
            print(f"  - {cls['class_code']}: {cls['class_name']}")

asyncio.run(debug_classes())
