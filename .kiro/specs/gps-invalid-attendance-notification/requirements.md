# Requirements Document

## Introduction

Tính năng này xử lý trường hợp sinh viên điểm danh với Face ID hợp lệ nhưng vị trí GPS không hợp lệ (quá xa trường). Hệ thống sẽ:
1. Cho phép sinh viên thử điểm danh tối đa 2 lần khi GPS không hợp lệ
2. Hiển thị thông báo điểm danh không thành công cho sinh viên
3. Gửi thông báo realtime đến giáo viên dạy môn học đó với thông tin chi tiết về sinh viên và lý do thất bại

## Glossary

- **Attendance_System**: Hệ thống điểm danh thông minh
- **Student**: Sinh viên sử dụng ứng dụng để điểm danh
- **Teacher**: Giáo viên nhận thông báo điểm danh từ sinh viên trong lớp mình dạy
- **GPS_Validator**: Module kiểm tra vị trí GPS của sinh viên so với vị trí trường
- **Face_ID_Validator**: Module xác minh khuôn mặt sinh viên
- **WebSocket_Manager**: Module quản lý kết nối WebSocket để gửi thông báo realtime
- **Failed_Attendance_Counter**: Bộ đếm số lần điểm danh thất bại do GPS không hợp lệ

## Requirements

### Requirement 1: GPS Invalid Detection with Valid Face ID

**User Story:** As a student, I want to be notified when my attendance fails due to invalid GPS location even though my Face ID is valid, so that I understand why my attendance was not recorded.

#### Acceptance Criteria

1. WHEN a student submits attendance with valid Face ID but invalid GPS location, THEN THE Attendance_System SHALL reject the attendance and return a clear error message indicating GPS is invalid
2. WHEN GPS validation fails, THE Attendance_System SHALL include the distance from school in the error message
3. WHEN Face ID is valid but GPS is invalid, THE Attendance_System SHALL NOT record the attendance as successful
4. THE Attendance_System SHALL distinguish between "Face ID invalid" and "GPS invalid" error types in the response

### Requirement 2: Failed Attendance Attempt Limit

**User Story:** As a system administrator, I want to limit the number of failed attendance attempts due to invalid GPS, so that I can prevent abuse and track suspicious behavior.

#### Acceptance Criteria

1. THE Failed_Attendance_Counter SHALL track the number of GPS-invalid attendance attempts per student per class per day
2. WHEN a student exceeds 2 failed GPS-invalid attendance attempts for a class in a day, THEN THE Attendance_System SHALL block further attempts and display a message indicating the limit has been reached
3. WHEN a student has remaining attempts, THE Attendance_System SHALL display the number of remaining attempts in the error message
4. THE Failed_Attendance_Counter SHALL reset at the start of each new day

### Requirement 3: Real-time Teacher Notification

**User Story:** As a teacher, I want to receive real-time notifications when my students attempt to check in with invalid GPS but valid Face ID, so that I can monitor attendance fraud attempts.

#### Acceptance Criteria

1. WHEN a student's attendance fails due to invalid GPS (with valid Face ID), THEN THE WebSocket_Manager SHALL send a notification to the teacher of that class
2. THE notification SHALL include: student username, student full name, class name, timestamp, GPS distance from school, and status message
3. THE notification SHALL be sent only to teachers who are teaching the class that the student is trying to check in to
4. WHEN the teacher is not connected via WebSocket, THE Attendance_System SHALL store the notification for later retrieval

### Requirement 4: Student Lookup in Class Roster

**User Story:** As a teacher, I want to see if the student attempting to check in is actually enrolled in my class, so that I can verify the legitimacy of the attendance attempt.

#### Acceptance Criteria

1. WHEN sending a notification to the teacher, THE Attendance_System SHALL verify that the student is enrolled in the class
2. THE notification SHALL indicate whether the student is found in the class roster
3. IF the student is not enrolled in the class, THE notification SHALL include a warning flag

### Requirement 5: Frontend Display for Failed Attendance

**User Story:** As a student, I want to see clear feedback when my attendance fails due to GPS issues, so that I understand what went wrong and how many attempts I have left.

#### Acceptance Criteria

1. WHEN attendance fails due to invalid GPS, THE RandomActionAttendanceModal SHALL display a clear error message with the GPS distance
2. THE modal SHALL display the number of remaining attempts (e.g., "Còn 1 lần thử")
3. WHEN all attempts are exhausted, THE modal SHALL display a message indicating no more attempts are allowed today
4. THE modal SHALL provide an option to close and try again later (if attempts remain)

### Requirement 6: Teacher Dashboard Notification Display

**User Story:** As a teacher, I want to see GPS-invalid attendance attempts in my dashboard, so that I can review them alongside successful attendance records.

#### Acceptance Criteria

1. WHEN a GPS-invalid attendance notification is received, THE Teacher_Dashboard SHALL display it in the notifications section
2. THE notification SHALL be visually distinguished from successful attendance notifications (e.g., different color/icon)
3. THE notification SHALL show: student name, class name, time, and "GPS không hợp lệ" status
4. THE Teacher_Dashboard SHALL update in real-time without requiring page refresh

### Requirement 7: Audit Logging for GPS-Invalid Attempts

**User Story:** As a system administrator, I want all GPS-invalid attendance attempts to be logged, so that I can review suspicious patterns.

#### Acceptance Criteria

1. WHEN a GPS-invalid attendance attempt occurs, THE Attendance_System SHALL log the attempt with full details
2. THE log SHALL include: student_id, class_id, timestamp, GPS coordinates, distance from school, Face ID validation result, and attempt number
3. THE log SHALL be stored in a separate collection for audit purposes
