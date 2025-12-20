#!/usr/bin/env python3
"""
Test script để detect hướng khuôn mặt và chỉ capture khi đúng hướng
"""

import cv2
import numpy as np
import time
import sys
sys.path.append('backend')

# Import face detection từ backend
try:
    from backend.main import get_face_embedding
    print("✅ Imported face processing from backend")
except ImportError:
    print("❌ Could not import from backend")

def detect_face_pose(face_img):
    """
    Detect hướng khuôn mặt dựa trên face position và shape analysis
    """
    # Load face detector
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

    # Convert to grayscale
    gray = cv2.cvtColor(face_img, cv2.COLOR_BGR2GRAY)

    # Detect faces
    faces = face_cascade.detectMultiScale(gray, 1.1, 4, minSize=(50, 50))

    if len(faces) == 0:
        return "no_face"

    # Lấy face đầu tiên (largest)
    faces = sorted(faces, key=lambda x: x[2] * x[3], reverse=True)
    x, y, w, h = faces[0]

    # Tính tỷ lệ khung hình
    height, width = face_img.shape[:2]

    # Tính center của khuôn mặt
    face_center_x = x + w/2
    face_center_y = y + h/2

    # Tính center của camera frame
    frame_center_x = width / 2
    frame_center_y = height / 2

    # Tính offset từ center (normalized)
    offset_x = (face_center_x - frame_center_x) / (width / 2)  # -1 to 1
    offset_y = (face_center_y - frame_center_y) / (height / 2)  # -1 to 1

    # Tính aspect ratio để detect tilted faces
    aspect_ratio = w / h

    # Logic detect hướng dựa trên position và shape
    # Thresholds có thể điều chỉnh
    HORIZONTAL_THRESHOLD = 0.25  # 25% from center
    VERTICAL_THRESHOLD = 0.20    # 20% from center
    ASPECT_RATIO_THRESHOLD = 0.15  # For tilted faces

    # Check if face is centered (front)
    if abs(offset_x) < HORIZONTAL_THRESHOLD and abs(offset_y) < VERTICAL_THRESHOLD:
        # Check aspect ratio for tilted front faces
        if 0.85 < aspect_ratio < 1.15:  # Near square = front
            return "front"
        else:
            return "tilted_front"

    # Detect horizontal directions
    elif offset_x < -HORIZONTAL_THRESHOLD:
        return "left"
    elif offset_x > HORIZONTAL_THRESHOLD:
        return "right"

    # Detect vertical directions
    elif offset_y < -VERTICAL_THRESHOLD:
        return "up"
    elif offset_y > VERTICAL_THRESHOLD:
        return "down"

    # Unknown position
    else:
        return "unknown"

def draw_pose_guide(frame, expected_pose, current_pose):
    """
    Vẽ hướng dẫn visual và bounding box cho user
    """
    height, width = frame.shape[:2]
    center_x, center_y = width // 2, height // 2

    # Detect và vẽ face bounding box
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, 1.1, 4, minSize=(50, 50))

    if len(faces) > 0:
        # Vẽ bounding box cho face đầu tiên
        x, y, w, h = faces[0]
        if current_pose == expected_pose:
            box_color = (0, 255, 0)  # Green for correct
        elif current_pose == "no_face":
            box_color = (0, 0, 255)  # Red for no face
        else:
            box_color = (0, 165, 255)  # Orange for wrong pose

        cv2.rectangle(frame, (x, y), (x+w, y+h), box_color, 3)

        # Vẽ center point của face
        face_center_x = x + w//2
        face_center_y = y + h//2
        cv2.circle(frame, (face_center_x, face_center_y), 5, box_color, -1)

        # Vẽ line từ frame center đến face center
        cv2.line(frame, (center_x, center_y), (face_center_x, face_center_y), box_color, 2)

    # Vẽ target position indicator
    target_size = 120

    if expected_pose == "front":
        cv2.circle(frame, (center_x, center_y), target_size // 2, (0, 255, 0), 3)
        cv2.putText(frame, "TARGET", (center_x - 35, center_y), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

    elif expected_pose == "left":
        target_x = center_x - target_size
        cv2.circle(frame, (target_x, center_y), target_size // 2, (0, 255, 0), 3)
        cv2.putText(frame, "LEFT", (target_x - 25, center_y), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

    elif expected_pose == "right":
        target_x = center_x + target_size
        cv2.circle(frame, (target_x, center_y), target_size // 2, (0, 255, 0), 3)
        cv2.putText(frame, "RIGHT", (target_x - 30, center_y), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

    elif expected_pose == "up":
        target_y = center_y - target_size
        cv2.circle(frame, (center_x, target_y), target_size // 2, (0, 255, 0), 3)
        cv2.putText(frame, "UP", (center_x - 15, target_y), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

    elif expected_pose == "down":
        target_y = center_y + target_size
        cv2.circle(frame, (center_x, target_y), target_size // 2, (0, 255, 0), 3)
        cv2.putText(frame, "DOWN", (center_x - 20, target_y), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

def capture_with_pose_check(expected_pose="front", capture_delay=1.0):
    """
    Capture ảnh và chỉ chấp nhận khi đúng hướng với visual guide
    """
    print(f"🎯 Đang chờ hướng: {expected_pose}")
    print("📷 Mở camera... (Nhấn 'q' để thoát)")
    print(f"⏱️  Sẽ tự động chụp sau {capture_delay}s khi đúng hướng")

    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print("❌ Không thể mở camera")
        return None

    correct_pose_start_time = None
    captured = False

    while not captured:
        ret, frame = cap.read()
        if not ret:
            print("❌ Không thể đọc frame")
            break

        # Detect pose
        current_pose = detect_face_pose(frame)

        # Draw visual guide
        draw_pose_guide(frame, expected_pose, current_pose)

        # Logic capture
        if current_pose == expected_pose:
            if correct_pose_start_time is None:
                correct_pose_start_time = time.time()
                print(f"✅ Đúng hướng! Sẽ chụp sau {capture_delay}s...")

            elapsed = time.time() - correct_pose_start_time

            # Countdown display
            remaining = max(0, capture_delay - elapsed)
            countdown_text = f"⏱️ {remaining:.1f}s"

            if remaining > 0:
                color = (0, 255, 0)  # Green
                status_text = f"✅ ĐÚNG: {current_pose.upper()} - {countdown_text}"
            else:
                color = (0, 255, 255)  # Yellow
                status_text = f"📸 ĐANG CHỤP: {current_pose.upper()}"
                print(f"📸 Auto-capturing: {current_pose}")
                captured = True
                captured_frame = frame.copy()

        elif current_pose == "no_face":
            color = (0, 0, 255)  # Red
            status_text = "❌ KHÔNG TÌM THẤY KHUÔN MẶT"
            correct_pose_start_time = None  # Reset timer

        elif current_pose == "tilted_front":
            color = (0, 165, 255)  # Orange
            status_text = f"⚠️  Xoay mặt thẳng: {expected_pose.upper()}"
            correct_pose_start_time = None

        else:
            color = (0, 165, 255)  # Orange
            status_text = f"⏳ SAI HƯỚNG: {current_pose.upper()} → CẦN: {expected_pose.upper()}"
            correct_pose_start_time = None

        # Vẽ status text
        cv2.putText(frame, status_text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

        # Vẽ additional info
        info_text = f"Expected: {expected_pose.upper()} | Current: {current_pose.upper()}"
        cv2.putText(frame, info_text, (10, height - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

        # Hiển thị frame
        cv2.imshow('Face Pose Detection', frame)

        # Exit on 'q' press
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

    if captured:
        return captured_frame
    return None

def test_pose_detection():
    """
    Test function để demo pose detection
    """
    print("🧪 Testing Face Pose Detection")
    print("=" * 50)

    # Test từng hướng
    poses_to_test = ["front", "left", "right", "up", "down"]

    for pose in poses_to_test:
        print(f"\n🎯 Testing pose: {pose}")
        print("Hướng dẫn: Quay mặt theo hướng yêu cầu")

        frame = capture_with_pose_check(pose)

        if frame is not None:
            print(f"✅ Successfully captured for pose: {pose}")

            # Lưu ảnh để debug
            filename = f"captured_{pose}_{int(time.time())}.jpg"
            cv2.imwrite(filename, frame)
            print(f"💾 Saved: {filename}")

            # Test với face embedding (nếu có backend)
            try:
                embedding = get_face_embedding(frame)
                if embedding is not None:
                    print(f"🧠 Face embedding created: {len(embedding)} dimensions")
                else:
                    print("❌ Face embedding failed")
            except:
                print("⚠️  Face embedding test skipped (backend not available)")

        else:
            print(f"❌ Failed to capture for pose: {pose}")
            break

        # Chờ trước khi test pose tiếp theo
        print("⏳ Preparing next pose... (3 seconds)")
        time.sleep(3)

    print("\n🎉 Pose detection test completed!")

def interactive_test():
    """
    Test tương tác - user chọn hướng để test
    """
    print("🎮 Interactive Face Pose Detection Test")
    print("=" * 50)

    while True:
        print("\nChọn hướng để test:")
        print("1. Front (trước)")
        print("2. Left (trái)")
        print("3. Right (phải)")
        print("4. Up (lên)")
        print("5. Down (xuống)")
        print("0. Exit")

        try:
            choice = input("Nhập lựa chọn (0-5): ").strip()

            if choice == "0":
                break
            elif choice == "1":
                pose = "front"
            elif choice == "2":
                pose = "left"
            elif choice == "3":
                pose = "right"
            elif choice == "4":
                pose = "up"
            elif choice == "5":
                pose = "down"
            else:
                print("❌ Lựa chọn không hợp lệ")
                continue

            frame = capture_with_pose_check(pose)
            if frame is not None:
                print(f"✅ Success: {pose}")
            else:
                print(f"❌ Failed: {pose}")

        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"❌ Error: {e}")

def calibrate_thresholds():
    """
    Function để calibrate pose detection thresholds
    """
    print("🔧 Calibrating Pose Detection Thresholds")
    print("Hướng dẫn: Quay mặt theo từng hướng và quan sát detection")

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("❌ Không thể mở camera")
        return

    print("Nhấn các phím để test từng hướng:")
    print("F: Front | L: Left | R: Right | U: Up | D: Down")
    print("Q: Quit")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        current_pose = detect_face_pose(frame)

        # Display pose info
        height, width = frame.shape[:2]

        # Draw pose guide for current pose
        draw_pose_guide(frame, current_pose, current_pose)

        # Display detection info
        info_lines = [
            f"Detected: {current_pose.upper()}",
            f"Resolution: {width}x{height}",
            "Controls: F/L/R/U/D/Q"
        ]

        for i, line in enumerate(info_lines):
            cv2.putText(frame, line, (10, 30 + i*25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        cv2.imshow('Pose Calibration', frame)

        key = cv2.waitKey(1) & 0xFF

        if key == ord('q'):
            break
        elif key == ord('f'):
            print(f"Front pose detected as: {current_pose}")
        elif key == ord('l'):
            print(f"Left pose detected as: {current_pose}")
        elif key == ord('r'):
            print(f"Right pose detected as: {current_pose}")
        elif key == ord('u'):
            print(f"Up pose detected as: {current_pose}")
        elif key == ord('d'):
            print(f"Down pose detected as: {current_pose}")

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    print("🤖 Face Pose Detection Test")
    print("=" * 50)

    if len(sys.argv) > 1:
        if sys.argv[1] == "--interactive":
            interactive_test()
        elif sys.argv[1] == "--calibrate":
            calibrate_thresholds()
        else:
            print("Usage:")
            print("  python test_face_pose.py              # Auto test all poses")
            print("  python test_face_pose.py --interactive # Interactive test")
            print("  python test_face_pose.py --calibrate   # Calibrate thresholds")
    else:
        print("Chế độ tự động test tất cả poses...")
        print("Nhấn Ctrl+C để dừng")
        try:
            test_pose_detection()
        except KeyboardInterrupt:
            print("\n⏹️  Test stopped by user")
