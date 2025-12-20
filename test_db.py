#!/usr/bin/env python3
"""
Test database content
"""

import asyncio
import sys
sys.path.append('backend')
from database import classes_col, users_col

async def check_db():
    print("Checking database content...")

    # Check users
    users = await users_col.find({}).to_list(length=10)
    print(f"\nUsers ({len(users)}):")
    for user in users:
        print(f"  - {user['username']} ({user['role']}) - ID: {user['_id']}")

    # Check classes
    classes = await classes_col.find({}).to_list(length=10)
    print(f"\nClasses ({len(classes)}):")
    for cls in classes:
        students = cls.get('students', [])
        print(f"  - {cls['class_code']}: {cls['class_name']}")
        print(f"    Students: {[str(s) for s in students]}")
        print(f"    Schedule: {cls['schedule']}")

asyncio.run(check_db())
