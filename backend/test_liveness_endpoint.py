"""
Test script for liveness detection endpoint
Tests the /detect_liveness endpoint with sample frames
"""

import requests
import base64
import json
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Backend URL
BACKEND_URL = "http://localhost:8000"
DETECT_LIVENESS_ENDPOINT = f"{BACKEND_URL}/detect_liveness"

def load_test_image(image_path: str) -> str:
    """Load an image and convert to base64"""
    try:
        with open(image_path, "rb") as f:
            image_data = f.read()
        return base64.b64encode(image_data).decode("utf-8")
    except Exception as e:
        logger.error(f"Failed to load image: {e}")
        return None

def test_liveness_detection_with_image(image_path: str, frame_index: int = 0):
    """Test liveness detection with a real image"""
    try:
        logger.info(f"Testing liveness detection with image: {image_path}")
        
        # Load image
        image_b64 = load_test_image(image_path)
        if not image_b64:
            logger.error("Failed to load test image")
            return False
        
        # Prepare request
        payload = {
            "base64": image_b64,
            "frame_index": frame_index,
            "timestamp": None
        }
        
        # Send request
        logger.info("Sending request to /detect_liveness endpoint...")
        response = requests.post(DETECT_LIVENESS_ENDPOINT, json=payload)
        
        # Check response
        if response.status_code != 200:
            logger.error(f"Request failed with status {response.status_code}")
            logger.error(f"Response: {response.text}")
            return False
        
        result = response.json()
        logger.info(f"✅ Response received:")
        logger.info(json.dumps(result, indent=2))
        
        # Verify response structure
        required_fields = ["face_detected", "liveness_score", "indicators", "pose", "guidance", "status"]
        for field in required_fields:
            if field not in result:
                logger.error(f"Missing required field: {field}")
                return False
        
        logger.info("✅ All required fields present")
        return True
        
    except Exception as e:
        logger.error(f"Test failed with error: {e}")
        return False

def test_liveness_detection_invalid_base64():
    """Test liveness detection with invalid base64"""
    try:
        logger.info("Testing liveness detection with invalid base64...")
        
        payload = {
            "base64": "invalid_base64_data",
            "frame_index": 0,
            "timestamp": None
        }
        
        response = requests.post(DETECT_LIVENESS_ENDPOINT, json=payload)
        
        if response.status_code != 200:
            logger.error(f"Request failed with status {response.status_code}")
            logger.error(f"Response: {response.text}")
            return False
        
        result = response.json()
        logger.info(f"Response: {json.dumps(result, indent=2)}")
        
        # Should return error or no_face status
        if result.get("status") in ["no_face", "error"] or "error" in result:
            logger.info("✅ Invalid base64 handled correctly")
            return True
        else:
            logger.error("Invalid base64 not handled correctly")
            return False
            
    except Exception as e:
        logger.error(f"Test failed with error: {e}")
        return False

def test_liveness_detection_missing_base64():
    """Test liveness detection with missing base64"""
    try:
        logger.info("Testing liveness detection with missing base64...")
        
        payload = {
            "frame_index": 0,
            "timestamp": None
        }
        
        response = requests.post(DETECT_LIVENESS_ENDPOINT, json=payload)
        
        if response.status_code == 400:
            logger.info("✅ Missing base64 handled correctly (400 Bad Request)")
            return True
        elif response.status_code == 422:
            logger.info("✅ Missing base64 handled correctly (422 Validation Error)")
            return True
        else:
            logger.error(f"Unexpected status code: {response.status_code}")
            return False
            
    except Exception as e:
        logger.error(f"Test failed with error: {e}")
        return False

if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("Liveness Detection Endpoint Tests")
    logger.info("=" * 60)
    
    # Test 1: Invalid base64
    logger.info("\n[Test 1] Invalid base64")
    test_liveness_detection_invalid_base64()
    
    # Test 2: Missing base64
    logger.info("\n[Test 2] Missing base64")
    test_liveness_detection_missing_base64()
    
    # Test 3: Real image (if available)
    test_image_path = "test_face.jpg"
    if Path(test_image_path).exists():
        logger.info(f"\n[Test 3] Real image: {test_image_path}")
        test_liveness_detection_with_image(test_image_path)
    else:
        logger.info(f"\n[Test 3] Skipped (test image not found: {test_image_path})")
    
    logger.info("\n" + "=" * 60)
    logger.info("Tests completed")
    logger.info("=" * 60)
