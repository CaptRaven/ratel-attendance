from __future__ import annotations
import json
import numpy as np
from typing import Optional, Any
from app.core.logging import logger

INSIGHTFACE_AVAILABLE = False
_face_app = None

try:
    from insightface.app import FaceAnalysis
    INSIGHTFACE_AVAILABLE = True
except ImportError:
    pass

# Cosine similarity thresholds (higher = stricter; range 0.0–1.0)
SIMILARITY_THRESHOLD = 0.45   # minimum score to accept any match
SIMILARITY_MARGIN = 0.08      # best match must beat second-best by at least this much


def _get_app() -> "FaceAnalysis":
    global _face_app
    if _face_app is None:
        from insightface.app import FaceAnalysis
        _face_app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
        _face_app.prepare(ctx_id=-1)
        logger.info("insightface_model_loaded", model="buffalo_l")
    return _face_app


def encode_face(image_array: np.ndarray) -> tuple[Optional[np.ndarray], int]:
    """
    Detect faces in image and return (L2-normalised 512-dim ArcFace embedding, face_count).
    Returns (None, count) when 0 or 2+ faces are detected, or detection confidence is low.
    """
    app = _get_app()
    faces = app.get(image_array)
    count = len(faces)
    if count != 1:
        return None, count
    face = faces[0]
    if face.det_score < 0.5:
        return None, 0
    return face.normed_embedding, 1


def embedding_to_json(embedding: np.ndarray) -> str:
    return json.dumps(embedding.tolist())


def json_to_embedding(data: str) -> Optional[np.ndarray]:
    """Load a stored embedding. Returns None for old dlib-format (128-dim) encodings."""
    try:
        arr = np.array(json.loads(data), dtype=np.float32)
        if arr.shape != (512,):
            return None  # incompatible old dlib format — employee must re-enroll
        return arr
    except Exception:
        return None


def find_best_match(
    incoming: np.ndarray,
    candidates: list[tuple[Any, np.ndarray]],
) -> tuple[Optional[Any], float]:
    """
    Compare incoming embedding against a list of (user, embedding) candidates.
    Returns (best_user, score) when a confident match is found, (None, score) otherwise.

    Both threshold and margin must be satisfied:
    - Score must exceed SIMILARITY_THRESHOLD
    - Score must beat second-best by at least SIMILARITY_MARGIN (avoids near-tie false positives)
    """
    if not candidates:
        return None, 0.0

    scores = [(user, float(np.dot(incoming, emb))) for user, emb in candidates]
    scores.sort(key=lambda x: x[1], reverse=True)

    best_user, best_score = scores[0]
    if best_score < SIMILARITY_THRESHOLD:
        return None, best_score

    if len(scores) >= 2 and (best_score - scores[1][1]) < SIMILARITY_MARGIN:
        return None, best_score

    return best_user, best_score
