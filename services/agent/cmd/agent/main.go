package main

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"flag"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"

	"github.com/ironhost/agent/internal/docker"
	agentgrpc "github.com/ironhost/agent/internal/grpc"
)

var (
	port     = flag.Int("port", 8443, "gRPC server port")
	certFile = flag.String("cert", "/etc/ironhost/certs/server.crt", "TLS certificate file")
	keyFile  = flag.String("key", "/etc/ironhost/certs/server.key", "TLS private key file")
	caFile   = flag.String("ca", "/etc/ironhost/certs/ca.crt", "CA certificate for client verification")
	dataDir  = flag.String("data", "/var/lib/ironhost", "Data directory for server volumes")
	nodeID   = flag.String("node-id", "", "Unique node identifier")
)

func main() {
	flag.Parse()

	if *nodeID == "" {
		// Generate from hostname if not provided
		hostname, err := os.Hostname()
		if err != nil {
			log.Fatalf("Failed to get hostname: %v", err)
		}
		*nodeID = hostname
	}

	log.Printf("IronHost Agent starting on node: %s", *nodeID)

	// Initialize Docker manager
	dockerMgr, err := docker.NewManager()
	if err != nil {
		log.Fatalf("Failed to initialize Docker manager: %v", err)
	}
	defer dockerMgr.Close()

	// Setup mTLS credentials
	tlsConfig, err := loadTLSConfig(*certFile, *keyFile, *caFile)
	if err != nil {
		log.Fatalf("Failed to load TLS config: %v", err)
	}

	// Create gRPC server with mTLS
	grpcServer := grpc.NewServer(
		grpc.Creds(credentials.NewTLS(tlsConfig)),
		grpc.MaxRecvMsgSize(16*1024*1024), // 16MB max message size
	)

	// Register agent service
	agentService := agentgrpc.NewAgentService(*nodeID, dockerMgr, *dataDir)
	agentgrpc.RegisterAgentServiceServer(grpcServer, agentService)

	// Start listening
	listener, err := net.Listen("tcp", fmt.Sprintf(":%d", *port))
	if err != nil {
		log.Fatalf("Failed to listen on port %d: %v", *port, err)
	}

	// Graceful shutdown handling
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		<-sigChan
		log.Println("Received shutdown signal, gracefully stopping...")
		grpcServer.GracefulStop()
		cancel()
	}()

	log.Printf("IronHost Agent listening on :%d with mTLS", *port)
	if err := grpcServer.Serve(listener); err != nil {
		log.Fatalf("Failed to serve: %v", err)
	}

	<-ctx.Done()
	log.Println("Agent shutdown complete")
}

// loadTLSConfig creates a TLS config for mTLS (mutual TLS)
func loadTLSConfig(certFile, keyFile, caFile string) (*tls.Config, error) {
	// Load server certificate and key
	cert, err := tls.LoadX509KeyPair(certFile, keyFile)
	if err != nil {
		return nil, fmt.Errorf("failed to load server certificate: %w", err)
	}

	// Load CA certificate for client verification
	caCert, err := os.ReadFile(caFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read CA certificate: %w", err)
	}

	caPool := x509.NewCertPool()
	if !caPool.AppendCertsFromPEM(caCert) {
		return nil, fmt.Errorf("failed to parse CA certificate")
	}

	return &tls.Config{
		Certificates: []tls.Certificate{cert},
		ClientAuth:   tls.RequireAndVerifyClientCert,
		ClientCAs:    caPool,
		MinVersion:   tls.VersionTLS13,
	}, nil
}
