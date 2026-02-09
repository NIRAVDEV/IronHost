'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { nodesApi } from '@/lib/api';

export default function AddNodePage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [fqdn, setFqdn] = useState('');
    const [grpcPort, setGrpcPort] = useState(8443);
    const [memoryTotal, setMemoryTotal] = useState(8192); // 8 GB default
    const [diskTotal, setDiskTotal] = useState(102400); // 100 GB default
    const [daemonToken, setDaemonToken] = useState('');

    // Generate random token
    const generateToken = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let token = '';
        for (let i = 0; i < 32; i++) {
            token += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setDaemonToken(token);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Submitting Add Node form...');
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
            console.error('Failed to add node:', err);
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
                            onChange={(e) => setFqdn(e.target.value)}
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

                    {/* Memory */}
                    <div>
                        <label htmlFor="memory" className="block text-sm font-medium text-foreground mb-2">
                            Total RAM (MB)
                        </label>
                        <input
                            type="number"
                            id="memory"
                            value={memoryTotal}
                            onChange={(e) => setMemoryTotal(Number(e.target.value))}
                            min={1024}
                            step={1024}
                            required
                            className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors text-foreground"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {(memoryTotal / 1024).toFixed(1)} GB available for servers
                        </p>
                    </div>

                    {/* Disk */}
                    <div>
                        <label htmlFor="disk" className="block text-sm font-medium text-foreground mb-2">
                            Total Storage (MB)
                        </label>
                        <input
                            type="number"
                            id="disk"
                            value={diskTotal}
                            onChange={(e) => setDiskTotal(Number(e.target.value))}
                            min={10240}
                            step={1024}
                            required
                            className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors text-foreground"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {(diskTotal / 1024).toFixed(1)} GB available for servers
                        </p>
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
                                onChange={(e) => setDaemonToken(e.target.value)}
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
