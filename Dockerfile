FROM node:20-alpine
WORKDIR /app

COPY package.json server.js ./
COPY public ./public
COPY data/raid-loot.json data/raid-journal.json /opt/seed/
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV HOST=0.0.0.0 \
    PORT=8765 \
    NODE_ENV=production

EXPOSE 8765
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8765/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/entrypoint.sh"]
