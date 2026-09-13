"""The published contract must not drift from the application silently."""

import json

import pytest

from scripts.dump_openapi import SNAPSHOT, snapshot


def test_committed_description_matches_the_application():
    committed = json.loads(SNAPSHOT.read_text())
    current = snapshot()
    if committed == current:
        return
    # A full diff of the description is megabytes of noise. Name the models that
    # moved instead, and point at the one command that resolves it.
    before = committed.get("components", {}).get("schemas", {})
    after = current.get("components", {}).get("schemas", {})
    changed = sorted(
        name for name in before.keys() | after.keys() if before.get(name) != after.get(name)
    )
    paths = sorted(set(current.get("paths", {})) ^ set(committed.get("paths", {})))
    pytest.fail(
        "The backend contract changed but apps/web/src/api/openapi.json was not "
        f"regenerated.\nChanged models: {changed or 'none'}\nChanged paths: {paths or 'none'}\n"
        "Run: uv run python scripts/dump_openapi.py",
        pytrace=False,
    )
