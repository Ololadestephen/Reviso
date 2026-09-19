"""Local application initialization and request boundary policy."""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.trustedhost import TrustedHostMiddleware

from backend.auth import csrf_is_required, resolve_principal, valid_csrf
from backend.company_disclosures import CompanyDisclosureProvider
from backend.deployment import DeploymentSettings
from backend.google_token import GoogleTokenInfoVerifier, GoogleTokenVerifier
from backend.llm import (
    LanguageModel,
    LLMInvalidOutputError,
    LLMUnavailableError,
    chat_language_model_from_environment,
    draft_language_model_from_environment,
    language_model_from_environment,
)
from backend.llm_budget import DuplicateLlmRequest, LlmAllowanceExceeded
from backend.providers import BitgetProvider
from backend.routes import router
from backend.storage import ConflictError, Repository
from backend.xstocks import XStocksProvider


class SinglePageFiles(StaticFiles):
    """Serve built assets, and let the client router own every other path.

    Without this, a deep link such as /thesis/<id> would 404 on reload because
    no file of that name exists in the build.
    """

    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as error:
            if error.status_code != 404:
                raise
            return await super().get_response("index.html", scope)


async def not_found(_request: Request, _error: KeyError):
    return JSONResponse(status_code=404, content={"detail": "Record not found"})


async def conflict(_request: Request, error: ConflictError):
    return JSONResponse(status_code=409, content={"detail": str(error)})


async def llm_unavailable(_request: Request, error: LLMUnavailableError):
    return JSONResponse(status_code=503, content={"detail": str(error)})


async def llm_invalid(_request: Request, _error: LLMInvalidOutputError):
    return JSONResponse(
        status_code=502,
        content={
            "detail": "The draft didn't match the required format, so nothing was changed. Continue manually or try again."
        },
    )


async def llm_budget(_request: Request, error: LlmAllowanceExceeded):
    return JSONResponse(status_code=429, content={"detail": budget_message(error.scope)})


async def llm_duplicate(_request: Request, _error: DuplicateLlmRequest):
    return JSONResponse(status_code=409, content={"detail": "This request is already in progress"})


def budget_message(scope: str) -> str:
    if scope == "user":
        return (
            "Today's Qwen allowance for this account is used. "
            "Saved findings stay available; continue manually."
        )
    if scope == "total":
        return (
            "Today's shared Qwen allowance is used. "
            "Saved findings stay available; continue manually."
        )
    return "Qwen is busy. Wait a moment and try again, or continue manually."


def _close_language_model(model: LanguageModel | None) -> None:
    close = getattr(model, "close", None)
    if close is not None:
        close()


def create_app(
    db_path: str | None = None,
    llm: LanguageModel | None = None,
    google_verifier: GoogleTokenVerifier | None = None,
    chat_llm: LanguageModel | None = None,
    draft_llm: LanguageModel | None = None,
) -> FastAPI:
    deployment = DeploymentSettings.from_environment()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.repository = Repository(
            db_path or os.getenv("REVISO_DB_PATH", "data/reviso-v1.sqlite3")
        )
        app.state.provider = BitgetProvider()
        app.state.xstocks = XStocksProvider()
        app.state.disclosures = CompanyDisclosureProvider()
        app.state.llm = llm or language_model_from_environment()
        if chat_llm is not None:
            app.state.chat_llm = chat_llm
        elif llm is not None:
            app.state.chat_llm = llm
        else:
            app.state.chat_llm = chat_language_model_from_environment()
        if draft_llm is not None:
            app.state.draft_llm = draft_llm
        elif llm is not None:
            app.state.draft_llm = llm
        else:
            app.state.draft_llm = draft_language_model_from_environment()
        try:
            yield
        finally:
            app.state.disclosures.close()
            app.state.xstocks.close()
            primary = app.state.llm
            chat = app.state.chat_llm
            draft = app.state.draft_llm
            _close_language_model(primary)
            if chat is not primary:
                _close_language_model(chat)
            if draft is not primary and draft is not chat:
                _close_language_model(draft)

    docs_enabled = not deployment.public_demo
    app = FastAPI(
        title="Reviso research API",
        lifespan=lifespan,
        docs_url="/docs" if docs_enabled else None,
        redoc_url="/redoc" if docs_enabled else None,
        openapi_url="/openapi.json" if docs_enabled else None,
    )
    app.state.deployment_mode = "private_demo" if deployment.public_demo else "local_single_user"
    app.state.auth = deployment.auth
    app.state.llm_limits = deployment.llm_limits
    if google_verifier is not None:
        app.state.google_verifier = google_verifier
    elif deployment.auth.mode == "google" and deployment.auth.google_client_id:
        app.state.google_verifier = GoogleTokenInfoVerifier(deployment.auth.google_client_id)
    else:
        app.state.google_verifier = None
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=list(deployment.allowed_hosts))

    @app.middleware("http")
    async def local_origin(request: Request, call_next):
        origin = request.headers.get("origin")
        if origin and origin not in deployment.allowed_origins:
            return JSONResponse(
                status_code=403, content={"detail": "Foreign browser origin rejected"}
            )
        principal = None
        if hasattr(request.app.state, "repository"):
            principal = resolve_principal(request, request.app.state.repository, deployment.auth)
        if csrf_is_required(request, principal) and (
            principal is None
            or principal.csrf_secret is None
            or not valid_csrf(request, principal.csrf_secret)
        ):
            return JSONResponse(
                status_code=403, content={"detail": "CSRF token missing or invalid"}
            )
        request.state.principal = principal
        return await call_next(request)

    app.add_exception_handler(KeyError, not_found)
    app.add_exception_handler(ConflictError, conflict)
    app.add_exception_handler(LLMUnavailableError, llm_unavailable)
    app.add_exception_handler(LLMInvalidOutputError, llm_invalid)
    app.add_exception_handler(LlmAllowanceExceeded, llm_budget)
    app.add_exception_handler(DuplicateLlmRequest, llm_duplicate)
    app.include_router(router)
    if deployment.web_dist is not None:
        app.include_router(router, prefix="/api", include_in_schema=False)
        app.mount(
            "/",
            SinglePageFiles(directory=deployment.web_dist, html=True),
            name="web",
        )
    return app


app = create_app()
