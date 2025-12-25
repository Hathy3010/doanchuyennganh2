# face_detect.py - DNN Face Detection Module
import cv2
import os
import logging
import numpy as np
import math
from typing import Optional, Sequence, Tuple, Dict, Any

logger = logging.getLogger(__name__)

# ===== MODEL PATHS =====
MODELS_DIR = "models"
os.makedirs(MODELS_DIR, exist_ok=True)
FACE_YUNET_MODEL = os.path.join(MODELS_DIR, "face_detection_yunet_2023mar.onnx")


# ===== GLOBAL FACE DETECTOR =====
_face_net = None

def _ensure_face_detector():
    global _face_net

    if _face_net is not None:
        return _face_net

    if not os.path.exists(FACE_YUNET_MODEL):
        logger.error("❌ YuNet model not found! Please run download script first.")
        return None

    try:
        _face_net = cv2.FaceDetectorYN.create(
            model=FACE_YUNET_MODEL,
            config="",
            input_size=(320, 320),
            score_threshold=0.6,
            nms_threshold=0.3,
            top_k=5000
        )
        logger.info("✅ YuNet face detector loaded successfully")
        return _face_net
    except Exception as e:
        logger.error(f"❌ Failed to load YuNet face detector: {e}")
        return None
    
def detect_face(image: np.ndarray) -> Optional[np.ndarray]:
    """
    Detects faces in an image using the YuNet DNN model.

    Args:
        image: A NumPy array representing the image.

    Returns:
        A NumPy array representing the best detected face with format
        [x, y, w, h, re_x, re_y, le_x, le_y, nt_x, nt_y, rcm_x, rcm_y, lcm_x, lcm_y, score],
        or None if no face is detected.
    """
    if image is None:
        return None

    net = _ensure_face_detector()
    if net is None:
        return None

    h, w = image.shape[:2]
    net.setInputSize((w, h))

    results = net.detect(image)

    if results is None or len(results) == 0:
        logger.debug("DNN detector found no faces.")
        return None

    # The score is the last element (index 14)
    best = max(results, key=lambda r: r[14])
    score = best[14]
    
    logger.debug(f"✅ DNN Face detected with confidence: {score:.2f}")
    return best

def _rotation_matrix_to_euler_angles(R: np.ndarray) -> Tuple[float, float, float]:
    """
    Convert rotation matrix to Euler angles (rx, ry, rz) in radians.
    Using convention: pitch (x), yaw (y), roll (z)
    """
    sy = math.sqrt(R[0, 0] * R[0, 0] + R[1, 0] * R[1, 0])
    singular = sy < 1e-6
    if not singular:
        x = math.atan2(R[2, 1], R[2, 2])
        y = math.atan2(-R[2, 0], sy)
        z = math.atan2(R[1, 0], R[0, 0])
    else:
        x = math.atan2(-R[1, 2], R[1, 1])
        y = math.atan2(-R[2, 0], sy)
        z = 0
    return x, y, z

def estimate_face_pose_pnp(
    image_points: Sequence[Tuple[float, float]],
    image_size: Optional[Tuple[int, int]] = None,
    model_points: Optional[Sequence[Tuple[float, float, float]]] = None,
    dist_coeffs: Optional[Sequence[float]] = None,
) -> Dict[str, Any]:
    """
    Estimate face pose (yaw, pitch, roll) from 2D facial landmarks using solvePnP.
    - image_points: sequence of 2D points (x,y). Must correspond in order to model_points.
    - image_size: (width, height). If None, focal length approximated from points.
    - model_points: optional 3D reference model points (in mm). If None, uses a common 6-point model:
        [nose_tip, chin, left_eye_corner, right_eye_corner, left_mouth_corner, right_mouth_corner]
    - dist_coeffs: camera distortion coefficients (optional)

    Returns dict: { success: bool, yaw:deg, pitch:deg, roll:deg, rvec, tvec, message }
    """
    if cv2 is None:
        return {"success": False, "message": "cv2 not available"}

    pts2 = np.asarray(image_points, dtype=np.float64)
    if pts2.ndim != 2 or pts2.shape[1] != 2:
        return {"success": False, "message": "image_points must be Nx2"}

    if model_points is None:
        # Standard frontal 3D model points (approx in mm)
        model_points = np.array([
            (0.0, 0.0, 0.0),        # nose tip
            (0.0, -63.6, -12.5),    # chin
            (-43.3, 32.7, -26.0),   # left eye left corner
            (43.3, 32.7, -26.0),    # right eye right corner
            (-28.9, -28.9, -24.1),  # left mouth corner
            (28.9, -28.9, -24.1),   # right mouth corner
        ], dtype=np.float64)
    else:
        model_points = np.asarray(model_points, dtype=np.float64)

    if model_points.shape[0] != pts2.shape[0]:
        return {"success": False, "message": "model_points and image_points length mismatch"}

    # Camera matrix
    if image_size and len(image_size) == 2:
        w, h = image_size
        focal_length = w
        center = (w / 2.0, h / 2.0)
    else:
        # fallback: approximate focal length from points spread
        xs = pts2[:, 0]
        focal_length = max(1.0, float(np.ptp(xs)) * 2.0)
        center = (np.mean(xs), np.mean(pts2[:, 1]))

    camera_matrix = np.array([
        [focal_length, 0, center[0]],
        [0, focal_length, center[1]],
        [0, 0, 1]
    ], dtype=np.float64)

    if dist_coeffs is None:
        dist_coeffs = np.zeros((4, 1), dtype=np.float64)
    else:
        dist_coeffs = np.asarray(dist_coeffs, dtype=np.float64)

    # solvePnP
    try:
        success, rvec, tvec = cv2.solvePnP(model_points, pts2, camera_matrix, dist_coeffs, flags=cv2.SOLVEPNP_ITERATIVE)
        if not success:
            return {"success": False, "message": "solvePnP failed"}
        R_mat, _ = cv2.Rodrigues(rvec)
        rx, ry, rz = _rotation_matrix_to_euler_angles(R_mat)  # radians: pitch(x), yaw(y), roll(z)
        pitch = math.degrees(rx)
        yaw = math.degrees(ry)
        roll = math.degrees(rz)
        return {
            "success": True,
            "yaw": float(yaw),
            "pitch": float(pitch),
            "roll": float(roll),
            "rvec": rvec.flatten().tolist(),
            "tvec": tvec.flatten().tolist(),
            "camera_matrix": camera_matrix.tolist(),
        }
    except Exception as e:
        return {"success": False, "message": f"exception: {e}"}
