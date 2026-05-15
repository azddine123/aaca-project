/**
 * Authentication Context
 * 
 * Manages user authentication state and provides login/logout functionality.
 * Uses SecureStore for native platforms and localStorage for web.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_URL } from '../config/api';

// Cross-platform storage adapter
const storage = {
    getItem: async (key: string) => {
        if (Platform.OS === 'web') return localStorage.getItem(key);
        return SecureStore.getItemAsync(key);
    },
    setItem: async (key: string, value: string) => {
        if (Platform.OS === 'web') { 
            localStorage.setItem(key, value); 
            return; 
        }
        return SecureStore.setItemAsync(key, value);
    },
    deleteItem: async (key: string) => {
        if (Platform.OS === 'web') { 
            localStorage.removeItem(key); 
            return; 
        }
        return SecureStore.deleteItemAsync(key);
    },
};

// Types
export type PreferredLanguage = 'fr' | 'en' | 'ar';

interface AuthState {
    token: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
    userName: string | null;
    userEmail: string | null;
    preferredLanguage: PreferredLanguage;
    loading: boolean;
    error: string | null;
}

interface AuthContextType {
    auth: AuthState;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
    updateUserName: (name: string) => Promise<void>;
    updateUserLanguage: (language: PreferredLanguage) => Promise<void>;
}

// Context
const AuthContext = createContext<AuthContextType>({
    auth: {
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        userName: null,
        userEmail: null,
        preferredLanguage: 'fr',
        loading: true,
        error: null
    },
    login: async () => {},
    logout: async () => {},
    authFetch: async (input, init) => fetch(input, init),
    updateUserName: async () => {},
    updateUserLanguage: async () => {},
});

// Hook
export const useAuth = () => useContext(AuthContext);

// Provider
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [auth, setAuth] = useState<AuthState>({
        token: null, 
        refreshToken: null, 
        isAuthenticated: false,
        userName: null, 
        userEmail: null, 
        preferredLanguage: 'fr',
        loading: true, 
        error: null,
    });

    // Load stored auth on mount
    useEffect(() => {
        (async () => {
            try {
                const token = await storage.getItem('aaca_token');
                const userName = await storage.getItem('aaca_username');
                const userEmail = await storage.getItem('aaca_email');
                const preferredLanguage = await storage.getItem('aaca_preferred_language');
                const refreshToken = await storage.getItem('aaca_refresh_token');
                
                if (token) {
                    setAuth({ 
                        token, 
                        refreshToken, 
                        isAuthenticated: true, 
                        userName, 
                        userEmail, 
                        preferredLanguage: preferredLanguage === 'en' || preferredLanguage === 'ar' ? preferredLanguage : 'fr',
                        loading: false, 
                        error: null 
                    });
                } else {
                    setAuth(prev => ({ ...prev, loading: false }));
                }
            } catch {
                setAuth(prev => ({ ...prev, loading: false }));
            }
        })();
    }, []);

    const login = async (email: string, password: string) => {
        setAuth(prev => ({ ...prev, loading: true, error: null }));
        
        try {
            const form = new FormData();
            form.append('email', email);
            form.append('password', password);
            
            const res = await fetch(`${API_URL}/auth/login`, { 
                method: 'POST', 
                body: form 
            });
            
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || 'Invalid credentials');
            }
            
            const data = await res.json();
            const newAuth = {
                token: data.access_token,
                refreshToken: data.refresh_token || null,
                isAuthenticated: true,
                userName: data.user?.full_name || email.split('@')[0],
                userEmail: data.user?.email || email,
                preferredLanguage: data.user?.preferred_language || 'fr',
                loading: false,
                error: null,
            };
            
            setAuth(newAuth);
            await storage.setItem('aaca_token', data.access_token);
            await storage.setItem('aaca_username', newAuth.userName || '');
            await storage.setItem('aaca_email', newAuth.userEmail || '');
            await storage.setItem('aaca_preferred_language', newAuth.preferredLanguage);
            if (data.refresh_token) {
                await storage.setItem('aaca_refresh_token', data.refresh_token);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Login failed';
            setAuth(prev => ({ 
                ...prev, 
                loading: false, 
                error: message, 
                isAuthenticated: false 
            }));
            throw err;
        }
    };

    const logout = async () => {
        await storage.deleteItem('aaca_token');
        await storage.deleteItem('aaca_username');
        await storage.deleteItem('aaca_email');
        await storage.deleteItem('aaca_preferred_language');
        await storage.deleteItem('aaca_refresh_token');

        setAuth({
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            userName: null,
            userEmail: null,
            preferredLanguage: 'fr',
            loading: false,
            error: null
        });
    };

    const authFetch = useCallback(async (
        input: RequestInfo,
        init: RequestInit = {}
    ): Promise<Response> => {
        const buildHeaders = (token: string | null) => {
            const h = new Headers(init.headers);
            if (token) h.set('Authorization', `Bearer ${token}`);
            return h;
        };

        let res = await fetch(input, { ...init, headers: buildHeaders(auth.token) });

        if (res.status === 401) {
            // Tenter refresh
            const storedRefresh = await storage.getItem('aaca_refresh_token');
            if (storedRefresh) {
                try {
                    const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ refresh_token: storedRefresh }),
                    });
                    if (refreshRes.ok) {
                        const { access_token } = await refreshRes.json();
                        await storage.setItem('aaca_token', access_token);
                        setAuth(prev => ({ ...prev, token: access_token }));
                        res = await fetch(input, {
                            ...init,
                            headers: buildHeaders(access_token)
                        });
                        return res;
                    }
                } catch { /* refresh failed */ }
            }
            await logout();
        }
        return res;
    }, [auth.token, logout]);

    const updateUserName = async (name: string) => {
        setAuth(prev => ({ ...prev, userName: name }));
        await storage.setItem('aaca_username', name);
    };

    const updateUserLanguage = async (language: PreferredLanguage) => {
        setAuth(prev => ({ ...prev, preferredLanguage: language }));
        await storage.setItem('aaca_preferred_language', language);
    };

    return (
        <AuthContext.Provider value={{ auth, login, logout, authFetch, updateUserName, updateUserLanguage }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthProvider;
