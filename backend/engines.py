"""Pure Decimal calculations. No probability or news-to-price mapping."""

from datetime import datetime
from decimal import Decimal

from backend.contracts import BookLevel, Reference, StressInput, ThesisInput

D = Decimal


def walk_bids(quantity: Decimal, bids: list[BookLevel], reference: Decimal) -> dict:
    remainder, proceeds = quantity, D(0)
    for level in sorted(bids, key=lambda item: item.price, reverse=True):
        filled = min(remainder, level.quantity)
        proceeds += filled * level.price
        remainder -= filled
        if remainder == 0:
            break
    filled = quantity - remainder
    vwap = proceeds / filled if filled else None
    return {
        "filled_quantity": str(filled),
        "proceeds": str(proceeds),
        "vwap": str(vwap) if vwap is not None else None,
        "slippage_bps": str((reference - vwap) / reference * 10000) if vwap else None,
        "remainder": str(remainder),
        "full_position_evaluable": remainder == 0,
    }


def premium(
    token: Reference, share: Reference, as_of: datetime, max_age_seconds: int = 60
) -> Decimal:
    if token.underlying != share.underlying or token.currency != share.currency:
        raise ValueError("Incompatible underlying or quote currency")
    if abs((token.observed_at - share.observed_at).total_seconds()) > max_age_seconds:
        raise ValueError("Reference observations are not synchronized")
    if any(
        not 0 <= (as_of - item.observed_at).total_seconds() <= max_age_seconds
        for item in (token, share)
    ):
        raise ValueError("Reference observations are stale or in the future")
    if share.token_units_per_share != 1:
        raise ValueError("Reference must be one share")
    return (token.price * token.token_units_per_share / share.price - 1) * 100


def price_pnl(amount: Decimal, move: Decimal, fee_bps: Decimal) -> Decimal:
    exit_value = amount * (1 + move / 100)
    return exit_value * (1 - fee_bps / 10000) - amount


def stress(thesis: ThesisInput, scenario: StressInput) -> dict:
    quantity = thesis.proposed_amount / thesis.entry_price
    exit_mid = thesis.entry_price * (1 + scenario.price_move_pct / 100)
    execution = None
    if scenario.bids is not None and exit_mid > 0:
        shocked = [
            # Inputs are validated; derived Decimal values may exceed the input
            # precision cap. Preserve them without rounding or revalidation.
            level.model_copy(
                update={
                    "price": level.price
                    * (1 + scenario.price_move_pct / 100)
                    * (1 - scenario.spread_bps / 20000),
                    "quantity": level.quantity * scenario.depth_multiplier,
                }
            )
            for level in scenario.bids
        ]
        execution = walk_bids(quantity, shocked, exit_mid)
        execution["net_proceeds"] = str(D(execution["proceeds"]) * (1 - scenario.fee_bps / 10000))
        execution["full_position_pnl"] = (
            str(D(execution["net_proceeds"]) - thesis.proposed_amount)
            if execution["full_position_evaluable"]
            else None
        )
        slippage = execution["slippage_bps"]
        execution["slippage_breach"] = (
            D(slippage) > thesis.max_slippage_bps if slippage is not None else None
        )
    pnl = price_pnl(thesis.proposed_amount, scenario.price_move_pct, scenario.fee_bps)
    boundary = next(
        (
            D(tick) / 10
            for tick in range(1001)
            if -price_pnl(thesis.proposed_amount, -D(tick) / 10, scenario.fee_bps) > thesis.max_loss
        ),
        None,
    )
    return {
        "mode": "CONTROLLED_SCENARIO",
        "quantity": str(quantity),
        "price_pnl": str(pnl),
        "loss_breach": -pnl > thesis.max_loss,
        "execution": execution,
        "premium": None,
        "premium_reason": "No synchronized USD/USDT-adjusted share reference and verified unit ratio.",
        "breaking_move_pct": str(-boundary) if boundary is not None else None,
        "search": "Smallest found within the tested scenario set: price decline 0–100%, 0.1 percentage-point steps; strict loss > limit. Spread/depth fixed; no mixed-shock optimum claimed.",
        "costs": "Exit fee included at declared bps; entry fees, taxes and FX omitted. Spread is an additional symmetric shock around midpoint. Depth is not a fill guarantee.",
    }
