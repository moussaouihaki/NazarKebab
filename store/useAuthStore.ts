import { create } from 'zustand';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  deleteUser,
  updateProfile as updateFirebaseAuthProfile,
  GoogleAuthProvider,
  signInWithCredential
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export type UserRole = 'client' | 'admin';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  role: UserRole;
  notifOrders: boolean;   // Notif suivi commande
  notifPromos: boolean;   // Notif promos/offres
  createdAt: any;         // Firestore Timestamp or Date
  pushToken?: string;
  loyaltyPoints: number;  // Nouveau : points de fidélité
}

interface AuthState {
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: (idToken: string) => Promise<boolean>;
  register: (data: { firstName: string; lastName: string; email: string; password: string; phone?: string; address?: string }) => Promise<boolean>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<boolean>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  clearError: () => void;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoggedIn: false,
  isLoading: false,
  error: null,

  setUser: (user) => set({ user, isLoggedIn: !!user }),

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const uid = userCredential.user.uid;
      
      const userDoc = await getDoc(doc(db, 'users', uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        set({ user: userData, isLoggedIn: true, isLoading: false });
        return true;
      } else {
        set({ error: 'Données utilisateur introuvables.', isLoading: false });
        return false;
      }
    } catch (err: any) {
      let message = 'Une erreur est survenue lors de la connexion.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        message = 'Email ou mot de passe incorrect.';
      } else if (err.code === 'auth/invalid-email') {
        message = 'Format d\'email invalide.';
      }
      set({ error: message, isLoading: false });
      return false;
    }
  },

  loginWithGoogle: async (idToken: string) => {
    set({ isLoading: true, error: null });
    try {
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      const uid = userCredential.user.uid;
      const firebaseUser = userCredential.user;

      // Vérifier si le document utilisateur existe déjà
      const userDoc = await getDoc(doc(db, 'users', uid));

      if (userDoc.exists()) {
        set({ user: userDoc.data() as User, isLoggedIn: true, isLoading: false });
      } else {
        // Première connexion via Google : créer le profil
        const displayName = firebaseUser.displayName || '';
        const nameParts = displayName.split(' ');
        const newUser: User = {
          id: uid,
          firstName: nameParts[0] || 'Client',
          lastName: nameParts.slice(1).join(' ') || '',
          email: firebaseUser.email || '',
          phone: '',
          address: '',
          role: 'client',
          notifOrders: true,
          notifPromos: true,
          createdAt: new Date(),
          loyaltyPoints: 0,
        };
        await setDoc(doc(db, 'users', uid), newUser);
        set({ user: newUser, isLoggedIn: true, isLoading: false });
      }
      return true;
    } catch (err: any) {
      set({ error: 'Erreur lors de la connexion Google.', isLoading: false });
      return false;
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      // 1. Créer l'utilisateur dans Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, data.email.trim(), data.password);
      const uid = userCredential.user.uid;

      // 2. Mettre à jour le profil nom/prénom dans Auth (optionnel mais recommandé)
      await updateFirebaseAuthProfile(userCredential.user, {
        displayName: `${data.firstName} ${data.lastName}`
      });

      // 3. Créer le document utilisateur complet dans Firestore
      const newUser: User = {
        id: uid,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone || '',
        address: data.address || '',
        role: 'client', // Par défaut
        notifOrders: true,
        notifPromos: true,
        createdAt: new Date(),
        loyaltyPoints: 0,
      };

      await setDoc(doc(db, 'users', uid), newUser);
      
      set({ user: newUser, isLoggedIn: true, isLoading: false });
      return true;
    } catch (err: any) {
      let message = 'Une erreur est survenue lors de l\'inscription.';
      if (err.code === 'auth/email-already-in-use') {
        message = 'Un compte avec cet email existe déjà.';
      } else if (err.code === 'auth/weak-password') {
        message = 'Le mot de passe est trop faible.';
      }
      set({ error: message, isLoading: false });
      return false;
    }
  },

  logout: async () => {
    try {
      await signOut(auth);
      set({ user: null, isLoggedIn: false, error: null });
    } catch (err) {
      console.error('Erreur de déconnexion:', err);
    }
  },

  updateProfile: async (data) => {
    const currentUser = get().user;
    if (!currentUser) return;
    
    try {
      const updated = { ...currentUser, ...data };
      await updateDoc(doc(db, 'users', currentUser.id), updated);
      set({ user: updated });
    } catch (err) {
      console.error('Erreur mise à jour profil:', err);
    }
  },

  deleteAccount: async () => {
    try {
      if (!auth.currentUser) return false;
      const uid = auth.currentUser.uid;
      
      // 1. Delete Firestore user record
      try {
        await deleteDoc(doc(db, 'users', uid));
      } catch (e) {
        console.warn('Erreur lors de la suppression du document user, on continue quand même: ', e);
      }

      // 2. Delete Auth user
      await deleteUser(auth.currentUser);
      
      set({ user: null, isLoggedIn: false, error: null });
      return true;
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        alert('Erreur: Vous devez vous recentifier avant de supprimer votre compte. Veuillez vous déconnecter, vous reconnecter, puis réessayer.');
      } else {
        alert('Erreur lors de la suppression de votre compte.');
        console.error('Delete account error:', err);
      }
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));

