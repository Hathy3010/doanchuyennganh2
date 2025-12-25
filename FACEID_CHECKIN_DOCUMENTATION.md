# 📸 Tài Liệu Điểm Danh Face ID - Quy Trình Chi Tiết

## 1. Tổng Quan

Endpoint `/attendance/checkin` xử lý quy trình điểm danh sinh viên với xác minh Face ID. Quy trình gồm 7 bước chính, trong đó **Face ID phải được xác minh TRƯỚC GPS** để phân biệt loại lỗi.

**Endpoint:** `POST /attendance/checkin`
**File:** `backend/main.py` (dòng 1420-1750+)
**Yêu cầu:** Sinh viên phải đã thiết lập Face ID trước khi điểm danh

---

## 2. Các Bước Xác Minh Chi Tiết

### BƯỚC 0: Kiểm Tra Face ID Đã Thiết Lập (BẮT BUỘC)

```python
# Dòng 1450-1465
user_doc = await users_collection.find_one({"username": current_user["username"]})
if not user_doc:
    raise HTTPException(400, "Không tìm thấy người dùng")

face_embedding = user_doc.get("face_embedding")
if not face_embedding:
    raise HTTPException(400, "❌ Chưa thiết lập Face ID. Vui lòng thiết lập Face ID trước khi điểm danh.")

# Validate face_embedding structure
if isinstance(face_embedding, dict):
    if "data" not in face_embedding or not face_embedding.get("data"):
        raise HTTPException(400, "❌ Face ID không hợp lệ. Vui lòng thiết lập lại Face ID.")
elif isinstance(face_embedding, list):
    if len(face_embedding) == 0:
        raise HTTPException(400, "❌ Face ID không hợp lệ. Vui lòng thiết lập lại Face ID.")
```

**Ý nghĩa:**
- Kiểm tra xem sinh viên đã thiết lập Face ID chưa
- Face embedding phải tồn tại và không rỗng
- Hỗ trợ 2 định dạng: dict với key "data" hoặc list trực tiếp

---

### BƯỚC 1: Giải Mã Ảnh (Base64 → OpenCV)

```python
# Dòng 1480-1500
clean_b64 = image_b64
if image_b64.startswith('data:'):
    clean_b64 = image_b64.split(',', 1)[1]

# Thêm padding nếu cần
padding = 4 - (len(clean_b64) % 4)
if padding != 4:
    clean_b64 += '=' * padding

# Decode base64 thành bytes
img_bytes = base64.b64decode(clean_b64)

# Chuyển bytes thành OpenCV image
img = cv2.imdecode(np.frombuffer(img_bytes, np.uint8), cv2.IMREAD_COLOR)

if img is None:
    raise HTTPException(400, "Ảnh không hợp lệ")
```

**Xử lý:**
- Loại bỏ tiền tố `data:image/jpeg;base64,` nếu có
- Thêm padding `=` để base64 hợp lệ (base64 phải chia hết cho 4)
- Decode thành bytes rồi chuyển thành OpenCV image (BGR format)

---

### BƯỚC 2: Kiểm Tra Liveness (Người Sống Thực Tế)

```python
# Dòng 1510-1515
validations["liveness"]["is_valid"] = True
validations["liveness"]["message"] = "✅ Người sống thực tế"
validations["liveness"]["score"] = 0.85
```

**Hiện tại:** Đơn giản hóa (luôn pass)
**Tương lai:** Có thể tích hợp liveness detection thực tế

---

### BƯỚC 3: Phát Hiện Deepfake

```python
# Dòng 1520-1525
validations["deepfake"]["is_valid"] = True
validations["deepfake"]["message"] = "✅ Ảnh thực tế"
validations["deepfake"]["confidence"] = 0.02
```

**Hiện tại:** Đơn giản hóa (luôn pass)
**Tương lai:** Có thể tích hợp deepfake detection

---

### BƯỚC 4: Xác Minh Face Embedding (TRƯỚC GPS)

```python
# Dòng 1530-1575
emb = get_face_embedding(img)
if emb is None:
    raise HTTPException(400, detail={
        "status": "failed",
        "error_type": "face_invalid",
        "message": "Không thể tạo embedding từ ảnh"
    })

# Lấy embedding đã lưu
stored = user_doc.get("face_embedding")
if isinstance(stored, dict) and "data" in stored:
    stored_emb = np.array(stored["data"])
else:
    stored_emb = np.array(stored)

# Chuẩn hóa (normalize) embedding
emb = emb / np.linalg.norm(emb)
stored_emb = stored_emb / np.linalg.norm(stored_emb)

# Tính cosine similarity
face_similarity = float(cosine_similarity([stored_emb], [emb])[0][0])

# So sánh với ngưỡng (73%)
if face_similarity < SIMILARITY_THRESHOLD:  # SIMILARITY_THRESHOLD = 0.73
    raise HTTPException(403, detail={
        "status": "failed",
        "error_type": "face_invalid",
        "message": f"❌ Khuôn mặt không khớp ({face_similarity*100:.1f}%)"
    })

validations["embedding"]["is_valid"] = True
validations["embedding"]["similarity"] = face_similarity
```

**Chi tiết:**
- Tạo embedding từ ảnh hiện tại bằng `get_face_embedding()`
- Lấy embedding đã lưu từ database
- **Chuẩn hóa** cả 2 embedding (chia cho norm để độ dài = 1)
- Tính **cosine similarity** (giá trị từ -1 đến 1, thường 0 đến 1)
- So sánh với **ngưỡng 0.73 (73%)**
- Nếu < 73% → Lỗi `face_invalid` (403 Forbidden)
- Nếu ≥ 73% → Pass, lưu điểm tương đồng

**Công thức Cosine Similarity:**
```
similarity = (A · B) / (||A|| × ||B||)
```
- A · B: Tích vô hướng
- ||A||, ||B||: Độ dài vector (norm)
- Kết quả: 0 = hoàn toàn khác, 1 = giống hệt

---

### BƯỚC 5: Xác Minh GPS (SAU Face ID)

```python
# Dòng 1580-1650
gps_ok, distance = validate_gps(latitude, longitude)

if not gps_ok:
    # Face ID hợp lệ nhưng GPS không hợp lệ
    
    # Kiểm tra giới hạn lần thử
    is_blocked, current_count, remaining = await check_gps_invalid_limit(
        str(current_user["_id"]), class_id, today
    )
    
    if is_blocked:
        # Đã hết số lần thử (tối đa 2 lần)
        raise HTTPException(400, detail={
            "status": "failed",
            "error_type": "gps_invalid_max_attempts",
            "message": f"❌ Đã hết số lần thử ({MAX_GPS_INVALID_ATTEMPTS} lần)",
            "details": {
                "face_valid": True,
                "gps_valid": False,
                "distance_meters": distance,
                "max_distance_meters": DEFAULT_LOCATION["radius_meters"],
                "max_attempts_reached": True
            }
        })
    
    # Tăng bộ đếm lần thử
    new_count = await increment_gps_invalid_attempt(
        str(current_user["_id"]), class_id, today,
        latitude, longitude, distance, face_similarity
    )
    new_remaining = max(0, MAX_GPS_INVALID_ATTEMPTS - new_count)
    
    # Gửi thông báo cho giáo viên
    await send_gps_invalid_notification(
        student_id=str(current_user["_id"]),
        student_username=current_user["username"],
        student_fullname=current_user.get("full_name", current_user["username"]),
        class_id=class_id,
        class_name=class_name,
        gps_distance=distance,
        teacher_id=teacher_id,
        is_enrolled=is_enrolled
    )
    
    raise HTTPException(400, detail={
        "status": "failed",
        "error_type": "gps_invalid",
        "message": f"❌ Vị trí không hợp lệ. Còn {new_remaining} lần thử.",
        "details": {
            "face_valid": True,
            "gps_valid": False,
            "distance_meters": distance,
            "attempt_number": new_count,
            "remaining_attempts": new_remaining
        }
    })

validations["gps"]["is_valid"] = True
validations["gps"]["distance_meters"] = distance
```

**Quy trình:**
1. Gọi `validate_gps()` để kiểm tra vị trí
2. Nếu GPS không hợp lệ:
   - Kiểm tra xem đã vượt quá 2 lần thử chưa
   - Nếu vượt quá → Từ chối, báo "Đã hết số lần thử"
   - Nếu chưa → Tăng bộ đếm, gửi thông báo cho giáo viên
3. Nếu GPS hợp lệ → Tiếp tục

**Tại sao Face ID trước GPS?**
- Để phân biệt lỗi: `face_invalid` vs `gps_invalid`
- Nếu GPS trước, không biết Face ID có hợp lệ không
- Giáo viên cần biết sinh viên có khuôn mặt hợp lệ không

---

### BƯỚC 6: Kiểm Tra Đã Điểm Danh Hôm Nay Chưa

```python
# Dòng 1660-1670
existing_attendance = await attendance_collection.find_one({
    "student_id": current_user["_id"],
    "class_id": ObjectId(class_id),
    "date": today
})

if existing_attendance:
    raise HTTPException(400, "❌ Bạn đã điểm danh lớp này hôm nay rồi")
```

**Ý nghĩa:** Mỗi sinh viên chỉ được điểm danh 1 lần mỗi lớp mỗi ngày

---

### BƯỚC 7: Ghi Lại Điểm Danh

```python
# Dòng 1675-1695
record = {
    "student_id": current_user["_id"],
    "class_id": ObjectId(class_id),
    "date": today,
    "check_in_time": datetime.utcnow(),
    "location": {
        "latitude": latitude,
        "longitude": longitude
    },
    "status": "present",
    "verification_method": "face_with_antifraud",
    "validations": validations,
    "warnings": []
}

result = await attendance_collection.insert_one(record)
```

**Lưu trữ:**
- Tất cả thông tin xác minh (liveness, deepfake, face, gps)
- Vị trí GPS
- Thời gian điểm danh
- Phương pháp xác minh

---

## 3. Cấu Trúc Dữ Liệu Trả Về

### Thành Công (200 OK)

```json
{
  "status": "success",
  "message": "✅ Điểm danh thành công",
  "attendance_id": "507f1f77bcf86cd799439011",
  "validation_details": {
    "face": {
      "verified": true,
      "similarity_score": 0.85
    },
    "gps": {
      "valid": true,
      "distance_meters": 45.2
    }
  }
}
```

### Lỗi Face Invalid (403 Forbidden)

```json
{
  "status": "failed",
  "error_type": "face_invalid",
  "message": "❌ Khuôn mặt không khớp (65.3%)",
  "details": {
    "face_valid": false,
    "similarity": 0.653
  }
}
```

### Lỗi GPS Invalid - Còn Lần Thử (400 Bad Request)

```json
{
  "status": "failed",
  "error_type": "gps_invalid",
  "message": "❌ Vị trí không hợp lệ. Còn 1 lần thử.",
  "details": {
    "face_valid": true,
    "gps_valid": false,
    "distance_meters": 250.5,
    "max_distance_meters": 100,
    "attempt_number": 1,
    "remaining_attempts": 1,
    "max_attempts_reached": false
  }
}
```

### Lỗi GPS Invalid - Hết Lần Thử (400 Bad Request)

```json
{
  "status": "failed",
  "error_type": "gps_invalid_max_attempts",
  "message": "❌ Đã hết số lần thử (2 lần). Vui lòng thử lại vào ngày mai.",
  "details": {
    "face_valid": true,
    "gps_valid": false,
    "distance_meters": 250.5,
    "max_distance_meters": 100,
    "attempt_number": 2,
    "remaining_attempts": 0,
    "max_attempts_reached": true
  }
}
```

---

## 4. Thông Báo WebSocket Cho Giáo Viên

### Khi Điểm Danh Thành Công

```json
{
  "type": "attendance_update",
  "class_id": "507f1f77bcf86cd799439011",
  "student_id": "507f1f77bcf86cd799439012",
  "student_name": "Nguyễn Văn A",
  "status": "present",
  "check_in_time": "2025-12-26T10:30:45.123456",
  "timestamp": "2025-12-26T10:30:45.123456",
  "message": "✅ Điểm danh thành công",
  "validation_details": {
    "face": {
      "verified": true,
      "similarity_score": 0.85
    },
    "gps": {
      "valid": true,
      "distance_meters": 45.2
    }
  }
}
```

### Khi GPS Invalid

```json
{
  "type": "gps_invalid_attendance",
  "class_id": "507f1f77bcf86cd799439011",
  "class_name": "Lập Trình Python - Lớp A",
  "student_id": "507f1f77bcf86cd799439012",
  "student_username": "nguyenvana",
  "student_fullname": "Nguyễn Văn A",
  "timestamp": "2025-12-26T10:30:45.123456",
  "gps_distance": 250.5,
  "status": "gps_invalid",
  "message": "GPS không hợp lệ (250.5m từ trường)",
  "is_enrolled": true,
  "warning_flags": []
}
```

---

## 5. Hàm Hỗ Trợ Chính

### validate_gps(lat, lon)

```python
def validate_gps(lat: float, lon: float):
    """
    Xác thực vị trí GPS
    
    Returns:
        (is_valid, distance): 
        - is_valid: True/False
        - distance: Khoảng cách (mét)
    """
    distance = geodesic(
        (lat, lon),
        (DEFAULT_LOCATION["latitude"], DEFAULT_LOCATION["longitude"])
    ).meters
    
    return distance <= DEFAULT_LOCATION["radius_meters"], round(distance, 2)
```

**Cấu hình:**
```python
DEFAULT_LOCATION = {
    "latitude": 16.0544,        # VKU Đà Nẵng
    "longitude": 108.2022,
    "radius_meters": 100,       # Bán kính cho phép
    "name": "VKU"
}
```

### check_gps_invalid_limit(student_id, class_id, today)

```python
async def check_gps_invalid_limit(student_id: str, class_id: str, today: str):
    """
    Kiểm tra xem sinh viên đã vượt quá 2 lần thử GPS invalid chưa
    
    Returns:
        (is_blocked, current_count, remaining):
        - is_blocked: True nếu đã hết lần thử
        - current_count: Số lần thử hiện tại
        - remaining: Số lần thử còn lại
    """
    # MAX_GPS_INVALID_ATTEMPTS = 2
```

### increment_gps_invalid_attempt(...)

```python
async def increment_gps_invalid_attempt(
    student_id: str, 
    class_id: str, 
    today: str,
    latitude: float,
    longitude: float,
    distance_meters: float,
    face_similarity: float
) -> int:
    """
    Tăng bộ đếm lần thử GPS invalid
    
    Lưu trữ:
    - Thời gian
    - Vị trí (lat, lon)
    - Khoảng cách
    - Điểm Face ID
    
    Returns:
        Số lần thử mới
    """
```

### send_gps_invalid_notification(...)

```python
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
    """
    Gửi thông báo GPS invalid cho giáo viên
    
    - Nếu giáo viên online → Gửi qua WebSocket
    - Nếu giáo viên offline → Lưu vào database
    """
```

---

## 6. Các Hằng Số Quan Trọng

```python
# File: backend/main.py

# Face ID
SIMILARITY_THRESHOLD = 0.73  # 73% - Ngưỡng khớp khuôn mặt

# GPS
DEFAULT_LOCATION = {
    "latitude": 16.0544,
    "longitude": 108.2022,
    "radius_meters": 100,
    "name": "VKU"
}

# GPS Invalid Attempts
MAX_GPS_INVALID_ATTEMPTS = 2  # Tối đa 2 lần thử GPS invalid mỗi ngày
```

---

## 7. Luồng Quyết Định

```
START: Sinh viên gửi request điểm danh
  ↓
[BƯỚC 0] Face ID đã thiết lập?
  ├─ KHÔNG → ❌ "Chưa thiết lập Face ID"
  └─ CÓ ↓
  
[BƯỚC 1] Giải mã ảnh thành công?
  ├─ KHÔNG → ❌ "Ảnh không hợp lệ"
  └─ CÓ ↓
  
[BƯỚC 2] Liveness check
  └─ PASS ↓
  
[BƯỚC 3] Deepfake detection
  └─ PASS ↓
  
[BƯỚC 4] Face Embedding Verification
  ├─ KHÔNG (< 73%) → ❌ "Khuôn mặt không khớp" (403)
  └─ CÓ (≥ 73%) ↓
  
[BƯỚC 5] GPS Validation
  ├─ KHÔNG → Kiểm tra lần thử
  │   ├─ Hết lần thử (≥ 2) → ❌ "Đã hết số lần thử"
  │   └─ Còn lần thử → Tăng bộ đếm, gửi thông báo, ❌ "GPS không hợp lệ"
  └─ CÓ ↓
  
[BƯỚC 6] Đã điểm danh hôm nay?
  ├─ CÓ → ❌ "Đã điểm danh rồi"
  └─ KHÔNG ↓
  
[BƯỚC 7] Ghi lại điểm danh
  └─ ✅ "Điểm danh thành công"
  
END: Gửi thông báo cho giáo viên
```

---

## 8. Ví Dụ Thực Tế

### Ví Dụ 1: Điểm Danh Thành Công

```
Sinh viên: Nguyễn Văn A
Face ID: Đã thiết lập
Ảnh: Hợp lệ
Liveness: Pass
Deepfake: Pass
Face Similarity: 85% (≥ 73%) ✅
GPS: 45m từ trường (≤ 100m) ✅
Đã điểm danh hôm nay: Chưa

Kết quả: ✅ Điểm danh thành công
Thông báo giáo viên: "Nguyễn Văn A - Điểm danh thành công (85% match, 45m)"
```

### Ví Dụ 2: Khuôn Mặt Không Khớp

```
Sinh viên: Trần Thị B
Face ID: Đã thiết lập
Ảnh: Hợp lệ
Liveness: Pass
Deepfake: Pass
Face Similarity: 65% (< 73%) ❌

Kết quả: ❌ Khuôn mặt không khớp (65%)
HTTP Status: 403 Forbidden
Thông báo: Không gửi cho giáo viên (lỗi Face ID)
```

### Ví Dụ 3: GPS Không Hợp Lệ - Lần Thứ 1

```
Sinh viên: Lê Văn C
Face ID: Đã thiết lập
Ảnh: Hợp lệ
Liveness: Pass
Deepfake: Pass
Face Similarity: 80% (≥ 73%) ✅
GPS: 250m từ trường (> 100m) ❌
Lần thử GPS invalid: 1/2

Kết quả: ❌ GPS không hợp lệ (250m). Còn 1 lần thử.
HTTP Status: 400 Bad Request
Thông báo giáo viên: "Lê Văn C - GPS không hợp lệ (250m từ trường)"
Ghi lại: Lần thử 1 - Vị trí (10.5, 106.5) - Face 80%
```

### Ví Dụ 4: GPS Không Hợp Lệ - Lần Thứ 2 (Hết Lần Thử)

```
Sinh viên: Lê Văn C
Face ID: Đã thiết lập
Ảnh: Hợp lệ
Liveness: Pass
Deepfake: Pass
Face Similarity: 80% (≥ 73%) ✅
GPS: 300m từ trường (> 100m) ❌
Lần thử GPS invalid: 2/2 (HẾT)

Kết quả: ❌ Đã hết số lần thử (2 lần). Vui lòng thử lại vào ngày mai.
HTTP Status: 400 Bad Request
Thông báo giáo viên: "Lê Văn C - GPS không hợp lệ (300m từ trường) - Hết lần thử"
Ghi lại: Lần thử 2 - Vị trí (10.4, 106.4) - Face 80%
```

---

## 9. Tóm Tắt Các Lỗi Có Thể Xảy Ra

| Lỗi | HTTP | error_type | Nguyên Nhân | Giải Pháp |
|-----|------|-----------|-----------|----------|
| Chưa thiết lập Face ID | 400 | - | Sinh viên chưa setup Face ID | Vào mục "Thiết lập Face ID" |
| Ảnh không hợp lệ | 400 | - | Ảnh bị hỏng hoặc không phải ảnh | Chụp lại ảnh |
| Khuôn mặt không khớp | 403 | face_invalid | Face similarity < 73% | Chụp lại ảnh, đảm bảo ánh sáng tốt |
| GPS không hợp lệ (lần 1) | 400 | gps_invalid | Vị trí > 100m từ trường | Di chuyển gần trường, thử lại |
| GPS không hợp lệ (lần 2) | 400 | gps_invalid_max_attempts | Đã thử 2 lần GPS invalid | Thử lại vào ngày mai |
| Đã điểm danh rồi | 400 | - | Sinh viên đã điểm danh hôm nay | Không thể điểm danh lại cùng ngày |

---

## 10. Cấu Hình Có Thể Thay Đổi

Để điều chỉnh quy trình, chỉnh sửa các hằng số trong `backend/main.py`:

```python
# Ngưỡng Face ID (dòng ~50)
SIMILARITY_THRESHOLD = 0.73  # Thay đổi từ 0.73 (73%) sang giá trị khác

# Vị trí trường (dòng ~59)
DEFAULT_LOCATION = {
    "latitude": 16.0544,      # Thay đổi vĩ độ
    "longitude": 108.2022,    # Thay đổi kinh độ
    "radius_meters": 100,     # Thay đổi bán kính (mét)
    "name": "VKU"
}

# Giới hạn lần thử GPS invalid (dòng ~70)
MAX_GPS_INVALID_ATTEMPTS = 2  # Thay đổi từ 2 sang giá trị khác
```

**Ví dụ:** Để cho phép 3 lần thử GPS invalid thay vì 2:
```python
MAX_GPS_INVALID_ATTEMPTS = 3
```

---

## 11. Tích Hợp Frontend

Frontend gửi request đến endpoint này từ `RandomActionAttendanceModal.tsx`:

```typescript
const response = await fetch(`${API_URL}/attendance/checkin`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    class_id: classId,
    latitude: gpsLocation.latitude,
    longitude: gpsLocation.longitude,
    image: base64Image  // Base64 encoded image
  })
});
```

**Xử lý response:**
- Nếu 200 OK → Hiển thị "Điểm danh thành công"
- Nếu 400 Bad Request → Hiển thị lỗi (GPS invalid, đã điểm danh, v.v.)
- Nếu 403 Forbidden → Hiển thị lỗi Face ID

