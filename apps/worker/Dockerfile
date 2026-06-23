FROM mcr.microsoft.com/playwright:v1.61.0-noble AS deps

WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package.json package-lock.json ./
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci

FROM deps AS builder

WORKDIR /app

COPY tsconfig.json ./
COPY packages packages
COPY apps/worker apps/worker

WORKDIR /app/apps/worker

RUN npm run build

FROM mcr.microsoft.com/playwright:v1.61.0-noble AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY --from=deps /app/node_modules node_modules
COPY --from=builder /app/package.json package.json
COPY --from=builder /app/apps/worker apps/worker
COPY --from=builder /app/packages packages

WORKDIR /app/apps/worker

CMD ["npm", "run", "start"]
