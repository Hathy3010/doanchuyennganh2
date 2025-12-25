# Requirements: Frontend-Backend Face ID Synchronization

## Introduction

This specification addresses the synchronization between frontend and backend for the Face ID setup and verification system. The goal is to ensure seamless integration where:
1. Frontend correctly detects Face ID setup status from backend
2. Backend properly processes Face ID setup with image frames
3. Both systems use consistent data formats and API contracts
4. Face ID verification works reliably during attendance check-in

## Glossary

- **Face_ID**: Biometric identifier created from facial embeddings with pose diversity
- **Embedding**: 256-dimensional vector representing facial features (L2 normalized)
- **Pose_Diversity**: Multiple facial angles (yaw, pitch) captured during setup
- **Frontend**: React Native (Expo) mobile application
- **Backend**: FastAPI Python server with MongoDB
- **API_URL**: Endpoint address for backend communication (platform-specific)
- **Base64_Image**: Image encoded as base64 string for transmission
- **Frontal_Face**: Face pose within tolerance (yaw ±15°, pitch ±15°)
- **Similarity_Score**: Cosine similarity between embeddings (0-1 range)

## Requirements

### Requirement 1: Face ID Setup Status Detection

**User Story:** As a student, I want the system to automatically detect whether I have Face ID setup, so that I can be guided to setup if needed or proceed directly to check-in.

#### Acceptance Criteria

1. WHEN a student logs in, THE Frontend SHALL call GET /auth/me endpoint
2. WHEN the response is received, THE Frontend SHALL extract the face_embedding field
3. IF face_embedding is null or empty, THE Frontend SHALL set hasFaceIDSetup to false
4. IF face_embedding contains data, THE Frontend SHALL set hasFaceIDSetup to true
5. WHEN hasFaceIDSetup is false, THE Frontend SHALL display a banner prompting Face ID setup
6. WHEN hasFaceIDSetup is true, THE Frontend SHALL allow direct attendance check-in without setup

### Requirement 2: Backend Face ID Status Response

**User Story:** As a backend service, I want to provide clear Face ID status in the user profile endpoint, so that the frontend can make correct UI decisions.

#### Acceptance Criteria

1. WHEN GET /auth/me is called, THE Backend SHALL return the user profile
2. THE Backend SHALL include face_embedding field in the response
3. IF user has no Face ID setup, THE Backend SHALL return face_embedding as null
4. IF user has Face ID setup, THE Backend SHALL return face_embedding as an object with data array
5. THE Backend SHALL include has_face_id boolean flag for easy frontend checking
6. THE Backend SHALL return face_embedding metadata (created_at, samples_count, setup_type)

### Requirement 3: Face ID Setup Frame Capture

**User Story:** As a student, I want to capture multiple frames from different angles during Face ID setup, so that the system can create a robust facial identifier.

#### Acceptance Criteria

1. WHEN Face ID setup starts, THE Frontend SHALL display a sequence of 5 pose instructions
2. THE Frontend SHALL capture frames for each pose (total 15 frames minimum)
3. WHEN a frame is captured, THE Frontend SHALL encode it as base64
4. THE Frontend SHALL validate frame quality before sending to backend
5. WHEN all frames are captured, THE Frontend SHALL send them to POST /student/setup-faceid
6. THE Frontend SHALL display progress (current frame count / total required)

### Requirement 4: Backend Face ID Setup Processing

**User Story:** As a backend service, I want to process Face ID setup frames with pose validation and embedding generation, so that the system creates accurate facial identifiers.

#### Acceptance Criteria

1. WHEN POST /student/setup-faceid is called, THE Backend SHALL validate minimum 10 images
2. THE Backend SHALL process each image in parallel using ThreadPoolExecutor
3. FOR each image, THE Backend SHALL decode base64 and detect face
4. FOR each face, THE Backend SHALL extract pose angles (yaw, pitch, roll)
5. THE Backend SHALL validate frontal face (yaw ±15°, pitch ±15°)
6. THE Backend SHALL generate embedding for each valid frame
7. THE Backend SHALL calculate pose diversity (yaw_range, pitch_range)
8. IF pose diversity is insufficient, THE Backend SHALL return error with guidance
9. THE Backend SHALL average embeddings from valid frames
10. THE Backend SHALL save embedding to MongoDB with metadata

### Requirement 5: Face ID Embedding Storage Format

**User Story:** As a system, I want to store Face ID embeddings with rich metadata, so that I can track setup quality and support future enhancements.

#### Acceptance Criteria

1. THE Backend SHALL store face_embedding as an object (not simple array)
2. THE Backend SHALL include data array (256 float32 values)
3. THE Backend SHALL include shape [256] for dimension tracking
4. THE Backend SHALL include dtype "float32" for type information
5. THE Backend SHALL include norm "L2" for normalization method
6. THE Backend SHALL include created_at timestamp
7. THE Backend SHALL include samples_count (number of frames used)
8. THE Backend SHALL include yaw_range and pitch_range for pose diversity
9. THE Backend SHALL include embedding_std for quality metrics
10. THE Backend SHALL include setup_type ("pose_diversity" or "single_frame")

### Requirement 6: Face ID Verification During Check-in

**User Story:** As a student, I want to verify my Face ID during attendance check-in, so that the system can confirm my identity.

#### Acceptance Criteria

1. WHEN a student clicks check-in, THE Frontend SHALL check hasFaceIDSetup status
2. IF hasFaceIDSetup is false, THE Frontend SHALL show setup prompt
3. IF hasFaceIDSetup is true, THE Frontend SHALL open camera for verification
4. WHEN a frame is captured, THE Frontend SHALL send it to POST /attendance/checkin-with-embedding
5. THE Frontend SHALL include class_id, latitude, longitude, and image in request
6. WHEN response is received, THE Frontend SHALL display validation results
7. IF all validations pass, THE Frontend SHALL show success message
8. IF any validation fails, THE Frontend SHALL show specific error message

### Requirement 7: Backend Face ID Verification

**User Story:** As a backend service, I want to verify Face ID during check-in, so that only authorized students can mark attendance.

#### Acceptance Criteria

1. WHEN POST /attendance/checkin-with-embedding is called, THE Backend SHALL validate user has Face ID
2. THE Backend SHALL decode the image and detect face
3. THE Backend SHALL generate embedding from current frame
4. THE Backend SHALL retrieve stored embedding from database
5. THE Backend SHALL calculate cosine similarity between embeddings
6. IF similarity >= 0.90, THE Backend SHALL mark face verification as valid
7. IF similarity < 0.90, THE Backend SHALL return error with similarity percentage
8. THE Backend SHALL perform additional anti-fraud checks (liveness, GPS, deepfake)
9. THE Backend SHALL record attendance only if all checks pass
10. THE Backend SHALL return detailed validation results to frontend

### Requirement 8: API Endpoint Consistency

**User Story:** As a developer, I want all API endpoints to be consistently named and documented, so that frontend and backend integration is straightforward.

#### Acceptance Criteria

1. THE Backend SHALL implement POST /student/setup-faceid for Face ID setup
2. THE Backend SHALL implement POST /attendance/checkin-with-embedding for check-in
3. THE Backend SHALL implement GET /auth/me with face_embedding field
4. ALL endpoints SHALL use consistent request/response formats
5. ALL endpoints SHALL return error messages in Vietnamese
6. ALL endpoints SHALL include proper HTTP status codes
7. ALL endpoints SHALL be documented with examples
8. THE Frontend SHALL call exactly these endpoint names (no variations)

### Requirement 9: Database Synchronization

**User Story:** As a system, I want frontend and backend to use the same database, so that data is consistent across all operations.

#### Acceptance Criteria

1. THE Backend SHALL use MongoDB URL: mongodb+srv://doan:abc@doan.h7dlpmc.mongodb.net/
2. THE Backend SHALL use database name: smart_attendance
3. THE Backend SHALL use collections: users, classes, attendance, documents, anti_fraud_logs
4. THE Backend SHALL NOT create duplicate collections with different names
5. THE Backend SHALL import collections from database.py (not redefine)
6. WHEN data is written, THE Backend SHALL write to the correct collection
7. WHEN data is read, THE Backend SHALL read from the same collection
8. THE Frontend SHALL not directly access database (only through API)

### Requirement 10: Error Handling and User Feedback

**User Story:** As a user, I want clear error messages when Face ID setup or verification fails, so that I can understand what went wrong and how to fix it.

#### Acceptance Criteria

1. WHEN Face ID setup fails, THE Backend SHALL return specific error reason
2. WHEN insufficient frames are captured, THE Backend SHALL return: "Cần ít nhất X ảnh để thiết lập FaceID"
3. WHEN pose diversity is insufficient, THE Backend SHALL return: "Chưa đủ đa dạng tư thế (yaw: X°, pitch: Y°)"
4. WHEN face verification fails, THE Backend SHALL return: "Khuôn mặt không khớp (X% < 90%)"
5. WHEN GPS validation fails, THE Backend SHALL return: "Sai vị trí (Xm từ trường)"
6. WHEN liveness check fails, THE Backend SHALL return: "Không phát hiện người sống thực tế"
7. THE Frontend SHALL display these messages to user in Vietnamese
8. THE Frontend SHALL provide guidance on how to retry
9. THE Frontend SHALL allow maximum 3 retries per session
10. THE Frontend SHALL log all errors for debugging

