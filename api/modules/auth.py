"""FastAPI dependencies for authenticated requests."""
from __future__ import annotations

import asyncpg
from fastapi import Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from modules.oidc import TokenError, decode_access_token

_bearer = HTTPBearer(auto_error=False)


def _get_pool() -> asyncpg.Pool:
    from main import get_pool
    return get_pool()


async def _claims(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    if credentials is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        return await run_in_threadpool(decode_access_token, credentials.credentials)
    except TokenError as exc:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            f"invalid token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def current_user(
    claims: dict = Depends(_claims),
    pool: asyncpg.Pool = Depends(_get_pool),
) -> dict:
    """The verified user, upserted into `users` and returned with their claims."""
    email = (claims.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "token has no email claim")
    sub = claims["sub"]
    name = claims.get("name") or claims.get("preferred_username")
    returning = "RETURNING id, authentik_sub, email, name, is_superuser, created_at"
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                f"""
                UPDATE users
                   SET email = $2, name = COALESCE($3, name), last_seen_at = NOW()
                 WHERE authentik_sub = $1
                {returning}
                """,
                sub, email, name,
            )
            if row is None:
                # Unknown sub: new user, or an identity re-created in Authentik under an existing email
                row = await conn.fetchrow(
                    f"""
                    INSERT INTO users (authentik_sub, email, name, last_seen_at)
                    VALUES ($1, $2, $3, NOW())
                    ON CONFLICT (email) DO UPDATE
                        SET authentik_sub = EXCLUDED.authentik_sub,
                            name = COALESCE(EXCLUDED.name, users.name),
                            last_seen_at = NOW()
                    {returning}
                    """,
                    sub, email, name,
                )
    except asyncpg.UniqueViolationError:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "email is already linked to a different account",
        )
    user = dict(row)
    user["id"] = str(user["id"])
    user["groups"] = claims.get("groups") or []
    return user


async def current_superuser(user: dict = Depends(current_user)) -> dict:
    if not user["is_superuser"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "superuser required")
    return user
