package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
)

type AESGCM struct {
	gcm cipher.AEAD
}

func NewAESGCM(key []byte) (*AESGCM, error) {
	if len(key) != 32 {
		return nil, errors.New("aes-256-gcm requires 32-byte key")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("new cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("new gcm: %w", err)
	}
	return &AESGCM{gcm: gcm}, nil
}

func (a *AESGCM) Encrypt(plaintext, aad []byte) (string, error) {
	nonce := make([]byte, a.gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ct := a.gcm.Seal(nil, nonce, plaintext, aad)
	out := append(nonce, ct...)
	return base64.RawURLEncoding.EncodeToString(out), nil
}

func (a *AESGCM) Decrypt(encoded string, aad []byte) ([]byte, error) {
	raw, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return nil, errors.New("invalid ciphertext encoding")
	}
	ns := a.gcm.NonceSize()
	if len(raw) < ns {
		return nil, errors.New("invalid ciphertext")
	}
	nonce := raw[:ns]
	ct := raw[ns:]
	pt, err := a.gcm.Open(nil, nonce, ct, aad)
	if err != nil {
		return nil, errors.New("invalid ciphertext")
	}
	return pt, nil
}

func LoadAES256GCMKeyFromEnv(envVar string) ([]byte, error) {
	envVar = strings.TrimSpace(envVar)
	if envVar == "" {
		return nil, errors.New("env var required")
	}
	raw := strings.TrimSpace(os.Getenv(envVar))
	if raw == "" {
		return nil, errors.New("encryption key not configured")
	}

	key, err := decodeKeyMaterial(raw)
	if err != nil {
		return nil, err
	}
	if len(key) != 32 {
		return nil, errors.New("aes-256-gcm requires 32-byte key")
	}
	return key, nil
}

func NewAESGCMFromEnv(envVar string) (*AESGCM, error) {
	key, err := LoadAES256GCMKeyFromEnv(envVar)
	if err != nil {
		return nil, err
	}
	return NewAESGCM(key)
}

func decodeKeyMaterial(s string) ([]byte, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil, errors.New("encryption key not configured")
	}

	candidates := []func(string) ([]byte, error){
		func(v string) ([]byte, error) { return base64.RawStdEncoding.DecodeString(v) },
		func(v string) ([]byte, error) { return base64.StdEncoding.DecodeString(v) },
		func(v string) ([]byte, error) { return base64.RawURLEncoding.DecodeString(v) },
		func(v string) ([]byte, error) { return base64.URLEncoding.DecodeString(v) },
		func(v string) ([]byte, error) { return hex.DecodeString(v) },
	}
	for _, fn := range candidates {
		if b, err := fn(s); err == nil && len(b) > 0 {
			return b, nil
		}
	}
	return nil, errors.New("invalid encryption key encoding")
}
