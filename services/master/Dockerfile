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
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /ironhost-master ./cmd/master

# Runtime stage
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

# Create non-root user
RUN addgroup -S ironhost && adduser -S ironhost -G ironhost

WORKDIR /app

# Copy binary from builder
COPY --from=builder /ironhost-master .

# Copy migrations
COPY --from=builder /app/migrations ./migrations

# Create cert directory
RUN mkdir -p /etc/ironhost/certs && chown -R ironhost:ironhost /etc/ironhost

USER ironhost

EXPOSE 3000

ENTRYPOINT ["./ironhost-master"]
