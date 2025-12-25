"""
Test script for anti-fraud logging functionality
Tests the AntiFraudLogger class for liveness detection and capture logging
"""

import asyncio
import logging
from datetime import datetime
from anti_fraud_logging import AntiFraudLogger, LivenessLogEntry, CaptureLogEntry

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_liveness_logging():
    """Test liveness detection logging"""
    logger.info("=" * 60)
    logger.info("Testing Liveness Detection Logging")
    logger.info("=" * 60)
    
    # Create logger without MongoDB (local logging only)
    anti_fraud_logger = AntiFraudLogger(collection=None)
    
    # Test 1: Log successful liveness detection
    logger.info("\n[Test 1] Log successful liveness detection")
    success = await anti_fraud_logger.log_liveness_detection(
        frame_index=1,
        timestamp=datetime.utcnow().timestamp(),
        liveness_score=0.85,
        indicators={
            "blink_count": 2,
            "mouth_movement_count": 1,
            "head_movement_count": 3
        },
        guidance_message="Tuyệt vời! Bây giờ nhìn thẳng vào camera để chụp ảnh",
        status="liveness_verified",
        pose={"yaw": 5.2, "pitch": -3.1, "roll": 1.5},
        face_detected=True,
        user_id="user123",
        session_id="session456"
    )
    assert success, "Failed to log liveness detection"
    logger.info("✅ Liveness detection logged successfully")
    
    # Test 2: Log failed liveness detection (no face)
    logger.info("\n[Test 2] Log failed liveness detection (no face)")
    success = await anti_fraud_logger.log_liveness_detection(
        frame_index=2,
        timestamp=datetime.utcnow().timestamp(),
        liveness_score=0.0,
        indicators={
            "blink_count": 0,
            "mouth_movement_count": 0,
            "head_movement_count": 0
        },
        guidance_message="Không tìm thấy khuôn mặt. Vui lòng nhìn vào camera.",
        status="no_face",
        pose={"yaw": 0, "pitch": 0, "roll": 0},
        face_detected=False,
        user_id="user123",
        session_id="session456"
    )
    assert success, "Failed to log failed liveness detection"
    logger.info("✅ Failed liveness detection logged successfully")
    
    # Test 3: Log liveness detection without indicators
    logger.info("\n[Test 3] Log liveness detection without indicators")
    success = await anti_fraud_logger.log_liveness_detection(
        frame_index=3,
        timestamp=datetime.utcnow().timestamp(),
        liveness_score=0.2,
        indicators={
            "blink_count": 0,
            "mouth_movement_count": 0,
            "head_movement_count": 0
        },
        guidance_message="Vui lòng nhắm mắt hoặc cười để xác minh bạn là người sống",
        status="no_liveness",
        pose={"yaw": 2.1, "pitch": -1.5, "roll": 0.8},
        face_detected=True,
        user_id="user123",
        session_id="session456"
    )
    assert success, "Failed to log liveness detection without indicators"
    logger.info("✅ Liveness detection without indicators logged successfully")
    
    # Verify local logs
    local_logs = anti_fraud_logger.get_local_logs()
    logger.info(f"\n📊 Total local logs: {len(local_logs)}")
    assert len(local_logs) == 3, f"Expected 3 logs, got {len(local_logs)}"
    logger.info("✅ All liveness logs stored locally")


async def test_capture_logging():
    """Test capture attempt logging"""
    logger.info("\n" + "=" * 60)
    logger.info("Testing Capture Attempt Logging")
    logger.info("=" * 60)
    
    # Create logger without MongoDB (local logging only)
    anti_fraud_logger = AntiFraudLogger(collection=None)
    
    # Test 1: Log successful capture
    logger.info("\n[Test 1] Log successful capture")
    success = await anti_fraud_logger.log_capture_attempt(
        liveness_verified=True,
        liveness_score=0.85,
        frontal_face_valid=True,
        pose={"yaw": 2.1, "pitch": -1.5, "roll": 0.8},
        capture_success=True,
        error_message=None,
        user_id="user123",
        session_id="session456",
        class_id="class789"
    )
    assert success, "Failed to log successful capture"
    logger.info("✅ Successful capture logged successfully")
    
    # Test 2: Log failed capture (liveness not verified)
    logger.info("\n[Test 2] Log failed capture (liveness not verified)")
    success = await anti_fraud_logger.log_capture_attempt(
        liveness_verified=False,
        liveness_score=0.2,
        frontal_face_valid=False,
        pose={"yaw": 0, "pitch": 0, "roll": 0},
        capture_success=False,
        error_message="Liveness not verified",
        user_id="user123",
        session_id="session456",
        class_id="class789"
    )
    assert success, "Failed to log failed capture"
    logger.info("✅ Failed capture logged successfully")
    
    # Test 3: Log failed capture (face not frontal)
    logger.info("\n[Test 3] Log failed capture (face not frontal)")
    success = await anti_fraud_logger.log_capture_attempt(
        liveness_verified=True,
        liveness_score=0.85,
        frontal_face_valid=False,
        pose={"yaw": 25.5, "pitch": 18.2, "roll": 12.1},
        capture_success=False,
        error_message="Face not frontal: yaw=25.5°, pitch=18.2°, roll=12.1°",
        user_id="user123",
        session_id="session456",
        class_id="class789"
    )
    assert success, "Failed to log failed capture"
    logger.info("✅ Failed capture (not frontal) logged successfully")
    
    # Verify local logs
    local_logs = anti_fraud_logger.get_local_logs()
    logger.info(f"\n📊 Total local logs: {len(local_logs)}")
    assert len(local_logs) == 3, f"Expected 3 logs, got {len(local_logs)}"
    logger.info("✅ All capture logs stored locally")


async def test_log_entry_classes():
    """Test LivenessLogEntry and CaptureLogEntry classes"""
    logger.info("\n" + "=" * 60)
    logger.info("Testing Log Entry Classes")
    logger.info("=" * 60)
    
    # Test LivenessLogEntry
    logger.info("\n[Test 1] LivenessLogEntry")
    entry = LivenessLogEntry(
        frame_index=1,
        timestamp=datetime.utcnow().timestamp(),
        liveness_score=0.75,
        indicators={"blink_count": 2, "mouth_movement_count": 1, "head_movement_count": 3},
        guidance_message="Test message",
        status="liveness_verified",
        pose={"yaw": 5.0, "pitch": -3.0, "roll": 1.0},
        face_detected=True,
        user_id="user123",
        session_id="session456"
    )
    
    entry_dict = entry.to_dict()
    assert entry_dict["frame_index"] == 1
    assert entry_dict["liveness_score"] == 0.75
    assert entry_dict["status"] == "liveness_verified"
    logger.info("✅ LivenessLogEntry created and converted to dict successfully")
    
    # Test CaptureLogEntry
    logger.info("\n[Test 2] CaptureLogEntry")
    entry = CaptureLogEntry(
        liveness_verified=True,
        liveness_score=0.85,
        frontal_face_valid=True,
        pose={"yaw": 2.0, "pitch": -1.5, "roll": 0.8},
        capture_success=True,
        error_message=None,
        user_id="user123",
        session_id="session456",
        class_id="class789"
    )
    
    entry_dict = entry.to_dict()
    assert entry_dict["liveness_verified"] == True
    assert entry_dict["capture_success"] == True
    assert entry_dict["error_message"] is None
    logger.info("✅ CaptureLogEntry created and converted to dict successfully")


async def main():
    """Run all tests"""
    try:
        await test_liveness_logging()
        await test_capture_logging()
        await test_log_entry_classes()
        
        logger.info("\n" + "=" * 60)
        logger.info("✅ All tests passed!")
        logger.info("=" * 60)
        
    except AssertionError as e:
        logger.error(f"\n❌ Test failed: {e}")
        return False
    except Exception as e:
        logger.error(f"\n❌ Unexpected error: {e}", exc_info=True)
        return False
    
    return True


if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)
