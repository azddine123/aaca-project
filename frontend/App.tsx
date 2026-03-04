import { registerRootComponent } from 'expo';
import { ExpoRoot } from 'expo-router';
import AppearanceProvider from './app/contexts/AppearanceContext';

export default function App() {
    return (
        <AppearanceProvider>
            <ExpoRoot context={require.context('.')} />
        </AppearanceProvider>
    );
}
registerRootComponent(App);
