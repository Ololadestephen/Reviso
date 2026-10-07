"""Explicit supplemental research loading, preserving immutable saved checks."""

from fastapi import APIRouter, HTTPException, Request

from backend.contracts import Evidence, ResearchLoadInput, StressInput, utc_now
from backend.routes import Owner, Repo, confirmed
from backend.services import assessment, digest

router = APIRouter()


@router.post("/theses/{thesis_id}/research-context")
def load_research(
    thesis_id: str, body: ResearchLoadInput, request: Request, repo: Repo, owner: Owner
) -> dict[str, object]:
    record = confirmed(repo, owner.user_id, thesis_id)
    previous = repo.history(owner.user_id, thesis_id)["selected_assessment"]
    if not previous or previous["input_hash"] != body.assessment_input_hash:
        raise HTTPException(409, "The research changed; reload before adding sources")
    if previous["mode"] != "LIVE_REFRESH":
        raise HTTPException(409, "Load a current filing before adding today's research")
    evidence = [Evidence.model_validate(item) for item in previous["evidence"]]
    period = max((item.observed_at for item in evidence), default=None)
    material = request.app.state.official_research.snapshot(
        record["thesis"]["instrument_id"], period
    )
    result = assessment(
        record,
        evidence,
        utc_now(),
        StressInput.model_validate(previous["scenario"]),
        "LIVE_REFRESH",
        previous.get("disclosure_retrieval"),
    )
    for key in ("market", "market_execution"):
        if key in previous:
            result[key] = previous[key]
    result["research_sources"] = [source.model_dump(mode="json") for source in material.sources]
    result["research_retrieval"] = [entry.model_dump(mode="json") for entry in material.retrieval]
    result["research_base_input_hash"] = previous["input_hash"]
    result["input_hash"] = digest(
        {key: value for key, value in result.items() if key not in {"input_hash", "result_hash"}}
    )
    result["result_hash"] = digest(
        {
            key: value
            for key, value in result.items()
            if key not in {"input_hash", "result_hash", "evaluated_at"}
        }
    )
    return repo.assess(
        owner.user_id,
        thesis_id,
        record["version"],
        result,
        expected_selection=body.assessment_input_hash,
    )
