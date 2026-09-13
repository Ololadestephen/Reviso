"""Assessment-bound research chat. Threads follow filing and condition content, not timestamps."""

from uuid import uuid4

from backend.contracts import (
    ConversationThread,
    Evidence,
    SavedResearchAnswer,
    ThesisInput,
    utc_now,
)
from backend.llm import HISTORY_TURNS, QUESTION_PROMPT_VERSION, provenance
from backend.services import digest, narrative_context_hash
from backend.storage import Repository


def context_for(record: dict, assessment: dict) -> tuple[ThesisInput, list[Evidence], str]:
    thesis = ThesisInput.model_validate(record["thesis"])
    evidence = [Evidence.model_validate(item) for item in assessment["evidence"]]
    return thesis, evidence, narrative_context_hash(thesis, evidence)


def empty_thread(thesis_id: str, version: int, assessment_hash: str, context_hash: str) -> dict:
    return ConversationThread(
        thesis_id=thesis_id,
        thesis_version=version,
        assessment_input_hash=assessment_hash,
        context_hash=context_hash,
        messages=[],
    ).model_dump(mode="json")


def cited_ids(review: dict) -> list[str]:
    ids: list[str] = []
    for item in review.get("items", []):
        ids.extend(item.get("evidence_ids") or [])
    return list(dict.fromkeys(ids))


def seed_explanation(thread: dict, review: dict) -> dict:
    if any(item.get("kind") == "explanation" for item in thread["messages"]):
        return thread
    ids = cited_ids(review)
    thread["messages"].append(
        {
            "id": str(uuid4()),
            "role": "assistant",
            "kind": "explanation",
            "text": review["summary"],
            "question": None,
            "answer": {
                "summary": review["summary"],
                "facts": [
                    f"{item['assumption_id']}: {item['stance']}" for item in review.get("items", [])
                ][:4],
                "uncertainty": review.get("next_question")
                or "The next reporting period remains unknown.",
                "evidence_ids": ids,
            },
            "evidence_ids": ids,
            "created_at": utc_now().isoformat(),
        }
    )
    return thread


def conversation_for(repo: Repository, thesis_id: str, selected: dict, record: dict) -> dict:
    _thesis, _evidence, context_hash = context_for(record, selected)
    thread = repo.thread(thesis_id, context_hash) or empty_thread(
        thesis_id, selected["thesis_version"], selected["input_hash"], context_hash
    )
    thread["assessment_input_hash"] = selected["input_hash"]
    thread["thesis_version"] = selected["thesis_version"]
    if selected.get("narrative_review"):
        thread = seed_explanation(thread, selected["narrative_review"])
        repo.save_thread(thread)
    return thread


def history_payload(thread: dict) -> list[dict[str, str]]:
    return [
        {"role": item["role"], "text": item["text"][:400]}
        for item in thread["messages"][-HISTORY_TURNS:]
        if item.get("role") in {"user", "assistant"} and item.get("text")
    ]


def last_turn(thread: dict) -> tuple[str | None, bool]:
    for item in reversed(thread["messages"]):
        if item.get("role") == "user":
            return item.get("question") or item.get("text"), item.get("kind") == "detail"
    return None, False


def append_exchange(
    repo: Repository,
    llm,
    record: dict,
    selected: dict,
    question: str,
    detail: bool,
) -> dict:
    thesis, evidence, context_hash = context_for(record, selected)
    thread = conversation_for(repo, record["id"], selected, record)
    last_question, last_detail = last_turn(thread)
    if last_question == question and last_detail == detail:
        return thread
    input_hash = digest(
        {
            "thesis_id": record["id"],
            "context_hash": context_hash,
            "question": question,
            "detail": detail,
            "history": history_payload(thread),
            "provider": llm.descriptor.provider,
            "model": llm.descriptor.model,
            "prompt_version": QUESTION_PROMPT_VERSION,
        }
    )
    cached = repo.research_answer_by_hash(record["id"], input_hash)
    if cached:
        return thread_with_cached_turn(thread, cached, repo)

    answer = llm.answer(thesis, evidence, question, history=history_payload(thread), detail=detail)
    metadata = provenance(
        llm.descriptor, QUESTION_PROMPT_VERSION, getattr(llm, "last_timing", None)
    )
    now = utc_now().isoformat()
    user_id = str(uuid4())
    assistant_id = str(uuid4())
    thread["messages"].extend(
        [
            {
                "id": user_id,
                "role": "user",
                "kind": "detail" if detail else "followup",
                "text": question,
                "question": question,
                "answer": None,
                "evidence_ids": [],
                "created_at": now,
            },
            {
                "id": assistant_id,
                "role": "assistant",
                "kind": "detail" if detail else "followup",
                "text": answer.summary,
                "question": question,
                "answer": answer.model_dump(mode="json"),
                "evidence_ids": answer.evidence_ids,
                "created_at": now,
            },
        ]
    )
    repo.save_thread(thread)
    saved = SavedResearchAnswer(
        id=assistant_id,
        thesis_id=record["id"],
        thesis_version=selected["thesis_version"],
        assessment_input_hash=selected["input_hash"],
        question=question,
        answer=answer,
        llm_provenance=metadata,
        input_hash=input_hash,
        created_at=utc_now(),
    )
    repo.save_research_answer(saved.model_dump(mode="json"))
    return thread


def thread_with_cached_turn(thread: dict, cached: dict, repo: Repository) -> dict:
    if any(item.get("id") == cached["id"] for item in thread["messages"]):
        return thread
    now = cached["created_at"]
    thread["messages"].extend(
        [
            {
                "id": f"{cached['id']}-q",
                "role": "user",
                "kind": "followup",
                "text": cached["question"],
                "question": cached["question"],
                "answer": None,
                "evidence_ids": [],
                "created_at": now,
            },
            {
                "id": cached["id"],
                "role": "assistant",
                "kind": "followup",
                "text": cached["answer"]["summary"],
                "question": cached["question"],
                "answer": cached["answer"],
                "evidence_ids": cached["answer"]["evidence_ids"],
                "created_at": now,
            },
        ]
    )
    return repo.save_thread(thread)
