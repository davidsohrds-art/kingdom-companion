FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 DATA_FILE=/data/rooms.json
COPY package.json server.js security.js ./
COPY public ./public
RUN mkdir -p /data
EXPOSE 8080
CMD ["node", "server.js"]
