# Liveness-Guided Face Capture Flow

## Introduction

Hệ thống cần xác minh người dùng là người sống (liveness detection) trước khi cho phép chụp ảnh chính thức cho Face ID setup. Nếu phát hiện hoạt động khuôn mặt (blink, smile, head movement), hệ thống sẽ hướng dẫn người dùng nhìn thẳng vào camera để chụp ảnh. Điều này tránh gian lận bằng ảnh tĩnh hoặc video.

## Glossary

- **Liveness**: Xác minh rằng người dùng là người sống (không phải ảnh/video)
- **Blink**: Chuyển động nhắm mắt
- **Smile**: Chuyển động miệng (cười)
- **Head Movement**: Chuyển động đầu (quay, cúi, ngửa)
- **Liveness Score**: Điểm số chỉ mức độ chắc chắn rằng đó là người sống (0-1)
- **Guidance Frame**: Ảnh chụp để kiểm tra liveness (không dùng cho Face ID)
- **Capture Frame**: Ảnh chụp chính thức để dùng cho Face ID setup (sau khi xác minh liveness)
- **Frontal Face**: Khuôn mặt nhìn thẳng vào camera

## Requirements

### Requirement 1: Real-time Liveness Detection

**User Story:** Là một hệ thống, tôi muốn phát hiện hoạt động khuôn mặt trong thời gian thực, để xác minh người dùng là người sống.

#### Acceptance Criteria

1. WHEN camera captures a frame, THE Backend SHALL analyze for liveness indicators (blink, smile, head movement)
2. WHEN liveness indicators are detected, THE Backend SHALL calculate a liveness score (0-1)
3. WHEN liveness score exceeds threshold (0.6), THE Backend SHALL mark as "liveness_detected"
4. WHEN liveness score is below threshold, THE Backend SHALL mark as "no_liveness"
5. WHEN no face is detected, THE Backend SHALL return error indicating no face found

### Requirement 2: Liveness Indicators

**User Story:** Là một hệ thống, tôi muốn phát hiện các chỉ báo cụ thể của hoạt động khuôn mặt.

#### Acceptance Criteria

1. WHEN analyzing frame, THE Backend SHALL detect eye blinks
2. WHEN analyzing frame, THE Backend SHALL detect mouth movements (smile/open)
3. WHEN analyzing frame, THE Backend SHALL detect head movements (yaw, pitch, roll changes)
4. WHEN analyzing frame, THE Backend SHALL track these indicators across multiple frames
5. WHEN any indicator is detected, THE Backend SHALL increment liveness confidence

### Requirement 3: Guidance Messages for Liveness

**User Story:** Là một giao diện người dùng, tôi muốn hiển thị hướng dẫn để người dùng biết cần làm gì để xác minh liveness.

#### Acceptance Criteria

1. WHEN no face is detected, THE Frontend SHALL display "Không tìm thấy khuôn mặt. Vui lòng nhìn vào camera."
2. WHEN liveness is not detected, THE Frontend SHALL display "Vui lòng nhắm mắt hoặc cười để xác minh bạn là người sống"
3. WHEN liveness is detected, THE Frontend SHALL display "Tuyệt vời! Bây giờ vui lòng nhìn thẳng vào camera để chụp ảnh"
4. WHEN user is ready to capture, THE Frontend SHALL display "Sẵn sàng. Nhìn thẳng vào camera và chụp ảnh"

### Requirement 4: Capture Flow After Liveness Verification

**User Story:** Là một người dùng, tôi muốn chỉ có thể chụp ảnh chính thức sau khi hệ thống xác minh tôi là người sống.

#### Acceptance Criteria

1. WHEN liveness is not detected, THE Frontend SHALL disable the capture button
2. WHEN liveness is detected, THE Frontend SHALL enable the capture button
3. WHEN user clicks capture button, THE Frontend SHALL send frame to backend for Face ID processing
4. WHEN frame is captured, THE Frontend SHALL verify face is frontal (yaw, pitch, roll within tolerance)
5. WHEN frame is valid, THE Frontend SHALL show confirmation and proceed to next step

### Requirement 5: Visual Feedback During Liveness Detection

**User Story:** Là một giao diện người dùng, tôi muốn cung cấp phản hồi trực quan về trạng thái liveness.

#### Acceptance Criteria

1. WHEN no face is detected, THE Frontend SHALL display gray indicator/border
2. WHEN face is detected but liveness not verified, THE Frontend SHALL display red indicator/border
3. WHEN liveness is verified, THE Frontend SHALL display green indicator/border
4. WHEN displaying liveness status, THE Frontend SHALL show liveness score for debugging
5. WHEN displaying liveness status, THE Frontend SHALL show detected indicators (blink, smile, head movement)

### Requirement 6: Backend Liveness Detection Endpoint

**User Story:** Là một backend, tôi muốn cung cấp endpoint để phát hiện liveness từ frame video.

#### Acceptance Criteria

1. WHEN POST request is sent to `/detect_liveness`, THE Backend SHALL accept base64-encoded frame
2. WHEN frame is processed, THE Backend SHALL return liveness score (0-1)
3. WHEN frame is processed, THE Backend SHALL return detected indicators (blink, smile, head_movement)
4. WHEN frame is processed, THE Backend SHALL return guidance message in Vietnamese
5. WHEN error occurs, THE Backend SHALL return error message with reason

### Requirement 7: Liveness Threshold Configuration

**User Story:** Là một hệ thống, tôi muốn có thể cấu hình ngưỡng liveness để điều chỉnh độ khó.

#### Acceptance Criteria

1. THE System SHALL use configurable liveness threshold (default 0.6)
2. WHEN threshold is configured, THE Backend SHALL use this value for validation
3. WHEN threshold is changed, THE System SHALL apply new value immediately
4. THE System SHALL log threshold value for debugging

### Requirement 8: Frontal Face Validation After Liveness

**User Story:** Là một hệ thống, tôi muốn đảm bảo ảnh chụp chính thức có khuôn mặt nhìn thẳng.

#### Acceptance Criteria

1. WHEN liveness is verified and user clicks capture, THE Backend SHALL check if face is frontal
2. WHEN checking frontal face, THE Backend SHALL verify yaw is within ±15 degrees
3. WHEN checking frontal face, THE Backend SHALL verify pitch is within ±15 degrees
4. WHEN checking frontal face, THE Backend SHALL verify roll is within ±10 degrees
5. WHEN face is not frontal, THE Backend SHALL return error asking user to look straight

### Requirement 9: Anti-Fraud Measures

**User Story:** Là một hệ thống, tôi muốn ngăn chặn gian lận bằng ảnh tĩnh hoặc video.

#### Acceptance Criteria

1. WHEN liveness is not detected, THE System SHALL reject the capture attempt
2. WHEN same face appears in multiple frames without movement, THE System SHALL flag as suspicious
3. WHEN liveness indicators are detected, THE System SHALL log them for audit trail
4. WHEN capture is successful, THE System SHALL record that liveness was verified
