# Face ID Frame Validation - Design Document

## Overview

The Face ID frame validation system processes video frames captured from the frontend camera and validates them for use in Face ID setup. The system must handle base64-encoded JPEG images, perform quality checks, detect faces, and extract pose information.

## Architecture

```
Frontend (Camera Capture)
    ↓
    └─→ takePictureAsync() → base64 with prefix
        ↓
        └─→ validateCurrentPose() → POST /detect_face_pose_and_expression
            ↓
            └─→ Backend processes frame
                ├─ Strip base64 prefix
                ├─ Decode image
                ├─ Quality check
                ├─ Face detection
                └─ Return pose info
        ↓
        └─→ Store frame if valid
        ↓
        └─→ Repeat for each action
        ↓
        └─→ sendFramesToServer() → POST /student/setup-faceid
            ↓
            └─→ Backend processes all frames
                ├─ Decode each frame
                ├─ Quality check
                ├─ Face detection
                ├─ Pose extraction
                ├─ Embedding generation
                └─ Return summary
```

## Components and Interfaces

### Frontend Components

**CameraCapture**
- Captures frames using `expo-camera`
- Encodes as base64 with quality 0.9
- Validates frame is not empty
- Sends to backend for validation

**FrameValidator**
- Validates base64 format
- Checks frame size
- Sends to detection endpoint

### Backend Components

**FrameDecoder**
- Strips base64 prefix if present
- Decodes base64 to bytes
- Decodes bytes to OpenCV image
- Validates image is not None

**QualityChecker**
- Checks image dimensions
- Checks brightness levels
- Checks blur levels
- Returns quality score

**FaceDetector**
- Detects face in image
- Extracts landmarks
- Calculates pose angles (yaw, pitch, roll)
- Returns pose information

**EmbeddingGenerator**
- Aligns face using landmarks
- Generates face embedding
- Normalizes embedding
- Returns embedding vector

## Data Models

### Frame Data Structure

```python
{
    "base64": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",  # With or without prefix
    "size_bytes": 45000,
    "quality": 0.9
}
```

### Processed Frame Result

```python
{
    "embedding": [0.1, 0.2, ...],  # 256-dim vector
    "yaw": 15.5,                    # degrees
    "pitch": -5.2,                  # degrees
    "roll": 2.1,                    # degrees
    "face_detected": True,
    "quality_score": 0.95
}
```

### Error Result

```python
{
    "error": "Invalid image format",
    "frame_index": 5,
    "stage": "decode"  # decode, quality, face_detection, embedding
}
```

## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Base64 Decoding Idempotence

*For any* base64-encoded frame (with or without prefix), decoding it should produce a valid OpenCV image that can be re-encoded to produce equivalent base64.

**Validates: Requirements 1.1, 1.2, 1.4**

### Property 2: Quality Check Consistency

*For any* frame that passes quality checks, re-running the quality check should produce the same result (idempotence).

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 3: Face Detection Determinism

*For any* frame with a detectable face, running face detection multiple times should produce the same pose angles (within tolerance of ±1 degree).

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 4: Embedding Generation Stability

*For any* frame with a detected face, generating an embedding multiple times should produce embeddings with cosine similarity > 0.99.

**Validates: Requirements 3.4**

### Property 5: Error Logging Completeness

*For any* frame that fails processing, the backend SHALL log the frame index, error message, and processing stage.

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 6: Frame Collection Round-Trip

*For any* set of frames sent from frontend to backend, the backend SHALL process all frames and return a summary indicating which frames were valid and which were invalid.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

## Error Handling

### Frame Decoding Errors

- **Empty base64**: Log warning, mark frame invalid
- **Invalid base64 format**: Log error, mark frame invalid
- **Corrupted image data**: Log error, mark frame invalid
- **Unsupported image format**: Log error, mark frame invalid

### Quality Check Errors

- **Image too small**: Log warning, mark frame invalid
- **Image too dark**: Log warning, mark frame invalid
- **Image too blurry**: Log warning, mark frame invalid

### Face Detection Errors

- **No face detected**: Log info, mark frame invalid
- **Multiple faces detected**: Log warning, use largest face
- **Face detection timeout**: Log error, mark frame invalid

### Embedding Generation Errors

- **Face alignment failed**: Log error, mark frame invalid
- **Embedding generation failed**: Log error, mark frame invalid

## Testing Strategy

### Unit Tests

1. **Base64 Decoding**
   - Test with prefix
   - Test without prefix
   - Test invalid base64
   - Test corrupted data

2. **Quality Checking**
   - Test minimum dimensions
   - Test brightness levels
   - Test blur detection

3. **Face Detection**
   - Test with face
   - Test without face
   - Test multiple faces
   - Test extreme angles

4. **Embedding Generation**
   - Test embedding shape
   - Test embedding normalization
   - Test embedding stability

### Property-Based Tests

1. **Base64 Decoding Round-Trip**
   - Generate random valid images
   - Encode to base64
   - Decode from base64
   - Verify image equivalence

2. **Quality Check Idempotence**
   - Generate random images
   - Run quality check twice
   - Verify results are identical

3. **Face Detection Determinism**
   - Generate random face images
   - Run face detection multiple times
   - Verify pose angles within tolerance

4. **Embedding Stability**
   - Generate random face images
   - Generate embeddings multiple times
   - Verify cosine similarity > 0.99

5. **Frame Collection Completeness**
   - Generate random frame sets
   - Send to backend
   - Verify all frames processed
   - Verify summary accuracy

