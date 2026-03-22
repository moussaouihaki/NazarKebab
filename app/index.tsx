import React from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView, TouchableOpacity, SafeAreaView, Platform, useWindowDimensions } from 'react-native';
import { Theme } from '../constants/theme';
import { PRODUCTS, CATEGORIES } from '../constants/data';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import { useRestaurantStore } from '../store/useRestaurantStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { checkIsRestaurantOpen } from '../store/useRestaurantStore';
import BottomBar from '../components/BottomBar';

const { width } = Dimensions.get('window');

const getCategoryImage = (cat: string) => {
  const prod = PRODUCTS.find(p => p.category === cat);
  if (prod) return prod.image;
  return 'https://images.unsplash.com/photo-1544025162-83b3e64ca658?w=800&q=80';
};

export default function HomeScreen() {
  const cartItems = useCartStore((state) => state.items);
  const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const { products, categories, settings } = useRestaurantStore();
  const unreadCount = useNotificationStore(s => s.unreadCount);

  const populars = products.filter(p => p.highlighted);
  const getCategoryImage = (cat: string) => {
    const prod = products.find(p => p.category === cat);
    if (prod) return getImageSource(prod.image);
    
    // Fallback based on category name
    const key = cat.toLowerCase().includes('kebab') ? 'kebab' : 
                cat.toLowerCase().includes('tacos') ? 'tacos' :
                cat.toLowerCase().includes('pizza') ? 'pizza' : 'kebab';
    return IMAGES_MAP[key];
  };

  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  return (
    <SafeAreaView style={styles.container}>
      {/* MOBILE ONLY HEADER */}
      {!isDesktop && (
        <View style={styles.header}>
          <View style={styles.headerTop}>
             <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/notifications')}>
               <Ionicons name="notifications-outline" size={24} color={Theme.colors.textSecondary} />
               {unreadCount > 0 && (
                 <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>{unreadCount}</Text>
                 </View>
               )}
             </TouchableOpacity>
             <View style={styles.logoWrapper}>
               <Text style={styles.logoNazar}>NAZAR</Text>
               <Text style={styles.logoKebab}>KEBAB</Text>
             </View>
             <TouchableOpacity style={styles.cartButton} onPress={() => router.push('/cart')}>
               <Ionicons name="bag-handle-outline" size={24} color={Theme.colors.text} />
               {cartCount > 0 && (
                 <View style={styles.badge}>
                   <Text style={styles.badgeText}>{cartCount}</Text>
                 </View>
               )}
             </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* EDITORIAL HERO BANNER (Bleed Edge) */}
        <View style={styles.heroContainer}>
           <Image 
             source={{ uri: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200&q=80' }} 
             style={StyleSheet.absoluteFillObject} 
             contentFit="cover" 
           />
           <View style={styles.heroOverlay} />
           <View style={styles.heroContent}>
            <View style={styles.statusRow}>
              <View style={[styles.statusIndicator, { backgroundColor: checkIsRestaurantOpen(settings) ? Theme.colors.success : Theme.colors.danger }]} />
              <Text style={styles.statusText}>{checkIsRestaurantOpen(settings) ? 'ACTUELLEMENT OUVERT' : 'FERMÉ ACTUELLEMENT'}</Text>
            </View>
              <Text style={styles.heroGolden}>DEPUIS 2005</Text>
              <Text style={styles.heroTitle}>L'ART DU KEBAB</Text>
              <TouchableOpacity style={styles.heroBtn} onPress={() => router.push('/menu')} activeOpacity={0.8}>
                 <Text style={styles.heroBtnText}>VOIR LA CARTE</Text>
              </TouchableOpacity>
           </View>
        </View>

        {/* SHARP CATEGORIES (Chic, zero border radius) */}
        <View style={styles.sectionHeader}>
           <Text style={styles.sectionTitle}>NOTRE CARTE</Text>
           <View style={styles.goldLine} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
          {CATEGORIES.map((cat, index) => (
             <TouchableOpacity key={cat} style={styles.categoryCard} onPress={() => router.push({ pathname: '/menu', params: { category: cat } })}>
                <Image 
                  source={typeof getCategoryImage(cat) === 'string' ? { uri: getCategoryImage(cat) } : getCategoryImage(cat)} 
                  style={StyleSheet.absoluteFillObject} 
                  contentFit="cover" 
                />
                <View style={styles.cardOverlay} />
                <View style={styles.cardContent}>
                  <Text style={styles.cardNumber}>0{index + 1}</Text>
                  <Text style={styles.categoryText} numberOfLines={1}>{cat}</Text>
                </View>
             </TouchableOpacity>
          ))}
        </ScrollView>

        {/* FEED: INCONTOURNABLES (Fine Dining Gallery) */}
        <View style={[styles.sectionHeader, { marginTop: 40 }]}>
           <Text style={styles.sectionTitle}>NOS SIGNATURES</Text>
           <View style={styles.goldLine} />
        </View>
        
        <View style={styles.feedWrapper}>
          {populars.map((product) => (
            <TouchableOpacity 
              key={product.id} 
              style={styles.feedCard}
              activeOpacity={0.9}
              onPress={() => router.push({ pathname: '/product/[id]', params: { id: product.id } })}
            >
              <View style={styles.feedImageWrapper}>
                <Image 
                  source={typeof product.image === 'string' ? { uri: product.image } : product.image} 
                  style={styles.feedImage} 
                  contentFit="cover" 
                />
                {/* Gold tag for popular items */}
                <View style={styles.feedTag}>
                   <Text style={styles.feedTagText}>Maison</Text>
                </View>
              </View>
              
              <View style={styles.feedInfo}>
                <View style={styles.feedTitleRow}>
                  <Text style={styles.feedItemTitle}>{product.name}</Text>
                  <Text style={styles.feedPrice}>{product.price.toFixed(2)} CHF</Text>
                </View>
                <Text style={styles.feedDesc} numberOfLines={2}>{product.description || product.category}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        
        {/* PREMIUM FOOTER */}
        <View style={styles.footerInfo}>
          <Text style={styles.logoNazar}>NAZAR</Text>
          <Text style={styles.footerMeta}>GRAND-RUE 9, 2900 PORRENTRUY</Text>
          <Text style={styles.footerMeta}>RESERVATIONS: 032 757 44 44</Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
      <BottomBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: Theme.colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoNazar: {
    fontFamily: Theme.fonts.logo,
    fontSize: 28,
    color: Theme.colors.text,
    letterSpacing: 4,
  },
  logoKebab: { fontFamily: Theme.fonts.bodyBold, fontSize: 10, color: Theme.colors.success, letterSpacing: 4 },
  notifBadge: { 
    position: 'absolute', 
    top: -2, 
    right: -2, 
    backgroundColor: Theme.colors.danger, 
    minWidth: 16, 
    height: 16, 
    borderRadius: 8, 
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Theme.colors.background,
  },
  notifBadgeText: { color: '#fff', fontSize: 7, fontFamily: Theme.fonts.bodyBold },
  iconButton: {
    padding: 8,
  },
  cartButton: {
    padding: 8,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: Theme.colors.success, // Gold badge
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Theme.colors.background,
  },
  badgeText: {
    color: '#000',
    fontSize: 7,
    fontFamily: Theme.fonts.bodyBold,
  },
  heroContainer: {
    width: '100%',
    height: Platform.OS === 'web' ? 400 : 350,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)', // Deep mood
  },
  heroContent: {
    zIndex: 1,
    alignItems: 'center',
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  statusIndicator: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: Theme.fonts.bodyBold, fontSize: 10, color: '#FFF', letterSpacing: 1 },
  heroGolden: {
    fontFamily: Theme.fonts.bodyBold,
    color: Theme.colors.success, 
    fontSize: 13,
    letterSpacing: 4,
    marginBottom: 8,
  },
  heroTitle: {
    fontFamily: Theme.fonts.title,
    color: Theme.colors.text,
    fontSize: 54,
    letterSpacing: 6,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
  },
  heroBtn: {
    marginTop: 30,
    borderWidth: 1.5,
    borderColor: Theme.colors.success,
    backgroundColor: Theme.colors.success + '22', // Slight red transparent background
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 100,
  },
  heroBtnText: {
    fontFamily: Theme.fonts.bodyBold,
    color: Theme.colors.success,
    fontSize: 14,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  sectionHeader: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: Theme.fonts.title,
    color: Theme.colors.text,
    fontSize: 28,
    letterSpacing: 2,
  },
  categoryImgWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Theme.colors.surface,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Theme.colors.border,
  },
  goldLine: {
    width: 30,
    height: 2,
    backgroundColor: Theme.colors.success,
    marginTop: 8,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  categoriesScroll: {
    paddingHorizontal: 16,
    gap: 16,
  },
  categoryCard: {
    width: Platform.OS === 'web' ? 160 : 140,
    height: Platform.OS === 'web' ? 220 : 180,
    backgroundColor: Theme.colors.surface,
    position: 'relative',
    overflow: 'hidden', // Sharp edges! No border radius
    borderRadius: 12,
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  cardContent: {
    ...StyleSheet.absoluteFillObject,
    padding: 16,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
  },
  cardNumber: {
    fontFamily: Theme.fonts.logo,
    fontSize: 24,
    color: Theme.colors.success,
    position: 'absolute',
    top: 12,
    right: 12,
  },
  categoryText: {
    fontFamily: Theme.fonts.title,
    fontSize: 24,
    color: Theme.colors.text,
    letterSpacing: 1,
  },
  feedWrapper: {
    paddingHorizontal: 16,
    gap: 40,
  },
  feedCard: {
    width: '100%',
    alignItems: 'center', // center product info
  },
  feedImageWrapper: {
    width: '100%',
    height: Platform.OS === 'web' ? 300 : 250,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 16,
    backgroundColor: Theme.colors.surface,
    borderRadius: 20,
  },
  feedImage: {
    width: '100%',
    height: '100%',
  },
  feedTag: {
    position: 'absolute',
    bottom: 12,
    left: '50%',
    transform: [{ translateX: -40 }],
    backgroundColor: Theme.colors.background,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Theme.colors.success,
    borderRadius: 100,
    zIndex: 2,
  },
  feedTagText: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 10,
    color: Theme.colors.success,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  feedInfo: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 10,
  },
  feedTitleRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  feedItemTitle: {
    fontFamily: Theme.fonts.title,
    fontSize: 26,
    color: Theme.colors.text,
    letterSpacing: 1,
    textAlign: 'center',
  },
  feedPrice: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 16,
    color: Theme.colors.primary,
    marginTop: 4,
  },
  feedDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: '80%',
  },
  footerInfo: {
    marginTop: 60,
    padding: Theme.spacing.xl,
    backgroundColor: '#020202',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.colors.border,
  },
  footerMeta: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 10,
    color: Theme.colors.textSecondary,
    letterSpacing: 2,
    marginTop: 10,
  },
});
