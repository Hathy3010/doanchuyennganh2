#!/usr/bin/env python3
"""
Kiểm tra trạng thái Face ID setup trong database
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from pymongo import MongoClient
import json

def check_face_id_status():
    """Kiểm tra Face ID status của users trong database"""
    try:
        # Kết nối MongoDB
        client = MongoClient("mongodb://localhost:27017/")
        db = client["smart_attendance"]
        users_collection = db["users"]
        
        print("🔍 KIỂM TRA FACE ID STATUS TRONG DATABASE")
        print("="*50)
        
        # Lấy tất cả users
        users = list(users_collection.find({}))
        
        if not users:
            print("❌ Không tìm thấy user nào trong database")
            return
        
        print(f"📊 Tìm thấy {len(users)} users:")
        print()
        
        for i, user in enumerate(users, 1):
            username = user.get('username', 'N/A')
            role = user.get('role', 'N/A')
            face_embedding = user.get('face_embedding')
            
            print(f"{i}. Username: {username}")
            print(f"   Role: {role}")
            print(f"   Face Embedding: {type(face_embedding).__name__ if face_embedding else 'None'}")
            
            if face_embedding:
                if isinstance(face_embedding, dict):
                    print(f"   Embedding Keys: {list(face_embedding.keys())}")
                    if 'data' in face_embedding:
                        data_len = len(face_embedding['data']) if face_embedding['data'] else 0
                        print(f"   Data Length: {data_len}")
                elif isinstance(face_embedding, list):
                    print(f"   Embedding Length: {len(face_embedding)}")
                
                # Tính has_face_id theo logic backend
                has_face_id = face_embedding is not None and (
                    isinstance(face_embedding, dict) and "data" in face_embedding or
                    isinstance(face_embedding, list) and len(face_embedding) > 0
                )
                print(f"   Has Face ID: {'✅ YES' if has_face_id else '❌ NO'}")
            else:
                print(f"   Has Face ID: ❌ NO")
            
            print()
        
        # Kiểm tra user student1 cụ thể
        student1 = users_collection.find_one({"username": "student1"})
        if student1:
            print("🎯 STUDENT1 DETAIL:")
            print("="*30)
            face_embedding = student1.get('face_embedding')
            
            if face_embedding:
                print(f"Face Embedding Type: {type(face_embedding)}")
                print(f"Face Embedding Content: {json.dumps(face_embedding, indent=2, default=str)[:500]}...")
            else:
                print("Face Embedding: None")
            
            # Logic has_face_id
            has_face_id = face_embedding is not None and (
                isinstance(face_embedding, dict) and "data" in face_embedding or
                isinstance(face_embedding, list) and len(face_embedding) > 0
            )
            
            print(f"Has Face ID (backend logic): {has_face_id}")
            
            return has_face_id
        else:
            print("❌ Không tìm thấy user student1")
            return False
            
    except Exception as e:
        print(f"❌ Database error: {e}")
        return False

def clear_face_id(username="student1"):
    """Xóa Face ID của user để test workflow setup"""
    try:
        client = MongoClient("mongodb://localhost:27017/")
        db = client["smart_attendance"]
        users_collection = db["users"]
        
        result = users_collection.update_one(
            {"username": username},
            {"$unset": {"face_embedding": ""}}
        )
        
        if result.modified_count > 0:
            print(f"✅ Đã xóa Face ID của user {username}")
            return True
        else:
            print(f"❌ Không thể xóa Face ID của user {username}")
            return False
            
    except Exception as e:
        print(f"❌ Error clearing Face ID: {e}")
        return False

def main():
    print("🚀 KIỂM TRA FACE ID STATUS")
    print()
    
    has_face_id = check_face_id_status()
    
    print("\n" + "="*60)
    print("💡 PHÂN TÍCH WORKFLOW")
    print("="*60)
    
    if has_face_id:
        print("✅ User student1 ĐÃ CÓ Face ID setup")
        print()
        print("📱 Workflow khi bấm 'Điểm danh':")
        print("1. Frontend gọi GET /auth/me")
        print("2. Backend trả về has_face_id = true")
        print("3. Frontend set hasFaceIDSetup = true")
        print("4. User bấm 'Điểm danh'")
        print("5. handleCheckIn() kiểm tra hasFaceIDSetup = true")
        print("6. ➡️ Mở RandomActionAttendanceModal (KHÔNG hiển thị setup)")
        print()
        print("🔧 Để test workflow setup:")
        print("   - Chạy: clear_face_id() để xóa Face ID")
        print("   - Refresh frontend")
        print("   - Bấm 'Điểm danh' sẽ thấy Alert setup")
        
    else:
        print("❌ User student1 CHƯA CÓ Face ID setup")
        print()
        print("📱 Workflow khi bấm 'Điểm danh':")
        print("1. Frontend gọi GET /auth/me")
        print("2. Backend trả về has_face_id = false")
        print("3. Frontend set hasFaceIDSetup = false")
        print("4. User bấm 'Điểm danh'")
        print("5. handleCheckIn() kiểm tra hasFaceIDSetup = false")
        print("6. ➡️ Hiển thị Alert 'Chưa thiết lập Face ID'")
        print("7. User bấm 'Thiết lập ngay'")
        print("8. ➡️ router.push('/setup-faceid')")
    
    print("\n🎯 TÓM TẮT VẤN ĐỀ:")
    print("- Nếu user ĐÃ setup Face ID -> KHÔNG hiển thị trang setup")
    print("- Nếu user CHƯA setup Face ID -> Hiển thị Alert -> Navigate setup")
    print("- Kiểm tra frontend console để xem hasFaceIDSetup value")

if __name__ == "__main__":
    main()