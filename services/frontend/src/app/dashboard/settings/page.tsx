'use client';

import { useState } from 'react';

// Toggle switch component
function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (val: boolean) => void }) {
    return (
        <button
            onClick={() => onChange(!enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-primary-500' : 'bg-muted'
                }`}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
            />
        </button>
    );
}

// Setting row component
function SettingRow({
    title,
    description,
    children,
}: {
    title: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-center justify-between py-4 border-b border-border/50 last:border-0">
            <div>
                <p className="font-medium text-foreground">{title}</p>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            {children}
        </div>
    );
}

export default function SettingsPage() {
    const [darkMode, setDarkMode] = useState(true);
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [serverAlerts, setServerAlerts] = useState(true);
    const [marketingEmails, setMarketingEmails] = useState(false);
    const [twoFactor, setTwoFactor] = useState(false);

    const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'security' | 'api'>('profile');

    const tabs = [
        { id: 'profile' as const, label: 'Profile' },
        { id: 'notifications' as const, label: 'Notifications' },
        { id: 'security' as const, label: 'Security' },
        { id: 'api' as const, label: 'API Keys' },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-foreground">Settings</h1>
                <p className="text-muted-foreground">Manage your account preferences</p>
            </div>

            {/* Tabs */}
            <div className="glass-card rounded-xl p-1 flex gap-1">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === tab.id
                                ? 'bg-primary-500/10 text-primary-400'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Profile Tab */}
            {activeTab === 'profile' && (
                <div className="space-y-6">
                    {/* Avatar section */}
                    <div className="glass-card rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-foreground mb-4">Profile Picture</h3>
                        <div className="flex items-center gap-6">
                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white text-2xl font-bold">
                                U
                            </div>
                            <div className="space-y-2">
                                <button className="px-4 py-2 text-sm font-medium rounded-lg gradient-primary text-white hover:opacity-90 transition-opacity">
                                    Change Avatar
                                </button>
                                <p className="text-xs text-muted-foreground">JPG, PNG or GIF. Max 2MB.</p>
                            </div>
                        </div>
                    </div>

                    {/* Profile form */}
                    <div className="glass-card rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-foreground mb-4">Personal Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Display Name</label>
                                <input
                                    type="text"
                                    defaultValue="User"
                                    className="w-full px-4 py-2.5 rounded-lg bg-muted/30 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Email</label>
                                <input
                                    type="email"
                                    defaultValue="user@ironhost.io"
                                    className="w-full px-4 py-2.5 rounded-lg bg-muted/30 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Username</label>
                                <input
                                    type="text"
                                    defaultValue="@user"
                                    className="w-full px-4 py-2.5 rounded-lg bg-muted/30 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Timezone</label>
                                <select className="w-full px-4 py-2.5 rounded-lg bg-muted/30 border border-border/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all">
                                    <option>UTC+0 (London)</option>
                                    <option>UTC-5 (New York)</option>
                                    <option>UTC-8 (Los Angeles)</option>
                                    <option>UTC+5:30 (Mumbai)</option>
                                    <option>UTC+9 (Tokyo)</option>
                                </select>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end">
                            <button className="px-4 py-2 text-sm font-medium rounded-lg gradient-primary text-white hover:opacity-90 transition-opacity">
                                Save Changes
                            </button>
                        </div>
                    </div>

                    {/* Appearance */}
                    <div className="glass-card rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-foreground mb-4">Appearance</h3>
                        <SettingRow
                            title="Dark Mode"
                            description="Use dark theme across the dashboard"
                        >
                            <Toggle enabled={darkMode} onChange={setDarkMode} />
                        </SettingRow>
                    </div>
                </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
                <div className="glass-card rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Email Notifications</h3>
                    <div className="divide-y divide-border/50">
                        <SettingRow
                            title="Email Notifications"
                            description="Receive important updates via email"
                        >
                            <Toggle enabled={emailNotifications} onChange={setEmailNotifications} />
                        </SettingRow>
                        <SettingRow
                            title="Server Alerts"
                            description="Get notified when servers go offline or have issues"
                        >
                            <Toggle enabled={serverAlerts} onChange={setServerAlerts} />
                        </SettingRow>
                        <SettingRow
                            title="Marketing Emails"
                            description="Receive news, tips, and promotional content"
                        >
                            <Toggle enabled={marketingEmails} onChange={setMarketingEmails} />
                        </SettingRow>
                    </div>
                </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
                <div className="space-y-6">
                    <div className="glass-card rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-foreground mb-4">Change Password</h3>
                        <div className="space-y-4 max-w-md">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Current Password</label>
                                <input
                                    type="password"
                                    className="w-full px-4 py-2.5 rounded-lg bg-muted/30 border border-border/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">New Password</label>
                                <input
                                    type="password"
                                    className="w-full px-4 py-2.5 rounded-lg bg-muted/30 border border-border/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Confirm New Password</label>
                                <input
                                    type="password"
                                    className="w-full px-4 py-2.5 rounded-lg bg-muted/30 border border-border/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all"
                                />
                            </div>
                            <button className="px-4 py-2 text-sm font-medium rounded-lg gradient-primary text-white hover:opacity-90 transition-opacity">
                                Update Password
                            </button>
                        </div>
                    </div>

                    <div className="glass-card rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-foreground mb-4">Two-Factor Authentication</h3>
                        <SettingRow
                            title="Enable 2FA"
                            description="Add an extra layer of security to your account"
                        >
                            <Toggle enabled={twoFactor} onChange={setTwoFactor} />
                        </SettingRow>
                    </div>

                    <div className="glass-card rounded-xl p-6 border-red-500/30">
                        <h3 className="text-lg font-semibold text-red-400 mb-2">Danger Zone</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Once you delete your account, there is no going back. Please be certain.
                        </p>
                        <button className="px-4 py-2 text-sm font-medium rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors">
                            Delete Account
                        </button>
                    </div>
                </div>
            )}

            {/* API Keys Tab */}
            {activeTab === 'api' && (
                <div className="space-y-6">
                    <div className="glass-card rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-semibold text-foreground">API Keys</h3>
                                <p className="text-sm text-muted-foreground">Manage your API keys for external integrations</p>
                            </div>
                            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg gradient-primary text-white hover:opacity-90 transition-opacity">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M5 12h14" />
                                    <path d="M12 5v14" />
                                </svg>
                                Create Key
                            </button>
                        </div>

                        {/* API Key list */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/10 text-primary-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 4l-3-3m-3.5 6.5L12 8" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="font-medium text-foreground">Production Key</p>
                                        <p className="text-sm text-muted-foreground font-mono">ih_live_xxxx...xxxx</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Created Jan 15, 2024</span>
                                    <button className="p-2 text-muted-foreground hover:text-red-400 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M3 6h18" />
                                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10 text-yellow-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 4l-3-3m-3.5 6.5L12 8" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="font-medium text-foreground">Development Key</p>
                                        <p className="text-sm text-muted-foreground font-mono">ih_test_xxxx...xxxx</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Created Dec 1, 2023</span>
                                    <button className="p-2 text-muted-foreground hover:text-red-400 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M3 6h18" />
                                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
