package database

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// User represents a user in the system
type User struct {
	ID                 uuid.UUID `json:"id"`
	Email              string    `json:"email"`
	PasswordHash       string    `json:"-"`
	Username           string    `json:"username"`
	IsAdmin            bool      `json:"is_admin"`
	CoinBalanceGranted int       `json:"coin_balance_granted"`
	CoinBalanceEarned  int       `json:"coin_balance_earned"`
	Plan               string    `json:"plan"`
	PlanUpdatedAt      time.Time `json:"plan_updated_at"`
	ResourceRAM        int       `json:"resource_ram_mb"`
	ResourceCPU        int       `json:"resource_cpu_cores"`
	ResourceStorage    int       `json:"resource_storage_mb"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

// CoinTransaction represents a coin ledger entry
type CoinTransaction struct {
	ID          uuid.UUID `json:"id"`
	UserID      uuid.UUID `json:"user_id"`
	Amount      int       `json:"amount"`
	Type        string    `json:"type"`   // grant, earn, purchase, spend, refund, expire
	Source      string    `json:"source"` // granted, earned
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

// CreateUser creates a new user in the database
func (db *DB) CreateUser(ctx context.Context, email, passwordHash, username string) (*User, error) {
	user := &User{
		ID:                 uuid.New(),
		Email:              email,
		PasswordHash:       passwordHash,
		Username:           username,
		CoinBalanceGranted: 100,
		CoinBalanceEarned:  0,
		Plan:               "free",
		PlanUpdatedAt:      time.Now(),
		CreatedAt:          time.Now(),
		UpdatedAt:          time.Now(),
	}

	_, err := db.Pool.Exec(ctx, `
		INSERT INTO users (id, email, password_hash, username, coin_balance_granted, coin_balance_earned, plan, plan_updated_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, user.ID, user.Email, user.PasswordHash, user.Username, user.CoinBalanceGranted, user.CoinBalanceEarned, user.Plan, user.PlanUpdatedAt, user.CreatedAt, user.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return user, nil
}

const userSelectCols = `id, email, password_hash, username, COALESCE(is_admin, false), COALESCE(coin_balance_granted, 100), COALESCE(coin_balance_earned, 0), COALESCE(plan, 'free'), COALESCE(plan_updated_at, created_at), COALESCE(resource_ram_mb, 0), COALESCE(resource_cpu_cores, 0), COALESCE(resource_storage_mb, 0), created_at, updated_at`

func scanUser(row interface{ Scan(dest ...any) error }) (*User, error) {
	var user User
	err := row.Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Username, &user.IsAdmin, &user.CoinBalanceGranted, &user.CoinBalanceEarned, &user.Plan, &user.PlanUpdatedAt, &user.ResourceRAM, &user.ResourceCPU, &user.ResourceStorage, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetUserByEmail finds a user by email
func (db *DB) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	row := db.Pool.QueryRow(ctx, fmt.Sprintf(`SELECT %s FROM users WHERE email = $1`, userSelectCols), email)
	return scanUser(row)
}

// GetUserByID finds a user by ID
func (db *DB) GetUserByID(ctx context.Context, id uuid.UUID) (*User, error) {
	row := db.Pool.QueryRow(ctx, fmt.Sprintf(`SELECT %s FROM users WHERE id = $1`, userSelectCols), id)
	return scanUser(row)
}

// UpdateUser updates a user's profile
func (db *DB) UpdateUser(ctx context.Context, id uuid.UUID, username string) error {
	_, err := db.Pool.Exec(ctx, `
		UPDATE users SET username = $2, updated_at = $3 WHERE id = $1
	`, id, username, time.Now())
	return err
}

// UpdateUserPlan updates a user's subscription plan and grants monthly coins
func (db *DB) UpdateUserPlan(ctx context.Context, id uuid.UUID, plan string) error {
	grantMap := map[string]int{
		"free":       100,
		"pro":        500,
		"enterprise": 2000,
	}
	grant := grantMap[plan]

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		UPDATE users SET plan = $2, coin_balance_granted = coin_balance_granted + $3, plan_updated_at = $4, updated_at = $4 WHERE id = $1
	`, id, plan, grant, time.Now())
	if err != nil {
		return err
	}

	// Record the grant transaction
	_, err = tx.Exec(ctx, `
		INSERT INTO coin_transactions (id, user_id, amount, type, source, description, created_at)
		VALUES ($1, $2, $3, 'grant', 'granted', $4, $5)
	`, uuid.New(), id, grant, fmt.Sprintf("Plan upgraded to %s - %d IHC granted", plan, grant), time.Now())
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// SpendCoins deducts coins from user balance (earned first, then granted)
// Returns error if insufficient balance
func (db *DB) SpendCoins(ctx context.Context, userID uuid.UUID, amount int, description string) error {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Get current balances
	var granted, earned int
	err = tx.QueryRow(ctx, `SELECT COALESCE(coin_balance_granted, 0), COALESCE(coin_balance_earned, 0) FROM users WHERE id = $1 FOR UPDATE`, userID).Scan(&granted, &earned)
	if err != nil {
		return err
	}

	total := granted + earned
	if total < amount {
		return fmt.Errorf("insufficient IronHostCoin balance: have %d, need %d", total, amount)
	}

	// Spend earned first, then granted
	earnedSpend := amount
	grantedSpend := 0
	if earnedSpend > earned {
		grantedSpend = earnedSpend - earned
		earnedSpend = earned
	}

	_, err = tx.Exec(ctx, `
		UPDATE users SET coin_balance_earned = coin_balance_earned - $2, coin_balance_granted = coin_balance_granted - $3, updated_at = $4 WHERE id = $1
	`, userID, earnedSpend, grantedSpend, time.Now())
	if err != nil {
		return err
	}

	// Record transaction(s)
	if earnedSpend > 0 {
		_, err = tx.Exec(ctx, `
			INSERT INTO coin_transactions (id, user_id, amount, type, source, description, created_at)
			VALUES ($1, $2, $3, 'spend', 'earned', $4, $5)
		`, uuid.New(), userID, -earnedSpend, description, time.Now())
		if err != nil {
			return err
		}
	}
	if grantedSpend > 0 {
		_, err = tx.Exec(ctx, `
			INSERT INTO coin_transactions (id, user_id, amount, type, source, description, created_at)
			VALUES ($1, $2, $3, 'spend', 'granted', $4, $5)
		`, uuid.New(), userID, -grantedSpend, description, time.Now())
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// AddCoins adds coins to the appropriate balance
func (db *DB) AddCoins(ctx context.Context, userID uuid.UUID, amount int, coinType, source, description string) error {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	col := "coin_balance_earned"
	if source == "granted" {
		col = "coin_balance_granted"
	}

	_, err = tx.Exec(ctx, fmt.Sprintf(`
		UPDATE users SET %s = %s + $2, updated_at = $3 WHERE id = $1
	`, col, col), userID, amount, time.Now())
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO coin_transactions (id, user_id, amount, type, source, description, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, uuid.New(), userID, amount, coinType, source, description, time.Now())
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// GetCoinTransactions returns recent coin transactions for a user
func (db *DB) GetCoinTransactions(ctx context.Context, userID uuid.UUID, limit int) ([]CoinTransaction, error) {
	if limit <= 0 {
		limit = 20
	}

	rows, err := db.Pool.Query(ctx, `
		SELECT id, user_id, amount, type, source, COALESCE(description, ''), created_at
		FROM coin_transactions
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var txns []CoinTransaction
	for rows.Next() {
		var t CoinTransaction
		if err := rows.Scan(&t.ID, &t.UserID, &t.Amount, &t.Type, &t.Source, &t.Description, &t.CreatedAt); err != nil {
			return nil, err
		}
		txns = append(txns, t)
	}

	return txns, nil
}

// AddResources adds purchased resources to a user's pool
func (db *DB) AddResources(ctx context.Context, userID uuid.UUID, ramMB, cpuCores, storageMB int) error {
	_, err := db.Pool.Exec(ctx, `
		UPDATE users SET
			resource_ram_mb = COALESCE(resource_ram_mb, 0) + $2,
			resource_cpu_cores = COALESCE(resource_cpu_cores, 0) + $3,
			resource_storage_mb = COALESCE(resource_storage_mb, 0) + $4,
			updated_at = $5
		WHERE id = $1
	`, userID, ramMB, cpuCores, storageMB, time.Now())
	return err
}

// ResourceUsage represents how much of a user's resource pool is allocated to servers
type ResourceUsage struct {
	RAMUsed     int `json:"ram_used_mb"`
	CPUUsed     int `json:"cpu_used_cores"`
	StorageUsed int `json:"storage_used_mb"`
}

// GetResourceUsage calculates how much of a user's resources are allocated to their servers
func (db *DB) GetResourceUsage(ctx context.Context, userID uuid.UUID) (*ResourceUsage, error) {
	var usage ResourceUsage
	err := db.Pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(memory_limit), 0), COALESCE(SUM(cpu_limit), 0), COALESCE(SUM(disk_limit), 0)
		FROM servers WHERE user_id = $1
	`, userID).Scan(&usage.RAMUsed, &usage.CPUUsed, &usage.StorageUsed)
	if err != nil {
		return &ResourceUsage{}, nil
	}
	return &usage, nil
}

// DeleteUser deletes a user by ID
func (db *DB) DeleteUser(ctx context.Context, id uuid.UUID) error {
	_, err := db.Pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, id)
	return err
}
