import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi, type User } from '@/lib/api';

interface AuthState {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;

    // Actions
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, username: string) => Promise<void>;
    logout: () => void;
    fetchUser: () => Promise<void>;
    setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isLoading: false,
            isAuthenticated: false,

            login: async (email: string, password: string) => {
                set({ isLoading: true });
                try {
                    const { token, user } = await authApi.login(email, password);
                    localStorage.setItem('token', token);
                    set({ user, token, isAuthenticated: true, isLoading: false });
                } catch (error) {
                    set({ isLoading: false });
                    throw error;
                }
            },

            register: async (email: string, password: string, username: string) => {
                set({ isLoading: true });
                try {
                    const { token, user } = await authApi.register(email, password, username);
                    localStorage.setItem('token', token);
                    set({ user, token, isAuthenticated: true, isLoading: false });
                } catch (error) {
                    set({ isLoading: false });
                    throw error;
                }
            },

            logout: () => {
                localStorage.removeItem('token');
                set({ user: null, token: null, isAuthenticated: false });
            },

            fetchUser: async () => {
                const token = get().token || localStorage.getItem('token');
                if (!token) {
                    set({ isAuthenticated: false });
                    return;
                }

                set({ isLoading: true });
                try {
                    const user = await authApi.me();
                    set({ user, token, isAuthenticated: true, isLoading: false });
                } catch {
                    localStorage.removeItem('token');
                    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
                }
            },

            setLoading: (loading: boolean) => set({ isLoading: loading }),
        }),
        {
            name: 'ironhost-auth',
            partialize: (state) => ({ token: state.token }),
        }
    )
);
