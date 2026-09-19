import pytest

from backend.contracts import ThesisInput


@pytest.fixture
def thesis():
    return ThesisInput.model_validate(
        {
            "rationale": "NVIDIA can maintain margins and revenue growth.",
            "assumptions": [
                {
                    "id": "margin",
                    "claim": "GAAP margin remains at least 75%",
                    "metric": "gaap_margin_pct",
                    "minimum": "75",
                    "invalidation_condition": "Invalidate when reported GAAP gross margin is below 75%.",
                },
                {
                    "id": "growth",
                    "claim": "Revenue growth remains at least 80%",
                    "metric": "revenue_growth_yoy_pct",
                    "minimum": "80",
                    "invalidation_condition": "Invalidate when reported year-over-year revenue growth is below 80%.",
                },
            ],
        }
    )


def named_from_assessment(assessment: dict) -> dict[str, list[str]]:
    held, broke, missing = [], [], []
    for item in assessment.get("assumptions", []):
        if item["state"] == "SUPPORTED":
            held.append(item["assumption_id"])
        elif item["state"] == "INVALIDATED":
            broke.append(item["assumption_id"])
        else:
            missing.append(item["assumption_id"])
    return {
        "held_assumption_ids": held,
        "broke_assumption_ids": broke,
        "missing_assumption_ids": missing,
    }
