'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';

// Icons as simple SVG components for now (can be replaced with Lucide later)
const icons = {
    home: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9,22 9,12 15,12 15,22" />
        </svg>
    ),
    server: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
            <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
            <line x1="6" x2="6.01" y1="6" y2="6" />
            <line x1="6" x2="6.01" y1="18" y2="18" />
        </svg>
    ),
    creditCard: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="14" x="2" y="5" rx="2" />
            <line x1="2" x2="22" y1="10" y2="10" />
        </svg>
    ),
    settings: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    ),
    nodes: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="4" width="6" height="6" rx="1" />
            <rect x="14" y="4" width="6" height="6" rx="1" />
            <rect x="4" y="14" width="6" height="6" rx="1" />
            <rect x="14" y="14" width="6" height="6" rx="1" />
        </svg>
    ),
    flame: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
        </svg>
    ),
    logout: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" x2="9" y1="12" y2="12" />
        </svg>
    ),
};

const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: icons.home },
    { href: '/dashboard/servers', label: 'Servers', icon: icons.server },
    { href: '/dashboard/nodes', label: 'Nodes', icon: icons.nodes },
    { href: '/dashboard/billing', label: 'Billing', icon: icons.creditCard },
    { href: '/dashboard/settings', label: 'Settings', icon: icons.settings },
];

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, fetchUser, logout } = useAuthStore();

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
    const displayEmail = user?.email || '';
    const initials = displayName.charAt(0).toUpperCase();

    const handleLogout = async () => {
        await logout();
        router.push('/login');
    };

    return (
        <aside className="fixed left-0 top-0 z-40 h-screen w-64 glass-card border-r border-border/50">
            <div className="flex h-full flex-col">
                {/* Logo */}
                <div className="flex h-16 items-center gap-3 border-b border-border/50 px-6">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary">
                        {icons.flame}
                    </div>
                    <span className="text-xl font-bold gradient-text">IronHost</span>
                </div>

                {/* Navigation */}
                <nav className="flex-1 space-y-1 px-3 py-4">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`
                  group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
                  transition-all duration-200 ease-out
                  ${isActive
                                        ? 'bg-primary-500/10 text-primary-400'
                                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                                    }
                `}
                            >
                                <span className={`transition-colors ${isActive ? 'text-primary-400' : 'text-muted-foreground group-hover:text-foreground'}`}>
                                    {item.icon}
                                </span>
                                {item.label}
                                {isActive && (
                                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary-400 animate-pulse-glow" />
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* User section */}
                <div className="border-t border-border/50 p-4">
                    <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-500/20 text-primary-400 font-semibold text-sm">
                            {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                            <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Sign out"
                        >
                            {icons.logout}
                        </button>
                    </div>
                </div>
            </div>
        </aside>
    );
}
