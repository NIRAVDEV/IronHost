package api

import (
	"time"

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

// Plan represents a subscription plan
type Plan struct {
	ID             uuid.UUID `json:"id"`
	Name           string    `json:"name"`
	PriceCents     int       `json:"price_cents"`
	ServersLimit   int       `json:"servers_limit"`
	RAMPerServerMB int       `json:"ram_per_server_mb"`
	StorageMB      int       `json:"storage_mb"`
	Features       []string  `json:"features"`
}

// Subscription represents a user's subscription
type Subscription struct {
	ID               uuid.UUID `json:"id"`
	UserID           uuid.UUID `json:"user_id"`
	PlanID           uuid.UUID `json:"plan_id"`
	Plan             Plan      `json:"plan"`
	Status           string    `json:"status"`
	CurrentPeriodEnd time.Time `json:"current_period_end"`
	CreatedAt        time.Time `json:"created_at"`
}

// Invoice represents a billing invoice
type Invoice struct {
	ID          uuid.UUID `json:"id"`
	UserID      uuid.UUID `json:"user_id"`
	AmountCents int       `json:"amount_cents"`
	Status      string    `json:"status"`
	InvoiceDate time.Time `json:"invoice_date"`
}

// Default plans (in production, these would be in the database)
var defaultPlans = []Plan{
	{
		ID:             uuid.MustParse("00000000-0000-0000-0000-000000000001"),
		Name:           "Starter",
		PriceCents:     500,
		ServersLimit:   1,
		RAMPerServerMB: 2048,
		StorageMB:      10240,
		Features:       []string{"1 Server", "2 GB RAM", "10 GB Storage", "Basic Support"},
	},
	{
		ID:             uuid.MustParse("00000000-0000-0000-0000-000000000002"),
		Name:           "Pro",
		PriceCents:     1500,
		ServersLimit:   5,
		RAMPerServerMB: 8192,
		StorageMB:      51200,
		Features:       []string{"5 Servers", "8 GB RAM each", "50 GB Storage", "Priority Support", "Custom Domain"},
	},
	{
		ID:             uuid.MustParse("00000000-0000-0000-0000-000000000003"),
		Name:           "Enterprise",
		PriceCents:     4900,
		ServersLimit:   100,
		RAMPerServerMB: 32768,
		StorageMB:      512000,
		Features:       []string{"Unlimited Servers", "32 GB RAM each", "500 GB Storage", "24/7 Support", "Dedicated IP", "DDoS Protection"},
	},
}

// ListPlans returns available subscription plans
func (h *BillingHandler) ListPlans(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"plans": defaultPlans})
}

// GetSubscription returns the user's current subscription
func (h *BillingHandler) GetSubscription(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uuid.UUID)

	// TODO: Fetch from database
	// For now, return mock data
	subscription := Subscription{
		ID:               uuid.New(),
		UserID:           userID,
		PlanID:           defaultPlans[1].ID,
		Plan:             defaultPlans[1], // Pro plan
		Status:           "active",
		CurrentPeriodEnd: time.Now().AddDate(0, 1, 0),
		CreatedAt:        time.Now().AddDate(0, -1, 0),
	}

	return c.JSON(subscription)
}

// Subscribe subscribes user to a plan
func (h *BillingHandler) Subscribe(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uuid.UUID)

	var req struct {
		PlanID string `json:"plan_id"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	planID, err := uuid.Parse(req.PlanID)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid plan ID")
	}

	// Find plan
	var selectedPlan *Plan
	for _, p := range defaultPlans {
		if p.ID == planID {
			selectedPlan = &p
			break
		}
	}
	if selectedPlan == nil {
		return fiber.NewError(fiber.StatusNotFound, "plan not found")
	}

	// TODO: Integrate with payment processor (Stripe)
	// TODO: Save subscription to database

	subscription := Subscription{
		ID:               uuid.New(),
		UserID:           userID,
		PlanID:           selectedPlan.ID,
		Plan:             *selectedPlan,
		Status:           "active",
		CurrentPeriodEnd: time.Now().AddDate(0, 1, 0),
		CreatedAt:        time.Now(),
	}

	return c.Status(fiber.StatusCreated).JSON(subscription)
}

// ListInvoices returns the user's invoice history
func (h *BillingHandler) ListInvoices(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uuid.UUID)

	// TODO: Fetch from database
	// For now, return mock data
	invoices := []Invoice{
		{
			ID:          uuid.New(),
			UserID:      userID,
			AmountCents: 1500,
			Status:      "paid",
			InvoiceDate: time.Now().AddDate(0, 0, -1),
		},
		{
			ID:          uuid.New(),
			UserID:      userID,
			AmountCents: 1500,
			Status:      "paid",
			InvoiceDate: time.Now().AddDate(0, -1, -1),
		},
		{
			ID:          uuid.New(),
			UserID:      userID,
			AmountCents: 1500,
			Status:      "paid",
			InvoiceDate: time.Now().AddDate(0, -2, -1),
		},
	}

	return c.JSON(fiber.Map{"invoices": invoices})
}
