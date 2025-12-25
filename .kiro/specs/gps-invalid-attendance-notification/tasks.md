# Implementation Plan: GPS Invalid Attendance with Teacher Notification

## Overview

Triển khai tính năng xử lý điểm danh với GPS không hợp lệ nhưng Face ID hợp lệ, bao gồm giới hạn số lần thử, thông báo realtime cho giáo viên, và audit logging.

## Tasks

- [x] 1. Setup database collections và models
  - [x] 1.1 Tạo collection `gps_invalid_attempts` trong database.py
    - Thêm collection reference cho tracking số lần thử GPS-invalid
    - _Requirements: 2.1_
  - [x] 1.2 Tạo collection `gps_invalid_audit_logs` trong database.py
    - Thêm collection reference cho audit logging
    - _Requirements: 7.3_
  - [x] 1.3 Tạo Pydantic models trong models.py
    - GPSInvalidAttempt, AttemptDetail, GPSInvalidNotification models
    - _Requirements: 2.1, 3.2, 7.2_

- [x] 2. Implement GPS-invalid attempt tracking
  - [x] 2.1 Tạo helper functions trong main.py
    - `get_gps_invalid_attempt_count()` - lấy số lần thử hiện tại
    - `increment_gps_invalid_attempt()` - tăng counter và lưu chi tiết
    - `check_gps_invalid_limit()` - kiểm tra đã đạt giới hạn chưa
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [ ]* 2.2 Write property test cho attempt counter
    - **Property 2: Attempt Counter Consistency**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [x] 3. Modify attendance/checkin endpoint
  - [x] 3.1 Cập nhật logic GPS validation trong `/attendance/checkin`
    - Thêm check GPS-invalid limit trước khi validate
    - Phân biệt error_type "gps_invalid" vs "face_invalid"
    - Return remaining_attempts trong response
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.2, 2.3_
  - [ ]* 3.2 Write property test cho GPS-invalid rejection
    - **Property 1: GPS-Invalid Attendance Rejection**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

- [x] 4. Implement teacher notification system
  - [x] 4.1 Tạo function `send_gps_invalid_notification()` trong main.py
    - Kiểm tra student enrollment trong class
    - Tạo notification payload với tất cả required fields
    - Gửi qua WebSocket manager
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 4.3_
  - [x] 4.2 Tạo collection `pending_notifications` cho offline teachers
    - Lưu notification khi teacher không connected
    - _Requirements: 3.4_
  - [x] 4.3 Cập nhật WebSocket endpoint để gửi pending notifications khi reconnect
    - Gửi tất cả pending notifications khi teacher connect
    - _Requirements: 3.4_
  - [ ]* 4.4 Write property test cho notification delivery
    - **Property 3: Teacher Notification Delivery**
    - **Validates: Requirements 3.1, 3.2, 3.3**
  - [ ]* 4.5 Write property test cho enrollment verification
    - **Property 4: Enrollment Verification in Notifications**
    - **Validates: Requirements 4.1, 4.2, 4.3**

- [x] 5. Implement audit logging
  - [x] 5.1 Tạo function `log_gps_invalid_attempt()` trong main.py
    - Log tất cả required fields vào gps_invalid_audit_logs collection
    - _Requirements: 7.1, 7.2, 7.3_
  - [ ]* 5.2 Write property test cho audit logging
    - **Property 5: Audit Log Completeness**
    - **Validates: Requirements 7.1, 7.2, 7.3**

- [x] 6. Checkpoint - Backend tests
  - Ensure all backend tests pass, ask the user if questions arise.

- [x] 7. Update frontend RandomActionAttendanceModal
  - [x] 7.1 Thêm state và logic xử lý GPS-invalid response
    - Parse error_type và remaining_attempts từ response
    - Hiển thị distance và số lần còn lại
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 7.2 Thêm UI cho max attempts reached
    - Hiển thị message khi hết lượt thử
    - Disable retry button
    - _Requirements: 5.3, 5.4_

- [x] 8. Update frontend Teacher Dashboard
  - [x] 8.1 Thêm handler cho notification type "gps_invalid_attendance"
    - Parse và hiển thị GPS-invalid notifications
    - _Requirements: 6.1, 6.3_
  - [x] 8.2 Thêm styling phân biệt GPS-invalid notifications
    - Màu sắc/icon khác với successful attendance
    - Hiển thị warning flags nếu có
    - _Requirements: 6.2, 6.3_
  - [x] 8.3 Đảm bảo real-time update không cần refresh
    - WebSocket listener đã có, chỉ cần handle new notification type
    - _Requirements: 6.4_

- [ ] 9. Final checkpoint - Integration testing
  - Ensure all tests pass, ask the user if questions arise.
  - Test end-to-end flow: Student GPS-invalid → Teacher notification
  - Test attempt limit: 3 attempts, verify blocking

## Notes

- Tasks marked with `*` are optional property-based tests
- Backend implementation (Tasks 1-5) should be completed before frontend (Tasks 7-8)
- WebSocket manager đã có sẵn trong main.py, chỉ cần extend
- GPS validation function `validate_gps()` đã có sẵn
- Sử dụng Python cho backend, TypeScript/React Native cho frontend
