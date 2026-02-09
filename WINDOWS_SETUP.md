# IronHost Development Tools Setup

This script sets up the necessary tools for IronHost development on Windows using PowerShell.

## 1. Install Protobuf Compiler (protoc)

You need `protoc` to compile .proto files.

1. Download the latest release from https://github.com/protocolbuffers/protobuf/releases
2. Look for `protoc-*-win64.zip`
3. Extract the contents to a folder (e.g., `C:\Program Files\protoc`)
4. Add the `bin` directory to your system PATH environment variable.

## 2. Install Go Protobuf Plugins

Run the following commands in PowerShell:

```powershell
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
```

## 3. Generate Proto Files

Use the provided PowerShell script: `scripts/generate-proto.ps1`

```powershell
.\scripts\generate-proto.ps1
```

## 4. Docker Compose

On Windows with Docker Desktop, use `docker compose` instead of `docker-compose`.

```powershell
cd deployments
docker compose up -d
```
