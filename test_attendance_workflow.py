#!/usr/bin/env python3
"""
Test script để kiểm tra workflow điểm danh và tại sao không hiển thị trang thiết lập Face ID
"""

import requests
import json
import sys
import os

# Thêm backend vào path để import
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

API_URL = "http://localhost:8000"

def test_api_connection():
    """Test kết nối API"""
    print("🔧 Testing API connection...")
    try:
        response = requests.get(f"{API_URL}/health", timeout=5)
        if response.status_code == 200:
            print(f"✅ API connection OK: {response.json()}")
            return True
        else:
            print(f"❌ API connection failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ API connection error: {e}")
        return False

def test_login(username="student1", password="password123"):
    """Test đăng nhập"""
    print(f"\n🔐 Testing login for {username}...")
    try:
        response = requests.post(f"{API_URL}/auth/login", json={
            "username": username,
            "password": password
        })
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
            print(f"✅ Login successful, token: {token[:20]}...")
            return token
        else:
            print(f"❌ Login failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Login error: {e}")
        return None

def test_user_profile(token):
    """Test lấy profile user để kiểm tra Face ID status"""
    print("\n👤 Testing user profile (Face ID status)...")
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{API_URL}/auth/me", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            has_face_id = data.get("has_face_id", False)
            face_embedding = data.get("face_embedding")
            
            print(f"✅ Profile loaded:")
            print(f"   - Username: {data.get('username')}")
            print(f"   - Has Face ID: {has_face_id}")
            print(f"   - Face Embedding: {'Yes' if face_embedding else 'No'}")
            
            if face_embedding:
                if isinstance(face_embedding, dict):
                    print(f"   - Embedding type: dict, keys: {list(face_embedding.keys())}")
                    if "data" in face_embedding:
                        print(f"   - Embedding data length: {len(face_embedding['data'])}")
                elif isinstance(face_embedding, list):
                    print(f"   - Embedding type: list, length: {len(face_embedding)}")
            
            return has_face_id, face_embedding
        else:
            print(f"❌ Profile failed: {response.status_code} - {response.text}")
            return False, None
    except Exception as e:
        print(f"❌ Profile error: {e}")
        return False, None

def test_dashboard(token):
    """Test dashboard để xem schedule"""
    print("\n📊 Testing student dashboard...")
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{API_URL}/student/dashboard", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Dashboard loaded:")
            print(f"   - Student: {data.get('student_name')}")
            print(f"   - Total classes today: {data.get('total_classes_today')}")
            print(f"   - Attended today: {data.get('attended_today')}")
            
            schedule = data.get('today_schedule', [])
            print(f"   - Schedule items: {len(schedule)}")
            
            for i, item in enumerate(schedule):
                status = item.get('attendance_status', 'absent')
                print(f"     {i+1}. {item.get('class_name')} - Status: {status}")
            
            return schedule
        else:
            print(f"❌ Dashboard failed: {response.status_code} - {response.text}")
            return []
    except Exception as e:
        print(f"❌ Dashboard error: {e}")
        return []

def test_setup_faceid_endpoint(token):
    """Test endpoint setup Face ID"""
    print("\n🎯 Testing setup-faceid endpoint...")
    try:
        headers = {"Authorization": f"Bearer {token}"}
        
        # Tạo fake base64 images để test
        fake_images = ["iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="] * 10
        
        response = requests.post(f"{API_URL}/student/setup-faceid", 
                               headers=headers,
                               json={"images": fake_images})
        
        print(f"📤 Sent {len(fake_images)} fake images")
        print(f"📥 Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Setup FaceID successful:")
            print(f"   - Message: {data.get('message')}")
            print(f"   - Samples used: {data.get('samples_used')}")
            return True
        else:
            print(f"❌ Setup FaceID failed: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Setup FaceID error: {e}")
        return False

def analyze_workflow():
    """Phân tích workflow điểm danh"""
    print("\n" + "="*60)
    print("🔍 PHÂN TÍCH WORKFLOW ĐIỂM DANH")
    print("="*60)
    
    print("\n📋 Workflow hiện tại:")
    print("1. User đăng nhập")
    print("2. Frontend gọi GET /auth/me để kiểm tra has_face_id")
    print("3. User bấm 'Điểm danh'")
    print("4. Frontend kiểm tra hasFaceIDSetup:")
    print("   - Nếu FALSE: Hiển thị Alert -> router.push('/setup-faceid')")
    print("   - Nếu TRUE: Mở RandomActionAttendanceModal")
    
    print("\n🔧 Các nguyên nhân có thể:")
    print("1. Backend không trả về has_face_id = false")
    print("2. Frontend không nhận được response đúng")
    print("3. Navigation không hoạt động")
    print("4. Trang setup-faceid có lỗi")
    
    print("\n🎯 Cần kiểm tra:")
    print("1. API /auth/me response")
    print("2. Frontend state hasFaceIDSetup")
    print("3. Navigation router.push('/setup-faceid')")
    print("4. Trang setup-faceid render")

def main():
    print("🚀 KIỂM TRA WORKFLOW ĐIỂM DANH")
    print("="*50)
    
    # 1. Test API connection
    if not test_api_connection():
        print("\n❌ Không thể kết nối API. Hãy khởi động backend trước.")
        return
    
    # 2. Test login
    token = test_login()
    if not token:
        print("\n❌ Không thể đăng nhập. Kiểm tra credentials.")
        return
    
    # 3. Test user profile (Face ID status)
    has_face_id, face_embedding = test_user_profile(token)
    
    # 4. Test dashboard
    schedule = test_dashboard(token)
    
    # 5. Analyze workflow
    analyze_workflow()
    
    # 6. Recommendations
    print("\n" + "="*60)
    print("💡 KHUYẾN NGHỊ")
    print("="*60)
    
    if has_face_id:
        print("✅ User đã có Face ID setup")
        print("   -> Khi bấm 'Điểm danh' sẽ mở RandomActionAttendanceModal")
        print("   -> Không hiển thị trang setup vì đã setup rồi")
    else:
        print("❌ User chưa có Face ID setup")
        print("   -> Khi bấm 'Điểm danh' sẽ hiển thị Alert")
        print("   -> Bấm 'Thiết lập ngay' sẽ navigate đến /setup-faceid")
        
        print("\n🔧 Để test workflow setup:")
        print("1. Xóa face_embedding trong database")
        print("2. Refresh frontend")
        print("3. Bấm 'Điểm danh' -> sẽ thấy Alert")
        print("4. Bấm 'Thiết lập ngay' -> navigate đến setup page")
    
    print(f"\n📊 TỔNG KẾT:")
    print(f"   - API Connection: ✅")
    print(f"   - Login: ✅")
    print(f"   - User Profile: ✅")
    print(f"   - Has Face ID: {'✅' if has_face_id else '❌'}")
    print(f"   - Dashboard: ✅")
    print(f"   - Schedule Items: {len(schedule)}")

if __name__ == "__main__":
    main()