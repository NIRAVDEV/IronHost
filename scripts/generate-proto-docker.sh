#!/bin/bash
# Generate Go code from Protocol Buffer definitions using Docker
# Eliminates the need to install protoc locally

set -e

echo "Running proto generation inside Docker..."
echo "This might take a moment to pull the image and install tools..."

docker run --rm \
    -v "$(pwd):/app" \
    -w /app \
    golang:1.22-alpine \
    sh -c "apk add --no-cache protobuf-dev protoc && go install google.golang.org/protobuf/cmd/protoc-gen-go@latest && go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest && ./scripts/generate-proto.sh"

echo "Proto generation complete!"
