# Implementation Plan: Real-time Attendance Notification

## Overview

Kế hoạch triển khai hệ thống thông báo điểm danh real-time với các cải tiến cho WebSocket, pose diversity, và auto-refresh dashboard.

## Tasks

- [x] 1. Fix WebSocket Connection ID Issue
  - [x] 1.1 Update backend /auth/me to return consistent ID format
    - Ensure response includes both `id` and `_id` fields
    - Both should be MongoDB ObjectId as string
    - _Requirements: 5.2, 5.3_
  
  - [x] 1.2 Update frontend teacher.tsx WebSocket connection
    - Use `currentUser.id` (from /auth/me response)
    - Add fallback to `currentUser._id` for compatibility
    - _Requirements: 5.1, 5.3_
  
  - [x] 1.3 Update frontend teacher-class-detail.tsx WebSocket connection
    - Same fix as teacher.tsx
    - _Requirements: 5.1, 5.3_

- [x] 2. Enhance Backend Notification System
  - [x] 2.1 Add notification logging in broadcast_to_class_teachers
    - Log teacher_id being searched
    - Log active connections list
    - Log notification delivery status
    - _Requirements: 5.5_
  
  - [x] 2.2 Ensure notification includes all required fields
    - Add validation_details to all notifications
    - Include face and gps sub-objects
    - Add timestamp field
    - _Requirements: 2.3, 6.1, 6.5_
  
  - [x] 2.3 Add send_pending_notifications function
    - Query pending_notifications for teacher_id
    - Send all undelivered notifications
    - Mark as delivered after successful send
    - _Requirements: 2.5_

- [x] 3. Improve Frontend Notification Handling
  - [x] 3.1 Update teacher.tsx handleAttendanceUpdate
    - Handle both 'attendance_update' and 'gps_invalid_attendance' types
    - Update recentNotifications state
    - Update attendanceSummary counts
    - Show toast notification with validation_details
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [x] 3.2 Update teacher-class-detail.tsx handleAttendanceUpdate
    - Update attendanceRecords state with new record
    - Show status badge (present/gps_invalid/face_invalid)
    - Extract validation_details from notification
    - _Requirements: 3.1, 3.2_
  
  - [x] 3.3 Add WebSocket reconnection with exponential backoff
    - Start with 5 second delay
    - Double delay on each failure (max 60 seconds)
    - Reset delay on successful connection
    - _Requirements: 3.5, 5.4_

- [x] 4. Clean Pose Diversity Implementation
  - [x] 4.1 Update pose diversity threshold in backend/main.py
    - Change yaw_range threshold from 1° to 0.5°
    - Change pitch_range threshold from 1° to 0.5°
    - Add try-catch around pose diversity check
    - _Requirements: 4.1_
  
  - [x] 4.2 Reduce minimum valid frames requirement
    - Already set to 8 valid frames (was 15)
    - Error message already reflects new requirement
    - _Requirements: 4.4_
  
  - [x] 4.3 Add graceful error handling for invalid frames
    - Wrap frame processing in try-catch
    - Skip invalid frames instead of failing
    - Log skipped frames for debugging
    - _Requirements: 4.2, 4.3_
  
  - [x] 4.4 Improve Vietnamese error messages
    - Updated error message to be clear and helpful
    - Include specific values (yaw, pitch)
    - _Requirements: 4.5, 4.6_

- [x] 5. Enhance Student Modal Result Display
  - [x] 5.1 Add result phase to RandomActionAttendanceModal
    - Create new 'result' phase after check-in completes
    - Display success/failure with appropriate styling
    - Show validation details (Face ID score, GPS distance)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [x] 5.2 Add result styling
    - Green styling for success
    - Red styling for Face ID failure
    - Orange styling for GPS invalid
    - _Requirements: 1.2, 1.3, 1.4_

- [x] 6. Checkpoint - Test WebSocket Flow
  - Ensure all tests pass, ask the user if questions arise.
  - Test: Student check-in → Backend notification → Teacher receives update
  - Verify dashboard updates without refresh

- [ ]* 7. Property Tests
  - [ ]* 7.1 Write property test for notification field validation
    - **Property 1: Notification Contains Required Fields**
    - **Validates: Requirements 2.3, 6.1**
  
  - [ ]* 7.2 Write property test for pose diversity threshold
    - **Property 7: Pose Diversity Threshold Acceptance**
    - **Validates: Requirements 4.1, 4.4**
  
  - [ ]* 7.3 Write property test for invalid frame handling
    - **Property 8: Invalid Frame Handling**
    - **Validates: Requirements 4.2, 4.3**

- [ ] 8. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.
  - Verify end-to-end flow works correctly
  - Test reconnection scenarios

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
