# pose_detect.py - Face Pose Detection Module (Enhanced)
import cv2
import numpy as np
import logging
import os
import base64
import io
from typing import Optional, Tuple, Union
from face_detect import detect_face, estimate_face_pose_pnp

logger = logging.getLogger(__name__)

# ===== POSE DETECTION CONSTANTS =====
MIN_FACE_SIZE = (50, 50)     # Minimum face size for detection

# ===== FACIAL LANDMARK DETECTION =====
LANDMARK_MODEL_PATH = "models/lbfmodel.yaml"

# Global facemark instance để tránh load model nhiều lần
_facemark_instance = None

def get_facemark_instance():
    """Get or create global facemark instance (singleton pattern)"""
    global _facemark_instance
    if _facemark_instance is None:
        logger.info(f"Loading LBF landmark model from {LANDMARK_MODEL_PATH}")
        _facemark_instance = cv2.face.createFacemarkLBF()
        _facemark_instance.loadModel(LANDMARK_MODEL_PATH)
        logger.info("LBF landmark model loaded successfully")
    return _facemark_instance

# 3D face model points (approximate) tương ứng với 2D landmarks
FACE_3D_MODEL = np.array([
    [0.0, 0.0, 0.0],       # Nose tip
    [0.0, -63.6, -12.5],   # Chin
    [-43.3, 32.7, -26.0],  # Left eye left corner
    [43.3, 32.7, -26.0],   # Right eye right corner
    [-28.9, -28.9, -24.1], # Left mouth corner
    [28.9, -28.9, -24.1]   # Right mouth corner
], dtype=np.float32)

# Camera matrix giả định 640x480
# Note: Mobile cameras often have different orientations
CAMERA_MATRIX = np.array([
    [640, 0, 320],
    [0, 640, 240],
    [0, 0, 1]
], dtype=np.float32)

# Alternative camera matrix for flipped orientation
CAMERA_MATRIX_FLIPPED = np.array([
    [640, 0, 320],
    [0, -640, 240],  # Negative fy for vertical flip
    [0, 0, 1]
], dtype=np.float32)

DIST_COEFFS = np.zeros((4, 1))  # Không có distortion


def _ensure_image(image_or_b64: Union[np.ndarray, str, bytes]) -> Optional[np.ndarray]:
    """Ensure the input is an OpenCV BGR image. Accepts base64 str/bytes, file path, or ndarray.
    Handles 180° rotated camera images (common on mobile)."""
    if image_or_b64 is None:
        logger.warning("_ensure_image: input is None")
        return None
    
    # If already an ndarray, return as-is
    if isinstance(image_or_b64, np.ndarray):
        logger.debug(f"_ensure_image: already ndarray, shape={image_or_b64.shape}")
        return image_or_b64

    # If string or bytes, try to decode as base64 or load from path
    try:
        # If a string, it might be a base64 string or a filesystem path
        if isinstance(image_or_b64, str):
            logger.debug(f"_ensure_image: input is string (length={len(image_or_b64)})")
            # Try base64 first
            try:
                image_or_b64 = base64.b64decode(image_or_b64)
                logger.debug(f"✅ Successfully decoded base64 to {len(image_or_b64)} bytes")
            except Exception as b64_err:
                logger.warning(f"⚠️ Base64 decode failed: {b64_err}, trying file path...")
                # Not base64 -> try to load file path
                img_from_path = cv2.imread(image_or_b64)
                if img_from_path is not None:
                    logger.info(f"✅ Loaded image from file path: {image_or_b64.shape}")
                    return img_from_path
                logger.error(f"❌ Neither base64 nor valid file path: {image_or_b64}")
                return None

        # image_or_b64 is now bytes
        logger.debug(f"_ensure_image: decoding {len(image_or_b64)} bytes")
        nparr = np.frombuffer(image_or_b64, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            logger.error("❌ cv2.imdecode returned None - corrupted image data")
            return None
        
        logger.info(f"✅ Image decoded successfully: shape={img.shape}")
        return img
        
    except Exception as e:
        logger.error(f"❌ _ensure_image exception: {e}", exc_info=True)
        return None


def classify_pose_from_angles(pitch: float, yaw: float, roll: float = 0, expected_pose: str = "") -> str:
    """
    Xác định pose từ pitch/yaw/roll, đồng bộ với frontend logic
    Sử dụng roll để phân biệt left/right khi yaw nhỏ
    """
    # Check most specific conditions first
    if pitch > 4:  # Giảm từ 20° xuống 3-5°
        return "up"
    elif pitch < -4:  # Giảm từ -20° xuống -3 đến -5°
        return "down"
    elif 2 <= yaw <= 45:  # Left: từ 2° đến 45°
        return "left"
    elif -45 <= yaw <= -2:  # Right: từ -45° đến -2°
        return "right"
    elif abs(yaw) < 4 and abs(pitch) < 10:  # Khi yaw nhỏ (dưới ngưỡng), dùng roll để phân biệt
        # Roll positive = face tilted right, negative = face tilted left
        if abs(roll) > 3:  # Chỉ dùng roll khi có sự nghiêng rõ ràng
            if roll > 3:
                return "left"   # Mặt xoay sang trái
            elif roll < -3:
                return "right"  # Mặt xoay sang phải
        # Nếu roll cũng nhỏ, coi là front
        return "front"
    elif abs(yaw) < 15 and abs(pitch) < 10:  # Front condition phù hợp với ngưỡng mới
        return "front"
    return "unknown"


def get_landmarks(image_or_b64, face_rect):
    """Lấy landmarks 2D từ face_rect sử dụng global facemark instance"""
    img = _ensure_image(image_or_b64)
    if img is None or face_rect is None:
        return None
    x, y, w, h = face_rect
    try:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    except Exception:
        return None
    facemark = get_facemark_instance()

    ok, landmarks = facemark.fit(gray, np.array([face_rect]))
    if ok:
        return landmarks[0][0]  # (68,2)
    return None


def detect_face_pose_and_angle(image: Union[np.ndarray, str, bytes]) -> Tuple[str, dict]:
    """
    Detect face pose and return both pose classification and angle information.
    Accepts a numpy image or a base64 string/bytes.
    Handles 180° rotated camera images by automatically rotating if needed.
    Returns: (pose_string, angle_info_dict)
    """
    img = _ensure_image(image)
    if img is None or img.size == 0:
        logger.error("❌ detect_face_pose_and_angle: _ensure_image returned None or empty")
        return "no_face", {}

    try:
        height, width = img.shape[:2]
        logger.debug(f"🔍 Processing image for pose+angle: {width}x{height}")

        # ===== Detect face (Cascade Classifier) with optimization =====
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Enhance contrast for better face detection
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        gray_enhanced = clahe.apply(gray)
        
        cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        
        # Try multiple parameter sets (lenient to strict)
        face_detection_params = [
            {"scaleFactor": 1.05, "minNeighbors": 2, "flags": cv2.CASCADE_SCALE_IMAGE},  # Lenient
            {"scaleFactor": 1.1, "minNeighbors": 3},  # Medium
            {"scaleFactor": 1.2, "minNeighbors": 4},  # Stricter
        ]
        
        faces = None
        for params in face_detection_params:
            logger.debug(f"🔍 Trying cascade with params: {params}")
            faces = cascade.detectMultiScale(gray_enhanced, **params, minSize=MIN_FACE_SIZE)
            
            if faces is not None and len(faces) > 0:
                logger.info(f"✅ Cascade detector found {len(faces)} faces with params: {params}")
                break
        
        logger.info(f"📊 Cascade detector result: {len(faces) if faces is not None else 0} faces")

        # If no faces found, try with 180° rotated image (mobile camera orientation)
        if faces is None or len(faces) == 0:
            logger.info("⚠️ No faces detected, trying 180° rotation...")
            img_rotated = cv2.rotate(img, cv2.ROTATE_180)
            gray_rotated = cv2.cvtColor(img_rotated, cv2.COLOR_BGR2GRAY)
            gray_rotated_enhanced = clahe.apply(gray_rotated)
            
            for params in face_detection_params:
                faces = cascade.detectMultiScale(gray_rotated_enhanced, **params, minSize=MIN_FACE_SIZE)
                if faces is not None and len(faces) > 0:
                    logger.info(f"✅ Face found after 180° rotation! ({len(faces)} faces)")
                    img = img_rotated
                    gray = gray_rotated
                    break
            else:
                logger.info("⚠️ Still no faces after rotation, trying DNN detector...")

        if faces is None or len(faces) == 0:
            # Fallback DNN
            logger.info("🔄 Trying DNN face detector...")
            face_crop = detect_face(img)
            if face_crop is not None:
                logger.info("✅ DNN face detection succeeded")
                return "front", {"yaw": 0, "pitch": 0, "roll": 0, "landmarks": None}
            
            # Last resort: try simple face detection on resized image
            logger.info("⚠️ Trying face detection on resized image...")
            img_small = cv2.resize(img, (320, 240))
            gray_small = cv2.cvtColor(img_small, cv2.COLOR_BGR2GRAY)
            faces_small = cascade.detectMultiScale(gray_small, scaleFactor=1.1, minNeighbors=2, minSize=(30, 30))
            
            if faces_small is not None and len(faces_small) > 0:
                logger.info(f"✅ Face detected in resized image!")
                return "front", {"yaw": 0, "pitch": 0, "roll": 0, "landmarks": None}
            
            logger.error("❌ All face detectors failed - no face found")
            return "no_face", {}

        # Lấy face lớn nhất
        x, y, w, h = sorted(faces, key=lambda f: f[2]*f[3], reverse=True)[0]
        face_rect = (x, y, w, h)

        # ===== Get landmarks =====
        landmarks_all = get_landmarks(img, face_rect)
        logger.debug(f"Landmarks detection: got {len(landmarks_all) if landmarks_all is not None else 0} landmarks")
        if landmarks_all is None or len(landmarks_all) < 68:
            logger.warning("Không đủ landmarks để tính pose")
            return "unknown", {"yaw": 0, "pitch": 0, "roll": 0, "landmarks": None}

        # ===== Estimate pose using PnP =====
        # Select key landmarks for pose estimation (same as original)
        landmarks = landmarks_all[[30, 8, 36, 45, 48, 54]]  # nose, chin, eyes, mouth corners

        if len(landmarks) < 6:
            logger.warning("Không đủ landmarks key để tính pose")
            return "unknown", {"yaw": 0, "pitch": 0, "roll": 0, "landmarks": landmarks_all}

        # Solve PnP with primary camera matrix
        success, rotation_vector, translation_vector = cv2.solvePnP(
            FACE_3D_MODEL.astype(np.float32),
            landmarks.astype(np.float32),
            CAMERA_MATRIX,
            DIST_COEFFS,
            flags=cv2.SOLVEPNP_ITERATIVE
        )

        logger.debug(f"PnP solve (normal): success={success}")

        # If PnP fails, try with flipped camera matrix (for mobile camera orientation issues)
        if not success:
            logger.debug("Trying with flipped camera matrix...")
            success, rotation_vector, translation_vector = cv2.solvePnP(
                FACE_3D_MODEL.astype(np.float32),
                landmarks.astype(np.float32),
                CAMERA_MATRIX_FLIPPED,
                DIST_COEFFS,
                flags=cv2.SOLVEPNP_ITERATIVE
            )
            logger.debug(f"PnP solve (flipped): success={success}")

        if not success:
            logger.warning("PnP solve failed with both camera matrices")
            return "unknown", {"yaw": 0, "pitch": 0, "roll": 0, "landmarks": landmarks_all}

        # Convert rotation vector to Euler angles
        rotation_matrix, _ = cv2.Rodrigues(rotation_vector)
        yaw = np.arctan2(rotation_matrix[2, 0], rotation_matrix[2, 2]) * 180 / np.pi
        pitch = np.arctan2(-rotation_matrix[2, 1], np.sqrt(rotation_matrix[0, 1]**2 + rotation_matrix[1, 1]**2)) * 180 / np.pi
        roll = np.arctan2(rotation_matrix[1, 0], rotation_matrix[0, 0]) * 180 / np.pi

        # Debug logging
        logger.debug(f"Raw angles - yaw: {yaw:.1f}°, pitch: {pitch:.1f}°, roll: {roll:.1f}°")

        # Handle camera orientation issues (mobile cameras often flip)
        # If angles are completely inverted (yaw ~180°), flip them
        if abs(yaw) > 150:
            logger.warning(f"Camera orientation issue detected (yaw: {yaw:.1f}°), flipping angles")
            yaw = yaw - np.sign(yaw) * 180  # Flip 180 degrees
            pitch = -pitch  # Also flip pitch
            roll = -roll    # And roll

        # Additional check: if pitch is also inverted, double-flip
        if abs(pitch) > 80:
            logger.warning(f"Extreme pitch detected ({pitch:.1f}°), possible double-flip needed")
            pitch = np.clip(pitch - np.sign(pitch) * 180, -90, 90)

        # Final clamping to reasonable ranges
        yaw = np.clip(yaw, -90, 90)      # Face can't realistically turn more than 90°
        pitch = np.clip(pitch, -45, 45)  # Face tilt is limited
        roll = np.clip(roll, -30, 30)    # Face roll is minimal

        logger.debug(f"Final angles - yaw: {yaw:.1f}°, pitch: {pitch:.1f}°, roll: {roll:.1f}°")

        # Classify pose based on angles
        pose = classify_pose_from_angles(pitch, yaw, roll)
        logger.debug(f"Pose classification: yaw={yaw:.1f}°, pitch={pitch:.1f}°, roll={roll:.1f}° -> pose='{pose}'")

        angle_info = {
            "yaw": float(yaw),
            "pitch": float(pitch),
            "roll": float(roll),
            "landmarks": landmarks_all.tolist() if landmarks_all is not None else None
        }

        return pose, angle_info

    except Exception as e:
        logger.error(f"Error in detect_face_pose_and_angle: {e}")
        return "error", {"yaw": 0, "pitch": 0, "roll": 0, "landmarks": None}


def detect_face_pose(
    image: Union[np.ndarray, str, bytes],
    expected_pose: Optional[str] = None,
    mode: str = "setup"
) -> str:
    """
    Detect face pose using PnP, chỉ trả về các pose chính xác.
    Nếu mode=="setup" thì yêu cầu left → right (cho FaceID setup)
    """
    img = _ensure_image(image)
    if img is None or img.size == 0:
        return "no_face"

    try:
        height, width = img.shape[:2]
        logger.debug(f"Processing image: {width}x{height}")

        # ===== Detect face =====
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml") \
                    .detectMultiScale(gray, scaleFactor=1.1, minNeighbors=3, minSize=MIN_FACE_SIZE)

        if faces is None or len(faces) == 0:
            # Fallback DNN
            face_crop = detect_face(img)
            if face_crop is not None:
                logger.debug("DNN face detection succeeded, assume front pose")
                return "front"
            return "no_face"

        # Lấy face lớn nhất
        x, y, w, h = sorted(faces, key=lambda f: f[2]*f[3], reverse=True)[0]
        face_rect = (x, y, w, h)

        # ===== Get landmarks =====
        landmarks_all = get_landmarks(img, face_rect)
        if landmarks_all is None or len(landmarks_all) < 68:
            logger.warning("Không đủ landmarks để tính pose")
            return "unknown"

        landmarks_2d = np.array([
            landmarks_all[30],  # Nose tip
            landmarks_all[8],   # Chin
            landmarks_all[36],  # Left eye left corner
            landmarks_all[45],  # Right eye right corner
            landmarks_all[48],  # Left mouth corner
            landmarks_all[54],  # Right mouth corner
        ], dtype=np.float32)

        # ===== SolvePnP =====
        try:
            rvec, tvec = estimate_face_pose_pnp(landmarks_2d, FACE_3D_MODEL, CAMERA_MATRIX, DIST_COEFFS)
            pitch, yaw, roll = rotation_vector_to_euler(rvec)
            pose = classify_pose_from_angles(pitch, yaw, roll, expected_pose or "")
            logger.debug(f"PnP pose detected: {pose}")
            return pose
        except Exception as e:
            logger.error(f"PnP pose estimation failed: {e}")
            return "unknown"

    except Exception as e:
        logger.error(f"Error in detect_face_pose: {e}")
        return "unknown"


# ========== PHẦN GIỮ NGUYÊN ==========

def rotation_vector_to_euler(rvec: np.ndarray) -> tuple:
    R, _ = cv2.Rodrigues(rvec)
    sy = np.sqrt(R[0,0]**2 + R[1,0]**2)
    singular = sy < 1e-6
    if not singular:
        x = np.arctan2(R[2,1], R[2,2])
        y = np.arctan2(-R[2,0], sy)
        z = np.arctan2(R[1,0], R[0,0])
    else:
        x = np.arctan2(-R[1,2], R[1,1])
        y = np.arctan2(-R[2,0], sy)
        z = 0
    pitch = np.degrees(x)
    yaw = np.degrees(y)
    roll = np.degrees(z)
    return pitch, yaw, roll


def _normalize_pose_string(expected_pose: str) -> str:
    if not expected_pose:
        return ""
    expected_lower = expected_pose.lower()
    if "front" in expected_lower:
        return "front"
    if "left" in expected_lower:
        return "left"
    if "right" in expected_lower:
        return "right"
    if "up" in expected_lower:
        return "up"
    if "down" in expected_lower:
        return "down"
    return expected_lower


def validate_pose_against_expected(image: Union[np.ndarray, str, bytes], expected_pose: str) -> Tuple[bool, str]:
    expected_normalized = _normalize_pose_string(expected_pose)

    detected_pose = detect_face_pose(
        image,
        expected_pose=expected_normalized,
        mode="setup"
    )

    logger.debug(f"Pose validation: expected='{expected_pose}' -> normalized='{expected_normalized}', detected='{detected_pose}'")

    if detected_pose == expected_normalized:
        logger.debug("Pose validation: ✅ MATCH")
        return True, detected_pose
    else:
        logger.debug(f"Pose validation: ❌ MISMATCH - Expected {expected_normalized}, got {detected_pose}")
        return False, detected_pose


def get_pose_requirements(expected_pose: str) -> dict:
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

# ===== FACIAL EXPRESSION DETECTION (Enterprise Face ID) =====

def detect_facial_expression(detection_result: dict, expression_id: str) -> bool:
    """
    Detect specific facial expressions for enterprise Face ID anti-spoofing

    Args:
        detection_result: Result from detect_face_pose_and_angle
        expression_id: Type of expression to detect ("blink", "mouth_open", "smile")

    Returns:
        bool: True if expression detected
    """
    try:
        landmarks = detection_result.get("landmarks", [])
        if not landmarks or len(landmarks) < 68:
            logger.warning("Not enough landmarks for expression detection")
            return False

        # Convert landmarks to numpy array
        landmarks = np.array(landmarks, dtype=np.float32)

        if expression_id == "blink":
            return detect_blink_expression(landmarks)
        elif expression_id == "mouth_open":
            return detect_mouth_open_expression(landmarks)
        elif expression_id == "smile":
            return detect_smile_expression(landmarks)
        else:
            logger.warning(f"Unknown expression type: {expression_id}")
            return False

    except Exception as e:
        logger.error(f"Error detecting facial expression {expression_id}: {e}")
        return False

def detect_blink_expression(landmarks: np.ndarray) -> bool:
    """
    Detect eye blink by calculating Eye Aspect Ratio (EAR)
    EAR < threshold indicates blink
    """
    try:
        # Left eye landmarks (points 36-41)
        left_eye = landmarks[36:42]
        # Right eye landmarks (points 42-47)
        right_eye = landmarks[42:48]

        # Calculate EAR for left eye
        left_ear = calculate_eye_aspect_ratio(left_eye)
        # Calculate EAR for right eye
        right_ear = calculate_eye_aspect_ratio(right_eye)

        # Average EAR
        avg_ear = (left_ear + right_ear) / 2.0

        # Blink threshold - more lenient for better detection
        BLINK_THRESHOLD = 0.2

        logger.info(f"Blink detection - Left EAR: {left_ear:.3f}, Right EAR: {right_ear:.3f}, Avg: {avg_ear:.3f}, Threshold: {BLINK_THRESHOLD}")

        return avg_ear < BLINK_THRESHOLD

    except Exception as e:
        logger.error(f"Error in blink detection: {e}")
        return False

def calculate_eye_aspect_ratio(eye_landmarks: np.ndarray) -> float:
    """Calculate Eye Aspect Ratio (EAR) for blink detection"""
    try:
        # Vertical eye landmarks
        # eye[0] = left corner, eye[3] = right corner
        # eye[1] = top, eye[5] = bottom
        vertical1 = np.linalg.norm(eye_landmarks[1] - eye_landmarks[5])
        vertical2 = np.linalg.norm(eye_landmarks[2] - eye_landmarks[4])

        # Horizontal eye landmark
        horizontal = np.linalg.norm(eye_landmarks[0] - eye_landmarks[3])

        # EAR formula
        ear = (vertical1 + vertical2) / (2.0 * horizontal)
        return ear

    except Exception as e:
        logger.error(f"Error calculating EAR: {e}")
        return 1.0  # Return high value (eyes open)

def detect_mouth_open_expression(landmarks: np.ndarray) -> bool:
    """
    Detect mouth opening by calculating Mouth Aspect Ratio (MAR)
    MAR > threshold indicates mouth open
    """
    try:
        # Mouth landmarks (points 48-67)
        mouth = landmarks[48:68]

        # Vertical distances (outer mouth)
        vertical_outer = np.linalg.norm(mouth[2] - mouth[10])  # Top to bottom outer
        vertical_inner = np.linalg.norm(mouth[3] - mouth[9])   # Top to bottom inner

        # Average vertical
        vertical = (vertical_outer + vertical_inner) / 2.0

        # Horizontal distance (mouth width)
        horizontal = np.linalg.norm(mouth[0] - mouth[6])  # Left to right corner

        # MAR (Mouth Aspect Ratio)
        mar = vertical / horizontal if horizontal > 0 else 0

        # Mouth open threshold - more lenient for better detection
        MOUTH_OPEN_THRESHOLD = 0.35

        logger.info(f"Mouth open detection - MAR: {mar:.3f} (threshold: {MOUTH_OPEN_THRESHOLD})")

        return mar > MOUTH_OPEN_THRESHOLD

    except Exception as e:
        logger.error(f"Error in mouth open detection: {e}")
        return False


    

def detect_smile_expression(landmarks: np.ndarray) -> bool:
    """
    Detect smile by analyzing mouth corner positions and lip curve
    Smile indicators: mouth corners up, lip curve changes
    """
    try:
        # Mouth landmarks (points 48-67)
        mouth = landmarks[48:68]

        # Mouth corners
        left_corner = mouth[0]   # Point 48
        right_corner = mouth[6]  # Point 54

        # Upper lip center points
        upper_lip_left = mouth[2]    # Point 50
        upper_lip_center = mouth[3]  # Point 51
        upper_lip_right = mouth[4]   # Point 52

        # Calculate mouth corner elevation (smile indicator)
        # Compare y-coordinates (lower values = higher position)
        corner_elevation = (left_corner[1] + right_corner[1]) / 2.0
        lip_center_y = upper_lip_center[1]

        # Mouth width for normalization
        mouth_width = np.linalg.norm(left_corner - right_corner)

        # Normalized elevation difference
        elevation_diff = (lip_center_y - corner_elevation) / mouth_width

        # Smile threshold (corners higher than center indicates smile)
        SMILE_THRESHOLD = 0.05  # Adjust based on testing

        logger.info(f"Smile detection - Elevation diff: {elevation_diff:.3f} (threshold: {SMILE_THRESHOLD})")

        return elevation_diff > SMILE_THRESHOLD

    except Exception as e:
        logger.error(f"Error in smile detection: {e}")
        return False


# ------------------------
# Wrapper for frontend student actions
# ------------------------
def detect_face_pose_and_expression(image: Union[np.ndarray, str, bytes], action_id: str) -> dict:
    """
    Unified detection function for frontend student flow.

    Args:
        image: ndarray or base64/file bytes
        action_id: one of 'neutral','blink','mouth_open','micro_movement','final_neutral','smile'

    Returns:
        dict with keys: face_present, yaw, pitch, roll, message, expression_detected (bool), captured (bool), action (str or None), landmarks
    """
    try:
        pose, angle_info = detect_face_pose_and_angle(image)
    except Exception as e:
        logger.error(f"detect_face_pose_and_expression: failed to run angle detection: {e}")
        return {
            "face_present": False,
            "yaw": 0,
            "pitch": 0,
            "roll": 0,
            "message": "Error processing image",
            "expression_detected": False,
            "captured": False,
            "action": None,
            "landmarks": None
        }

    face_present = pose not in ["no_face", "error"]
    yaw = float(angle_info.get("yaw", 0))
    pitch = float(angle_info.get("pitch", 0))
    roll = float(angle_info.get("roll", 0))
    landmarks = angle_info.get("landmarks")

    result = {
        "face_present": face_present,
        "yaw": yaw,
        "pitch": pitch,
        "roll": roll,
        "message": "",
        "expression_detected": False,
        "captured": False,
        "action": None,
        "landmarks": landmarks
    }

    if not face_present:
        result["message"] = "No face detected"
        return result

    # Neutral: face roughly frontal (lenient thresholds for better detection)
    if action_id in ["neutral", "final_neutral"]:
        # Lenient thresholds: allow more head movement
        frontal = abs(yaw) <= 20 and abs(pitch) <= 20
        result["captured"] = frontal
        result["message"] = "Face frontal" if frontal else f"Xoay đầu ít hơn (yaw: {yaw:.0f}°, pitch: {pitch:.0f}°)"
        if frontal:
            result["action"] = action_id
        return result

    # Blink
    if action_id == "blink":
        if landmarks is None:
            result["message"] = "Không đủ landmarks để phát hiện chớp mắt"
            return result
        expr = bool(detect_blink_expression(np.array(landmarks, dtype=np.float32)))
        result["expression_detected"] = expr
        result["captured"] = expr
        result["action"] = action_id if expr else None
        result["message"] = "Blink detected" if expr else "Chưa chớp mắt"
        return result

    # Mouth open
    if action_id == "mouth_open":
        if landmarks is None:
            result["message"] = "Không đủ landmarks để phát hiện mở miệng"
            return result
        expr = bool(detect_mouth_open_expression(np.array(landmarks, dtype=np.float32)))
        result["expression_detected"] = expr
        result["captured"] = expr
        result["action"] = action_id if expr else None
        result["message"] = "Mouth open detected" if expr else "Miệng chưa mở"
        return result
    # Micro movement (nhúc nhích nhẹ) - detect small head movement (lenient)
    if action_id == "micro_movement":
        # More lenient: any visible movement counts
        moved = abs(yaw) >= 2 or abs(pitch) >= 2 or abs(roll) >= 2
        result["expression_detected"] = moved
        result["captured"] = moved
        result["action"] = action_id if moved else None
        result["message"] = "Micro movement detected" if moved else "Hãy nhúc nhích đầu nhẹ"
        return result

    # Smile (if used)
    if action_id == "smile":
        if landmarks is None:
            result["message"] = "Không đủ landmarks để phát hiện cười"
            return result
        expr = bool(detect_smile_expression(np.array(landmarks, dtype=np.float32)))
        result["expression_detected"] = expr
        result["captured"] = expr
        result["action"] = action_id if expr else None
        result["message"] = "Smile detected" if expr else "Chưa mỉm cười"
        return result

    # Fallback: unknown action
    result["message"] = f"Unknown action: {action_id}"
    return result
