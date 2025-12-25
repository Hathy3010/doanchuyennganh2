import cv2
import base64
import numpy as np
import time

FRAME_BUFFER = {}
FRAME_LIMIT = 5
EXPIRE_SEC = 10

def decode_image(b64):
    img_bytes = base64.b64decode(b64)
    arr = np.frombuffer(img_bytes, np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)

def add_frame(session_id, b64):
    now = time.time()
    if session_id not in FRAME_BUFFER:
        FRAME_BUFFER[session_id] = {
            "frames": [],
            "time": now
        }

    FRAME_BUFFER[session_id]["frames"].append(decode_image(b64))
    FRAME_BUFFER[session_id]["time"] = now

def is_ready(session_id):
    return session_id in FRAME_BUFFER and \
           len(FRAME_BUFFER[session_id]["frames"]) >= FRAME_LIMIT

def clear(session_id):
    FRAME_BUFFER.pop(session_id, None)

def movement_score(frames):
    diffs = []
    for i in range(len(frames) - 1):
        diff = cv2.absdiff(frames[i], frames[i+1])
        diffs.append(np.mean(diff))
    return sum(diffs) / len(diffs)
