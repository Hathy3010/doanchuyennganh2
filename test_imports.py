#!/usr/bin/env python3
"""
Test imports to find the issue
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

print("Testing imports...")

try:
    from face_detect import detect_face
    print("✓ face_detect import OK")
except Exception as e:
    print(f"✗ face_detect import failed: {e}")

try:
    from face_model import get_embedding
    print("✓ face_model import OK")
except Exception as e:
    print(f"✗ face_model import failed: {e}")

try:
    from database import users_collection
    print("✓ database import OK")
except Exception as e:
    print(f"✗ database import failed: {e}")

try:
    from auth import get_password_hash
    print("✓ auth import OK")
except Exception as e:
    print(f"✗ auth import failed: {e}")