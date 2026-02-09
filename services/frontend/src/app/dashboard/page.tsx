import Link from 'next/link';

// Server card component
function ServerCard({
    name,
    status,
    game,
    memory,
    cpu
}: {
    name: string;
    status: 'running' | 'stopped' | 'starting';
    game: string;
    memory: number;
    cpu: number;
}) {
    const statusColors = {
        running: 'status-running',
        stopped: 'status-stopped',
        starting: 'status-starting',
    };

    return (
        <div className="glass-card rounded-xl p-5 transition-all duration-300 hover:scale-[1.02] cursor-pointer group">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="font-semibold text-foreground group-hover:text-primary-400 transition-colors">
                        {name}
                    </h3>
                    <p className="text-sm text-muted-foreground">{game}</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`status-dot ${statusColors[status]}`} />
                    <span className="text-xs text-muted-foreground capitalize">{status}</span>
                </div>
            </div>

            {/* Resource bars */}
            <div className="space-y-3">
                <div>
                    <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Memory</span>
                        <span className="text-foreground">{memory}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full transition-all"
                            style={{ width: `${memory}%` }}
                        />
                    </div>
                </div>
                <div>
                    <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">CPU</span>
                        <span className="text-foreground">{cpu}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-accent-500 to-primary-500 rounded-full transition-all"
                            style={{ width: `${cpu}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

// Stats card
function StatCard({
    label,
    value,
    icon,
    trend
}: {
    label: string;
    value: string | number;
    icon: React.ReactNode;
    trend?: { value: number; isPositive: boolean };
}) {
    return (
        <div className="glass-card rounded-xl p-5">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-muted-foreground mb-1">{label}</p>
                    <p className="text-2xl font-bold text-foreground">{value}</p>
                    {trend && (
                        <p className={`text-xs mt-1 ${trend.isPositive ? 'text-green-400' : 'text-red-400'}`}>
                            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% from last week
                        </p>
                    )}
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/10 text-primary-400">
                    {icon}
                </div>
            </div>
        </div>
    );
}

export default function DashboardPage() {
    // Mock data - will be replaced with API calls
    const servers = [
        { id: '1', name: 'Survival SMP', status: 'running' as const, game: 'Minecraft', memory: 67, cpu: 45 },
        { id: '2', name: 'Creative Build', status: 'stopped' as const, game: 'Minecraft', memory: 0, cpu: 0 },
        { id: '3', name: 'Modded Adventure', status: 'running' as const, game: 'Minecraft', memory: 82, cpu: 71 },
    ];

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground">
                    Welcome back! 👋
                </h1>
                <p className="text-muted-foreground mt-1">
                    Here&apos;s an overview of your game servers.
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
                <StatCard
                    label="Active Servers"
                    value={2}
                    icon={
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
                            <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
                            <line x1="6" x2="6.01" y1="6" y2="6" />
                            <line x1="6" x2="6.01" y1="18" y2="18" />
                        </svg>
                    }
                />
                <StatCard
                    label="Total Players"
                    value={47}
                    icon={
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                    }
                    trend={{ value: 12, isPositive: true }}
                />
                <StatCard
                    label="Memory Used"
                    value="4.2 GB"
                    icon={
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 19v-3" />
                            <path d="M10 19v-3" />
                            <path d="M14 19v-3" />
                            <path d="M18 19v-3" />
                            <path d="M8 11V9" />
                            <path d="M16 11V9" />
                            <path d="M12 11V9" />
                            <path d="M2 15h20" />
                            <path d="M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1.1a2 2 0 0 0 0 3.837V17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5.1a2 2 0 0 0 0-3.837Z" />
                        </svg>
                    }
                />
                <StatCard
                    label="CPU Usage"
                    value="58%"
                    icon={
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect width="16" height="16" x="4" y="4" rx="2" />
                            <rect width="6" height="6" x="9" y="9" rx="1" />
                            <path d="M15 2v2" />
                            <path d="M15 20v2" />
                            <path d="M2 15h2" />
                            <path d="M2 9h2" />
                            <path d="M20 15h2" />
                            <path d="M20 9h2" />
                            <path d="M9 2v2" />
                            <path d="M9 20v2" />
                        </svg>
                    }
                />
            </div>

            {/* Servers section */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-foreground">Your Servers</h2>
                    <Link
                        href="/dashboard/servers/new"
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg gradient-primary hover:opacity-90 transition-opacity"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M5 12h14" />
                            <path d="M12 5v14" />
                        </svg>
                        New Server
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
                    {servers.map((server) => (
                        <Link key={server.id} href={`/dashboard/servers/${server.id}`}>
                            <ServerCard {...server} />
                        </Link>
                    ))}

                    {/* Add server card */}
                    <Link href="/dashboard/servers/new">
                        <div className="glass-card rounded-xl p-5 h-full min-h-[160px] flex flex-col items-center justify-center text-muted-foreground hover:text-primary-400 hover:border-primary-500/30 transition-all cursor-pointer group">
                            <div className="w-12 h-12 rounded-full border-2 border-dashed border-current flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M5 12h14" />
                                    <path d="M12 5v14" />
                                </svg>
                            </div>
                            <span className="text-sm font-medium">Create New Server</span>
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    );
}
