"""News fetch + sentiment scoring.

Sources:
  - Headlines: NewsAPI (external; key in env / Secret Manager on GCP).
  - Sentiment: Vertex AI Gemini via google-genai unified SDK.
    Uses ADC on Cloud Run / `gcloud auth application-default login`,
    or GEMINI_API_KEY for local dev.

Graceful degradation: if any API is unavailable, returns neutral 0.0 and
logs a note. Never raises — the pipeline must keep running.

Exports: fetch_headlines, score_sentiment.
"""
import os
import re
from datetime import datetime, timedelta, timezone
from typing import List

import requests
from dotenv import load_dotenv

load_dotenv()

NEWSAPI_KEY = os.getenv("NEWSAPI_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GCLOUD_PROJECT = os.getenv("GCLOUD_PROJECT", "")
GCLOUD_LOCATION = os.getenv("GCLOUD_LOCATION", "us-central1")

_GEMINI_MODEL = "gemini-1.5-flash"


def fetch_headlines(
    query: str = 'gold OR XAUUSD OR "gold price"',
    hours: int = 24,
    page_size: int = 20,
) -> List[dict]:
    """Fetch recent gold-related headlines from NewsAPI.

    Returns list of {title, published_at, source}. Empty list on any error
    or if NEWSAPI_KEY is not set.
    """
    if not NEWSAPI_KEY:
        return []
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    try:
        r = requests.get(
            "https://newsapi.org/v2/everything",
            params={
                "q": query,
                "from": since,
                "sortBy": "relevancy",
                "pageSize": page_size,
                "language": "en",
                "apiKey": NEWSAPI_KEY,
            },
            timeout=15,
        )
        r.raise_for_status()
        articles = r.json().get("articles", [])
        return [
            {
                "title": a.get("title", ""),
                "published_at": a.get("publishedAt"),
                "source": a.get("source", {}).get("name", ""),
            }
            for a in articles
            if a.get("title")
        ]
    except Exception:
        return []


def _build_gemini_client():
    """Lazy-import and build a Gemini client. Returns None if unavailable."""
    try:
        from google import genai
    except Exception:
        return None
    try:
        if GEMINI_API_KEY:
            return genai.Client(api_key=GEMINI_API_KEY)
        if GCLOUD_PROJECT:
            return genai.Client(
                vertexai=True, project=GCLOUD_PROJECT, location=GCLOUD_LOCATION
            )
        # Fallback: let the SDK auto-discover ADC
        return genai.Client(vertexai=True, project="", location=GCLOUD_LOCATION)
    except Exception:
        return None


def _gemini_score(text: str) -> float:
    """Score aggregate sentiment in [-1, 1] via Gemini. 0.0 on any failure."""
    prompt = (
        "You are a financial sentiment analyst for XAUUSD (gold). Score the "
        "aggregate sentiment of the following news headlines toward GOLD price. "
        "Return ONLY a single decimal number in [-1, 1] where -1=very bearish, "
        "0=neutral, +1=very bullish.\n\nHeadlines:\n" + text
    )
    client = _build_gemini_client()
    if client is None:
        return 0.0
    try:
        resp = client.models.generate_content(model=_GEMINI_MODEL, contents=prompt)
        raw = (resp.text or "").strip()
        m = re.search(r"-?\d+(?:\.\d+)?", raw)
        if m:
            return max(-1.0, min(1.0, float(m.group(0))))
    except Exception:
        return 0.0
    return 0.0


def score_sentiment(headlines: List[dict]) -> dict:
    """Returns {score, count, summary}.

    score in [-1, 1]. 0.0 if no headlines or API unavailable.
    """
    if not headlines:
        return {
            "score": 0.0,
            "count": 0,
            "summary": "No headlines available (NewsAPI key not configured or no results).",
        }
    joined = "\n".join(f"- {h['title']}" for h in headlines[:20])
    score = _gemini_score(joined)
    tag = "bullish" if score > 0.15 else "bearish" if score < -0.15 else "neutral"
    return {
        "score": round(score, 4),
        "count": len(headlines),
        "summary": f"News sentiment {tag} ({score:+.2f}) from {len(headlines)} headlines.",
    }
