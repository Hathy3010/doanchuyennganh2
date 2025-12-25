# Quick Verification Guide - Random Action Attendance System

## Overview
This guide helps you quickly verify that the random action attendance system with anti-fraud checks is working correctly.

---

## Prerequisites
- Backend running on `http://localhost:8000`
- Frontend running on emulator/device
- Student account with Face ID setup completed
- At least one class in schedule

---

## Test 1: Verify Backend Endpoints

### 1.1 Test select-action endpoint
```bash
curl -X POST http://localhost:8000/attendance/select-action \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{}'
```

**Expected Response:**
```json
{
  "action": "neutral",  // or blink, mouth_open, head_movement
  "instruction": "Giữ khuôn mặt thẳng trong khung",
  "timeout": 10,
  "message": "✅ Hành động được chọn"
}
```

### 1.2 Test verify-action endpoint
```bash
curl -X POST http://localhost:8000/attendance/verify-action \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "image": "BASE64_ENCODED_IMAGE",
    "required_action": "neutral"
  }'
```

**Expected Response:**
```json
{
  "action_detected": "neutral",
  "is_correct": true,
  "confidence": 0.95,
  "message": "✅ Hành động đúng",
  "yaw": 2.5,
  "pitch": -1.2,
  "roll": 0.8
}
```

### 1.3 Test checkin-with-action endpoint
```bash
curl -X POST http://localhost:8000/attendance/checkin-with-action \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "class_id": "CLASS_ID",
    "latitude": 10.762622,
    "longitude": 106.660172,
    "image": "BASE64_ENCODED_IMAGE",
    "action_required": "neutral"
  }'
```

**Expected Response:**
```json
{
  "status": "success",
  "attendance_id": "...",
  "check_in_time": "2024-01-15T10:30:00",
  "validations": {
    "action": {
      "is_valid": true,
      "message": "✅ Hành động đúng"
    },
    "liveness": {
      "is_valid": true,
      "message": "✅ Người sống thực tế",
      "score": 0.85
    },
    "deepfake": {
      "is_valid": true,
      "message": "✅ Ảnh thực tế",
      "confidence": 0.02
    },
    "gps": {
      "is_valid": true,
      "message": "✅ Vị trí hợp lệ",
      "distance_meters": 45.2
    },
    "embedding": {
      "is_valid": true,
      "message": "✅ Khuôn mặt khớp (95.2%)",
      "similarity": 0.952
    }
  },
  "message": "✅ Điểm danh thành công"
}
```

---

## Test 2: Verify Frontend Flow

### 2.1 Open Student Dashboard
1. Login with student account
2. Navigate to "Điểm danh" tab
3. Verify dashboard loads with today's schedule

### 2.2 Test Check-in Flow
1. Tap "📍 Điểm danh" button on a class card
2. Verify camera permission is requested
3. Verify camera displays in modal
4. Verify modal shows "🎲 Chọn hành động..." message
5. Verify countdown timer appears (10s)
6. Verify system captures frames automatically
7. Verify detection message updates in real-time

### 2.3 Test Successful Check-in
1. Perform the required action (system will detect automatically)
2. Verify action is detected correctly
3. Verify anti-fraud checks progress is displayed
4. Verify all 5 checks pass:
   - ✅ Action verification
   - ✅ Liveness detection
   - ✅ Deepfake detection
   - ✅ GPS validation
   - ✅ Embedding verification
5. Verify success message: "✅ Điểm danh thành công!"
6. Verify dashboard refreshes with updated attendance status

### 2.4 Test Retry Mechanism
1. Perform wrong action (e.g., blink when neutral is required)
2. Verify system detects mismatch
3. Verify retry count increases (1/3, 2/3, 3/3)
4. Verify system allows up to 3 retries
5. Verify error message after 3 failed attempts

### 2.5 Test Error Handling
1. Test with no face detected
   - Expected: "❌ Không phát hiện khuôn mặt"
2. Test with invalid GPS location
   - Expected: "❌ Sai vị trí (XXXm từ trường)"
3. Test with face mismatch (embedding < 90%)
   - Expected: "❌ Khuôn mặt không khớp (XX.X% < 90%)"

---

## Test 3: Verify Embedding Comparison

### 3.1 Check Stored Embedding
```bash
curl -X GET http://localhost:8000/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "id": "...",
  "username": "student1",
  "has_face_id": true,
  "face_embedding": {
    "data": [...],  // 256-dimensional array
    "shape": [256],
    "dtype": "float32",
    "norm": "L2",
    "created_at": "2024-01-15T09:00:00",
    "setup_type": "single_frame"
  }
}
```

### 3.2 Verify Similarity Calculation
1. Capture frame during check-in
2. Check backend logs for similarity score
3. Verify similarity is ≥90% for successful check-in
4. Verify similarity is <90% for failed check-in

**Expected Log Output:**
```
✅ Embedding verification passed (95.2%)
```

---

## Test 4: Verify Anti-Fraud Checks

### 4.1 Action Verification
- ✅ Detects correct action
- ✅ Rejects wrong action
- ✅ Handles no face detected

### 4.2 Liveness Detection
- ✅ Assumes live for single frame (simplified)
- ✅ Can be enhanced with blink/movement detection

### 4.3 Deepfake Detection
- ✅ Assumes real for single frame (simplified)
- ✅ Can be enhanced with Xception model

### 4.4 GPS Validation
- ✅ Accepts location within 100m of school
- ✅ Rejects location outside 100m radius
- ✅ Returns distance in meters

### 4.5 Embedding Verification
- ✅ Compares with stored embedding
- ✅ Uses cosine similarity metric
- ✅ Threshold: ≥90%
- ✅ Returns similarity percentage

---

## Test 5: Verify Vietnamese Messages

All messages should be in Vietnamese:

| Message | Vietnamese |
|---------|-----------|
| Check-in | 📍 Điểm danh |
| Verifying | 📸 Đang xác thực... |
| Success | ✅ Điểm danh thành công! |
| Wrong action | ❌ Hành động sai |
| No face | ❌ Không phát hiện khuôn mặt |
| Invalid GPS | ❌ Sai vị trí |
| Face mismatch | ❌ Khuôn mặt không khớp |
| Liveness failed | ❌ Phát hiện ảnh tĩnh/giả mạo |
| Deepfake detected | ❌ Phát hiện deepfake/AI-generated |

---

## Test 6: Verify Retry Mechanism

1. Attempt check-in with wrong action
2. Verify retry count: 1/3
3. Attempt again with wrong action
4. Verify retry count: 2/3
5. Attempt again with wrong action
6. Verify retry count: 3/3
7. Attempt again
8. Verify error: "Vượt quá số lần thử. Vui lòng thử lại sau."
9. Verify modal closes

---

## Test 7: Verify GPS Validation

### 7.1 Valid GPS (within 100m)
- Location: 10.762622, 106.660172 (school)
- Expected: ✅ Vị trí hợp lệ

### 7.2 Invalid GPS (outside 100m)
- Location: 10.763622, 106.661172 (far from school)
- Expected: ❌ Sai vị trí (XXXm từ trường)

---

## Test 8: Verify Embedding Verification

### 8.1 Matching Face (≥90%)
- Use same person who did Face ID setup
- Expected: ✅ Khuôn mặt khớp (95.2%)

### 8.2 Non-Matching Face (<90%)
- Use different person
- Expected: ❌ Khuôn mặt không khớp (45.3% < 90%)

---

## Debugging Tips

### Check Backend Logs
```bash
# Watch backend logs in real-time
tail -f backend.log

# Look for these patterns:
# ✅ = Success
# ❌ = Error
# 🔍 = Detection
# 📋 = Check-in
# 🛡️ = Anti-fraud
```

### Check Frontend Logs
```bash
# In React Native debugger or console
console.log('✅ Detection result:', result);
console.log('❌ Error:', error);
```

### Common Issues

**Issue**: "❌ Không phát hiện khuôn mặt"
- **Cause**: Face not visible in camera
- **Solution**: Ensure face is centered in camera frame

**Issue**: "❌ Hành động sai"
- **Cause**: Detected action doesn't match required action
- **Solution**: Perform the correct action (system will show "📸 Đang xác thực...")

**Issue**: "❌ Khuôn mặt không khớp"
- **Cause**: Embedding similarity < 90%
- **Solution**: Ensure same person who did Face ID setup is checking in

**Issue**: "❌ Sai vị trí"
- **Cause**: GPS location outside 100m radius
- **Solution**: Move closer to school location

**Issue**: "Vượt quá số lần thử"
- **Cause**: Failed 3 times
- **Solution**: Try again later, ensure correct action and location

---

## Success Criteria

✅ All 5 anti-fraud checks pass
✅ Embedding similarity ≥90%
✅ GPS validation passes
✅ Attendance recorded in database
✅ Dashboard refreshes with updated status
✅ All messages in Vietnamese
✅ Retry mechanism works (max 3 attempts)

---

## Next Steps

1. Run all tests above
2. Verify all success criteria are met
3. Test with multiple students
4. Test with different actions
5. Test with different locations
6. Monitor backend logs for errors
7. Check database for attendance records
8. Verify embedding similarity scores

---

## Support

If you encounter any issues:
1. Check backend logs for error messages
2. Check frontend console for error messages
3. Verify Face ID setup is completed
4. Verify GPS location is correct
5. Verify camera permissions are granted
6. Verify network connection is stable
