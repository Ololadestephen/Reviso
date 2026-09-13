"""HTTP routes; services own assessment and repositories own persistence."""

import json
from datetime import datetime
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response

from backend.company_disclosures import CompanyDisclosureProvider
from backend.contracts import (
    Confirmation,
    DecisionInput,
    Evidence,
    InstrumentId,
    ReplayInput,
    ResearchQuestionInput,
    RevisionInput,
    SavedResearchAnswer,
    StressInput,
    ThesisExtractionInput,
    ThesisIdeaInput,
    ThesisInput,
    ThesisSuggestion,
    ThesisSummary,
    utc_now,
)
from backend.exports import markdown_snapshot, research_snapshot
from backend.instruments import INSTRUMENTS, NVIDIA, Instrument, instrument_by_id
from backend.llm import (
    EXTRACTION_PROMPT_VERSION,
    QUESTION_PROMPT_VERSION,
    REVIEW_PROMPT_VERSION,
    LanguageModel,
    provenance,
)
from backend.market import market_execution
from backend.providers import BitgetProvider
from backend.replay import CASES, CUTOFFS, available_evidence, evidence_by_id
from backend.services import assessment, digest, revision_changes
from backend.storage import ConflictError, Repository

router = APIRouter()


def get_repository(request: Request) -> Repository:
    return request.app.state.repository


def get_provider(request: Request) -> BitgetProvider:
    return request.app.state.provider


def get_llm(request: Request) -> LanguageModel:
    return request.app.state.llm


def get_disclosures(request: Request) -> CompanyDisclosureProvider:
    return request.app.state.disclosures


def get_deployment_mode(
    request: Request,
) -> Literal["local_single_user", "private_demo"]:
    return request.app.state.deployment_mode


Repo = Annotated[Repository, Depends(get_repository)]
Provider = Annotated[BitgetProvider, Depends(get_provider)]
LLM = Annotated[LanguageModel, Depends(get_llm)]
Disclosures = Annotated[CompanyDisclosureProvider, Depends(get_disclosures)]
DeploymentMode = Annotated[
    Literal["local_single_user", "private_demo"], Depends(get_deployment_mode)
]


def confirmed(repo: Repository, thesis_id: str) -> dict:
    record = repo.get(thesis_id)
    if not record["confirmed"] or record["retired"]:
        raise HTTPException(409, "Confirm an active thesis first")
    return record


@router.get("/health")
def health(llm: LLM, mode: DeploymentMode):
    return {"status": "ok", "llm": llm.descriptor.public(), "mode": mode}


@router.get("/llm/status")
def llm_status(llm: LLM):
    return llm.descriptor.public()


@router.post("/theses/extract")
def extract_thesis(body: ThesisExtractionInput, llm: LLM):
    thesis = llm.extract(body.current)
    return {
        "thesis": thesis.model_dump(mode="json"),
        "provenance": provenance(llm.descriptor, EXTRACTION_PROMPT_VERSION),
        "warning": "AI proposal only. Review and correct every field before confirmation.",
    }


@router.post("/theses/suggest", response_model=ThesisSuggestion)
def suggest_assumptions(body: ThesisIdeaInput, llm: LLM):
    return llm.suggest(body)


@router.get("/instrument", response_model=Instrument)
def instrument():
    return NVIDIA


@router.get("/instruments", response_model=list[Instrument])
def instruments():
    return list(INSTRUMENTS.values())


@router.get("/instruments/{instrument_id}", response_model=Instrument)
def selected_instrument(instrument_id: InstrumentId):
    return instrument_by_id(instrument_id)


@router.get("/theses", response_model=list[ThesisSummary])
def list_theses(repo: Repo):
    return repo.summaries()


@router.post("/theses/draft", status_code=201)
def draft(body: ThesisInput, repo: Repo):
    return repo.create(body.model_dump(mode="json"))


@router.get("/theses/{thesis_id}")
def get_thesis(thesis_id: str, repo: Repo):
    return repo.get(thesis_id)


@router.post("/theses/{thesis_id}/confirm")
def confirm(thesis_id: str, body: Confirmation, repo: Repo):
    current = repo.get(thesis_id)
    if current["confirmed"]:
        raise HTTPException(409, "Use an explicit revision for confirmed theses")
    return repo.evolve(
        thesis_id,
        body.expected_version,
        {
            "confirmed": True,
            "thesis": body.model_dump(mode="json", exclude={"expected_version"}),
        },
        {
            "action": "confirm",
            "explanation": "User confirmed claims and invalidation conditions.",
        },
    )


@router.post("/theses/{thesis_id}/stress")
def run_stress(thesis_id: str, body: StressInput, repo: Repo):
    record = confirmed(repo, thesis_id)
    previous = repo.history(thesis_id)["selected_assessment"]
    historical = previous is not None and previous["mode"] == "HISTORICAL_REPLAY"
    cutoff = (
        datetime.fromisoformat(previous["evidence_cutoff"])
        if historical
        else utc_now().replace(second=0, microsecond=0)
    )
    result = assessment(
        record,
        [Evidence.model_validate(item) for item in previous["evidence"]] if previous else [],
        cutoff,
        body,
        previous["mode"] if previous else "CONTROLLED_SCENARIO",
        previous.get("disclosure_retrieval") if previous else None,
    )
    repo.assess(thesis_id, record["version"], result)
    return result["numerical"]


@router.get("/theses/{thesis_id}/assessments")
def history(thesis_id: str, repo: Repo):
    return repo.history(thesis_id)


@router.post("/replays/{case_id}/step")
def replay(case_id: str, body: ReplayInput, repo: Repo):
    if case_id not in CASES:
        raise HTTPException(404, "Unknown bundled replay case")
    record = confirmed(repo, body.thesis_id)
    if record["thesis"]["instrument_id"] != "RNVDAUSDT":
        raise HTTPException(409, "Historical replay is currently available for NVIDIA only")
    if record["version"] != body.expected_version:
        raise ConflictError("Version changed; reload")
    cutoff = CUTOFFS[body.step]
    previous = repo.history(body.thesis_id)["selected_assessment"]
    scenario = StressInput.model_validate(previous["scenario"]) if previous else StressInput()
    result = assessment(record, available_evidence(cutoff), cutoff, scenario, "HISTORICAL_REPLAY")
    return repo.assess(body.thesis_id, record["version"], result)


@router.post("/theses/{thesis_id}/refresh")
def refresh(thesis_id: str, repo: Repo, provider: Provider, disclosures: Disclosures):
    record = confirmed(repo, thesis_id)
    instrument_id = record["thesis"]["instrument_id"]
    market = provider.snapshot(instrument_id)
    documents = disclosures.snapshot(instrument_id)
    result = assessment(
        record,
        documents.evidence,
        utc_now(),
        StressInput(),
        "LIVE_REFRESH",
        documents.model_dump(mode="json", exclude={"evidence"}),
    )
    result["market"] = market
    result["market_execution"] = market_execution(
        ThesisInput.model_validate(record["thesis"]), market
    )
    result["input_hash"] = digest(
        {
            "assessment": result["input_hash"],
            "market": market,
            "retrieval": result["disclosure_retrieval"],
        }
    )
    result["result_hash"] = digest(
        {
            key: value
            for key, value in result.items()
            if key not in {"input_hash", "result_hash", "evaluated_at"}
        }
    )
    return repo.assess(thesis_id, record["version"], result)


@router.post("/theses/{thesis_id}/ai-review")
def ai_review(thesis_id: str, repo: Repo, llm: LLM):
    record = confirmed(repo, thesis_id)
    previous = repo.history(thesis_id)["selected_assessment"]
    if not previous or not previous["evidence"]:
        raise HTTPException(409, "Load a disclosure replay or refresh public evidence first")
    source_hash = previous.get("narrative_source_input_hash", previous["input_hash"])
    metadata = provenance(llm.descriptor, REVIEW_PROMPT_VERSION)
    input_hash = digest(
        {
            "source_assessment": source_hash,
            "provider": metadata["provider"],
            "model": metadata["model"],
            "prompt_version": metadata["prompt_version"],
        }
    )
    cached = repo.assessment_by_hash(thesis_id, input_hash)
    if cached:
        return repo.assess(thesis_id, record["version"], cached)
    evidence = [Evidence.model_validate(item) for item in previous["evidence"]]
    review = llm.review(ThesisInput.model_validate(record["thesis"]), evidence)
    result = {
        **previous,
        "evaluated_at": utc_now().isoformat(),
        "narrative_review": review.model_dump(mode="json"),
        "narrative_source_input_hash": source_hash,
        "llm_provenance": metadata,
        "next_question": review.next_question,
        "input_hash": input_hash,
    }
    result["missing"] = [item for item in result["missing"] if "Narrative AI review" not in item]
    result["result_hash"] = digest(
        {
            "source_result_hash": previous["result_hash"],
            "narrative_review": result["narrative_review"],
            "llm": metadata,
        }
    )
    return repo.assess(thesis_id, record["version"], result)


@router.get("/theses/{thesis_id}/questions", response_model=list[SavedResearchAnswer])
def research_questions(thesis_id: str, repo: Repo):
    return repo.research_answers(thesis_id)


@router.post("/theses/{thesis_id}/questions", response_model=SavedResearchAnswer)
def answer_research_question(thesis_id: str, body: ResearchQuestionInput, repo: Repo, llm: LLM):
    confirmed(repo, thesis_id)
    selected = repo.history(thesis_id)["selected_assessment"]
    if not selected or selected["input_hash"] != body.assessment_input_hash:
        raise HTTPException(409, "The evidence context changed; reload before asking")
    if not selected["evidence"]:
        raise HTTPException(409, "No saved evidence is available for a cited answer")
    selected_record = repo.get_version(thesis_id, selected["thesis_version"])
    metadata = provenance(llm.descriptor, QUESTION_PROMPT_VERSION)
    question = body.question.strip()
    input_hash = digest(
        {
            "thesis_id": thesis_id,
            "version": selected["thesis_version"],
            "assessment_input_hash": selected["input_hash"],
            "question": question,
            "provider": metadata["provider"],
            "model": metadata["model"],
            "prompt_version": metadata["prompt_version"],
        }
    )
    cached = repo.research_answer_by_hash(thesis_id, input_hash)
    if cached:
        return cached
    evidence = [Evidence.model_validate(item) for item in selected["evidence"]]
    answer = llm.answer(ThesisInput.model_validate(selected_record["thesis"]), evidence, question)
    saved = SavedResearchAnswer(
        id=str(uuid4()),
        thesis_id=thesis_id,
        thesis_version=selected["thesis_version"],
        assessment_input_hash=selected["input_hash"],
        question=question,
        answer=answer,
        llm_provenance=metadata,
        input_hash=input_hash,
        created_at=utc_now(),
    )
    return repo.save_research_answer(saved.model_dump(mode="json"))


@router.post("/theses/{thesis_id}/revisions")
def revise(thesis_id: str, body: RevisionInput, repo: Repo):
    current = confirmed(repo, thesis_id)
    if current["version"] != body.expected_version:
        raise ConflictError("Version changed; reload before revising")
    previous = repo.history(thesis_id)["selected_assessment"]
    available_ids = {item["id"] for item in previous["evidence"]} if previous else set()
    if not set(body.evidence_ids) <= available_ids:
        raise HTTPException(422, "Revision evidence must have appeared in a saved assessment")
    data = body.model_dump(mode="json", exclude={"expected_version", "explanation", "evidence_ids"})
    proposed = ThesisInput.model_validate(data)
    changes = revision_changes(ThesisInput.model_validate(current["thesis"]), proposed)
    if not changes:
        raise HTTPException(422, "No thesis change; use retain instead")
    result = None
    if previous:
        cutoff = datetime.fromisoformat(previous["evidence_cutoff"])
        evidence = [Evidence.model_validate(item) for item in previous["evidence"]]
        proposed_record = {**current, "thesis": data, "version": body.expected_version + 1}
        result = assessment(
            proposed_record,
            evidence,
            cutoff,
            StressInput.model_validate(previous["scenario"]),
            previous["mode"],
            previous.get("disclosure_retrieval"),
        )
    return repo.evolve(
        thesis_id,
        body.expected_version,
        {"thesis": data},
        {
            "action": "revise",
            "explanation": body.explanation,
            "changes": changes,
            "evidence_ids": body.evidence_ids,
        },
        reassessment=result,
    )


@router.post("/theses/{thesis_id}/decisions")
def decide(thesis_id: str, body: DecisionInput, repo: Repo):
    confirmed(repo, thesis_id)
    return repo.evolve(
        thesis_id,
        body.expected_version,
        {"retired": body.action == "retire"},
        {"action": body.action, "explanation": body.explanation},
    )


@router.get("/theses/{thesis_id}/export")
def export_thesis(
    thesis_id: str,
    repo: Repo,
    format: Literal["markdown", "json"] = Query("markdown"),
    version: int | None = Query(None, ge=1),
):
    snapshot = research_snapshot(repo, thesis_id, version)
    ticker = snapshot["instrument"]["ticker"].lower()
    suffix = "md" if format == "markdown" else "json"
    filename = f"reviso-{ticker}-v{snapshot['thesis']['version']}.{suffix}"
    content = (
        markdown_snapshot(snapshot)
        if format == "markdown"
        else json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n"
    )
    media_type = "text/markdown; charset=utf-8" if format == "markdown" else "application/json"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/evidence/{evidence_id}", response_model=Evidence)
def get_evidence(evidence_id: str, repo: Repo):
    try:
        return evidence_by_id(evidence_id)
    except KeyError:
        return repo.evidence(evidence_id)


@router.get("/market")
def market(provider: Provider, instrument_id: InstrumentId = "RNVDAUSDT"):
    return provider.snapshot(instrument_id)
