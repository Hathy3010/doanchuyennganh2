# Liveness-Guided Face Capture - Design Document

## Overview

Hệ thống phát hiện liveness (xác minh người sống) trước khi cho phép chụp ảnh chính thức cho Face ID setup. Quy trình gồm hai giai đoạn:

1. **Liveness Detection Phase**: Phát hiện hoạt động khuôn mặt (blink, smile, head movement) để xác minh người dùng là người sống
2. **Frontal Capture Phase**: Sau khi xác minh liveness, hướng dẫn người dùng nhìn thẳng vào camera để chụp ảnh chính thức

## Architecture

```
Frontend (Camera Capture)
    ↓
    └─→ startLivenessDetection()
        ↓
        └─→ Capture frames continuously
            ↓
            └─→ POST /detect_liveness (for each frame)
                ↓
                └─→ Backend analyzes:
                    ├─ Face detection
                    ├─ Eye blink detection
                    ├─ Mouth movement detection
                    ├─ Head movement tracking
                    └─ Calculate liveness score
                ↓
                └─→ Return liveness_score, indicators, guidance
        ↓
        └─→ IF liveness_score >= 0.6:
            ├─ Display "Tuyệt vời! Bây giờ nhìn thẳng vào camera"
            ├─ Enable capture button
            └─ Wait for user to click capture
        ↓
        └─→ ELSE:
            ├─ Display "Vui lòng nhắm mắt hoặc cười"
            ├─ Disable capture button
            └─ Continue liveness detection
        ↓
        └─→ User clicks capture button
            ↓
            └─→ POST /student/setup-faceid (with frontal frame)
                ↓
                └─→ Backend:
                    ├─ Verify face is frontal (yaw, pitch, roll)
                    ├─ Generate embedding
                    └─ Save for Face ID
```

## Components and Interfaces

### Frontend Components

**LivenessDetector**
- Captures frames continuously from camera
- Sends frames to backend for liveness analysis
- Displays real-time liveness score and indicators
- Manages UI state (detecting/ready/capturing)

**LivenessGuidance**
- Displays guidance messages in Vietnamese
- Shows visual feedback (green/red/gray border)
- Displays detected indicators (blink, smile, head movement)
- Enables/disables capture button based on liveness status

**CaptureButton**
- Disabled until liveness is verified
- Enabled when liveness_score >= 0.6
- Triggers frontal face capture when clicked

### Backend Components

**LivenessAnalyzer**
- Detects face in frame
- Analyzes eye blinks using eye aspect ratio
- Analyzes mouth movements using mouth aspect ratio
- Tracks head movements across frames
- Calculates overall liveness score

**EyeBlinkDetector**
- Uses facial landmarks to calculate eye aspect ratio (EAR)
- Detects blink when EAR drops below threshold
- Tracks blink count across frames

**MouthMovementDetector**
- Uses facial landmarks to calculate mouth aspect ratio (MAR)
- Detects smile/open mouth when MAR exceeds threshold
- Tracks mouth movement count across frames

**HeadMovementTracker**
- Tracks pose angles (yaw, pitch, roll) across frames
- Detects significant changes in pose (> 5 degrees)
- Tracks head movement count across frames

**LivenessScoreCalculator**
- Combines indicators: blink_count, mouth_movement_count, head_movement_count
- Calculates weighted score (0-1)
- Default weights: blink 0.4, mouth 0.3, head_movement 0.3
- Threshold: 0.6 for liveness verified

**FrontalFaceValidator**
- Verifies yaw within ±15 degrees
- Verifies pitch within ±15 degrees
- Verifies roll within ±10 degrees
- Returns validation result

## Data Models

### Liveness Detection Request

```python
{
    "base64": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "frame_index": 5,
    "timestamp": 1234567890
}
```

### Liveness Detection Response

```python
{
    "face_detected": True,
    "liveness_score": 0.75,
    "indicators": {
        "blink_detected": True,
        "blink_count": 2,
        "mouth_movement_detected": True,
        "mouth_movement_count": 1,
        "head_movement_detected": True,
        "head_movement_count": 3
    },
    "pose": {
        "yaw": 5.2,
        "pitch": -3.1,
        "roll": 1.5
    },
    "guidance": "Tuyệt vời! Bây giờ nhìn thẳng vào camera để chụp ảnh",
    "status": "liveness_verified"  # or "no_liveness", "no_face"
}
```

### Frontal Face Validation Response

```python
{
    "is_frontal": True,
    "yaw": 2.1,
    "pitch": -1.5,
    "roll": 0.8,
    "message": "Khuôn mặt thẳng. Sẵn sàng chụp ảnh."
}
```

### Error Response

```python
{
    "error": "No face detected",
    "guidance": "Không tìm thấy khuôn mặt. Vui lòng nhìn vào camera.",
    "status": "no_face"
}
```

## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Liveness Score Consistency

*For any* frame sequence with detected liveness indicators, re-analyzing the same sequence should produce liveness scores within ±0.05 (idempotence with tolerance).

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Indicator Detection Determinism

*For any* frame with a detected blink/smile/head movement, running detection multiple times should consistently identify the same indicator type.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

### Property 3: Guidance Message Correctness

*For any* liveness detection result, the guidance message should match the status (no_face → "Không tìm thấy khuôn mặt", no_liveness → "Vui lòng nhắm mắt hoặc cười", liveness_verified → "Tuyệt vời!").

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 4: Capture Button State Consistency

*For any* liveness score, the capture button state should be: disabled if score < 0.6, enabled if score >= 0.6 (deterministic).

**Validates: Requirements 4.1, 4.2**

### Property 5: Frontal Face Validation Accuracy

*For any* frame with pose angles, the frontal validation should correctly identify if yaw ∈ [-15, 15], pitch ∈ [-15, 15], roll ∈ [-10, 10].

**Validates: Requirements 8.2, 8.3, 8.4**

### Property 6: Anti-Fraud Detection

*For any* sequence of frames without liveness indicators, the system should reject capture attempts (liveness_score < 0.6).

**Validates: Requirements 9.1, 9.2**

### Property 7: Liveness Endpoint Round-Trip

*For any* valid frame sent to `/detect_liveness`, the endpoint should return a response with all required fields (face_detected, liveness_score, indicators, guidance, status).

**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

## Error Handling

### Face Detection Errors

- **No face detected**: Return status "no_face", guidance "Không tìm thấy khuôn mặt. Vui lòng nhìn vào camera."
- **Multiple faces detected**: Use largest face, log warning
- **Face detection timeout**: Return error, log timeout

### Liveness Detection Errors

- **Insufficient frames**: Return status "no_liveness", guidance "Vui lòng nhắm mắt hoặc cười để xác minh bạn là người sống"
- **No indicators detected**: Return liveness_score 0, status "no_liveness"
- **Landmark detection failed**: Log error, skip frame

### Frontal Face Validation Errors

- **Face not frontal (yaw)**: Return error "Quay mặt " + direction + " để nhìn thẳng"
- **Face not frontal (pitch)**: Return error "Ngửa/Cúi mặt " + direction + " để nhìn thẳng"
- **Face not frontal (roll)**: Return error "Nghiêng mặt " + direction + " để nhìn thẳng"

## Testing Strategy

### Unit Tests

1. **Eye Blink Detection**
   - Test with blink frames
   - Test without blink frames
   - Test partial blinks
   - Test rapid blinks

2. **Mouth Movement Detection**
   - Test with smile frames
   - Test with open mouth frames
   - Test without mouth movement
   - Test partial movements

3. **Head Movement Tracking**
   - Test with head turn frames
   - Test with head nod frames
   - Test without head movement
   - Test small movements (< 5 degrees)

4. **Liveness Score Calculation**
   - Test with all indicators present
   - Test with partial indicators
   - Test with no indicators
   - Test threshold boundary (0.6)

5. **Frontal Face Validation**
   - Test frontal face (yaw, pitch, roll within tolerance)
   - Test face turned left/right
   - Test face tilted up/down
   - Test face rolled

6. **Guidance Message Generation**
   - Test all status types (no_face, no_liveness, liveness_verified)
   - Test message correctness in Vietnamese
   - Test message consistency

### Property-Based Tests

1. **Liveness Score Consistency**
   - Generate random frame sequences with indicators
   - Analyze multiple times
   - Verify scores within ±0.05

2. **Indicator Detection Determinism**
   - Generate random frames with specific indicators
   - Run detection multiple times
   - Verify same indicators detected

3. **Guidance Message Correctness**
   - Generate random liveness results
   - Verify guidance matches status
   - Verify Vietnamese text correctness

4. **Capture Button State Consistency**
   - Generate random liveness scores
   - Verify button state matches threshold
   - Test boundary cases (0.59, 0.60, 0.61)

5. **Frontal Face Validation Accuracy**
   - Generate random pose angles
   - Verify validation matches tolerance ranges
   - Test boundary cases (±14.9°, ±15°, ±15.1°)

6. **Anti-Fraud Detection**
   - Generate frame sequences without indicators
   - Verify liveness_score < 0.6
   - Verify capture is rejected

7. **Liveness Endpoint Round-Trip**
   - Generate random valid frames
   - Send to `/detect_liveness`
   - Verify all response fields present
   - Verify response format correctness
