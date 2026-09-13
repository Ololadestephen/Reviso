# syntax=docker/dockerfile:1.7
FROM node:22.14.0-bookworm-slim AS web-build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY apps/web apps/web
RUN npm run build

FROM node:22.14.0-bookworm-slim AS node-runtime
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev

FROM ghcr.io/astral-sh/uv:0.11.7 AS uv-bin

FROM python:3.12.13-slim-bookworm AS runtime
COPY --from=uv-bin /uv /uvx /bin/
COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node

WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH" \
    REVISO_DB_PATH=/app/data/reviso.sqlite3 \
    REVISO_SERVE_WEB=1 \
    REVISO_WEB_DIST=/app/apps/web/dist

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY backend backend
COPY bridge bridge
COPY --from=node-runtime /app/node_modules node_modules
COPY --from=web-build /app/apps/web/dist apps/web/dist

RUN useradd --create-home --uid 10001 reviso \
    && mkdir -p /app/data \
    && chown -R reviso:reviso /app/data
USER reviso

EXPOSE 8000
CMD ["uvicorn", "backend.api:app", "--host", "0.0.0.0", "--port", "8000"]
