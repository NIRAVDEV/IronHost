'use client';

import { useEffect, useState, useCallback } from 'react';
import { billingApi, type Plan, type CoinTransaction } from '@/lib/api';

export default function BillingPage() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [currentPlan, setCurrentPlan] = useState<string>('free');
    const [coinGranted, setCoinGranted] = useState(0);
    const [coinEarned, setCoinEarned] = useState(0);
    const [coinTotal, setCoinTotal] = useState(0);
    const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [switching, setSwitching] = useState('');

    const fetchData = useCallback(async () => {
        try {
            const [plansData, subData, txData] = await Promise.all([
                billingApi.getPlans(),
                billingApi.getSubscription(),
                billingApi.getTransactions(),
            ]);
            setPlans(plansData);
            setCurrentPlan(subData.plan?.id || 'free');
            setCoinGranted(subData.coin_balance_granted);
            setCoinEarned(subData.coin_balance_earned);
            setCoinTotal(subData.coin_balance_total);
            setTransactions(txData || []);
        } catch {
            console.error('Failed to load billing data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSubscribe = async (planId: string) => {
        if (planId === currentPlan || switching) return;
        setSwitching(planId);
        try {
            const result = await billingApi.subscribe(planId);
            setCurrentPlan(planId);
            setCoinGranted(result.coin_balance_granted);
            setCoinEarned(result.coin_balance_earned);
            setCoinTotal(result.coin_balance_total);
            await fetchData();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to switch plan';
            alert(msg);
        } finally {
            setSwitching('');
        }
    };

    const planColors: Record<string, { border: string; bg: string; badge: string }> = {
        free: { border: 'border-zinc-700', bg: 'bg-zinc-800/40', badge: 'bg-zinc-600' },
        pro: { border: 'border-blue-500/50', bg: 'bg-blue-500/5', badge: 'bg-blue-600' },
        enterprise: { border: 'border-amber-500/50', bg: 'bg-amber-500/5', badge: 'bg-amber-600' },
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="h-8 w-8 rounded-full border-2 border-primary-400 border-t-transparent animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold gradient-text">Billing & Plans</h1>
                <p className="text-muted-foreground mt-1">Manage your subscription and IronHostCoin balance</p>
            </div>

            {/* IHC Balance Card */}
            <div className="glass-card rounded-xl p-6 border border-primary-500/20 bg-gradient-to-r from-primary-500/5 to-transparent">
                <div className="flex items-center gap-4 mb-6">
                    <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center text-xl">🪙</div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground">IronHostCoin Balance</h2>
                        <p className="text-sm text-muted-foreground">Your virtual currency for servers and resources</p>
                    </div>
                    <div className="ml-auto text-right">
                        <p className="text-3xl font-bold gradient-text">{coinTotal} IHC</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4">
                        <p className="text-xs text-emerald-400 font-medium uppercase tracking-wider">Earned (Permanent)</p>
                        <p className="text-2xl font-bold text-emerald-400 mt-1">{coinEarned} IHC</p>
                    </div>
                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
                        <p className="text-xs text-amber-400 font-medium uppercase tracking-wider">Granted (Monthly)</p>
                        <p className="text-2xl font-bold text-amber-400 mt-1">{coinGranted} IHC</p>
                    </div>
                </div>
            </div>

            {/* Plans */}
            <div>
                <h2 className="text-xl font-semibold text-foreground mb-4">Subscription Plans</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {plans.map((plan) => {
                        const color = planColors[plan.id] || planColors.free;
                        const isCurrent = plan.id === currentPlan;
                        const price = plan.price_cents === 0 ? 'Free' : `$${plan.price_cents / 100}/mo`;
                        return (
                            <div key={plan.id} className={`rounded-xl border-2 ${isCurrent ? 'border-primary-500 ring-2 ring-primary-500/20' : color.border} ${color.bg} p-6 transition-all hover:scale-[1.02]`}>
                                <div className="flex items-center justify-between mb-4">
                                    <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${color.badge} text-white`}>{plan.name}</span>
                                    {isCurrent && <span className="text-xs font-medium text-primary-400 bg-primary-500/10 px-2 py-1 rounded">Current</span>}
                                </div>
                                <p className="text-3xl font-bold text-foreground mb-1">{price}</p>
                                <p className="text-sm text-muted-foreground mb-4">{plan.monthly_ihc_grant} IHC/month</p>
                                <ul className="space-y-2 mb-6">
                                    {plan.features.map((f, i) => (
                                        <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <span className="text-emerald-400">✓</span>{f}
                                        </li>
                                    ))}
                                </ul>
                                {!isCurrent && (
                                    <button
                                        onClick={() => handleSubscribe(plan.id)}
                                        disabled={switching === plan.id}
                                        className="w-full py-2.5 rounded-lg font-medium text-sm transition-all gradient-primary text-white hover:opacity-90 disabled:opacity-50"
                                    >
                                        {switching === plan.id ? 'Switching...' : plan.price_cents > (plans.find(p => p.id === currentPlan)?.price_cents || 0) ? 'Upgrade' : 'Downgrade'}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Transaction History */}
            <div>
                <h2 className="text-xl font-semibold text-foreground mb-4">Transaction History</h2>
                <div className="glass-card rounded-xl border border-border/50 overflow-hidden">
                    {transactions.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">No transactions yet</div>
                    ) : (
                        <div className="divide-y divide-border/30">
                            {transactions.map((tx) => (
                                <div key={tx.id} className="flex items-center justify-between px-6 py-4 hover:bg-muted/20 transition-colors">
                                    <div>
                                        <p className="text-sm font-medium text-foreground">{tx.description}</p>
                                        <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()} · {tx.type} · {tx.source}</p>
                                    </div>
                                    <span className={`text-sm font-bold ${tx.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {tx.amount > 0 ? '+' : ''}{tx.amount} IHC
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
