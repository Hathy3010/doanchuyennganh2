# Implementation Plan: Frontend-Backend Face ID Synchronization

## Overview

This implementation plan breaks down the Face ID synchronization feature into discrete, manageable coding tasks. Each task builds on previous ones, ensuring incremental progress and early validation through testing.

The implementation follows a backend-first approach:
1. First, ensure backend endpoints are correct and consistent
2. Then, update frontend to use these endpoints
3. Finally, add comprehensive tests

## Tasks

- [ ] 1. Backend: Verify and fix Face ID setup endpoint
  - Verify POST /student/setup-faceid endpoint exists and is correctly named
  - Ensure endpoint accepts FaceSetupRequest with images array
  - Verify endpoint processes frames in parallel using ThreadPoolExecutor
  - Ensure endpoint validates minimum 10 images
  - Verify endpoint detects face pose and generates embeddings
  - Ensure endpoint validates frontal face (yaw ±15°, pitch ±15°)
  - Verify endpoint calculates pose diversity (yaw_range, pitch_range)
  - Ensure endpoint saves embedding with metadata to MongoDB
  - Verify endpoint returns correct response format
  - _Requirements: 4.1-4.10, 5.1-5.10_

- [ ] 2. Backend: Verify and fix GET /auth/me endpoint
  - Verify GET /auth/me endpoint exists
  - Ensure endpoint returns user profile with face_embedding field
  - Verify face_embedding is null if not setup
  - Verify face_embedding is object with data array if setup
  - Ensure endpoint includes has_face_id boolean flag
  - Verify endpoint returns face_embedding metadata (created_at, samples_count, setup_type)
  - Ensure endpoint returns all required fields
  - Verify endpoint uses correct HTTP status codes
  - _Requirements: 2.1-2.6, 1.1-1.6_

- [ ] 3. Backend: Verify and fix POST /attendance/checkin-with-embedding endpoint
  - Verify POST /attendance/checkin-with-embedding endpoint exists
  - Ensure endpoint accepts class_id, latitude, longitude, image
  - Verify endpoint validates user has Face ID setup
  - Ensure endpoint decodes image and detects face
  - Verify endpoint generates embedding from current frame
  - Ensure endpoint retrieves stored embedding from database
  - Verify endpoint calculates cosine similarity
  - Ensure endpoint validates similarity >= 0.90
  - Verify endpoint performs anti-fraud checks (liveness, GPS, deepfake)
  - Ensure endpoint records attendance only if all checks pass
  - Verify endpoint returns detailed validation results
  - _Requirements: 7.1-7.10, 6.1-6.8_

- [ ] 4. Backend: Verify database synchronization
  - Verify backend/main.py uses MongoDB URL from backend/database.py
  - Ensure backend/main.py imports collections from database.py
  - Verify no duplicate collection definitions
  - Ensure all data writes go to correct MongoDB collection
  - Verify all data reads come from same collection
  - Check MongoDB connection is working
  - Verify database name is "smart_attendance"
  - _Requirements: 9.1-9.9_

- [ ] 5. Backend: Verify error handling and messages
  - Verify all error messages are in Vietnamese
  - Ensure error messages provide actionable guidance
  - Verify error responses include specific error reasons
  - Ensure error messages for insufficient frames
  - Verify error messages for poor pose diversity
  - Ensure error messages for face mismatch
  - Verify error messages for GPS mismatch
  - Ensure error messages for liveness failure
  - Verify all HTTP status codes are correct
  - _Requirements: 10.1-10.10_

- [ ] 6. Frontend: Update student dashboard to check Face ID status
  - Add state variable hasFaceIDSetup
  - Implement loadDashboard() to call GET /auth/me
  - Extract face_embedding from response
  - Set hasFaceIDSetup based on face_embedding presence
  - Display Face ID setup banner if hasFaceIDSetup is false
  - Add button to open Face ID setup modal
  - Update handleCheckIn() to check hasFaceIDSetup
  - If false, show setup prompt; if true, proceed to check-in
  - _Requirements: 1.1-1.6, 6.1-6.8_

- [ ] 7. Frontend: Implement Face ID setup modal
  - Create Face ID setup modal component
  - Implement setup sequence (5 poses × 3 frames each = 15 frames)
  - Add pose instruction display
  - Implement frame capture loop
  - Add progress display (current frame / total required)
  - Implement base64 encoding for captured frames
  - Add frame quality validation
  - Implement sendFramesToServerSetup() function
  - Call POST /student/setup-faceid with base64 images
  - Handle success response and update hasFaceIDSetup
  - _Requirements: 3.1-3.6_

- [ ] 8. Frontend: Implement Face ID verification in check-in modal
  - Update RandomActionAttendanceModal to support Face ID verification
  - Add check for hasFaceIDSetup before showing modal
  - Implement single frame capture for verification
  - Call POST /attendance/checkin-with-embedding with image
  - Display validation results (face, liveness, GPS, deepfake)
  - Show success message if all validations pass
  - Show specific error message if any validation fails
  - Implement retry logic (max 3 retries)
  - _Requirements: 6.1-6.8, 7.1-7.10_

- [ ] 9. Frontend: Update API configuration
  - Verify frontend/config/api.ts has correct API_URL
  - Ensure API_URL is set to backend port 8002
  - Verify platform-specific URLs (Android, iOS, Web)
  - Test API connection with testApiConnection()
  - Add logging for API URL detection
  - _Requirements: 8.1-8.7_

- [ ] 10. Checkpoint - Verify all endpoints are working
  - Test GET /auth/me returns correct format
  - Test POST /student/setup-faceid with sample images
  - Test POST /attendance/checkin-with-embedding with sample image
  - Verify MongoDB has correct data
  - Check all error messages are in Vietnamese
  - Ensure all HTTP status codes are correct
  - Verify frontend can call all endpoints
  - Ensure all responses parse correctly

- [ ] 11. Backend: Write property test for Face ID setup idempotence
  - **Property 1: Face ID Setup Idempotence**
  - **Validates: Requirements 4.1-4.10, 5.1-5.10**
  - Generate random valid frames
  - Call setup endpoint twice with same frames
  - Verify both calls produce same embedding (within floating-point precision)
  - Test with different frame counts (10, 15, 20)
  - Test with different pose angles

- [ ] 12. Backend: Write property test for Face ID status consistency
  - **Property 2: Face ID Status Consistency**
  - **Validates: Requirements 1.1-1.6, 2.1-2.6**
  - Setup Face ID for test user
  - Call GET /auth/me
  - Verify has_face_id flag matches face_embedding presence
  - Test with user that has Face ID
  - Test with user that doesn't have Face ID

- [ ] 13. Backend: Write property test for embedding similarity symmetry
  - **Property 3: Embedding Similarity Symmetry**
  - **Validates: Requirements 7.1-7.10**
  - Generate two random embeddings
  - Calculate similarity(A, B)
  - Calculate similarity(B, A)
  - Verify both similarities are equal (within floating-point precision)
  - Test with multiple embedding pairs

- [ ] 14. Backend: Write property test for pose diversity validation
  - **Property 4: Pose Diversity Validation**
  - **Validates: Requirements 4.7-4.9**
  - Generate frames with varying yaw and pitch angles
  - Call setup endpoint
  - Verify yaw_range >= 10° and pitch_range >= 5°
  - Test with frames that have insufficient diversity (should fail)
  - Test with frames that have sufficient diversity (should pass)

- [ ] 15. Backend: Write property test for frontal face validation
  - **Property 5: Frontal Face Validation**
  - **Validates: Requirements 4.5-4.6**
  - Generate frames with various pose angles
  - Call setup endpoint
  - Verify all valid frames have yaw ±15°, pitch ±15°
  - Test with frames outside tolerance (should be rejected)
  - Test with frames inside tolerance (should be accepted)

- [ ] 16. Backend: Write property test for embedding normalization
  - **Property 6: Embedding Normalization**
  - **Validates: Requirements 5.1-5.10**
  - Setup Face ID
  - Retrieve embedding from database
  - Calculate L2 norm of embedding
  - Verify norm is approximately 1.0 (within 0.01 tolerance)
  - Test with multiple embeddings

- [ ] 17. Backend: Write property test for database write-read consistency
  - **Property 7: Database Write-Read Consistency**
  - **Validates: Requirements 9.1-9.9**
  - Setup Face ID for test user
  - Read user document from database
  - Verify embedding data matches what was written
  - Test with multiple users
  - Test with multiple setups

- [ ] 18. Backend: Write property test for API response format consistency
  - **Property 8: API Response Format Consistency**
  - **Validates: Requirements 8.1-8.7**
  - Call GET /auth/me
  - Verify response includes all required fields
  - Verify field types are correct
  - Verify non-null fields are not null
  - Test with multiple users

- [ ] 19. Backend: Write property test for error message localization
  - **Property 9: Error Message Localization**
  - **Validates: Requirements 10.1-10.10**
  - Trigger various error conditions
  - Verify error messages are in Vietnamese
  - Verify error messages provide actionable guidance
  - Test with insufficient frames
  - Test with poor pose diversity
  - Test with face mismatch

- [ ] 20. Backend: Write property test for similarity threshold enforcement
  - **Property 10: Similarity Threshold Enforcement**
  - **Validates: Requirements 7.1-7.10**
  - Setup Face ID for test user
  - Generate embedding with similarity < 0.90
  - Call check-in endpoint
  - Verify verification fails
  - Verify actual similarity percentage is returned
  - Test with similarity >= 0.90 (should pass)

- [ ] 21. Frontend: Write unit tests for Face ID status detection
  - Test hasFaceIDSetup state updates correctly
  - Test banner displays when hasFaceIDSetup is false
  - Test banner doesn't display when hasFaceIDSetup is true
  - Test setup button opens modal
  - Test check-in button works when Face ID is setup

- [ ] 22. Frontend: Write unit tests for frame capture and encoding
  - Test frame capture from camera
  - Test base64 encoding of captured frames
  - Test frame quality validation
  - Test frame count tracking
  - Test progress display updates

- [ ] 23. Frontend: Write unit tests for API request/response parsing
  - Test GET /auth/me response parsing
  - Test POST /student/setup-faceid response parsing
  - Test POST /attendance/checkin-with-embedding response parsing
  - Test error response parsing
  - Test error message display

- [ ] 24. Frontend: Write unit tests for error handling
  - Test network error handling
  - Test API error handling
  - Test camera permission error handling
  - Test image processing error handling
  - Test retry logic

- [ ] 25. Integration: Test complete Face ID setup flow
  - Login as student
  - Check GET /auth/me returns has_face_id: false
  - Click "Setup Face ID"
  - Capture 15 frames
  - Send to POST /student/setup-faceid
  - Verify success response
  - Check MongoDB has embedding
  - Verify GET /auth/me now returns has_face_id: true

- [ ] 26. Integration: Test complete Face ID verification flow
  - Login as student (with Face ID already setup)
  - Check GET /auth/me returns has_face_id: true
  - Click "Check-in"
  - Capture 1 frame
  - Send to POST /attendance/checkin-with-embedding
  - Verify all validations pass
  - Check MongoDB has attendance record
  - Verify success message displays

- [ ] 27. Integration: Test Face ID error scenarios
  - Test setup with insufficient frames (< 10)
  - Test setup with poor pose diversity
  - Test verification with face mismatch
  - Test verification with GPS mismatch
  - Test verification with liveness failure
  - Verify appropriate error messages display

- [ ] 28. Final checkpoint - Ensure all tests pass
  - Run all unit tests
  - Run all property-based tests
  - Run all integration tests
  - Verify no TypeScript errors
  - Verify no Python errors
  - Check all error messages are in Vietnamese
  - Verify database is clean and consistent

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Property-based tests (11-20) validate universal correctness properties
- Unit tests (21-24) validate specific examples and edge cases
- Integration tests (25-27) validate end-to-end flows
- All property-based tests should run with minimum 100 iterations
- Tests should be co-located with source files using `.test.ts` or `_test.py` suffix
- Backend tasks (1-5, 11-20) use Python with pytest or similar framework
- Frontend tasks (6-9, 21-24) use TypeScript with Jest or similar framework
- Integration tests (25-27) test complete flows across frontend and backend

## Success Criteria

- ✅ All backend endpoints implemented and tested
- ✅ All frontend components updated and tested
- ✅ All API contracts matched between frontend and backend
- ✅ All error messages in Vietnamese
- ✅ All property-based tests passing
- ✅ All unit tests passing
- ✅ All integration tests passing
- ✅ No TypeScript or Python errors
- ✅ Database synchronization verified
- ✅ Face ID setup and verification working end-to-end

