# 시세·날씨 서비스 이미지. 외부 패키지가 없어 Node 이미지에 파일 두 개만 넣는다.
FROM node:22-alpine
WORKDIR /svc
COPY routes.mjs server.mjs ./
ENV PORT=8500
USER node
EXPOSE 8500
HEALTHCHECK --interval=5s --timeout=2s --retries=5 CMD wget -qO- http://127.0.0.1:8500/health || exit 1
CMD ["node", "server.mjs"]
