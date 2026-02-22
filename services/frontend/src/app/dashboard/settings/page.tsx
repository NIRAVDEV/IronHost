'use client';

import { useEffect, useState, useCallback } from 'react';
import { userApi, billingApi, type User, type CoinBalance } from '@/lib/api';

export default function SettingsPage() {
    const [user, setUser] = useState<User | null>(null);
    const [coins, setCoins] = useState<CoinBalance | null>(null);
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [tab, setTab] = useState<'profile' | 'notifications' | 'security'>('profile');

    const fetchData = useCallback(async () => {
        try {
            const [userData, coinData] = await Promise.all([
                userApi.getMe(),
                billingApi.getCoins(),
            ]);
            setUser(userData);
            setCoins(coinData);
            setUsername(userData.username || '');
        } catch {
            console.error('Failed to load settings');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSave = async () => {
        if (!username.trim()) return;
        setSaving(true);
        setSaved(false);
        try {
            await userApi.updateProfile({ username: username.trim() });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch {
            alert('Failed to save profile');
        } finally {
            setSaving(false);
        }
    };

    const planBadge: Record<string, { label: string; color: string }> = {
        free: { label: 'Free', color: 'bg-zinc-600' },
        pro: { label: 'Pro', color: 'bg-blue-600' },
        enterprise: { label: 'Enterprise', color: 'bg-amber-600' },
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
                <h1 className="text-3xl font-bold gradient-text">Settings</h1>
                <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                {(['profile', 'notifications', 'security'] as const).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-5 py-2.5 rounded-lg text-sm font-medium capitalize transition-all ${tab === t ? 'gradient-primary text-white' : 'glass-card text-muted-foreground hover:text-foreground'}`}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {tab === 'profile' && (
                <div className="space-y-6">
                    {/* Account Overview */}
                    <div className="glass-card rounded-xl p-6 border border-border/50">
                        <h2 className="text-lg font-semibold text-foreground mb-4">Account Overview</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="rounded-lg bg-muted/20 p-4">
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Current Plan</p>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className={`text-xs text-white font-bold px-2 py-0.5 rounded ${planBadge[user?.plan || 'free']?.color}`}>
                                        {planBadge[user?.plan || 'free']?.label}
                                    </span>
                                </div>
                            </div>
                            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4">
                                <p className="text-xs text-emerald-400 uppercase tracking-wider">Earned IHC</p>
                                <p className="text-2xl font-bold text-emerald-400 mt-1">{coins?.coin_balance_earned || 0}</p>
                            </div>
                            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
                                <p className="text-xs text-amber-400 uppercase tracking-wider">Granted IHC</p>
                                <p className="text-2xl font-bold text-amber-400 mt-1">{coins?.coin_balance_granted || 0}</p>
                            </div>
                        </div>
                    </div>

                    {/* Editable Profile */}
                    <div className="glass-card rounded-xl p-6 border border-border/50">
                        <h2 className="text-lg font-semibold text-foreground mb-4">Profile</h2>
                        <div className="space-y-4 max-w-md">
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Email</label>
                                <input
                                    type="text"
                                    value={user?.email || ''}
                                    disabled
                                    className="w-full px-4 py-2.5 rounded-lg bg-muted/30 border border-border/50 text-foreground/60 cursor-not-allowed"
                                />
                                <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Username</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-lg bg-muted/20 border border-border/50 text-foreground focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all"
                                    placeholder="Enter username"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Member Since</label>
                                <input
                                    type="text"
                                    value={user ? new Date(user.created_at).toLocaleDateString() : ''}
                                    disabled
                                    className="w-full px-4 py-2.5 rounded-lg bg-muted/30 border border-border/50 text-foreground/60 cursor-not-allowed"
                                />
                            </div>
                            <div className="flex items-center gap-3 pt-2">
                                <button
                                    onClick={handleSave}
                                    disabled={saving || !username.trim()}
                                    className="px-6 py-2.5 rounded-lg font-medium text-sm text-white gradient-primary hover:opacity-90 transition-all disabled:opacity-50"
                                >
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                                {saved && <span className="text-sm text-emerald-400">✓ Saved successfully</span>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {tab === 'notifications' && (
                <div className="glass-card rounded-xl p-6 border border-border/50">
                    <h2 className="text-lg font-semibold text-foreground mb-4">Notification Preferences</h2>
                    <div className="space-y-4">
                        {[
                            { label: 'Server status changes', desc: 'Get notified when servers start/stop' },
                            { label: 'Maintenance reminders', desc: 'Monthly IHC maintenance due alerts' },
                            { label: 'Low balance alerts', desc: 'When your IHC balance is running low' },
                            { label: 'Session expiry warning', desc: '10 minutes before session expires' },
                        ].map((item, i) => (
                            <div key={i} className="flex items-center justify-between py-3 border-b border-border/20 last:border-0">
                                <div>
                                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" defaultChecked className="sr-only peer" />
                                    <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] peer-checked:after:translate-x-full after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                                </label>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {tab === 'security' && (
                <div className="glass-card rounded-xl p-6 border border-border/50">
                    <h2 className="text-lg font-semibold text-foreground mb-4">Security</h2>
                    <p className="text-sm text-muted-foreground">
                        Your account security is managed through Supabase authentication.
                        Password changes and two-factor authentication can be configured through your auth provider.
                    </p>
                </div>
            )}
        </div>
    );
}
