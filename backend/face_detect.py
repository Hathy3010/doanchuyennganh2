# face_detect.py - DNN Face Detection Module
import cv2
import os
import logging
import numpy as np

logger = logging.getLogger(__name__)

# ===== MODEL PATHS =====
MODELS_DIR = "models"
os.makedirs(MODELS_DIR, exist_ok=True)
FACE_DETECTOR_PROTOTXT = os.path.join(MODELS_DIR, "deploy.prototxt")
FACE_DETECTOR_CAFFEMODEL = os.path.join(MODELS_DIR, "res10_300x300_ssd_iter_140000.caffemodel")

# ===== GLOBAL FACE DETECTOR =====
_face_net = None

def _ensure_face_detector():
    """Download face detector models if missing"""
    global _face_net

    if _face_net is not None:
        return _face_net

    if not os.path.exists(FACE_DETECTOR_PROTOTXT) or not os.path.exists(FACE_DETECTOR_CAFFEMODEL):
        logger.info("📥 Downloading OpenCV face detector models...")
        import requests

        proto_url = "https://raw.githubusercontent.com/opencv/opencv/master/samples/dnn/face_detector/deploy.prototxt"
        model_url = "https://raw.githubusercontent.com/opencv/opencv_3rdparty/master/res10_300x300_ssd_iter_140000.caffemodel"

        for url, path in ((proto_url, FACE_DETECTOR_PROTOTXT), (model_url, FACE_DETECTOR_CAFFEMODEL)):
            try:
                logger.debug(f"⬇️ Downloading {os.path.basename(path)}")
                r = requests.get(url, timeout=30)
                r.raise_for_status()
                with open(path, "wb") as f:
                    f.write(r.content)
                logger.debug(f"✅ Downloaded {os.path.basename(path)}")
            except Exception as e:
                logger.error(f"❌ Failed to download {os.path.basename(path)}: {e}")
                return None

    # Load DNN model
    try:
        _face_net = cv2.dnn.readNetFromCaffe(FACE_DETECTOR_PROTOTXT, FACE_DETECTOR_CAFFEMODEL)
        logger.info("✅ DNN Face detector loaded successfully")
        return _face_net
    except Exception as e:
        logger.error(f"❌ Failed to load DNN face detector: {e}")
        return None

def detect_face(image):
    """
    Detect single face from image using DNN
    Returns: cropped face (BGR) or None
    """
    if image is None:
        return None

    net = _ensure_face_detector()
    if net is None:
        return None

    h, w = image.shape[:2]
    blob = cv2.dnn.blobFromImage(cv2.resize(image, (300, 300)), 1.0, (300, 300), (104.0, 177.0, 123.0))
    net.setInput(blob)
    detections = net.forward()

    best_conf = 0.0
    best_box = None

    for i in range(detections.shape[2]):
        conf = float(detections[0, 0, i, 2])
        if conf > 0.5 and conf > best_conf:
            box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
            (x1, y1, x2, y2) = box.astype("int")
            best_conf = conf
            best_box = (x1, y1, x2, y2)

    if best_box is None:
        return None

    x1, y1, x2, y2 = best_box

    # Add margin to face crop
    margin = 0.2
    mw, mh = int((x2 - x1) * margin), int((y2 - y1) * margin)
    x1 = max(0, x1 - mw)
    y1 = max(0, y1 - mh)
    x2 = min(w, x2 + mw)
    y2 = min(h, y2 + mh)

    face = image[y1:y2, x1:x2]
    if face.size == 0:
        return None

    logger.debug(f"✅ Face detected with confidence: {best_conf:.2f}")
    return face
