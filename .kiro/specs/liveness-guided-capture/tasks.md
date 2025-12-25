# Implementation Plan: Liveness-Guided Face Capture

## Overview

Implement liveness detection flow để xác minh người dùng là người sống trước khi chụp ảnh chính thức cho Face ID setup. Quy trình gồm phát hiện hoạt động khuôn mặt (blink, smile, head movement), tính liveness score, và hướng dẫn người dùng nhìn thẳng để chụp.

## Tasks

- [x] 1. Create Liveness Detection Backend Components
  - [x] 1.1 Implement EyeBlinkDetector class
    - Calculate eye aspect ratio (EAR) from facial landmarks
    - Detect blink when EAR drops below threshold (0.2)
    - Track blink count across frames
    - _Requirements: 2.1_

  - [x] 1.2 Implement MouthMovementDetector class
    - Calculate mouth aspect ratio (MAR) from facial landmarks
    - Detect smile/open mouth when MAR exceeds threshold (0.5)
    - Track mouth movement count across frames
    - _Requirements: 2.2_

  - [x] 1.3 Implement HeadMovementTracker class
    - Track pose angles (yaw, pitch, roll) across frames
    - Detect significant head movement (> 5 degrees change)
    - Track head movement count across frames
    - _Requirements: 2.3_

  - [x] 1.4 Implement LivenessScoreCalculator class
    - Combine indicators: blink_count, mouth_movement_count, head_movement_count
    - Calculate weighted score (0-1)
    - Default weights: blink 0.4, mouth 0.3, head_movement 0.3
    - Apply threshold 0.6 for liveness verified
    - _Requirements: 1.2, 1.3_

- [x] 2. Create Liveness Detection Endpoint
  - [x] 2.1 Add `/detect_liveness` POST endpoint
    - Accept base64-encoded frame
    - Call LivenessAnalyzer to detect face and indicators
    - Calculate liveness score
    - Return response with all required fields
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 2.2 Implement error handling for liveness endpoint
    - Handle no face detected
    - Handle multiple faces (use largest)
    - Handle invalid base64
    - Return appropriate error messages in Vietnamese
    - _Requirements: 6.5_

  - [x] 2.3 Add liveness threshold configuration
    - Make threshold configurable (default 0.6)
    - Load from environment or config file
    - Log threshold value on startup
    - _Requirements: 7.1, 7.2, 7.3_

- [ ] 3. Implement Frontal Face Validation
  - [ ] 3.1 Implement FrontalFaceValidator class
    - Verify yaw within ±15 degrees
    - Verify pitch within ±15 degrees
    - Verify roll within ±10 degrees
    - Return validation result with pose angles
    - _Requirements: 8.2, 8.3, 8.4_

  - [ ] 3.2 Integrate frontal validation into capture flow
    - Call FrontalFaceValidator after liveness verified
    - Return error if face not frontal
    - Include guidance message for correction
    - _Requirements: 8.1, 8.5_

- [x] 4. Create Frontend Liveness Detection UI
  - [x] 4.1 Implement LivenessDetector component
    - Capture frames continuously from camera
    - Send frames to `/detect_liveness` endpoint
    - Display real-time liveness score
    - Display detected indicators (blink, smile, head movement)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 4.2 Implement LivenessGuidance component
    - Display guidance messages in Vietnamese
    - Show visual feedback (green/red/gray border)
    - Update based on liveness status
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 4.3 Implement CaptureButton state management
    - Disable button until liveness verified (score >= 0.6)
    - Enable button when liveness verified
    - Trigger capture when clicked
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 5. Integrate Liveness Flow into Face ID Setup
  - [x] 5.1 Update setup-faceid flow
    - Add liveness detection phase before capture
    - Show liveness guidance UI
    - Wait for liveness verification
    - Proceed to capture after verification
    - _Requirements: 4.4, 4.5_

  - [x] 5.2 Update capture endpoint to verify frontal face
    - Call FrontalFaceValidator on captured frame
    - Return error if not frontal
    - Proceed to embedding generation if frontal
    - _Requirements: 8.1, 8.5_

- [ ] 6. Add Anti-Fraud Logging
  - [x] 6.1 Log liveness detection attempts
    - Log frame index, timestamp, liveness score
    - Log detected indicators
    - Log guidance message shown
    - _Requirements: 9.3_

  - [x] 6.2 Log capture attempts
    - Log whether liveness was verified
    - Log frontal face validation result
    - Log final capture success/failure
    - _Requirements: 9.4_

- [ ] 7. Checkpoint - Verify Liveness Detection
  - Test liveness detection with various face movements
  - Verify guidance messages are correct
  - Verify capture button state changes correctly
  - Ask the user if questions arise

- [ ]* 8. Write Unit Tests for Liveness Components
  - [ ]* 8.1 Write unit tests for EyeBlinkDetector
    - Test blink detection with real face images
    - Test non-blink frames
    - Test partial blinks
    - _Requirements: 2.1_

  - [ ]* 8.2 Write unit tests for MouthMovementDetector
    - Test smile detection with real face images
    - Test open mouth detection
    - Test non-movement frames
    - _Requirements: 2.2_

  - [ ]* 8.3 Write unit tests for HeadMovementTracker
    - Test head turn detection
    - Test head nod detection
    - Test small movements (< 5 degrees)
    - _Requirements: 2.3_

  - [ ]* 8.4 Write unit tests for LivenessScoreCalculator
    - Test score calculation with all indicators
    - Test score calculation with partial indicators
    - Test threshold boundary (0.6)
    - _Requirements: 1.2, 1.3_

  - [ ]* 8.5 Write unit tests for FrontalFaceValidator
    - Test frontal face validation
    - Test face turned left/right
    - Test face tilted up/down
    - Test boundary cases (±14.9°, ±15°, ±15.1°)
    - _Requirements: 8.2, 8.3, 8.4_

- [ ] 9. Write Property Tests for Liveness Detection

  - [ ] 9.1 Write property test for Liveness Score Consistency

    - **Property 1: Liveness Score Consistency**
    - **Validates: Requirements 1.1, 1.2, 1.3**
    - Generate random frame sequences with indicators
    - Analyze multiple times
    - Verify scores within ±0.05

  - [ ] 9.2 Write property test for Indicator Detection Determinism

    - **Property 2: Indicator Detection Determinism**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
    - Generate random frames with specific indicators
    - Run detection multiple times
    - Verify same indicators detected

  - [ ] 9.3 Write property test for Guidance Message Correctness

    - **Property 3: Guidance Message Correctness**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
    - Generate random liveness results
    - Verify guidance matches status
    - Verify Vietnamese text correctness

  - [ ] 9.4 Write property test for Capture Button State Consistency

    - **Property 4: Capture Button State Consistency**
    - **Validates: Requirements 4.1, 4.2**
    - Generate random liveness scores
    - Verify button state matches threshold
    - Test boundary cases (0.59, 0.60, 0.61)

  - [ ] 9.5 Write property test for Frontal Face Validation Accuracy

    - **Property 5: Frontal Face Validation Accuracy**
    - **Validates: Requirements 8.2, 8.3, 8.4**
    - Generate random pose angles
    - Verify validation matches tolerance ranges
    - Test boundary cases (±14.9°, ±15°, ±15.1°)

  - [ ] 9.6 Write property test for Anti-Fraud Detection

    - **Property 6: Anti-Fraud Detection**
    - **Validates: Requirements 9.1, 9.2**
    - Generate frame sequences without indicators
    - Verify liveness_score < 0.6
    - Verify capture is rejected

  - [ ] 9.7 Write property test for Liveness Endpoint Round-Trip

    - **Property 7: Liveness Endpoint Round-Trip**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
    - Generate random valid frames
    - Send to `/detect_liveness`
    - Verify all response fields present
    - Verify response format correctness

- [ ] 10. Checkpoint - Ensure All Tests Pass
  - Ensure all unit tests pass
  - Ensure all property tests pass
  - Ask the user if questions arise

- [ ] 11. Test End-to-End Liveness Flow
  - Test complete flow from liveness detection to capture
  - Verify guidance messages are shown correctly
  - Verify capture button enables/disables correctly
  - Verify frontal face validation works
  - Verify Face ID setup completes successfully
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 8.1, 9.1_

- [ ] 12. Final Checkpoint - Ensure All Tests Pass
  - Ensure all tests pass
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Liveness detection uses facial landmarks from existing face detection model
- All guidance messages must be in Vietnamese
- Liveness threshold is configurable (default 0.6)
