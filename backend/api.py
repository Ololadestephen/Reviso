"""Local application initialization and request boundary policy."""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.trustedhost import TrustedHostMiddleware

from backend.company_disclosures import CompanyDisclosureProvider
from backend.deployment import DeploymentSettings
from backend.llm import (
    LanguageModel,
    LLMInvalidOutputError,
    LLMUnavailableError,
    language_model_from_environment,
)
from backend.providers import BitgetProvider
from backend.routes import router
from backend.storage import ConflictError, Repository


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
            "detail": "Qwen's draft didn't match the required format, so nothing was changed. Continue manually or try again."
        },
    )


def create_app(db_path: str | None = None, llm: LanguageModel | None = None) -> FastAPI:
    deployment = DeploymentSettings.from_environment()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.repository = Repository(
            db_path or os.getenv("REVISO_DB_PATH", "data/reviso-v1.sqlite3")
        )
        app.state.provider = BitgetProvider()
        app.state.disclosures = CompanyDisclosureProvider()
        app.state.llm = llm or language_model_from_environment()
        try:
            yield
        finally:
            app.state.disclosures.close()
            close = getattr(app.state.llm, "close", None)
            if close is not None:
                close()

    app = FastAPI(title="Reviso research API", lifespan=lifespan)
    app.state.deployment_mode = "private_demo" if deployment.public_demo else "local_single_user"
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=list(deployment.allowed_hosts))

    @app.middleware("http")
    async def local_origin(request: Request, call_next):
        if deployment.requires_authentication(
            request.method, request.url.path
        ) and not deployment.authorizes(request.headers.get("authorization")):
            return JSONResponse(
                status_code=401,
                content={"detail": "Browser authentication required"},
                headers={"WWW-Authenticate": 'Basic realm="Reviso demo", charset="UTF-8"'},
            )
        origin = request.headers.get("origin")
        if origin and origin not in deployment.allowed_origins:
            return JSONResponse(
                status_code=403, content={"detail": "Foreign browser origin rejected"}
            )
        return await call_next(request)

    app.add_exception_handler(KeyError, not_found)
    app.add_exception_handler(ConflictError, conflict)
    app.add_exception_handler(LLMUnavailableError, llm_unavailable)
    app.add_exception_handler(LLMInvalidOutputError, llm_invalid)
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
