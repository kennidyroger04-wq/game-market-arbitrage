#!/usr/bin/env python3
"""OSRS Wiki v2 bulk snapshot for a static Github Pages market dashboard.

High and low are last executed instant-buy/instant-sell trades, NOT open orders.
"""
import json
import os
import sys
import time
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from datetime import datetime, timezone

BASE = os.environ.get("OSRS_API_BASE", "https://prices.runescape.wiki/api/v2/osrs").rstrip("/")
REPO = os.environ.get("GITHUB_REPOSITORY", "kennidyroger04-wq/game-market-arbitrage")
USER_AGENT = "GameMarketArbitrage/1.0 (https://github.com/" + REPO + "/issues)"
OUTPUT = Path(os.environ.get("SNAPSHOT_PATH", "data/osrs-snapshot.json"))


def download(endpoint):
    req = Request(BASE + "/" + endpoint, headers={
        "User-Agent": USER_AGENT, "Accept": "application/json"
    })
    for attempt in range(3):
        try:
            with urlopen(req, timeout=25) as resp:
                if resp.status != 200:
                    raise RuntimeError("HTTP " + str(resp.status))
                return json.load(resp)
        except (HTTPError, URLError, TimeoutError) as exc:
            if attempt >= 2:
                raise RuntimeError("Falha em " + endpoint + ": " + str(exc)) from exc
            delay = 4 * 2 ** attempt
            print("Aviso: " + endpoint + ": " + str(exc), file=sys.stderr)
            time.sleep(delay)


def extract_data(payload, label):
    if not isinstance(payload, dict) or not isinstance(payload.get("data"), dict):
        raise ValueError("API " + label + ": data precisa ser objeto")
    return payload["data"]


def parse_mapping(payload):
    if isinstance(payload, dict):
        payload = payload.get("data", payload)
    if not isinstance(payload, list):
        raise ValueError("API mapping: esperado array")
    return {str(x["id"]): x for x in payload if isinstance(x, dict) and "id" in x}


def build_rows(mapping, latest, five, hourly, day):
    output = []
    for key, point in latest.items():
        meta = mapping.get(str(key))
        if not meta or not isinstance(point, dict):
            continue
        low, high = point.get("low"), point.get("high")
        if not isinstance(low, (int, float)) or not isinstance(high, (int, float)) or low <= 0 or high <= 0:
            continue

        def volume(aggregation):
            record = aggregation.get(str(key), {})
            if not isinstance(record, dict):
                return 0
            return int(max(0, record.get("highPriceVolume") or 0) +
                       max(0, record.get("lowPriceVolume") or 0))

        if not volume(day):
            continue
        output.append({
            "id": int(key), "name": str(meta.get("name") or ("Item " + str(key))),
            "members": meta.get("members") is True,
            "limit": int(meta.get("limit") or 0),
            "high": int(high), "highTime": int(point.get("highTime") or 0),
            "low": int(low), "lowTime": int(point.get("lowTime") or 0),
            "volume5": volume(five), "volume1h": volume(hourly),
            "volume24": volume(day),
        })
    return output


def main():
    start = time.monotonic()
    mapping = parse_mapping(download("mapping"))
    latest = extract_data(download("latest"), "latest")
    five = extract_data(download("5m"), "5m")
    hourly = extract_data(download("1h"), "1h")
    day = extract_data(download("24h"), "24h")
    rows = build_rows(mapping, latest, five, hourly, day)
    if len(rows) < 100:
        raise RuntimeError("Quantidade anormal de itens (" + str(len(rows)) + "); snapshot rejeitado.")
    snapshot = {
        "schema_version": 1, "game": "osrs", "api_version": "v2",
        "source": BASE, "fetched_at": datetime.now(timezone.utc).isoformat(),
        "notes": "high/low: transacoes executadas, nao ordens pendentes",
        "items": rows
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temp = OUTPUT.with_suffix(".tmp")
    temp.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    temp.replace(OUTPUT)
    print("Publicado snapshot de", len(rows), "itens em", OUTPUT, "em", round(time.monotonic() - start, 1), "s")


if __name__ == "__main__":
    main()
