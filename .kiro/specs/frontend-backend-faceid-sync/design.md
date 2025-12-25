# Design: Frontend-Backend Face ID Synchronization

## Overview

This design document specifies the complete architecture for synchronizing Face ID setup and verification between the React Native frontend and FastAPI backend. The system implements a two-phase approach:

1. **Setup Phase**: Student captures 15 frames from different angles, backend processes them to create a facial embedding
2. **Verification Phase**: Student captures 1 frame during check-in, backend verifies it matches stored embedding

The design ensures data consistency, robust error handling, and seamless user experience across both platforms.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    React Native Frontend                     │
│  (frontend/app/(tabs)/student.tsx)                          │
│  (frontend/components/RandomActionAttendanceModal.tsx)      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTP/REST API
                     │ (frontend/config/api.ts)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Backend                           │
│  (backend/main.py)                                          │
│  ├─ GET /auth/me                                            │
│  ├─ POST /student/setup-faceid                              │
│  ├─ POST /attendance/checkin-with-embedding                 │
│  └─ POST /detect-face-angle                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ MongoDB Driver
                     │ (backend/database.py)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    MongoDB Atlas                             │
│  Database: smart_attendance                                 │
│  Collections:                                               │
│  ├─ users (face_embedding field)                            │
│  ├─ classes                                                 │
│  ├─ attendance                                              │
│  └─ anti_fraud_logs                                         │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow Diagram

#### Face ID Setup Flow
```
Student Login
    ↓
Frontend: GET /auth/me
    ↓
Backend: Check face_embedding field
    ↓
IF face_embedding is null:
    ├─ Frontend: Show "Setup Face ID" banner
    ├─ Student: Click "Setup Face ID"
    ├─ Frontend: Open camera modal
    ├─ Frontend: Capture 15 frames (5 poses × 3 frames each)
    ├─ Frontend: POST /student/setup-faceid with base64 images
    ├─ Backend: Process frames in parallel
    │   ├─ Decode base64
    │   ├─ Detect face and pose angles
    │   ├─ Validate frontal face (yaw ±15°, pitch ±15°)
    │   ├─ Generate embedding for each frame
    │   └─ Calculate pose diversity
    ├─ Backend: Average embeddings
    ├─ Backend: Save to MongoDB with metadata
    ├─ Backend: Return success response
    ├─ Frontend: Show success message
    └─ Frontend: Update hasFaceIDSetup = true
ELSE:
    └─ Frontend: Allow direct check-in
```

#### Face ID Verification Flow
```
Student Check-in
    ↓
Frontend: Check hasFaceIDSetup
    ↓
IF hasFaceIDSetup is true:
    ├─ Frontend: Open camera for verification
    ├─ Student: Capture 1 frame
    ├─ Frontend: POST /attendance/checkin-with-embedding
    │   ├─ class_id
    │   ├─ latitude, longitude
    │   └─ image (base64)
    ├─ Backend: Decode image
    ├─ Backend: Generate embedding
    ├─ Backend: Retrieve stored embedding from MongoDB
    ├─ Backend: Calculate cosine similarity
    ├─ Backend: Perform anti-fraud checks
    │   ├─ Liveness detection
    │   ├─ Deepfake detection
    │   ├─ GPS validation
    │   └─ Embedding similarity (≥90%)
    ├─ Backend: Record attendance if all pass
    ├─ Backend: Return validation results
    └─ Frontend: Display success/failure message
```

## Components and Interfaces

### Frontend Components

#### 1. Student Dashboard (frontend/app/(tabs)/student.tsx)

**Responsibilities**:
- Load user profile and check Face ID status
- Display Face ID setup banner if needed
- Handle Face ID setup modal
- Manage attendance check-in flow

**Key State Variables**:
```typescript
const [hasFaceIDSetup, setHasFaceIDSetup] = useState(false);
const [showFaceSetupModal, setShowFaceSetupModal] = useState(false);
const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
```

**Key Functions**:
- `loadDashboard()`: Calls GET /auth/me and checks face_embedding
- `handleSetupFaceID()`: Opens Face ID setup modal
- `handleCheckIn()`: Initiates attendance check-in

#### 2. Face ID Setup Modal (frontend/app/(tabs)/student.tsx)

**Responsibilities**:
- Capture frames for Face ID setup
- Display pose instructions
- Show progress (frame count)
- Send frames to backend

**Setup Sequence**:
```typescript
const SETUP_SEQUENCE = [
  { id: 'neutral', instruction: 'Giữ khuôn mặt thẳng', target_frames: 3 },
  { id: 'blink', instruction: 'Hãy chớp mắt tự nhiên', target_frames: 2 },
  { id: 'mouth_open', instruction: 'Hãy mở miệng rộng ra', target_frames: 2 },
  { id: 'micro_movement', instruction: 'Hãy nhúc nhích đầu nhẹ', target_frames: 6 },
  { id: 'final_neutral', instruction: 'Giữ khuôn mặt thẳng', target_frames: 2 }
];
```

#### 3. Random Action Attendance Modal (frontend/components/RandomActionAttendanceModal.tsx)

**Responsibilities**:
- Capture frame for check-in
- Display anti-fraud validation progress
- Show validation results

**Phases**:
1. `selecting`: Show instruction, wait for user to tap capture
2. `detecting`: Capture single photo
3. `antifraud`: Show validation progress for 4 checks
4. `recording`: Show success message

### Backend Endpoints

#### 1. GET /auth/me

**Purpose**: Get current user profile with Face ID status

**Request**:
```
GET /auth/me
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "id": "507f1f77bcf86cd799439011",
  "username": "student1",
  "email": "student1@example.com",
  "full_name": "Nguyễn Văn A",
  "role": "student",
  "face_embedding": {
    "data": [0.0776, 0.0189, ...],  // 256 values
    "shape": [256],
    "dtype": "float32",
    "norm": "L2",
    "created_at": "2025-12-25T10:30:00Z",
    "samples_count": 15,
    "yaw_range": 45.2,
    "pitch_range": 38.5,
    "embedding_std": 0.0234,
    "setup_type": "pose_diversity"
  },
  "has_face_id": true,
  "is_online": false,
  "last_seen": "2025-12-25T10:30:00Z"
}
```

**Response** (if no Face ID):
```json
{
  "id": "507f1f77bcf86cd799439011",
  "username": "student1",
  "email": "student1@example.com",
  "full_name": "Nguyễn Văn A",
  "role": "student",
  "face_embedding": null,
  "has_face_id": false,
  "is_online": false,
  "last_seen": "2025-12-25T10:30:00Z"
}
```

#### 2. POST /student/setup-faceid

**Purpose**: Setup Face ID with multiple frames

**Request**:
```json
{
  "images": [
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...",
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...",
    ...
  ]
}
```

**Response** (200 OK):
```json
{
  "message": "FaceID setup completed successfully",
  "embedding_saved": true,
  "embedding_shape": [256],
  "samples_used": 15,
  "total_samples": 15,
  "yaw_range": 45.2,
  "pitch_range": 38.5,
  "setup_type": "face_id_diversity"
}
```

**Error Responses**:
- 400: "Cần ít nhất 10 ảnh để thiết lập FaceID"
- 400: "Chỉ có 7 frame hợp lệ. Cần ít nhất 8 frame."
- 400: "Chưa đủ đa dạng tư thế (yaw: 5.2°, pitch: 3.1°). Vui lòng di chuyển đầu nhiều hơn."

#### 3. POST /attendance/checkin-with-embedding

**Purpose**: Check-in with Face ID verification

**Request**:
```json
{
  "class_id": "507f1f77bcf86cd799439011",
  "latitude": 10.762622,
  "longitude": 106.660172,
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD..."
}
```

**Response** (200 OK):
```json
{
  "status": "success",
  "attendance_id": "att_123",
  "check_in_time": "2025-12-25T10:30:00Z",
  "validations": {
    "face": {
      "is_valid": true,
      "similarity_score": 0.952,
      "message": "✅ Khuôn mặt khớp (95.2%)"
    },
    "liveness": {
      "is_valid": true,
      "message": "✅ Người sống thực tế"
    },
    "deepfake": {
      "is_valid": true,
      "message": "✅ Ảnh thực tế"
    },
    "gps": {
      "is_valid": true,
      "distance_meters": 45,
      "message": "✅ Vị trí hợp lệ"
    }
  },
  "warnings": [],
  "message": "✅ Điểm danh thành công"
}
```

**Error Responses**:
- 400: "Không tìm thấy khuôn mặt"
- 403: "Khuôn mặt không khớp (72.5% < 90%)"
- 400: "Sai vị trí (250m từ trường)"
- 400: "Không phát hiện người sống thực tế"

#### 4. POST /detect-face-angle

**Purpose**: Detect face angles for pose validation

**Request**:
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD..."
}
```

**Response** (200 OK):
```json
{
  "face_present": true,
  "yaw": 5.2,
  "pitch": -3.1,
  "roll": 1.5,
  "message": "Face detected - yaw: 5.2°, pitch: -3.1°"
}
```

## Data Models

### User Document (MongoDB)

```javascript
{
  _id: ObjectId,
  username: "student1",
  email: "student1@example.com",
  password: "plain_text",
  full_name: "Nguyễn Văn A",
  role: "student",
  
  // Face ID Embedding (New Format)
  face_embedding: {
    data: [0.0776, 0.0189, 0.0041, -0.0808, ...],  // 256 float32 values
    shape: [256],
    dtype: "float32",
    norm: "L2",
    created_at: ISODate("2025-12-25T10:30:00Z"),
    samples_count: 15,
    yaw_range: 45.2,
    pitch_range: 38.5,
    embedding_std: 0.0234,
    setup_type: "pose_diversity"
  },
  
  // Legacy fields (backward compatible)
  face_id_setup: true,
  face_id_setup_date: ISODate("2025-12-25T10:30:00Z"),
  face_id_samples: 15,
  face_id_yaw_range: 45.2,
  face_id_pitch_range: 38.5,
  face_id_embedding_std: 0.0234,
  face_id_setup_type: "pose_diversity",
  
  is_online: false,
  last_seen: ISODate("2025-12-25T10:30:00Z"),
  created_at: ISODate("2025-12-25T10:00:00Z")
}
```

### Attendance Record (MongoDB)

```javascript
{
  _id: ObjectId,
  student_id: ObjectId,
  class_id: ObjectId,
  date: "2025-12-25",
  check_in_time: ISODate("2025-12-25T10:30:00Z"),
  status: "present",
  verification_method: "face_embedding",
  
  location: {
    latitude: 10.762622,
    longitude: 106.660172
  },
  
  validations: {
    face: {
      is_valid: true,
      similarity_score: 0.952,
      message: "✅ Khuôn mặt khớp (95.2%)"
    },
    liveness: {
      is_valid: true,
      message: "✅ Người sống thực tế"
    },
    deepfake: {
      is_valid: true,
      message: "✅ Ảnh thực tế"
    },
    gps: {
      is_valid: true,
      distance_meters: 45,
      message: "✅ Vị trí hợp lệ"
    }
  },
  
  warnings: [],
  created_at: ISODate("2025-12-25T10:30:00Z")
}
```

## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Face ID Setup Idempotence

**For any** student who completes Face ID setup, calling the setup endpoint again with the same frames should produce the same embedding (within floating-point precision).

**Validates: Requirements 4.1-4.10, 5.1-5.10**

**Rationale**: This ensures that re-running setup with identical input produces consistent results, which is critical for system reliability.

### Property 2: Face ID Status Consistency

**For any** student, the has_face_id flag returned by GET /auth/me should match whether face_embedding is null or contains data.

**Validates: Requirements 1.1-1.6, 2.1-2.6**

**Rationale**: This ensures the frontend can reliably determine setup status without parsing the embedding object.

### Property 3: Embedding Similarity Symmetry

**For any** two embeddings A and B, the cosine similarity between A and B should equal the similarity between B and A.

**Validates: Requirements 7.1-7.10**

**Rationale**: This ensures that face verification is symmetric and consistent regardless of which embedding is stored vs. current.

### Property 4: Pose Diversity Validation

**For any** Face ID setup with valid frames, the calculated yaw_range and pitch_range should be greater than or equal to the minimum thresholds (yaw ≥ 10°, pitch ≥ 5°).

**Validates: Requirements 4.7-4.9**

**Rationale**: This ensures that only setups with sufficient pose diversity are accepted, improving embedding robustness.

### Property 5: Frontal Face Validation

**For any** frame marked as valid in Face ID setup, the pose angles should be within tolerance (yaw ±15°, pitch ±15°).

**Validates: Requirements 4.5-4.6**

**Rationale**: This ensures that only frontal faces are used for embedding generation, improving accuracy.

### Property 6: Embedding Normalization

**For any** embedding stored in the database, the L2 norm should be approximately 1.0 (within 0.01 tolerance).

**Validates: Requirements 5.1-5.10**

**Rationale**: This ensures embeddings are properly normalized for consistent similarity calculations.

### Property 7: Database Write-Read Consistency

**For any** Face ID setup that completes successfully, reading the user document from MongoDB should return the same embedding data that was written.

**Validates: Requirements 9.1-9.9**

**Rationale**: This ensures data persistence and consistency between frontend and backend.

### Property 8: API Response Format Consistency

**For any** successful API response, the response should include all required fields with correct data types and non-null values where specified.

**Validates: Requirements 8.1-8.7**

**Rationale**: This ensures frontend can reliably parse responses without defensive coding.

### Property 9: Error Message Localization

**For any** error response from the backend, the error message should be in Vietnamese and provide actionable guidance.

**Validates: Requirements 10.1-10.10**

**Rationale**: This ensures users understand what went wrong and how to fix it.

### Property 10: Similarity Threshold Enforcement

**For any** Face ID verification attempt, if the embedding similarity is less than 0.90, the verification should fail and return the actual similarity percentage.

**Validates: Requirements 7.1-7.10**

**Rationale**: This ensures the system enforces the 90% similarity threshold consistently.

## Error Handling

### Frontend Error Handling

1. **Network Errors**:
   - Catch fetch errors and display: "Lỗi kết nối. Vui lòng kiểm tra internet."
   - Retry up to 3 times with exponential backoff
   - Allow manual retry

2. **API Errors**:
   - Parse error response and display message to user
   - Log error details for debugging
   - Provide guidance based on error type

3. **Camera Errors**:
   - Handle permission denied: "Cần cấp quyền camera để tiếp tục"
   - Handle camera unavailable: "Camera không khả dụng"
   - Provide fallback options

4. **Image Processing Errors**:
   - Handle invalid base64: "Lỗi xử lý ảnh. Vui lòng thử lại."
   - Handle image too small: "Ảnh quá nhỏ. Vui lòng chụp lại."
   - Handle no face detected: "Không tìm thấy khuôn mặt. Vui lòng chụp lại."

### Backend Error Handling

1. **Validation Errors**:
   - Return 400 with specific error message
   - Include guidance on how to fix

2. **Processing Errors**:
   - Log full error with traceback
   - Return 500 with generic message: "Lỗi xử lý. Vui lòng thử lại."
   - Include request ID for debugging

3. **Database Errors**:
   - Log connection errors
   - Return 500 with generic message
   - Implement retry logic for transient errors

4. **Authentication Errors**:
   - Return 401 for invalid token
   - Return 403 for insufficient permissions

## Testing Strategy

### Unit Tests

1. **Frontend Tests**:
   - Test hasFaceIDSetup state updates
   - Test frame capture and base64 encoding
   - Test API request/response parsing
   - Test error message display

2. **Backend Tests**:
   - Test embedding generation
   - Test pose angle calculation
   - Test similarity calculation
   - Test database operations

### Property-Based Tests

1. **Embedding Properties**:
   - Test idempotence: setup(frames) == setup(frames)
   - Test normalization: norm(embedding) ≈ 1.0
   - Test similarity symmetry: sim(A,B) == sim(B,A)

2. **Pose Properties**:
   - Test diversity calculation: yaw_range >= 10°, pitch_range >= 5°
   - Test frontal validation: yaw ±15°, pitch ±15°

3. **API Properties**:
   - Test response format consistency
   - Test error message localization
   - Test similarity threshold enforcement

### Integration Tests

1. **End-to-End Setup Flow**:
   - Login → Check Face ID status → Setup Face ID → Verify saved

2. **End-to-End Verification Flow**:
   - Login → Check Face ID status → Check-in → Verify attendance

3. **Error Scenarios**:
   - Setup with insufficient frames
   - Setup with poor pose diversity
   - Verification with face mismatch
   - Verification with GPS mismatch

## Configuration

### Backend Configuration (backend/main.py)

```python
# Face ID Setup
MIN_SETUP_IMAGES = 10
MIN_VALID_FRAMES = 8
YAW_RANGE_MIN = 10.0  # degrees
PITCH_RANGE_MIN = 5.0  # degrees

# Face Pose Validation
YAW_TOLERANCE = 15.0  # degrees
PITCH_TOLERANCE = 15.0  # degrees
ROLL_TOLERANCE = 10.0  # degrees

# Face Verification
SIMILARITY_THRESHOLD = 0.90  # 90%
EMBEDDING_DIMENSION = 256

# GPS Validation
DEFAULT_LOCATION = {
    "latitude": 10.762622,
    "longitude": 106.660172,
    "radius_meters": 100
}

# Database
MONGO_URI = "mongodb+srv://doan:abc@doan.h7dlpmc.mongodb.net/"
DB_NAME = "smart_attendance"
```

### Frontend Configuration (frontend/config/api.ts)

```typescript
// Platform-specific API URLs
export const API_CONFIGS = {
  localhost: 'http://localhost:8002',
  android: 'http://10.0.2.2:8002',
  ios_network: 'http://192.168.1.8:8002',
  production: 'https://your-production-api.com'
};

// Timeout settings
const API_TIMEOUT = 30000;  // 30 seconds
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000;  // 1 second
```

## Performance Considerations

### Backend Performance

- **Embedding Generation**: 50-100ms per frame
- **Pose Detection**: 30-50ms per frame
- **Parallel Processing**: 15 frames processed in ~500-1000ms
- **Database Insert**: 10-50ms
- **Total Setup Time**: ~1-2 seconds

### Frontend Performance

- **Frame Capture**: 100-200ms per frame
- **Base64 Encoding**: 50-100ms per frame
- **API Request**: 100-500ms (network dependent)
- **Total Check-in Time**: ~1-2 seconds

## Security Considerations

1. **Authentication**: All endpoints require valid JWT token
2. **Authorization**: Users can only access their own data
3. **Data Encryption**: MongoDB connection uses SSL/TLS
4. **Password Storage**: Currently plain text (should be hashed in production)
5. **API Rate Limiting**: Should be implemented to prevent abuse
6. **Input Validation**: All inputs validated before processing
7. **Error Messages**: Don't leak sensitive information

## Deployment Considerations

1. **Database Migration**: Ensure MongoDB is accessible from backend
2. **API URL Configuration**: Update frontend config for target environment
3. **CORS Configuration**: Backend allows requests from frontend domain
4. **SSL Certificates**: Use HTTPS in production
5. **Environment Variables**: Store sensitive config in environment
6. **Monitoring**: Log all Face ID operations for audit trail
7. **Backup**: Regular MongoDB backups

