/**
 * Authentication Context
 * 
 * Manages user authentication state and provides login/logout functionality.
 * Uses SecureStore for native platforms and localStorage for web.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
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
interface AuthState {
    token: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
    userName: string | null;
    userEmail: string | null;
    loading: boolean;
    error: string | null;
}

interface AuthContextType {
    auth: AuthState;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
}

// Context
const AuthContext = createContext<AuthContextType>({
    auth: {
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        userName: null,
        userEmail: null,
        loading: true,
        error: null
    },
    login: async () => {},
    logout: async () => {},
    authFetch: async (input, init) => fetch(input, init),
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
                const refreshToken = await storage.getItem('aaca_refresh_token');
                
                if (token) {
                    setAuth({ 
                        token, 
                        refreshToken, 
                        isAuthenticated: true, 
                        userName, 
                        userEmail, 
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
                loading: false,
                error: null,
            };
            
            setAuth(newAuth);
            await storage.setItem('aaca_token', data.access_token);
            await storage.setItem('aaca_username', newAuth.userName || '');
            await storage.setItem('aaca_email', newAuth.userEmail || '');
            if (data.refresh_token) {
                await storage.setItem('aaca_refresh_token', data.refresh_token);
            }
        } catch (err: any) {
            setAuth(prev => ({ 
                ...prev, 
                loading: false, 
                error: err.message, 
                isAuthenticated: false 
            }));
            throw err;
        }
    };

    // Wrapper fetch qui déconnecte automatiquement sur 401
    const authFetch = async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
        const res = await fetch(input, init);
        if (res.status === 401) {
            await logout();
        }
        return res;
    };

    const logout = async () => {
        await storage.deleteItem('aaca_token');
        await storage.deleteItem('aaca_username');
        await storage.deleteItem('aaca_email');
        await storage.deleteItem('aaca_refresh_token');
        
        setAuth({ 
            token: null, 
            refreshToken: null, 
            isAuthenticated: false, 
            userName: null, 
            userEmail: null, 
            loading: false, 
            error: null 
        });
    };

    return (
        <AuthContext.Provider value={{ auth, login, logout, authFetch }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthProvider;
