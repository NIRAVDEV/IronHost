#!/bin/bash
# Generate mTLS certificates for IronHost
# Run this script to create CA and certificates for Master and Agent communication

set -e

CERT_DIR="${1:-./certs}"
VALIDITY_DAYS=365
CA_SUBJECT="/C=US/ST=State/L=City/O=IronHost/CN=IronHost CA"
MASTER_SUBJECT="/C=US/ST=State/L=City/O=IronHost/CN=ironhost-master"
AGENT_SUBJECT="/C=US/ST=State/L=City/O=IronHost/CN=ironhost-agent"

echo "Creating certificate directory: $CERT_DIR"
mkdir -p "$CERT_DIR"

# Generate CA private key and certificate
echo "Generating CA certificate..."
openssl genrsa -out "$CERT_DIR/ca.key" 4096
openssl req -x509 -new -nodes -key "$CERT_DIR/ca.key" -sha256 -days $VALIDITY_DAYS \
    -out "$CERT_DIR/ca.crt" -subj "$CA_SUBJECT"

# Generate Master (client) certificate
echo "Generating Master client certificate..."
openssl genrsa -out "$CERT_DIR/client.key" 4096
openssl req -new -key "$CERT_DIR/client.key" -out "$CERT_DIR/client.csr" -subj "$MASTER_SUBJECT"
openssl x509 -req -in "$CERT_DIR/client.csr" -CA "$CERT_DIR/ca.crt" -CAkey "$CERT_DIR/ca.key" \
    -CAcreateserial -out "$CERT_DIR/client.crt" -days $VALIDITY_DAYS -sha256

# Generate Agent (server) certificate
echo "Generating Agent server certificate..."
openssl genrsa -out "$CERT_DIR/server.key" 4096

# Create SAN config for agent (allows multiple hostnames/IPs)
cat > "$CERT_DIR/agent.cnf" << EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = US
ST = State
L = City
O = IronHost
CN = ironhost-agent

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = ironhost-agent
DNS.3 = *.ironhost.local
IP.1 = 127.0.0.1
EOF

openssl req -new -key "$CERT_DIR/server.key" -out "$CERT_DIR/server.csr" -config "$CERT_DIR/agent.cnf"
openssl x509 -req -in "$CERT_DIR/server.csr" -CA "$CERT_DIR/ca.crt" -CAkey "$CERT_DIR/ca.key" \
    -CAcreateserial -out "$CERT_DIR/server.crt" -days $VALIDITY_DAYS -sha256 \
    -extensions v3_req -extfile "$CERT_DIR/agent.cnf"

# Cleanup CSR files
rm -f "$CERT_DIR"/*.csr "$CERT_DIR"/*.cnf "$CERT_DIR"/*.srl

# Set permissions
chmod 600 "$CERT_DIR"/*.key
chmod 644 "$CERT_DIR"/*.crt

echo ""
echo "Certificates generated successfully in $CERT_DIR:"
echo "  - ca.crt        : CA certificate (distribute to all nodes)"
echo "  - ca.key        : CA private key (keep secure!)"
echo "  - client.crt    : Master client certificate"
echo "  - client.key    : Master client private key"
echo "  - server.crt    : Agent server certificate"
echo "  - server.key    : Agent server private key"
echo ""
echo "Copy the appropriate files to each service:"
echo "  Master: ca.crt, client.crt, client.key"
echo "  Agent:  ca.crt, server.crt, server.key"
