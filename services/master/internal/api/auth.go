package api

import (
	"log"
	"os"
	"time"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/ironhost/master/internal/database"
)

// jwtKeyfunc is the key function used to verify JWT tokens.
// It is initialized based on the environment:
//   - If SUPABASE_URL is set, fetches JWKS from Supabase for ES256 verification
//   - Otherwise, falls back to HMAC secret from SUPABASE_JWT_SECRET
var jwtKeyfunc jwt.Keyfunc

// jwtSecret is only used for HMAC fallback and for signing our own tokens (register/login)
var jwtSecret []byte

func init() {
	// Load HMAC secret (used for our own token generation + HMAC fallback)
	if secret := os.Getenv("SUPABASE_JWT_SECRET"); secret != "" {
		jwtSecret = []byte(secret)
	} else {
		jwtSecret = []byte("ironhost-secret-key-change-in-production")
	}

	// Try to load JWKS from Supabase for ES256 token verification
	supabaseURL := os.Getenv("SUPABASE_URL")
	if supabaseURL != "" {
		jwksURL := supabaseURL + "/auth/v1/.well-known/jwks.json"
		log.Printf("Loading JWKS from: %s", jwksURL)

		k, err := keyfunc.NewDefault([]string{jwksURL})
		if err != nil {
			log.Printf("WARNING: Failed to load JWKS from %s: %v", jwksURL, err)
			log.Println("Falling back to HMAC JWT secret for verification")
			jwtKeyfunc = func(t *jwt.Token) (interface{}, error) {
				return jwtSecret, nil
			}
		} else {
			log.Println("JWKS loaded successfully — ES256 tokens will be verified")
			jwtKeyfunc = k.Keyfunc
		}
	} else {
		log.Println("SUPABASE_URL not set — using HMAC JWT secret for verification")
		jwtKeyfunc = func(t *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		}
	}
}

// AuthHandler handles authentication requests
type AuthHandler struct {
	db *database.DB
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(db *database.DB) *AuthHandler {
	return &AuthHandler{db: db}
}

// RegisterRequest represents registration payload
type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Username string `json:"username"`
}

// LoginRequest represents login payload
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// UserResponse represents user data in responses (no password)
type UserResponse struct {
	ID                  uuid.UUID `json:"id"`
	Email               string    `json:"email"`
	Username            string    `json:"username"`
	IsAdmin             bool      `json:"is_admin"`
	CoinBalanceGranted  int       `json:"coin_balance_granted"`
	CoinBalanceEarned   int       `json:"coin_balance_earned"`
	Plan                string    `json:"plan"`
	ResourceRAM         int       `json:"resource_ram_mb"`
	ResourceCPU         int       `json:"resource_cpu_cores"`
	ResourceStorage     int       `json:"resource_storage_mb"`
	ResourceRAMUsed     int       `json:"resource_ram_used_mb"`
	ResourceCPUUsed     int       `json:"resource_cpu_used_cores"`
	ResourceStorageUsed int       `json:"resource_storage_used_mb"`
	CreatedAt           time.Time `json:"created_at"`
}

// AuthResponse represents login/register response
type AuthResponse struct {
	Token string       `json:"token"`
	User  UserResponse `json:"user"`
}

// Register creates a new user account
func (h *AuthHandler) Register(c *fiber.Ctx) error {
	var req RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	// Validate
	if req.Email == "" || req.Password == "" || req.Username == "" {
		return fiber.NewError(fiber.StatusBadRequest, "email, password, and username are required")
	}

	if len(req.Password) < 8 {
		return fiber.NewError(fiber.StatusBadRequest, "password must be at least 8 characters")
	}

	// Check if email already exists
	existingUser, _ := h.db.GetUserByEmail(c.Context(), req.Email)
	if existingUser != nil {
		return fiber.NewError(fiber.StatusConflict, "email already registered")
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to hash password")
	}

	// Create user
	user, err := h.db.CreateUser(c.Context(), req.Email, string(hashedPassword), req.Username)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to create user")
	}

	// Generate JWT
	token, err := generateToken(user.ID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to generate token")
	}

	return c.Status(fiber.StatusCreated).JSON(AuthResponse{
		Token: token,
		User: UserResponse{
			ID:                 user.ID,
			Email:              user.Email,
			Username:           user.Username,
			IsAdmin:            user.IsAdmin,
			CoinBalanceGranted: user.CoinBalanceGranted,
			CoinBalanceEarned:  user.CoinBalanceEarned,
			Plan:               user.Plan,
			ResourceRAM:        user.ResourceRAM,
			ResourceCPU:        user.ResourceCPU,
			ResourceStorage:    user.ResourceStorage,
			CreatedAt:          user.CreatedAt,
		},
	})
}

// Login authenticates a user
func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	if req.Email == "" || req.Password == "" {
		return fiber.NewError(fiber.StatusBadRequest, "email and password are required")
	}

	// Get user by email
	user, err := h.db.GetUserByEmail(c.Context(), req.Email)
	if err != nil || user == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "invalid credentials")
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "invalid credentials")
	}

	// Generate JWT
	token, err := generateToken(user.ID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to generate token")
	}

	return c.JSON(AuthResponse{
		Token: token,
		User: UserResponse{
			ID:                 user.ID,
			Email:              user.Email,
			Username:           user.Username,
			IsAdmin:            user.IsAdmin,
			CoinBalanceGranted: user.CoinBalanceGranted,
			CoinBalanceEarned:  user.CoinBalanceEarned,
			Plan:               user.Plan,
			ResourceRAM:        user.ResourceRAM,
			ResourceCPU:        user.ResourceCPU,
			ResourceStorage:    user.ResourceStorage,
			CreatedAt:          user.CreatedAt,
		},
	})
}

// Me returns the current authenticated user
func (h *AuthHandler) Me(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uuid.UUID)

	user, err := h.db.GetUserByID(c.Context(), userID)
	if err != nil || user == nil {
		return fiber.NewError(fiber.StatusNotFound, "user not found")
	}

	// Get resource usage
	usage, _ := h.db.GetResourceUsage(c.Context(), userID)

	return c.JSON(UserResponse{
		ID:                  user.ID,
		Email:               user.Email,
		Username:            user.Username,
		IsAdmin:             user.IsAdmin,
		CoinBalanceGranted:  user.CoinBalanceGranted,
		CoinBalanceEarned:   user.CoinBalanceEarned,
		Plan:                user.Plan,
		ResourceRAM:         user.ResourceRAM,
		ResourceCPU:         user.ResourceCPU,
		ResourceStorage:     user.ResourceStorage,
		ResourceRAMUsed:     usage.RAMUsed,
		ResourceCPUUsed:     usage.CPUUsed,
		ResourceStorageUsed: usage.StorageUsed,
		CreatedAt:           user.CreatedAt,
	})
}

// generateToken creates a JWT token for the user
func generateToken(userID uuid.UUID) (string, error) {
	claims := jwt.MapClaims{
		"sub": userID.String(),
		"exp": time.Now().Add(time.Hour * 24 * 7).Unix(), // 7 days
		"iat": time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// JWTMiddleware protects routes requiring authentication
func JWTMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return fiber.NewError(fiber.StatusUnauthorized, "missing authorization header")
		}

		// Extract token (Bearer <token>)
		tokenString := ""
		if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			tokenString = authHeader[7:]
		} else {
			return fiber.NewError(fiber.StatusUnauthorized, "invalid authorization format")
		}

		// Parse and validate token using JWKS keyfunc (supports ES256 + HS256)
		token, err := jwt.Parse(tokenString, jwtKeyfunc)

		if err != nil {
			log.Printf("JWT validation failed: %v", err)
			return fiber.NewError(fiber.StatusUnauthorized, "invalid or expired token")
		}

		if !token.Valid {
			return fiber.NewError(fiber.StatusUnauthorized, "invalid or expired token")
		}

		// Extract user ID from claims
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			return fiber.NewError(fiber.StatusUnauthorized, "invalid token claims")
		}

		userIDStr, ok := claims["sub"].(string)
		if !ok {
			return fiber.NewError(fiber.StatusUnauthorized, "invalid user ID in token")
		}

		userID, err := uuid.Parse(userIDStr)
		if err != nil {
			return fiber.NewError(fiber.StatusUnauthorized, "invalid user ID format")
		}

		// Store user ID in context
		c.Locals("userID", userID)

		return c.Next()
	}
}

// AdminMiddleware protects admin-only routes (requires JWTMiddleware to run first)
func AdminMiddleware(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, ok := c.Locals("userID").(uuid.UUID)
		if !ok {
			return fiber.NewError(fiber.StatusUnauthorized, "authentication required")
		}

		user, err := db.GetUserByID(c.Context(), userID)
		if err != nil || user == nil {
			return fiber.NewError(fiber.StatusUnauthorized, "user not found")
		}

		if !user.IsAdmin {
			return fiber.NewError(fiber.StatusForbidden, "admin access required")
		}

		return c.Next()
	}
}
