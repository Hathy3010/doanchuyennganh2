import cv2
import numpy as np
from typing import Optional, Tuple, Dict, Any
import logging

logger = logging.getLogger(__name__)

def check_image_quality(img: np.ndarray) -> Tuple[bool, str]:
    """
    Check image quality: brightness and blur
    Returns: (is_good, message)
    """
    try:
        # Convert to grayscale for analysis
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Check brightness (mean pixel value)
        brightness = np.mean(gray)

        # Check blur using Laplacian variance
        blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()

        logger.info(f"🔍 Image quality - Brightness: {brightness:.1f}, Blur: {blur_score:.2f}")

        # Quality thresholds (calibrated for mobile cameras)
        if brightness < 40:
            logger.warning(f"❌ Too dark: brightness {brightness:.1f} < 40")
            return False, "Ảnh quá tối, hãy di chuyển ra nơi sáng hơn"

        if brightness > 240:
            logger.warning(f"❌ Too bright: brightness {brightness:.1f} > 240")
            return False, "Ảnh quá sáng, hãy tránh ánh sáng trực tiếp"

        # Very lenient blur threshold for mobile cameras (reduced to 5)
        # Mobile cameras often have blur scores 5-50
        if blur_score < 5:
            logger.warning(f"❌ Too blurry: blur_score {blur_score:.2f} < 5")
            return False, "Ảnh bị mờ, hãy giữ yên camera và tập trung vào khuôn mặt"

        logger.info(f"✅ Image quality OK - Brightness: {brightness:.1f}, Blur: {blur_score:.2f}")
        return True, "Ảnh chất lượng tốt"

    except Exception as e:
        logger.error(f"Quality check failed: {e}")
        return False, f"Lỗi kiểm tra chất lượng: {str(e)}"

def align_face_using_landmarks(img: np.ndarray, landmarks: np.ndarray) -> np.ndarray:
    """
    Align face so that eyes are horizontal using facial landmarks
    landmarks: 68-point facial landmarks (dlib format)
    """
    try:
        if landmarks is None or len(landmarks) < 48:
            # Fallback: just resize without alignment
            logger.warning("No landmarks available, using fallback resize")
            return cv2.resize(img, (112, 112))

        # Left eye points (36-41), right eye points (42-47)
        left_eye_pts = landmarks[36:42]  # shape: (6, 2)
        right_eye_pts = landmarks[42:48] # shape: (6, 2)

        # Calculate eye centers
        left_eye_center = np.mean(left_eye_pts, axis=0)  # [x, y]
        right_eye_center = np.mean(right_eye_pts, axis=0) # [x, y]

        # Calculate angle between eyes
        dY = right_eye_center[1] - left_eye_center[1]
        dX = right_eye_center[0] - left_eye_center[0]
        angle = np.degrees(np.arctan2(dY, dX))

        # Eyes center point for rotation
        eyes_center = (
            int((left_eye_center[0] + right_eye_center[0]) // 2),
            int((left_eye_center[1] + right_eye_center[1]) // 2)
        )

        # Get rotation matrix
        M = cv2.getRotationMatrix2D(eyes_center, angle, 1.0)

        # Apply rotation
        (h, w) = img.shape[:2]
        aligned = cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_CUBIC)

        # Optional: Crop to face region (simplified)
        # In production, you'd use face bounding box to crop properly

        return aligned

    except Exception as e:
        logger.error(f"Face alignment failed: {e}")
        # Fallback to resize
        return cv2.resize(img, (112, 112))

def preprocess_image_for_embedding(img: np.ndarray) -> np.ndarray:
    """
    Full preprocessing pipeline for face embedding
    """
    # 1. Quality check
    is_good, quality_msg = check_image_quality(img)
    if not is_good:
        logger.warning(f"Image quality issue: {quality_msg}")

    # 2. Convert to RGB (OpenCV uses BGR by default)
    if len(img.shape) == 3 and img.shape[2] == 3:
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    else:
        img_rgb = img

    # 3. Resize to model input size (112x112 for better models, fallback to 32x32)
    target_size = (112, 112)  # Better than 32x32 for face recognition

    # Note: If your ONNX model requires 32x32, resize accordingly
    # For now, using 112x112 and let the model handle it

    resized = cv2.resize(img_rgb, target_size, interpolation=cv2.INTER_CUBIC)

    return resized

def calculate_similarity(emb1: np.ndarray, emb2: np.ndarray) -> float:
    """
    Calculate cosine similarity between two embeddings
    """
    # Cosine similarity
    dot_product = np.dot(emb1, emb2)
    norm1 = np.linalg.norm(emb1)
    norm2 = np.linalg.norm(emb2)

    if norm1 == 0 or norm2 == 0:
        return 0.0

    similarity = dot_product / (norm1 * norm2)
    return float(similarity)

def is_face_match(emb1: np.ndarray, emb2: np.ndarray, threshold: float = 0.6) -> bool:
    """
    Check if two face embeddings match
    """
    similarity = calculate_similarity(emb1, emb2)
    logger.info(f"Face similarity: {similarity:.3f} (threshold: {threshold})")
    return similarity >= threshold

def extract_face_region(img: np.ndarray, bbox: Tuple[int, int, int, int]) -> np.ndarray:
    """
    Extract face region from image using bounding box
    bbox: (x, y, w, h)
    """
    x, y, w, h = bbox

    # Add some padding
    padding = int(0.1 * w)  # 10% padding
    x1 = max(0, x - padding)
    y1 = max(0, y - padding)
    x2 = min(img.shape[1], x + w + padding)
    y2 = min(img.shape[0], y + h + padding)

    face_region = img[y1:y2, x1:x2]
    return face_region
