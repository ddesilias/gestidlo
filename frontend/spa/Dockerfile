FROM node:18-alpine AS build

WORKDIR /workspace
COPY frontend/spa/package.json frontend/spa/package-lock.json ./
RUN npm ci

COPY frontend/spa/ ./
RUN npm run build -- --configuration production

# Angular ("application" builder) may output to dist/<app>/browser.
# Normalize to a single directory for the runtime image.
RUN mkdir -p /workspace/out \
  && if [ -d "/workspace/dist/spa/browser" ]; then \
       cp -a /workspace/dist/spa/browser/. /workspace/out/; \
     else \
       cp -a /workspace/dist/spa/. /workspace/out/; \
     fi

FROM nginx:1.27-alpine

COPY frontend/spa/nginx.conf /etc/nginx/conf.d/default.conf
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /workspace/out/ /usr/share/nginx/html/

EXPOSE 80
