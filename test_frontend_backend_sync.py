"""
Test script to verify frontend-backend endpoint synchronization.
Tests all endpoints that frontend calls to ensure they exist in backend.

Run: python test_frontend_backend_sync.py
"""

import requests
import json
import sys

# Configuration
BASE_URL = "http://localhost:8002"

# Test credentials (adjust as needed)
TEST_USERNAME = "student1"
TEST_PASSWORD = "123456"

def get_token():
    """Login and get access token"""
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"username": TEST_USERNAME, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        else:
            print(f"❌ Login failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Login error: {e}")
        return None

def test_endpoint(method, endpoint, token=None, data=None, expected_status=None):
    """Test if an endpoint exists and responds"""
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    try:
        if method == "GET":
            response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
        elif method == "POST":
            headers["Content-Type"] = "application/json"
            response = requests.post(f"{BASE_URL}{endpoint}", headers=headers, json=data or {})
        else:
            print(f"❌ Unknown method: {method}")
            return False
        
        # Check if endpoint exists (not 404)
        if response.status_code == 404:
            print(f"❌ {method} {endpoint} - NOT FOUND (404)")
            return False
        
        # Check expected status if provided
        if expected_status and response.status_code != expected_status:
            print(f"⚠️ {method} {endpoint} - Status {response.status_code} (expected {expected_status})")
            return True  # Endpoint exists but different status
        
        print(f"✅ {method} {endpoint} - Status {response.status_code}")
        return True
        
    except requests.exceptions.ConnectionError:
        print(f"❌ {method} {endpoint} - CONNECTION ERROR (is backend running?)")
        return False
    except Exception as e:
        print(f"❌ {method} {endpoint} - ERROR: {e}")
        return False

def main():
    print("=" * 60)
    print("🔍 Frontend-Backend Endpoint Synchronization Test")
    print("=" * 60)
    print(f"Backend URL: {BASE_URL}")
    print()
    
    # Test health endpoint first
    print("📡 Testing backend connection...")
    if not test_endpoint("GET", "/health"):
        print("\n❌ Backend is not running! Start it with: python backend/main.py")
        sys.exit(1)
    print()
    
    # Get token for authenticated endpoints
    print("🔐 Getting authentication token...")
    token = get_token()
    if not token:
        print("⚠️ Could not get token, testing unauthenticated endpoints only")
    else:
        print(f"✅ Token obtained")
    print()
    
    # Test all endpoints that frontend calls
    print("=" * 60)
    print("📋 Testing Frontend Endpoints")
    print("=" * 60)
    
    results = []
    
    # 1. Auth endpoints
    print("\n🔐 Auth Endpoints:")
    results.append(("POST /auth/login", test_endpoint("POST", "/auth/login", data={"username": "test", "password": "test"})))
    results.append(("GET /auth/me", test_endpoint("GET", "/auth/me", token=token)))
    results.append(("POST /auth/logout", test_endpoint("POST", "/auth/logout", token=token)))
    
    # 2. Student endpoints
    print("\n👨‍🎓 Student Endpoints:")
    results.append(("GET /student/dashboard", test_endpoint("GET", "/student/dashboard", token=token)))
    results.append(("POST /student/setup-faceid", test_endpoint("POST", "/student/setup-faceid", token=token, data={"images": []})))
    results.append(("POST /student/check-in", test_endpoint("POST", "/student/check-in", token=token, data={"class_id": "test", "latitude": 10.762622, "longitude": 106.660172})))
    
    # 3. Face detection endpoints
    print("\n👤 Face Detection Endpoints:")
    results.append(("POST /detect_face_pose_and_expression", test_endpoint("POST", "/detect_face_pose_and_expression", token=token, data={"image": "", "current_action": "neutral"})))
    results.append(("POST /detect-face-angle", test_endpoint("POST", "/detect-face-angle", token=token, data={"image": ""})))
    results.append(("POST /detect_liveness", test_endpoint("POST", "/detect_liveness", data={"base64": ""})))
    
    # 4. Attendance endpoints
    print("\n📍 Attendance Endpoints:")
    results.append(("POST /attendance/checkin", test_endpoint("POST", "/attendance/checkin", token=token, data={"class_id": "test", "latitude": 10.762622, "longitude": 106.660172, "image": ""})))
    results.append(("POST /attendance/checkin-with-embedding", test_endpoint("POST", "/attendance/checkin-with-embedding", token=token, data={"class_id": "test", "latitude": 10.762622, "longitude": 106.660172, "image": ""})))
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 Summary")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    print(f"\n✅ Passed: {passed}/{total}")
    print(f"❌ Failed: {total - passed}/{total}")
    
    if passed == total:
        print("\n🎉 All endpoints are synchronized!")
    else:
        print("\n⚠️ Some endpoints need attention")
        print("\nFailed endpoints:")
        for name, result in results:
            if not result:
                print(f"  - {name}")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
