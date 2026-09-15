"""HTTP routes; services own assessment and repositories own persistence."""

import json
from datetime import datetime
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response

from backend.auth import (
    AuthSettings,
    GoogleLoginInput,
    SimulateLoginInput,
    clear_session_cookies,
    google_principal,
    require_principal,
    session_token,
    set_session_cookies,
    simulated_principal,
)
from backend.company_disclosures import CompanyDisclosureProvider
from backend.contracts import (
    Confirmation,
    ConversationInput,
    ConversationThread,
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
    XStocksContext,
    utc_now,
)
from backend.exports import markdown_snapshot, pdf_snapshot, research_snapshot
from backend.google_token import GoogleTokenVerifier, InvalidGoogleToken
from backend.identity import Principal
from backend.instruments import INSTRUMENTS, NVIDIA, Instrument, instrument_by_id
from backend.llm import (
    EXTRACTION_PROMPT_VERSION,
    QUESTION_PROMPT_VERSION,
    REVIEW_PROMPT_VERSION,
    LanguageModel,
    provenance,
)
from backend.llm_budget import track_llm_usage
from backend.market import market_execution
from backend.providers import BitgetProvider
from backend.replay import CASES, CUTOFFS, available_evidence, evidence_by_id
from backend.research_chat import append_exchange, conversation_for
from backend.services import assessment, digest, narrative_context_hash, revision_changes
from backend.storage import ConflictError, LlmLimits, Repository
from backend.xstocks import XStocksProvider

router = APIRouter()


def get_repository(request: Request) -> Repository:
    return request.app.state.repository


def get_provider(request: Request) -> BitgetProvider:
    return request.app.state.provider


def get_xstocks(request: Request) -> XStocksProvider:
    return request.app.state.xstocks


def get_llm(request: Request) -> LanguageModel:
    return request.app.state.llm


def get_disclosures(request: Request) -> CompanyDisclosureProvider:
    return request.app.state.disclosures


def get_deployment_mode(
    request: Request,
) -> Literal["local_single_user", "private_demo"]:
    return request.app.state.deployment_mode


def get_auth_settings(request: Request) -> AuthSettings:
    return request.app.state.auth


def get_limits(request: Request) -> LlmLimits:
    return request.app.state.llm_limits


def get_google_verifier(request: Request) -> GoogleTokenVerifier | None:
    return request.app.state.google_verifier


Repo = Annotated[Repository, Depends(get_repository)]
Provider = Annotated[BitgetProvider, Depends(get_provider)]
XStocks = Annotated[XStocksProvider, Depends(get_xstocks)]
LLM = Annotated[LanguageModel, Depends(get_llm)]
Disclosures = Annotated[CompanyDisclosureProvider, Depends(get_disclosures)]
DeploymentMode = Annotated[
    Literal["local_single_user", "private_demo"], Depends(get_deployment_mode)
]
Owner = Annotated[Principal, Depends(require_principal)]
Limits = Annotated[LlmLimits, Depends(get_limits)]
Auth = Annotated[AuthSettings, Depends(get_auth_settings)]
Verifier = Annotated[GoogleTokenVerifier | None, Depends(get_google_verifier)]


def confirmed(repo: Repository, owner_id: str, thesis_id: str) -> dict:
    record = repo.get(owner_id, thesis_id)
    if not record["confirmed"] or record["retired"]:
        raise HTTPException(409, "Confirm an active thesis first")
    return record


def paid(repo: Repository, owner_id: str, request_key: str, limits: LlmLimits, call):
    with track_llm_usage(repo, owner_id, request_key, limits):
        return call()


@router.get("/health")
def health(llm: LLM, mode: DeploymentMode, auth: Auth):
    return {"status": "ok", "llm": llm.descriptor.public(), "mode": mode, "auth": auth.mode}


@router.get("/auth/config")
def auth_config(auth: Auth):
    return auth.public()


@router.get("/auth/me")
def auth_me(owner: Owner):
    return owner.public()


@router.post("/auth/google")
def auth_google(
    body: GoogleLoginInput,
    repo: Repo,
    auth: Auth,
    verifier: Verifier,
    response: Response,
):
    if auth.mode != "google" or verifier is None:
        raise HTTPException(404, "Google sign-in is not configured")
    try:
        claims = verifier.verify(body.credential)
    except InvalidGoogleToken as error:
        raise HTTPException(401, "Google sign-in was rejected") from error
    principal, raw, csrf = google_principal(repo, claims)
    set_session_cookies(response, raw, csrf, secure=auth.cookie_secure)
    return principal.public()


@router.post("/auth/simulate")
def auth_simulate(body: SimulateLoginInput, repo: Repo, auth: Auth, response: Response):
    if auth.mode != "simulated":
        raise HTTPException(404, "Simulated sign-in is not configured")
    principal, raw, csrf = simulated_principal(repo, body.subject, body.email)
    set_session_cookies(response, raw, csrf, secure=auth.cookie_secure)
    return principal.public()


@router.post("/auth/logout")
def auth_logout(request: Request, repo: Repo, auth: Auth, response: Response):
    raw = session_token(request)
    if raw:
        repo.delete_session(raw)
    clear_session_cookies(response, secure=auth.cookie_secure)
    return {"ok": True}


@router.get("/llm/status")
def llm_status(llm: LLM, owner: Owner):
    return llm.descriptor.public()


@router.post("/theses/extract")
def extract_thesis(body: ThesisExtractionInput, llm: LLM, repo: Repo, owner: Owner, limits: Limits):
    key = digest(
        {
            "action": "extract",
            "owner": owner.user_id,
            "current": body.current.model_dump(mode="json"),
        }
    )
    thesis = paid(repo, owner.user_id, key, limits, lambda: llm.extract(body.current))
    return {
        "thesis": thesis.model_dump(mode="json"),
        "provenance": provenance(llm.descriptor, EXTRACTION_PROMPT_VERSION),
        "warning": "AI proposal only. Review and correct every field before confirmation.",
    }


@router.post("/theses/suggest", response_model=ThesisSuggestion)
def suggest_assumptions(body: ThesisIdeaInput, llm: LLM, repo: Repo, owner: Owner, limits: Limits):
    key = digest(
        {
            "action": "suggest",
            "owner": owner.user_id,
            "instrument_id": body.instrument_id,
            "rationale": body.rationale,
        }
    )
    return paid(repo, owner.user_id, key, limits, lambda: llm.suggest(body))


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
def list_theses(repo: Repo, owner: Owner):
    return repo.summaries(owner.user_id)


@router.post("/theses/draft", status_code=201)
def draft(body: ThesisInput, repo: Repo, owner: Owner):
    return repo.create(owner.user_id, body.model_dump(mode="json"))


@router.get("/theses/{thesis_id}")
def get_thesis(thesis_id: str, repo: Repo, owner: Owner):
    return repo.get(owner.user_id, thesis_id)


@router.post("/theses/{thesis_id}/confirm")
def confirm(thesis_id: str, body: Confirmation, repo: Repo, owner: Owner):
    current = repo.get(owner.user_id, thesis_id)
    if current["confirmed"]:
        raise HTTPException(409, "Use an explicit revision for confirmed theses")
    return repo.evolve(
        owner.user_id,
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
def run_stress(thesis_id: str, body: StressInput, repo: Repo, owner: Owner):
    record = confirmed(repo, owner.user_id, thesis_id)
    previous = repo.history(owner.user_id, thesis_id)["selected_assessment"]
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
    repo.assess(owner.user_id, thesis_id, record["version"], result)
    return result["numerical"]


@router.get("/theses/{thesis_id}/assessments")
def history(thesis_id: str, repo: Repo, owner: Owner):
    return repo.history(owner.user_id, thesis_id)


@router.post("/replays/{case_id}/step")
def replay(case_id: str, body: ReplayInput, repo: Repo, owner: Owner):
    if case_id not in CASES:
        raise HTTPException(404, "Unknown bundled replay case")
    record = confirmed(repo, owner.user_id, body.thesis_id)
    if record["thesis"]["instrument_id"] != "RNVDAUSDT":
        raise HTTPException(409, "Historical replay is currently available for NVIDIA only")
    if record["version"] != body.expected_version:
        raise ConflictError("Version changed; reload")
    cutoff = CUTOFFS[body.step]
    previous = repo.history(owner.user_id, body.thesis_id)["selected_assessment"]
    scenario = StressInput.model_validate(previous["scenario"]) if previous else StressInput()
    result = assessment(record, available_evidence(cutoff), cutoff, scenario, "HISTORICAL_REPLAY")
    return repo.assess(owner.user_id, body.thesis_id, record["version"], result)


@router.post("/theses/{thesis_id}/refresh")
def refresh(thesis_id: str, repo: Repo, provider: Provider, disclosures: Disclosures, owner: Owner):
    record = confirmed(repo, owner.user_id, thesis_id)
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
    return repo.assess(owner.user_id, thesis_id, record["version"], result)


@router.post("/theses/{thesis_id}/ai-review")
def ai_review(thesis_id: str, repo: Repo, llm: LLM, owner: Owner, limits: Limits):
    record = confirmed(repo, owner.user_id, thesis_id)
    previous = repo.history(owner.user_id, thesis_id)["selected_assessment"]
    if not previous or not previous["evidence"]:
        raise HTTPException(409, "Load a disclosure replay or refresh public evidence first")
    thesis = ThesisInput.model_validate(record["thesis"])
    evidence = [Evidence.model_validate(item) for item in previous["evidence"]]
    context_hash = narrative_context_hash(thesis, evidence)
    if previous.get("narrative_review") and previous.get("narrative_context_hash") == context_hash:
        conversation_for(repo, owner.user_id, thesis_id, previous, record)
        return previous
    metadata = provenance(llm.descriptor, REVIEW_PROMPT_VERSION)
    input_hash = digest(
        {
            "narrative_context": context_hash,
            "provider": metadata["provider"],
            "model": metadata["model"],
            "prompt_version": metadata["prompt_version"],
            "base_assessment": previous["input_hash"],
        }
    )
    cached = repo.assessment_by_hash(owner.user_id, thesis_id, input_hash)
    if cached:
        saved = repo.assess(owner.user_id, thesis_id, record["version"], cached)
        conversation_for(repo, owner.user_id, thesis_id, saved, record)
        return saved
    reused = repo.assessment_with_narrative(owner.user_id, thesis_id, context_hash)
    if reused and reused.get("narrative_review"):
        result = attach_review(
            previous,
            reused["narrative_review"],
            reused.get("llm_provenance") or metadata,
            context_hash,
            input_hash,
        )
        saved = repo.assess(owner.user_id, thesis_id, record["version"], result)
        conversation_for(repo, owner.user_id, thesis_id, saved, record)
        return saved
    review = paid(repo, owner.user_id, input_hash, limits, lambda: llm.review(thesis, evidence))
    metadata = provenance(llm.descriptor, REVIEW_PROMPT_VERSION, getattr(llm, "last_timing", None))
    result = attach_review(
        previous, review.model_dump(mode="json"), metadata, context_hash, input_hash
    )
    saved = repo.assess(owner.user_id, thesis_id, record["version"], result)
    conversation_for(repo, owner.user_id, thesis_id, saved, record)
    return saved


def attach_review(
    previous: dict,
    review: dict,
    metadata: dict,
    context_hash: str,
    input_hash: str,
) -> dict:
    result = {
        **previous,
        "evaluated_at": utc_now().isoformat(),
        "narrative_review": review,
        "narrative_context_hash": context_hash,
        "narrative_source_input_hash": previous.get(
            "narrative_source_input_hash", previous["input_hash"]
        ),
        "llm_provenance": metadata,
        "next_question": review["next_question"],
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
    return result


@router.get("/theses/{thesis_id}/questions", response_model=list[SavedResearchAnswer])
def research_questions(thesis_id: str, repo: Repo, owner: Owner):
    return repo.research_answers(owner.user_id, thesis_id)


@router.post("/theses/{thesis_id}/questions", response_model=SavedResearchAnswer)
def answer_research_question(
    thesis_id: str, body: ResearchQuestionInput, repo: Repo, llm: LLM, owner: Owner, limits: Limits
):
    confirmed(repo, owner.user_id, thesis_id)
    selected = repo.history(owner.user_id, thesis_id)["selected_assessment"]
    if not selected or selected["input_hash"] != body.assessment_input_hash:
        raise HTTPException(409, "The evidence context changed; reload before asking")
    if not selected["evidence"]:
        raise HTTPException(409, "No saved evidence is available for a cited answer")
    selected_record = repo.get_version(owner.user_id, thesis_id, selected["thesis_version"])
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
    cached = repo.research_answer_by_hash(owner.user_id, thesis_id, input_hash)
    if cached:
        return cached
    evidence = [Evidence.model_validate(item) for item in selected["evidence"]]
    answer = paid(
        repo,
        owner.user_id,
        input_hash,
        limits,
        lambda: llm.answer(
            ThesisInput.model_validate(selected_record["thesis"]), evidence, question
        ),
    )
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
    return repo.save_research_answer(owner.user_id, saved.model_dump(mode="json"))


@router.get("/theses/{thesis_id}/conversation", response_model=ConversationThread)
def research_conversation(
    thesis_id: str,
    repo: Repo,
    owner: Owner,
    assessment_input_hash: str = Query(..., min_length=64, max_length=64),
):
    record = confirmed(repo, owner.user_id, thesis_id)
    selected = repo.history(owner.user_id, thesis_id)["selected_assessment"]
    if not selected or not selected["evidence"]:
        raise HTTPException(409, "No saved evidence is available for a cited answer")
    if selected["input_hash"] != assessment_input_hash:
        raise HTTPException(409, "The evidence context changed; reload before asking")
    return conversation_for(repo, owner.user_id, thesis_id, selected, record)


@router.post("/theses/{thesis_id}/conversation", response_model=ConversationThread)
def continue_research_conversation(
    thesis_id: str, body: ConversationInput, repo: Repo, llm: LLM, owner: Owner, limits: Limits
):
    record = confirmed(repo, owner.user_id, thesis_id)
    selected = repo.history(owner.user_id, thesis_id)["selected_assessment"]
    if not selected or selected["input_hash"] != body.assessment_input_hash:
        raise HTTPException(409, "The evidence context changed; reload before asking")
    if not selected["evidence"]:
        raise HTTPException(409, "No saved evidence is available for a cited answer")

    def run_paid(request_key: str, generate):
        return paid(repo, owner.user_id, request_key, limits, generate)

    return append_exchange(
        repo,
        llm,
        owner.user_id,
        record,
        selected,
        body.question.strip(),
        body.detail,
        run_paid=run_paid,
    )


@router.post("/theses/{thesis_id}/revisions")
def revise(thesis_id: str, body: RevisionInput, repo: Repo, owner: Owner):
    current = confirmed(repo, owner.user_id, thesis_id)
    if current["version"] != body.expected_version:
        raise ConflictError("Version changed; reload before revising")
    previous = repo.history(owner.user_id, thesis_id)["selected_assessment"]
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
        owner.user_id,
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
def decide(thesis_id: str, body: DecisionInput, repo: Repo, owner: Owner):
    confirmed(repo, owner.user_id, thesis_id)
    return repo.evolve(
        owner.user_id,
        thesis_id,
        body.expected_version,
        {"retired": body.action == "retire"},
        {"action": body.action, "explanation": body.explanation},
    )


@router.get("/theses/{thesis_id}/export")
def export_thesis(
    thesis_id: str,
    repo: Repo,
    owner: Owner,
    format: Literal["markdown", "json", "pdf"] = Query("markdown"),
    version: int | None = Query(None, ge=1),
):
    snapshot = research_snapshot(repo, owner.user_id, thesis_id, version)
    ticker = snapshot["instrument"]["ticker"].lower()
    suffix = {"markdown": "md", "json": "json", "pdf": "pdf"}[format]
    filename = f"reviso-{ticker}-v{snapshot['thesis']['version']}.{suffix}"
    if format == "pdf":
        content: str | bytes = pdf_snapshot(snapshot)
        media_type = "application/pdf"
    elif format == "markdown":
        content = markdown_snapshot(snapshot)
        media_type = "text/markdown; charset=utf-8"
    else:
        content = json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n"
        media_type = "application/json"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/evidence/{evidence_id}", response_model=Evidence)
def get_evidence(evidence_id: str, repo: Repo, request: Request):
    try:
        return evidence_by_id(evidence_id)
    except KeyError:
        principal = getattr(request.state, "principal", None)
        if principal is None:
            raise
        return repo.evidence(principal.user_id, evidence_id)


@router.get("/market")
def market(provider: Provider, instrument_id: InstrumentId = "RNVDAUSDT"):
    return provider.snapshot(instrument_id)


@router.get("/xstocks/context", response_model=XStocksContext)
def xstocks_context(xstocks: XStocks, instrument_id: InstrumentId = "RNVDAUSDT"):
    return xstocks.snapshot(instrument_id)
