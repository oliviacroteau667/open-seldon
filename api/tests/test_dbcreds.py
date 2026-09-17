"""Unit tests for the credential resolver module."""
import os
import pytest
from pathlib import Path


# Import the private helper directly to test encoding logic
from modules.dbcreds import _read_secret, resolve_postgres_dsn


def test_read_secret_utf8(tmp_path):
    f = tmp_path / "secret"
    f.write_text("mypassword", encoding="utf-8")
    assert _read_secret(str(f)) == "mypassword"


def test_read_secret_utf16le(tmp_path):
    f = tmp_path / "secret"
    f.write_bytes("mypassword".encode("utf-16"))  # includes BOM
    assert _read_secret(str(f)) == "mypassword"


def test_read_secret_strips_whitespace(tmp_path):
    f = tmp_path / "secret"
    f.write_text("  trimmed  \n", encoding="utf-8")
    assert _read_secret(str(f)) == "trimmed"


def test_read_secret_missing_file():
    assert _read_secret("/nonexistent/path/secret") is None


def test_read_secret_empty_returns_none(tmp_path):
    f = tmp_path / "secret"
    f.write_text("", encoding="utf-8")
    assert _read_secret(str(f)) is None


def test_read_secret_empty_path():
    assert _read_secret("") is None


def test_resolve_postgres_dsn_from_env(monkeypatch):
    monkeypatch.setenv("POSTGRES_PASSWORD", "testpass")
    monkeypatch.setenv("POSTGRES_HOST", "localhost")
    monkeypatch.setenv("POSTGRES_PORT", "5432")
    monkeypatch.setenv("POSTGRES_DB", "testdb")
    monkeypatch.setenv("POSTGRES_USER", "testuser")
    monkeypatch.setenv("POSTGRES_PASSWORD_FILE", "")
    dsn = resolve_postgres_dsn()
    assert dsn == "postgresql://testuser:testpass@localhost:5432/testdb"
