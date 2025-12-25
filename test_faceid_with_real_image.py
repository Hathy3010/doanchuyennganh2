#!/usr/bin/env python3
"""
Test Face ID setup với ảnh thực tế từ webcam
"""

import requests
import base64
import cv2
import time

def capture_and_test_faceid():
    """Capture ảnh từ webcam và test setup FaceID"""
    
    # 1. Login
    print("🔐 Logging in...")
    login_response = requests.post(
        "http://localhost:8002/auth/login",
        json={"username": "student1", "password": "password123"}
    )
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.text}")
        return
    
    token = login_response.json()["access_token"]
    print("✅ Login successful")
    
    # 2. Capture ảnh từ webcam
    print("\n📷 Opening webcam... (Press SPACE to capture, ESC to quit)")
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("❌ Cannot open webcam")
        return
    
    captured_images = []
    
    while len(captured_images) < 12:
        ret, frame = cap.read()
        if not ret:
            print("❌ Failed to read frame")
            break
        
        # Resize for display
        display_frame = cv2.resize(frame, (640, 480))
        
        # Add text
        cv2.putText(display_frame, f"Captured: {len(captured_images)}/12", (10, 30), 
                   cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        cv2.putText(display_frame, "SPACE: Capture | ESC: Quit", (10, 70), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 1)
        
        cv2.imshow("Webcam - Press SPACE to capture", display_frame)
        
        key = cv2.waitKey(1) & 0xFF
        
        if key == 27:  # ESC
            print("Quitting...")
            break
        elif key == 32:  # SPACE
            # Encode to base64
            success, encoded = cv2.imencode('.jpg', frame)
            if success:
                b64 = base64.b64encode(encoded.tobytes()).decode('utf-8')
                captured_images.append(b64)
                print(f"✅ Captured image {len(captured_images)}/12 (size: {len(b64)} bytes)")
            else:
                print("❌ Failed to encode image")
    
    cap.release()
    cv2.destroyAllWindows()
    
    if len(captured_images) < 12:
        print(f"❌ Only captured {len(captured_images)} images, need 12")
        return
    
    # 3. Send to backend
    print(f"\n📤 Sending {len(captured_images)} images to backend...")
    
    response = requests.post(
        "http://localhost:8002/student/setup-faceid",
        json={"images": captured_images},
        headers={"Authorization": f"Bearer {token}"}
    )
    
    print(f"📥 Response status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Setup FaceID successful!")
        print(f"   Samples used: {data.get('samples_used')}")
        print(f"   Yaw range: {data.get('yaw_range')}")
        print(f"   Pitch range: {data.get('pitch_range')}")
    else:
        print(f"❌ Setup failed: {response.text}")

if __name__ == "__main__":
    print("Face ID Setup Test with Real Webcam")
    print("=" * 50)
    
    # Check backend
    try:
        response = requests.get("http://localhost:8002/health", timeout=5)
        if response.status_code == 200:
            print("✅ Backend is running\n")
        else:
            print("❌ Backend health check failed")
            exit(1)
    except:
        print("❌ Cannot connect to backend on port 8002")
        print("   Start with: cd backend && python -m uvicorn main:app --host 0.0.0.0 --port 8002")
        exit(1)
    
    capture_and_test_faceid()
