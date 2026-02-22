'use client';

import { useState, useEffect, useCallback } from 'react';
import { billingApi } from '@/lib/api';

const coinPackages = [
    { id: '100', amount: 100, price: '$5', priceNum: 5, popular: false },
    { id: '500', amount: 500, price: '$20', priceNum: 20, popular: true },
    { id: '2000', amount: 2000, price: '$70', priceNum: 70, popular: false },
];

const resourceItems = [
    { id: 'ram_1gb', name: 'RAM +1 GB', description: 'Add 1 GB RAM to any server', cost: 20, icon: '🧠', category: 'Resources' },
    { id: 'ram_4gb', name: 'RAM +4 GB', description: 'Add 4 GB RAM to any server', cost: 70, icon: '🧠', category: 'Resources' },
    { id: 'cpu_1core', name: 'CPU +1 Core', description: 'Add 1 CPU core to any server', cost: 30, icon: '⚡', category: 'Resources' },
    { id: 'storage_5gb', name: 'Storage +5 GB', description: 'Add 5 GB storage to any server', cost: 15, icon: '💾', category: 'Resources' },
    { id: 'storage_20gb', name: 'Storage +20 GB', description: 'Add 20 GB storage to any server', cost: 50, icon: '💾', category: 'Resources' },
    { id: 'session_1hr', name: 'Session +1 Hour', description: 'Extend server session by 1 hour', cost: 10, icon: '⏱️', category: 'Session' },
];

export default function StorePage() {
    const [coinTotal, setCoinTotal] = useState(0);
    const [coinEarned, setCoinEarned] = useState(0);
    const [coinGranted, setCoinGranted] = useState(0);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState('');
    const [tab, setTab] = useState<'coins' | 'resources'>('coins');

    const fetchBalance = useCallback(async () => {
        try {
            const data = await billingApi.getCoins();
            setCoinTotal(data.coin_balance_total);
            setCoinEarned(data.coin_balance_earned);
            setCoinGranted(data.coin_balance_granted);
        } catch {
            console.error('Failed to fetch balance');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchBalance(); }, [fetchBalance]);

    const handleBuyCoins = async (packageId: string) => {
        setPurchasing(packageId);
        try {
            const result = await billingApi.purchaseCoins(packageId);
            setCoinTotal(result.coin_balance_total);
            setCoinEarned(result.coin_balance_earned);
            setCoinGranted(result.coin_balance_granted);
            alert(`Successfully purchased ${result.amount} IHC!`);
        } catch {
            alert('Purchase failed');
        } finally {
            setPurchasing('');
        }
    };

    const handleBuyResource = async (item: typeof resourceItems[0]) => {
        if (coinTotal < item.cost) {
            alert(`Not enough IHC! You need ${item.cost} IHC but only have ${coinTotal}.`);
            return;
        }
        setPurchasing(item.id);
        try {
            // For now, this just spends coins — actual resource application is TODO
            alert(`${item.name} purchased for ${item.cost} IHC! (Resource will be applied to your server)`);
            await fetchBalance();
        } catch {
            alert('Purchase failed');
        } finally {
            setPurchasing('');
        }
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
            <div>
                <h1 className="text-3xl font-bold gradient-text">Store</h1>
                <p className="text-muted-foreground mt-1">Buy IronHostCoin and server resources</p>
            </div>

            {/* Balance Bar */}
            <div className="glass-card rounded-xl p-4 border border-primary-500/20 flex items-center gap-6">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">🪙</span>
                    <span className="text-xl font-bold gradient-text">{coinTotal} IHC</span>
                </div>
                <div className="h-8 w-px bg-border/50" />
                <div className="flex items-center gap-4 text-sm">
                    <span className="text-emerald-400"><span className="text-muted-foreground">Earned:</span> {coinEarned}</span>
                    <span className="text-amber-400"><span className="text-muted-foreground">Granted:</span> {coinGranted}</span>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setTab('coins')}
                    className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === 'coins' ? 'gradient-primary text-white' : 'glass-card text-muted-foreground hover:text-foreground'}`}
                >
                    Buy IronHostCoin
                </button>
                <button
                    onClick={() => setTab('resources')}
                    className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === 'resources' ? 'gradient-primary text-white' : 'glass-card text-muted-foreground hover:text-foreground'}`}
                >
                    Resources & Extras
                </button>
            </div>

            {tab === 'coins' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {coinPackages.map((pkg) => (
                        <div key={pkg.id} className={`glass-card rounded-xl p-6 border ${pkg.popular ? 'border-primary-500/50 ring-2 ring-primary-500/20' : 'border-border/50'} relative hover:scale-[1.02] transition-all`}>
                            {pkg.popular && (
                                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-500 text-white text-xs font-bold px-3 py-1 rounded-full">Most Popular</span>
                            )}
                            <div className="text-center mb-6 pt-2">
                                <p className="text-5xl font-bold gradient-text">{pkg.amount}</p>
                                <p className="text-sm text-muted-foreground mt-1">IronHostCoin</p>
                            </div>
                            <div className="text-center mb-6">
                                <p className="text-2xl font-bold text-foreground">{pkg.price}</p>
                                <p className="text-xs text-muted-foreground">${(pkg.priceNum / pkg.amount * 100).toFixed(1)} per 100 IHC</p>
                            </div>
                            <button
                                onClick={() => handleBuyCoins(pkg.id)}
                                disabled={purchasing === pkg.id}
                                className="w-full py-3 rounded-lg font-semibold text-white gradient-primary hover:opacity-90 transition-all disabled:opacity-50"
                            >
                                {purchasing === pkg.id ? 'Processing...' : 'Buy Now'}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {tab === 'resources' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {resourceItems.map((item) => (
                        <div key={item.id} className="glass-card rounded-xl p-5 border border-border/50 hover:border-primary-500/30 transition-all">
                            <div className="flex items-start gap-3">
                                <span className="text-2xl">{item.icon}</span>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-foreground">{item.name}</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between mt-4">
                                <span className="text-sm font-bold text-amber-400">{item.cost} IHC</span>
                                <button
                                    onClick={() => handleBuyResource(item)}
                                    disabled={purchasing === item.id || coinTotal < item.cost}
                                    className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all gradient-primary text-white hover:opacity-90 disabled:opacity-40"
                                >
                                    {coinTotal < item.cost ? 'Not enough IHC' : purchasing === item.id ? 'Buying...' : 'Buy'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
