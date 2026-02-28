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

// ResourcePackage defines a purchasable resource bundle
type ResourcePackage struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	CostIHC   int    `json:"cost_ihc"`
	RAMMb     int    `json:"ram_mb"`
	CPUCores  int    `json:"cpu_cores"`
	StorageMb int    `json:"storage_mb"`
}

var resourceCatalog = map[string]ResourcePackage{
	"ram_1gb":      {ID: "ram_1gb", Name: "1 GB RAM", CostIHC: 20, RAMMb: 1024, CPUCores: 0, StorageMb: 0},
	"ram_4gb":      {ID: "ram_4gb", Name: "4 GB RAM", CostIHC: 70, RAMMb: 4096, CPUCores: 0, StorageMb: 0},
	"cpu_1core":    {ID: "cpu_1core", Name: "1 CPU Core", CostIHC: 30, RAMMb: 0, CPUCores: 100, StorageMb: 0},
	"storage_5gb":  {ID: "storage_5gb", Name: "5 GB Storage", CostIHC: 15, RAMMb: 0, CPUCores: 0, StorageMb: 5120},
	"storage_20gb": {ID: "storage_20gb", Name: "20 GB Storage", CostIHC: 50, RAMMb: 0, CPUCores: 0, StorageMb: 20480},
}

// PurchaseResource spends IHC and adds resources to the user's pool
func (h *BillingHandler) PurchaseResource(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uuid.UUID)

	var req struct {
		PackageID string `json:"package_id"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	pkg, ok := resourceCatalog[req.PackageID]
	if !ok {
		return fiber.NewError(fiber.StatusBadRequest, "invalid resource package")
	}

	// Spend IHC
	if err := h.db.SpendCoins(c.Context(), userID, pkg.CostIHC, "Purchased "+pkg.Name); err != nil {
		return fiber.NewError(fiber.StatusPaymentRequired, "not enough IronHostCoin")
	}

	// Add resources
	if err := h.db.AddResources(c.Context(), userID, pkg.RAMMb, pkg.CPUCores, pkg.StorageMb); err != nil {
		// Refund on failure
		_ = h.db.AddCoins(c.Context(), userID, pkg.CostIHC, "refund", "earned", "Refund for failed resource purchase")
		return fiber.NewError(fiber.StatusInternalServerError, "failed to add resources")
	}

	user, _ := h.db.GetUserByID(c.Context(), userID)
	return c.JSON(fiber.Map{
		"message":             "Resource purchased!",
		"package":             pkg,
		"coin_balance_total":  user.CoinBalanceGranted + user.CoinBalanceEarned,
		"resource_ram_mb":     user.ResourceRAM,
		"resource_cpu_cores":  user.ResourceCPU,
		"resource_storage_mb": user.ResourceStorage,
	})
}

// ListResourceCatalog returns available resource packages
func (h *BillingHandler) ListResourceCatalog(c *fiber.Ctx) error {
	packages := make([]ResourcePackage, 0, len(resourceCatalog))
	for _, pkg := range resourceCatalog {
		packages = append(packages, pkg)
	}
	return c.JSON(fiber.Map{"packages": packages})
}

// Maintenance cost constants
const (
	MaintenanceBaseCost = 50 // IHC per server per month

	// Per-unit monthly maintenance = half the purchase cost
	// RAM purchase: 70 IHC per 4096 MB → ~17.09 IHC/GB purchase → ~8.5 IHC/GB/month
	// CPU purchase: 30 IHC per 100% (1 core) → 15 IHC/core/month
	// Storage purchase: 15 IHC per 5120 MB → ~2.93 IHC/GB purchase → ~1.46 IHC/GB/month
)

// ServerMaintenanceCost represents the monthly cost breakdown for a server
type ServerMaintenanceCost struct {
	ServerID    string `json:"server_id"`
	ServerName  string `json:"server_name"`
	BaseCost    int    `json:"base_cost"`
	RAMCost     int    `json:"ram_cost"`
	CPUCost     int    `json:"cpu_cost"`
	StorageCost int    `json:"storage_cost"`
	TotalCost   int    `json:"total_cost"`
}

// calculateServerMaintenance returns the monthly IHC cost for a server
func calculateServerMaintenance(memoryMB int64, cpuPercent int, diskMB int64) ServerMaintenanceCost {
	cost := ServerMaintenanceCost{
		BaseCost: MaintenanceBaseCost,
	}

	// RAM cost: (memory_mb / 1024) * (70 / 4) / 2 = per-GB cost halved
	// Simplified: purchase is 70 IHC per 4 GB = 17.5 per GB, half = 8.75 per GB
	// We use integer math: (memory_mb * 70) / (4096 * 2)
	if memoryMB > 0 {
		cost.RAMCost = int((memoryMB * 70) / (4096 * 2))
		if cost.RAMCost < 1 && memoryMB > 0 {
			cost.RAMCost = 1
		}
	}

	// CPU cost: (cpu_percent / 100) * 30 / 2 = 15 per core
	if cpuPercent > 0 {
		cost.CPUCost = (cpuPercent * 30) / (100 * 2)
		if cost.CPUCost < 1 && cpuPercent > 0 {
			cost.CPUCost = 1
		}
	}

	// Storage cost: (disk_mb / 1024) * (15 / 5) / 2 = per-GB cost halved
	// Simplified: purchase is 15 IHC per 5 GB = 3 per GB, half = 1.5 per GB
	// Integer math: (disk_mb * 15) / (5120 * 2)
	if diskMB > 0 {
		cost.StorageCost = int((diskMB * 15) / (5120 * 2))
		if cost.StorageCost < 1 && diskMB > 0 {
			cost.StorageCost = 1
		}
	}

	cost.TotalCost = cost.BaseCost + cost.RAMCost + cost.CPUCost + cost.StorageCost
	return cost
}

// GetMaintenanceCost returns monthly maintenance cost for all user servers
func (h *BillingHandler) GetMaintenanceCost(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uuid.UUID)

	servers, err := h.db.ListServersByUserID(c.Context(), userID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to list servers")
	}

	costs := make([]ServerMaintenanceCost, 0, len(servers))
	totalMonthly := 0

	for _, srv := range servers {
		cost := calculateServerMaintenance(srv.MemoryLimit, srv.CPULimit, srv.DiskLimit)
		cost.ServerID = srv.ID.String()
		cost.ServerName = srv.Name
		costs = append(costs, cost)
		totalMonthly += cost.TotalCost
	}

	return c.JSON(fiber.Map{
		"servers":       costs,
		"total_monthly": totalMonthly,
		"server_count":  len(servers),
	})
}

// EstimateMaintenanceCost returns cost preview for a server before creating it
func (h *BillingHandler) EstimateMaintenanceCost(c *fiber.Ctx) error {
	var req struct {
		MemoryMB   int64 `json:"memory_limit"`
		CPUPercent int   `json:"cpu_limit"`
		DiskMB     int64 `json:"disk_limit"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	cost := calculateServerMaintenance(req.MemoryMB, req.CPUPercent, req.DiskMB)
	return c.JSON(fiber.Map{
		"base_cost":    cost.BaseCost,
		"ram_cost":     cost.RAMCost,
		"cpu_cost":     cost.CPUCost,
		"storage_cost": cost.StorageCost,
		"total_cost":   cost.TotalCost,
	})
}
