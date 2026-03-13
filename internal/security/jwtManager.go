package security

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/binary"
	"encoding/pem"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type JWTManager struct {
	issuer     string
	audience   string
	clockSkew  time.Duration
	privateKey *rsa.PrivateKey
	publicKey  *rsa.PublicKey
}

type TokenClaims struct {
	SessionID   string   `json:"sid"`
	TokenID     string   `json:"tid"`
	Roles       []string `json:"roles"`
	Permissions []string `json:"permissions"`
	Institution string   `json:"institution"`
	jwt.RegisteredClaims
}

type TokenType string

const (
	TokenTypeAccess  TokenType = "access"
	TokenTypeRefresh TokenType = "refresh"
	TokenTypeService TokenType = "service"
)

func NewJWTManager(issuer, audience, privateKeyPEMFile, publicKeyPEMFile string, clockSkew time.Duration) (*JWTManager, error) {
	issuer = strings.TrimSpace(issuer)
	audience = strings.TrimSpace(audience)
	if issuer == "" || audience == "" {
		return nil, errors.New("jwt issuer and audience required")
	}
	if clockSkew < 0 {
		clockSkew = 0
	}
	priv, err := readRSAPrivateKey(privateKeyPEMFile)
	if err != nil {
		return nil, err
	}
	pub, err := readRSAPublicKey(publicKeyPEMFile)
	if err != nil {
		return nil, err
	}
	return &JWTManager{
		issuer:     issuer,
		audience:   audience,
		clockSkew:  clockSkew,
		privateKey: priv,
		publicKey:  pub,
	}, nil
}

func (m *JWTManager) Generate(subject string, tokenType TokenType, sessionID string, roles, permissions []string, institution string, ttl time.Duration) (string, TokenClaims, error) {
	if strings.TrimSpace(subject) == "" {
		return "", TokenClaims{}, errors.New("subject required")
	}
	if ttl <= 0 {
		return "", TokenClaims{}, errors.New("ttl required")
	}
	switch tokenType {
	case TokenTypeAccess, TokenTypeRefresh, TokenTypeService:
	default:
		return "", TokenClaims{}, errors.New("invalid token type")
	}
	institution = strings.TrimSpace(institution)
	sessionID = strings.TrimSpace(sessionID)
	if tokenType != TokenTypeService {
		if institution == "" {
			return "", TokenClaims{}, errors.New("institution required")
		}
		if sessionID == "" {
			return "", TokenClaims{}, errors.New("session required")
		}
	}

	now := time.Now().UTC()
	tid, err := newUUIDv4()
	if err != nil {
		return "", TokenClaims{}, err
	}

	claims := TokenClaims{
		SessionID:   sessionID,
		TokenID:     tid,
		Roles:       normalizeLower(roles),
		Permissions: normalizeUpper(permissions),
		Institution: institution,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    m.issuer,
			Subject:   subject,
			Audience:  jwt.ClaimStrings{m.audience},
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now.Add(-m.clockSkew)),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
			ID:        string(tokenType),
		},
	}

	t := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	s, err := t.SignedString(m.privateKey)
	if err != nil {
		return "", TokenClaims{}, err
	}
	return s, claims, nil
}

func (m *JWTManager) ParseAndValidate(tokenString string) (TokenClaims, error) {
	tokenString = strings.TrimSpace(tokenString)
	if tokenString == "" {
		return TokenClaims{}, errors.New("token required")
	}

	parser := jwt.NewParser(
		jwt.WithAudience(m.audience),
		jwt.WithIssuer(m.issuer),
		jwt.WithValidMethods([]string{jwt.SigningMethodRS256.Alg()}),
		jwt.WithLeeway(m.clockSkew),
	)

	var claims TokenClaims
	if _, err := parser.ParseWithClaims(tokenString, &claims, func(t *jwt.Token) (any, error) {
		return m.publicKey, nil
	}); err != nil {
		return TokenClaims{}, errors.New("invalid token")
	}

	if claims.Subject == "" || claims.TokenID == "" {
		return TokenClaims{}, errors.New("invalid token")
	}
	switch TokenType(strings.TrimSpace(claims.ID)) {
	case TokenTypeAccess, TokenTypeRefresh, TokenTypeService:
	default:
		return TokenClaims{}, errors.New("invalid token")
	}

	return claims, nil
}

func readRSAPrivateKey(path string) (*rsa.PrivateKey, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil, errors.New("jwt private key required")
	}
	b := []byte(path)
	if !strings.Contains(path, "-----BEGIN") {
		var err error
		b, err = os.ReadFile(filepath.Clean(path))
		if err != nil {
			return nil, fmt.Errorf("read jwt private key: %w", err)
		}
	}
	block, _ := pem.Decode(b)
	if block == nil {
		return nil, errors.New("invalid jwt private key pem")
	}
	if k, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return k, nil
	}
	pk, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, errors.New("invalid jwt private key")
	}
	k, ok := pk.(*rsa.PrivateKey)
	if !ok {
		return nil, errors.New("invalid jwt private key")
	}
	return k, nil
}

func readRSAPublicKey(path string) (*rsa.PublicKey, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil, errors.New("jwt public key required")
	}
	b := []byte(path)
	if !strings.Contains(path, "-----BEGIN") {
		var err error
		b, err = os.ReadFile(filepath.Clean(path))
		if err != nil {
			return nil, fmt.Errorf("read jwt public key: %w", err)
		}
	}
	block, _ := pem.Decode(b)
	if block == nil {
		return nil, errors.New("invalid jwt public key pem")
	}
	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err == nil {
		if k, ok := pub.(*rsa.PublicKey); ok {
			return k, nil
		}
	}
	if cert, err := x509.ParseCertificate(block.Bytes); err == nil {
		if k, ok := cert.PublicKey.(*rsa.PublicKey); ok {
			return k, nil
		}
	}
	return nil, errors.New("invalid jwt public key")
}

func newUUIDv4() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	p1 := binary.BigEndian.Uint32(b[0:4])
	p2 := binary.BigEndian.Uint16(b[4:6])
	p3 := binary.BigEndian.Uint16(b[6:8])
	p4 := binary.BigEndian.Uint16(b[8:10])
	p5 := uint64(0)
	for i := 10; i < 16; i++ {
		p5 = (p5 << 8) | uint64(b[i])
	}
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", p1, p2, p3, p4, p5), nil
}

func normalizeLower(in []string) []string {
	out := make([]string, 0, len(in))
	seen := map[string]struct{}{}
	for _, s := range in {
		v := strings.ToLower(strings.TrimSpace(s))
		if v == "" {
			continue
		}
		if _, ok := seen[v]; ok {
			continue
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	return out
}

func normalizeUpper(in []string) []string {
	out := make([]string, 0, len(in))
	seen := map[string]struct{}{}
	for _, s := range in {
		v := strings.ToUpper(strings.TrimSpace(s))
		if v == "" {
			continue
		}
		if _, ok := seen[v]; ok {
			continue
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	return out
}
