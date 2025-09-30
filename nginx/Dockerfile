FROM nginx:alpine
RUN mkdir -p /etc/nginx/certs
COPY nginx.conf /etc/nginx/nginx.conf.template
CMD envsubst '${DOMAIN}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf && nginx -g 'daemon off;'
