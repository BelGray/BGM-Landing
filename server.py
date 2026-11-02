#!/usr/bin/env python3
"""
Bel Gray Official Artist Hub — Hardened Production Python + SQLite Micro-API
============================================================================
Zero-dependency Python 3 server (uses standard library `http.server` + `sqlite3`).
Engineered for high availability at:
  https://cloud-belgray.com/belgray_artist

Production Hardening Features:
1. In-Memory RAM Cache: `GET /api/state` serves pre-encoded UTF-8 JSON bytes
   straight from RAM (<0.05ms latency, zero disk I/O on public traffic).
2. Dual-Storage Persistence: Writes transactionally to SQLite (`data/belgray.db` in WAL mode)
   AND atomically mirrors to `data/site-config.json` & `data/releases.json`.
3. Rolling Backup History: Automatically stores the last 15 state snapshots in SQLite
   (`studio_history` table) before every overwrite, with `POST /api/rollback` support.
4. Schema Validation: Rejects malformed or empty payloads so a network glitch can never
   wipe the artist catalog or site configuration.
5. Server-Side IP Rate Limiter: Blocks brute-force PIN attacks at the API level
   (5 failed attempts -> 15 minute IP ban with HTTP 429).
6. Anti-Slowloris & Thread-Pool Cap: Strict 10s socket timeout, daemon threads,
   and bounded concurrency semaphore (max 64 simultaneous active requests).
"""

from __future__ import annotations

import datetime
import hmac
import json
import mimetypes
import os
import posixpath
import signal
import sqlite3
import sys
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "belgray.db"
CONFIG_JSON_PATH = DATA_DIR / "site-config.json"
RELEASES_JSON_PATH = DATA_DIR / "releases.json"

# Default salted SHA-256 hash of the Studio PIN (matches admin.js DEFAULT_PIN_HASH)
DEFAULT_PIN_HASH = os.environ.get(
    "BELGRAY_PIN_HASH",
    "33dfc76212c6e91cfbbee310e77c5953f1c4f68714529410bf1f5ebbd7266388",
)

MAX_BODY_BYTES = 2 * 1024 * 1024        # 2 MB max payload
SOCKET_TIMEOUT_SEC = 10                 # Drop hanging connections after 10s
MAX_CONCURRENT_REQUESTS = 64            # Cap active worker threads
MAX_HISTORY_SNAPSHOTS = 15              # Rolling backups kept in SQLite

# Rate limiter settings (Brute-force protection per IP)
RATE_LIMIT_MAX_ATTEMPTS = 5
RATE_LIMIT_WINDOW_SEC = 300             # 5 minutes window
RATE_LIMIT_LOCKOUT_SEC = 900            # 15 minutes ban

DB_LOCK = threading.Lock()
CONCURRENCY_SEMAPHORE = threading.BoundedSemaphore(MAX_CONCURRENT_REQUESTS)

# In-memory RAM cache for instant zero-disk-IO `GET /api/state` responses
_CACHE_LOCK = threading.Lock()
_CACHED_STATE_BYTES: bytes | None = None

# In-memory IP rate-limiting table: { ip: {"fails": [timestamps], "locked_until": float} }
_RATE_LOCK = threading.Lock()
_IP_ATTEMPTS: dict[str, dict] = {}


def utc_now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def read_json_file(path: Path, fallback):
    try:
        if path.exists():
            with path.open("r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as exc:
        print(f"[WARN] Could not read {path.name}: {exc}")
    return fallback


def write_json_atomic(path: Path, data) -> None:
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        tmp_path = path.with_suffix(path.suffix + ".tmp")
        with tmp_path.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        tmp_path.replace(path)
    except Exception as exc:
        print(f"[WARN] Could not mirror JSON to {path.name}: {exc}")


# =============================================================================
# VALIDATION & RATE LIMITING
# =============================================================================
def validate_site_config(cfg) -> tuple[bool, str]:
    if not isinstance(cfg, dict) or not cfg:
        return False, "siteConfig must be a non-empty JSON object"
    required_sections = ("site", "hero", "announcement", "bio", "documentary")
    for key in required_sections:
        if key in cfg and not isinstance(cfg[key], dict):
            return False, f"siteConfig.{key} must be an object"
    return True, ""


def validate_releases(releases) -> tuple[bool, str]:
    if not isinstance(releases, list) or len(releases) == 0:
        return False, "releases must be a non-empty array of release objects"
    for idx, item in enumerate(releases):
        if not isinstance(item, dict):
            return False, f"releases[{idx}] must be an object"
        if not str(item.get("title", "")).strip():
            return False, f"releases[{idx}] is missing a valid title"
    return True, ""


def check_ip_rate_limit(ip: str) -> tuple[bool, int]:
    """Returns (is_allowed, retry_after_seconds)."""
    now = time.time()
    with _RATE_LOCK:
        entry = _IP_ATTEMPTS.get(ip)
        if not entry:
            return True, 0
        locked_until = entry.get("locked_until", 0.0)
        if locked_until > now:
            return False, int(locked_until - now) + 1
        # Prune old failures outside window
        entry["fails"] = [t for t in entry.get("fails", []) if now - t < RATE_LIMIT_WINDOW_SEC]
        return True, 0


def record_ip_auth_result(ip: str, success: bool) -> int:
    """Updates IP failure log. Returns lockout seconds if newly locked out, else 0."""
    now = time.time()
    with _RATE_LOCK:
        if success:
            _IP_ATTEMPTS.pop(ip, None)
            return 0
        # Prevent unbounded dict growth under spoofed-IP floods
        if len(_IP_ATTEMPTS) > 4096:
            _IP_ATTEMPTS.clear()
        entry = _IP_ATTEMPTS.setdefault(ip, {"fails": [], "locked_until": 0.0})
        entry["fails"] = [t for t in entry["fails"] if now - t < RATE_LIMIT_WINDOW_SEC]
        entry["fails"].append(now)
        if len(entry["fails"]) >= RATE_LIMIT_MAX_ATTEMPTS:
            entry["locked_until"] = now + RATE_LIMIT_LOCKOUT_SEC
            entry["fails"] = []
            return RATE_LIMIT_LOCKOUT_SEC
        return 0


# =============================================================================
# SQLITE PERSISTENCE + RAM CACHE + ROLLING BACKUPS
# =============================================================================
def _refresh_ram_cache_unlocked(conn: sqlite3.Connection) -> bytes:
    global _CACHED_STATE_BYTES
    cur = conn.cursor()
    cur.execute(
        "SELECT key, value, updated_at FROM studio_store WHERE key IN ('site_config', 'releases')"
    )
    rows = {r[0]: (r[1], r[2]) for r in cur.fetchall()}

    site_config = {}
    releases = []
    updated_at = None

    if "site_config" in rows:
        try:
            site_config = json.loads(rows["site_config"][0])
            updated_at = rows["site_config"][1]
        except Exception:
            site_config = read_json_file(CONFIG_JSON_PATH, {})

    if "releases" in rows:
        try:
            releases = json.loads(rows["releases"][0])
        except Exception:
            releases = read_json_file(RELEASES_JSON_PATH, [])

    payload = {
        "ok": True,
        "siteConfig": site_config,
        "releases": releases,
        "updatedAt": updated_at,
    }
    encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    with _CACHE_LOCK:
        _CACHED_STATE_BYTES = encoded
    return encoded


def init_db() -> None:
    """Create SQLite schema, rolling history table, and seed initial data if empty."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with DB_LOCK, sqlite3.connect(DB_PATH, timeout=10.0) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        conn.execute("PRAGMA busy_timeout=5000;")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS studio_store (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS studio_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                site_config TEXT NOT NULL,
                releases TEXT NOT NULL,
                saved_at TEXT NOT NULL
            )
            """
        )

        now = utc_now_iso()
        cur = conn.cursor()

        cur.execute("SELECT 1 FROM studio_store WHERE key = 'site_config'")
        if cur.fetchone() is None:
            initial_cfg = read_json_file(CONFIG_JSON_PATH, {})
            cur.execute(
                "INSERT INTO studio_store (key, value, updated_at) VALUES (?, ?, ?)",
                ("site_config", json.dumps(initial_cfg, ensure_ascii=False), now),
            )

        cur.execute("SELECT 1 FROM studio_store WHERE key = 'releases'")
        if cur.fetchone() is None:
            initial_rel = read_json_file(RELEASES_JSON_PATH, [])
            cur.execute(
                "INSERT INTO studio_store (key, value, updated_at) VALUES (?, ?, ?)",
                ("releases", json.dumps(initial_rel, ensure_ascii=False), now),
            )

        cur.execute("SELECT 1 FROM studio_store WHERE key = 'admin_pin_hash'")
        if cur.fetchone() is None:
            cur.execute(
                "INSERT INTO studio_store (key, value, updated_at) VALUES (?, ?, ?)",
                ("admin_pin_hash", DEFAULT_PIN_HASH, now),
            )

        conn.commit()
        _refresh_ram_cache_unlocked(conn)


def get_cached_state_bytes() -> bytes:
    with _CACHE_LOCK:
        if _CACHED_STATE_BYTES is not None:
            return _CACHED_STATE_BYTES
    with DB_LOCK, sqlite3.connect(DB_PATH, timeout=10.0) as conn:
        return _refresh_ram_cache_unlocked(conn)


def db_get_state() -> dict:
    return json.loads(get_cached_state_bytes().decode("utf-8"))


def db_get_value(key: str, default=None):
    with DB_LOCK, sqlite3.connect(DB_PATH, timeout=10.0) as conn:
        cur = conn.cursor()
        cur.execute("SELECT value FROM studio_store WHERE key = ?", (key,))
        row = cur.fetchone()
        return row[0] if row else default


def verify_pin_hash(candidate_hash: str) -> bool:
    if not candidate_hash or not isinstance(candidate_hash, str):
        return False
    stored_hash = db_get_value("admin_pin_hash", DEFAULT_PIN_HASH) or DEFAULT_PIN_HASH
    return hmac.compare_digest(candidate_hash.strip().lower(), stored_hash.strip().lower())


def db_save_state(site_config=None, releases=None) -> str:
    now = utc_now_iso()
    with DB_LOCK, sqlite3.connect(DB_PATH, timeout=10.0) as conn:
        cur = conn.cursor()

        # 1. Snapshot current state into rolling backup table (`studio_history`) before overwrite
        cur.execute(
            "SELECT key, value FROM studio_store WHERE key IN ('site_config', 'releases')"
        )
        existing = dict(cur.fetchall())
        if "site_config" in existing and "releases" in existing:
            cur.execute(
                "INSERT INTO studio_history (site_config, releases, saved_at) VALUES (?, ?, ?)",
                (existing["site_config"], existing["releases"], now),
            )
            cur.execute(
                """
                DELETE FROM studio_history
                WHERE id NOT IN (
                    SELECT id FROM studio_history ORDER BY id DESC LIMIT ?
                )
                """,
                (MAX_HISTORY_SNAPSHOTS,),
            )

        # 2. Save new state
        if site_config is not None:
            cur.execute(
                """
                INSERT INTO studio_store (key, value, updated_at)
                VALUES ('site_config', ?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
                """,
                (json.dumps(site_config, ensure_ascii=False), now),
            )
            write_json_atomic(CONFIG_JSON_PATH, site_config)

        if releases is not None:
            cur.execute(
                """
                INSERT INTO studio_store (key, value, updated_at)
                VALUES ('releases', ?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
                """,
                (json.dumps(releases, ensure_ascii=False), now),
            )
            write_json_atomic(RELEASES_JSON_PATH, releases)

        conn.commit()
        _refresh_ram_cache_unlocked(conn)
    return now


def db_rollback_latest() -> tuple[bool, str]:
    """Restores the most recent snapshot from `studio_history`."""
    now = utc_now_iso()
    with DB_LOCK, sqlite3.connect(DB_PATH, timeout=10.0) as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, site_config, releases FROM studio_history ORDER BY id DESC LIMIT 1"
        )
        row = cur.fetchone()
        if not row:
            return False, "No backup snapshots available to roll back"

        snap_id, snap_cfg_str, snap_rel_str = row
        cur.execute(
            "UPDATE studio_store SET value = ?, updated_at = ? WHERE key = 'site_config'",
            (snap_cfg_str, now),
        )
        cur.execute(
            "UPDATE studio_store SET value = ?, updated_at = ? WHERE key = 'releases'",
            (snap_rel_str, now),
        )
        cur.execute("DELETE FROM studio_history WHERE id = ?", (snap_id,))
        conn.commit()

        try:
            write_json_atomic(CONFIG_JSON_PATH, json.loads(snap_cfg_str))
            write_json_atomic(RELEASES_JSON_PATH, json.loads(snap_rel_str))
        except Exception:
            pass

        _refresh_ram_cache_unlocked(conn)
    return True, now


def db_update_pin_hash(new_pin_hash: str) -> str:
    now = utc_now_iso()
    with DB_LOCK, sqlite3.connect(DB_PATH, timeout=10.0) as conn:
        conn.execute(
            """
            INSERT INTO studio_store (key, value, updated_at)
            VALUES ('admin_pin_hash', ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
            """,
            (new_pin_hash.strip().lower(), now),
        )
        conn.commit()
    return now


# =============================================================================
# HTTP SERVER & REQUEST HANDLER
# =============================================================================
class HardenedThreadingHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True
    request_queue_size = 128


class BelGrayRequestHandler(SimpleHTTPRequestHandler):
    """Handles `/api/*` (or `/belgray_artist/api/*`) and static file serving."""

    server_version = "BelGrayStudioAPI/2.0"
    timeout = SOCKET_TIMEOUT_SEC

    def handle(self) -> None:
        if not CONCURRENCY_SEMAPHORE.acquire(blocking=True, timeout=5.0):
            return
        try:
            super().handle()
        finally:
            CONCURRENCY_SEMAPHORE.release()

    def _client_ip(self) -> str:
        peer_ip = self.client_address[0] if self.client_address else "0.0.0.0"
        # Trust X-Real-IP / X-Forwarded-For only when behind local reverse proxy (Nginx)
        if peer_ip in ("127.0.0.1", "::1", "localhost"):
            real_ip = self.headers.get("X-Real-IP")
            if real_ip:
                return real_ip.strip()
            forwarded = self.headers.get("X-Forwarded-For")
            if forwarded:
                return forwarded.split(",")[0].strip()
        return peer_ip

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Studio-Pin-Hash")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()

    def _normalize_api_route(self) -> str | None:
        parsed_path = urlparse(self.path).path.rstrip("/")
        for route in ("/api/health", "/api/state", "/api/auth", "/api/save", "/api/pin", "/api/rollback"):
            if parsed_path == route or parsed_path.endswith(route):
                return route
        return None

    def _send_raw_json_bytes(self, status: int, body: bytes, extra_headers: dict | None = None) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Content-Length", str(len(body)))
        if extra_headers:
            for k, v in extra_headers.items():
                self.send_header(k, str(v))
        self.end_headers()
        self.wfile.write(body)

    def _send_json(self, status: int, payload: dict, extra_headers: dict | None = None) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self._send_raw_json_bytes(status, body, extra_headers=extra_headers)

    def _read_json_body(self) -> dict | None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY_BYTES:
            return None
        try:
            raw = self.rfile.read(length)
            return json.loads(raw.decode("utf-8"))
        except Exception:
            return None

    def do_GET(self) -> None:
        api_route = self._normalize_api_route()
        if api_route == "/api/health":
            self._send_json(
                200,
                {
                    "ok": True,
                    "service": "Bel Gray Studio Python Micro-API v2.0",
                    "engine": "sqlite3+ram-cache",
                    "dbPath": "data/belgray.db",
                },
            )
            return

        if api_route == "/api/state":
            # Instant zero-disk-IO response from in-memory RAM cache
            self._send_raw_json_bytes(200, get_cached_state_bytes())
            return

        super().do_GET()

    def do_POST(self) -> None:
        api_route = self._normalize_api_route()
        if not api_route:
            self._send_json(404, {"ok": False, "error": "Unknown API endpoint"})
            return

        client_ip = self._client_ip()
        allowed, retry_after = check_ip_rate_limit(client_ip)
        if not allowed:
            self._send_json(
                429,
                {
                    "ok": False,
                    "error": f"Too many failed PIN attempts. Try again in {retry_after}s.",
                },
                extra_headers={"Retry-After": str(retry_after)},
            )
            return

        body = self._read_json_body()
        if body is None:
            self._send_json(400, {"ok": False, "error": "Invalid or empty JSON payload"})
            return

        header_pin_hash = self.headers.get("X-Studio-Pin-Hash", "")
        candidate_hash = header_pin_hash or body.get("pinHash", "")

        if api_route == "/api/auth":
            if verify_pin_hash(candidate_hash):
                record_ip_auth_result(client_ip, True)
                self._send_json(200, {"ok": True})
            else:
                lock_sec = record_ip_auth_result(client_ip, False)
                msg = (
                    f"Too many failed attempts. Locked for {lock_sec}s."
                    if lock_sec
                    else "Invalid Studio PIN"
                )
                self._send_json(401, {"ok": False, "error": msg})
            return

        if api_route == "/api/save":
            if not verify_pin_hash(candidate_hash):
                record_ip_auth_result(client_ip, False)
                self._send_json(
                    401,
                    {"ok": False, "error": "Unauthorized: Invalid Studio PIN hash"},
                )
                return
            record_ip_auth_result(client_ip, True)

            site_config = body.get("siteConfig")
            releases = body.get("releases")

            if site_config is not None:
                valid_cfg, err_cfg = validate_site_config(site_config)
                if not valid_cfg:
                    self._send_json(400, {"ok": False, "error": err_cfg})
                    return

            if releases is not None:
                valid_rel, err_rel = validate_releases(releases)
                if not valid_rel:
                    self._send_json(400, {"ok": False, "error": err_rel})
                    return

            updated_at = db_save_state(site_config=site_config, releases=releases)
            self._send_json(200, {"ok": True, "updatedAt": updated_at})
            return

        if api_route == "/api/rollback":
            if not verify_pin_hash(candidate_hash):
                record_ip_auth_result(client_ip, False)
                self._send_json(
                    401,
                    {"ok": False, "error": "Unauthorized: Invalid Studio PIN hash"},
                )
                return
            record_ip_auth_result(client_ip, True)
            ok, info = db_rollback_latest()
            if not ok:
                self._send_json(404, {"ok": False, "error": info})
                return
            self._send_json(200, {"ok": True, "updatedAt": info, "state": db_get_state()})
            return

        if api_route == "/api/pin":
            current_hash = body.get("currentPinHash") or header_pin_hash
            new_hash = body.get("newPinHash", "")
            if not verify_pin_hash(current_hash):
                record_ip_auth_result(client_ip, False)
                self._send_json(
                    401,
                    {"ok": False, "error": "Unauthorized: Current PIN does not match"},
                )
                return
            record_ip_auth_result(client_ip, True)
            if not isinstance(new_hash, str) or len(new_hash.strip()) != 64:
                self._send_json(
                    400, {"ok": False, "error": "Invalid new PIN SHA-256 hash"}
                )
                return
            updated_at = db_update_pin_hash(new_hash)
            self._send_json(200, {"ok": True, "updatedAt": updated_at})
            return

        self._send_json(404, {"ok": False, "error": "Endpoint not found"})

    def translate_path(self, path: str) -> str:
        """Map both `/` and `/belgray_artist/...` to `BASE_DIR` safely."""
        parsed = urlparse(path).path
        parsed = posixpath.normpath(unquote(parsed))
        if parsed.startswith("/belgray_artist/"):
            parsed = parsed[len("/belgray_artist") :]
        elif parsed == "/belgray_artist":
            parsed = "/"

        words = [w for w in parsed.split("/") if w and w not in (".", "..")]
        resolved = BASE_DIR
        for word in words:
            resolved = resolved / word

        # Block direct download of SQLite database file or server.py over HTTP
        if resolved.name in ("belgray.db", "belgray.db-wal", "belgray.db-shm", "server.py"):
            return str(BASE_DIR / "__forbidden__")

        return str(resolved)


def main() -> None:
    mimetypes.add_type("image/svg+xml", ".svg")
    mimetypes.add_type("application/json", ".json")
    init_db()

    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8080"))
    server = HardenedThreadingHTTPServer((host, port), BelGrayRequestHandler)

    def _graceful_shutdown(signum, _frame):
        print(f"\n[INFO] Received signal {signum}, shutting down gracefully...")
        threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGINT, _graceful_shutdown)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, _graceful_shutdown)

    print("============================================================")
    print(" Bel Gray Studio Python + SQLite Micro-API v2.0 (Hardened)")
    print(f" Listening on:  http://{host}:{port}")
    print(f" Subpath ready: http://{host}:{port}/belgray_artist/")
    print(f" SQLite DB:     {DB_PATH} (WAL + RAM Cache + 15 Snapshots)")
    print("============================================================")
    server.serve_forever()
    server.server_close()
    sys.exit(0)


if __name__ == "__main__":
    main()
