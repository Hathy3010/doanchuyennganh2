# Implementation Plan: Random Action Attendance with Anti-Fraud

## Overview

Implement a secure attendance check-in system that requires students to perform a randomly selected face action (neutral, blink, mouth open, head movement) combined with comprehensive anti-fraud checks (liveness detection, deepfake detection, GPS validation, face embedding verification).

## Tasks

- [x] 1. Backend: Implement Random Action Selection
  - [x] 1.1 Create POST /attendance/select-action endpoint
    - Select random action from [neutral, blink, mouth_open, head_movement]
    - Ensure fair distribution (25% each)
    - Prevent repetition within 3 check-ins
    - Return action, instruction, timeout
    - _Requirements: 1.1, 1.3_

  - [x] 1.2 Add action selection logic to database
    - Track last 3 actions per student
    - Implement fairness algorithm
    - Log action selection for audit trail
    - _Requirements: 1.1, 1.3_

- [x] 2. Backend: Implement Action Detection & Verification
  - [x] 2.1 Create POST /attendance/verify-action endpoint
    - Accept image and required_action
    - Detect face and action from image
    - Verify action matches requirement
    - Return action_detected, is_correct, confidence
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 2.2 Implement action detection logic
    - Use existing pose_detect module
    - Detect: neutral, blink, mouth_open, head_movement
    - Calculate confidence score
    - Handle edge cases (no face, multiple faces, unclear action)
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 2.3 Add action verification logic
    - Compare detected action with required action
    - Set confidence threshold (≥90%)
    - Return detailed error messages in Vietnamese
    - _Requirements: 3.2, 3.3_

- [x] 3. Backend: Implement Anti-Fraud Checks (Sequential)
  - [x] 3.1 Create POST /attendance/verify-embedding endpoint
    - Accept embedding and student_id
    - Compare with stored embedding
    - Calculate similarity score
    - Return is_match, similarity, message
    - _Requirements: 7.1, 7.2_

  - [x] 3.2 Implement sequential anti-fraud execution
    - Liveness check → Deepfake check → GPS check → Embedding check
    - Fail-fast: stop on first failure
    - Log each check result
    - Return detailed status for each check
    - _Requirements: 4.1, 5.1, 6.1, 7.1_

  - [x] 3.3 Add comprehensive error handling
    - Specific error messages for each check
    - All messages in Vietnamese
    - Include helpful guidance for retry
    - _Requirements: 9.1, 9.2_

- [x] 4. Backend: Implement Attendance Recording
  - [x] 4.1 Update POST /attendance/checkin endpoint
    - Accept action_required parameter
    - Store action in attendance record
    - Store all validation results
    - Store action detection confidence
    - _Requirements: 8.1, 8.2_

  - [x] 4.2 Implement attendance record schema
    - Add action_required field
    - Add action detection results
    - Add all validation results
    - Add retry_count field
    - _Requirements: 8.1, 8.2_

- [ ] 5. Backend: Implement Anti-Fraud Logging
  - [ ] 5.1 Create AntifraudLog schema
    - Log action_required
    - Log all check results (status, confidence, error)
    - Log final_status and failure_reason
    - Log retry_count
    - _Requirements: 10.1, 10.2, 10.3_

  - [ ] 5.2 Implement logging for all checks
    - Log action detection attempt
    - Log liveness check result
    - Log deepfake check result
    - Log GPS check result
    - Log embedding check result
    - _Requirements: 10.1, 10.2, 10.3_

- [ ] 6. Frontend: Create AttendanceCheckInModal Component
  - [ ] 6.1 Implement modal UI
    - Display action instruction
    - Show camera feed
    - Display real-time detection feedback
    - Show countdown timer
    - Display anti-fraud progress
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 6.2 Implement state management
    - selectedAction state
    - isRecording state
    - detectionMessage state
    - retryCount state
    - checkInPhase state
    - checkInStatus state
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 6.3 Implement action selection logic
    - Call POST /attendance/select-action
    - Display selected action instruction
    - Start countdown timer
    - _Requirements: 1.1, 1.2_

- [ ] 7. Frontend: Implement Action Detection Flow
  - [ ] 7.1 Implement frame capture loop
    - Capture frames every 500ms
    - Send to POST /attendance/verify-action
    - Display real-time feedback
    - Check if action is detected
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ] 7.2 Implement action verification logic
    - Check if detected action matches required action
    - Check confidence ≥90%
    - Display success/failure message
    - Proceed to anti-fraud checks on success
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ] 7.3 Implement retry mechanism
    - Allow max 3 retries
    - Reset state on retry
    - Display retry count
    - Close modal after max retries
    - _Requirements: 3.3, 9.2_

- [ ] 8. Frontend: Implement Anti-Fraud Checks UI
  - [ ] 8.1 Create AntifraudProgress component
    - Display progress for each check
    - Show status icons (🔄 loading, ✅ pass, ❌ fail)
    - Display current check name
    - _Requirements: 2.2, 2.3_

  - [ ] 8.2 Implement anti-fraud check flow
    - Call liveness check
    - Call deepfake check
    - Call GPS validation
    - Call embedding verification
    - Display progress in real-time
    - _Requirements: 4.1, 5.1, 6.1, 7.1_

  - [ ] 8.3 Implement error handling
    - Display specific error message for each failed check
    - Allow retry on failure
    - Log failure reason
    - _Requirements: 9.1, 9.2_

- [ ] 9. Frontend: Implement GPS Integration
  - [ ] 9.1 Request GPS permission
    - Request location permission on first check-in
    - Handle permission denied
    - Display GPS status
    - _Requirements: 6.1_

  - [ ] 9.2 Get GPS location
    - Get device GPS coordinates
    - Send to POST /attendance/validate-gps
    - Display GPS validation result
    - _Requirements: 6.1, 6.2, 6.3_

- [ ] 10. Frontend: Update Dashboard
  - [ ] 10.1 Update attendance status after check-in
    - Refresh dashboard after successful check-in
    - Display "present" status
    - Show check-in time
    - _Requirements: 8.3_

  - [ ] 10.2 Add real-time notifications
    - Listen for WebSocket notifications from backend
    - Display success/failure message
    - Update attendance status in real-time
    - _Requirements: 8.3_

- [ ] 11. Checkpoint - Verify Action Detection
  - Test action detection with various face movements
  - Verify detection accuracy (≥90%)
  - Verify error messages are correct
  - Ask the user if questions arise

- [ ]* 12. Write Unit Tests
  - [ ]* 12.1 Test random action selection
    - Test fairness (each action ~25%)
    - Test no repetition within 3 check-ins
    - _Requirements: 1.1, 1.3_

  - [ ]* 12.2 Test action detection
    - Test neutral detection
    - Test blink detection
    - Test mouth_open detection
    - Test head_movement detection
    - _Requirements: 3.1, 3.2_

  - [ ]* 12.3 Test anti-fraud checks
    - Test liveness detection
    - Test deepfake detection
    - Test GPS validation
    - Test embedding verification
    - _Requirements: 4.1, 5.1, 6.1, 7.1_

  - [ ]* 12.4 Test error handling
    - Test all error messages
    - Test retry mechanism
    - Test max retries exceeded
    - _Requirements: 9.1, 9.2_

- [ ] 13. Write Property Tests
  - [ ] 13.1 Property test for random action fairness
    - **Property 1: Random Action Selection Fairness**
    - **Validates: Requirements 1.1, 1.3**
    - Generate 100+ check-in attempts
    - Verify each action selected ~25% of time
    - Verify no repetition within 3 check-ins

  - [ ] 13.2 Property test for action detection accuracy
    - **Property 2: Action Detection Accuracy**
    - **Validates: Requirements 3.1, 3.2**
    - Generate 50+ test frames with correct actions
    - Verify detection confidence ≥90%
    - Verify detection within 2 seconds

  - [ ] 13.3 Property test for liveness consistency
    - **Property 3: Liveness Detection Consistency**
    - **Validates: Requirements 4.1, 4.2**
    - Generate 100+ live frames
    - Generate 50+ static images
    - Verify live frames score ≥0.6
    - Verify static images score <0.6

  - [ ] 13.4 Property test for deepfake accuracy
    - **Property 4: Deepfake Detection Accuracy**
    - **Validates: Requirements 5.1, 5.2**
    - Generate 50+ real faces
    - Generate 50+ AI-generated faces
    - Verify real faces confidence <50%
    - Verify AI-generated faces confidence >50%

  - [ ] 13.5 Property test for GPS validation
    - **Property 5: GPS Validation Correctness**
    - **Validates: Requirements 6.1, 6.2, 6.3**
    - Generate 100+ random GPS locations
    - Verify locations within 100m pass
    - Verify locations >100m fail

  - [ ] 13.6 Property test for embedding verification
    - **Property 6: Face Embedding Verification**
    - **Validates: Requirements 7.1, 7.2**
    - Generate 100+ frame pairs from same person
    - Generate 100+ frame pairs from different people
    - Verify same person similarity ≥90%
    - Verify different people similarity <90%

  - [ ] 13.7 Property test for sequential execution
    - **Property 7: Anti-Fraud Sequential Execution**
    - **Validates: Requirements 4.2, 5.3, 6.4, 7.3, 9.2**
    - Generate 100+ check-in attempts
    - Verify failed checks don't proceed
    - Verify attendance not recorded on failure

  - [ ] 13.8 Property test for atomicity
    - **Property 8: Attendance Recording Atomicity**
    - **Validates: Requirements 8.1, 8.2**
    - Generate 50+ concurrent check-ins
    - Verify all or nothing recording
    - Verify no partial data

  - [ ] 13.9 Property test for error messages
    - **Property 9: Error Message Specificity**
    - **Validates: Requirements 9.1**
    - Generate all error cases
    - Verify error message indicates which check failed
    - Verify all messages in Vietnamese

  - [ ] 13.10 Property test for audit trail
    - **Property 10: Audit Trail Completeness**
    - **Validates: Requirements 10.1, 10.2, 10.3**
    - Generate 100+ check-in attempts
    - Verify all results logged
    - Verify timestamps recorded

- [ ] 14. Checkpoint - Ensure All Tests Pass
  - Ensure all unit tests pass
  - Ensure all property tests pass
  - Ask the user if questions arise

- [ ] 15. Test End-to-End Flow
  - Test complete check-in flow (success case)
  - Test check-in with action detection failure
  - Test check-in with liveness check failure
  - Test check-in with deepfake detection failure
  - Test check-in with GPS validation failure
  - Test check-in with embedding verification failure
  - Test retry mechanism (max 3 attempts)
  - Test real-time teacher notification
  - Test dashboard update after check-in
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1, 10.1_

- [ ] 16. Final Checkpoint - Ensure All Tests Pass
  - Ensure all tests pass
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- All user-facing messages must be in Vietnamese
- Action timeout: 10 seconds per attempt
- Max retries: 3 attempts per check-in session
- GPS radius: 100 meters from school
- Embedding similarity threshold: ≥ 90%
- Liveness threshold: ≥ 0.6
- Deepfake threshold: < 50% confidence
