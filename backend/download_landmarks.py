#!/usr/bin/env python3
"""
Download facial landmark detection model for PnP pose estimation
"""

import os
import requests
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MODELS_DIR = "models"
LANDMARK_MODEL_PATH = os.path.join(MODELS_DIR, "lbfmodel.yaml")

def download_landmark_model():
    """Download OpenCV facial landmark model"""
    os.makedirs(MODELS_DIR, exist_ok=True)

    if os.path.exists(LANDMARK_MODEL_PATH):
        logger.info(f"Landmark model already exists at {LANDMARK_MODEL_PATH}")
        return True

    # OpenCV facial landmark model URL
    # This is the LBF model for 68-point facial landmarks
    model_url = "https://raw.githubusercontent.com/kurnianggoro/GSOC2017/master/data/lbfmodel.yaml"

    try:
        logger.info(f"Downloading facial landmark model from {model_url}")
        response = requests.get(model_url, timeout=30)
        response.raise_for_status()

        with open(LANDMARK_MODEL_PATH, 'wb') as f:
            f.write(response.content)

        logger.info(f"Successfully downloaded landmark model to {LANDMARK_MODEL_PATH}")
        return True

    except Exception as e:
        logger.error(f"Failed to download landmark model: {e}")
        return False

if __name__ == "__main__":
    success = download_landmark_model()
    if success:
        print("✅ Facial landmark model downloaded successfully")
    else:
        print("❌ Failed to download facial landmark model")
        print("Note: PnP pose detection will fallback to zone-based method")
