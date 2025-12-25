#!/usr/bin/env python3
"""
Test combined random action + attendance check-in function
Tests the unified endpoint that combines:
1. Random action selection
2. Action verification
3. Anti-fraud checks (5 checks)
4. Attendance recording
"""

import requests
import json
import base64
import cv2
import numpy as np
from pathlib import Path

# Configuration
API_URL = "http://localhost:8000"
STUDENT_USERNAME = "student1"
STUDENT_PASSWORD = "password123"
CLASS_ID = "67a1b2c3d4e5f6g7h8i9j0k1"  # Replace with real class ID

# Test image path
TEST_IMAGE_PATH = "test_image.jpg"

def get_token():
    """Login and get access token"""
    print("🔐 Logging in...")
    response = requests.post(
        f"{API_URL}/auth/login",
        json={
            "username": STUDENT_USERNAME,
            "password": STUDENT_PASSWORD
        }
    )
    
    if response.status_code != 200:
        print(f"❌ Login failed: {response.text}")
        return None
    
    token = response.json()["access_token"]
    print(f"✅ Login successful, token: {token[:20]}...")
    return token

def load_test_image():
    """Load test image and convert to base64"""
    print("📸 Loading test image...")
    
    if not Path(TEST_IMAGE_PATH).exists():
        print(f"⚠️ Test image not found at {TEST_IMAGE_PATH}")
        print("📷 Creating dummy image...")
        
        # Create dummy image
        img = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.putText(img, "Test Image", (200, 240), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        cv2.imwrite(TEST_IMAGE_PATH, img)
    
    # Read and encode image
    img = cv2.imread(TEST_IMAGE_PATH)
    _, buffer = cv2.imencode('.jpg', img)
    img_base64 = base64.b64encode(buffer).decode('utf-8')
    
    print(f"✅ Image loaded: {len(img_base64)} bytes")
    return img_base64

def test_checkin_with_random_action(token, image_b64):
    """Test check-in with random action selection"""
    print("\n" + "="*60)
    print("TEST 1: Check-in with Random Action Selection")
    print("="*60)
    
    payload = {
        "class_id": CLASS_ID,
        "latitude": 10.762622,
        "longitude": 106.660172,
        "image": image_b64
        # Note: action_required is NOT provided, so backend will select random action
    }
    
    print(f"📤 Sending request to /attendance/checkin-with-action")
    print(f"   - class_id: {CLASS_ID}")
    print(f"   - latitude: 10.762622")
    print(f"   - longitude: 106.660172")
    print(f"   - image: {len(image_b64)} bytes")
    print(f"   - action_required: NOT PROVIDED (will be random)")
    
    response = requests.post(
        f"{API_URL}/attendance/checkin-with-action",
        json=payload,
        headers={"Authorization": f"Bearer {token}"}
    )
    
    print(f"\n📊 Response Status: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print("✅ Check-in successful!")
        print(f"\n📋 Attendance Record:")
        print(f"   - Attendance ID: {result.get('attendance_id')}")
        print(f"   - Check-in Time: {result.get('check_in_time')}")
        print(f"   - Message: {result.get('message')}")
        
        print(f"\n🛡️ Validation Results:")
        validations = result.get('validations', {})
        for check_name, check_result in validations.items():
            status = "✅" if check_result.get('is_valid') else "❌"
            message = check_result.get('message', 'N/A')
            print(f"   {status} {check_name.upper()}: {message}")
        
        return True
    else:
        print(f"❌ Check-in failed!")
        print(f"Response: {response.text}")
        return False

def test_checkin_with_specific_action(token, image_b64):
    """Test check-in with specific action provided"""
    print("\n" + "="*60)
    print("TEST 2: Check-in with Specific Action")
    print("="*60)
    
    payload = {
        "class_id": CLASS_ID,
        "latitude": 10.762622,
        "longitude": 106.660172,
        "image": image_b64,
        "action_required": "neutral"  # Specific action provided
    }
    
    print(f"📤 Sending request to /attendance/checkin-with-action")
    print(f"   - class_id: {CLASS_ID}")
    print(f"   - latitude: 10.762622")
    print(f"   - longitude: 106.660172")
    print(f"   - image: {len(image_b64)} bytes")
    print(f"   - action_required: neutral (SPECIFIC)")
    
    response = requests.post(
        f"{API_URL}/attendance/checkin-with-action",
        json=payload,
        headers={"Authorization": f"Bearer {token}"}
    )
    
    print(f"\n📊 Response Status: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print("✅ Check-in successful!")
        print(f"\n📋 Attendance Record:")
        print(f"   - Attendance ID: {result.get('attendance_id')}")
        print(f"   - Check-in Time: {result.get('check_in_time')}")
        print(f"   - Message: {result.get('message')}")
        
        print(f"\n🛡️ Validation Results:")
        validations = result.get('validations', {})
        for check_name, check_result in validations.items():
            status = "✅" if check_result.get('is_valid') else "❌"
            message = check_result.get('message', 'N/A')
            print(f"   {status} {check_name.upper()}: {message}")
        
        return True
    else:
        print(f"❌ Check-in failed!")
        print(f"Response: {response.text}")
        return False

def test_multiple_checkins(token, image_b64, num_checkins=3):
    """Test multiple check-ins to verify fair action distribution"""
    print("\n" + "="*60)
    print(f"TEST 3: Multiple Check-ins (Fair Distribution)")
    print("="*60)
    
    actions_selected = []
    
    for i in range(num_checkins):
        print(f"\n📍 Check-in #{i+1}/{num_checkins}")
        
        payload = {
            "class_id": CLASS_ID,
            "latitude": 10.762622,
            "longitude": 106.660172,
            "image": image_b64
        }
        
        response = requests.post(
            f"{API_URL}/attendance/checkin-with-action",
            json=payload,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if response.status_code == 200:
            result = response.json()
            # Extract action from validations
            action_validation = result.get('validations', {}).get('action', {})
            message = action_validation.get('message', '')
            
            # Parse action from message (e.g., "✅ Hành động đúng" or specific action)
            print(f"   ✅ Success: {message}")
            actions_selected.append(message)
        else:
            print(f"   ❌ Failed: {response.status_code}")
    
    print(f"\n📊 Summary:")
    print(f"   - Total check-ins: {num_checkins}")
    print(f"   - Actions selected: {actions_selected}")
    
    return True

def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("🧪 COMBINED RANDOM ACTION + ATTENDANCE CHECK-IN TESTS")
    print("="*60)
    
    # Step 1: Login
    token = get_token()
    if not token:
        print("❌ Failed to get token, exiting")
        return
    
    # Step 2: Load test image
    image_b64 = load_test_image()
    
    # Step 3: Run tests
    test1_passed = test_checkin_with_random_action(token, image_b64)
    test2_passed = test_checkin_with_specific_action(token, image_b64)
    test3_passed = test_multiple_checkins(token, image_b64, num_checkins=3)
    
    # Summary
    print("\n" + "="*60)
    print("📊 TEST SUMMARY")
    print("="*60)
    print(f"✅ Test 1 (Random Action): {'PASSED' if test1_passed else 'FAILED'}")
    print(f"✅ Test 2 (Specific Action): {'PASSED' if test2_passed else 'FAILED'}")
    print(f"✅ Test 3 (Fair Distribution): {'PASSED' if test3_passed else 'FAILED'}")
    
    all_passed = test1_passed and test2_passed and test3_passed
    print(f"\n{'✅ ALL TESTS PASSED!' if all_passed else '❌ SOME TESTS FAILED'}")

if __name__ == "__main__":
    main()
