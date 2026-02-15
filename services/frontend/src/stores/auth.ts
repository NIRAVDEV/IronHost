import { create } from 'zustand';
import { createClient } from '@/lib/supabase';
import { api } from '@/lib/api';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface AuthState {
    user: SupabaseUser | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    isAdmin: boolean;

    // Actions
    login: (email: string, password: string) => Promise<void>;
    loginWithProvider: (provider: 'google' | 'github') => Promise<void>;
    register: (email: string, password: string, username: string) => Promise<void>;
    logout: () => Promise<void>;
    fetchUser: () => Promise<void>;
    setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
    user: null,
    isLoading: false,
    isAuthenticated: false,
    isAdmin: false,

    login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
            const supabase = createClient();
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            // Fetch admin status from our backend
            let isAdmin = false;
            try {
                const res = await api.get('/auth/me');
                isAdmin = res.data?.is_admin === true;
            } catch { /* not critical */ }

            set({
                user: data.user,
                isAuthenticated: true,
                isAdmin,
                isLoading: false,
            });
        } catch (error) {
            set({ isLoading: false });
            throw error;
        }
    },

    loginWithProvider: async (provider: 'google' | 'github') => {
        set({ isLoading: true });
        try {
            const supabase = createClient();
            const { error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                },
            });

            if (error) throw error;
            // OAuth redirects the user, so we don't need to update state here.
            // The callback page will handle session retrieval.
        } catch (error) {
            set({ isLoading: false });
            throw error;
        }
    },

    register: async (email: string, password: string, username: string) => {
        set({ isLoading: true });
        try {
            const supabase = createClient();
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: username,
                    },
                },
            });

            if (error) throw error;

            set({
                user: data.user,
                isAuthenticated: !!data.user,
                isAdmin: false, // New users are never admin
                isLoading: false,
            });
        } catch (error) {
            set({ isLoading: false });
            throw error;
        }
    },

    logout: async () => {
        try {
            const supabase = createClient();
            await supabase.auth.signOut();
        } finally {
            set({ user: null, isAuthenticated: false, isAdmin: false });
        }
    },

    fetchUser: async () => {
        set({ isLoading: true });
        try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                // Fetch admin status from our backend
                let isAdmin = false;
                try {
                    const res = await api.get('/auth/me');
                    isAdmin = res.data?.is_admin === true;
                } catch { /* not critical */ }

                set({
                    user,
                    isAuthenticated: true,
                    isAdmin,
                    isLoading: false,
                });
            } else {
                set({ user: null, isAuthenticated: false, isAdmin: false, isLoading: false });
            }
        } catch {
            set({ user: null, isAuthenticated: false, isAdmin: false, isLoading: false });
        }
    },

    setLoading: (loading: boolean) => set({ isLoading: loading }),
}));
