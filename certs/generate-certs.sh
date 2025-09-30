#!/bin/bash

# Script de génération automatique de certificats SSL
# Lit les domaines depuis les variables d'environnement

CERT_DIR="/certs"
DAYS=365

echo "🔐 Génération automatique des certificats SSL..."

# Toujours générer localhost
if [ ! -f "$CERT_DIR/localhost-cert.pem" ] || [ ! -f "$CERT_DIR/localhost-key.pem" ]; then
  echo "📝 Génération des certificats localhost..."
  openssl req -x509 -nodes -days $DAYS -newkey rsa:2048 \
    -keyout "$CERT_DIR/localhost-key.pem" \
    -out "$CERT_DIR/localhost-cert.pem" \
    -subj "/C=FR/ST=Bretagne/L=Rennes/O=MedAlert/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1"
  echo "✅ Certificats localhost créés"
else
  echo "✅ Certificats localhost déjà existants"
fi

# Générer pour le domaine si défini
if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "localhost" ]; then
  if [ ! -f "$CERT_DIR/${DOMAIN}-cert.pem" ] || [ ! -f "$CERT_DIR/${DOMAIN}-key.pem" ]; then
    echo "📝 Génération des certificats pour $DOMAIN..."
    openssl req -x509 -nodes -days $DAYS -newkey rsa:2048 \
      -keyout "$CERT_DIR/${DOMAIN}-key.pem" \
      -out "$CERT_DIR/${DOMAIN}-cert.pem" \
      -subj "/C=FR/ST=Bretagne/L=Rennes/O=MedAlert/CN=$DOMAIN" \
      -addext "subjectAltName=DNS:$DOMAIN,DNS:*.$DOMAIN"
    echo "✅ Certificats $DOMAIN créés"
  else
    echo "✅ Certificats $DOMAIN déjà existants"
  fi
fi

echo ""
echo "📦 Certificats disponibles:"
ls -lh "$CERT_DIR"/*.pem 2>/dev/null || echo "Aucun certificat trouvé"

echo ""
echo "🎉 Configuration SSL terminée!"
