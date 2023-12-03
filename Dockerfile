FROM node:lts-alpine AS build

WORKDIR /app/

COPY . .

RUN corepack enable && corepack prepare pnpm@latest --activate

RUN --mount=type=cache,target=/root/.local/share/pnpm \
    pnpm install --prefer-offline && \
    pnpm build

CMD [ "pnpm", "start" ]
EXPOSE 3000
