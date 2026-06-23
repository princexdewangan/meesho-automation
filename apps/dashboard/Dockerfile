FROM node:20-bookworm-slim AS deps

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci

FROM deps AS builder

WORKDIR /app

COPY tsconfig.json ./
COPY packages packages
COPY apps/dashboard apps/dashboard

WORKDIR /app/apps/dashboard

ENV DATABASE_URL=file:/tmp/build.db

RUN npm run build

FROM node:20-bookworm-slim AS runner

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=file:/data/dev.db
ENV PORT=3000

COPY --from=deps /app/node_modules node_modules
COPY --from=builder /app/package.json package.json
COPY --from=builder /app/apps/dashboard apps/dashboard
COPY --from=builder /app/packages packages

WORKDIR /app/apps/dashboard

EXPOSE 3000

CMD ["npm", "run", "docker:start"]
