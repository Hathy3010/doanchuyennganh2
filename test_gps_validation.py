#!/usr/bin/env python3
"""
Test GPS validation against default location
"""

from geopy.distance import geodesic

# Default location: 407 Ngu Hanh Son, Da Nang
DEFAULT_LOCATION = {
    "name": "407 Ngũ Hành Sơn, Đà Nẵng",
    "latitude": 16.0046,
    "longitude": 108.2499,
    "radius_meters": 100
}

def validate_gps_location(latitude: float, longitude: float):
    """Validate GPS location against classroom"""
    user_location = (latitude, longitude)
    classroom_location = (DEFAULT_LOCATION["latitude"], DEFAULT_LOCATION["longitude"])

    distance = geodesic(user_location, classroom_location).meters
    is_valid = distance <= DEFAULT_LOCATION["radius_meters"]

    return {
        "is_valid": is_valid,
        "distance_meters": round(distance, 2),
        "message": f"{'✓ Vị trí hợp lệ' if is_valid else '⚠️ Sai vị trí đứng'}",
        "classroom_name": DEFAULT_LOCATION["name"]
    }

# Test cases
test_locations = [
    # Valid locations (within 100m)
    {"name": "Right at classroom", "lat": 16.0046, "lon": 108.2499},
    {"name": "50m away", "lat": 16.0042, "lon": 108.2499},
    {"name": "90m away", "lat": 16.0038, "lon": 108.2499},

    # Invalid locations (over 100m)
    {"name": "200m away", "lat": 16.0028, "lon": 108.2499},
    {"name": "500m away", "lat": 16.0001, "lon": 108.2499},
    {"name": "Different area", "lat": 16.0678, "lon": 108.2208},  # Son Tra district
]

print("GPS Validation Test for 407 Ngu Hanh Son, Da Nang")
print("=" * 60)
print(f"Classroom coordinates: {DEFAULT_LOCATION['latitude']}, {DEFAULT_LOCATION['longitude']}")
print(f"Valid radius: {DEFAULT_LOCATION['radius_meters']} meters")
print()

for location in test_locations:
    result = validate_gps_location(location["lat"], location["lon"])
    status = "VALID" if result["is_valid"] else "INVALID"
    print("20")
    print()

print("=" * 60)
print("Summary:")
print("* Valid locations are within 100m of classroom")
print("* Invalid locations will show 'Sai vi tri dung' warning")
print("* Real-time notifications include GPS validation status")
print("* Attendance still succeeds but with warnings for teachers")
