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


def detect_face_only(image_array: np.ndarray) -> tuple[bool, int]:
    """
    Fast face presence check — runs only the detector (no recognition embedding).
    Used for real-time enrollment guidance polling.
    Returns (detected, face_count) where detected means exactly one confident face.
    """
    app = _get_app()
    try:
        bboxes, _ = app.det_model.detect(image_array, input_size=(320, 320), det_thresh=0.5)
        count = int(len(bboxes))
        detected = count == 1
        return detected, count
    except Exception:
        # det_model API changed — fall back to full pipeline
        faces = app.get(image_array)
        count = len(faces)
        detected = count == 1 and faces[0].det_score >= 0.5
        return detected, count


def encode_face_multi(images: list[np.ndarray]) -> list[np.ndarray]:
    """Encode multiple images, returning only the valid embeddings."""
    embeddings = []
    for img in images:
        emb, _ = encode_face(img)
        if emb is not None:
            embeddings.append(emb)
    return embeddings


def embedding_to_json(embedding: np.ndarray) -> str:
    return json.dumps(embedding.tolist())


def embeddings_to_json(embeddings: list[np.ndarray]) -> str:
    """Store multiple embeddings as a nested JSON array."""
    return json.dumps([emb.tolist() for emb in embeddings])


def json_to_embedding(data: str) -> Optional[np.ndarray]:
    """Load a single stored embedding. Returns None for old dlib (128-dim) or multi format."""
    try:
        arr = np.array(json.loads(data), dtype=np.float32)
        if arr.shape != (512,):
            return None
        return arr
    except Exception:
        return None


def json_to_embeddings(data: str) -> list[np.ndarray]:
    """
    Load one or more stored embeddings as a list.

    Handles three stored formats:
    - Old dlib 128-dim flat list  → [] (re-enroll required)
    - Single ArcFace 512-dim flat list → [embedding]
    - Multi ArcFace nested list [[...], [...], ...] → [emb1, emb2, ...]
    """
    try:
        raw = json.loads(data)
        if not isinstance(raw, list) or len(raw) == 0:
            return []

        if isinstance(raw[0], list):
            # Multi-embedding format
            result = []
            for item in raw:
                arr = np.array(item, dtype=np.float32)
                if arr.shape == (512,):
                    result.append(arr)
            return result

        # Single-embedding flat list
        arr = np.array(raw, dtype=np.float32)
        if arr.shape != (512,):
            return []  # old dlib 128-dim — must re-enroll
        return [arr]
    except Exception:
        return []


def find_best_match(
    incoming: np.ndarray,
    candidates: list[tuple[Any, list[np.ndarray]]],
) -> tuple[Optional[Any], float]:
    """
    Compare incoming embedding against candidates that each hold one or more embeddings.
    Each candidate is (user, [emb1, emb2, ...]).

    Uses the best cosine similarity across all stored embeddings for each candidate,
    then applies threshold + margin checks to avoid near-tie false positives.
    """
    if not candidates:
        return None, 0.0

    user_scores: list[tuple[Any, float]] = []
    for user, embs in candidates:
        if not embs:
            continue
        best = max(float(np.dot(incoming, emb)) for emb in embs)
        user_scores.append((user, best))

    if not user_scores:
        return None, 0.0

    user_scores.sort(key=lambda x: x[1], reverse=True)
    best_user, best_score = user_scores[0]

    if best_score < SIMILARITY_THRESHOLD:
        return None, best_score

    if len(user_scores) >= 2 and (best_score - user_scores[1][1]) < SIMILARITY_MARGIN:
        return None, best_score

    return best_user, best_score
