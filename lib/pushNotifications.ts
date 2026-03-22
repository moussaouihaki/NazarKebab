import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';



export async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  // Les notifications push via expo-notifications ne sont pas supportées sur le web par défaut
  if (Platform.OS === 'web') {
    return undefined;
  }

  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FFD700',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Permission refusée pour les notifications push');
      return undefined;
    }

    try {
      // Tente de récupérer le Project ID depuis la config Expo (EAS)
      const projectId = Constants.expoConfig?.extra?.eas?.projectId 
        || Constants.easConfig?.projectId;

      if (projectId) {
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      } else {
        // Fallback sans ID si non configuré (peut échouer sans EAS)
        token = (await Notifications.getExpoPushTokenAsync()).data;
      }
    } catch (e) {
      console.log('Push Token Error: Votre projet n\'est probablement pas encore lié à Expo (EAS).');
    }
  } else {
    console.log('Les notifications push nécessitent un vrai appareil physique.');
  }

  return token;
}

// Fonction utilitaire pour ENVOYER une notification (via l'API d'Expo)
export async function sendPushNotification(expoPushToken: string, title: string, body: string, data = {}) {
  // Sur le web, l'envoi direct à exp.host est bloqué par la politique CORS
  // On utilise notre proxy Vercel situé dans /api/push.js
  const isWeb = Platform.OS === 'web';
  const url = isWeb 
    ? '/api/push' 
    : 'https://exp.host/--/api/v2/push/send';

  const message = {
    to: expoPushToken,
    sound: 'default',
    title: title,
    body: body,
    data: data,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Erreur API Push:', errorData);
    } else if (isWeb) {
      console.log('[Push Notification] Envoyée avec succès via le proxy API ✅');
    }
  } catch (err) {
    console.error('Erreur lors de l\'envoi du Push Notification:', err);
  }
}
