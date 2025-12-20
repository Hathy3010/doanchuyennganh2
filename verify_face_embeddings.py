#!/usr/bin/env python3
"""
Script to verify face embeddings in MongoDB database
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

import asyncio
from database import users_collection

async def verify_face_embeddings():
    """Check face embeddings in database"""
    print("Checking face embeddings in database...")

    # Get all users
    users = await users_collection.find({}).to_list(length=None)

    print(f"\nFound {len(users)} users:")
    print("-" * 50)

    for user in users:
        username = user.get('username', 'N/A')
        role = user.get('role', 'N/A')
        full_name = user.get('full_name', 'N/A')
        has_embedding = 'face_embedding' in user and user['face_embedding'] is not None

        if has_embedding:
            embedding_length = len(user['face_embedding'])
            print(f"{username} ({role}): HAS face embedding ({embedding_length} dimensions)")
        else:
            print(f"{username} ({role}): NO face embedding")
    print("\n" + "=" * 50)

    # Check specific users for testing
    print("FaceID Test Scenarios:")
    print("- student1: Should have face embedding (ready for attendance)")
    print("- student2: Should NOT have face embedding (needs setup)")
    print("- student3: Should have face embedding (ready for attendance)")
    print("- teachers: Should NOT have face embeddings")

if __name__ == "__main__":
    asyncio.run(verify_face_embeddings())
