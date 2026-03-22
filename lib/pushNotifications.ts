import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// Configuration pour les notifications locales et distantes
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

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
  // Sur le web, l'envoi direct à exp.host est souvent bloqué par la politique CORS
  // Une solution propre nécessite un proxy backend (Vercel Function ou Cloud Function)
  if (Platform.OS === 'web') {
    console.log('[Push Notification] Envoi simulé (CORS restreint sur web):', { title, body, to: expoPushToken });
    // Optionnel: On peut tenter le fetch mais il échouera probablement sur web sans proxy
    if (process.env.NODE_ENV === 'development') {
       console.log('Note: Sur le web (production), l\'envoi nécessite un backend pour contourner CORS.');
    }
  }

  const message = {
    to: expoPushToken,
    sound: 'default',
    title: title,
    body: body,
    data: data,
  };

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    
    if (!response.ok && Platform.OS !== 'web') {
      const errorData = await response.json();
      console.error('Erreur Expo Push API:', errorData);
    }
  } catch (err) {
    // On ne log l'erreur que si ce n'est pas une erreur de fetch sur web (CORS)
    if (Platform.OS !== 'web') {
      console.error('Erreur lors de l\'envoi du Push Notification:', err);
    } else {
      console.log('Note: L\'envoi du Push a échoué (CORS). C\'est normal sur navigateur web.');
    }
  }
}
