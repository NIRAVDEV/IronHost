import Link from 'next/link';

// Control button component
function ControlButton({
    icon,
    label,
    variant = 'default',
    disabled = false
}: {
    icon: React.ReactNode;
    label: string;
    variant?: 'default' | 'danger' | 'success';
    disabled?: boolean;
}) {
    const variants = {
        default: 'bg-muted/50 hover:bg-muted text-foreground',
        success: 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30',
        danger: 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30',
    };

    return (
        <button
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${variants[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={disabled}
        >
            {icon}
            {label}
        </button>
    );
}

// Resource gauge
function ResourceGauge({
    label,
    value,
    max,
    unit,
    color = 'primary'
}: {
    label: string;
    value: number;
    max: number;
    unit: string;
    color?: 'primary' | 'accent';
}) {
    const percentage = Math.round((value / max) * 100);
    const gradientClass = color === 'primary'
        ? 'from-primary-500 to-primary-600'
        : 'from-accent-500 to-accent-600';

    return (
        <div className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="text-sm font-medium text-foreground">{value} / {max} {unit}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                    className={`h-full bg-gradient-to-r ${gradientClass} rounded-full transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{percentage}% used</p>
        </div>
    );
}

export default async function ServerDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    // Mock server data - will be replaced with API call using id
    const server = {
        id,
        name: 'Survival SMP',
        status: 'running' as const,
        game: 'Minecraft 1.20.4',
        address: 'play.ironhost.io:25565',
        memory: { used: 2.1, total: 4 },
        cpu: 45,
        disk: { used: 12, total: 50 },
        players: { current: 12, max: 50 },
        uptime: '5 days, 12 hours',
    };

    const statusColors = {
        running: 'status-running',
        stopped: 'status-stopped',
        starting: 'status-starting',
    };

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
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-500/10 text-primary-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
                            <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
                            <line x1="6" x2="6.01" y1="6" y2="6" />
                            <line x1="6" x2="6.01" y1="18" y2="18" />
                        </svg>
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-foreground">{server.name}</h1>
                            <span className={`status-dot ${statusColors[server.status]}`} />
                        </div>
                        <p className="text-muted-foreground">{server.game} • {server.address}</p>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2">
                    <ControlButton
                        icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="14" y="4" width="4" height="16" rx="1" /><rect x="6" y="4" width="4" height="16" rx="1" /></svg>}
                        label="Stop"
                        variant="danger"
                    />
                    <ControlButton
                        icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 16h5v5" /></svg>}
                        label="Restart"
                    />
                    <Link
                        href={`/dashboard/servers/${server.id}/console`}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium gradient-primary text-white hover:opacity-90 transition-opacity"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4,17 10,11 4,5" /><line x1="12" x2="20" y1="19" y2="19" /></svg>
                        Console
                    </Link>
                </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-card rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{server.players.current}</p>
                    <p className="text-sm text-muted-foreground">Players Online</p>
                </div>
                <div className="glass-card rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{server.uptime}</p>
                    <p className="text-sm text-muted-foreground">Uptime</p>
                </div>
                <div className="glass-card rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{server.cpu}%</p>
                    <p className="text-sm text-muted-foreground">CPU Usage</p>
                </div>
                <div className="glass-card rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold gradient-text">{server.players.max}</p>
                    <p className="text-sm text-muted-foreground">Max Players</p>
                </div>
            </div>

            {/* Resource gauges */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ResourceGauge
                    label="Memory"
                    value={server.memory.used}
                    max={server.memory.total}
                    unit="GB"
                    color="primary"
                />
                <ResourceGauge
                    label="CPU"
                    value={server.cpu}
                    max={100}
                    unit="%"
                    color="accent"
                />
                <ResourceGauge
                    label="Disk"
                    value={server.disk.used}
                    max={server.disk.total}
                    unit="GB"
                    color="primary"
                />
            </div>

            {/* Navigation tabs */}
            <div className="glass-card rounded-xl p-1 flex gap-1">
                <button className="flex-1 py-2 text-sm font-medium rounded-lg bg-primary-500/10 text-primary-400">
                    Overview
                </button>
                <Link href={`/dashboard/servers/${server.id}/console`} className="flex-1 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-center">
                    Console
                </Link>
                <button className="flex-1 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                    Files
                </button>
                <button className="flex-1 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                    Settings
                </button>
            </div>
        </div>
    );
}
