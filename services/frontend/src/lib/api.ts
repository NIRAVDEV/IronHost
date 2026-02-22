import axios from 'axios';
import { createClient } from '@/lib/supabase';

// API base URL - Master Control Plane
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
console.log('IronHost API URL:', API_BASE_URL);

// Create axios instance
export const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor - add Supabase auth token
api.interceptors.request.use(async (config) => {
    if (typeof window !== 'undefined') {
        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
                config.headers.Authorization = `Bearer ${session.access_token}`;
            }
        } catch {
            // Silently fail if no session
        }
    }
    return config;
});

// Response interceptor - handle 401
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Log 401 errors but DO NOT redirect automatically. 
        // Automatic redirects cause infinite loops if the backend rejects a token 
        // that the frontend Supabase SDK considers valid (e.g. secret mismatch).
        if (error.response?.status === 401) {
            console.warn('API Unauthorized (401):', error.config?.url);
        }
        return Promise.reject(error);
    }
);

// Types
export interface User {
    id: string;
    email: string;
    username: string;
    coin_balance_granted: number;
    coin_balance_earned: number;
    plan: string;
    resource_ram_mb: number;
    resource_cpu_cores: number;
    resource_storage_mb: number;
    resource_ram_used_mb: number;
    resource_cpu_used_cores: number;
    resource_storage_used_mb: number;
    created_at: string;
}

export interface ResourcePackage {
    id: string;
    name: string;
    cost_ihc: number;
    ram_mb: number;
    cpu_cores: number;
    storage_mb: number;
}

export interface Server {
    id: string;
    name: string;
    status: 'running' | 'stopped' | 'starting' | 'installing' | 'offline';
    docker_image: string;
    memory_limit: number;
    memory_used?: number;
    cpu_limit: number;
    cpu_used?: number;
    disk_limit: number;
    disk_used?: number;
    node_id: string;
    created_at: string;
}

export interface Node {
    id: string;
    name: string;
    fqdn: string;
    scheme: string;
    grpc_port: number;
    location: string;
    memory_total: number;
    memory_allocated: number;
    disk_total: number;
    disk_allocated: number;
    maintenance_mode: boolean;
}

export interface Plan {
    id: string;
    name: string;
    price_cents: number;
    monthly_ihc_grant: number;
    queue_skip: boolean;
    session_limit_minutes: number;
    auto_shutdown_minutes: number;
    features: string[];
}

export interface CoinTransaction {
    id: string;
    user_id: string;
    amount: number;
    type: string;
    source: string;
    description: string;
    created_at: string;
}

export interface CoinBalance {
    coin_balance_granted: number;
    coin_balance_earned: number;
    coin_balance_total: number;
    transactions?: CoinTransaction[];
}

// Servers API
export const serversApi = {
    list: async () => {
        const { data } = await api.get<{ servers: Server[] }>('/servers');
        return data.servers;
    },

    get: async (id: string) => {
        const { data } = await api.get<{ server: Server }>(`/servers/${id}`);
        return data.server;
    },

    create: async (serverData: {
        name: string;
        node_id: string;
        memory_limit: number;
        cpu_limit?: number;
        disk_limit: number;
        game_type?: string;
    }) => {
        const { data } = await api.post<{ server: Server }>('/servers', serverData);
        return data.server;
    },

    start: async (id: string) => {
        const { data } = await api.post(`/servers/${id}/start`);
        return data;
    },

    stop: async (id: string) => {
        const { data } = await api.post(`/servers/${id}/stop`);
        return data;
    },

    restart: async (id: string) => {
        const { data } = await api.post(`/servers/${id}/restart`);
        return data;
    },

    delete: async (id: string) => {
        await api.delete(`/servers/${id}`);
    },

    sendCommand: async (id: string, command: string) => {
        const { data } = await api.post<{ message: string; output: string }>(`/servers/${id}/command`, { command });
        return data;
    },

    getLogs: async (id: string) => {
        const { data } = await api.get<{ logs: string[] }>(`/servers/${id}/logs`);
        return data.logs || [];
    },
};

// Nodes API
export const nodesApi = {
    list: async () => {
        const { data } = await api.get<{ nodes: Node[] }>('/nodes');
        return data.nodes;
    },

    get: async (id: string) => {
        const { data } = await api.get<{ node: Node }>(`/nodes/${id}`);
        return data.node;
    },

    create: async (nodeData: {
        name: string;
        fqdn: string;
        grpc_port: number;
        location?: string;
        memory_total: number;
        disk_total: number;
        daemon_token: string;
    }) => {
        const { data } = await api.post<{ node: Node }>('/nodes', nodeData);
        return data.node;
    },

    update: async (id: string, nodeData: Partial<{
        name: string;
        fqdn: string;
        maintenance_mode: boolean;
    }>) => {
        const { data } = await api.put<{ node: Node }>(`/nodes/${id}`, nodeData);
        return data.node;
    },

    delete: async (id: string) => {
        await api.delete(`/nodes/${id}`);
    },

    probe: async (probeData: {
        fqdn: string;
        grpc_port: number;
        scheme?: string;
        daemon_token: string;
    }) => {
        const { data } = await api.post<{
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
        }>('/nodes/probe', probeData);
        return data;
    },

    getStats: async (id: string) => {
        const { data } = await api.get<{
            stats: {
                node_id: string;
                node_name: string;
                total_memory_bytes: number;
                available_memory_bytes: number;
                total_disk_bytes: number;
                available_disk_bytes: number;
                cpu_usage_percent: number;
                running_containers: number;
                uptime_seconds: number;
            };
        }>(`/nodes/${id}/stats`);
        return data.stats;
    },
};

// Billing API
export const billingApi = {
    getPlans: async () => {
        const { data } = await api.get<{ plans: Plan[] }>('/billing/plans');
        return data.plans;
    },

    getSubscription: async () => {
        const { data } = await api.get<{ plan: Plan; coin_balance_granted: number; coin_balance_earned: number; coin_balance_total: number }>('/billing/subscription');
        return data;
    },

    subscribe: async (planId: string) => {
        const { data } = await api.post('/billing/subscribe', { plan_id: planId });
        return data;
    },

    getCoins: async (): Promise<CoinBalance> => {
        const { data } = await api.get<CoinBalance>('/billing/coins');
        return data;
    },

    earnCoins: async (amount: number) => {
        const { data } = await api.post('/billing/coins/earn', { amount });
        return data;
    },

    purchaseCoins: async (packageId: string) => {
        const { data } = await api.post('/billing/coins/purchase', { package_id: packageId });
        return data;
    },

    getTransactions: async () => {
        const { data } = await api.get<{ transactions: CoinTransaction[] }>('/billing/invoices');
        return data.transactions || [];
    },

    getResourceCatalog: async () => {
        const { data } = await api.get<{ packages: ResourcePackage[] }>('/billing/resources');
        return data.packages;
    },

    purchaseResource: async (packageId: string) => {
        const { data } = await api.post('/billing/resources/purchase', { package_id: packageId });
        return data;
    },
};

// User API
export const userApi = {
    getMe: async (): Promise<User> => {
        const { data } = await api.get<User>('/auth/me');
        return data;
    },

    updateProfile: async (profileData: { username: string }) => {
        const { data } = await api.put('/auth/me', profileData);
        return data;
    },
};
