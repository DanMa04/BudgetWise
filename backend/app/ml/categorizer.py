import re
import uuid
from pathlib import Path

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import SGDClassifier
from sklearn.pipeline import Pipeline

CONFIDENCE_THRESHOLD = 0.6
MODELS_DIR = Path(__file__).resolve().parent.parent.parent / "ml_models"


class TransactionCategorizer:
    def __init__(self, user_id: uuid.UUID):
        self.user_id = user_id
        self.pipeline: Pipeline | None = None
        self.category_map: dict[int, uuid.UUID] = {}
        self.is_trained = False

    def _build_pipeline(self) -> Pipeline:
        return Pipeline([
            ("tfidf", TfidfVectorizer(
                analyzer="char_wb", ngram_range=(2, 5),
                max_features=5000, sublinear_tf=True,
            )),
            ("clf", SGDClassifier(loss="modified_huber", random_state=42)),
        ])

    def train(self, descriptions: list[str], category_ids: list[uuid.UUID]) -> None:
        unique_ids = sorted(set(category_ids), key=str)
        id_to_label = {cid: idx for idx, cid in enumerate(unique_ids)}
        self.category_map = {idx: cid for cid, idx in id_to_label.items()}

        cleaned = [self.clean_description(d) for d in descriptions]
        labels = [id_to_label[cid] for cid in category_ids]

        self.pipeline = self._build_pipeline()
        self.pipeline.fit(cleaned, labels)
        self.is_trained = True

    def predict(self, description: str) -> tuple[uuid.UUID | None, float]:
        if not self.is_trained or self.pipeline is None:
            return None, 0.0

        cleaned = self.clean_description(description)
        probas = self.pipeline.predict_proba([cleaned])[0]
        max_idx = probas.argmax()
        confidence = float(probas[max_idx])
        label = self.pipeline.classes_[max_idx]

        if confidence < CONFIDENCE_THRESHOLD:
            return None, confidence

        return self.category_map.get(label), confidence

    def predict_batch(
        self, descriptions: list[str]
    ) -> list[tuple[uuid.UUID | None, float]]:
        if not self.is_trained or self.pipeline is None:
            return [(None, 0.0)] * len(descriptions)

        cleaned = [self.clean_description(d) for d in descriptions]
        probas = self.pipeline.predict_proba(cleaned)
        results = []
        for row in probas:
            max_idx = row.argmax()
            confidence = float(row[max_idx])
            label = self.pipeline.classes_[max_idx]
            if confidence < CONFIDENCE_THRESHOLD:
                results.append((None, confidence))
            else:
                results.append((self.category_map.get(label), confidence))
        return results

    @staticmethod
    def clean_description(text: str) -> str:
        text = text.lower()
        text = re.sub(r"\b(checkcard|pos|debit|credit|purchase|payment)\b", "", text)
        text = re.sub(r"\b\d{4,}\b", "", text)
        text = re.sub(r"[#*]+", "", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text

    def save(self, path: str) -> None:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({
            "pipeline": self.pipeline,
            "category_map": self.category_map,
            "user_id": str(self.user_id),
        }, path)

    @classmethod
    def load(cls, path: str, user_id: uuid.UUID) -> "TransactionCategorizer":
        data = joblib.load(path)
        instance = cls(user_id)
        instance.pipeline = data["pipeline"]
        instance.category_map = data["category_map"]
        instance.is_trained = True
        return instance
