# Generate Go code from Protocol Buffer definitions
# PowerShell script for Windows

$ErrorActionPreference = "Stop"
$WorkingDir = Get-Location
$PROTO_DIR = ".\proto"
$GO_OUT_MASTER = ".\services\master\pkg\proto"
$GO_OUT_AGENT = ".\services\agent\pkg\proto"
$LOCAL_PROTOC = "$WorkingDir\.bin\protoc\bin\protoc.exe"

# 1. Check for protoc
$PROTOC_CMD = "protoc"
if (Test-Path $LOCAL_PROTOC) {
    Write-Host "Using local protoc: $LOCAL_PROTOC"
    $PROTOC_CMD = $LOCAL_PROTOC
}
elseif (-not (Get-Command protoc -ErrorAction SilentlyContinue)) {
    Write-Warning "protoc not found in PATH or local .bin folder."
    Write-Host "Attempting to install protoc locally..."
    
    # Try to run install script
    if (Test-Path ".\scripts\install-protoc.ps1") {
        & .\scripts\install-protoc.ps1
        if ($LASTEXITCODE -eq 0 -and (Test-Path $LOCAL_PROTOC)) {
            $PROTOC_CMD = $LOCAL_PROTOC
        }
        else {
            Write-Error "Failed to install protoc. Please install it manually."
            exit 1
        }
    }
    else {
        Write-Error "Install script not found. Please install Protocol Buffers compiler manually."
        exit 1
    }
}

# 2. Install Go plugins
Write-Host "Installing/Updating protoc plugins..."
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

# 3. Create output directories
Write-Host "Creating output directories..."
New-Item -ItemType Directory -Force -Path $GO_OUT_MASTER | Out-Null
New-Item -ItemType Directory -Force -Path $GO_OUT_AGENT | Out-Null

# 4. Generate code
Write-Host "Generating Go code..."
& $PROTOC_CMD `
    --proto_path="$PROTO_DIR" `
    --go_out="$GO_OUT_MASTER" `
    --go_opt=paths=source_relative `
    --go-grpc_out="$GO_OUT_MASTER" `
    --go-grpc_opt=paths=source_relative `
    "$PROTO_DIR/ironhost/v1/common.proto" `
    "$PROTO_DIR/ironhost/v1/agent.proto"

if ($LASTEXITCODE -ne 0) {
    Write-Error "Protoc generation failed!"
    exit 1
}

# 5. Copy to agent
Write-Host "Copying generated code to Agent service..."
Copy-Item -Path "$GO_OUT_MASTER\*" -Destination "$GO_OUT_AGENT" -Recurse -Force

Write-Host "Success! Protocol buffers generated."
