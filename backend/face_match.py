import numpy as np
from numpy.linalg import norm

def match_face(embedding1, embedding2):
    """
    Calculate cosine similarity between two face embeddings.

    Args:
        embedding1: First face embedding (numpy array)
        embedding2: Second face embedding (numpy array)

    Returns:
        float: Cosine similarity score between 0 and 1
    """
    return np.dot(embedding1, embedding2) / (norm(embedding1) * norm(embedding2))

