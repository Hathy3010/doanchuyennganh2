#!/usr/bin/env python3
"""
Simple test để demo logic pose detection
Không cần camera thật - chỉ simulate
"""

import time
import random

def simulate_pose_detection(expected_pose):
    """
    Simulate pose detection logic
    """
    # Giả lập các poses có thể detect được
    possible_poses = ["front", "left", "right", "up", "down", "tilted_front", "unknown", "no_face"]

    # Logic giả lập: 70% chance detect đúng pose sau vài lần thử
    if random.random() < 0.7:
        return expected_pose
    else:
        # Trả về pose ngẫu nhiên khác
        other_poses = [p for p in possible_poses if p != expected_pose and p not in ["no_face", "unknown"]]
        return random.choice(other_poses) if other_poses else "unknown"

def test_pose_logic(expected_pose, max_attempts=10):
    """
    Test logic pose detection
    """
    print(f"Testing pose detection for: {expected_pose}")
    print(f"Will auto-capture after {max_attempts} correct detections")

    attempt = 0
    correct_count = 0
    required_correct = 3  # Cần 3 lần detect đúng liên tiếp

    while attempt < max_attempts:
        attempt += 1

        # Simulate camera capture và pose detection
        detected_pose = simulate_pose_detection(expected_pose)
        print(f"Attempt {attempt}: Detected '{detected_pose}' (expecting '{expected_pose}')")

        if detected_pose == expected_pose:
            correct_count += 1
            print(f"  Correct! Count: {correct_count}/{required_correct}")

            if correct_count >= required_correct:
                print(f"  AUTO-CAPTURE: Pose '{expected_pose}' verified!")
                return True
        else:
            correct_count = 0  # Reset counter nếu sai
            if detected_pose == "no_face":
                print("  No face detected - adjust position")
            else:
                print(f"  Wrong pose: {detected_pose}")

        time.sleep(0.5)  # Simulate processing time

    print(f"Failed to detect pose '{expected_pose}' after {max_attempts} attempts")
    return False

def demo_pose_detection_system():
    """
    Demo complete pose detection system
    """
    print("Face Pose Detection System Demo")
    print("=" * 50)
    print("Logic: Can 3 lan detect dung lien tiep thi moi capture")
    print()

    poses_to_test = ["front", "left", "right", "up", "down"]

    success_count = 0

    for pose in poses_to_test:
        print(f"\n{'='*30}")
        success = test_pose_logic(pose)

        if success:
            success_count += 1
            print(f"SUCCESS: {pose} pose captured")
        else:
            print(f"FAILED: {pose} pose not captured")

        print(f"Progress: {success_count}/{len(poses_to_test)} poses completed")
        time.sleep(2)  # Pause between poses

    print(f"\nDemo completed: {success_count}/{len(poses_to_test)} poses captured successfully")

    if success_count == len(poses_to_test):
        print("All poses detected correctly - FaceID setup complete!")
    else:
        print("Some poses failed - may need recalibration")

def test_accuracy():
    """
    Test accuracy của pose detection logic
    """
    print("\nTesting Detection Accuracy")
    print("=" * 30)

    test_runs = 100
    expected_pose = "front"
    success_count = 0

    for i in range(test_runs):
        if test_pose_logic(expected_pose, max_attempts=5):
            success_count += 1

    accuracy = (success_count / test_runs) * 100
    print(f"Accuracy: {accuracy:.1f}%")

    if accuracy >= 80:
        print("High accuracy - system ready!")
    elif accuracy >= 60:
        print("Moderate accuracy - may need tuning")
    else:
        print("Low accuracy - needs improvement")

if __name__ == "__main__":
    demo_pose_detection_system()
    test_accuracy()
