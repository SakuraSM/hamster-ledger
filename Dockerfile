FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/ledger-core/package.json packages/ledger-core/package.json
COPY packages/statement-importers/package.json packages/statement-importers/package.json
COPY packages/design-tokens/package.json packages/design-tokens/package.json
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --omit=dev --workspace @hamster-ledger/server

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4190 DATABASE_PATH=/data/ledger.sqlite
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/ledger-core ./packages/ledger-core
COPY --from=build /app/apps/server ./apps/server
COPY --from=build /app/apps/web/dist/client ./apps/web/dist/client
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 4190
VOLUME /data
CMD ["node", "apps/server/src/index.mjs"]
