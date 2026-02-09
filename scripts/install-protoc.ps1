# Install Protocol Buffers verification script
# Downloads protoc and installs it locally to .bin/protoc

$ErrorActionPreference = "Stop"
$WorkingDir = Get-Location
$BinDir = "$WorkingDir\.bin"
$ProtocDir = "$BinDir\protoc"

# Create bin directory
if (-not (Test-Path $BinDir)) {
    New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
}

# Check if already installed
if (Test-Path "$ProtocDir\bin\protoc.exe") {
    Write-Host "protoc is already installed in $ProtocDir"
    exit 0
}

Write-Host "Downloading protoc..."
# URL for protoc 25.1 win64
$ProtocUrl = "https://github.com/protocolbuffers/protobuf/releases/download/v25.1/protoc-25.1-win64.zip"
$ZipFile = "$BinDir\protoc.zip"

Invoke-WebRequest -Uri $ProtocUrl -OutFile $ZipFile

Write-Host "Extracting protoc..."
Expand-Archive -Path $ZipFile -DestinationPath $ProtocDir -Force

# Cleanup
Remove-Item $ZipFile

# Verify
if (Test-Path "$ProtocDir\bin\protoc.exe") {
    Write-Host "protoc installed successfully to $ProtocDir\bin\protoc.exe"
}
else {
    Write-Error "Failed to install protoc"
    exit 1
}
