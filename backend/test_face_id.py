#!/usr/bin/env python3
"""
Face ID Testing Script - Test Face ID pose diversity system
Tests the new Face ID style implementation with pose diversity
"""

import requests
import base64
import json
import time
import numpy as np
import cv2
from typing import List, Dict, Tuple
import os
from pathlib import Path

class FaceIDTester:
    def __init__(self, base_url: str = "http://localhost:8001"):
        self.base_url = base_url
        self.session = requests.Session()
        self.token = None

    def login(self, username: str = "student1", password: str = "password123"):
        """Login and get access token"""
        login_data = {
            "username": username,
            "password": password
        }

        try:
            response = self.session.post(f"{self.base_url}/auth/login", json=login_data)
            response.raise_for_status()
            data = response.json()

            self.token = data.get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})

            print(f"[OK] Logged in as {username}")
            return True

        except Exception as e:
            print(f"❌ Login failed: {e}")
            return False

    def create_test_image(self, width: int = 640, height: int = 480) -> str:
        """Create a synthetic test image with a face-like pattern"""
        # Create a simple colored rectangle as face placeholder
        img = np.zeros((height, width, 3), dtype=np.uint8)

        # Add some color variation to simulate a face
        face_center_x, face_center_y = width // 2, height // 2
        face_size = min(width, height) // 3

        # Draw a colored rectangle to simulate face
        cv2.rectangle(img,
                     (face_center_x - face_size//2, face_center_y - face_size//2),
                     (face_center_x + face_size//2, face_center_y + face_size//2),
                     (100, 150, 200), -1)

        # Add some texture
        for i in range(50):
            x = np.random.randint(face_center_x - face_size//2, face_center_x + face_size//2)
            y = np.random.randint(face_center_y - face_size//2, face_center_y + face_size//2)
            cv2.circle(img, (x, y), 2, (np.random.randint(50, 200),)*3, -1)

        # Convert to JPEG and base64
        success, encoded_img = cv2.imencode('.jpg', img)
        if not success:
            raise ValueError("Failed to encode image")

        img_base64 = base64.b64encode(encoded_img.tobytes()).decode('utf-8')
        return img_base64

    def test_detect_face_angle(self) -> bool:
        """Test the new /detect-face-angle endpoint"""
        print("\n🧪 Testing /detect-face-angle endpoint...")

        try:
            # Create test image
            test_image = self.create_test_image()

            # Test the endpoint
            response = self.session.post(f"{self.base_url}/detect-face-angle",
                                       json={"image": test_image})

            if response.status_code == 200:
                data = response.json()
                print("✅ Face angle detection response:")
                print(f"   - Face present: {data.get('face_present', False)}")
                print(f"   - Yaw: {data.get('yaw', 'N/A')}°")
                print(f"   - Pitch: {data.get('pitch', 'N/A')}°")
                print(f"   - Message: {data.get('message', 'N/A')}")

                # Check if response has expected fields
                expected_fields = ['face_present', 'yaw', 'pitch', 'roll', 'message']
                missing_fields = [field for field in expected_fields if field not in data]

                if missing_fields:
                    print(f"⚠️  Missing fields: {missing_fields}")
                    return False

                return True
            else:
                print(f"❌ API returned status {response.status_code}: {response.text}")
                return False

        except Exception as e:
            print(f"❌ Test failed: {e}")
            return False

    def test_setup_faceid_pose_diversity(self) -> bool:
        """Test the new Face ID setup with pose diversity"""
        print("\n🧪 Testing /student/setup-faceid with pose diversity...")

        try:
            # Create 30 test images (simulating 30 frames)
            test_images = []
            print("📸 Generating 30 test frames...")

            for i in range(30):
                img = self.create_test_image()
                test_images.append(img)

                if (i + 1) % 10 == 0:
                    print(f"   Generated {i+1}/30 frames...")

            # Test setup with pose diversity
            print("🚀 Sending Face ID setup request...")
            start_time = time.time()

            response = self.session.post(f"{self.base_url}/student/setup-faceid",
                                       json={"images": test_images})

            elapsed = time.time() - start_time
            print(".2f")

            if response.status_code == 200:
                data = response.json()
                print("✅ Face ID setup successful!")
                print(f"   - Message: {data.get('message', 'N/A')}")
                print(f"   - Samples used: {data.get('samples_used', 'N/A')}")
                print(f"   - Total samples: {data.get('total_samples', 'N/A')}")
                print(f"   - Yaw range: {data.get('yaw_range', 'N/A')}°")
                print(f"   - Pitch range: {data.get('pitch_range', 'N/A')}°")
                print(f"   - Setup type: {data.get('setup_type', 'N/A')}")

                # Check if it mentions pose diversity
                if "pose_diversity" in data.get('setup_type', ''):
                    print("✅ Pose diversity logic working!")
                    return True
                else:
                    print("⚠️  Setup type doesn't indicate pose diversity")
                    return False
            else:
                print(f"❌ Setup failed with status {response.status_code}: {response.text}")
                return False

        except Exception as e:
            print(f"❌ Test failed: {e}")
            return False

    def test_pose_diversity_validation(self) -> bool:
        """Test pose diversity validation logic"""
        print("\n🧪 Testing pose diversity validation...")

        # Test with insufficient frames
        print("📊 Testing with insufficient frames (10 instead of 20)...")
        test_images = [self.create_test_image() for _ in range(10)]

        try:
            response = self.session.post(f"{self.base_url}/student/setup-faceid",
                                       json={"images": test_images})

            if response.status_code == 400:
                data = response.json()
                if "ít nhất" in data.get('detail', '') and "ảnh" in data.get('detail', ''):
                    print("✅ Insufficient frames validation working!")
                    return True
                else:
                    print(f"⚠️  Unexpected error message: {data.get('detail')}")
                    return False
            else:
                print(f"⚠️  Expected 400 but got {response.status_code}")
                return False

        except Exception as e:
            print(f"❌ Test failed: {e}")
            return False

    def run_all_tests(self) -> bool:
        """Run all Face ID tests"""
        print("[START] Face ID System Tests")
        print("=" * 50)

        # Test 1: Login
        if not self.login():
            return False

        # Test 2: Face angle detection
        if not self.test_detect_face_angle():
            return False

        # Test 3: Pose diversity validation
        if not self.test_pose_diversity_validation():
            return False

        # Test 4: Full Face ID setup
        if not self.test_setup_faceid_pose_diversity():
            return False

        print("\n" + "=" * 50)
        print("🎉 All Face ID tests passed!")
        return True


def main():
    """Main test function"""
    print("Face ID Testing Script")
    print("Tests the new Face ID pose diversity implementation")
    print()

    # Check if backend is running
    try:
        response = requests.get("http://localhost:8001/docs", timeout=5)
        if response.status_code != 200:
            print("❌ Backend server not running or not responding")
            print("   Please start the backend with: python -m uvicorn main:app --host 0.0.0.0 --port 8001")
            return
    except:
        print("❌ Cannot connect to backend server")
        print("   Please start the backend with: python -m uvicorn main:app --host 0.0.0.0 --port 8001")
        return

    # Run tests
    tester = FaceIDTester()
    success = tester.run_all_tests()

    if success:
        print("\n🎊 Face ID system is working correctly!")
        print("   - Pose diversity logic: ✅")
        print("   - Frame collection: ✅")
        print("   - API endpoints: ✅")
        print("   - Validation: ✅")
    else:
        print("\n❌ Some tests failed. Please check the implementation.")

    return success


if __name__ == "__main__":
    main()
