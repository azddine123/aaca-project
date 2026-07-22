/**
 * Thin wrapper around react-native-purchases (RevenueCat SDK).
 *
 * react-native-purchases is a native module: it is not supported on web and
 * will crash if loaded in Expo Go (no native code linked). Every export
 * here guards on Platform.OS so the rest of the app (AuthContext, paywall)
 * can call these unconditionally; real testing requires a native build
 * (`npm run ios` / `npm run android`), not `expo start` in Expo Go.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const IOS_API_KEY = Constants.expoConfig?.extra?.revenueCatIosApiKey as string | undefined;
const ANDROID_API_KEY = Constants.expoConfig?.extra?.revenueCatAndroidApiKey as string | undefined;

export const PREMIUM_ENTITLEMENT_ID = 'premium';

function loadSdk() {
    // Required lazily (not at module top-level) so importing this file never
    // triggers native module resolution on unsupported platforms.
    return require('react-native-purchases').default;
}

export async function initPurchases(userId: string): Promise<void> {
    if (Platform.OS === 'web') return;
    const apiKey = Platform.OS === 'ios' ? IOS_API_KEY : ANDROID_API_KEY;
    if (!apiKey) {
        console.warn('RevenueCat API key missing — set extra.revenueCat*ApiKey in app.json');
        return;
    }
    const Purchases = loadSdk();
    await Purchases.configure({ apiKey, appUserID: userId });
}

export async function getCurrentOffering(): Promise<any | null> {
    if (Platform.OS === 'web') return null;
    const Purchases = loadSdk();
    const offerings = await Purchases.getOfferings();
    return offerings.current;
}

export async function purchasePackage(pkg: any): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    const Purchases = loadSdk();
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return !!customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID];
}

export async function restorePurchases(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    const Purchases = loadSdk();
    const customerInfo = await Purchases.restorePurchases();
    return !!customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID];
}
