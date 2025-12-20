#!/usr/bin/env python3
"""
Test dashboard API
"""

import requests

# Test login first
login_data = {'username': 'student1', 'password': 'password123'}
login_response = requests.post('http://localhost:8001/auth/login', json=login_data)
print('Login:', login_response.status_code)

if login_response.status_code == 200:
    token = login_response.json()['access_token']

    # Test dashboard
    headers = {'Authorization': f'Bearer {token}'}
    dashboard_response = requests.get('http://localhost:8001/student/dashboard', headers=headers)
    print('Dashboard:', dashboard_response.status_code)

    if dashboard_response.status_code == 200:
        data = dashboard_response.json()
        print('Student name:', data.get('student_name'))
        print('Total classes today:', data.get('total_classes_today'))
        print('Attended today:', data.get('attended_today'))
        print('Schedule items:', len(data.get('today_schedule', [])))

        schedule = data.get('today_schedule', [])
        for i, item in enumerate(schedule):
            status = item.get('attendance_status', 'unknown')
            print(f'  {i+1}. {item["class_name"]} ({item["class_code"]}) - {status}')
    else:
        print('Dashboard error:', dashboard_response.text)
