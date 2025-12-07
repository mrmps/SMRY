FROM oven/bun:latest AS build

WORKDIR /app/

COPY . .

RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile && \
    bun run build

CMD [ "bun", "run", "start" ]
EXPOSE 3000
