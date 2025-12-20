import onnxruntime as ort
import numpy as np
import cv2
import logging

logger = logging.getLogger(__name__)

# Lazy load session
_sess = None
_input_name = None

def _get_session():
    global _sess, _input_name
    if _sess is None:
        try:
            _sess = ort.InferenceSession(
                "models/samplenet.onnx",
                providers=["CPUExecutionProvider"]
            )
            _input_name = _sess.get_inputs()[0].name
            logger.info("✅ ONNX session loaded successfully")
        except Exception as e:
            logger.error(f"❌ Failed to load ONNX session: {e}")
            _sess = None
            _input_name = None
    return _sess, _input_name

def preprocess(face):
    face = cv2.resize(face, (112, 112))
    face = face.astype(np.float32) / 255.0
    face = np.transpose(face, (2, 0, 1))
    face = np.expand_dims(face, axis=0)
    return face

def get_embedding(face_img):
    sess, input_name = _get_session()
    if sess is None or input_name is None:
        logger.error("❌ ONNX session not available")
        return None

    try:
        inp = preprocess(face_img)
        emb = sess.run(None, {input_name: inp})[0]
        emb = emb / np.linalg.norm(emb)
        return emb[0]
    except Exception as e:
        logger.error(f"❌ ONNX inference failed: {e}")
        return None
