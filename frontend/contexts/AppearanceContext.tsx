import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DARK_COLORS, LIGHT_COLORS, GRADIENTS, LIGHT_GRADIENTS, type AppColors } from '@/theme';

export type Theme = 'dark' | 'light' | 'system';

interface AppearanceContextType {
    theme: Theme;
    setTheme: (t: Theme) => void;
    isDark: boolean;
}

const AppearanceContext = createContext<AppearanceContextType>({
    theme: 'dark',
    setTheme: () => {},
    isDark: true,
});

export const useAppearance = () => useContext(AppearanceContext);

/** Returns the color palette matching the current theme. */
export function useAppColors(): AppColors {
    const { isDark } = useContext(AppearanceContext);
    return isDark ? DARK_COLORS : LIGHT_COLORS;
}

/** Returns the gradient set matching the current theme. */
export function useAppGradients() {
    const { isDark } = useContext(AppearanceContext);
    return isDark ? GRADIENTS : LIGHT_GRADIENTS;
}

const STORAGE_KEY = '@aaca_theme';

const AppearanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const systemScheme = useColorScheme();
    const [theme, setThemeState] = useState<Theme>('dark');
    const [loaded, setLoaded] = useState(false);

    // Load persisted theme on mount
    useEffect(() => {
        AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
            if (saved === 'dark' || saved === 'light' || saved === 'system') {
                setThemeState(saved);
            }
            setLoaded(true);
        }).catch(() => setLoaded(true));
    }, []);

    const setTheme = (t: Theme) => {
        setThemeState(t);
        AsyncStorage.setItem(STORAGE_KEY, t).catch(() => {});
    };

    const isDark = theme === 'system' ? systemScheme === 'dark' : theme === 'dark';

    if (!loaded) return null;

    return (
        <AppearanceContext.Provider value={{ theme, setTheme, isDark }}>
            {children}
        </AppearanceContext.Provider>
    );
};

export default AppearanceProvider;
