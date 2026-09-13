"""Issuer-bound company evidence with explicit, conservative recovery paths."""

from backend.contracts import InstrumentId
from backend.disclosures import DisclosureSnapshot, NvidiaDisclosureProvider
from backend.sec_companyfacts import SecCompanyFactsProvider


class CompanyDisclosureProvider:
    def __init__(
        self,
        nvidia: NvidiaDisclosureProvider | None = None,
        sec: SecCompanyFactsProvider | None = None,
    ):
        self.nvidia = nvidia or NvidiaDisclosureProvider()
        self.sec = sec or SecCompanyFactsProvider()

    def close(self):
        self.nvidia.close()
        self.sec.close()

    def snapshot(self, instrument_id: InstrumentId) -> DisclosureSnapshot:
        if instrument_id != "RNVDAUSDT":
            return self.sec.snapshot(instrument_id)
        primary = self.nvidia.snapshot()
        if primary.availability != "UNAVAILABLE":
            return primary
        recovery = self.sec.snapshot(instrument_id)
        if recovery.availability == "UNAVAILABLE":
            return recovery.model_copy(
                update={"warnings": [*primary.warnings, *recovery.warnings]}, deep=True
            )
        return recovery.model_copy(
            update={
                "warnings": [
                    *primary.warnings,
                    "Recovered through NVIDIA's issuer-bound SEC company facts. This is retrieval redundancy, not independent corroboration.",
                    *recovery.warnings,
                ]
            },
            deep=True,
        )
