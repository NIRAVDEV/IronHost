'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { serversApi, nodesApi, userApi, Node, User } from '@/lib/api';

// Country flag emoji helper – maps country names (last word of location) to flag
function getRegionFlag(location: string): string {
    const lower = location.toLowerCase();
    const flags: Record<string, string> = {
        india: '🇮🇳',
        'united states': '🇺🇸',
        usa: '🇺🇸',
        us: '🇺🇸',
        germany: '🇩🇪',
        france: '🇫🇷',
        uk: '🇬🇧',
        'united kingdom': '🇬🇧',
        japan: '🇯🇵',
        singapore: '🇸🇬',
        australia: '🇦🇺',
        canada: '🇨🇦',
        brazil: '🇧🇷',
        netherlands: '🇳🇱',
        korea: '🇰🇷',
        finland: '🇫🇮',
        sweden: '🇸🇪',
    };
    for (const [key, flag] of Object.entries(flags)) {
        if (lower.includes(key)) return flag;
    }
    return '🌍';
}

interface RegionGroup {
    location: string;
    flag: string;
    nodes: Node[];
    totalMemory: number;
    allocatedMemory: number;
    totalDisk: number;
    allocatedDisk: number;
}

export default function CreateServerPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [nodes, setNodes] = useState<Node[]>([]);
    const [nodesLoading, setNodesLoading] = useState(true);

    const [name, setName] = useState('');
    const [selectedRegion, setSelectedRegion] = useState('');
    const [memoryLimit, setMemoryLimit] = useState(512);
    const [diskLimit, setDiskLimit] = useState(1024);
    const [cpuLimit, setCpuLimit] = useState(100);
    const [gameType, setGameType] = useState('VANILLA');
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const [nodeData, userData] = await Promise.all([
                    nodesApi.list(),
                    userApi.getMe(),
                ]);
                setNodes(nodeData || []);
                setUser(userData);
                // Set defaults based on available resources
                const freeRAM = (userData.resource_ram_mb || 0) - (userData.resource_ram_used_mb || 0);
                const freeCPU = (userData.resource_cpu_cores || 0) - (userData.resource_cpu_used_cores || 0);
                const freeStorage = (userData.resource_storage_mb || 0) - (userData.resource_storage_used_mb || 0);
                setMemoryLimit(Math.min(512, freeRAM));
                setDiskLimit(Math.min(1024, freeStorage));
                setCpuLimit(Math.min(100, freeCPU));
            } catch (err) {
                console.error('Failed to fetch data:', err);
                setError('Failed to load data');
            } finally {
                setNodesLoading(false);
            }
        }
        fetchData();
    }, []);

    // Group nodes by location into regions
    const regions: RegionGroup[] = useMemo(() => {
        const map = new Map<string, Node[]>();
        for (const node of nodes) {
            const loc = node.location || 'Unknown';
            if (!map.has(loc)) map.set(loc, []);
            map.get(loc)!.push(node);
        }
        const groups: RegionGroup[] = [];
        for (const [location, regionNodes] of map) {
            groups.push({
                location,
                flag: getRegionFlag(location),
                nodes: regionNodes,
                totalMemory: regionNodes.reduce((s, n) => s + n.memory_total, 0),
                allocatedMemory: regionNodes.reduce((s, n) => s + n.memory_allocated, 0),
                totalDisk: regionNodes.reduce((s, n) => s + n.disk_total, 0),
                allocatedDisk: regionNodes.reduce((s, n) => s + n.disk_allocated, 0),
            });
        }
        return groups;
    }, [nodes]);

    // Auto-select first region when loaded
    useEffect(() => {
        if (regions.length > 0 && !selectedRegion) {
            setSelectedRegion(regions[0].location);
        }
    }, [regions, selectedRegion]);

    // Pick a node from the selected region (the one with most free memory)
    const bestNodeForRegion = useMemo(() => {
        const region = regions.find((r) => r.location === selectedRegion);
        if (!region) return null;
        return region.nodes
            .filter((n) => !n.maintenance_mode)
            .sort(
                (a, b) =>
                    b.memory_total - b.memory_allocated - (a.memory_total - a.memory_allocated)
            )[0] || null;
    }, [regions, selectedRegion]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!bestNodeForRegion) {
            setError('No available nodes in the selected region');
            return;
        }
        setIsLoading(true);
        setError(null);

        try {
            await serversApi.create({
                name,
                node_id: bestNodeForRegion.id,
                memory_limit: memoryLimit,
                cpu_limit: cpuLimit,
                disk_limit: diskLimit,
                game_type: gameType,
            });
            router.push('/dashboard/servers');
        } catch (err: unknown) {
            console.error('Failed to create server:', err);
            const axiosErr = err as { response?: { data?: { error?: string } } };
            const errorMessage = axiosErr?.response?.data?.error || (err instanceof Error ? err.message : 'Failed to create server');
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const gameTypes = [
        { value: 'VANILLA', label: 'Minecraft Vanilla', icon: '🟫' },
        { value: 'PAPER', label: 'Minecraft Paper', icon: '📄' },
        { value: 'SPIGOT', label: 'Minecraft Spigot', icon: '🔧' },
        { value: 'FORGE', label: 'Minecraft Forge', icon: '⚒️' },
        { value: 'FABRIC', label: 'Minecraft Fabric', icon: '🧵' },
    ];

    const freeRAM = (user?.resource_ram_mb || 0) - (user?.resource_ram_used_mb || 0);
    const freeCPU = (user?.resource_cpu_cores || 0) - (user?.resource_cpu_used_cores || 0);
    const freeStorage = (user?.resource_storage_mb || 0) - (user?.resource_storage_used_mb || 0);
    const fmtMB = (mb: number) => mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
    const fmtCPU = (c: number) => c === 0 ? '0' : `${(c / 100).toFixed(c % 100 === 0 ? 0 : 1)}`;

    return (
        <div className="max-w-3xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="mb-8">
                <Link
                    href="/dashboard/servers"
                    className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="m15 18-6-6 6-6" />
                    </svg>
                    Back to Servers
                </Link>
                <h1 className="text-2xl font-bold text-foreground">Create New Server</h1>
                <p className="text-muted-foreground">Configure and deploy a new game server</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Server Name */}
                <div className="glass-card rounded-xl p-6">
                    <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
                        Server Name
                    </label>
                    <input
                        type="text"
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="My Awesome Server"
                        required
                        className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors text-foreground placeholder:text-muted-foreground"
                    />
                </div>

                {/* Game Type Cards */}
                <div className="glass-card rounded-xl p-6">
                    <label className="block text-sm font-medium text-foreground mb-3">
                        Server Type
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {gameTypes.map((gt) => (
                            <button
                                key={gt.value}
                                type="button"
                                onClick={() => setGameType(gt.value)}
                                className={`relative p-4 rounded-xl border-2 transition-all duration-200 text-left ${gameType === gt.value
                                    ? 'border-primary-500 bg-primary-500/10 shadow-lg shadow-primary-500/10'
                                    : 'border-border hover:border-muted-foreground/40 bg-background/50 hover:bg-background'
                                    }`}
                            >
                                <span className="text-2xl">{gt.icon}</span>
                                <p className={`text-sm font-medium mt-2 ${gameType === gt.value ? 'text-primary-400' : 'text-foreground'
                                    }`}>{gt.label}</p>
                                {gameType === gt.value && (
                                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Region Selection */}
                <div className="glass-card rounded-xl p-6">
                    <label className="block text-sm font-medium text-foreground mb-1">
                        Region
                    </label>
                    <p className="text-xs text-muted-foreground mb-4">
                        Choose the region closest to you for the best latency
                    </p>

                    {nodesLoading ? (
                        <div className="flex items-center justify-center py-8 text-muted-foreground gap-3">
                            <div className="animate-spin h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full" />
                            Loading regions...
                        </div>
                    ) : regions.length === 0 ? (
                        <div className="py-6 text-center rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
                            No regions available. An admin needs to add a node first.
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {regions.map((region) => {
                                const freeMemGB = ((region.totalMemory - region.allocatedMemory) / 1024).toFixed(1);
                                const freeDiskGB = ((region.totalDisk - region.allocatedDisk) / 1024).toFixed(0);
                                const isSelected = selectedRegion === region.location;
                                const nodeCount = region.nodes.filter(n => !n.maintenance_mode).length;

                                return (
                                    <button
                                        key={region.location}
                                        type="button"
                                        onClick={() => setSelectedRegion(region.location)}
                                        className={`relative w-full p-4 rounded-xl border-2 transition-all duration-200 text-left flex items-center gap-4 ${isSelected
                                            ? 'border-primary-500 bg-primary-500/10 shadow-lg shadow-primary-500/10'
                                            : 'border-border hover:border-muted-foreground/40 bg-background/50 hover:bg-background'
                                            }`}
                                    >
                                        {/* Flag */}
                                        <span className="text-3xl flex-shrink-0">{region.flag}</span>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-semibold ${isSelected ? 'text-primary-400' : 'text-foreground'
                                                }`}>{region.location}</p>
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                                <span className="text-xs text-muted-foreground">
                                                    {nodeCount} node{nodeCount !== 1 ? 's' : ''}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {freeMemGB} GB RAM free
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {freeDiskGB} GB disk free
                                                </span>
                                            </div>
                                        </div>

                                        {/* Check */}
                                        {isSelected && (
                                            <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Resources */}
                <div className="glass-card rounded-xl p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Resources</label>
                        <p className="text-xs text-muted-foreground mb-4">
                            Allocate from your resource pool. <Link href="/dashboard/store" className="text-primary-400 hover:underline">Buy more in Store →</Link>
                        </p>
                    </div>

                    {/* RAM Slider */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-muted-foreground">🧠 RAM</span>
                            <span className="text-sm text-foreground font-semibold tabular-nums">
                                {fmtMB(memoryLimit)} <span className="text-muted-foreground font-normal">/ {fmtMB(freeRAM)} free</span>
                            </span>
                        </div>
                        <input
                            type="range"
                            value={memoryLimit}
                            onChange={(e) => setMemoryLimit(Number(e.target.value))}
                            min={256}
                            max={Math.max(256, freeRAM)}
                            step={256}
                            className="w-full accent-primary-500 h-2"
                            style={{ accentColor: 'var(--color-primary-500, #8b5cf6)' }}
                        />
                        {freeRAM < 256 && (
                            <p className="text-xs text-red-400 mt-1">No RAM available. Purchase more in the Store.</p>
                        )}
                    </div>

                    {/* CPU Slider */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-muted-foreground">⚡ CPU</span>
                            <span className="text-sm text-foreground font-semibold tabular-nums">
                                {fmtCPU(cpuLimit)} cores <span className="text-muted-foreground font-normal">/ {fmtCPU(freeCPU)} free</span>
                            </span>
                        </div>
                        <input
                            type="range"
                            value={cpuLimit}
                            onChange={(e) => setCpuLimit(Number(e.target.value))}
                            min={25}
                            max={Math.max(25, freeCPU)}
                            step={25}
                            className="w-full accent-primary-500 h-2"
                            style={{ accentColor: 'var(--color-primary-500, #8b5cf6)' }}
                        />
                        {freeCPU < 25 && (
                            <p className="text-xs text-red-400 mt-1">No CPU available. Purchase more in the Store.</p>
                        )}
                    </div>

                    {/* Storage Slider */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-muted-foreground">💾 Storage</span>
                            <span className="text-sm text-foreground font-semibold tabular-nums">
                                {fmtMB(diskLimit)} <span className="text-muted-foreground font-normal">/ {fmtMB(freeStorage)} free</span>
                            </span>
                        </div>
                        <input
                            type="range"
                            value={diskLimit}
                            onChange={(e) => setDiskLimit(Number(e.target.value))}
                            min={512}
                            max={Math.max(512, freeStorage)}
                            step={512}
                            className="w-full accent-primary-500 h-2"
                            style={{ accentColor: 'var(--color-primary-500, #8b5cf6)' }}
                        />
                        {freeStorage < 512 && (
                            <p className="text-xs text-red-400 mt-1">No storage available. Purchase more in the Store.</p>
                        )}
                    </div>
                </div>

                {/* Error message */}
                {error && (
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
                        {error}
                    </div>
                )}

                {/* Submit */}
                <button
                    type="submit"
                    disabled={isLoading || regions.length === 0 || !bestNodeForRegion}
                    className="w-full py-4 px-4 text-white font-semibold rounded-xl gradient-primary hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
                >
                    {isLoading ? (
                        <>
                            <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                            Creating Server...
                        </>
                    ) : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M5 12h14" />
                                <path d="M12 5v14" />
                            </svg>
                            Create Server
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}
