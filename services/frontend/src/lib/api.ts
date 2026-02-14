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
        if (error.response?.status === 401) {
            if (typeof window !== 'undefined') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// Types
export interface User {
    id: string;
    email: string;
    username: string;
    created_at: string;
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
    servers_limit: number;
    ram_per_server_mb: number;
    storage_mb: number;
    features: string[];
}

export interface Subscription {
    id: string;
    plan: Plan;
    status: string;
    current_period_end: string;
}

export interface Invoice {
    id: string;
    amount_cents: number;
    status: string;
    invoice_date: string;
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
};

// Billing API
export const billingApi = {
    getPlans: async () => {
        const { data } = await api.get<{ plans: Plan[] }>('/billing/plans');
        return data.plans;
    },

    getSubscription: async () => {
        const { data } = await api.get<Subscription>('/billing/subscription');
        return data;
    },

    subscribe: async (planId: string) => {
        const { data } = await api.post<Subscription>('/billing/subscribe', { plan_id: planId });
        return data;
    },

    getInvoices: async () => {
        const { data } = await api.get<{ invoices: Invoice[] }>('/billing/invoices');
        return data.invoices;
    },
};
