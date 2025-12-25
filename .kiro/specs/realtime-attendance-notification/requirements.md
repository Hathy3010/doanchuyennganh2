# Requirements Document

## Introduction

Tính năng này cải tiến hệ thống thông báo điểm danh real-time giữa sinh viên và giáo viên. Khi sinh viên điểm danh xong (thành công hoặc thất bại), hệ thống sẽ gửi thông báo ngay lập tức đến giáo viên qua WebSocket, và dashboard của giáo viên sẽ tự động cập nhật mà không cần refresh. Đồng thời, cải tiến pose diversity trong Face ID setup để hoạt động ổn định hơn.

## Glossary

- **WebSocket**: Giao thức kết nối hai chiều cho phép server gửi dữ liệu đến client mà không cần client request
- **Real-time_Notification**: Thông báo được gửi ngay lập tức khi có sự kiện xảy ra
- **Pose_Diversity**: Đa dạng góc độ khuôn mặt trong quá trình thiết lập Face ID
- **Teacher_Dashboard**: Giao diện quản lý của giáo viên hiển thị danh sách sinh viên và trạng thái điểm danh
- **Student_Modal**: Modal điểm danh của sinh viên (RandomActionAttendanceModal)
- **ConnectionManager**: Module quản lý kết nối WebSocket trên backend

## Requirements

### Requirement 1: Real-time Attendance Result Display

**User Story:** As a student, I want to see the attendance result immediately after check-in, so that I know if my attendance was recorded successfully.

#### Acceptance Criteria

1. WHEN a student completes the check-in process, THE Student_Modal SHALL display the result (success/failure) within 2 seconds
2. WHEN check-in is successful, THE Student_Modal SHALL show "✅ Điểm danh thành công!" with green styling
3. WHEN check-in fails due to Face ID mismatch, THE Student_Modal SHALL show "❌ Face ID không khớp" with red styling
4. WHEN check-in fails due to GPS invalid, THE Student_Modal SHALL show "⚠️ GPS không hợp lệ" with orange styling
5. THE Student_Modal SHALL display validation details (Face ID score, GPS distance) in the result

### Requirement 2: Instant Teacher Notification via WebSocket

**User Story:** As a teacher, I want to receive instant notifications when students check in, so that I can monitor attendance in real-time without refreshing.

#### Acceptance Criteria

1. WHEN a student successfully checks in, THE Backend SHALL send a WebSocket notification to the teacher within 500ms
2. WHEN a student fails check-in (GPS invalid), THE Backend SHALL send a WebSocket notification to the teacher immediately
3. THE WebSocket notification SHALL include: student_name, class_name, status, timestamp, validation_details
4. IF the teacher is not connected via WebSocket, THEN THE Backend SHALL store the notification as pending
5. WHEN the teacher reconnects, THE Backend SHALL deliver all pending notifications

### Requirement 3: Auto-refresh Teacher Dashboard

**User Story:** As a teacher, I want my dashboard to automatically update when students check in, so that I don't need to manually refresh.

#### Acceptance Criteria

1. WHEN the Teacher_Dashboard receives a WebSocket notification, THE Dashboard SHALL update the student list automatically
2. WHEN a new attendance record is received, THE Dashboard SHALL add/update the student's status in the list
3. THE Dashboard SHALL show a visual indicator (toast/badge) when new attendance is received
4. THE Dashboard SHALL update attendance summary counts (present/absent) automatically
5. WHEN WebSocket disconnects, THE Dashboard SHALL attempt to reconnect automatically every 5 seconds

### Requirement 4: Clean Pose Diversity for Face ID Setup

**User Story:** As a student, I want the Face ID setup process to be smooth and not crash, so that I can complete setup without issues.

#### Acceptance Criteria

1. THE Face_ID_Setup SHALL accept frames with minimal pose diversity (yaw_range >= 0.5°, pitch_range >= 0.5°)
2. THE Face_ID_Setup SHALL handle invalid frames gracefully without crashing
3. WHEN a frame fails validation, THE Face_ID_Setup SHALL skip it and continue with next frame
4. THE Face_ID_Setup SHALL require minimum 8 valid frames (reduced from 15)
5. THE Face_ID_Setup SHALL provide clear error messages in Vietnamese when setup fails
6. THE Face_ID_Setup SHALL log pose diversity metrics for debugging

### Requirement 5: WebSocket Connection Management

**User Story:** As a system administrator, I want reliable WebSocket connections, so that real-time notifications work consistently.

#### Acceptance Criteria

1. WHEN a teacher logs in, THE Frontend SHALL establish WebSocket connection using the correct teacher ID
2. THE Backend SHALL use teacher's MongoDB ObjectId (as string) for WebSocket identification
3. THE Frontend SHALL use `currentUser.id` (from /auth/me response) for WebSocket connection
4. WHEN WebSocket connection fails, THE Frontend SHALL retry connection with exponential backoff
5. THE Backend SHALL log all WebSocket connection/disconnection events for debugging

### Requirement 6: Notification Message Format

**User Story:** As a teacher, I want clear and informative notifications, so that I can quickly understand the attendance status.

#### Acceptance Criteria

1. THE notification message SHALL include: type, class_id, student_id, student_name, status, timestamp, message
2. FOR successful attendance, THE message SHALL be "✅ Điểm danh thành công"
3. FOR GPS invalid attendance, THE message SHALL include distance from school in meters
4. FOR Face ID invalid attendance, THE message SHALL include similarity percentage
5. THE notification SHALL include validation_details object with face and gps sub-objects

## Non-Functional Requirements

### Performance
- WebSocket notification delivery: < 500ms
- Dashboard update after notification: < 100ms
- Face ID setup completion: < 30 seconds

### Reliability
- WebSocket reconnection: automatic with 5-second interval
- Pending notification storage: persist until delivered
- Error handling: graceful degradation without crashes

### Usability
- All messages in Vietnamese
- Clear visual feedback for all states
- Consistent styling across student and teacher interfaces
