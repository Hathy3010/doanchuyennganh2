#!/usr/bin/env python3
"""
Test script để kiểm tra setup FaceID endpoint
"""

import requests
import base64
import json
import numpy as np
import cv2

def create_test_image():
    """Tạo ảnh test đơn giản"""
    img = np.zeros((480, 640, 3), dtype=np.uint8)
    # Tạo hình chữ nhật giả lập khuôn mặt
    cv2.rectangle(img, (200, 150), (440, 330), (100, 150, 200), -1)
    
    # Encode thành base64
    success, encoded_img = cv2.imencode('.jpg', img)
    if not success:
        raise ValueError("Failed to encode image")
    
    img_base64 = base64.b64encode(encoded_img.tobytes()).decode('utf-8')
    return img_base64

def test_setup_faceid():
    """Test setup FaceID endpoint"""
    
    # 1. Login trước
    login_data = {
        "username": "student1", 
        "password": "password123"
    }
    
    try:
        # Login
        response = requests.post("http://localhost:8002/auth/login", json=login_data)
        if response.status_code != 200:
            print(f"❌ Login failed: {response.status_code} - {response.text}")
            return False
            
        token = response.json().get("access_token")
        print("✅ Login successful")
        
        # Tạo 12 ảnh test (backend yêu cầu ít nhất 10)
        test_images = []
        for i in range(12):
            img = create_test_image()
            test_images.append(img)
        
        print(f"📸 Created {len(test_images)} test images")
        
        # Gửi request setup FaceID
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "images": test_images
        }
        
        print("📤 Sending setup FaceID request...")
        response = requests.post(
            "http://localhost:8002/student/setup-faceid", 
            json=payload,
            headers=headers
        )
        
        print(f"📥 Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Setup FaceID successful!")
            print(f"   Message: {data.get('message')}")
            print(f"   Samples used: {data.get('samples_used')}")
            print(f"   Total samples: {data.get('total_samples')}")
            print(f"   Yaw range: {data.get('yaw_range')}")
            print(f"   Pitch range: {data.get('pitch_range')}")
            return True
        else:
            print(f"❌ Setup failed: {response.status_code}")
            try:
                error_data = response.json()
                print(f"   Error: {error_data.get('detail', 'Unknown error')}")
            except:
                print(f"   Raw error: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Testing setup FaceID endpoint...")
    print("=" * 50)
    
    # Kiểm tra backend có chạy không
    try:
        response = requests.get("http://localhost:8002/health", timeout=5)
        if response.status_code == 200:
            print("✅ Backend is running")
        else:
            print("❌ Backend health check failed")
            exit(1)
    except:
        print("❌ Cannot connect to backend. Make sure it's running on port 8002")
        print("   Start with: cd backend && python -m uvicorn main:app --host 0.0.0.0 --port 8002")
        exit(1)
    
    # Chạy test
    success = test_setup_faceid()
    
    if success:
        print("\n✅ Test passed! Setup FaceID endpoint is working")
    else:
        print("\n❌ Test failed! Check the error messages above")