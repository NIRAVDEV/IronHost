package api

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/ironhost/master/internal/database"
)

// BillingHandler handles billing-related API requests
type BillingHandler struct {
	db *database.DB
}

// NewBillingHandler creates a new billing handler
func NewBillingHandler(db *database.DB) *BillingHandler {
	return &BillingHandler{db: db}
}

// PlanInfo represents a subscription plan for the API
type PlanInfo struct {
	ID                  string   `json:"id"`
	Name                string   `json:"name"`
	PriceCents          int      `json:"price_cents"`
	MonthlyIHCGrant     int      `json:"monthly_ihc_grant"`
	QueueSkip           bool     `json:"queue_skip"`
	SessionLimitMinutes int      `json:"session_limit_minutes"` // 0 = unlimited
	AutoShutdownMinutes int      `json:"auto_shutdown_minutes"` // 0 = disabled
	Features            []string `json:"features"`
}

// Available plans
var planRegistry = map[string]PlanInfo{
	"free": {
		ID:                  "free",
		Name:                "Free",
		PriceCents:          0,
		MonthlyIHCGrant:     100,
		QueueSkip:           false,
		SessionLimitMinutes: 60,
		AutoShutdownMinutes: 10,
		Features: []string{
			"100 IHC monthly (expires if unused)",
			"Unlimited servers",
			"1 hour session limit",
			"Wait in queue",
			"Auto-shutdown after 10 min idle",
		},
	},
	"pro": {
		ID:                  "pro",
		Name:                "Pro",
		PriceCents:          1000,
		MonthlyIHCGrant:     500,
		QueueSkip:           true,
		SessionLimitMinutes: 0,
		AutoShutdownMinutes: 0,
		Features: []string{
			"500 IHC monthly",
			"Unlimited servers",
			"Unlimited session time",
			"Skip queue — instant start",
			"No auto-shutdown",
		},
	},
	"enterprise": {
		ID:                  "enterprise",
		Name:                "Enterprise",
		PriceCents:          2500,
		MonthlyIHCGrant:     2000,
		QueueSkip:           true,
		SessionLimitMinutes: 0,
		AutoShutdownMinutes: 0,
		Features: []string{
			"2000 IHC monthly",
			"Unlimited servers",
			"Unlimited session time",
			"Skip queue — instant start",
			"No auto-shutdown",
			"Priority support",
		},
	},
}

// ListPlans returns available subscription plans
func (h *BillingHandler) ListPlans(c *fiber.Ctx) error {
	plans := []PlanInfo{
		planRegistry["free"],
		planRegistry["pro"],
		planRegistry["enterprise"],
	}
	return c.JSON(fiber.Map{"plans": plans})
}

// GetSubscription returns the user's current plan + coin balances
func (h *BillingHandler) GetSubscription(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uuid.UUID)

	user, err := h.db.GetUserByID(c.Context(), userID)
	if err != nil || user == nil {
		return fiber.NewError(fiber.StatusNotFound, "user not found")
	}

	plan, ok := planRegistry[user.Plan]
	if !ok {
		plan = planRegistry["free"]
	}

	return c.JSON(fiber.Map{
		"plan":                 plan,
		"coin_balance_granted": user.CoinBalanceGranted,
		"coin_balance_earned":  user.CoinBalanceEarned,
		"coin_balance_total":   user.CoinBalanceGranted + user.CoinBalanceEarned,
	})
}

// Subscribe changes user's subscription plan
func (h *BillingHandler) Subscribe(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uuid.UUID)

	var req struct {
		PlanID string `json:"plan_id"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	if _, ok := planRegistry[req.PlanID]; !ok {
		return fiber.NewError(fiber.StatusNotFound, "plan not found")
	}

	// Prevent subscribing to same plan
	user, err := h.db.GetUserByID(c.Context(), userID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to get user")
	}
	if user.Plan == req.PlanID {
		return fiber.NewError(fiber.StatusBadRequest, "already on this plan")
	}

	// Update plan (grants IHC automatically)
	if err := h.db.UpdateUserPlan(c.Context(), userID, req.PlanID); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to update plan")
	}

	// Fetch updated user
	user, _ = h.db.GetUserByID(c.Context(), userID)
	plan := planRegistry[req.PlanID]

	return c.JSON(fiber.Map{
		"message":              "Plan updated successfully",
		"plan":                 plan,
		"coin_balance_granted": user.CoinBalanceGranted,
		"coin_balance_earned":  user.CoinBalanceEarned,
		"coin_balance_total":   user.CoinBalanceGranted + user.CoinBalanceEarned,
	})
}

// GetCoins returns coin balance and recent transactions
func (h *BillingHandler) GetCoins(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uuid.UUID)

	user, err := h.db.GetUserByID(c.Context(), userID)
	if err != nil || user == nil {
		return fiber.NewError(fiber.StatusNotFound, "user not found")
	}

	transactions, err := h.db.GetCoinTransactions(c.Context(), userID, 20)
	if err != nil {
		transactions = []database.CoinTransaction{}
	}

	return c.JSON(fiber.Map{
		"coin_balance_granted": user.CoinBalanceGranted,
		"coin_balance_earned":  user.CoinBalanceEarned,
		"coin_balance_total":   user.CoinBalanceGranted + user.CoinBalanceEarned,
		"transactions":         transactions,
	})
}

// EarnCoins adds earned coins (from the earn page timer)
func (h *BillingHandler) EarnCoins(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uuid.UUID)

	var req struct {
		Amount int `json:"amount"`
	}
	if err := c.BodyParser(&req); err != nil || req.Amount <= 0 {
		return fiber.NewError(fiber.StatusBadRequest, "invalid amount")
	}

	// Cap earn per request at 10 IHC (anti-cheat)
	if req.Amount > 10 {
		req.Amount = 10
	}

	if err := h.db.AddCoins(c.Context(), userID, req.Amount, "earn", "earned", "Earned from timer"); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to add coins")
	}

	user, _ := h.db.GetUserByID(c.Context(), userID)
	return c.JSON(fiber.Map{
		"message":              "Coins earned!",
		"amount":               req.Amount,
		"coin_balance_granted": user.CoinBalanceGranted,
		"coin_balance_earned":  user.CoinBalanceEarned,
		"coin_balance_total":   user.CoinBalanceGranted + user.CoinBalanceEarned,
	})
}

// PurchaseCoins adds purchased coins (mock payment for now)
func (h *BillingHandler) PurchaseCoins(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uuid.UUID)

	var req struct {
		PackageID string `json:"package_id"` // "100", "500", "2000"
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	packages := map[string]int{
		"100":  100,
		"500":  500,
		"2000": 2000,
	}

	amount, ok := packages[req.PackageID]
	if !ok {
		return fiber.NewError(fiber.StatusBadRequest, "invalid package")
	}

	if err := h.db.AddCoins(c.Context(), userID, amount, "purchase", "earned", "Purchased IronHostCoin package"); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to add coins")
	}

	user, _ := h.db.GetUserByID(c.Context(), userID)
	return c.JSON(fiber.Map{
		"message":              "Coins purchased successfully!",
		"amount":               amount,
		"coin_balance_granted": user.CoinBalanceGranted,
		"coin_balance_earned":  user.CoinBalanceEarned,
		"coin_balance_total":   user.CoinBalanceGranted + user.CoinBalanceEarned,
	})
}

// ListInvoices returns the user's coin transaction history (replaces old invoices)
func (h *BillingHandler) ListInvoices(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uuid.UUID)

	transactions, err := h.db.GetCoinTransactions(c.Context(), userID, 50)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to get transactions")
	}

	return c.JSON(fiber.Map{"transactions": transactions})
}
