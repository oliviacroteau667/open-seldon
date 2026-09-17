"""
Single credential resolver for PostgreSQL.
Priority: Docker secret file > env var POSTGRES_PASSWORD > env.yaml fallback.
All call sites go through resolve_postgres_dsn() — never read credentials elsewhere.
"""
import os
from pathlib import Path


def _read_secret(path: str) -> str | None:
    if not path:
        return None
    p = Path(path)
    if not p.is_file():
        return None
    raw = p.read_bytes()
    # Handle UTF-16 LE/BE BOM (created on Windows) as well as plain UTF-8
    for enc in ("utf-8-sig", "utf-16", "utf-8", "latin-1"):
        try:
            return raw.decode(enc).strip() or None
        except (UnicodeDecodeError, LookupError):
            continue
    return None


def resolve_postgres_password() -> str:
    secret_file = os.environ.get("POSTGRES_PASSWORD_FILE", "/run/secrets/postgres_password")
    password = _read_secret(secret_file)
    if password:
        return password

    password = os.environ.get("POSTGRES_PASSWORD", "")
    if password:
        return password

    # fallback: env.yaml (local dev only)
    try:
        import yaml
        cfg = yaml.safe_load(Path("env.yaml").read_text())
        return cfg.get("postgres", {}).get("password", "")
    except Exception:
        pass

    raise RuntimeError(
        "No PostgreSQL password found. Set POSTGRES_PASSWORD_FILE, "
        "POSTGRES_PASSWORD env var, or env.yaml."
    )


def resolve_postgres_dsn() -> str:
    host = os.environ.get("POSTGRES_HOST", "localhost")
    port = os.environ.get("POSTGRES_PORT", "5432")
    db = os.environ.get("POSTGRES_DB", "openseldon")
    user = os.environ.get("POSTGRES_USER", "openseldon_api")
    password = resolve_postgres_password()
    return f"postgresql://{user}:{password}@{host}:{port}/{db}"
