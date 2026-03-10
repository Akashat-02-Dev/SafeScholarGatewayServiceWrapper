package config

import (
	"crypto/x509"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

type Environment string

const (
	EnvDev  Environment = "dev"
	EnvTest Environment = "test"
	EnvProd Environment = "prod"
)

type Config struct {
	Env             Environment      `yaml:"env"`
	Server          ServerConfig     `yaml:"server"`
	Postgres        PostgresConfig   `yaml:"postgres"`
	Redis           RedisConfig      `yaml:"redis"`
	JWT             JWTConfig        `yaml:"jwt"`
	OAuth           OAuthConfig      `yaml:"oauth"`
	MTLS            MTLSConfig       `yaml:"mtls"`
	CORS            CORSConfig       `yaml:"cors"`
	RateLimit       RateLimitConfig  `yaml:"rateLimit"`
	ServiceRegistry RegistryConfig   `yaml:"serviceRegistry"`
	Security        SecurityConfig   `yaml:"security"`
	Audit           AuditConfig      `yaml:"audit"`
	Bootstrap       BootstrapConfig  `yaml:"bootstrap"`
}

type ServerConfig struct {
	Host                 string        `yaml:"host"`
	Port                 int           `yaml:"port"`
	ReadHeaderTimeout    time.Duration `yaml:"readHeaderTimeout"`
	ReadTimeout          time.Duration `yaml:"readTimeout"`
	WriteTimeout         time.Duration `yaml:"writeTimeout"`
	IdleTimeout          time.Duration `yaml:"idleTimeout"`
	MaxRequestBodyBytes  int64         `yaml:"maxRequestBodyBytes"`
	TLSCertFile          string        `yaml:"tlsCertFile"`
	TLSKeyFile           string        `yaml:"tlsKeyFile"`
	TrustedProxyCIDRs    []string      `yaml:"trustedProxyCidrs"`
	AllowedHostnames     []string      `yaml:"allowedHostnames"`
	ExternalBaseURL      string        `yaml:"externalBaseUrl"`
}

type PostgresConfig struct {
	ConnString        string `yaml:"connString"`
	AppName           string `yaml:"appName"`
	MaxConns          int32  `yaml:"maxConns"`
	MinConns          int32  `yaml:"minConns"`
	HealthCheckPeriod time.Duration `yaml:"healthCheckPeriod"`
}

type RedisConfig struct {
	Addr     string        `yaml:"addr"`
	Username string        `yaml:"username"`
	Password string        `yaml:"password"`
	DB       int           `yaml:"db"`
	UseTLS   bool          `yaml:"useTls"`
	DialTimeout  time.Duration `yaml:"dialTimeout"`
	ReadTimeout  time.Duration `yaml:"readTimeout"`
	WriteTimeout time.Duration `yaml:"writeTimeout"`
}

type JWTConfig struct {
	Issuer              string        `yaml:"issuer"`
	Audience            string        `yaml:"audience"`
	PrivateKeyPEMFile   string        `yaml:"privateKeyPemFile"`
	PublicKeyPEMFile    string        `yaml:"publicKeyPemFile"`
	AccessTokenTTL      time.Duration `yaml:"accessTokenTtl"`
	RefreshTokenTTL     time.Duration `yaml:"refreshTokenTtl"`
	ServiceTokenTTL     time.Duration `yaml:"serviceTokenTtl"`
	ClockSkew           time.Duration `yaml:"clockSkew"`
}

type OAuthConfig struct {
	StateCookieName string `yaml:"stateCookieName"`
	StateTTL        time.Duration `yaml:"stateTtl"`
	Google          OAuthProviderConfig `yaml:"google"`
	Microsoft       OAuthProviderConfig `yaml:"microsoft"`
	Apple           OAuthProviderConfig `yaml:"apple"`
}

type OAuthProviderConfig struct {
	Enabled      bool     `yaml:"enabled"`
	ClientID     string   `yaml:"clientId"`
	ClientSecret string   `yaml:"clientSecret"`
	RedirectURL  string   `yaml:"redirectUrl"`
	Scopes       []string `yaml:"scopes"`
	Tenant       string   `yaml:"tenant"`
}

type MTLSConfig struct {
	Enabled          bool   `yaml:"enabled"`
	ClientCertFile   string `yaml:"clientCertFile"`
	ClientKeyFile    string `yaml:"clientKeyFile"`
	CACertFile       string `yaml:"caCertFile"`
	MinVersion       uint16 `yaml:"minVersion"`
	ServerName       string `yaml:"serverName"`
}

type CORSConfig struct {
	AllowedOrigins []string `yaml:"allowedOrigins"`
	AllowedMethods []string `yaml:"allowedMethods"`
	AllowedHeaders []string `yaml:"allowedHeaders"`
	AllowCredentials bool   `yaml:"allowCredentials"`
	MaxAgeSeconds int      `yaml:"maxAgeSeconds"`
}

type RateLimitConfig struct {
	Enabled      bool          `yaml:"enabled"`
	Capacity     int64         `yaml:"capacity"`
	RefillRate   int64         `yaml:"refillRate"`
	RefillPeriod time.Duration `yaml:"refillPeriod"`
	Prefix       string        `yaml:"prefix"`
}

type RegistryConfig struct {
	Static map[string]string `yaml:"static"`
}

type SecurityConfig struct {
	RequireTLSInDev         bool          `yaml:"requireTlsInDev"`
	AllowedClockSkew        time.Duration `yaml:"allowedClockSkew"`
	StrictTransportMaxAge   int           `yaml:"strictTransportMaxAge"`
	ContentSecurityPolicy   string        `yaml:"contentSecurityPolicy"`
}

type AuditConfig struct {
	Enabled bool `yaml:"enabled"`
}

type BootstrapConfig struct {
	SysAdminEmailEnv    string `yaml:"sysAdminEmailEnv"`
	SysAdminPasswordEnv string `yaml:"sysAdminPasswordEnv"`
	SysAdminFirstNameEnv string `yaml:"sysAdminFirstNameEnv"`
	SysAdminLastNameEnv  string `yaml:"sysAdminLastNameEnv"`
}

func Load() (Config, error) {
	path := strings.TrimSpace(os.Getenv("CONFIG_PATH"))
	if path == "" {
		env := Environment(strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV"))))
		if env == "" {
			env = EnvDev
		}
		path = defaultConfigPath(env)
	}

	b, err := os.ReadFile(filepath.Clean(path))
	if err != nil {
		return Config{}, fmt.Errorf("read config: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(b, &cfg); err != nil {
		return Config{}, fmt.Errorf("parse config yaml: %w", err)
	}

	if cfg.Env == "" {
		cfg.Env = EnvDev
	}

	if err := cfg.validate(); err != nil {
		return Config{}, err
	}

	return cfg, nil
}

func defaultConfigPath(env Environment) string {
	switch env {
	case EnvProd:
		return filepath.Join("config", "config.prod.yaml")
	case EnvTest:
		return filepath.Join("config", "config.test.yaml")
	default:
		return filepath.Join("config", "config.dev.yaml")
	}
}

func (c Config) validate() error {
	if c.Server.Port == 0 {
		return errors.New("server.port must be set")
	}
	if c.JWT.Issuer == "" {
		return errors.New("jwt.issuer must be set")
	}
	if c.JWT.PublicKeyPEMFile == "" || c.JWT.PrivateKeyPEMFile == "" {
		return errors.New("jwt key files must be set")
	}
	if c.Postgres.ConnString == "" {
		return errors.New("postgres.connString must be set")
	}
	if c.Redis.Addr == "" {
		return errors.New("redis.addr must be set")
	}
	if err := validateCSP(c.Security.ContentSecurityPolicy); err != nil {
		return err
	}
	if err := validateCertFileIfSet(c.MTLS.CACertFile); err != nil {
		return err
	}
	return nil
}

func validateCSP(csp string) error {
	if strings.TrimSpace(csp) == "" {
		return errors.New("security.contentSecurityPolicy must be set")
	}
	return nil
}

func validateCertFileIfSet(path string) error {
	p := strings.TrimSpace(path)
	if p == "" {
		return nil
	}
	b, err := os.ReadFile(filepath.Clean(p))
	if err != nil {
		return fmt.Errorf("read ca cert file: %w", err)
	}
	roots := x509.NewCertPool()
	if !roots.AppendCertsFromPEM(b) {
		return errors.New("invalid ca cert pem")
	}
	return nil
}

