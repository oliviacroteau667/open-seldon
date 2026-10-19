"""Verification of Authentik-issued OIDC access tokens (RS256, keys from JWKS)."""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass

import jwt
from jwt import PyJWKClient

log = logging.getLogger(__name__)

DEFAULT_ISSUER = "https://accounts.openseldon.org/application/o/openseldon/"
DEFAULT_AUDIENCE = "openseldon-web"


@dataclass(frozen=True)
class OIDCConfig:
    issuer: str
    audience: str

    @property
    def jwks_uri(self) -> str:
        return self.issuer.rstrip("/") + "/jwks/"

    @classmethod
    def from_env(cls) -> "OIDCConfig":
        return cls(
            issuer=os.environ.get("OIDC_ISSUER", DEFAULT_ISSUER),
            audience=os.environ.get("OIDC_AUDIENCE", DEFAULT_AUDIENCE),
        )


class TokenError(Exception):
    """The token is missing, malformed, expired, or not issued for this API."""


def verify_token(token: str, key, *, issuer: str, audience: str) -> dict:
    try:
        return jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=audience,
            issuer=issuer,
            options={"require": ["exp", "iat", "sub"]},
        )
    except jwt.PyJWTError as exc:
        raise TokenError(str(exc)) from exc


_jwk_client: PyJWKClient | None = None
_jwk_client_uri: str | None = None


def _jwks_client(config: OIDCConfig) -> PyJWKClient:
    global _jwk_client, _jwk_client_uri
    if _jwk_client is None or _jwk_client_uri != config.jwks_uri:
        _jwk_client = PyJWKClient(config.jwks_uri, cache_keys=True, lifespan=600)
        _jwk_client_uri = config.jwks_uri
    return _jwk_client


def decode_access_token(token: str, config: OIDCConfig | None = None) -> dict:
    """Blocking: fetches the signing key (cached) and verifies the token."""
    config = config or OIDCConfig.from_env()
    try:
        key = _jwks_client(config).get_signing_key_from_jwt(token).key
    except jwt.PyJWTError as exc:
        raise TokenError(f"signing key lookup failed: {exc}") from exc
    return verify_token(token, key, issuer=config.issuer, audience=config.audience)
