# pose_detect.py - Face Pose Detection Module
import cv2
import numpy as np
import logging
import os
from typing import Optional, Tuple

logger = logging.getLogger(__name__)
_landmark_detector = None

# ===== FACIAL LANDMARK DETECTION =====
LANDMARK_MODEL_PATH = "models/lbfmodel.yaml"

# 3D face model (approximate coordinates for key facial points)
# Based on standard face model
FACE_3D_MODEL = np.array([
    [0.0, 0.0, 0.0],          # Nose tip
    [-30.0, -125.0, -30.0],   # Left eye left corner
    [30.0, -125.0, -30.0],    # Right eye right corner
    [-60.0, 50.0, -30.0],     # Left mouth corner
    [60.0, 50.0, -30.0],      # Right mouth corner
    [0.0, 100.0, -30.0],      # Chin
], dtype=np.float32)

# Camera matrix (approximate for mobile camera)
CAMERA_MATRIX = np.array([
    [600.0, 0.0, 320.0],    # fx, 0, cx
    [0.0, 600.0, 240.0],    # 0, fy, cy
    [0.0, 0.0, 1.0]         # 0, 0, 1
], dtype=np.float32)

DIST_COEFFS = np.zeros((4, 1))  # No lens distortion

# ===== POSE DETECTION CONSTANTS =====
HORIZONTAL_THRESHOLD = 0.35  # 35% from center for horizontal detection (more tolerant)
VERTICAL_THRESHOLD = 0.30    # 30% from center for vertical detection (more tolerant)
ASPECT_RATIO_THRESHOLD = 0.15  # For tilted faces
MIN_FACE_SIZE = (30, 30)     # Minimum face size for detection (reduced for mobile)
MIN_FACE_SIZE_STRICT = (50, 50)  # Stricter size for pose analysis

# ===== FACIAL LANDMARK DETECTION =====
LANDMARK_MODEL_PATH = "models/lbfmodel.yaml"

def _ensure_landmark_detector():
    global _landmark_detector

    if _landmark_detector is not None:
        return _landmark_detector

    if not os.path.exists(LANDMARK_MODEL_PATH):
        logger.warning(f"Landmark model not found at {LANDMARK_MODEL_PATH}")
        return None

    try:
        detector = cv2.face.createFacemarkLBF()
        detector.loadModel(LANDMARK_MODEL_PATH)
        _landmark_detector = detector
        logger.info("Facial landmark detector loaded ONCE")
        return _landmark_detector
    except Exception as e:
        logger.warning(f"Could not load landmark detector: {e}")
        return None


def detect_facial_landmarks(image: np.ndarray, face_rect: tuple) -> Optional[np.ndarray]:
    """
    Detect facial landmarks for pose estimation
    Returns 68 facial landmarks if successful
    """
    landmark_detector = _ensure_landmark_detector()
    if landmark_detector is None:
        return None

    try:
        # Convert face rect to format expected by facemark
        faces = [face_rect]  # (x, y, w, h)

        # Detect landmarks
        ok, landmarks = landmark_detector.fit(image, faces)

        if ok and len(landmarks) > 0:
            # landmarks[0] contains the 68 points for first face
            landmark_points = landmarks[0][0]  # Shape: (68, 2)
            logger.debug(f"Detected {len(landmark_points)} facial landmarks")
            return landmark_points

    except Exception as e:
        logger.debug(f"Landmark detection failed: {e}")

    return None

def estimate_face_pose_simple(image: np.ndarray, face_rect: tuple) -> Optional[dict]:
    """
    Simple face pose estimation using eye detection and basic geometry
    This is a simplified version that doesn't require facial landmarks
    """
    try:
        x, y, w, h = face_rect

        # Extract face region
        face_roi = image[y:y+h, x:x+w]
        if face_roi.size == 0:
            return None

        # Convert to grayscale
        gray_face = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)

        # Detect eyes using Haar cascades
        eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')
        eyes = eye_cascade.detectMultiScale(gray_face, 1.1, 3, minSize=(20, 20))

        if len(eyes) < 2:
            logger.debug("Could not detect both eyes for pose estimation")
            return None

        # Sort eyes by x position (left to right)
        eyes = sorted(eyes, key=lambda e: e[0])

        # Take the two most prominent eyes
        if len(eyes) >= 2:
            left_eye = eyes[0]
            right_eye = eyes[1]

            # Calculate eye centers in face coordinates
            left_eye_center = (left_eye[0] + left_eye[2]//2, left_eye[1] + left_eye[3]//2)
            right_eye_center = (right_eye[0] + right_eye[2]//2, right_eye[1] + right_eye[3]//2)

            # Convert to image coordinates
            left_eye_center_img = (x + left_eye_center[0], y + left_eye_center[1])
            right_eye_center_img = (x + right_eye_center[0], y + right_eye_center[1])

            # Calculate basic pose angles from eye positions
            # This is a simplified approach
            eye_distance = np.sqrt((right_eye_center_img[0] - left_eye_center_img[0])**2 +
                                 (right_eye_center_img[1] - left_eye_center_img[1])**2)

            # Calculate horizontal offset (yaw indication)
            face_center_x = x + w/2
            eyes_center_x = (left_eye_center_img[0] + right_eye_center_img[0]) / 2
            horizontal_offset = (eyes_center_x - face_center_x) / (w / 2)

            # Calculate vertical offset (pitch indication)
            face_center_y = y + h/2
            eyes_center_y = (left_eye_center_img[1] + right_eye_center_img[1]) / 2
            vertical_offset = (eyes_center_y - face_center_y) / (h / 2)

            # Estimate angles (sensitive to small movements)
            yaw_estimate = np.degrees(np.arcsin(horizontal_offset * 0.8))  # Max ~50 degrees, sensitive
            pitch_estimate = np.degrees(np.arcsin(vertical_offset * 0.6))  # Max ~35 degrees, sensitive

            # Fix camera orientation for eye-based method too
            yaw_estimate = -yaw_estimate

            logger.debug(".3f")

            return {
                'yaw': yaw_estimate,
                'pitch': pitch_estimate,
                'roll': 0.0,  # Cannot estimate roll from eyes alone
                'eye_distance': eye_distance,
                'method': 'eye_based'
            }

    except Exception as e:
        logger.debug(f"Simple pose estimation failed: {e}")

    return None

def estimate_face_pose_pnp(image: np.ndarray, face_rect: tuple) -> Optional[dict]:
    """
    Estimate face pose using PnP algorithm with facial landmarks
    Falls back to simple eye-based method if landmarks unavailable
    """
    # Try landmark-based PnP first
    landmarks_2d = detect_facial_landmarks(image, face_rect)
    if landmarks_2d is not None:
        try:
            # Select key landmarks for PnP (nose tip, eye corners, mouth corners, chin)
            # Using standard landmark indices
            key_indices = [30, 36, 45, 48, 54, 8]  # Nose, eyes, mouth, chin

            if len(landmarks_2d) >= max(key_indices) + 1:
                # Extract 2D points
                points_2d = landmarks_2d[key_indices].astype(np.float32)

                # Solve PnP
                success, rotation_vector, translation_vector = cv2.solvePnP(
                    FACE_3D_MODEL, points_2d, CAMERA_MATRIX, DIST_COEFFS,
                    flags=cv2.SOLVEPNP_ITERATIVE
                )

                if success:
                    # Convert rotation vector to Euler angles
                    rotation_matrix, _ = cv2.Rodrigues(rotation_vector)

                    # Extract Euler angles (pitch, yaw, roll)
                    pitch = np.arctan2(rotation_matrix[2, 1], rotation_matrix[2, 2])
                    yaw = np.arctan2(-rotation_matrix[2, 0],
                                    np.sqrt(rotation_matrix[2, 1]**2 + rotation_matrix[2, 2]**2))
                    roll = np.arctan2(rotation_matrix[1, 0], rotation_matrix[0, 0])

            # Convert to degrees
            pitch_deg = np.degrees(pitch)
            yaw_deg = np.degrees(yaw)
            roll_deg = np.degrees(roll)

            # Fix camera orientation - flip yaw for correct left/right detection
            yaw_deg = -yaw_deg

            logger.debug(".1f")

            return {
                        'rotation_vector': rotation_vector,
                        'translation_vector': translation_vector,
                        'pitch': pitch_deg,
                        'yaw': yaw_deg,
                        'roll': roll_deg,
                        'rotation_matrix': rotation_matrix,
                        'method': 'landmark_pnp'
                    }

        except Exception as e:
            logger.debug(f"Landmark PnP failed: {e}")

    # Fallback to simple eye-based pose estimation
    logger.debug("Using eye-based pose estimation fallback")
    return estimate_face_pose_simple(image, face_rect)

def classify_pose_from_angles(
    pitch: float,
    yaw: float,
    roll: float = 0.0,
    expected_pose: Optional[str] = None,
    mode: str = "liveness"
) -> str:

    # ===== 1️⃣ APPLE-STYLE THRESHOLDS - NATURAL MOVEMENT =====
    # Wide acceptance ranges like Apple Face ID - natural head movement

    # Define ranges based on mode
    if mode == "setup":
        # Generous ranges for natural circular motion
        LEFT_RANGE = (-80, -5)      # Wide left acceptance
        RIGHT_RANGE = (5, 80)       # Wide right acceptance
        UP_RANGE = (-70, -10)       # Wide up acceptance
        DOWN_RANGE = (10, 70)       # Wide down acceptance
        FRONT_TOLERANCE = 25        # Front accepts ±25° from center
        ROLL_THRESHOLD = 25         # Allow more head tilt
    else:  # liveness mode - still generous but more defined
        LEFT_RANGE = (-70, -15)
        RIGHT_RANGE = (15, 70)
        UP_RANGE = (-60, -20)
        DOWN_RANGE = (20, 60)
        FRONT_TOLERANCE = 20

    # Normalize expected_pose
    expected = expected_pose.lower() if expected_pose else ""

    # ===== 2️⃣ APPLE-STYLE NATURAL POSE DETECTION =====
    # Expected-pose aware with generous ranges for natural movement

    if "left" in expected:
        if LEFT_RANGE[0] <= yaw <= LEFT_RANGE[1]:
            return "left"
        # If not in left range, could be front (within tolerance)
        if abs(yaw) <= FRONT_TOLERANCE and abs(pitch) <= FRONT_TOLERANCE:
            return "front"
        return "left"  # Default to left if expected

    if "right" in expected:
        if RIGHT_RANGE[0] <= yaw <= RIGHT_RANGE[1]:
            return "right"
        # If not in right range, could be front (within tolerance)
        if abs(yaw) <= FRONT_TOLERANCE and abs(pitch) <= FRONT_TOLERANCE:
            return "front"
        return "right"  # Default to right if expected

    if "up" in expected:
        if UP_RANGE[0] <= pitch <= UP_RANGE[1]:
            return "up"
        # If not in up range, could be front (within tolerance)
        if abs(yaw) <= FRONT_TOLERANCE and abs(pitch) <= FRONT_TOLERANCE:
            return "front"
        return "up"  # Default to up if expected

    if "down" in expected:
        if DOWN_RANGE[0] <= pitch <= DOWN_RANGE[1]:
            return "down"
        # If not in down range, could be front (within tolerance)
        if abs(yaw) <= FRONT_TOLERANCE and abs(pitch) <= FRONT_TOLERANCE:
            return "front"
        return "down"  # Default to down if expected

    # ===== 3️⃣ NATURAL CLASSIFICATION - APPLE STYLE =====
    # Best-fit classification for natural head movement

    # Calculate confidence scores for each pose
    scores = {
        "front": 0,
        "left": 0,
        "right": 0,
        "up": 0,
        "down": 0
    }

    # Front scoring - prefer when both yaw and pitch are small
    if abs(yaw) <= FRONT_TOLERANCE and abs(pitch) <= FRONT_TOLERANCE:
        scores["front"] = 100 - (abs(yaw) + abs(pitch))  # Higher score for more centered

    # Left scoring - based on yaw in left range
    if LEFT_RANGE[0] <= yaw <= LEFT_RANGE[1]:
        scores["left"] = 80 + (abs(yaw) - abs(LEFT_RANGE[0])) * 0.5  # Closer to center = higher score

    # Right scoring - based on yaw in right range
    if RIGHT_RANGE[0] <= yaw <= RIGHT_RANGE[1]:
        scores["right"] = 80 + (abs(yaw) - abs(RIGHT_RANGE[0])) * 0.5

    # Up scoring - based on pitch in up range
    if UP_RANGE[0] <= pitch <= UP_RANGE[1]:
        scores["up"] = 80 + (abs(pitch) - abs(UP_RANGE[0])) * 0.5

    # Down scoring - based on pitch in down range
    if DOWN_RANGE[0] <= pitch <= DOWN_RANGE[1]:
        scores["down"] = 80 + (abs(pitch) - abs(DOWN_RANGE[0])) * 0.5

    # Handle roll (head tilt) - reduce front score if tilted too much
    if abs(roll) > ROLL_THRESHOLD:
        scores["front"] *= 0.7  # Reduce front confidence if head is tilted

    # Return pose with highest score
    best_pose = max(scores, key=scores.get)
    best_score = scores[best_pose]

    # Only return directional pose if confidence is reasonable
    if best_score >= 60:  # Minimum confidence threshold
        return best_pose

    return "front"  # Default to front if no pose has good confidence


def detect_face_pose(
    image: np.ndarray,
    expected_pose: Optional[str] = None,
    mode: str = "setup"
) -> str:

    """
    Detect hướng khuôn mặt using PnP algorithm with facial landmarks

    Args:
        image: RGB/BGR image array

    Returns:
        str: Pose type - "front", "left", "right", "up", "down", "tilted_front", "no_face", "unknown"
    """
    if image is None or image.size == 0:
        return "no_face"

    try:
        # Log image info for debugging
        height, width = image.shape[:2]
        logger.debug(f"Processing image: {width}x{height}")

        # Load face detector
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # Try multiple detection parameters and cascades for robustness
        faces = None

        # Try different Haar cascades for better mobile detection
        cascade_files = [
            'haarcascade_frontalface_default.xml',
            'haarcascade_frontalface_alt.xml',
            'haarcascade_frontalface_alt2.xml',
            'haarcascade_profileface.xml'  # For side faces
        ]

        for cascade_file in cascade_files:
            cascade_path = cv2.data.haarcascades + cascade_file
            if os.path.exists(cascade_path):
                temp_cascade = cv2.CascadeClassifier(cascade_path)

                # Try multiple scales and parameters
                scales_and_params = [
                    (1.1, 3, MIN_FACE_SIZE),      # Standard
                    (1.2, 2, (20, 20)),           # More liberal
                    (1.05, 4, MIN_FACE_SIZE),     # Conservative
                ]

                for scale, min_neighbors, min_size in scales_and_params:
                    temp_faces = temp_cascade.detectMultiScale(gray, scale, min_neighbors, minSize=min_size)
                    if temp_faces is not None and len(temp_faces) > 0:
                        if faces is None or len(temp_faces) > len(faces):
                            faces = temp_faces
                            logger.debug(f"Found {len(faces)} faces with {cascade_file} (scale={scale}, min_neighbors={min_neighbors})")
                        break

                if faces is not None and len(faces) > 0:
                    break

        # If still no faces, try with image preprocessing
        if faces is None or len(faces) == 0:
            # Apply histogram equalization to improve contrast
            gray_eq = cv2.equalizeHist(gray)
            faces = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml').detectMultiScale(
                gray_eq, 1.1, 2, minSize=(20, 20))
            logger.debug(f"Enhanced detection found {len(faces) if faces is not None else 0} faces")

        if faces is None or len(faces) == 0:
            # Try DNN face detection as fallback
            try:
                from backend.face_detect import detect_face
                face_img = detect_face(image)
                if face_img is not None:
                    logger.debug("DNN face detection succeeded as fallback")
                    # For DNN fallback, assume front pose since we can't determine pose from single detection
                    return "front"
            except ImportError:
                logger.debug("DNN face detection not available")
            except Exception as e:
                logger.debug(f"DNN face detection failed: {e}")

            logger.debug("No faces detected with any method")
            return "no_face"

        # Lấy face đầu tiên (largest)
        faces = sorted(faces, key=lambda x: x[2] * x[3], reverse=True)
        x, y, w, h = faces[0]
        face_rect = (x, y, w, h)

        logger.debug(f"Selected face: x={x}, y={y}, w={w}, h={h}")

        # Try PnP-based pose estimation first
        pose_result = estimate_face_pose_pnp(image, face_rect)
        if pose_result is not None:
            pose = classify_pose_from_angles(
                pose_result["pitch"],
                pose_result["yaw"],
                pose_result["roll"],
                expected_pose=expected_pose,
                mode=mode
            )


            logger.debug(f"PnP pose detection: {pose}")
            return pose

        # Fallback to zone-based detection if PnP fails
        logger.debug("PnP failed, using zone-based fallback")

        # Tính tỷ lệ khung hình
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

        # Debug logging
        logger.debug(f"Zone-based: center=({face_center_x:.1f}, {face_center_y:.1f}), offsets: x={offset_x:.3f}, y={offset_y:.3f}")

        # Zone-based pose detection - more tolerant for setup
        center_zone_x = 0.3  # ±30% from center horizontally (tolerant for setup)
        center_zone_y = 0.3  # ±30% from center vertically (tolerant for setup)
            # ===== EXPECTED-POSE AWARE DIRECTION THRESHOLD =====
        if mode == "setup" and expected_pose in ["left", "right"]:
            directional_threshold = 0.12   # 👈 nhạy hơn cho setup FaceID
        else:
            directional_threshold = 0.4    # 👈 bình thường

        
        # More tolerant zone detection for setup
        # Only consider "front" if face is within tolerance zone
        if abs(offset_x) < center_zone_x and abs(offset_y) < center_zone_y:
            if 0.8 < aspect_ratio < 1.2:  # Tolerant aspect ratio for front
                logger.debug(".3f")
                return "front"
            else:
                logger.debug("Zone-based: tilted_front")
                return "tilted_front"

        # For setup, be more forgiving with directional classification
        # Require significant movement to classify as directional
        if abs(offset_x) > directional_threshold:  # Need >40% movement
            if offset_x < 0:
                logger.debug(".3f")
                return "left"
            else:
                logger.debug(".3f")
                return "right"
        elif abs(offset_y) > directional_threshold:  # Need >40% movement
            if offset_y < 0:
                logger.debug(".3f")
                return "up"
            else:
                logger.debug(".3f")
                return "down"

        # If movement not significant enough, default to front
        logger.debug(".3f")
        return "front"

    except Exception as e:
        logger.error(f"Error in pose detection: {e}")
        return "unknown"

def validate_pose_against_expected(image: np.ndarray, expected_pose: str) -> Tuple[bool, str]:
    
    # Normalize expected_pose FIRST
    expected_lower = expected_pose.lower()
    if "front" in expected_lower:
        expected_normalized = "front"
    elif "left" in expected_lower:
        expected_normalized = "left"
    elif "right" in expected_lower:
        expected_normalized = "right"
    elif "up" in expected_lower:
        expected_normalized = "up"
    elif "down" in expected_lower:
        expected_normalized = "down"
    else:
        expected_normalized = expected_lower
    
    detected_pose = detect_face_pose(
    image,
    expected_pose=expected_normalized,
    mode="setup"
)


    # Normalize expected_pose to lowercase and extract base pose
    expected_lower = expected_pose.lower()
    if "front" in expected_lower:
        expected_normalized = "front"
    elif "left" in expected_lower:
        expected_normalized = "left"
    elif "right" in expected_lower:
        expected_normalized = "right"
    elif "up" in expected_lower:
        expected_normalized = "up"
    elif "down" in expected_lower:
        expected_normalized = "down"
    else:
        expected_normalized = expected_lower

    # Debug logging
    logger.debug(f"Pose validation: expected='{expected_pose}' -> normalized='{expected_normalized}', detected='{detected_pose}'")

    # Case-insensitive comparison
    if detected_pose == expected_normalized:
        logger.debug(f"Pose validation: ✅ MATCH")
        return True, detected_pose
    else:
        logger.debug(f"Pose validation: ❌ MISMATCH - Expected {expected_normalized}, got {detected_pose}")
        return False, detected_pose

def get_pose_requirements(expected_pose: str) -> dict:
    """
    Get requirements and instructions for a specific pose

    Args:
        expected_pose: Pose to get requirements for ("Front", "Left 45°", "Right 45°", "Up", "Down")

    Returns:
        dict: Requirements and instructions
    """
    requirements = {
        "front": {
            "instruction": "Hướng mặt về phía trước, nhìn thẳng vào camera",
            "position": "center",
            "description": "Face should be centered and looking directly at camera"
        },
        "left": {
            "instruction": "Quay mặt sang trái 45 độ",
            "position": "left",
            "description": "Turn your face to the left side"
        },
        "right": {
            "instruction": "Quay mặt sang phải 45 độ",
            "position": "right",
            "description": "Turn your face to the right side"
        },
        "up": {
            "instruction": "Ngửa mặt lên trên",
            "position": "up",
            "description": "Tilt your face upward"
        },
        "down": {
            "instruction": "Cúi mặt xuống dưới",
            "position": "down",
            "description": "Tilt your face downward"
        }
    }

    # Normalize expected_pose to match requirements keys
    expected_lower = expected_pose.lower()
    if "front" in expected_lower:
        normalized_key = "front"
    elif "left" in expected_lower:
        normalized_key = "left"
    elif "right" in expected_lower:
        normalized_key = "right"
    elif "up" in expected_lower:
        normalized_key = "up"
    elif "down" in expected_lower:
        normalized_key = "down"
    else:
        normalized_key = expected_lower

    return requirements.get(normalized_key, {
        "instruction": "Hướng dẫn không khả dụng",
        "position": "unknown",
        "description": "Unknown pose"
    })

def calibrate_pose_thresholds(test_image: np.ndarray) -> dict:
    """
    Calibrate pose detection thresholds based on a test image

    Args:
        test_image: Image to use for calibration

    Returns:
        dict: Calibration results and recommendations
    """
    try:
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        gray = cv2.cvtColor(test_image, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.1, 4, minSize=MIN_FACE_SIZE)

        if len(faces) == 0:
            return {"error": "No face detected in calibration image"}

        x, y, w, h = faces[0]
        height, width = test_image.shape[:2]

        face_center_x = x + w/2
        face_center_y = y + h/2
        frame_center_x = width / 2
        frame_center_y = height / 2

        offset_x = (face_center_x - frame_center_x) / (width / 2)
        offset_y = (face_center_y - frame_center_y) / (height / 2)
        aspect_ratio = w / h

        return {
            "face_center": (face_center_x, face_center_y),
            "frame_center": (frame_center_x, frame_center_y),
            "offset_x": offset_x,
            "offset_y": offset_y,
            "aspect_ratio": aspect_ratio,
            "face_size": (w, h),
            "recommended_thresholds": {
                "horizontal": abs(offset_x) * 1.5,
                "vertical": abs(offset_y) * 1.5
            }
        }

    except Exception as e:
        return {"error": f"Calibration failed: {e}"}


def detect_face_pose_and_angle(image: np.ndarray) -> Tuple[str, dict]:
    """
    Detect face pose and return both classification and raw angles (Face ID style)

    Args:
        image: RGB/BGR image array

    Returns:
        Tuple[str, dict]: (pose_type, angle_info)
        angle_info contains: yaw, pitch, roll, landmarks (if available)
    """
    if image is None or image.size == 0:
        return "no_face", {"yaw": 0, "pitch": 0, "roll": 0}

    try:
        # Use existing face detection logic but return angles instead of pose classification
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image

        # Try multiple face detection methods (robustness)
        faces = []
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        faces = face_cascade.detectMultiScale(gray, 1.1, 4, minSize=(30, 30))

        if len(faces) == 0:
            # Try profile face detection
            profile_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml')
            faces = profile_cascade.detectMultiScale(gray, 1.1, 4, minSize=(30, 30))

        if len(faces) == 0:
            return "no_face", {"yaw": 0, "pitch": 0, "roll": 0}

        # Take the largest face
        face = max(faces, key=lambda f: f[2] * f[3])
        x, y, w, h = face

        # Extract face region
        face_roi = image[y:y+h, x:x+w]

        # Try to get landmarks and calculate angles using PnP
        try:
            # Use landmark detection for pose estimation
            landmarks = get_facial_landmarks(face_roi)

            if landmarks is not None and len(landmarks) >= 68:
                # Calculate pose angles using solvePnP
                pose_result = estimate_pose_from_landmarks(landmarks, (w, h))

                if pose_result:
                    return "face_detected", {
                        "yaw": float(pose_result["yaw"]),
                        "pitch": float(pose_result["pitch"]),
                        "roll": float(pose_result["roll"]),
                        "landmarks": landmarks.tolist() if hasattr(landmarks, 'tolist') else landmarks
                    }
        except Exception as e:
            pass  # Fall back to basic estimation

        # Fallback: Basic angle estimation from face position in frame
        height, width = image.shape[:2]
        face_center_x = x + w/2
        face_center_y = y + h/2
        frame_center_x = width / 2
        frame_center_y = height / 2

        # Estimate angles based on face position (rough approximation)
        yaw_offset = (face_center_x - frame_center_x) / (width / 2)
        pitch_offset = (face_center_y - frame_center_y) / (height / 2)

        # Convert to approximate angles (this is not accurate but provides diversity data)
        estimated_yaw = yaw_offset * 30  # Max ~30 degrees
        estimated_pitch = pitch_offset * 20  # Max ~20 degrees

        return "face_detected", {
            "yaw": float(estimated_yaw),
            "pitch": float(estimated_pitch),
            "roll": 0.0,
            "landmarks": None
        }

    except Exception as e:
        return "no_face", {"yaw": 0, "pitch": 0, "roll": 0}
