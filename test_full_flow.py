#!/usr/bin/env python3
"""
Test complete attendance flow with GPS warnings
"""

import requests

def test_full_flow():
    print("Testing complete attendance flow with GPS warnings...")

    # 1. Login
    login_data = {'username': 'student1', 'password': 'password123'}
    login_response = requests.post('http://localhost:8001/auth/login', json=login_data)

    if login_response.status_code != 200:
        print("✗ Login failed")
        return

    token = login_response.json()['access_token']
    headers = {'Authorization': f'Bearer {token}'}
    print("OK: Login successful")

    # 2. Get dashboard
    dash_response = requests.get('http://localhost:8001/student/dashboard', headers=headers)

    if dash_response.status_code != 200:
        print("FAIL: Dashboard failed")
        return

    dash_data = dash_response.json()
    schedule_count = len(dash_data.get('today_schedule', []))
    print(f"OK: Dashboard loaded, classes: {schedule_count}")

    if schedule_count == 0:
        print("FAIL: No classes available")
        return

    # 3. Try checkin with invalid GPS (should succeed with warnings)
    class_id = dash_data['today_schedule'][0]['class_id']
    checkin_data = {
        'class_id': class_id,
        'latitude': 10.0,   # Far from classroom
        'longitude': 100.0
    }

    checkin_response = requests.post('http://localhost:8001/attendance/checkin',
                                   headers=headers, json=checkin_data)

    print(f"OK: Checkin response: {checkin_response.status_code}")

    if checkin_response.status_code == 200:
        result = checkin_response.json()
        print("SUCCESS: Checkin completed despite GPS warning")
        print(f"  Status: {result.get('status')}")
        print(f"  Warnings: {result.get('warnings', [])}")

        gps_val = result.get('validations', {}).get('gps', {})
        print(f"  GPS: {gps_val.get('message')} ({gps_val.get('distance_meters')}m)")

        face_val = result.get('validations', {}).get('face', {})
        print(f"  Face: {face_val.get('message')}")
    else:
        print(f"FAIL: Checkin failed: {checkin_response.text}")

if __name__ == "__main__":
    test_full_flow()
