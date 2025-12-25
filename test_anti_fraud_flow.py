#!/usr/bin/env python3
"""
Test Anti-Fraud System - 3-Layer Protection
Tests all endpoints and flows for attendance check-in with anti-fraud measures
"""

import requests
import json
import base64
import cv2
import numpy as np
from pathlib import Path
from datetime import datetime

# Configuration
API_URL = "http://localhost:8002"
TEST_USERNAME = "student1"
TEST_PASSWORD = "password123"

# Test data
TEST_IMAGE_PATH = "test_image.jpg"  # Will use a sample image if available

class AntifraudTester:
    def __init__(self, api_url=API_URL):
        self.api_url = api_url
        self.token = None
        self.user_id = None
        self.class_id = None
        
    def log(self, message: str, level: str = "INFO"):
        """Log with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        prefix = {
            "INFO": "ℹ️",
            "SUCCESS": "✅",
            "ERROR": "❌",
            "WARNING": "⚠️",
            "TEST": "🧪"
        }.get(level, "•")
        print(f"[{timestamp}] {prefix} {message}")
    
    def login(self) -> bool:
        """Login and get token"""
        self.log("Logging in...", "TEST")
        try:
            response = requests.post(
                f"{self.api_url}/auth/login",
                json={"username": TEST_USERNAME, "password": TEST_PASSWORD}
            )
            
            if response.status_code != 200:
                self.log(f"Login failed: {response.status_code} {response.text}", "ERROR")
                return False
            
            data = response.json()
            self.token = data["access_token"]
            self.log(f"Login successful - Token: {self.token[:20]}...", "SUCCESS")
            return True
        except Exception as e:
            self.log(f"Login error: {e}", "ERROR")
            return False
    
    def get_headers(self):
        """Get request headers with auth"""
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def get_user_profile(self) -> dict:
        """Get current user profile"""
        self.log("Getting user profile...", "TEST")
        try:
            response = requests.get(
                f"{self.api_url}/auth/me",
                headers=self.get_headers()
            )
            
            if response.status_code != 200:
                self.log(f"Get profile failed: {response.status_code}", "ERROR")
                return {}
            
            data = response.json()
            self.user_id = data.get("id")
            has_face_id = data.get("has_face_id", False)
            self.log(f"User: {data.get('username')}, Face ID: {has_face_id}", "SUCCESS")
            return data
        except Exception as e:
            self.log(f"Get profile error: {e}", "ERROR")
            return {}
    
    def get_dashboard(self) -> dict:
        """Get student dashboard"""
        self.log("Getting dashboard...", "TEST")
        try:
            response = requests.get(
                f"{self.api_url}/student/dashboard",
                headers=self.get_headers()
            )
            
            if response.status_code != 200:
                self.log(f"Get dashboard failed: {response.status_code}", "ERROR")
                return {}
            
            data = response.json()
            self.log(f"Dashboard loaded - {len(data.get('today_schedule', []))} classes today", "SUCCESS")
            
            # Get first class for testing
            if data.get("today_schedule"):
                self.class_id = data["today_schedule"][0]["class_id"]
                self.log(f"Using class: {data['today_schedule'][0]['class_name']}", "INFO")
            
            return data
        except Exception as e:
            self.log(f"Get dashboard error: {e}", "ERROR")
            return {}
    
    def create_test_image(self, width=640, height=480) -> str:
        """Create a test image and return as base64"""
        self.log("Creating test image...", "TEST")
        try:
            # Create a simple test image (blue rectangle with white border)
            img = np.zeros((height, width, 3), dtype=np.uint8)
            img[:, :] = [100, 150, 200]  # Blue background
            
            # Add white border
            cv2.rectangle(img, (10, 10), (width-10, height-10), (255, 255, 255), 3)
            
            # Add text
            cv2.putText(img, "TEST IMAGE", (width//2-100, height//2), 
                       cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
            
            # Encode to base64
            _, buffer = cv2.imencode('.jpg', img)
            img_base64 = base64.b64encode(buffer).decode('utf-8')
            
            self.log(f"Test image created - size: {len(img_base64)} bytes", "SUCCESS")
            return img_base64
        except Exception as e:
            self.log(f"Create test image error: {e}", "ERROR")
            return ""
    
    def test_liveness_check(self, frames: list) -> dict:
        """Test liveness detection endpoint"""
        self.log(f"Testing liveness check with {len(frames)} frames...", "TEST")
        try:
            response = requests.post(
                f"{self.api_url}/attendance/liveness-check",
                headers=self.get_headers(),
                json={
                    "frames": frames,
                    "check_type": "anti_spoofing"
                }
            )
            
            if response.status_code != 200:
                self.log(f"Liveness check failed: {response.status_code} {response.text}", "ERROR")
                return {}
            
            data = response.json()
            self.log(f"Liveness check result: is_live={data.get('is_live')}, confidence={data.get('confidence')}", "SUCCESS")
            return data
        except Exception as e:
            self.log(f"Liveness check error: {e}", "ERROR")
            return {}
    
    def test_deepfake_detection(self, image: str) -> dict:
        """Test deepfake detection endpoint"""
        self.log("Testing deepfake detection...", "TEST")
        try:
            response = requests.post(
                f"{self.api_url}/attendance/detect-deepfake",
                headers=self.get_headers(),
                json={
                    "image": image,
                    "model": "xception"
                }
            )
            
            if response.status_code != 200:
                self.log(f"Deepfake detection failed: {response.status_code} {response.text}", "ERROR")
                return {}
            
            data = response.json()
            self.log(f"Deepfake detection result: is_deepfake={data.get('is_deepfake')}, confidence={data.get('confidence')}", "SUCCESS")
            return data
        except Exception as e:
            self.log(f"Deepfake detection error: {e}", "ERROR")
            return {}
    
    def test_gps_validation(self, latitude: float, longitude: float) -> dict:
        """Test GPS validation endpoint"""
        self.log(f"Testing GPS validation: {latitude}, {longitude}...", "TEST")
        try:
            response = requests.post(
                f"{self.api_url}/attendance/validate-gps",
                headers=self.get_headers(),
                json={
                    "latitude": latitude,
                    "longitude": longitude,
                    "timestamp": datetime.utcnow().isoformat()
                }
            )
            
            if response.status_code != 200:
                self.log(f"GPS validation failed: {response.status_code} {response.text}", "ERROR")
                return {}
            
            data = response.json()
            self.log(f"GPS validation result: is_valid={data.get('is_valid')}, distance={data.get('distance')}m", "SUCCESS")
            return data
        except Exception as e:
            self.log(f"GPS validation error: {e}", "ERROR")
            return {}
    
    def test_generate_embedding(self, image: str) -> dict:
        """Test embedding generation endpoint"""
        self.log("Testing embedding generation...", "TEST")
        try:
            response = requests.post(
                f"{self.api_url}/student/generate-embedding",
                headers=self.get_headers(),
                json={"image": image}
            )
            
            if response.status_code != 200:
                self.log(f"Embedding generation failed: {response.status_code} {response.text}", "ERROR")
                return {}
            
            data = response.json()
            embedding = data.get("embedding", [])
            self.log(f"Embedding generated - shape: {len(embedding)}", "SUCCESS")
            return data
        except Exception as e:
            self.log(f"Embedding generation error: {e}", "ERROR")
            return {}
    
    def test_checkin_with_embedding(self, embedding: list, latitude: float, longitude: float, 
                                   liveness_score: float = 0.8, deepfake_score: float = 0.02) -> dict:
        """Test check-in with embedding endpoint"""
        self.log("Testing check-in with embedding...", "TEST")
        try:
            if not self.class_id:
                self.log("No class_id available", "ERROR")
                return {}
            
            response = requests.post(
                f"{self.api_url}/attendance/checkin-with-embedding",
                headers=self.get_headers(),
                json={
                    "class_id": self.class_id,
                    "latitude": latitude,
                    "longitude": longitude,
                    "embedding": embedding,
                    "liveness_score": liveness_score,
                    "deepfake_score": deepfake_score,
                    "anti_spoofing_checks": {
                        "eye_movement": True,
                        "face_movement": True,
                        "skin_texture": True,
                        "light_reflection": True,
                        "blink_detection": True
                    }
                }
            )
            
            if response.status_code != 200:
                self.log(f"Check-in failed: {response.status_code} {response.text}", "ERROR")
                return {}
            
            data = response.json()
            self.log(f"Check-in result: success={data.get('success')}, message={data.get('message')}", "SUCCESS")
            return data
        except Exception as e:
            self.log(f"Check-in error: {e}", "ERROR")
            return {}
    
    def run_full_test(self):
        """Run complete anti-fraud test flow"""
        self.log("=" * 60, "INFO")
        self.log("ANTI-FRAUD SYSTEM TEST - 3-LAYER PROTECTION", "INFO")
        self.log("=" * 60, "INFO")
        
        # Step 1: Login
        if not self.login():
            return False
        
        # Step 2: Get user profile
        profile = self.get_user_profile()
        if not profile:
            return False
        
        # Step 3: Get dashboard
        dashboard = self.get_dashboard()
        if not dashboard:
            return False
        
        # Step 4: Create test image
        test_image = self.create_test_image()
        if not test_image:
            return False
        
        # Step 5: Test liveness check (with 1 frame - attendance mode)
        self.log("\n" + "=" * 60, "INFO")
        self.log("TEST 1: Liveness Check (1 frame - attendance mode)", "INFO")
        self.log("=" * 60, "INFO")
        liveness_result = self.test_liveness_check([test_image])
        
        # Step 6: Test deepfake detection
        self.log("\n" + "=" * 60, "INFO")
        self.log("TEST 2: Deepfake Detection", "INFO")
        self.log("=" * 60, "INFO")
        deepfake_result = self.test_deepfake_detection(test_image)
        
        # Step 7: Test GPS validation (valid location - near school)
        self.log("\n" + "=" * 60, "INFO")
        self.log("TEST 3: GPS Validation (Valid Location)", "INFO")
        self.log("=" * 60, "INFO")
        gps_valid = self.test_gps_validation(10.762622, 106.660172)  # School location
        
        # Step 8: Test GPS validation (invalid location - far from school)
        self.log("\n" + "=" * 60, "INFO")
        self.log("TEST 4: GPS Validation (Invalid Location - 250m away)", "INFO")
        self.log("=" * 60, "INFO")
        gps_invalid = self.test_gps_validation(10.765, 106.663)  # ~250m away
        
        # Step 9: Test embedding generation
        self.log("\n" + "=" * 60, "INFO")
        self.log("TEST 5: Embedding Generation", "INFO")
        self.log("=" * 60, "INFO")
        embedding_result = self.test_generate_embedding(test_image)
        
        # Step 10: Test check-in with valid embedding
        if embedding_result.get("embedding"):
            self.log("\n" + "=" * 60, "INFO")
            self.log("TEST 6: Check-in with Valid Embedding", "INFO")
            self.log("=" * 60, "INFO")
            checkin_result = self.test_checkin_with_embedding(
                embedding_result["embedding"],
                10.762622,  # Valid location
                106.660172,
                liveness_score=0.8,
                deepfake_score=0.02
            )
        
        # Step 11: Test check-in with deepfake (should fail)
        if embedding_result.get("embedding"):
            self.log("\n" + "=" * 60, "INFO")
            self.log("TEST 7: Check-in with Deepfake (should FAIL)", "INFO")
            self.log("=" * 60, "INFO")
            checkin_deepfake = self.test_checkin_with_embedding(
                embedding_result["embedding"],
                10.762622,
                106.660172,
                liveness_score=0.8,
                deepfake_score=0.75  # High deepfake score
            )
        
        # Step 12: Test check-in with invalid GPS (should fail)
        if embedding_result.get("embedding"):
            self.log("\n" + "=" * 60, "INFO")
            self.log("TEST 8: Check-in with Invalid GPS (should FAIL)", "INFO")
            self.log("=" * 60, "INFO")
            checkin_gps = self.test_checkin_with_embedding(
                embedding_result["embedding"],
                10.765,  # Invalid location
                106.663,
                liveness_score=0.8,
                deepfake_score=0.02
            )
        
        self.log("\n" + "=" * 60, "INFO")
        self.log("ALL TESTS COMPLETED", "SUCCESS")
        self.log("=" * 60, "INFO")
        return True

def main():
    tester = AntifraudTester()
    tester.run_full_test()

if __name__ == "__main__":
    main()
