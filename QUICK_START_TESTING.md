# Quick Start Testing Guide - Anti-Fraud System

## 🚀 Quick Overview

The anti-fraud system is **fully implemented** with 3-layer protection:

1. **Deepfake Detection** - Rejects static images and AI-generated faces
2. **GPS Validation** - Rejects attendance from wrong location
3. **Face Embedding** - Rejects wrong person (< 90% match)

**Critical Rule**: If ANY check fails → REJECT IMMEDIATELY, don't record attendance.

## ✅ What's Been Fixed

### Bug Fix: Missing `stored` Variable
- **File**: `backend/main.py` line 1477
- **Issue**: Function used `stored` without defining it
- **Fix**: Added `stored = current_user.get("face_embedding")`
- **Status**: ✅ FIXED

## 📋 Testing Scenarios

### Scenario 1: Valid Attendance ✅ (Should PASS)

**What to do:**
1. Login as student with Face ID already setup
2. Click "Điểm danh"
3. Allow camera permission
4. Capture 1 frame with real face
5. Stand at school (GPS within 100m)

**Expected Result:**
```
✅ Liveness check: PASS (skipped for 1 frame)
✅ Deepfake check: PASS (confidence < 50%)
✅ GPS validation: PASS (distance < 100m)
✅ Face similarity: ≥ 90% match
✅ Attendance recorded
✅ Dashboard updates: attended_today ++1
✅ Message: "✅ Điểm danh thành công (95.2% khớp)"
```

**Backend Logs:**
```
✅ Deepfake check passed (confidence: 2.3%)
✅ GPS validation: ✅ OK (distance: 45.2m)
✅ Face match! Similarity: 95.20%
✅ Attendance recorded
```

---

### Scenario 2: Static Image Attack ❌ (Should FAIL)

**What to do:**
1. Login as student
2. Click "Điểm danh"
3. Show a **static photo** of a face to camera
4. System should reject immediately

**Expected Result:**
```
✅ Liveness check: PASS (skipped)
❌ Deepfake check: FAIL (confidence > 50%)
❌ STOP - Don't check GPS or face
❌ Attendance NOT recorded
❌ Dashboard does NOT update
❌ Message: "❌ PHÁT HIỆN ẢNH TĨnh/DEEPFAKE (87.5%)"
```

**Backend Logs:**
```
❌ DEEPFAKE DETECTED: 87.5% confidence
❌ PHÁT HIỆN ẢNH TĨnh/DEEPFAKE (87.5%). TỪ CHỐI ĐIỂM DANH.
```

---

### Scenario 3: GPS Spoofing Attack ❌ (Should FAIL)

**What to do:**
1. Login as student
2. Use GPS spoofer app to fake location (250m away from school)
3. Click "Điểm danh"
4. Capture 1 frame with real face
5. System should reject at GPS check

**Expected Result:**
```
✅ Liveness check: PASS
✅ Deepfake check: PASS (confidence < 50%)
❌ GPS validation: FAIL (distance > 100m)
❌ STOP - Don't check face
❌ Attendance NOT recorded
❌ Dashboard does NOT update
❌ Message: "❌ Vị trí không hợp lệ (250.5m từ trường)"
```

**Backend Logs:**
```
✅ Deepfake check passed (confidence: 2.3%)
⚠️ GPS validation failed: 250.5m from classroom
❌ Vị trí không hợp lệ (250.5m từ trường)
```

---

### Scenario 4: Wrong Face ❌ (Should FAIL)

**What to do:**
1. Login as student1
2. Have student2 capture frame
3. Click "Điểm danh"
4. System should reject at face check

**Expected Result:**
```
✅ Liveness check: PASS
✅ Deepfake check: PASS
✅ GPS validation: PASS
❌ Face similarity: 72.3% < 90%
❌ STOP - Reject immediately
❌ Attendance NOT recorded
❌ Dashboard does NOT update
❌ Message: "❌ Khuôn mặt không khớp (72.3% < 90%)"
```

**Backend Logs:**
```
✅ Deepfake check passed (confidence: 2.3%)
✅ GPS validation: ✅ OK (distance: 45.2m)
❌ Face mismatch: 72.3% < 90%
❌ Khuôn mặt không khớp (72.3% < 90%)
```

---

## 🧪 Manual Testing Steps

### Step 1: Start Backend
```bash
cd backend
python main.py
# Should see: "✅ ONNX model loaded" or "⚠️ ONNX model failed to load"
# Should see: "Uvicorn running on http://0.0.0.0:8002"
```

### Step 2: Start Frontend
```bash
cd frontend
npm start
# Should see: "Expo server running on http://localhost:19000"
```

### Step 3: Test Valid Attendance
1. Open app on phone/emulator
2. Login: `student1` / `password123`
3. Click "Điểm danh" button
4. Allow camera permission
5. Capture 1 frame with real face
6. Wait for all checks to complete
7. Should see: "✅ Điểm danh thành công"
8. Check dashboard: `attended_today` should increase by 1

### Step 4: Test Static Image
1. Login as student
2. Click "Điểm danh"
3. Show static photo to camera
4. Should see: "❌ PHÁT HIỆN ẢNH TĨnh/DEEPFAKE"
5. Check dashboard: `attended_today` should NOT change

### Step 5: Test GPS Spoofing
1. Install GPS spoofer app
2. Fake location to 250m away from school
3. Login as student
4. Click "Điểm danh"
5. Capture 1 frame
6. Should see: "❌ Vị trí không hợp lệ"
7. Check dashboard: `attended_today` should NOT change

### Step 6: Test Wrong Face
1. Login as student1
2. Have student2 capture frame
3. Click "Điểm danh"
4. Should see: "❌ Khuôn mặt không khớp"
5. Check dashboard: `attended_today` should NOT change

---

## 🔍 Verification Checklist

### Backend Endpoints

- [ ] `POST /attendance/liveness-check` - Returns `is_live` and `confidence`
- [ ] `POST /attendance/detect-deepfake` - Returns `is_deepfake` and `confidence`
- [ ] `POST /attendance/validate-gps` - Returns `is_valid` and `distance`
- [ ] `POST /student/generate-embedding` - Returns 512-dim embedding
- [ ] `POST /attendance/checkin-with-embedding` - All 3 checks work

### Check Order

- [ ] Deepfake check happens FIRST
- [ ] GPS check happens SECOND
- [ ] Face check happens THIRD
- [ ] If deepfake fails → STOP (don't check GPS)
- [ ] If GPS fails → STOP (don't check face)
- [ ] If face fails → STOP (reject)

### Attendance Recording

- [ ] Valid attendance: ✅ Recorded, ✅ Dashboard updates
- [ ] Static image: ❌ NOT recorded, ❌ Dashboard NOT updated
- [ ] GPS spoofing: ❌ NOT recorded, ❌ Dashboard NOT updated
- [ ] Wrong face: ❌ NOT recorded, ❌ Dashboard NOT updated

### Error Messages (Vietnamese)

- [ ] Deepfake: "❌ PHÁT HIỆN ẢNH TĨnh/DEEPFAKE (87.5%)"
- [ ] GPS: "❌ Vị trí không hợp lệ (250.5m từ trường)"
- [ ] Face: "❌ Khuôn mặt không khớp (72.3% < 90%)"
- [ ] Success: "✅ Điểm danh thành công (95.2% khớp)"

---

## 📊 Expected API Responses

### Valid Attendance Response
```json
{
  "success": true,
  "message": "✅ Điểm danh thành công (95.2% khớp)",
  "attendance_id": "...",
  "check_in_time": "2025-12-25T10:30:00",
  "validations": {
    "face": {
      "is_valid": true,
      "message": "✅ Khuôn mặt hợp lệ (95.2%)",
      "similarity_score": 0.952
    },
    "gps": {
      "is_valid": true,
      "message": "✅ Vị trí hợp lệ",
      "distance_meters": 45.2
    }
  },
  "face_similarity": 0.952,
  "liveness_score": 0.8,
  "deepfake_score": 0.02
}
```

### Deepfake Failure Response
```json
{
  "success": false,
  "message": "❌ PHÁT HIỆN ẢNH TĨnh/DEEPFAKE (87.5%). TỪ CHỐI ĐIỂM DANH.",
  "validations": {
    "face": {
      "is_valid": false,
      "message": "❌ PHÁT HIỆN ẢNH TĨnh/DEEPFAKE"
    },
    "gps": {
      "is_valid": false,
      "message": "❌ Không kiểm tra GPS do deepfake fail"
    }
  }
}
```

### GPS Failure Response
```json
{
  "success": false,
  "message": "❌ Vị trí không hợp lệ (250.5m từ trường)",
  "validations": {
    "gps": {
      "is_valid": false,
      "message": "❌ Vị trí không hợp lệ",
      "distance_meters": 250.5
    },
    "face": {
      "is_valid": false,
      "message": "❌ Không kiểm tra do GPS fail"
    }
  }
}
```

### Face Failure Response
```json
{
  "success": false,
  "message": "❌ Khuôn mặt không khớp (72.3% < 90% yêu cầu)",
  "validations": {
    "face": {
      "is_valid": false,
      "message": "❌ Khuôn mặt không khớp (72.3% < 90%)",
      "similarity_score": 0.723
    },
    "gps": {
      "is_valid": true,
      "message": "✅ Vị trí hợp lệ",
      "distance_meters": 45.2
    }
  }
}
```

---

## 🎯 Success Criteria

All of the following must be true:

1. ✅ Valid attendance records successfully
2. ✅ Dashboard updates only on successful attendance
3. ✅ Static image is rejected (deepfake check)
4. ✅ GPS spoofing is rejected (GPS check)
5. ✅ Wrong face is rejected (face similarity < 90%)
6. ✅ Checks happen in correct order: Deepfake → GPS → Face
7. ✅ If any check fails, system stops immediately
8. ✅ All error messages in Vietnamese
9. ✅ No syntax errors in code
10. ✅ All endpoints return correct format

---

## 📝 Logs to Monitor

### Backend Console
```
# Valid attendance
✅ Deepfake check passed (confidence: 2.3%)
✅ GPS validation: ✅ OK (distance: 45.2m)
✅ Face match! Similarity: 95.20%
✅ Attendance recorded

# Static image
❌ DEEPFAKE DETECTED: 87.5% confidence

# GPS spoofing
⚠️ GPS validation failed: 250.5m from classroom

# Wrong face
❌ Face mismatch: 72.3% < 90%
```

### Frontend Console
```
# Valid attendance
✅ Liveness check passed
✅ Deepfake check passed
✅ GPS validation passed
✅ Embedding generated
✅ Checkin response: success=true

# Static image
❌ Deepfake check failed - STOP

# GPS spoofing
✅ Deepfake check passed
❌ GPS validation failed - STOP

# Wrong face
✅ Deepfake check passed
✅ GPS validation passed
❌ Face similarity failed - STOP
```

---

## 🚀 Next Steps

1. **Run backend**: `cd backend && python main.py`
2. **Run frontend**: `cd frontend && npm start`
3. **Test valid attendance**: Should pass all checks
4. **Test static image**: Should fail at deepfake check
5. **Test GPS spoofing**: Should fail at GPS check
6. **Test wrong face**: Should fail at face check
7. **Verify dashboard**: Only updates on success
8. **Check logs**: Verify correct order and messages

---

## 📞 Troubleshooting

### Backend won't start
- Check Python version: `python --version`
- Check dependencies: `pip install -r requirements.txt`
- Check MongoDB connection: Verify `MONGO_URI` in `main.py`

### Frontend won't start
- Check Node version: `node --version`
- Check dependencies: `npm install`
- Check Expo: `npm install -g expo-cli`

### Endpoints return 404
- Check backend is running on port 8002
- Check endpoint names match exactly
- Check request headers include `Authorization: Bearer <token>`

### Attendance not recording
- Check MongoDB is connected
- Check `attendance_collection` exists
- Check user has Face ID setup
- Check all 3 checks pass

### Dashboard not updating
- Check `loadDashboard()` is called after success
- Check attendance record was inserted
- Check date matches today's date
- Check class_id matches

---

## 📚 Documentation

- `ANTI_FRAUD_SYSTEM.md` - Complete system documentation
- `ANTI_FRAUD_TESTING_GUIDE.md` - Detailed testing guide
- `IMPLEMENTATION_SUMMARY.md` - What's been implemented
- `EMBEDDING_BASED_CHECKIN_GUIDE.md` - Embedding verification
- `LIVENESS_DETECTION_GUIDE.md` - Liveness detection

