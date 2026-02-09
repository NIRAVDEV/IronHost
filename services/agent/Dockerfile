# Build stage
FROM golang:1.24-alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /ironhost-agent ./cmd/agent

# Runtime stage
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

# Create non-root user
RUN addgroup -S ironhost && adduser -S ironhost -G ironhost

WORKDIR /app

# Copy binary from builder
COPY --from=builder /ironhost-agent .

# Create directories
RUN mkdir -p /etc/ironhost/certs /var/lib/ironhost/servers && \
    chown -R ironhost:ironhost /etc/ironhost /var/lib/ironhost

# Note: Agent needs access to Docker socket
# Run with: -v /var/run/docker.sock:/var/run/docker.sock

USER ironhost

EXPOSE 8443

ENTRYPOINT ["./ironhost-agent"]
