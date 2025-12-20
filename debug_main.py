#!/usr/bin/env python3
"""Debug main.py imports"""

try:
    import sys
    sys.path.append('.')
    print("Added current dir to path")

    from fastapi import FastAPI
    print("FastAPI imported")

    # Test FACE_DB
    import os
    FACE_DB = "face_db"
    os.makedirs(FACE_DB, exist_ok=True)
    print(f"FACE_DB created: {FACE_DB}")

    # Test os.listdir on FACE_DB
    face_db_count = len([f for f in os.listdir(FACE_DB) if f.endswith('.pkl')]) if os.path.exists(FACE_DB) else 0
    print(f"Face DB count: {face_db_count}")

    # Test imports
    from attendance_liveness import decode_image, movement_score
    print("attendance_liveness imported")

    from liveness import generate_challenge
    print("liveness imported")

    # Test datetime
    from datetime import datetime
    timestamp = datetime.utcnow().isoformat()
    print(f"Timestamp: {timestamp}")

    print("All imports successful!")

except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()

