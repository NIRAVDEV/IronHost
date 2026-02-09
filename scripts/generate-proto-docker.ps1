# Generate Go code from Protocol Buffer definitions using Docker
# Eliminates the need to install protoc locally

$ErrorActionPreference = "Stop"
$WorkingDir = Get-Location

Write-Host "Running proto generation inside Docker..."
Write-Host "This might take a moment to pull the image and install tools..."

docker run --rm `
    -v "${WorkingDir}:/app" `
    -w /app `
    golang:1.22-alpine `
    sh -c "apk add --no-cache protobuf-dev protoc && go install google.golang.org/protobuf/cmd/protoc-gen-go@latest && go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest && ./scripts/generate-proto.sh"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Proto generation complete!"
}
else {
    Write-Error "Proto generation failed inside Docker."
    exit 1
}
