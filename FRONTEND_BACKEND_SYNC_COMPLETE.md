# Frontend-Backend Synchronization Complete

## Ngày: 25/12/2024

## Tóm tắt các thay đổi

### 1. Backend - Thêm endpoints mới (backend/main.py)

#### `/student/check-in` (POST)
- **Mục đích**: Endpoint điểm danh đơn giản cho frontend student.tsx
- **Request body**:
  ```json
  {
    "class_id": "string",
    "latitude": number,
    "longitude": number
  }
  ```
- **Flow**:
  1. Kiểm tra Face ID đã thiết lập
  2. Xác thực GPS
  3. Kiểm tra đã điểm danh chưa
  4. Ghi nhận điểm danh

#### `/attendance/checkin` (POST)
- **Mục đích**: Endpoint điểm danh với xác minh khuôn mặt cho RandomActionAttendanceModal
- **Request body**:
  ```json
  {
    "class_id": "string",
    "latitude": number,
    "longitude": number,
    "image": "base64_string"
  }
  ```
- **Flow**:
  1. Kiểm tra Face ID đã thiết lập
  2. Giải mã ảnh
  3. Kiểm tra liveness
  4. Kiểm tra deepfake
  5. Xác thực GPS
  6. Xác minh embedding khuôn mặt (≥90%)
  7. Ghi nhận điểm danh

### 2. Frontend - Cập nhật (frontend/app/(tabs)/student.tsx)

#### Thay đổi `handleCheckIn`
- Kiểm tra Face ID đã thiết lập trước khi điểm danh
- Nếu chưa có Face ID → hiển thị alert yêu cầu thiết lập
- Nếu có Face ID → mở modal RandomActionAttendanceModal để xác minh khuôn mặt

#### Thêm hàm `handleSimpleCheckIn`
- Điểm danh đơn giản chỉ với GPS (fallback/testing)

### 3. Frontend - Cập nhật RandomActionAttendanceModal

#### Cải tiến GPS
- Sử dụng `expo-location` để lấy GPS thực từ thiết bị
- Yêu cầu quyền location khi mở modal
- Hiển thị tọa độ GPS trên UI

#### Cải tiến UX
- Thêm phase `init` để khởi tạo permissions
- Hiển thị thông tin lớp học (tên, giờ, phòng)
- Hiển thị số lần thử lại
- Error messages rõ ràng hơn

#### Flow điểm danh Face ID + GPS
1. Mở modal → Yêu cầu quyền camera + location
2. Lấy GPS từ thiết bị
3. Hiển thị camera với hướng dẫn
4. Chụp ảnh khuôn mặt
5. Gửi lên server với GPS + ảnh
6. Server xác minh: Liveness → Deepfake → GPS → Face Embedding
7. Thành công → Ghi nhận điểm danh

## Mapping Endpoints Frontend → Backend

| Frontend Call | Backend Endpoint | Status |
|--------------|------------------|--------|
| `GET /auth/me` | `/auth/me` | ✅ Có sẵn |
| `GET /student/dashboard` | `/student/dashboard` | ✅ Có sẵn |
| `POST /student/setup-faceid` | `/student/setup-faceid` | ✅ Có sẵn |
| `POST /student/check-in` | `/student/check-in` | ✅ **MỚI THÊM** |
| `POST /attendance/checkin` | `/attendance/checkin` | ✅ **MỚI THÊM** |
| `POST /detect_face_pose_and_expression` | `/detect_face_pose_and_expression` | ✅ Có sẵn |

## Flow điểm danh hoàn chỉnh

```
┌─────────────────────────────────────────────────────────────┐
│                    STUDENT DASHBOARD                         │
├─────────────────────────────────────────────────────────────┤
│  1. Kiểm tra Face ID đã thiết lập (GET /auth/me)            │
│     └─ has_face_id: true/false                              │
│                                                              │
│  2. Nếu chưa có Face ID:                                    │
│     └─ Hiển thị banner "Thiết lập Face ID"                  │
│     └─ Click → Mở Face Setup Modal                          │
│                                                              │
│  3. Click "Điểm danh" trên lớp học:                         │
│     └─ Nếu chưa có Face ID → Alert yêu cầu thiết lập        │
│     └─ Nếu có Face ID → Mở RandomActionAttendanceModal      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              RANDOM ACTION ATTENDANCE MODAL                  │
├─────────────────────────────────────────────────────────────┤
│  Phase 1: INIT                                               │
│  ├─ Yêu cầu quyền Camera                                    │
│  ├─ Yêu cầu quyền Location                                  │
│  └─ Lấy GPS từ thiết bị (expo-location)                     │
│                                                              │
│  Phase 2: SELECTING                                          │
│  ├─ Hiển thị camera (front-facing)                          │
│  ├─ Hiển thị thông tin lớp học                              │
│  ├─ Hiển thị tọa độ GPS                                     │
│  └─ Nút "Chụp ảnh"                                          │
│                                                              │
│  Phase 3: DETECTING                                          │
│  └─ Chụp ảnh khuôn mặt                                      │
│                                                              │
│  Phase 4: ANTIFRAUD                                          │
│  ├─ Gửi POST /attendance/checkin                            │
│  │   └─ { class_id, latitude, longitude, image }            │
│  ├─ Server xác minh:                                        │
│  │   ├─ ✅ Liveness check                                   │
│  │   ├─ ✅ Deepfake detection                               │
│  │   ├─ ✅ GPS validation                                   │
│  │   └─ ✅ Face embedding (≥90%)                            │
│  └─ Hiển thị kết quả validation                             │
│                                                              │
│  Phase 5: RECORDING (Success)                                │
│  └─ Hiển thị "Điểm danh thành công!"                        │
└─────────────────────────────────────────────────────────────┘
```

## Cách test

1. Khởi động backend:
   ```bash
   cd backend
   py main.py
   ```

2. Khởi động frontend:
   ```bash
   cd frontend
   npx expo start
   ```

3. Test flow:
   - Đăng nhập với tài khoản student
   - Nếu chưa có Face ID → Thiết lập Face ID (15 frames)
   - Click "Điểm danh" trên lớp học
   - Chụp ảnh khuôn mặt
   - Xác minh thành công → Điểm danh hoàn tất

## Lưu ý

- Tất cả error messages đều bằng tiếng Việt
- Face ID setup yêu cầu tối thiểu 10 ảnh
- Check-in yêu cầu Face ID đã được thiết lập
- GPS validation sử dụng DEFAULT_LOCATION (có thể cấu hình)
- Embedding similarity threshold: 90%
- Cho phép retry 3 lần nếu xác minh thất bại
