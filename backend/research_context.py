"""Trusted, saved comparison context for bounded AI explanations."""

from dataclasses import dataclass
from typing import TypedDict

from backend.contracts import AssumptionResult, State


class SavedFinding(TypedDict):
    mode: str
    state: str
    evidence_cutoff: str
    assumptions: list[dict[str, object]]


class CachedFinding(TypedDict):
    state: str
    conditions: list[dict[str, object]]


class PromptFinding(CachedFinding):
    mode: str
    evidence_cutoff: str


@dataclass(frozen=True)
class ResearchContext:
    mode: str
    state: State
    evidence_cutoff: str
    conditions: tuple[AssumptionResult, ...]

    @classmethod
    def from_assessment(cls, assessment: SavedFinding) -> "ResearchContext":
        return cls(
            mode=assessment["mode"],
            state=State(assessment["state"]),
            evidence_cutoff=assessment["evidence_cutoff"],
            conditions=tuple(
                AssumptionResult.model_validate(item) for item in assessment["assumptions"]
            ),
        )

    def cache_payload(self) -> CachedFinding:
        # A refreshed timestamp alone need not spend credit. Changed outcomes,
        # including freshness-driven missing evidence, must invalidate reuse.
        return {
            "state": self.state.value,
            "conditions": [item.model_dump(mode="json") for item in self.conditions],
        }

    def prompt_payload(self) -> PromptFinding:
        return {
            **self.cache_payload(),
            "mode": self.mode,
            "evidence_cutoff": self.evidence_cutoff,
        }
