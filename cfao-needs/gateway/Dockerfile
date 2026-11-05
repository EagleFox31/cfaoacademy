FROM nginx:1.27-alpine

LABEL org.opencontainers.image.title="CFAO Needs Gateway" \
      org.opencontainers.image.description="Passerelle Nginx et frontend SPA pour CFAO Needs" \
      org.opencontainers.image.vendor="CFAO Mobility" \
      org.opencontainers.image.version="0.1.2"

COPY gateway/nginx.conf /etc/nginx/conf.d/default.conf
COPY web/dist /usr/share/nginx/html

EXPOSE 80
