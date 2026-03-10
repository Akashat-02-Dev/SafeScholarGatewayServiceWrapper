package security

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"

	"golang.org/x/crypto/argon2"
	"golang.org/x/crypto/bcrypt"
)

type Argon2idParams struct {
	Memory      uint32
	Iterations  uint32
	Parallelism uint8
	SaltLength  uint32
	KeyLength   uint32
}

var DefaultArgon2idParams = Argon2idParams{
	Memory:      64 * 1024,
	Iterations:  3,
	Parallelism: 4,
	SaltLength:  16,
	KeyLength:   32,
}

func HashPassword(password string, params Argon2idParams) (string, error) {
	if strings.TrimSpace(password) == "" {
		return "", errors.New("password required")
	}
	salt := make([]byte, params.SaltLength)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return "", err
	}
	key := argon2.IDKey([]byte(password), salt, params.Iterations, params.Memory, params.Parallelism, params.KeyLength)

	b64Salt := base64.RawStdEncoding.EncodeToString(salt)
	b64Key := base64.RawStdEncoding.EncodeToString(key)

	encoded := fmt.Sprintf("$argon2id$v=19$m=%d,t=%d,p=%d$%s$%s", params.Memory, params.Iterations, params.Parallelism, b64Salt, b64Key)
	return encoded, nil
}

func VerifyPassword(encodedHash, password string) (bool, error) {
	if strings.TrimSpace(password) == "" {
		return false, errors.New("password required")
	}
	encodedHash = strings.TrimSpace(encodedHash)
	if encodedHash == "" {
		return false, errors.New("password hash required")
	}
	if strings.HasPrefix(encodedHash, "$2a$") || strings.HasPrefix(encodedHash, "$2b$") || strings.HasPrefix(encodedHash, "$2y$") {
		if err := bcrypt.CompareHashAndPassword([]byte(encodedHash), []byte(password)); err != nil {
			return false, nil
		}
		return true, nil
	}

	p, salt, expectedKey, err := decodeArgon2id(encodedHash)
	if err != nil {
		return false, err
	}
	actualKey := argon2.IDKey([]byte(password), salt, p.Iterations, p.Memory, p.Parallelism, p.KeyLength)
	if subtle.ConstantTimeCompare(expectedKey, actualKey) == 1 {
		return true, nil
	}
	return false, nil
}

func HashPasswordBcrypt(password string, cost int) (string, error) {
	if strings.TrimSpace(password) == "" {
		return "", errors.New("password required")
	}
	if cost == 0 {
		cost = bcrypt.DefaultCost
	}
	if cost < bcrypt.MinCost || cost > bcrypt.MaxCost {
		return "", errors.New("invalid bcrypt cost")
	}
	b, err := bcrypt.GenerateFromPassword([]byte(password), cost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func decodeArgon2id(encoded string) (Argon2idParams, []byte, []byte, error) {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 {
		return Argon2idParams{}, nil, nil, errors.New("invalid password hash format")
	}
	if parts[1] != "argon2id" {
		return Argon2idParams{}, nil, nil, errors.New("invalid password hash format")
	}
	if parts[2] != "v=19" {
		return Argon2idParams{}, nil, nil, errors.New("invalid password hash version")
	}

	mem, it, par, err := parseArgon2Params(parts[3])
	if err != nil {
		return Argon2idParams{}, nil, nil, err
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return Argon2idParams{}, nil, nil, errors.New("invalid password hash salt")
	}
	key, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return Argon2idParams{}, nil, nil, errors.New("invalid password hash key")
	}

	params := Argon2idParams{
		Memory:      mem,
		Iterations:  it,
		Parallelism: par,
		SaltLength:  uint32(len(salt)),
		KeyLength:   uint32(len(key)),
	}

	return params, salt, key, nil
}

func parseArgon2Params(s string) (uint32, uint32, uint8, error) {
	var mem uint32
	var it uint32
	var par uint8
	for _, kv := range strings.Split(s, ",") {
		kv = strings.TrimSpace(kv)
		if kv == "" {
			continue
		}
		pair := strings.SplitN(kv, "=", 2)
		if len(pair) != 2 {
			return 0, 0, 0, errors.New("invalid password hash params")
		}
		switch pair[0] {
		case "m":
			v, err := strconv.ParseUint(pair[1], 10, 32)
			if err != nil {
				return 0, 0, 0, errors.New("invalid password hash params")
			}
			mem = uint32(v)
		case "t":
			v, err := strconv.ParseUint(pair[1], 10, 32)
			if err != nil {
				return 0, 0, 0, errors.New("invalid password hash params")
			}
			it = uint32(v)
		case "p":
			v, err := strconv.ParseUint(pair[1], 10, 8)
			if err != nil {
				return 0, 0, 0, errors.New("invalid password hash params")
			}
			par = uint8(v)
		}
	}
	if mem == 0 || it == 0 || par == 0 {
		return 0, 0, 0, errors.New("invalid password hash params")
	}
	return mem, it, par, nil
}
