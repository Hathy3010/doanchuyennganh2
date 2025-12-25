#!/usr/bin/env python3
"""
Download all required models for face detection and landmark estimation.
"""

import os
import requests
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MODELS_DIR = "models"
LANDMARK_MODEL_PATH = os.path.join(MODELS_DIR, "lbfmodel.yaml")
FACE_DETECTOR_CAFFEMODEL = os.path.join(MODELS_DIR, "face_detection_yunet_2023mar.onnx")

def download_landmark_model():
    """Download OpenCV facial landmark model."""
    os.makedirs(MODELS_DIR, exist_ok=True)

    if os.path.exists(LANDMARK_MODEL_PATH):
        logger.info(f"✅ Landmark model already exists at {LANDMARK_MODEL_PATH}")
        return True

    model_url = "https://raw.githubusercontent.com/kurnianggoro/GSOC2017/master/data/lbfmodel.yaml"

    try:
        logger.info(f"Downloading facial landmark model from {model_url}...")
        response = requests.get(model_url, timeout=30)
        response.raise_for_status()

        with open(LANDMARK_MODEL_PATH, 'wb') as f:
            f.write(response.content)

        logger.info(f"✅ Successfully downloaded landmark model to {LANDMARK_MODEL_PATH}")
        return True

    except Exception as e:
        logger.error(f"❌ Failed to download landmark model: {e}")
        return False

def download_face_detector_models():
    """Download YuNet face detector model (.onnx)."""
    os.makedirs(MODELS_DIR, exist_ok=True)

    model_path = FACE_DETECTOR_CAFFEMODEL
    url = "https://raw.githubusercontent.com/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"

    if os.path.exists(model_path):
        logger.info("✅ YuNet face detector already exists.")
        return True

    logger.info("📥 Downloading YuNet face detector model...")
    try:
        r = requests.get(url, timeout=60)
        r.raise_for_status()

        with open(model_path, "wb") as f:
            f.write(r.content)

        logger.info("✅ Successfully downloaded YuNet model")
        return True

    except Exception as e:
        logger.error(f"❌ Failed to download YuNet model: {e}")
        return False

if __name__ == "__main__":
    landmark_ok = download_landmark_model()
    detector_ok = download_face_detector_models()

    print("\n--- Model Download Summary ---")
    if landmark_ok:
        print("✅ Facial landmark model (lbfmodel.yaml) is ready.")
    else:
        print("❌ Failed to download facial landmark model.")
    
    if detector_ok:
        print("✅ DNN face detector models (prototxt & caffemodel) are ready.")
    else:
        print("❌ Failed to download DNN face detector models.")

    if landmark_ok and detector_ok:
        print("\n🎉 All models are downloaded and ready.")
    else:
        print("\n⚠️ Some models failed to download. The application may not function correctly.")
        print("Please check your internet connection and run this script again.")
        exit(1)
