FROM alpine:latest

RUN apk add --no-cache openssl bash dos2unix

COPY generate-certs.sh /generate-certs.sh
RUN dos2unix /generate-certs.sh && chmod +x /generate-certs.sh

WORKDIR /certs

ENTRYPOINT ["/generate-certs.sh"]
