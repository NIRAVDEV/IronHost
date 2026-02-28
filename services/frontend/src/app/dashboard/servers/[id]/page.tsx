'use client';

import Link from 'next/link';
import { useEffect, useState, use, useCallback } from 'react';
import { serversApi, Server, billingApi } from '@/lib/api';

// ─── Tab type ───
type Tab = 'overview' | 'files' | 'settings';

// ─── Control Button ───
function ControlButton({
    icon,
    label,
    variant = 'default',
    disabled = false,
    loading = false,
    onClick,
}: {
    icon: React.ReactNode;
    label: string;
    variant?: 'default' | 'danger' | 'success';
    disabled?: boolean;
    loading?: boolean;
    onClick?: () => void;
}) {
    const variants = {
        default: 'bg-muted/50 hover:bg-muted text-foreground',
        success: 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30',
        danger: 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30',
    };

    return (
        <button
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${variants[variant]} ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={disabled || loading}
            onClick={onClick}
        >
            {loading ? (
                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
                icon
            )}
            {label}
        </button>
    );
}

// ─── Resource Gauge ───
function ResourceGauge({
    label,
    value,
    max,
    unit,
    color = 'primary',
    icon,
}: {
    label: string;
    value: number;
    max: number;
    unit: string;
    color?: 'primary' | 'accent' | 'amber';
    icon: React.ReactNode;
}) {
    const percentage = max > 0 ? Math.round((value / max) * 100) : 0;
    const gradientClass =
        color === 'primary'
            ? 'from-primary-500 to-primary-600'
            : color === 'accent'
                ? 'from-accent-500 to-accent-600'
                : 'from-amber-500 to-amber-600';
    const barColor =
        percentage > 90
            ? 'from-red-500 to-red-600'
            : percentage > 70
                ? 'from-amber-500 to-amber-600'
                : gradientClass;

    return (
        <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
                <span className="text-muted-foreground">{icon}</span>
                <span className="text-sm font-medium text-foreground">{label}</span>
            </div>
            <div className="flex items-baseline gap-1 mb-3">
                <span className="text-2xl font-bold text-foreground">{value}</span>
                <span className="text-sm text-muted-foreground">/ {max} {unit}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                    className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all duration-500`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{percentage}% used</p>
        </div>
    );
}

// ─── SVG Icons (inline) ───
const Icons = {
    play: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>,
    stop: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>,
    restart: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 16h5v5" /></svg>,
    console: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4,17 10,11 4,5" /><line x1="12" x2="20" y1="19" y2="19" /></svg>,
    trash: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>,
    server: <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="20" height="8" x="2" y="2" rx="2" ry="2" /><rect width="20" height="8" x="2" y="14" rx="2" ry="2" /><line x1="6" x2="6.01" y1="6" y2="6" /><line x1="6" x2="6.01" y1="18" y2="18" /></svg>,
    ram: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 6V4" /><path d="M10 6V4" /><path d="M14 6V4" /><path d="M18 6V4" /><path d="M6 18v2" /><path d="M10 18v2" /><path d="M14 18v2" /><path d="M18 18v2" /></svg>,
    cpu: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><path d="M15 2v2" /><path d="M15 20v2" /><path d="M2 15h2" /><path d="M2 9h2" /><path d="M20 15h2" /><path d="M20 9h2" /><path d="M9 2v2" /><path d="M9 20v2" /></svg>,
    disk: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /><path d="M12 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>,
    folder: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" /></svg>,
    settings: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>,
    overview: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" /></svg>,
    save: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" /><path d="M7 3v4a1 1 0 0 0 1 1h7" /></svg>,
    alert: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>,
    reset: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>,
};

// ─── Overview Tab Content ───
function OverviewTab({ server }: { server: Server }) {
    return (
        <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-card rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{server.status === 'running' ? '🟢' : server.status === 'starting' || server.status === 'installing' ? '🟡' : '🔴'}</p>
                    <p className="text-sm text-muted-foreground mt-1 capitalize">{server.status}</p>
                </div>
                <div className="glass-card rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{server.memory_limit} <span className="text-sm text-muted-foreground">MB</span></p>
                    <p className="text-sm text-muted-foreground">Memory</p>
                </div>
                <div className="glass-card rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{server.cpu_limit}<span className="text-sm text-muted-foreground">%</span></p>
                    <p className="text-sm text-muted-foreground">CPU</p>
                </div>
                <div className="glass-card rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold gradient-text">{server.disk_limit} <span className="text-sm">MB</span></p>
                    <p className="text-sm text-muted-foreground">Storage</p>
                </div>
            </div>

            {/* Resource Gauges */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ResourceGauge
                    label="Memory"
                    value={server.memory_used || 0}
                    max={server.memory_limit}
                    unit="MB"
                    color="primary"
                    icon={Icons.ram}
                />
                <ResourceGauge
                    label="CPU"
                    value={server.cpu_used || 0}
                    max={server.cpu_limit}
                    unit="%"
                    color="accent"
                    icon={Icons.cpu}
                />
                <ResourceGauge
                    label="Disk"
                    value={server.disk_used || 0}
                    max={server.disk_limit}
                    unit="MB"
                    color="amber"
                    icon={Icons.disk}
                />
            </div>

            {/* Server Info Card */}
            <div className="glass-card rounded-xl p-6">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Server Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex justify-between py-2 border-b border-border/30">
                        <span className="text-sm text-muted-foreground">Image</span>
                        <span className="text-sm font-medium text-foreground">{server.docker_image}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                        <span className="text-sm text-muted-foreground">Server ID</span>
                        <span className="text-sm font-mono text-muted-foreground">{server.id.slice(0, 8)}...</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                        <span className="text-sm text-muted-foreground">Node</span>
                        <span className="text-sm font-medium text-foreground">{server.node_id.slice(0, 8)}...</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                        <span className="text-sm text-muted-foreground">Created</span>
                        <span className="text-sm font-medium text-foreground">{new Date(server.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>

            {/* Monthly Maintenance Cost */}
            {(() => {
                const baseCost = 50;
                const ramCost = server.memory_limit > 0 ? Math.max(1, Math.floor((server.memory_limit * 70) / (4096 * 2))) : 0;
                const cpuCost = server.cpu_limit > 0 ? Math.max(1, Math.floor((server.cpu_limit * 30) / (100 * 2))) : 0;
                const storageCost = server.disk_limit > 0 ? Math.max(1, Math.floor((server.disk_limit * 15) / (5120 * 2))) : 0;
                const totalCost = baseCost + ramCost + cpuCost + storageCost;

                return (
                    <div className="glass-card rounded-xl p-6 border border-amber-500/20 bg-amber-500/5">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-lg">💰</span>
                            <h3 className="text-sm font-semibold text-amber-400">Monthly Maintenance</h3>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                            <div className="rounded-lg bg-background/40 p-2.5 text-center">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Base</p>
                                <p className="text-sm font-bold text-foreground">{baseCost}</p>
                            </div>
                            <div className="rounded-lg bg-background/40 p-2.5 text-center">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">RAM</p>
                                <p className="text-sm font-bold text-foreground">+{ramCost}</p>
                            </div>
                            <div className="rounded-lg bg-background/40 p-2.5 text-center">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">CPU</p>
                                <p className="text-sm font-bold text-foreground">+{cpuCost}</p>
                            </div>
                            <div className="rounded-lg bg-background/40 p-2.5 text-center">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Storage</p>
                                <p className="text-sm font-bold text-foreground">+{storageCost}</p>
                            </div>
                        </div>
                        <div className="flex items-center justify-between pt-3 mt-3 border-t border-amber-500/20">
                            <span className="text-sm text-muted-foreground">Total per month</span>
                            <span className="text-xl font-bold text-amber-400">{totalCost} IHC</span>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}

// ─── Files Tab Content (Coming Soon) ───
function FilesTab() {
    return (
        <div className="glass-card rounded-xl p-8 text-center">
            <div className="flex flex-col items-center gap-4 py-12">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-400">
                    {Icons.folder}
                </div>
                <h3 className="text-xl font-bold text-foreground">File Manager</h3>
                <p className="text-muted-foreground max-w-md">
                    Browse, edit, and manage your server files directly from the control panel.
                    Upload configs, modify server.properties, and more.
                </p>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20">
                    <div className="h-2 w-2 rounded-full bg-primary-500 animate-pulse" />
                    <span className="text-sm font-medium text-primary-400">Coming Soon</span>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-6 w-full max-w-md">
                    {['server.properties', 'whitelist.json', 'ops.json'].map((f) => (
                        <div key={f} className="rounded-lg bg-muted/30 p-3 text-center opacity-50">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto mb-1 text-muted-foreground"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /></svg>
                            <p className="text-xs text-muted-foreground truncate">{f}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Settings Tab Content ───
function SettingsTab({
    server,
    onUpdate,
}: {
    server: Server;
    onUpdate: () => void;
}) {
    const [name, setName] = useState(server.name);
    const [memoryLimit, setMemoryLimit] = useState(server.memory_limit);
    const [cpuLimit, setCpuLimit] = useState(server.cpu_limit);
    const [diskLimit, setDiskLimit] = useState(server.disk_limit);
    const [saving, setSaving] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const hasChanges =
        name !== server.name ||
        memoryLimit !== server.memory_limit ||
        cpuLimit !== server.cpu_limit ||
        diskLimit !== server.disk_limit;

    // Maintenance cost calculation
    const baseCost = 50;
    const ramCost = memoryLimit > 0 ? Math.max(1, Math.floor((memoryLimit * 70) / (4096 * 2))) : 0;
    const cpuCost = cpuLimit > 0 ? Math.max(1, Math.floor((cpuLimit * 30) / (100 * 2))) : 0;
    const storageCost = diskLimit > 0 ? Math.max(1, Math.floor((diskLimit * 15) / (5120 * 2))) : 0;
    const totalCost = baseCost + ramCost + cpuCost + storageCost;

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const updateData: Record<string, string | number> = {};
            if (name !== server.name) updateData.name = name;
            if (memoryLimit !== server.memory_limit) updateData.memory_limit = memoryLimit;
            if (cpuLimit !== server.cpu_limit) updateData.cpu_limit = cpuLimit;
            if (diskLimit !== server.disk_limit) updateData.disk_limit = diskLimit;

            await serversApi.update(server.id, updateData);
            setMessage({ type: 'success', text: 'Settings saved successfully! Restart your server for resource changes to take effect.' });
            onUpdate();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to save settings';
            const axiosMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setMessage({ type: 'error', text: axiosMsg || msg });
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        if (!confirm('⚠️ Are you sure you want to RESET this server?\n\nThis will DELETE ALL SERVER DATA (worlds, configs, plugins) and recreate the container from scratch.\n\nThis action CANNOT be undone.')) return;
        setResetting(true);
        setMessage(null);
        try {
            await serversApi.reset(server.id);
            setMessage({ type: 'success', text: 'Server reset initiated. The container is being recreated...' });
            onUpdate();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to reset server';
            const axiosMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setMessage({ type: 'error', text: axiosMsg || msg });
        } finally {
            setResetting(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('🗑️ Are you sure you want to DELETE this server?\n\nThis will permanently remove the server and all its data.\n\nThis action CANNOT be undone.')) return;
        setDeleting(true);
        try {
            await serversApi.delete(server.id);
            window.location.href = '/dashboard/servers';
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to delete server';
            const axiosMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setMessage({ type: 'error', text: axiosMsg || msg });
            setDeleting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Status Message */}
            {message && (
                <div className={`rounded-xl p-4 border ${message.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                    <p className="text-sm font-medium">{message.text}</p>
                </div>
            )}

            {/* Server Name */}
            <div className="glass-card rounded-xl p-6">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">General</h3>
                <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Server Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg bg-muted/50 border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                        placeholder="My Server"
                        maxLength={50}
                        minLength={2}
                    />
                    <p className="text-xs text-muted-foreground mt-1">2-50 characters</p>
                </div>
            </div>

            {/* Resource Allocation */}
            <div className="glass-card rounded-xl p-6">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Resource Allocation</h3>
                <p className="text-xs text-muted-foreground mb-6">Adjust your server&apos;s resources. Changes take effect after a server restart.</p>

                {/* RAM Slider */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                            {Icons.ram} Memory (RAM)
                        </label>
                        <span className="text-sm font-bold text-primary-400">{memoryLimit} MB</span>
                    </div>
                    <input
                        type="range"
                        min="256"
                        max="16384"
                        step="256"
                        value={memoryLimit}
                        onChange={(e) => setMemoryLimit(Number(e.target.value))}
                        className="w-full h-2 rounded-full appearance-none cursor-pointer bg-muted accent-primary-500"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>256 MB</span>
                        <span>16 GB</span>
                    </div>
                </div>

                {/* CPU Slider */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                            {Icons.cpu} CPU
                        </label>
                        <span className="text-sm font-bold text-accent-400">{cpuLimit}%</span>
                    </div>
                    <input
                        type="range"
                        min="25"
                        max="800"
                        step="25"
                        value={cpuLimit}
                        onChange={(e) => setCpuLimit(Number(e.target.value))}
                        className="w-full h-2 rounded-full appearance-none cursor-pointer bg-muted accent-accent-500"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>25%</span>
                        <span>800% (8 cores)</span>
                    </div>
                </div>

                {/* Storage Slider */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                            {Icons.disk} Storage
                        </label>
                        <span className="text-sm font-bold text-amber-400">{diskLimit} MB</span>
                    </div>
                    <input
                        type="range"
                        min="512"
                        max="51200"
                        step="512"
                        value={diskLimit}
                        onChange={(e) => setDiskLimit(Number(e.target.value))}
                        className="w-full h-2 rounded-full appearance-none cursor-pointer bg-muted accent-amber-500"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>512 MB</span>
                        <span>50 GB</span>
                    </div>
                </div>
            </div>

            {/* Maintenance Cost Preview */}
            <div className="glass-card rounded-xl p-6 border border-amber-500/20 bg-amber-500/5">
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">💰</span>
                    <h3 className="text-sm font-semibold text-amber-400">Monthly Maintenance Cost</h3>
                    {hasChanges && (
                        <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">Updated</span>
                    )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                    <div className="rounded-lg bg-background/40 p-2.5 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Base</p>
                        <p className="text-sm font-bold text-foreground">{baseCost} IHC</p>
                    </div>
                    <div className="rounded-lg bg-background/40 p-2.5 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">RAM</p>
                        <p className="text-sm font-bold text-foreground">+{ramCost} IHC</p>
                    </div>
                    <div className="rounded-lg bg-background/40 p-2.5 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">CPU</p>
                        <p className="text-sm font-bold text-foreground">+{cpuCost} IHC</p>
                    </div>
                    <div className="rounded-lg bg-background/40 p-2.5 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Storage</p>
                        <p className="text-sm font-bold text-foreground">+{storageCost} IHC</p>
                    </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-amber-500/20">
                    <span className="text-sm text-muted-foreground">Total per month</span>
                    <span className="text-xl font-bold text-amber-400">{totalCost} IHC</span>
                </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={!hasChanges || saving}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${hasChanges
                            ? 'gradient-primary text-white hover:opacity-90'
                            : 'bg-muted/50 text-muted-foreground cursor-not-allowed'
                        }`}
                >
                    {saving ? (
                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        Icons.save
                    )}
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            {/* Danger Zone */}
            <div className="glass-card rounded-xl p-6 border border-red-500/20">
                <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    {Icons.alert} Danger Zone
                </h3>

                {/* Reset */}
                <div className="flex items-center justify-between py-4 border-b border-border/20">
                    <div>
                        <p className="text-sm font-medium text-foreground">Reset Server</p>
                        <p className="text-xs text-muted-foreground">Wipe all data and recreate the container from scratch.</p>
                    </div>
                    <button
                        onClick={handleReset}
                        disabled={resetting}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all disabled:opacity-50"
                    >
                        {resetting ? (
                            <div className="h-4 w-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            Icons.reset
                        )}
                        {resetting ? 'Resetting...' : 'Reset Server'}
                    </button>
                </div>

                {/* Delete */}
                <div className="flex items-center justify-between py-4">
                    <div>
                        <p className="text-sm font-medium text-foreground">Delete Server</p>
                        <p className="text-xs text-muted-foreground">Permanently delete this server and all its data.</p>
                    </div>
                    <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all disabled:opacity-50"
                    >
                        {deleting ? (
                            <div className="h-4 w-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            Icons.trash
                        )}
                        {deleting ? 'Deleting...' : 'Delete Server'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ───
export default function ServerDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [server, setServer] = useState<Server | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('overview');

    const fetchServer = useCallback(async () => {
        try {
            const data = await serversApi.get(id);
            setServer(data);
            setError(null);
        } catch (err) {
            console.error('Failed to fetch server:', err);
            setError('Failed to load server');
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchServer();
        const interval = setInterval(fetchServer, 5000);
        return () => clearInterval(interval);
    }, [fetchServer]);

    const handleAction = async (action: 'start' | 'stop' | 'restart') => {
        if (!server) return;
        setActionLoading(action);
        try {
            if (action === 'start') await serversApi.start(server.id);
            else if (action === 'stop') await serversApi.stop(server.id);
            else if (action === 'restart') await serversApi.restart(server.id);
            await fetchServer();
        } catch (err) {
            console.error(`Failed to ${action} server:`, err);
        } finally {
            setActionLoading(null);
        }
    };

    const statusColors: Record<string, string> = {
        running: 'status-running',
        stopped: 'status-stopped',
        starting: 'status-starting',
        installing: 'status-starting',
        offline: 'status-stopped',
    };

    const statusLabels: Record<string, string> = {
        running: 'Running',
        stopped: 'Offline',
        starting: 'Starting...',
        installing: 'Installing...',
        offline: 'Offline',
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    if (error || !server) {
        return (
            <div className="glass-card rounded-xl p-8 text-center">
                <p className="text-red-400 mb-2">{error || 'Server not found'}</p>
                <Link href="/dashboard/servers" className="text-primary-400 hover:underline">
                    Back to Servers
                </Link>
            </div>
        );
    }

    const isRunning = server.status === 'running';
    const isStopped = server.status === 'stopped' || server.status === 'offline';

    const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
        { key: 'overview', label: 'Overview', icon: Icons.overview },
        { key: 'files', label: 'Files', icon: Icons.folder },
        { key: 'settings', label: 'Settings', icon: Icons.settings },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm">
                <Link href="/dashboard/servers" className="text-muted-foreground hover:text-foreground transition-colors">
                    Servers
                </Link>
                <span className="text-muted-foreground">/</span>
                <span className="text-foreground">{server.name}</span>
            </div>

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-500/10 text-primary-400">
                        {Icons.server}
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-foreground">{server.name}</h1>
                            <span className={`status-dot ${statusColors[server.status] || 'status-stopped'}`} />
                            <span className="text-sm text-muted-foreground">{statusLabels[server.status] || server.status}</span>
                        </div>
                        <p className="text-muted-foreground text-sm">{server.docker_image}</p>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2 flex-wrap">
                    {isStopped ? (
                        <ControlButton
                            icon={Icons.play}
                            label="Start"
                            variant="success"
                            loading={actionLoading === 'start'}
                            onClick={() => handleAction('start')}
                        />
                    ) : (
                        <ControlButton
                            icon={Icons.stop}
                            label="Stop"
                            variant="danger"
                            loading={actionLoading === 'stop'}
                            onClick={() => handleAction('stop')}
                            disabled={!isRunning}
                        />
                    )}
                    <ControlButton
                        icon={Icons.restart}
                        label="Restart"
                        loading={actionLoading === 'restart'}
                        onClick={() => handleAction('restart')}
                        disabled={!isRunning}
                    />
                    <Link
                        href={`/dashboard/servers/${server.id}/console`}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium gradient-primary text-white hover:opacity-90 transition-opacity"
                    >
                        {Icons.console}
                        Console
                    </Link>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="glass-card rounded-xl p-1.5 flex gap-1">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${activeTab === tab.key
                                ? 'bg-primary-500/10 text-primary-400 shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
                <Link
                    href={`/dashboard/servers/${server.id}/console`}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                    {Icons.console}
                    Console
                </Link>
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && <OverviewTab server={server} />}
            {activeTab === 'files' && <FilesTab />}
            {activeTab === 'settings' && <SettingsTab server={server} onUpdate={fetchServer} />}
        </div>
    );
}
