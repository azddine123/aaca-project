import React, { createContext, useContext, useState } from 'react';
import { useColorScheme } from 'react-native';

type Theme = 'dark' | 'light' | 'system';

interface AppearanceContextType {
    theme: Theme;
    setTheme: (t: Theme) => void;
    isDark: boolean;
}

const AppearanceContext = createContext<AppearanceContextType>({
    theme: 'dark', setTheme: () => { }, isDark: true,
});

export const useAppearance = () => useContext(AppearanceContext);

const AppearanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const systemScheme = useColorScheme();
    const [theme, setTheme] = useState<Theme>('dark');
    const isDark = theme === 'system' ? systemScheme === 'dark' : theme === 'dark';

    return (
        <AppearanceContext.Provider value={{ theme, setTheme, isDark }}>
            {children}
        </AppearanceContext.Provider>
    );
};

export default AppearanceProvider;
