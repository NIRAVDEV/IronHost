#!/bin/bash
# Generate Go code from Protocol Buffer definitions
# Requires: protoc, protoc-gen-go, protoc-gen-go-grpc

set -e

PROTO_DIR="./proto"
GO_OUT_MASTER="./services/master/pkg/proto"
GO_OUT_AGENT="./services/agent/pkg/proto"

echo "Installing protoc plugins if needed..."
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

echo "Creating output directories..."
mkdir -p "$GO_OUT_MASTER" "$GO_OUT_AGENT"

echo "Generating Go code from proto files..."
# Check for protoc
if command -v protoc &> /dev/null; then
    PROTOC_CMD="protoc"
elif [ -f "./.bin/protoc/bin/protoc.exe" ]; then
    PROTOC_CMD="./.bin/protoc/bin/protoc.exe"
else
    echo "Error: 'protoc' not found in PATH."
    echo "Please run '.\scripts\generate-proto.ps1' in PowerShell to automatically install it and generate code."
    exit 1
fi

$PROTOC_CMD \
    --proto_path="$PROTO_DIR" \
    --go_out="$GO_OUT_MASTER" \
    --go_opt=paths=source_relative \
    --go-grpc_out="$GO_OUT_MASTER" \
    --go-grpc_opt=paths=source_relative \
    "$PROTO_DIR/ironhost/v1/common.proto" \
    "$PROTO_DIR/ironhost/v1/agent.proto"

# Copy to agent as well
cp -r "$GO_OUT_MASTER"/* "$GO_OUT_AGENT"/

echo "Proto generation complete!"
echo "Generated files in:"
echo "  - $GO_OUT_MASTER"
echo "  - $GO_OUT_AGENT"
