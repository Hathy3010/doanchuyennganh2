"""
Anti-Fraud Logging Module
Logs liveness detection attempts and capture attempts for audit trail and fraud detection.

Requirements: 9.3, 9.4
"""

import logging
import json
from datetime import datetime
from typing import Optional, Dict, Any, List
from enum import Enum
from motor.motor_asyncio import AsyncIOMotorCollection
from bson import ObjectId

logger = logging.getLogger("anti_fraud")


class LivenessLogEntry:
    """Represents a single liveness detection attempt log entry."""
    
    def __init__(
        self,
        frame_index: Optional[int] = None,
        timestamp: Optional[float] = None,
        liveness_score: float = 0.0,
        indicators: Optional[Dict[str, Any]] = None,
        guidance_message: str = "",
        status: str = "no_liveness",
        pose: Optional[Dict[str, float]] = None,
        face_detected: bool = False,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None
    ):
        """
        Initialize a liveness log entry.
        
        Args:
            frame_index: Frame index in the sequence
            timestamp: Frame timestamp (seconds since epoch)
            liveness_score: Calculated liveness score (0-1)
            indicators: Dict with blink_count, mouth_movement_count, head_movement_count
            guidance_message: Guidance message shown to user
            status: Status (no_face, no_liveness, liveness_verified)
            pose: Dict with yaw, pitch, roll angles
            face_detected: Whether face was detected
            user_id: User ID (if available)
            session_id: Session ID for tracking multiple frames
        """
        self.frame_index = frame_index
        self.timestamp = timestamp or datetime.utcnow().timestamp()
        self.liveness_score = liveness_score
        self.indicators = indicators or {
            "blink_count": 0,
            "mouth_movement_count": 0,
            "head_movement_count": 0
        }
        self.guidance_message = guidance_message
        self.status = status
        self.pose = pose or {"yaw": 0, "pitch": 0, "roll": 0}
        self.face_detected = face_detected
        self.user_id = user_id
        self.session_id = session_id
        self.logged_at = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert log entry to dictionary for storage."""
        return {
            "frame_index": self.frame_index,
            "timestamp": self.timestamp,
            "liveness_score": self.liveness_score,
            "indicators": self.indicators,
            "guidance_message": self.guidance_message,
            "status": self.status,
            "pose": self.pose,
            "face_detected": self.face_detected,
            "user_id": self.user_id,
            "session_id": self.session_id,
            "logged_at": self.logged_at
        }


class CaptureLogEntry:
    """Represents a single capture attempt log entry."""
    
    def __init__(
        self,
        liveness_verified: bool = False,
        liveness_score: Optional[float] = None,
        frontal_face_valid: bool = False,
        pose: Optional[Dict[str, float]] = None,
        capture_success: bool = False,
        error_message: Optional[str] = None,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        class_id: Optional[str] = None
    ):
        """
        Initialize a capture log entry.
        
        Args:
            liveness_verified: Whether liveness was verified before capture
            liveness_score: Final liveness score
            frontal_face_valid: Whether face was frontal
            pose: Dict with yaw, pitch, roll angles
            capture_success: Whether capture was successful
            error_message: Error message if capture failed
            user_id: User ID
            session_id: Session ID
            class_id: Class ID (if applicable)
        """
        self.liveness_verified = liveness_verified
        self.liveness_score = liveness_score
        self.frontal_face_valid = frontal_face_valid
        self.pose = pose or {"yaw": 0, "pitch": 0, "roll": 0}
        self.capture_success = capture_success
        self.error_message = error_message
        self.user_id = user_id
        self.session_id = session_id
        self.class_id = class_id
        self.logged_at = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert log entry to dictionary for storage."""
        return {
            "liveness_verified": self.liveness_verified,
            "liveness_score": self.liveness_score,
            "frontal_face_valid": self.frontal_face_valid,
            "pose": self.pose,
            "capture_success": self.capture_success,
            "error_message": self.error_message,
            "user_id": self.user_id,
            "session_id": self.session_id,
            "class_id": self.class_id,
            "logged_at": self.logged_at
        }


class AntiFraudLogger:
    """
    Logs liveness detection and capture attempts for audit trail and fraud detection.
    
    Requirements: 9.3, 9.4
    """
    
    def __init__(self, collection: Optional[AsyncIOMotorCollection] = None):
        """
        Initialize AntiFraudLogger.
        
        Args:
            collection: MongoDB collection for storing logs (optional)
        """
        self.collection = collection
        self.local_logs: List[Dict[str, Any]] = []
    
    async def log_liveness_detection(
        self,
        frame_index: Optional[int] = None,
        timestamp: Optional[float] = None,
        liveness_score: float = 0.0,
        indicators: Optional[Dict[str, Any]] = None,
        guidance_message: str = "",
        status: str = "no_liveness",
        pose: Optional[Dict[str, float]] = None,
        face_detected: bool = False,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> bool:
        """
        Log a liveness detection attempt.
        
        Requirements: 9.3
        
        Args:
            frame_index: Frame index in the sequence
            timestamp: Frame timestamp
            liveness_score: Calculated liveness score (0-1)
            indicators: Dict with blink_count, mouth_movement_count, head_movement_count
            guidance_message: Guidance message shown to user
            status: Status (no_face, no_liveness, liveness_verified)
            pose: Dict with yaw, pitch, roll angles
            face_detected: Whether face was detected
            user_id: User ID (if available)
            session_id: Session ID for tracking multiple frames
            
        Returns:
            bool: True if logging was successful
        """
        try:
            entry = LivenessLogEntry(
                frame_index=frame_index,
                timestamp=timestamp,
                liveness_score=liveness_score,
                indicators=indicators,
                guidance_message=guidance_message,
                status=status,
                pose=pose,
                face_detected=face_detected,
                user_id=user_id,
                session_id=session_id
            )
            
            entry_dict = entry.to_dict()
            
            # Log to console
            logger.info(
                f"📊 Liveness Detection Log - "
                f"frame_index={frame_index}, "
                f"score={liveness_score:.3f}, "
                f"status={status}, "
                f"blink={indicators.get('blink_count', 0) if indicators else 0}, "
                f"mouth={indicators.get('mouth_movement_count', 0) if indicators else 0}, "
                f"head={indicators.get('head_movement_count', 0) if indicators else 0}"
            )
            
            # Store locally
            self.local_logs.append(entry_dict)
            
            # Store in MongoDB if collection is available
            if self.collection:
                try:
                    result = await self.collection.insert_one(entry_dict)
                    logger.debug(f"✅ Liveness log stored in MongoDB: {result.inserted_id}")
                except Exception as e:
                    logger.error(f"Failed to store liveness log in MongoDB: {e}")
                    # Continue even if MongoDB fails - local log is still available
            
            return True
            
        except Exception as e:
            logger.error(f"Error logging liveness detection: {e}")
            return False
    
    async def log_capture_attempt(
        self,
        liveness_verified: bool = False,
        liveness_score: Optional[float] = None,
        frontal_face_valid: bool = False,
        pose: Optional[Dict[str, float]] = None,
        capture_success: bool = False,
        error_message: Optional[str] = None,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        class_id: Optional[str] = None
    ) -> bool:
        """
        Log a capture attempt.
        
        Requirements: 9.4
        
        Args:
            liveness_verified: Whether liveness was verified before capture
            liveness_score: Final liveness score
            frontal_face_valid: Whether face was frontal
            pose: Dict with yaw, pitch, roll angles
            capture_success: Whether capture was successful
            error_message: Error message if capture failed
            user_id: User ID
            session_id: Session ID
            class_id: Class ID (if applicable)
            
        Returns:
            bool: True if logging was successful
        """
        try:
            entry = CaptureLogEntry(
                liveness_verified=liveness_verified,
                liveness_score=liveness_score,
                frontal_face_valid=frontal_face_valid,
                pose=pose,
                capture_success=capture_success,
                error_message=error_message,
                user_id=user_id,
                session_id=session_id,
                class_id=class_id
            )
            
            entry_dict = entry.to_dict()
            
            # Log to console
            status_str = "✅ SUCCESS" if capture_success else "❌ FAILED"
            logger.info(
                f"📸 Capture Attempt Log - {status_str} - "
                f"liveness_verified={liveness_verified}, "
                f"frontal_valid={frontal_face_valid}, "
                f"score={liveness_score}, "
                f"error={error_message}"
            )
            
            # Store locally
            self.local_logs.append(entry_dict)
            
            # Store in MongoDB if collection is available
            if self.collection:
                try:
                    result = await self.collection.insert_one(entry_dict)
                    logger.debug(f"✅ Capture log stored in MongoDB: {result.inserted_id}")
                except Exception as e:
                    logger.error(f"Failed to store capture log in MongoDB: {e}")
                    # Continue even if MongoDB fails - local log is still available
            
            return True
            
        except Exception as e:
            logger.error(f"Error logging capture attempt: {e}")
            return False
    
    def get_local_logs(self) -> List[Dict[str, Any]]:
        """Get all locally stored logs."""
        return self.local_logs.copy()
    
    def clear_local_logs(self):
        """Clear all locally stored logs."""
        self.local_logs.clear()
        logger.debug("Local logs cleared")
    
    async def get_user_liveness_logs(
        self,
        user_id: str,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get liveness logs for a specific user.
        
        Args:
            user_id: User ID
            limit: Maximum number of logs to retrieve
            
        Returns:
            List of liveness log entries
        """
        if not self.collection:
            logger.warning("MongoDB collection not available for querying")
            return []
        
        try:
            logs = []
            async for log in self.collection.find(
                {"user_id": user_id, "frame_index": {"$exists": True}}
            ).limit(limit).sort("logged_at", -1):
                log["_id"] = str(log["_id"])
                logs.append(log)
            
            logger.debug(f"Retrieved {len(logs)} liveness logs for user {user_id}")
            return logs
            
        except Exception as e:
            logger.error(f"Error retrieving liveness logs: {e}")
            return []
    
    async def get_user_capture_logs(
        self,
        user_id: str,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get capture logs for a specific user.
        
        Args:
            user_id: User ID
            limit: Maximum number of logs to retrieve
            
        Returns:
            List of capture log entries
        """
        if not self.collection:
            logger.warning("MongoDB collection not available for querying")
            return []
        
        try:
            logs = []
            async for log in self.collection.find(
                {"user_id": user_id, "capture_success": {"$exists": True}}
            ).limit(limit).sort("logged_at", -1):
                log["_id"] = str(log["_id"])
                logs.append(log)
            
            logger.debug(f"Retrieved {len(logs)} capture logs for user {user_id}")
            return logs
            
        except Exception as e:
            logger.error(f"Error retrieving capture logs: {e}")
            return []
    
    async def detect_suspicious_activity(
        self,
        user_id: str,
        threshold: int = 5
    ) -> Dict[str, Any]:
        """
        Detect suspicious activity for a user.
        
        Flags as suspicious if:
        - Multiple failed liveness attempts (> threshold)
        - Multiple failed capture attempts (> threshold)
        - Repeated attempts without indicators
        
        Args:
            user_id: User ID
            threshold: Number of failed attempts to flag as suspicious
            
        Returns:
            Dict with suspicious activity details
        """
        try:
            if not self.collection:
                return {"is_suspicious": False, "reason": "No collection available"}
            
            # Get recent liveness logs
            liveness_logs = await self.get_user_liveness_logs(user_id, limit=50)
            
            # Count failed liveness attempts
            failed_liveness = sum(
                1 for log in liveness_logs
                if log.get("status") == "no_liveness"
            )
            
            # Get recent capture logs
            capture_logs = await self.get_user_capture_logs(user_id, limit=50)
            
            # Count failed capture attempts
            failed_captures = sum(
                1 for log in capture_logs
                if not log.get("capture_success", False)
            )
            
            # Check for repeated attempts without indicators
            no_indicators = sum(
                1 for log in liveness_logs
                if log.get("indicators", {}).get("blink_count", 0) == 0 and
                   log.get("indicators", {}).get("mouth_movement_count", 0) == 0 and
                   log.get("indicators", {}).get("head_movement_count", 0) == 0
            )
            
            is_suspicious = (
                failed_liveness > threshold or
                failed_captures > threshold or
                no_indicators > threshold
            )
            
            reason = ""
            if failed_liveness > threshold:
                reason += f"Failed liveness attempts: {failed_liveness}. "
            if failed_captures > threshold:
                reason += f"Failed capture attempts: {failed_captures}. "
            if no_indicators > threshold:
                reason += f"Attempts without indicators: {no_indicators}. "
            
            logger.info(
                f"🚨 Suspicious Activity Check - user={user_id}, "
                f"is_suspicious={is_suspicious}, "
                f"failed_liveness={failed_liveness}, "
                f"failed_captures={failed_captures}, "
                f"no_indicators={no_indicators}"
            )
            
            return {
                "is_suspicious": is_suspicious,
                "reason": reason.strip() if reason else "No suspicious activity detected",
                "failed_liveness_attempts": failed_liveness,
                "failed_capture_attempts": failed_captures,
                "attempts_without_indicators": no_indicators
            }
            
        except Exception as e:
            logger.error(f"Error detecting suspicious activity: {e}")
            return {
                "is_suspicious": False,
                "reason": f"Error during detection: {str(e)}"
            }
