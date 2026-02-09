package grpc

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"
	"sync"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
)

// ClientPool manages gRPC connections to agent nodes
type ClientPool struct {
	certDir string
	clients map[string]*grpc.ClientConn
	mu      sync.RWMutex
}

// NewClientPool creates a new gRPC client pool
func NewClientPool(certDir string) *ClientPool {
	return &ClientPool{
		certDir: certDir,
		clients: make(map[string]*grpc.ClientConn),
	}
}

// GetClient returns a gRPC client for the specified node address
func (p *ClientPool) GetClient(nodeAddress string) (*grpc.ClientConn, error) {
	p.mu.RLock()
	if conn, exists := p.clients[nodeAddress]; exists {
		p.mu.RUnlock()
		return conn, nil
	}
	p.mu.RUnlock()

	// Create new connection
	p.mu.Lock()
	defer p.mu.Unlock()

	// Double-check after acquiring write lock
	if conn, exists := p.clients[nodeAddress]; exists {
		return conn, nil
	}

	tlsConfig, err := p.loadTLSConfig()
	if err != nil {
		return nil, err
	}

	conn, err := grpc.Dial(
		nodeAddress,
		grpc.WithTransportCredentials(credentials.NewTLS(tlsConfig)),
		grpc.WithDefaultCallOptions(grpc.MaxCallRecvMsgSize(16*1024*1024)),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to agent at %s: %w", nodeAddress, err)
	}

	p.clients[nodeAddress] = conn
	return conn, nil
}

// RemoveClient removes and closes a client connection
func (p *ClientPool) RemoveClient(nodeAddress string) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if conn, exists := p.clients[nodeAddress]; exists {
		conn.Close()
		delete(p.clients, nodeAddress)
	}
}

// CloseAll closes all client connections
func (p *ClientPool) CloseAll() {
	p.mu.Lock()
	defer p.mu.Unlock()

	for addr, conn := range p.clients {
		conn.Close()
		delete(p.clients, addr)
	}
}

// loadTLSConfig loads mTLS configuration for client connections
func (p *ClientPool) loadTLSConfig() (*tls.Config, error) {
	certFile := p.certDir + "/client.crt"
	keyFile := p.certDir + "/client.key"
	caFile := p.certDir + "/ca.crt"

	// Load client certificate
	cert, err := tls.LoadX509KeyPair(certFile, keyFile)
	if err != nil {
		return nil, fmt.Errorf("failed to load client certificate: %w", err)
	}

	// Load CA certificate
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
		RootCAs:      caPool,
		MinVersion:   tls.VersionTLS13,
	}, nil
}
