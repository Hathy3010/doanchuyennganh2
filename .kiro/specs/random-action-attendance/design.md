# Design: Random Action Attendance with Anti-Fraud

## Overview

Implement a secure attendance check-in system that combines:
1. **Random action selection** - Prevents memorization of required actions
2. **Action detection** - Verifies correct face movement
3. **Multi-layer anti-fraud** - Liveness, deepfake, GPS, embedding verification
4. **Real-time feedback** - Guides user through the process
5. **Comprehensive logging** - Audit trail for all checks

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Student Dashboard                         │
│                  [Bắt đầu điểm danh]                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Attendance Check-In Modal                       │
│  1. Select random action (neutral/blink/mouth/head)         │
│  2. Display action instruction                              │
│  3. Start camera & frame capture                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│           Action Detection & Verification                    │
│  POST /attendance/verify-action                             │
│  - Detect face & action                                     │
│  - Verify action matches requirement                        │
│  - Return: action_detected, confidence, message             │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │ Action Correct?         │
        ├────────────┬────────────┤
        │ NO         │ YES        │
        ▼            ▼
    [Retry]    [Continue]
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Anti-Fraud Checks (Sequential)                  │
│                                                              │
│  1. Liveness Detection                                      │
│     POST /attendance/liveness-check                         │
│     ├─ Eye movement detection                               │
│     ├─ Face movement detection                              │
│     ├─ Skin texture analysis                                │
│     ├─ Light reflection detection                           │
│     └─ Blink detection                                      │
│                                                              │
│  2. Deepfake Detection                                      │
│     POST /attendance/detect-deepfake                        │
│     ├─ Xception model analysis                              │
│     └─ AI-generated image detection                         │
│                                                              │
│  3. GPS Validation                                          │
│     POST /attendance/validate-gps                           │
│     ├─ Get device GPS location                              │
│     └─ Verify within 100m of school                         │
│                                                              │
│  4. Face Embedding Verification                             │
│     POST /student/generate-embedding                        │
│     POST /attendance/verify-embedding                       │
│     ├─ Generate embedding from frame                        │
│     └─ Compare with stored embedding (≥90%)                 │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │ All checks passed?      │
        ├────────────┬────────────┤
        │ NO         │ YES        │
        ▼            ▼
    [Reject]   [Record]
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│           Record Attendance & Notify                         │
│  POST /attendance/checkin                                   │
│  - Store attendance record                                  │
│  - Log all validation results                               │
│  - Notify teacher via WebSocket                             │
│  - Update student dashboard                                 │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Frontend Components

#### 1. AttendanceCheckInModal
- **Purpose**: Main UI for attendance check-in
- **State**:
  - `selectedAction`: string (neutral|blink|mouth_open|head_movement)
  - `isRecording`: boolean
  - `currentFrame`: base64 string
  - `actionDetected`: boolean
  - `detectionMessage`: string
  - `retryCount`: number (0-3)
  - `checkInPhase`: string (action_detection|liveness|deepfake|gps|embedding|recording)
  - `checkInStatus`: object (all validation results)

- **Methods**:
  - `selectRandomAction()`: Pick random action from list
  - `startActionDetection()`: Begin frame capture
  - `captureFrame()`: Take picture from camera
  - `verifyAction(frame)`: POST to /attendance/verify-action
  - `performAntifraudChecks(frame)`: Sequential checks
  - `recordAttendance()`: POST to /attendance/checkin
  - `handleRetry()`: Reset and retry
  - `handleError(error)`: Display error and allow retry

#### 2. ActionGuidance
- **Purpose**: Display action instruction and real-time feedback
- **Props**:
  - `action`: string
  - `isDetected`: boolean
  - `confidence`: number (0-1)
  - `message`: string
  - `timeRemaining`: number (seconds)

- **Display**:
  - Action instruction in Vietnamese
  - Real-time detection status (🔄 detecting, ✅ correct, ❌ incorrect)
  - Confidence percentage
  - Countdown timer
  - Visual feedback (green/red border)

#### 3. AntifraudProgress
- **Purpose**: Show progress through anti-fraud checks
- **Props**:
  - `checks`: object with results for each check
  - `currentCheck`: string
  - `isLoading`: boolean

- **Display**:
  - Liveness: ✅/❌/🔄
  - Deepfake: ✅/❌/🔄
  - GPS: ✅/❌/🔄
  - Embedding: ✅/❌/🔄

### Backend Endpoints

#### 1. POST /attendance/select-action
**Purpose**: Select random action for check-in

**Request**:
```json
{
  "student_id": "string",
  "class_id": "string"
}
```

**Response**:
```json
{
  "action": "neutral|blink|mouth_open|head_movement",
  "instruction": "Giữ khuôn mặt thẳng trong khung",
  "timeout": 10,
  "message": "✅ Hành động được chọn"
}
```

#### 2. POST /attendance/verify-action
**Purpose**: Verify student performed correct action

**Request**:
```json
{
  "image": "base64_string",
  "required_action": "neutral|blink|mouth_open|head_movement"
}
```

**Response**:
```json
{
  "action_detected": "neutral|blink|mouth_open|head_movement|null",
  "is_correct": true|false,
  "confidence": 0.95,
  "message": "✅ Hành động đúng" | "❌ Hành động sai",
  "yaw": -11.26,
  "pitch": -2.95,
  "roll": -3.16
}
```

#### 3. POST /attendance/verify-embedding
**Purpose**: Verify face embedding matches stored embedding

**Request**:
```json
{
  "embedding": [0.123, 0.456, ...],
  "student_id": "string"
}
```

**Response**:
```json
{
  "is_match": true|false,
  "similarity": 0.95,
  "message": "✅ Khuôn mặt khớp" | "❌ Khuôn mặt không khớp"
}
```

## Data Models

### AttendanceRecord
```python
{
  "_id": ObjectId,
  "student_id": ObjectId,
  "class_id": ObjectId,
  "date": "2025-12-25",
  "check_in_time": datetime,
  "status": "present|present_with_warnings|absent",
  "action_required": "neutral|blink|mouth_open|head_movement",
  "validations": {
    "action": {
      "is_valid": true,
      "action_detected": "neutral",
      "confidence": 0.95,
      "message": "✅ Hành động đúng"
    },
    "liveness": {
      "is_valid": true,
      "score": 0.85,
      "checks": {
        "eye_movement": true,
        "face_movement": true,
        "skin_texture": true,
        "light_reflection": true,
        "blink_detection": true
      },
      "message": "✅ Người sống thực tế"
    },
    "deepfake": {
      "is_valid": true,
      "confidence": 0.02,
      "message": "✅ Ảnh thực tế"
    },
    "gps": {
      "is_valid": true,
      "latitude": 10.762622,
      "longitude": 106.660172,
      "distance_meters": 15.5,
      "message": "✅ Vị trí hợp lệ"
    },
    "embedding": {
      "is_valid": true,
      "similarity": 0.95,
      "message": "✅ Khuôn mặt khớp"
    }
  },
  "warnings": [],
  "location": {
    "latitude": 10.762622,
    "longitude": 106.660172
  }
}
```

### AntifraudLog
```python
{
  "_id": ObjectId,
  "student_id": ObjectId,
  "class_id": ObjectId,
  "timestamp": datetime,
  "action_required": "neutral|blink|mouth_open|head_movement",
  "checks": {
    "action_detection": {
      "status": "success|failed",
      "action_detected": "neutral",
      "confidence": 0.95,
      "error": null
    },
    "liveness": {
      "status": "success|failed",
      "score": 0.85,
      "error": null
    },
    "deepfake": {
      "status": "success|failed",
      "confidence": 0.02,
      "error": null
    },
    "gps": {
      "status": "success|failed",
      "distance_meters": 15.5,
      "error": null
    },
    "embedding": {
      "status": "success|failed",
      "similarity": 0.95,
      "error": null
    }
  },
  "final_status": "success|failed",
  "failure_reason": null,
  "retry_count": 0
}
```

## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Random Action Selection Fairness
**For any** sequence of attendance check-ins, each action (neutral, blink, mouth_open, head_movement) should be selected with approximately equal probability (±5% deviation from 25%).

**Validates: Requirements 1.1, 1.3**

### Property 2: Action Detection Accuracy
**For any** captured frame with a correctly performed action, the system should detect it with ≥90% confidence within 2 seconds.

**Validates: Requirements 3.1, 3.2**

### Property 3: Liveness Detection Consistency
**For any** frame from a live person, liveness score should be ≥0.6. **For any** static image or video, liveness score should be <0.6.

**Validates: Requirements 4.1, 4.2**

### Property 4: Deepfake Detection Accuracy
**For any** AI-generated or manipulated face, deepfake confidence should be >50%. **For any** real face, deepfake confidence should be <50%.

**Validates: Requirements 5.1, 5.2**

### Property 5: GPS Validation Correctness
**For any** GPS location within 100m of school, validation should pass. **For any** GPS location >100m away, validation should fail.

**Validates: Requirements 6.1, 6.2, 6.3**

### Property 6: Face Embedding Verification
**For any** frame from the same person, embedding similarity should be ≥90%. **For any** frame from a different person, embedding similarity should be <90%.

**Validates: Requirements 7.1, 7.2**

### Property 7: Anti-Fraud Sequential Execution
**For any** check-in attempt, if any anti-fraud check fails, the system should NOT record attendance and should NOT proceed to next check.

**Validates: Requirements 4.2, 5.3, 6.4, 7.3, 9.2**

### Property 8: Attendance Recording Atomicity
**For any** successful check-in, all validation results should be recorded atomically. If recording fails, no partial data should be stored.

**Validates: Requirements 8.1, 8.2**

### Property 9: Error Message Specificity
**For any** failed check-in, the error message should clearly indicate which check failed (action/liveness/deepfake/gps/embedding).

**Validates: Requirements 9.1**

### Property 10: Audit Trail Completeness
**For any** check-in attempt (success or failure), all validation results and timestamps should be logged for audit trail.

**Validates: Requirements 10.1, 10.2, 10.3**

## Error Handling

### Action Detection Errors
- **No face detected**: "❌ Không phát hiện khuôn mặt"
- **Action not detected**: "❌ Không phát hiện hành động"
- **Wrong action detected**: "❌ Hành động sai, vui lòng thử lại"
- **Timeout**: "⏱️ Hết thời gian, vui lòng thử lại"

### Liveness Check Errors
- **Static image detected**: "❌ Phát hiện ảnh tĩnh"
- **Video detected**: "❌ Phát hiện video"
- **Low liveness score**: "❌ Không thể xác minh người sống"

### Deepfake Detection Errors
- **Deepfake detected**: "❌ Phát hiện ảnh giả mạo"
- **AI-generated image**: "❌ Phát hiện ảnh được tạo bởi AI"

### GPS Validation Errors
- **GPS disabled**: "❌ Vui lòng bật GPS"
- **Location too far**: "❌ Sai vị trí (cách trường {distance}m)"
- **GPS timeout**: "❌ Không thể lấy vị trí GPS"

### Face Embedding Errors
- **Embedding generation failed**: "❌ Không thể tạo embedding"
- **Face mismatch**: "❌ Khuôn mặt không khớp"
- **Low similarity**: "❌ Khuôn mặt không khớp (độ tương đồng {similarity}%)"

## Testing Strategy

### Unit Tests
- Test random action selection (fairness, no repetition)
- Test action detection accuracy (neutral, blink, mouth_open, head_movement)
- Test liveness detection (live vs static vs video)
- Test deepfake detection (real vs AI-generated)
- Test GPS validation (within/outside radius)
- Test embedding verification (same person vs different person)
- Test error handling (all error cases)

### Property-Based Tests
- Property 1: Random action fairness (100+ iterations)
- Property 2: Action detection accuracy (50+ test frames)
- Property 3: Liveness consistency (100+ frames)
- Property 4: Deepfake accuracy (50+ test images)
- Property 5: GPS validation (100+ random locations)
- Property 6: Embedding verification (100+ frame pairs)
- Property 7: Sequential execution (100+ check-in attempts)
- Property 8: Atomicity (50+ concurrent attempts)
- Property 9: Error message specificity (all error cases)
- Property 10: Audit trail completeness (100+ check-ins)

### Integration Tests
- End-to-end check-in flow (success case)
- End-to-end check-in flow (failure at each stage)
- Retry mechanism (max 3 attempts)
- Real-time teacher notification
- Dashboard update after check-in
- Concurrent check-ins from multiple students

## Notes

- All user-facing messages must be in Vietnamese
- Action timeout: 10 seconds per attempt
- Max retries: 3 attempts per check-in session
- GPS radius: 100 meters from school
- Embedding similarity threshold: ≥ 90%
- Liveness threshold: ≥ 0.6
- Deepfake threshold: < 50% confidence
- Actions: neutral (25%), blink (25%), mouth_open (25%), head_movement (25%)
- Anti-fraud checks are sequential (fail-fast approach)
- All checks must pass for attendance to be recorded
- Comprehensive logging for audit trail and fraud detection
