"""
Liveness Detection Components
Implements real-time liveness detection using facial landmarks and pose tracking.
"""

import numpy as np
import logging
from typing import Optional, Dict, List, Tuple, Any
from collections import deque

logger = logging.getLogger(__name__)


class EyeBlinkDetector:
    """
    Detects eye blinks by calculating Eye Aspect Ratio (EAR) from facial landmarks.
    
    EAR = (||p2 - p6|| + ||p3 - p5||) / (2 * ||p1 - p4||)
    where p1-p6 are eye landmark points.
    
    A blink is detected when EAR drops below threshold (0.2).
    """
    
    def __init__(self, threshold: float = 0.2, history_size: int = 5):
        """
        Initialize EyeBlinkDetector.
        
        Args:
            threshold: EAR threshold below which a blink is detected (default 0.2)
            history_size: Number of frames to track for blink detection
        """
        self.threshold = threshold
        self.history_size = history_size
        self.ear_history = deque(maxlen=history_size)
        self.blink_count = 0
        self.in_blink = False
        
    def calculate_eye_aspect_ratio(self, eye_landmarks: np.ndarray) -> float:
        """
        Calculate Eye Aspect Ratio (EAR) for a single eye.
        
        Args:
            eye_landmarks: 6 landmark points for one eye (shape: (6, 2))
            
        Returns:
            float: Eye Aspect Ratio value
        """
        try:
            # Vertical distances
            vertical1 = np.linalg.norm(eye_landmarks[1] - eye_landmarks[5])
            vertical2 = np.linalg.norm(eye_landmarks[2] - eye_landmarks[4])
            
            # Horizontal distance
            horizontal = np.linalg.norm(eye_landmarks[0] - eye_landmarks[3])
            
            # EAR formula
            if horizontal == 0:
                return 1.0
            
            ear = (vertical1 + vertical2) / (2.0 * horizontal)
            return ear
        except Exception as e:
            logger.error(f"Error calculating EAR: {e}")
            return 1.0
    
    def detect_blink(self, landmarks: np.ndarray) -> bool:
        """
        Detect if a blink occurred in the current frame.
        
        Args:
            landmarks: All 68 facial landmarks (shape: (68, 2))
            
        Returns:
            bool: True if blink detected in this frame
        """
        try:
            if landmarks is None or len(landmarks) < 48:
                return False
            
            # Left eye landmarks (points 36-41)
            left_eye = landmarks[36:42]
            # Right eye landmarks (points 42-47)
            right_eye = landmarks[42:48]
            
            # Calculate EAR for both eyes
            left_ear = self.calculate_eye_aspect_ratio(left_eye)
            right_ear = self.calculate_eye_aspect_ratio(right_eye)
            
            # Average EAR
            avg_ear = (left_ear + right_ear) / 2.0
            
            # Track EAR history
            self.ear_history.append(avg_ear)
            
            # Detect blink: transition from open (EAR > threshold) to closed (EAR < threshold)
            blink_detected = False
            if avg_ear < self.threshold and not self.in_blink:
                # Entering blink state
                self.in_blink = True
                blink_detected = True
                self.blink_count += 1
                logger.debug(f"Blink detected! Count: {self.blink_count}, EAR: {avg_ear:.3f}")
            elif avg_ear >= self.threshold and self.in_blink:
                # Exiting blink state
                self.in_blink = False
            
            return blink_detected
            
        except Exception as e:
            logger.error(f"Error in blink detection: {e}")
            return False
    
    def get_blink_count(self) -> int:
        """Get total number of blinks detected."""
        return self.blink_count
    
    def reset(self):
        """Reset blink counter and history."""
        self.blink_count = 0
        self.in_blink = False
        self.ear_history.clear()


class MouthMovementDetector:
    """
    Detects mouth movements (smile/open mouth) by calculating Mouth Aspect Ratio (MAR).
    
    MAR = (vertical_distance) / (horizontal_distance)
    
    A mouth movement is detected when MAR exceeds threshold (0.5).
    """
    
    def __init__(self, threshold: float = 0.5, history_size: int = 5):
        """
        Initialize MouthMovementDetector.
        
        Args:
            threshold: MAR threshold above which mouth movement is detected (default 0.5)
            history_size: Number of frames to track for movement detection
        """
        self.threshold = threshold
        self.history_size = history_size
        self.mar_history = deque(maxlen=history_size)
        self.mouth_movement_count = 0
        self.in_movement = False
        
    def calculate_mouth_aspect_ratio(self, mouth_landmarks: np.ndarray) -> float:
        """
        Calculate Mouth Aspect Ratio (MAR) for mouth movement detection.
        
        Args:
            mouth_landmarks: Mouth landmark points (shape: (20, 2))
            
        Returns:
            float: Mouth Aspect Ratio value
        """
        try:
            # Mouth landmarks (points 48-67)
            # Vertical distances (outer mouth)
            vertical_outer = np.linalg.norm(mouth_landmarks[2] - mouth_landmarks[10])
            vertical_inner = np.linalg.norm(mouth_landmarks[3] - mouth_landmarks[9])
            
            # Average vertical
            vertical = (vertical_outer + vertical_inner) / 2.0
            
            # Horizontal distance (mouth width)
            horizontal = np.linalg.norm(mouth_landmarks[0] - mouth_landmarks[6])
            
            # MAR formula
            if horizontal == 0:
                return 0.0
            
            mar = vertical / horizontal
            return mar
        except Exception as e:
            logger.error(f"Error calculating MAR: {e}")
            return 0.0
    
    def detect_mouth_movement(self, landmarks: np.ndarray) -> bool:
        """
        Detect if mouth movement (smile/open) occurred in the current frame.
        
        Args:
            landmarks: All 68 facial landmarks (shape: (68, 2))
            
        Returns:
            bool: True if mouth movement detected in this frame
        """
        try:
            if landmarks is None or len(landmarks) < 68:
                return False
            
            # Mouth landmarks (points 48-67)
            mouth = landmarks[48:68]
            
            # Calculate MAR
            mar = self.calculate_mouth_aspect_ratio(mouth)
            
            # Track MAR history
            self.mar_history.append(mar)
            
            # Detect mouth movement: transition from closed (MAR < threshold) to open (MAR > threshold)
            movement_detected = False
            if mar > self.threshold and not self.in_movement:
                # Entering movement state
                self.in_movement = True
                movement_detected = True
                self.mouth_movement_count += 1
                logger.debug(f"Mouth movement detected! Count: {self.mouth_movement_count}, MAR: {mar:.3f}")
            elif mar <= self.threshold and self.in_movement:
                # Exiting movement state
                self.in_movement = False
            
            return movement_detected
            
        except Exception as e:
            logger.error(f"Error in mouth movement detection: {e}")
            return False
    
    def get_mouth_movement_count(self) -> int:
        """Get total number of mouth movements detected."""
        return self.mouth_movement_count
    
    def reset(self):
        """Reset mouth movement counter and history."""
        self.mouth_movement_count = 0
        self.in_movement = False
        self.mar_history.clear()


class HeadMovementTracker:
    """
    Tracks head movements by monitoring pose angles (yaw, pitch, roll) across frames.
    
    Detects significant head movement when angle change exceeds threshold (> 5 degrees).
    """
    
    def __init__(self, movement_threshold: float = 5.0, history_size: int = 10):
        """
        Initialize HeadMovementTracker.
        
        Args:
            movement_threshold: Minimum angle change (degrees) to detect movement (default 5.0)
            history_size: Number of frames to track for movement detection
        """
        self.movement_threshold = movement_threshold
        self.history_size = history_size
        self.pose_history = deque(maxlen=history_size)
        self.head_movement_count = 0
        self.last_significant_pose = None
        
    def track_head_movement(self, yaw: float, pitch: float, roll: float) -> bool:
        """
        Track head movement by comparing current pose with previous frames.
        
        Args:
            yaw: Head yaw angle (degrees)
            pitch: Head pitch angle (degrees)
            roll: Head roll angle (degrees)
            
        Returns:
            bool: True if significant head movement detected in this frame
        """
        try:
            current_pose = np.array([yaw, pitch, roll])
            self.pose_history.append(current_pose)
            
            # Need at least 2 frames to detect movement
            if len(self.pose_history) < 2:
                self.last_significant_pose = current_pose
                return False
            
            # Compare with last significant pose
            if self.last_significant_pose is None:
                self.last_significant_pose = current_pose
                return False
            
            # Calculate angle differences
            angle_diff = np.abs(current_pose - self.last_significant_pose)
            max_diff = np.max(angle_diff)
            
            # Detect significant movement
            movement_detected = max_diff > self.movement_threshold
            
            if movement_detected:
                self.head_movement_count += 1
                self.last_significant_pose = current_pose
                logger.debug(f"Head movement detected! Count: {self.head_movement_count}, "
                           f"Max angle diff: {max_diff:.1f}° (yaw: {angle_diff[0]:.1f}°, "
                           f"pitch: {angle_diff[1]:.1f}°, roll: {angle_diff[2]:.1f}°)")
            
            return movement_detected
            
        except Exception as e:
            logger.error(f"Error in head movement tracking: {e}")
            return False
    
    def get_head_movement_count(self) -> int:
        """Get total number of head movements detected."""
        return self.head_movement_count
    
    def reset(self):
        """Reset head movement counter and history."""
        self.head_movement_count = 0
        self.last_significant_pose = None
        self.pose_history.clear()


class LivenessScoreCalculator:
    """
    Calculates overall liveness score by combining multiple indicators.
    
    Combines: blink_count, mouth_movement_count, head_movement_count
    with configurable weights (default: blink 0.4, mouth 0.3, head_movement 0.3)
    
    Applies threshold 0.6 for liveness verification.
    """
    
    def __init__(
        self,
        blink_weight: float = 0.4,
        mouth_weight: float = 0.3,
        head_movement_weight: float = 0.3,
        threshold: float = 0.6,
        max_indicators: int = 10
    ):
        """
        Initialize LivenessScoreCalculator.
        
        Args:
            blink_weight: Weight for blink indicator (default 0.4)
            mouth_weight: Weight for mouth movement indicator (default 0.3)
            head_movement_weight: Weight for head movement indicator (default 0.3)
            threshold: Liveness score threshold for verification (default 0.6)
            max_indicators: Maximum count for each indicator to normalize (default 10)
        """
        # Validate weights sum to 1.0
        total_weight = blink_weight + mouth_weight + head_movement_weight
        if abs(total_weight - 1.0) > 0.01:
            logger.warning(f"Weights don't sum to 1.0: {total_weight}. Normalizing...")
            blink_weight /= total_weight
            mouth_weight /= total_weight
            head_movement_weight /= total_weight
        
        self.blink_weight = blink_weight
        self.mouth_weight = mouth_weight
        self.head_movement_weight = head_movement_weight
        self.threshold = threshold
        self.max_indicators = max_indicators
        
    def calculate_liveness_score(
        self,
        blink_count: int,
        mouth_movement_count: int,
        head_movement_count: int
    ) -> float:
        """
        Calculate overall liveness score from indicators.
        
        Args:
            blink_count: Number of blinks detected
            mouth_movement_count: Number of mouth movements detected
            head_movement_count: Number of head movements detected
            
        Returns:
            float: Liveness score (0-1)
        """
        try:
            # Normalize counts to 0-1 range
            # Using sigmoid-like normalization: count / (count + max_indicators)
            blink_score = min(1.0, blink_count / self.max_indicators)
            mouth_score = min(1.0, mouth_movement_count / self.max_indicators)
            head_score = min(1.0, head_movement_count / self.max_indicators)
            
            # Calculate weighted score
            liveness_score = (
                self.blink_weight * blink_score +
                self.mouth_weight * mouth_score +
                self.head_movement_weight * head_score
            )
            
            # Clamp to 0-1 range
            liveness_score = np.clip(liveness_score, 0.0, 1.0)
            
            logger.debug(f"Liveness score calculation: "
                       f"blink({blink_count})={blink_score:.3f}*{self.blink_weight} + "
                       f"mouth({mouth_movement_count})={mouth_score:.3f}*{self.mouth_weight} + "
                       f"head({head_movement_count})={head_score:.3f}*{self.head_movement_weight} = "
                       f"{liveness_score:.3f}")
            
            return liveness_score
            
        except Exception as e:
            logger.error(f"Error calculating liveness score: {e}")
            return 0.0
    
    def is_liveness_verified(self, liveness_score: float) -> bool:
        """
        Check if liveness score meets verification threshold.
        
        Args:
            liveness_score: Calculated liveness score (0-1)
            
        Returns:
            bool: True if score >= threshold
        """
        return liveness_score >= self.threshold
    
    def get_guidance_message(self, liveness_score: float) -> str:
        """
        Get guidance message based on liveness score.
        
        Args:
            liveness_score: Calculated liveness score (0-1)
            
        Returns:
            str: Guidance message in Vietnamese
        """
        if liveness_score >= self.threshold:
            return "Tuyệt vời! Bây giờ vui lòng nhìn thẳng vào camera để chụp ảnh"
        elif liveness_score >= 0.3:
            return "Vui lòng nhắm mắt hoặc cười để xác minh bạn là người sống"
        else:
            return "Vui lòng nhắm mắt hoặc cười để xác minh bạn là người sống"



class FrontalFaceValidator:
    """
    Validates if a face is frontal by checking pose angles.
    
    Verifies:
    - yaw within ±15 degrees
    - pitch within ±15 degrees
    - roll within ±10 degrees
    """
    
    def __init__(
        self,
        yaw_tolerance: float = 15.0,
        pitch_tolerance: float = 15.0,
        roll_tolerance: float = 10.0
    ):
        """
        Initialize FrontalFaceValidator.
        
        Args:
            yaw_tolerance: Maximum allowed yaw angle (degrees, default 15.0)
            pitch_tolerance: Maximum allowed pitch angle (degrees, default 15.0)
            roll_tolerance: Maximum allowed roll angle (degrees, default 10.0)
        """
        self.yaw_tolerance = yaw_tolerance
        self.pitch_tolerance = pitch_tolerance
        self.roll_tolerance = roll_tolerance
    
    def validate_frontal_face(
        self,
        yaw: float,
        pitch: float,
        roll: float
    ) -> Tuple[bool, Dict[str, any]]:
        """
        Validate if face is frontal based on pose angles.
        
        Args:
            yaw: Head yaw angle (degrees)
            pitch: Head pitch angle (degrees)
            roll: Head roll angle (degrees)
            
        Returns:
            Tuple of (is_frontal: bool, details: dict)
        """
        try:
            is_frontal = True
            errors = []
            
            # Check yaw
            if abs(yaw) > self.yaw_tolerance:
                is_frontal = False
                direction = "left" if yaw > 0 else "right"
                errors.append(f"Quay mặt sang {direction} quá nhiều (yaw: {yaw:.1f}°)")
            
            # Check pitch
            if abs(pitch) > self.pitch_tolerance:
                is_frontal = False
                direction = "lên" if pitch > 0 else "xuống"
                errors.append(f"Ngửa/Cúi mặt {direction} quá nhiều (pitch: {pitch:.1f}°)")
            
            # Check roll
            if abs(roll) > self.roll_tolerance:
                is_frontal = False
                direction = "phải" if roll > 0 else "trái"
                errors.append(f"Nghiêng mặt sang {direction} quá nhiều (roll: {roll:.1f}°)")
            
            details = {
                "is_frontal": is_frontal,
                "yaw": yaw,
                "pitch": pitch,
                "roll": roll,
                "yaw_valid": abs(yaw) <= self.yaw_tolerance,
                "pitch_valid": abs(pitch) <= self.pitch_tolerance,
                "roll_valid": abs(roll) <= self.roll_tolerance,
                "errors": errors,
                "message": "Khuôn mặt thẳng. Sẵn sàng chụp ảnh." if is_frontal else " | ".join(errors)
            }
            
            logger.debug(f"Frontal face validation: is_frontal={is_frontal}, "
                       f"yaw={yaw:.1f}°, pitch={pitch:.1f}°, roll={roll:.1f}°")
            
            return is_frontal, details
            
        except Exception as e:
            logger.error(f"Error in frontal face validation: {e}")
            return False, {
                "is_frontal": False,
                "yaw": yaw,
                "pitch": pitch,
                "roll": roll,
                "errors": [str(e)],
                "message": f"Lỗi xác thực khuôn mặt: {str(e)}"
            }


class LivenessAnalyzer:
    """
    Comprehensive liveness detection analyzer.
    
    Combines multiple indicators (blink, mouth movement, head movement)
    to calculate overall liveness score and provide guidance.
    """
    
    def __init__(
        self,
        blink_weight: float = 0.4,
        mouth_weight: float = 0.3,
        head_movement_weight: float = 0.3,
        threshold: float = 0.6,
        max_indicators: int = 10
    ):
        """
        Initialize LivenessAnalyzer.
        
        Args:
            blink_weight: Weight for blink indicator (default 0.4)
            mouth_weight: Weight for mouth movement indicator (default 0.3)
            head_movement_weight: Weight for head movement indicator (default 0.3)
            threshold: Liveness score threshold for verification (default 0.6)
            max_indicators: Maximum count for each indicator to normalize (default 10)
        """
        self.blink_detector = EyeBlinkDetector()
        self.mouth_detector = MouthMovementDetector()
        self.head_tracker = HeadMovementTracker()
        self.score_calculator = LivenessScoreCalculator(
            blink_weight=blink_weight,
            mouth_weight=mouth_weight,
            head_movement_weight=head_movement_weight,
            threshold=threshold,
            max_indicators=max_indicators
        )
        self.frontal_validator = FrontalFaceValidator()
    
    def analyze_frame(
        self,
        landmarks: Optional[np.ndarray],
        yaw: float,
        pitch: float,
        roll: float
    ) -> Dict[str, any]:
        """
        Analyze a single frame for liveness indicators.
        
        Args:
            landmarks: Facial landmarks (68 points, shape: (68, 2))
            yaw: Head yaw angle (degrees)
            pitch: Head pitch angle (degrees)
            roll: Head roll angle (degrees)
            
        Returns:
            dict: Analysis results with indicators and current liveness score
        """
        try:
            result = {
                "face_detected": landmarks is not None,
                "indicators": {
                    "blink_detected": False,
                    "blink_count": 0,
                    "mouth_movement_detected": False,
                    "mouth_movement_count": 0,
                    "head_movement_detected": False,
                    "head_movement_count": 0
                },
                "pose": {
                    "yaw": yaw,
                    "pitch": pitch,
                    "roll": roll
                },
                "liveness_score": 0.0,
                "status": "no_face"
            }
            
            if landmarks is None:
                result["guidance"] = "Không tìm thấy khuôn mặt. Vui lòng nhìn vào camera."
                return result
            
            # Detect blink
            blink_detected = self.blink_detector.detect_blink(landmarks)
            result["indicators"]["blink_detected"] = blink_detected
            result["indicators"]["blink_count"] = self.blink_detector.get_blink_count()
            
            # Detect mouth movement
            mouth_detected = self.mouth_detector.detect_mouth_movement(landmarks)
            result["indicators"]["mouth_movement_detected"] = mouth_detected
            result["indicators"]["mouth_movement_count"] = self.mouth_detector.get_mouth_movement_count()
            
            # Track head movement
            head_detected = self.head_tracker.track_head_movement(yaw, pitch, roll)
            result["indicators"]["head_movement_detected"] = head_detected
            result["indicators"]["head_movement_count"] = self.head_tracker.get_head_movement_count()
            
            # Calculate liveness score
            liveness_score = self.score_calculator.calculate_liveness_score(
                blink_count=result["indicators"]["blink_count"],
                mouth_movement_count=result["indicators"]["mouth_movement_count"],
                head_movement_count=result["indicators"]["head_movement_count"]
            )
            result["liveness_score"] = liveness_score
            
            # Determine status
            if self.score_calculator.is_liveness_verified(liveness_score):
                result["status"] = "liveness_verified"
            else:
                result["status"] = "no_liveness"
            
            # Get guidance message
            result["guidance"] = self.score_calculator.get_guidance_message(liveness_score)
            
            logger.debug(f"Frame analysis: score={liveness_score:.3f}, status={result['status']}, "
                       f"blink={result['indicators']['blink_count']}, "
                       f"mouth={result['indicators']['mouth_movement_count']}, "
                       f"head={result['indicators']['head_movement_count']}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error analyzing frame: {e}")
            return {
                "face_detected": False,
                "indicators": {
                    "blink_detected": False,
                    "blink_count": 0,
                    "mouth_movement_detected": False,
                    "mouth_movement_count": 0,
                    "head_movement_detected": False,
                    "head_movement_count": 0
                },
                "pose": {"yaw": 0, "pitch": 0, "roll": 0},
                "liveness_score": 0.0,
                "status": "error",
                "guidance": f"Lỗi phân tích: {str(e)}"
            }
    
    def reset(self):
        """Reset all detectors for a new liveness detection session."""
        self.blink_detector.reset()
        self.mouth_detector.reset()
        self.head_tracker.reset()
        logger.debug("LivenessAnalyzer reset for new session")
