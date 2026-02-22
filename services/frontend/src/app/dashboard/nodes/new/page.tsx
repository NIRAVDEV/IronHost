'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { nodesApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
}

function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

export default function AddNodePage() {
    const router = useRouter();
    const { isAdmin, isLoading: authLoading } = useAuthStore();
    const [isLoading, setIsLoading] = useState(false);
    const [isProbing, setIsProbing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [probeResult, setProbeResult] = useState<{
        success: boolean;
        reachable: boolean;
        message?: string;
        stats: {
            total_memory_bytes: number;
            available_memory_bytes: number;
            total_disk_bytes: number;
            available_disk_bytes: number;
            cpu_usage_percent: number;
            running_containers: number;
            uptime_seconds: number;
        } | null;
    } | null>(null);

    // Redirect non-admin users
    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.replace('/dashboard');
        }
    }, [authLoading, isAdmin, router]);

    // Form state
    const [name, setName] = useState('');
    const [fqdn, setFqdn] = useState('');
    const [grpcPort, setGrpcPort] = useState(8443);
    const [memoryTotal, setMemoryTotal] = useState(8192); // MB
    const [diskTotal, setDiskTotal] = useState(102400); // MB
    const [daemonToken, setDaemonToken] = useState('');
    const [autoDetected, setAutoDetected] = useState(false);

    // Generate random token
    const generateToken = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let token = '';
        for (let i = 0; i < 32; i++) {
            token += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setDaemonToken(token);
    };

    // Probe the agent for auto-detection
    const handleProbe = async () => {
        if (!fqdn || !daemonToken) {
            setError('Enter the FQDN and Daemon Token first, then probe.');
            return;
        }
        setIsProbing(true);
        setError(null);
        setProbeResult(null);
        try {
            const result = await nodesApi.probe({
                fqdn,
                grpc_port: grpcPort,
                daemon_token: daemonToken,
            });
            setProbeResult(result);
            if (result.success && result.stats) {
                // Auto-fill with detected values (convert bytes to MB)
                const detectedMemMB = Math.floor(result.stats.total_memory_bytes / (1024 * 1024));
                const detectedDiskMB = Math.floor(result.stats.total_disk_bytes / (1024 * 1024));
                setMemoryTotal(detectedMemMB);
                setDiskTotal(detectedDiskMB);
                setAutoDetected(true);
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Probe failed — is the agent running?';
            setError(errorMessage);
        } finally {
            setIsProbing(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            await nodesApi.create({
                name,
                fqdn,
                grpc_port: grpcPort,
                memory_total: memoryTotal,
                disk_total: diskTotal,
                daemon_token: daemonToken,
            });
            router.push('/dashboard/nodes');
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to add node';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="mb-8">
                <Link
                    href="/dashboard/nodes"
                    className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="m15 18-6-6 6-6" />
                    </svg>
                    Back to Nodes
                </Link>
                <h1 className="text-2xl font-bold text-foreground">Add New Node</h1>
                <p className="text-muted-foreground">Register a new server to host game instances</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="glass-card rounded-xl p-6 space-y-6">
                    {/* Node Name */}
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
                            Node Name
                        </label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Home PC"
                            required
                            className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors text-foreground placeholder:text-muted-foreground"
                        />
                    </div>

                    {/* FQDN/IP */}
                    <div>
                        <label htmlFor="fqdn" className="block text-sm font-medium text-foreground mb-2">
                            Address (FQDN or IP)
                        </label>
                        <input
                            type="text"
                            id="fqdn"
                            value={fqdn}
                            onChange={(e) => { setFqdn(e.target.value); setAutoDetected(false); setProbeResult(null); }}
                            placeholder="0.tcp.ngrok.io or 192.168.1.100"
                            required
                            className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors text-foreground placeholder:text-muted-foreground"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Public address where the Agent is reachable (use ngrok for local PCs)
                        </p>
                    </div>

                    {/* Port */}
                    <div>
                        <label htmlFor="port" className="block text-sm font-medium text-foreground mb-2">
                            Agent Port
                        </label>
                        <input
                            type="number"
                            id="port"
                            value={grpcPort}
                            onChange={(e) => setGrpcPort(Number(e.target.value))}
                            min={1}
                            max={65535}
                            required
                            className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors text-foreground"
                        />
                    </div>

                    {/* Daemon Token */}
                    <div>
                        <label htmlFor="token" className="block text-sm font-medium text-foreground mb-2">
                            Daemon Token
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                id="token"
                                value={daemonToken}
                                onChange={(e) => { setDaemonToken(e.target.value); setAutoDetected(false); setProbeResult(null); }}
                                placeholder="Secret token for Agent authentication"
                                required
                                className="flex-1 px-4 py-3 rounded-lg bg-background border border-border focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors text-foreground placeholder:text-muted-foreground font-mono text-sm"
                            />
                            <button
                                type="button"
                                onClick={generateToken}
                                className="px-4 py-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-foreground"
                            >
                                Generate
                            </button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Use this token when starting the Agent on the remote machine
                        </p>
                    </div>

                    {/* Probe Button */}
                    <div className="border-t border-border pt-5">
                        <button
                            type="button"
                            onClick={handleProbe}
                            disabled={isProbing || !fqdn || !daemonToken}
                            className="w-full py-3 px-4 font-medium rounded-lg border-2 border-dashed border-primary-500/40 hover:border-primary-500 hover:bg-primary-500/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-primary-400"
                        >
                            {isProbing ? (
                                <>
                                    <div className="animate-spin h-5 w-5 border-2 border-primary-400 border-t-transparent rounded-full" />
                                    Probing Agent...
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                        <polyline points="22 4 12 14.01 9 11.01" />
                                    </svg>
                                    Test Connection &amp; Auto-Detect Resources
                                </>
                            )}
                        </button>
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                            Connects to the agent to verify it&apos;s running and auto-detects RAM, disk, and CPU
                        </p>
                    </div>

                    {/* Auto-detected Stats Card */}
                    {probeResult?.success && probeResult.stats && (
                        <div className="rounded-lg bg-green-500/5 border border-green-500/20 p-4 space-y-3 animate-fade-in">
                            <div className="flex items-center gap-2 text-green-400 font-medium">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                                Agent Connected — Resources Detected
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="rounded-lg bg-background/50 p-3 text-center">
                                    <p className="text-xs text-muted-foreground">Total RAM</p>
                                    <p className="text-lg font-semibold text-foreground">{formatBytes(probeResult.stats.total_memory_bytes)}</p>
                                </div>
                                <div className="rounded-lg bg-background/50 p-3 text-center">
                                    <p className="text-xs text-muted-foreground">Available RAM</p>
                                    <p className="text-lg font-semibold text-green-400">{formatBytes(probeResult.stats.available_memory_bytes)}</p>
                                </div>
                                <div className="rounded-lg bg-background/50 p-3 text-center">
                                    <p className="text-xs text-muted-foreground">Total Disk</p>
                                    <p className="text-lg font-semibold text-foreground">{formatBytes(probeResult.stats.total_disk_bytes)}</p>
                                </div>
                                <div className="rounded-lg bg-background/50 p-3 text-center">
                                    <p className="text-xs text-muted-foreground">CPU Usage</p>
                                    <p className="text-lg font-semibold text-foreground">{probeResult.stats.cpu_usage_percent.toFixed(1)}%</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>🐳 {probeResult.stats.running_containers} containers</span>
                                <span>⏱ Uptime: {formatUptime(probeResult.stats.uptime_seconds)}</span>
                            </div>
                        </div>
                    )}

                    {/* Memory — editable, auto-filled if probed */}
                    <div>
                        <label htmlFor="memory" className="block text-sm font-medium text-foreground mb-2">
                            Allocate RAM (MB)
                            {autoDetected && <span className="ml-2 text-xs text-green-400 font-normal">✓ Auto-detected</span>}
                        </label>
                        <input
                            type="number"
                            id="memory"
                            value={memoryTotal}
                            onChange={(e) => setMemoryTotal(Number(e.target.value))}
                            min={512}
                            step={512}
                            required
                            className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors text-foreground"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {(memoryTotal / 1024).toFixed(1)} GB — you can lower this to reserve some RAM for the OS
                        </p>
                    </div>

                    {/* Disk — editable, auto-filled if probed */}
                    <div>
                        <label htmlFor="disk" className="block text-sm font-medium text-foreground mb-2">
                            Allocate Storage (MB)
                            {autoDetected && <span className="ml-2 text-xs text-green-400 font-normal">✓ Auto-detected</span>}
                        </label>
                        <input
                            type="number"
                            id="disk"
                            value={diskTotal}
                            onChange={(e) => setDiskTotal(Number(e.target.value))}
                            min={1024}
                            step={1024}
                            required
                            className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors text-foreground"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {(diskTotal / 1024).toFixed(1)} GB — you can lower this to reserve space for the OS
                        </p>
                    </div>

                    {/* Error message */}
                    {error && (
                        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
                            {error}
                        </div>
                    )}

                    {/* Submit button */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 px-4 text-white font-medium rounded-lg gradient-primary hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                                Adding Node...
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M5 12h14" />
                                    <path d="M12 5v14" />
                                </svg>
                                Add Node
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
