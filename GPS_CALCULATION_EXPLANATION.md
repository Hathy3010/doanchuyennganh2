# 📍 Giải Thích Tính Toán GPS Trong Dự Án

## 1. Cấu Hình Vị Trí Mặc Định

```python
# File: backend/main.py (dòng 59-63)
DEFAULT_LOCATION = {
    "latitude": 10.762622,      # Vĩ độ của trường
    "longitude": 106.660172,    # Kinh độ của trường
    "radius_meters": 100,       # Bán kính cho phép (100m)
    "name": "University"        # Tên địa điểm
}
```

**Ý nghĩa:**
- Vị trí mặc định là trường đại học (Đà Nẵng)
- Sinh viên phải ở trong vòng 100m từ trường để điểm danh hợp lệ

---

## 2. Hàm Tính Toán GPS

```python
# File: backend/main.py (dòng 277-283)
def validate_gps(lat: float, lon: float):
    """
    Xác thực vị trí GPS của sinh viên
    
    Args:
        lat: Vĩ độ hiện tại của sinh viên
        lon: Kinh độ hiện tại của sinh viên
    
    Returns:
        (is_valid, distance): 
        - is_valid: True nếu trong vòng cho phép, False nếu ngoài
        - distance: Khoảng cách tính bằng mét (làm tròn 2 chữ số)
    """
    # Tính khoảng cách giữa 2 điểm GPS bằng công thức Haversine
    distance = geodesic(
        (lat, lon),                                    # Vị trí sinh viên
        (DEFAULT_LOCATION["latitude"], 
         DEFAULT_LOCATION["longitude"])                # Vị trí trường
    ).meters
    
    # Kiểm tra xem có nằm trong bán kính cho phép không
    return distance <= DEFAULT_LOCATION["radius_meters"], round(distance, 2)
```

**Công thức:**
- Sử dụng thư viện `geopy.distance.geodesic`
- Tính khoảng cách theo công thức Haversine (tính toán khoảng cách trên bề mặt Trái Đất)
- Trả về 2 giá trị:
  1. `is_valid`: Boolean (True/False)
  2. `distance`: Khoảng cách tính bằng mét

---

## 3. Cách Sử Dụng Trong Điểm Danh

### 3.1 Trong endpoint `/student/check-in` (dòng 1343)

```python
# ============ STEP 2: GPS Validation ============
gps_ok, distance = validate_gps(latitude, longitude)

if not gps_ok:
    raise HTTPException(
        400, 
        f"❌ Vị trí không hợp lệ. Bạn cách trường {distance}m (tối đa {DEFAULT_LOCATION['radius_meters']}m)"
    )

logger.info(f"✅ GPS validation passed ({distance}m)")
```

**Quy trình:**
1. Gọi hàm `validate_gps()` với vĩ độ và kinh độ từ sinh viên
2. Nếu `gps_ok = False` → Từ chối điểm danh, báo lỗi
3. Nếu `gps_ok = True` → Tiếp tục quy trình điểm danh

### 3.2 Lưu Thông Tin GPS Vào Database

```python
# File: backend/main.py (dòng 1368-1371)
record = {
    "student_id": current_user["_id"],
    "class_id": ObjectId(class_id),
    "date": today,
    "check_in_time": datetime.utcnow(),
    "location": {
        "latitude": latitude,      # Lưu vĩ độ
        "longitude": longitude     # Lưu kinh độ
    },
    "status": "present",
    "verification_method": "gps_with_faceid_check",
    "gps_distance": distance,      # Lưu khoảng cách
    "warnings": []
}
```

---

## 4. Xử Lý GPS Không Hợp Lệ

### 4.1 Theo Dõi Lần Thử GPS Invalid

```python
# File: backend/main.py (dòng 302-316)
async def increment_gps_invalid_attempt(
    student_id: str, 
    class_id: str, 
    today: str,
    latitude: float,
    longitude: float,
    distance_meters: float,
    face_similarity: float
) -> int:
    """Tăng bộ đếm lần thử GPS không hợp lệ"""
    
    attempt_detail = {
        "timestamp": datetime.utcnow(),
        "latitude": latitude,
        "longitude": longitude,
        "distance_meters": distance_meters,
        "face_similarity": face_similarity
    }
    
    # Cập nhật database
    result = await gps_invalid_attempts_collection.update_one(
        {
            "student_id": student_id,
            "class_id": class_id,
            "date": today
        },
        {
            "$inc": {"attempt_count": 1},
            "$set": {"last_attempt_time": datetime.utcnow()},
            "$push": {"attempts": attempt_detail}
        },
        upsert=True
    )
```

**Ý nghĩa:**
- Mỗi lần sinh viên điểm danh với GPS không hợp lệ, hệ thống ghi lại:
  - Thời gian
  - Vị trí (lat, lon)
  - Khoảng cách
  - Điểm Face ID
- Giới hạn: Tối đa 2 lần thử GPS invalid mỗi ngày

### 4.2 Gửi Thông Báo Cho Giáo Viên

```python
# File: backend/main.py (dòng 389-425)
async def send_gps_invalid_notification(
    student_id: str,
    student_username: str,
    student_fullname: str,
    class_id: str,
    class_name: str,
    gps_distance: float,
    teacher_id: str,
    is_enrolled: bool = True
):
    """Gửi thông báo GPS không hợp lệ cho giáo viên"""
    
    notification = {
        "type": "gps_invalid_attendance",
        "class_id": class_id,
        "class_name": class_name,
        "student_id": student_id,
        "student_username": student_username,
        "student_fullname": student_fullname,
        "timestamp": datetime.utcnow().isoformat(),
        "gps_distance": gps_distance,
        "status": "gps_invalid",
        "message": f"GPS không hợp lệ ({gps_distance}m từ trường)",
        "is_enrolled": is_enrolled,
        "warning_flags": [] if is_enrolled else ["not_enrolled"]
    }
    
    # Gửi qua WebSocket nếu giáo viên online
    if teacher_id in manager.active_connections:
        await manager.send_personal_message(notification, teacher_id)
        return True
    else:
        # Lưu vào database nếu giáo viên offline
        await pending_notifications_collection.insert_one({
            "teacher_id": teacher_id,
            "notification": notification,
            "created_at": datetime.utcnow(),
            "delivered": False
        })
        return False
```

---

## 5. Ví Dụ Thực Tế

### Ví Dụ 1: Sinh viên ở trong vòng cho phép

```
Vị trí trường:     10.762622, 106.660172
Vị trí sinh viên:  10.762700, 106.660200
Khoảng cách:       ~8.5 mét
Kết quả:           ✅ GPS hợp lệ (8.5m < 100m)
```

### Ví Dụ 2: Sinh viên ở ngoài vòng cho phép

```
Vị trí trường:     10.762622, 106.660172
Vị trí sinh viên:  10.770000, 106.670000
Khoảng cách:       ~1,200 mét
Kết quả:           ❌ GPS không hợp lệ (1200m > 100m)
Thông báo:         "GPS không hợp lệ. Bạn cách trường 1200m (tối đa 100m)"
```

---

## 6. Các Thư Viện Sử Dụng

```python
from geopy.distance import geodesic  # Tính khoảng cách GPS
```

**Công thức Haversine:**
- Tính khoảng cách giữa 2 điểm trên bề mặt Trái Đất
- Công thức: `a = sin²(Δφ/2) + cos φ1 ⋅ cos φ2 ⋅ sin²(Δλ/2)`
- Độ chính xác: ±0.5% (rất chính xác cho khoảng cách ngắn)

---

## 7. Tóm Tắt Quy Trình

```
1. Sinh viên gửi request điểm danh với (latitude, longitude)
   ↓
2. Backend gọi validate_gps(lat, lon)
   ↓
3. Tính khoảng cách từ vị trí sinh viên đến trường
   ↓
4. So sánh với bán kính cho phép (100m)
   ↓
5. Nếu hợp lệ → Tiếp tục điểm danh
   Nếu không hợp lệ → Ghi lại lần thử, gửi thông báo cho giáo viên
```

---

## 8. Cấu Hình Có Thể Thay Đổi

Để thay đổi vị trí trường hoặc bán kính cho phép, chỉnh sửa:

```python
DEFAULT_LOCATION = {
    "latitude": 10.762622,      # ← Thay đổi vĩ độ
    "longitude": 106.660172,    # ← Thay đổi kinh độ
    "radius_meters": 100,       # ← Thay đổi bán kính (mét)
    "name": "University"
}
```

**Ví dụ:** Để cho phép 200m thay vì 100m:
```python
"radius_meters": 200,
```
