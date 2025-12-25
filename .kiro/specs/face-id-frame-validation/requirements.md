# Face ID Frame Validation Fix

## Introduction

The Face ID setup flow is failing with "Chỉ có 0 frame hợp lệ. Cần ít nhất 8 frame." (Only 0 valid frames. Need at least 8 frames.) This indicates that all frames sent from the frontend are being rejected by the backend frame validation process.

## Glossary

- **Frame**: A single base64-encoded JPEG image captured from the camera
- **Base64 Prefix**: The `data:image/jpeg;base64,` prefix that may be included in base64 strings
- **Valid Frame**: A frame that successfully decodes, passes quality checks, and has a detectable face
- **Frame Validation**: The process of decoding, quality checking, and face detection on each frame

## Requirements

### Requirement 1: Frame Decoding

**User Story:** As a developer, I want frames to be properly decoded from base64, so that the backend can process them correctly.

#### Acceptance Criteria

1. WHEN a frame with a base64 prefix is received, THE Backend SHALL strip the prefix before decoding
2. WHEN a frame without a prefix is received, THE Backend SHALL decode it directly
3. WHEN a frame cannot be decoded, THE Backend SHALL log the error and mark the frame as invalid
4. WHEN a frame is successfully decoded, THE Backend SHALL verify it is a valid image (not corrupted)

### Requirement 2: Frame Quality Validation

**User Story:** As a system, I want to validate frame quality before processing, so that only usable frames are processed.

#### Acceptance Criteria

1. WHEN a frame is decoded, THE Backend SHALL check image dimensions (minimum 320x240)
2. WHEN a frame has insufficient brightness, THE Backend SHALL reject it with a quality error
3. WHEN a frame has excessive blur, THE Backend SHALL reject it with a quality error
4. WHEN a frame passes quality checks, THE Backend SHALL proceed to face detection

### Requirement 3: Face Detection

**User Story:** As a system, I want to detect faces in frames, so that only frames with faces are used for Face ID setup.

#### Acceptance Criteria

1. WHEN a frame is quality-checked, THE Backend SHALL attempt face detection
2. WHEN no face is detected, THE Backend SHALL mark the frame as invalid
3. WHEN a face is detected, THE Backend SHALL extract pose angles (yaw, pitch, roll)
4. WHEN pose angles are extracted, THE Backend SHALL generate a face embedding

### Requirement 4: Error Logging and Diagnostics

**User Story:** As a developer, I want detailed error logs for frame processing, so that I can diagnose why frames are failing.

#### Acceptance Criteria

1. WHEN a frame fails to decode, THE Backend SHALL log the error with frame index and error message
2. WHEN a frame fails quality checks, THE Backend SHALL log the specific quality issue
3. WHEN a frame fails face detection, THE Backend SHALL log that no face was found
4. WHEN all frames are processed, THE Backend SHALL log a summary of valid vs invalid frames

### Requirement 5: Frontend Frame Capture

**User Story:** As a frontend, I want to capture frames properly, so that they can be processed by the backend.

#### Acceptance Criteria

1. WHEN the camera captures a frame, THE Frontend SHALL encode it as base64 with quality 0.9
2. WHEN a frame is captured, THE Frontend SHALL validate it is not empty
3. WHEN a frame is validated, THE Frontend SHALL send it to the detection endpoint
4. WHEN frames are collected, THE Frontend SHALL send them to the setup endpoint with proper formatting

