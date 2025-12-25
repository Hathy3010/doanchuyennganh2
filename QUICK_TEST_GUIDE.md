# Quick Test Guide - Random Action Attendance

## How to Test

### Prerequisites
- Backend running on `http://localhost:8000`
- Frontend running on emulator/device
- User logged in with Face ID already set up
- GPS enabled on device

### Test Flow

#### 1. Basic Check-In Flow
```
1. Open student dashboard
2. Find a class card
3. Tap "📍 Điểm danh" button
4. Grant camera permission if prompted
5. RandomActionAttendanceModal opens
6. Tap "🎬 Bắt đầu" button
7. Wait for action selection
8. Perform the requested action (e.g., "Giữ khuôn mặt thẳng")
9. Wait for anti-fraud checks
10. See success message
11. Dashboard refreshes with "present" status
```

#### 2. Test Each Action
```
Neutral: Keep face straight in frame
Blink: Blink eyes naturally
Mouth Open: Open mouth wide
Head Movement: Move head slightly
```

#### 3. Test Error Scenarios

**Wrong Action**
- Perform different action than requested
- Should see: "❌ Hành động sai"
- Should allow retry

**No Face Detected**
- Turn away from camera
- Should see: "❌ Không phát hiện khuôn mặt"
- Should allow retry

**GPS Out of Range**
- Disable GPS or move far from school
- Should see: "❌ Sai vị trí"
- Should fail check-in

**Face Mismatch**
- Use different face (if possible)
- Should see: "❌ Khuôn mặt không khớp"
- Should fail check-in

#### 4. Test Retry Mechanism
```
1. Fail action detection 3 times
2. Should see: "Vượt quá số lần thử"
3. Modal should close
4. Should allow new check-in attempt
```

#### 5. Test Timeout
```
1. Start check-in
2. Don't perform action for 10 seconds
3. Should see: "⏱️ Hết thời gian"
4. Should allow retry
```

---

## Expected Messages (All in Vietnamese)

### Success Messages
- ✅ "Hành động được chọn: [action]"
- ✅ "Hành động đúng"
- ✅ "Người sống thực tế"
- ✅ "Ảnh thực tế"
- ✅ "Vị trí hợp lệ"
- ✅ "Khuôn mặt khớp"
- ✅ "Điểm danh thành công!"

### Error Messages
- ❌ "Ảnh không hợp lệ"
- ❌ "Không phát hiện khuôn mặt"
- ❌ "Hành động sai"
- ❌ "Phát hiện ảnh tĩnh/giả mạo"
- ❌ "Sai vị trí"
- ❌ "Khuôn mặt không khớp"
- ❌ "Chưa thiết lập Face ID"

### Progress Messages
- ⏳ "Chọn hành động ngẫu nhiên..."
- ⏳ "Đang kiểm tra..."
- ⏳ "Đang gửi dữ liệu..."
- ⏳ "Kiểm tra chống gian lận..."

---

## Validation Progress Display

During anti-fraud checks, you should see:
```
✅ Hành động - ✅ Hành động đúng
⏳ Liveness - ⏳ Đang kiểm tra...
⏳ Deepfake - ⏳ Đang kiểm tra...
⏳ GPS - ⏳ Đang kiểm tra...
⏳ Embedding - ⏳ Đang kiểm tra...
```

After all checks pass:
```
✅ Hành động - ✅ Hành động đúng
✅ Liveness - ✅ Người sống thực tế
✅ Deepfake - ✅ Ảnh thực tế
✅ GPS - ✅ Vị trí hợp lệ
✅ Embedding - ✅ Khuôn mặt khớp (95.2%)
```

---

## Countdown Timer

- Starts at 10 seconds
- Counts down in real-time
- Shows as: "⏱️ 10s", "⏱️ 9s", etc.
- When reaches 0: "⏱️ Hết thời gian"
- Allows retry

---

## Retry Counter

- Shows as: "Lần thử: 1/3", "Lần thử: 2/3", "Lần thử: 3/3"
- After 3 failed attempts: "Vượt quá số lần thử"
- Modal closes and allows new check-in

---

## Dashboard Refresh

After successful check-in:
1. Modal closes
2. Dashboard refreshes
3. Class card shows "present" status (green badge)
4. Attended count increases

---

## Backend Logs

Check backend logs for:
```
✅ Action verification passed
✅ Liveness check passed
✅ Deepfake check passed
✅ GPS validation passed
✅ Embedding verification passed
✅ Attendance recorded
```

---

## Teacher Notifications

Teachers should receive real-time notifications:
```
{
  "type": "attendance_update",
  "class_id": "...",
  "student_id": "...",
  "student_name": "...",
  "status": "present",
  "check_in_time": "...",
  "action": "neutral",
  "message": "✅ Điểm danh thành công"
}
```

---

## Common Issues & Solutions

### Issue: "Camera permission denied"
**Solution**: Grant camera permission in device settings

### Issue: "No face detected"
**Solution**: Ensure face is clearly visible in camera frame

### Issue: "Action mismatch"
**Solution**: Perform the exact action shown in instruction

### Issue: "GPS validation failed"
**Solution**: Enable GPS and ensure you're within 100m of school

### Issue: "Face mismatch"
**Solution**: Ensure Face ID is properly set up with your face

### Issue: "Timeout"
**Solution**: Perform action within 10 seconds

### Issue: "Max retries exceeded"
**Solution**: Wait a moment and try check-in again

---

## Performance Expectations

- Frame capture: ~1 second per frame
- Action detection: ~1-2 seconds per frame
- Anti-fraud checks: ~3-5 seconds total
- Total check-in time: ~10-15 seconds (if successful on first try)

---

## Success Indicators

✅ All checks pass
✅ Attendance recorded
✅ Dashboard refreshes
✅ Teacher notification sent
✅ No errors in console
✅ No errors in backend logs

---

## Testing Checklist

- [ ] Test neutral action
- [ ] Test blink action
- [ ] Test mouth_open action
- [ ] Test head_movement action
- [ ] Test wrong action (should fail)
- [ ] Test no face (should fail)
- [ ] Test GPS out of range (should fail)
- [ ] Test face mismatch (should fail)
- [ ] Test retry mechanism
- [ ] Test timeout
- [ ] Test max retries exceeded
- [ ] Test dashboard refresh
- [ ] Test teacher notification
- [ ] Test all error messages in Vietnamese
- [ ] Test success message in Vietnamese

---

## Notes

- All messages should be in Vietnamese
- Real-time feedback should be displayed
- Countdown timer should work correctly
- Retry counter should increment
- Dashboard should refresh after successful check-in
- Teacher should receive notification
- No errors in console or backend logs
