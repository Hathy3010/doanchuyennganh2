#!/usr/bin/env python3
"""
Test script to verify base64 padding fix works correctly
"""

import base64
import cv2
import numpy as np
from pathlib import Path

def test_base64_padding():
    """Test that base64 padding fix handles malformed strings"""
    
    # Create a simple test image
    test_img = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)
    _, img_bytes = cv2.imencode('.jpg', test_img)
    
    # Encode to base64
    full_b64 = base64.b64encode(img_bytes).decode('utf-8')
    
    print(f"✅ Original base64 length: {len(full_b64)}")
    print(f"   Length % 4 = {len(full_b64) % 4}")
    
    # Test 1: Remove padding (simulate frontend issue)
    malformed_b64 = full_b64.rstrip('=')
    print(f"\n🧪 Test 1: Malformed base64 (padding removed)")
    print(f"   Length: {len(malformed_b64)}")
    print(f"   Length % 4 = {len(malformed_b64) % 4}")
    
    # Apply padding fix
    padding = 4 - (len(malformed_b64) % 4)
    if padding != 4:
        malformed_b64 += '=' * padding
    
    print(f"   After padding fix: {len(malformed_b64)}")
    print(f"   Length % 4 = {len(malformed_b64) % 4}")
    
    # Try to decode
    try:
        decoded_bytes = base64.b64decode(malformed_b64)
        decoded_img = cv2.imdecode(np.frombuffer(decoded_bytes, np.uint8), cv2.IMREAD_COLOR)
        if decoded_img is not None:
            print(f"   ✅ Successfully decoded! Image shape: {decoded_img.shape}")
        else:
            print(f"   ❌ Failed to decode to image")
    except Exception as e:
        print(f"   ❌ Decode error: {e}")
    
    # Test 2: Data URI prefix
    data_uri_b64 = f"data:image/jpeg;base64,{full_b64}"
    print(f"\n🧪 Test 2: Data URI prefix")
    print(f"   Original: {data_uri_b64[:50]}...")
    
    # Remove prefix
    clean_b64 = data_uri_b64.split(',', 1)[1]
    print(f"   After removing prefix: {len(clean_b64)} chars")
    
    # Apply padding fix
    padding = 4 - (len(clean_b64) % 4)
    if padding != 4:
        clean_b64 += '=' * padding
    
    # Try to decode
    try:
        decoded_bytes = base64.b64decode(clean_b64)
        decoded_img = cv2.imdecode(np.frombuffer(decoded_bytes, np.uint8), cv2.IMREAD_COLOR)
        if decoded_img is not None:
            print(f"   ✅ Successfully decoded! Image shape: {decoded_img.shape}")
        else:
            print(f"   ❌ Failed to decode to image")
    except Exception as e:
        print(f"   ❌ Decode error: {e}")
    
    # Test 3: Multiple padding scenarios
    print(f"\n🧪 Test 3: Padding scenarios")
    for i in range(1, 5):
        test_b64 = full_b64[:len(full_b64) - i]
        padding = 4 - (len(test_b64) % 4)
        if padding != 4:
            test_b64 += '=' * padding
        
        try:
            decoded_bytes = base64.b64decode(test_b64)
            print(f"   ✅ Scenario {i}: Removed {i} chars, added {padding} padding - OK")
        except Exception as e:
            print(f"   ❌ Scenario {i}: Failed - {e}")

if __name__ == "__main__":
    print("=" * 60)
    print("Base64 Padding Fix Test")
    print("=" * 60)
    test_base64_padding()
    print("\n" + "=" * 60)
    print("All tests completed!")
    print("=" * 60)
