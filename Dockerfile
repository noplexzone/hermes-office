FROM node:24.7.0-bookworm-slim

ENV NODE_ENV=production \
    HERMES_OFFICE_HOST=0.0.0.0 \
    HERMES_OFFICE_PORT=4000 \
    HERMES_OFFICE_HERMES_ROOT=/hermes

WORKDIR /app

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --chown=node:node claudeville ./claudeville
COPY --chown=node:node CHANGELOG.md ./CHANGELOG.md
COPY --chown=node:node README.md ./README.md

USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:4000/api/providers',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "claudeville/server.js"]
