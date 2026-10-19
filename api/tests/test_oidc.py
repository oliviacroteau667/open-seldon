"""Unit tests for OIDC access-token verification (no network: local RSA keys)."""
import time

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from modules.oidc import OIDCConfig, TokenError, verify_token

ISSUER = "https://accounts.example.org/application/o/openseldon/"
AUDIENCE = "openseldon-web"


@pytest.fixture(scope="module")
def keypair():
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    public_pem = private.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return private_pem, public_pem


def _token(private_pem, **overrides):
    now = int(time.time())
    claims = {
        "iss": ISSUER,
        "aud": AUDIENCE,
        "sub": "user-123",
        "email": "someone@example.org",
        "iat": now,
        "exp": now + 300,
    }
    claims.update(overrides)
    return jwt.encode(claims, private_pem, algorithm="RS256", headers={"kid": "test"})


def test_valid_token_returns_claims(keypair):
    private_pem, public_pem = keypair
    claims = verify_token(_token(private_pem), public_pem, issuer=ISSUER, audience=AUDIENCE)
    assert claims["sub"] == "user-123"
    assert claims["email"] == "someone@example.org"


def test_wrong_audience_rejected(keypair):
    private_pem, public_pem = keypair
    with pytest.raises(TokenError):
        verify_token(_token(private_pem, aud="other-client"), public_pem, issuer=ISSUER, audience=AUDIENCE)


def test_wrong_issuer_rejected(keypair):
    private_pem, public_pem = keypair
    with pytest.raises(TokenError):
        verify_token(_token(private_pem, iss="https://evil.example/"), public_pem, issuer=ISSUER, audience=AUDIENCE)


def test_expired_token_rejected(keypair):
    private_pem, public_pem = keypair
    now = int(time.time())
    with pytest.raises(TokenError):
        verify_token(_token(private_pem, iat=now - 600, exp=now - 10), public_pem, issuer=ISSUER, audience=AUDIENCE)


def test_bad_signature_rejected(keypair):
    private_pem, _ = keypair
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    other_public = other.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
    )
    with pytest.raises(TokenError):
        verify_token(_token(private_pem), other_public, issuer=ISSUER, audience=AUDIENCE)


def test_hs256_token_rejected(keypair):
    _, public_pem = keypair
    now = int(time.time())
    forged = jwt.encode(
        {"iss": ISSUER, "aud": AUDIENCE, "sub": "x", "iat": now, "exp": now + 60},
        "not-a-secret",
        algorithm="HS256",
    )
    with pytest.raises(TokenError):
        verify_token(forged, public_pem, issuer=ISSUER, audience=AUDIENCE)


def test_missing_sub_rejected(keypair):
    private_pem, public_pem = keypair
    now = int(time.time())
    no_sub = jwt.encode(
        {"iss": ISSUER, "aud": AUDIENCE, "iat": now, "exp": now + 60},
        private_pem,
        algorithm="RS256",
    )
    with pytest.raises(TokenError):
        verify_token(no_sub, public_pem, issuer=ISSUER, audience=AUDIENCE)


def test_config_from_env(monkeypatch):
    monkeypatch.setenv("OIDC_ISSUER", "https://accounts.openseldon.org/application/o/openseldon/")
    monkeypatch.setenv("OIDC_AUDIENCE", "openseldon-web")
    cfg = OIDCConfig.from_env()
    assert cfg.jwks_uri == "https://accounts.openseldon.org/application/o/openseldon/jwks/"
