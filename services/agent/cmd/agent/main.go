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
	"strings"
	"syscall"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"github.com/ironhost/agent/internal/docker"
	agentgrpc "github.com/ironhost/agent/internal/grpc"
	"github.com/ironhost/agent/internal/sysinfo"
)

var (
	port      = flag.Int("port", 8443, "gRPC server port")
	certFile  = flag.String("cert", sysinfo.DefaultCertDir()+"/server.crt", "TLS certificate file")
	keyFile   = flag.String("key", sysinfo.DefaultCertDir()+"/server.key", "TLS private key file")
	caFile    = flag.String("ca", sysinfo.DefaultCertDir()+"/ca.crt", "CA certificate for client verification")
	dataDir   = flag.String("data", sysinfo.DefaultDataDir(), "Data directory for server volumes")
	nodeID    = flag.String("node-id", "", "Unique node identifier")
	insecure  = flag.Bool("insecure", false, "Run without TLS (for development)")
	authToken = flag.String("token", "", "Authentication token (required in insecure mode)")
)

func main() {
	flag.Parse()

	// Also check environment variables
	if envToken := os.Getenv("DAEMON_TOKEN"); envToken != "" && *authToken == "" {
		*authToken = envToken
	}
	if os.Getenv("GRPC_INSECURE") == "true" {
		*insecure = true
	}

	if *nodeID == "" {
		// Generate from hostname if not provided
		hostname, err := os.Hostname()
		if err != nil {
			log.Fatalf("Failed to get hostname: %v", err)
		}
		*nodeID = hostname
	}

	log.Printf("IronHost Agent starting on node: %s", *nodeID)
	if *insecure {
		log.Println("WARNING: Running in INSECURE mode (no TLS)")
	}

	// Initialize Docker manager
	dockerMgr, err := docker.NewManager()
	if err != nil {
		log.Fatalf("Failed to initialize Docker manager: %v", err)
	}
	defer dockerMgr.Close()

	// Setup gRPC server options
	var opts []grpc.ServerOption

	if *insecure {
		// Insecure mode - use token authentication via interceptor
		if *authToken != "" {
			opts = append(opts, grpc.UnaryInterceptor(tokenAuthInterceptor(*authToken)))
			log.Println("Token authentication enabled")
		} else {
			log.Println("WARNING: No token set. Agent is open to connections!")
		}
	} else {
		// Production mode - use mTLS
		tlsConfig, err := loadTLSConfig(*certFile, *keyFile, *caFile)
		if err != nil {
			log.Fatalf("Failed to load TLS config: %v", err)
		}
		opts = append(opts, grpc.Creds(credentials.NewTLS(tlsConfig)))
	}

	opts = append(opts, grpc.MaxRecvMsgSize(16*1024*1024)) // 16MB max message size

	// Create gRPC server
	grpcServer := grpc.NewServer(opts...)

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

	mode := "mTLS"
	if *insecure {
		mode = "INSECURE"
	}
	log.Printf("IronHost Agent listening on :%d (%s mode)", *port, mode)

	if err := grpcServer.Serve(listener); err != nil {
		log.Fatalf("Failed to serve: %v", err)
	}

	<-ctx.Done()
	log.Println("Agent shutdown complete")
}

// tokenAuthInterceptor creates a gRPC interceptor that validates tokens
func tokenAuthInterceptor(validToken string) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		md, ok := metadata.FromIncomingContext(ctx)
		if !ok {
			return nil, status.Error(codes.Unauthenticated, "missing metadata")
		}

		authHeaders := md.Get("authorization")
		if len(authHeaders) == 0 {
			return nil, status.Error(codes.Unauthenticated, "missing authorization header")
		}

		token := strings.TrimPrefix(authHeaders[0], "Bearer ")
		if token != validToken {
			return nil, status.Error(codes.Unauthenticated, "invalid token")
		}

		return handler(ctx, req)
	}
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
