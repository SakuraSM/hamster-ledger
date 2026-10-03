# syntax=docker/dockerfile:1
FROM --platform=$BUILDPLATFORM node:24-bookworm-slim AS manifests
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/ledger-core/package.json packages/ledger-core/package.json
COPY packages/statement-importers/package.json packages/statement-importers/package.json
COPY packages/design-tokens/package.json packages/design-tokens/package.json
COPY packages/fixtures/package.json packages/fixtures/package.json
COPY packages/ledger-react/package.json packages/ledger-react/package.json

FROM manifests AS build
RUN npm ci --include-workspace-root --workspace @hamster-ledger/server --workspace @hamster-ledger/web --workspace @hamster-ledger/fixtures --workspace @hamster-ledger/ledger-react
COPY . .
RUN npm run build

FROM manifests AS dependencies
RUN npm ci --omit=dev --workspace @hamster-ledger/server --ignore-scripts

FROM node:24-bookworm-slim
WORKDIR /app
LABEL org.opencontainers.image.source="https://github.com/SakuraSM/hamster-ledger" \
      org.opencontainers.image.title="Hamster Ledger" \
      org.opencontainers.image.licenses="MIT"
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4180 DATABASE_PATH=/data/ledger.sqlite LEDGER_TIMEZONE=Asia/Shanghai
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/packages/ledger-core/package.json ./packages/ledger-core/package.json
COPY --from=build /app/packages/ledger-core/dist ./packages/ledger-core/dist
COPY --from=build /app/apps/server ./apps/server
COPY --from=build /app/apps/web/dist/client ./apps/web/dist/client
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 4180
VOLUME /data
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('node:http').get('http://127.0.0.1:'+process.env.PORT+'/api/health',r=>{r.resume();if(r.statusCode!==200)process.exit(1)}).on('error',()=>process.exit(1))"
CMD ["node", "apps/server/src/index.mjs"]
