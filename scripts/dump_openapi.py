"""Write the backend OpenAPI description that the web client validates against.

Run after changing any request or response contract:

    uv run python scripts/dump_openapi.py
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend.api import create_app

SNAPSHOT = ROOT / "apps/web/src/api/openapi.json"


def snapshot() -> dict:
    return create_app().openapi()


def main() -> None:
    SNAPSHOT.write_text(json.dumps(snapshot(), indent=2, sort_keys=True) + "\n")
    print(f"Wrote {SNAPSHOT}")


if __name__ == "__main__":
    main()
