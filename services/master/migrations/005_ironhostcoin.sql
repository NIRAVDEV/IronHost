-- IronHostCoin system: coin balances, transactions, and server maintenance
-- Add coin fields to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS coin_balance_granted INTEGER DEFAULT 100;
ALTER TABLE users ADD COLUMN IF NOT EXISTS coin_balance_earned INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(20) DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Coin transactions ledger
CREATE TABLE IF NOT EXISTS coin_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,           -- positive = credit, negative = debit
    type VARCHAR(20) NOT NULL,         -- grant, earn, purchase, spend, refund, expire
    source VARCHAR(20) NOT NULL,       -- granted, earned (which balance was affected)
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coin_transactions_user_id ON coin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_created_at ON coin_transactions(created_at);

-- Server maintenance tracking
CREATE TABLE IF NOT EXISTS server_maintenance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_paid_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    next_due_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
    status VARCHAR(20) DEFAULT 'paid', -- paid, due, overdue, deleted
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_server_maintenance_server_id ON server_maintenance(server_id);
CREATE INDEX IF NOT EXISTS idx_server_maintenance_user_id ON server_maintenance(user_id);
CREATE INDEX IF NOT EXISTS idx_server_maintenance_status ON server_maintenance(status);
