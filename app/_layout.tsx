import { Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from '@expo-google-fonts/inter';
import { useEffect } from 'react';
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { Theme } from '../constants/theme';
import DesktopHeader from '../components/DesktopHeader';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuthStore, User } from '../store/useAuthStore';
import { useRestaurantStore } from '../store/useRestaurantStore';
import { useCartStore } from '../store/useCartStore';
import { registerForPushNotificationsAsync } from '../lib/pushNotifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotificationStore } from '../store/useNotificationStore';
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';

// Doit être appelé AVANT tout composant pour que les notifs s'affichent
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

try {
  SplashScreen.preventAutoHideAsync();
} catch (e) {}

export default function RootLayout() {
  const segments = useSegments();
  const hideHeader = segments[0] === 'admin' || segments[0] === 'cart' || segments[0] === 'auth' || segments[0] === 'profile';

  const [loaded, error] = useFonts({
    BebasNeue_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
  });

  const { setUser, user: currentUser } = useAuthStore();
  const { fetchInitialData } = useRestaurantStore();
  const { listenToOrders } = useCartStore();

  useEffect(() => {
    // 1. Écouter les changements d'auth Firebase
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          try {
            const pushToken = await registerForPushNotificationsAsync();
            if (pushToken && pushToken !== userData.pushToken) {
              await updateDoc(doc(db, 'users', firebaseUser.uid), { pushToken });
              userData.pushToken = pushToken;
            }
          } catch(e) {
            console.log('Erreur silencieuse Push Token', e);
          }
          setUser(userData);
        }
      } else {
        setUser(null);
      }
    });

    // 2. Charger les données du restaurant (menu, réglages)
    fetchInitialData();

    // 3. Hydrater les notifications depuis le stockage local
    useNotificationStore.getState().hydrate();

    return () => {
      unsubscribeAuth();
    };
  }, []);

  const activeOrder = useCartStore(state => state.activeOrder);
  const setActiveOrderById = useCartStore(state => state.setActiveOrderById);

  // Manual Persistence Implementation
  useEffect(() => {
    const restoreOrder = async () => {
      try {
        let savedId = null;
        if (Platform.OS === 'web') {
          savedId = localStorage.getItem('last_active_order_id');
        } else {
          savedId = await AsyncStorage.getItem('last_active_order_id');
        }
        if (savedId && !activeOrder) {
          await setActiveOrderById(savedId);
        }
      } catch (e) { console.warn('Manual restore failed', e); }
    };
    if (!currentUser) restoreOrder();
  }, [currentUser, activeOrder, setActiveOrderById]); // Added activeOrder and setActiveOrderById to dependencies

  useEffect(() => {
    const saveOrder = async () => {
      try {
        if (activeOrder?.id) {
          if (Platform.OS === 'web') {
            localStorage.setItem('last_active_order_id', activeOrder.id);
          } else {
            await AsyncStorage.setItem('last_active_order_id', activeOrder.id);
          }
        }
      } catch (e) {}
    };
    saveOrder();
  }, [activeOrder?.id]);

  useEffect(() => {
    let unsubscribeOrders: (() => void) | undefined;
    
    if (currentUser) {
      unsubscribeOrders = listenToOrders(currentUser.id, currentUser.role === 'admin');
    } else if (activeOrder?.id) {
      unsubscribeOrders = listenToOrders(undefined, false, activeOrder.id);
    }

    return () => {
      if (unsubscribeOrders) unsubscribeOrders();
    };
  }, [currentUser, activeOrder?.id, listenToOrders]); // NOW REACTIVE

  useEffect(() => {
    // 1. Listen for notifications arriving while the app is open
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      const { title, body } = notification.request.content;
      if (title && body) {
        useNotificationStore.getState().addNotification(title, body);
      }
    });

    // 2. Listen for users interacting with notifications (tapping them)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      const { title, body } = response.notification.request.content;
      if (title && body) {
        useNotificationStore.getState().addNotification(title, body);
      }
    });

    return () => {
      subscription.remove();
      responseSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (loaded || error) {
      try {
        SplashScreen.hideAsync();
      } catch (e) {
        console.warn('Splash hide error:', e);
      }
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return (
      <View style={styles.loading}>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ 
            fontFamily: 'BebasNeue_400Regular', 
            fontSize: 48, 
            color: Theme.colors.success, // Use Gold
            letterSpacing: 8,
            textAlign: 'center'
          }}>
            NAZAR{"\n"}KEBAB
          </Text>
          <ActivityIndicator color={Theme.colors.success} size="small" style={{ marginTop: 30 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.webWrapper}>
      {!hideHeader && <DesktopHeader />}
      <SafeAreaProvider style={styles.container}>
        <StatusBar style="light" />
        <Stack screenOptions={{ 
          headerShown: false, 
          contentStyle: { backgroundColor: Theme.colors.background } 
        }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="menu" />
          <Stack.Screen 
            name="product/[id]" 
            options={{ 
              presentation: 'modal',
              animation: 'slide_from_bottom' 
            }} 
          />
          <Stack.Screen 
            name="cart" 
            options={{ 
              presentation: 'modal'
            }} 
          />
          <Stack.Screen 
            name="admin" 
            options={{ presentation: 'modal' }} 
          />
          <Stack.Screen 
            name="auth" 
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }} 
          />
          <Stack.Screen 
            name="profile" 
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }} 
          />
          <Stack.Screen name="tracking" />
        </Stack>
      </SafeAreaProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  webWrapper: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: Theme.colors.background,
  },
  loading: {
    flex: 1,
    backgroundColor: '#121212', // Matches splash background
    alignItems: 'center',
    justifyContent: 'center',
  },
});
