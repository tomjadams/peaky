# Multi-stage Dockerfile for all peaky Go services.
#
# Build a specific service with:
#   docker build --target api  -t peaky-api  ./services
#   docker build --target ctl  -t peaky-ctl  ./services
#   docker build --target sse  -t peaky-sse  ./services
#
# docker-compose uses the `target:` key — each service gets its own lean
# distroless image while sharing the cached builder layer.
#
# Common build flags:
#   CGO_ENABLED=0    no libc dependency → runs on distroless/static
#   -ldflags="-w -s" strip debug symbols and DWARF (~30% smaller)
#   -trimpath        remove source paths (reproducibility + security)

# ── shared builder ───────────────────────────────────────────────────────────

FROM acr-main.is.adyen.com/containers/golang-base@sha256:9ff3d660a23cc109810e8e685ae2595c5b54723c20553072f2cc0ed224bb24e9 AS builder

WORKDIR /build
COPY go.mod go.sum ./
# Module cache persists across builds so 'go mod download' only re-runs when
# go.mod / go.sum change (requires BuildKit, enabled by default in Compose v2).
RUN --mount=type=cache,id=peaky-go-mod,target=/go/pkg/mod \
    go mod download
COPY . .

# ── per-service compile stages ───────────────────────────────────────────────
#
# Two persistent caches:
#   peaky-go-mod   — downloaded module source (shared across all three stages)
#   peaky-go-build — compiled package objects (shared; Go handles cache keying)
#
# First build: same speed as before.
# Subsequent builds after code changes: only changed packages recompile (~1-2s).

FROM builder AS build-api
RUN --mount=type=cache,id=peaky-go-mod,target=/go/pkg/mod \
    --mount=type=cache,id=peaky-go-build,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-w -s" -trimpath -o /peaky-api ./cmd/peaky-api

FROM builder AS build-ctl
RUN --mount=type=cache,id=peaky-go-mod,target=/go/pkg/mod \
    --mount=type=cache,id=peaky-go-build,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-w -s" -trimpath -o /peaky-ctl ./cmd/peaky-ctl

FROM builder AS build-sse
RUN --mount=type=cache,id=peaky-go-mod,target=/go/pkg/mod \
    --mount=type=cache,id=peaky-go-build,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-w -s" -trimpath -o /peaky-sse ./cmd/peaky-sse

# ── runtime: api ─────────────────────────────────────────────────────────────

FROM acr-main.is.adyen.com/external/distroless/static@sha256:f512d819b8f109f2375e8b51d8cfd8aafe81034bc3e319740128b7d7f70d5036 AS api

COPY --from=builder /etc/pki/tls/certs/ca-bundle.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo
COPY --from=build-api /peaky-api /peaky-api
COPY seed/actors.json /seed/actors.json

ENV PORT=8080
ENV ACTORS_FILE=/seed/actors.json
EXPOSE 8080
ENTRYPOINT ["/peaky-api"]

# ── runtime: ctl ─────────────────────────────────────────────────────────────

FROM acr-main.is.adyen.com/external/distroless/static@sha256:f512d819b8f109f2375e8b51d8cfd8aafe81034bc3e319740128b7d7f70d5036 AS ctl

COPY --from=builder /etc/pki/tls/certs/ca-bundle.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=build-ctl /peaky-ctl /peaky-ctl
COPY seed/actors.json /seed/actors.json

ENV ACTORS_FILE=/seed/actors.json
ENTRYPOINT ["/peaky-ctl"]

# ── runtime: sse ─────────────────────────────────────────────────────────────

FROM acr-main.is.adyen.com/external/distroless/static@sha256:f512d819b8f109f2375e8b51d8cfd8aafe81034bc3e319740128b7d7f70d5036 AS sse

COPY --from=builder /etc/pki/tls/certs/ca-bundle.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo
COPY --from=build-sse /peaky-sse /peaky-sse
COPY seed/actors.json /seed/actors.json

ENV PORT=8081
ENV ACTORS_FILE=/seed/actors.json
EXPOSE 8081
ENTRYPOINT ["/peaky-sse"]
