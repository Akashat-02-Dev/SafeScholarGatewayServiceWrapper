package adapters

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"time"

	"safescholar/gateway/config"
	"safescholar/gateway/internal/auth"
	"safescholar/gateway/internal/middleware"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/metadata"
)

func DialGRPC(ctx context.Context, target string, cfg config.MTLSConfig) (*grpc.ClientConn, error) {
	return DialGRPCWithDeps(ctx, target, cfg, GRPCDeps{})
}

type GRPCDeps struct {
	TokenGenerator  *auth.TokenGenerator
	ServiceTokenTTL time.Duration
	GatewayName     string
}

func DialGRPCWithDeps(ctx context.Context, target string, cfg config.MTLSConfig, deps GRPCDeps) (*grpc.ClientConn, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	target = strings.TrimSpace(target)
	if target == "" {
		return nil, errors.New("grpc target required")
	}
	deps.GatewayName = strings.TrimSpace(deps.GatewayName)
	if deps.GatewayName == "" {
		deps.GatewayName = "safescholar-gateway"
	}
	if deps.ServiceTokenTTL <= 0 {
		deps.ServiceTokenTTL = 2 * time.Minute
	}

	opts := []grpc.DialOption{
		grpc.WithBlock(),
		grpc.WithUnaryInterceptor(unaryAuthInterceptor(deps)),
		grpc.WithStreamInterceptor(streamAuthInterceptor(deps)),
	}

	if !cfg.Enabled {
		opts = append(opts, grpc.WithTransportCredentials(credentials.NewTLS(&tls.Config{MinVersion: tlsMinVersion(cfg.MinVersion)})))
		return grpc.DialContext(ctx, target, opts...)
	}

	tlsCfg, err := buildGRPCTLSConfig(cfg)
	if err != nil {
		return nil, err
	}
	creds := credentials.NewTLS(tlsCfg)
	opts = append(opts, grpc.WithTransportCredentials(creds))
	return grpc.DialContext(ctx, target, opts...)
}

func buildGRPCTLSConfig(cfg config.MTLSConfig) (*tls.Config, error) {
	caPEM, err := os.ReadFile(filepath.Clean(cfg.CACertFile))
	if err != nil {
		return nil, err
	}
	roots := x509.NewCertPool()
	if !roots.AppendCertsFromPEM(caPEM) {
		return nil, errors.New("invalid mtls ca cert")
	}
	cert, err := tls.LoadX509KeyPair(filepath.Clean(cfg.ClientCertFile), filepath.Clean(cfg.ClientKeyFile))
	if err != nil {
		return nil, err
	}
	return &tls.Config{
		MinVersion:   tlsMinVersion(cfg.MinVersion),
		RootCAs:      roots,
		Certificates: []tls.Certificate{cert},
		ServerName:   cfg.ServerName,
	}, nil
}

func tlsMinVersion(v uint16) uint16 {
	if v == 0 {
		return tls.VersionTLS13
	}
	return v
}

func unaryAuthInterceptor(deps GRPCDeps) grpc.UnaryClientInterceptor {
	return func(ctx context.Context, method string, req, reply any, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
		ctx = withOutgoingMetadata(ctx, deps)
		return invoker(ctx, method, req, reply, cc, opts...)
	}
}

func streamAuthInterceptor(deps GRPCDeps) grpc.StreamClientInterceptor {
	return func(ctx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, method string, streamer grpc.Streamer, opts ...grpc.CallOption) (grpc.ClientStream, error) {
		ctx = withOutgoingMetadata(ctx, deps)
		return streamer(ctx, desc, cc, method, opts...)
	}
}

func withOutgoingMetadata(ctx context.Context, deps GRPCDeps) context.Context {
	md, _ := metadata.FromOutgoingContext(ctx)
	md = md.Copy()

	if cid := middleware.CorrelationIDFromContext(ctx); strings.TrimSpace(cid) != "" {
		md.Set("x-request-id", cid)
		md.Set("x-correlation-id", cid)
		md.Set("x-ss-correlation-id", cid)
	}
	md.Set("x-gateway", deps.GatewayName)

	uc := middleware.UserContextFromContext(ctx)
	if uc.IsAuthenticated {
		md.Set("x-authenticated", "true")
		if strings.TrimSpace(uc.UserID) != "" {
			md.Set("x-user-id", uc.UserID)
		}
		if strings.TrimSpace(uc.InstitutionID) != "" {
			md.Set("x-institution-id", uc.InstitutionID)
		}
		if strings.TrimSpace(uc.SessionID) != "" {
			md.Set("x-session-id", uc.SessionID)
		}
		if strings.TrimSpace(uc.TokenID) != "" {
			md.Set("x-token-id", uc.TokenID)
		}
		if len(uc.Roles) > 0 {
			md.Set("x-roles", strings.Join(uc.Roles, ","))
		}
		if len(uc.Permissions) > 0 {
			md.Set("x-permissions", strings.Join(uc.Permissions, ","))
		}
	} else {
		md.Set("x-authenticated", "false")
	}

	if deps.TokenGenerator != nil {
		tok, _, err := deps.TokenGenerator.IssueServiceToken(ctx, "gateway", deps.ServiceTokenTTL)
		if err == nil && strings.TrimSpace(tok) != "" {
			md.Set("authorization", "Bearer "+tok)
			md.Set("x-ss-service-token", tok)
		}
	}

	return metadata.NewOutgoingContext(ctx, md)
}
