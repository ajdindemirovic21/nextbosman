"""One-player listing fetch worker. Not part of the Next.js bundle.

Requires AUTO_REFRESH_LIVE=1 and AUTO_REFRESH_ENABLE_FETCH=1.
Python + transfermarkt-api stay in an isolated venv, not package.json.
No retries. JSON on stdout. Do not print secrets.

Stub (tests, no network): set AUTO_REFRESH_STUB_JSON to a profile JSON file.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from datetime import date, datetime
from typing import Any


def emit(payload: dict[str, Any], code: int) -> int:
    json.dump(payload, sys.stdout, default=str)
    sys.stdout.write("\n")
    return code


def iso_date(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    text = str(value).strip()
    return text or None


def from_stub(path: str, player_id: str) -> int:
    with open(path, encoding="utf-8") as handle:
        raw = json.load(handle)
    club = raw.get("club") or {}
    updated = raw.get("updatedAt") or raw.get("updated_at") or raw.get("fetched_at_utc")
    payload = {
        "ok": True,
        "id": str(raw.get("id") or player_id),
        "updatedAt": iso_date(updated),
        "isRetired": raw.get("isRetired") if "isRetired" in raw else raw.get("is_retired"),
        "club": {
            "id": club.get("id") or raw.get("club_id"),
            "name": club.get("name") or raw.get("club_name"),
            "contractExpires": iso_date(club.get("contractExpires") or club.get("contract_expires") or raw.get("contractExpires")),
            "joined": iso_date(club.get("joined") or raw.get("joined")),
        },
        "marketValueLastUpdated": iso_date(
            raw.get("marketValueLastUpdated")
            or ((raw.get("marketValueDetails") or raw.get("market_value_details") or {}).get("last_updated"))
        ),
    }
    return emit(payload, 0)


async def from_sdk(player_id: str, timeout: float) -> int:
    from transfermarkt_api import (  # type: ignore
        NotFound,
        Transfermarkt,
        TransfermarktError,
        UpstreamBlocked,
        UpstreamTimeout,
    )

    async with Transfermarkt(timeout=timeout, max_concurrency=1) as tm:
        try:
            profile = await tm.player_profile(player_id)
        except UpstreamBlocked as error:
            return emit(
                {
                    "ok": False,
                    "kind": "blocked",
                    "status": getattr(error, "status_code", None),
                    "message": "upstream_blocked",
                },
                2,
            )
        except (UpstreamTimeout, TimeoutError) as error:
            return emit(
                {
                    "ok": False,
                    "kind": "timeout",
                    "status": getattr(error, "status_code", None),
                    "message": "upstream_timeout",
                },
                3,
            )
        except NotFound:
            return emit({"ok": False, "kind": "not_found", "status": 404, "message": "not_found"}, 4)
        except TransfermarktError as error:
            status = getattr(error, "status_code", None)
            kind = "blocked" if status in (403, 429) else "error"
            return emit(
                {"ok": False, "kind": kind, "status": status, "message": type(error).__name__},
                2 if kind == "blocked" else 4,
            )

    club = profile.club
    details = profile.market_value_details
    return emit(
        {
            "ok": True,
            "id": str(profile.id),
            "updatedAt": iso_date(getattr(profile, "updated_at", None)),
            "isRetired": bool(profile.is_retired),
            "club": {
                "id": getattr(club, "id", None),
                "name": getattr(club, "name", None),
                "contractExpires": iso_date(getattr(club, "contract_expires", None)),
                "joined": iso_date(getattr(club, "joined", None)),
            },
            "marketValueLastUpdated": iso_date(getattr(details, "last_updated", None) if details is not None else None),
        },
        0,
    )


def main(argv: list[str]) -> int:
    if os.environ.get("AUTO_REFRESH_LIVE") != "1" or os.environ.get("AUTO_REFRESH_ENABLE_FETCH") != "1":
        return emit({"ok": False, "kind": "disabled", "message": "fetch_disabled"}, 2)
    if len(argv) != 2:
        return emit({"ok": False, "kind": "invalid", "message": "exactly_one_player_id"}, 2)
    player_id = argv[1].strip()
    stub = os.environ.get("AUTO_REFRESH_STUB_JSON", "").strip()
    if stub:
        if os.environ.get("AUTO_REFRESH_ALLOW_STUB") != "1":
            return emit({"ok": False, "kind": "invalid", "message": "stub_forbidden_in_live"}, 2)
        return from_stub(stub, player_id)
    timeout = float(os.environ.get("AUTO_REFRESH_TIMEOUT_SEC") or "15")
    return asyncio.run(from_sdk(player_id, timeout))


if __name__ == "__main__":
    if os.environ.get("AUTO_REFRESH_ALLOW_STUB") == "1" and os.environ.get("AUTO_REFRESH_STUB_JSON", "").strip():
        raise SystemExit(main(sys.argv))
    if sys.version_info < (3, 12) or sys.version_info >= (3, 14):
        raise SystemExit(
            emit(
                {
                    "ok": False,
                    "kind": "error",
                    "message": f"python_{sys.version.split()[0]}_unsupported",
                },
                1,
            )
        )
    raise SystemExit(main(sys.argv))
