"""Bounded public market bridge; no credentials or private thesis sent to Bitget."""

import json
import os
import shutil
import subprocess
import threading
import time
from pathlib import Path

from backend.contracts import InstrumentId, utc_now
from backend.instruments import instrument_by_id
from backend.market import normalized_market, unavailable_market

ROOT = Path(__file__).resolve().parent.parent


class BitgetProvider:
    def __init__(self):
        self._lock = threading.Lock()
        self._cached: dict[InstrumentId, tuple[dict, float]] = {}

    def snapshot(self, instrument_id: InstrumentId = "RNVDAUSDT") -> dict:
        with self._lock:
            cached = self._cached.get(instrument_id)
            if cached is not None and time.monotonic() < cached[1]:
                return {**cached[0], "cached": True}
            result = self._fetch(instrument_id)
            self._cached[instrument_id] = (result, time.monotonic() + 30)
            return result

    def _fetch(self, instrument_id: InstrumentId) -> dict:
        retrieved = utc_now().isoformat()
        instrument = instrument_by_id(instrument_id)
        try:
            executable = shutil.which("node")
            if executable is None:
                raise OSError("Node runtime unavailable")
            process = subprocess.run(
                [executable, str(ROOT / "bridge/market.mjs"), instrument.provider_symbol],
                cwd=ROOT,
                capture_output=True,
                text=True,
                timeout=22,
                check=False,
                env={"PATH": os.defpath},
            )
            if process.returncode != 0 or len(process.stdout) > 1_000_000:
                raise ValueError("Bridge failed or returned an oversized response")
            data = json.loads(process.stdout, parse_float=str)
            if not isinstance(data, dict) or data.get("instrument_id") != instrument_id:
                raise ValueError("Unexpected bridge response")
            return {**normalized_market(data, utc_now(), instrument), "cached": False}
        except (OSError, subprocess.TimeoutExpired, ValueError):
            return {
                **unavailable_market(
                    utc_now(),
                    instrument_id,
                    ["Public SDK bridge unavailable; no market values substituted."],
                ),
                "retrieved_at": retrieved,
                "cached": False,
            }
