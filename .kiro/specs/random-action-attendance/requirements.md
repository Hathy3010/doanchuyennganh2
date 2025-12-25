# Requirements: Random Action Attendance with Anti-Fraud

## Introduction

Implement a secure attendance check-in system that requires users to perform a randomly selected face action (neutral, blink, mouth open, head movement) combined with comprehensive anti-fraud checks (liveness detection, deepfake detection, GPS validation, face embedding verification).

## Glossary

- **System**: Smart Attendance Backend & Frontend
- **Student**: User performing attendance check-in
- **Action**: A specific face movement (neutral, blink, mouth_open, head_movement)
- **Liveness**: Verification that the person is alive and not a static image/video
- **Deepfake**: AI-generated or manipulated face image
- **GPS**: Geographic location validation
- **Embedding**: Face vector representation for identity verification
- **Anti-Fraud**: Multi-layer protection against spoofing attacks

## Requirements

### Requirement 1: Random Action Selection

**User Story:** As a system, I want to randomly select a face action for each attendance check-in, so that I can prevent users from memorizing the required action.

#### Acceptance Criteria

1. WHEN a student initiates attendance check-in, THE System SHALL randomly select one action from the predefined list
2. WHEN an action is selected, THE System SHALL display the action instruction in Vietnamese to the student
3. THE System SHALL ensure each action has equal probability of selection (25% each for 4 actions)
4. WHEN the same student checks in multiple times, THE System SHALL select different actions (no repetition within 3 check-ins)

### Requirement 2: Action Execution Guidance

**User Story:** As a student, I want clear visual and text guidance on what action to perform, so that I can complete the check-in correctly.

#### Acceptance Criteria

1. WHEN an action is selected, THE System SHALL display a clear instruction message in Vietnamese
2. WHEN the student is performing the action, THE System SHALL show real-time feedback (✅ correct, ❌ incorrect, 🔄 detecting)
3. WHEN the action is correctly detected, THE System SHALL provide visual confirmation (green border, checkmark)
4. WHEN the action is not detected, THE System SHALL provide guidance to retry (red border, retry message)
5. THE System SHALL display a countdown timer showing remaining time for the action (default 10 seconds)

### Requirement 3: Action Detection and Verification

**User Story:** As a system, I want to accurately detect and verify that the student performed the correct action, so that I can prevent spoofing attempts.

#### Acceptance Criteria

1. WHEN the student performs the required action, THE System SHALL detect it within 2 seconds
2. WHEN the action is detected, THE System SHALL verify it matches the required action with ≥90% confidence
3. WHEN multiple faces are detected, THE System SHALL use the largest face (closest to camera)
4. WHEN no face is detected, THE System SHALL display error message "❌ Không phát hiện khuôn mặt"
5. WHEN the action is not detected within timeout, THE System SHALL allow retry (max 3 attempts)

### Requirement 4: Liveness Detection (Anti-Static Image)

**User Story:** As a system, I want to detect if the image is a static photo or video, so that I can prevent spoofing with printed photos.

#### Acceptance Criteria

1. WHEN the action is detected, THE System SHALL perform liveness check on the captured frame
2. WHEN liveness score < 0.6, THE System SHALL reject the check-in with message "❌ Phát hiện ảnh tĩnh"
3. WHEN liveness check fails, THE System SHALL NOT record attendance
4. THE System SHALL analyze: eye movement, face movement, skin texture, light reflection, blink detection
5. WHEN liveness check passes, THE System SHALL proceed to next anti-fraud check

### Requirement 5: Deepfake Detection (Anti-AI Generated)

**User Story:** As a system, I want to detect AI-generated or manipulated faces, so that I can prevent deepfake attacks.

#### Acceptance Criteria

1. WHEN liveness check passes, THE System SHALL perform deepfake detection on the captured frame
2. WHEN deepfake confidence > 50%, THE System SHALL reject the check-in with message "❌ Phát hiện ảnh giả mạo"
3. WHEN deepfake check fails, THE System SHALL NOT record attendance
4. THE System SHALL use Xception model or equivalent for detection
5. WHEN deepfake check passes, THE System SHALL proceed to GPS validation

### Requirement 6: GPS Validation (Anti-Location Spoofing)

**User Story:** As a system, I want to verify the student is at the correct location, so that I can prevent remote check-ins.

#### Acceptance Criteria

1. WHEN deepfake check passes, THE System SHALL request GPS location from the student's device
2. WHEN GPS location is within 100 meters of school, THE System SHALL mark GPS as valid
3. WHEN GPS location is > 100 meters from school, THE System SHALL reject check-in with message "❌ Sai vị trí"
4. WHEN GPS check fails, THE System SHALL NOT record attendance
5. WHEN GPS check passes, THE System SHALL proceed to face embedding verification

### Requirement 7: Face Embedding Verification

**User Story:** As a system, I want to verify the face matches the stored embedding, so that I can prevent identity spoofing.

#### Acceptance Criteria

1. WHEN GPS check passes, THE System SHALL generate embedding from the captured frame
2. WHEN embedding similarity ≥ 90% with stored embedding, THE System SHALL mark face as verified
3. WHEN embedding similarity < 90%, THE System SHALL reject check-in with message "❌ Khuôn mặt không khớp"
4. WHEN face verification fails, THE System SHALL NOT record attendance
5. WHEN face verification passes, THE System SHALL proceed to attendance recording

### Requirement 8: Attendance Recording

**User Story:** As a system, I want to record successful attendance with all validation details, so that I can maintain accurate attendance records.

#### Acceptance Criteria

1. WHEN all anti-fraud checks pass, THE System SHALL record attendance with status "present"
2. WHEN attendance is recorded, THE System SHALL store: timestamp, GPS location, action performed, all validation results
3. WHEN attendance is recorded, THE System SHALL display success message "✅ Điểm danh thành công"
4. WHEN attendance is recorded, THE System SHALL notify the teacher in real-time
5. WHEN attendance is recorded, THE System SHALL update the student dashboard immediately

### Requirement 9: Error Handling and User Feedback

**User Story:** As a student, I want clear error messages when check-in fails, so that I can understand what went wrong and retry.

#### Acceptance Criteria

1. WHEN any anti-fraud check fails, THE System SHALL display specific error message in Vietnamese
2. WHEN check-in fails, THE System SHALL allow the student to retry (max 3 attempts per check-in session)
3. WHEN max retries exceeded, THE System SHALL close the check-in modal and return to dashboard
4. WHEN check-in fails, THE System SHALL log the failure reason for audit trail
5. WHEN check-in fails, THE System SHALL NOT record any attendance

### Requirement 10: Anti-Fraud Logging

**User Story:** As an administrator, I want to log all anti-fraud checks and their results, so that I can audit and detect fraud patterns.

#### Acceptance Criteria

1. WHEN any anti-fraud check is performed, THE System SHALL log: timestamp, student_id, action, check_type, result, confidence
2. WHEN check-in succeeds, THE System SHALL log all validation results with "success" status
3. WHEN check-in fails, THE System SHALL log the failure reason with "failed" status
4. THE System SHALL store logs in MongoDB for audit trail
5. THE System SHALL include GPS coordinates, face embedding similarity, liveness score, deepfake confidence in logs

## Notes

- All user-facing messages must be in Vietnamese
- Action timeout: 10 seconds per attempt
- Max retries: 3 attempts per check-in session
- GPS radius: 100 meters from school
- Embedding similarity threshold: ≥ 90%
- Liveness threshold: ≥ 0.6
- Deepfake threshold: < 50% confidence
- Actions: neutral (25%), blink (25%), mouth_open (25%), head_movement (25%)
