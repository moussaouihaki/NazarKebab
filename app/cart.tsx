import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, TextInput, Platform } from 'react-native';
import { router } from 'expo-router';
import { Theme } from '../constants/theme';
import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import { useDeliveryZoneStore, DeliveryZone } from '../store/useDeliveryZoneStore';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { getImageSource } from '../constants/data';
import { useRestaurantStore } from '../store/useRestaurantStore';

type Step = 'cart' | 'info' | 'confirmation';

export default function CartScreen() {
  const { 
    items, total, deliveryFee, deliveryType,
    removeItem, addItem, updateQuantity, removeAllOfItem, clearCart,
    setDeliveryType, setDeliveryFee, setCustomerInfo, setOrderNote, placeOrder,
    customerName, customerPhone, customerAddress, orderNote,
  } = useCartStore();

  const { user, updateProfile } = useAuthStore();
  const { zones, getZoneForAddress, fetchZones } = useDeliveryZoneStore();
  const { settings } = useRestaurantStore();

  useEffect(() => { fetchZones(); }, []);

  // Pre-fill from user profile if fields are empty
  const [name, setName] = useState(customerName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim());
  const [phone, setPhone] = useState(customerPhone || user?.phone || '');
  const [address, setAddress] = useState(customerAddress || user?.address || '');
  const [step, setStep] = useState<Step>('cart');
  const [note, setNote] = useState(orderNote);
  const [placedOrder, setPlacedOrder] = useState<any>(null);
  const [detectedZone, setDetectedZone] = useState<DeliveryZone | null>(null);
  const [zoneError, setZoneError] = useState('');
  const [useLoyalty, setUseLoyalty] = useState(false);

  const checkZone = (currentAddress: string, currentTotal: number, type: string) => {
    if (type === 'delivery' && currentAddress.length > 4) {
      const zone = getZoneForAddress(currentAddress);
      setDetectedZone(zone);
      if (!zone) {
        setZoneError('out_of_zone');
        setDeliveryFee(0);
      } else if (currentTotal < zone.minOrder) {
        setZoneError('min_not_met');
        setDeliveryFee(zone.deliveryFee);
      } else {
        setZoneError('');
        setDeliveryFee(zone.deliveryFee);
      }
    } else {
      setDetectedZone(null);
      setZoneError('');
      setDeliveryFee(0);
    }
  };

  const handleAddressChange = (val: string) => {
    setAddress(val);
    checkZone(val, total, deliveryType);
  };

  // Sync with user profile if address changes and customer has no custom address set
  useEffect(() => {
    if (user?.address && !customerAddress) {
      setAddress(user.address);
    }
  }, [user?.address]);

  // Recalculate zone when address, total, deliveryType or zones list changes
  useEffect(() => {
    checkZone(address, total, deliveryType);
  }, [address, total, deliveryType, zones]);

  const loyaltyDiscount = useLoyalty ? 12.00 : 0; // Prix moyen offert pour un kebab
  const grandTotal = Math.max(0, total + deliveryFee - loyaltyDiscount);

  const handleGoToInfo = () => {
    if (items.length === 0) return;
    // Gate behind auth
    if (!user) {
      router.push('/auth');
      return;
    }
    setStep('info');
  };

  const handlePlaceOrder = async () => {
    setCustomerInfo(name, phone, address);
    setOrderNote(note);
    
    // Déduire les points si consommés
    if (useLoyalty && user) {
      await updateProfile({ loyaltyPoints: (user.loyaltyPoints || 0) - 10 });
    }

    placeOrder(user?.id);
    router.replace('/tracking');
  };

  // STEP 3: ORDER PLACED CONFIRMATION
  if (step === 'confirmation' && placedOrder) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.inner}>
          <View style={styles.confirmationScreen}>
            <View style={styles.confirmationIcon}>
              <Ionicons name="checkmark" size={40} color="#000" />
            </View>
            <Text style={styles.confirmTitle}>COMMANDE ENVOYÉE</Text>
            <Text style={styles.confirmOrderId}>#{placedOrder.id}</Text>
            <Text style={styles.confirmSubtitle}>
              Votre commande a été transmise à Nazar Kebab. Vous recevrez une confirmation dans quelques instants.
            </Text>

            <View style={styles.trackingBox}>
              <TrackingStep icon="time-outline" label="En attente" done={true} active={true} />
              <View style={styles.trackingLine} />
              <TrackingStep icon="flame-outline" label="Préparation" done={false} active={false} />
              <View style={styles.trackingLine} />
              <TrackingStep icon="bag-handle-outline" label="Prête" done={false} active={false} />
              <View style={styles.trackingLine} />
              <TrackingStep icon="checkmark-circle-outline" label="Livrée" done={false} active={false} />
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoCardLabel}>TEMPS ESTIMÉ</Text>
              <Text style={styles.infoCardValue}>{placedOrder.estimatedTime} min</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoCardLabel}>MONTANT TOTAL</Text>
              <Text style={styles.infoCardValue}>{placedOrder.total.toFixed(2)} CHF</Text>
            </View>

            <TouchableOpacity style={styles.goldBtn} onPress={() => {
              router.dismissAll();
              router.replace('/');
            }}>
              <Text style={styles.goldBtnText}>RETOUR À L'ACCUEIL</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // STEP 2: CUSTOMER INFO
  if (step === 'info') {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.inner}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setStep('cart')} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={Theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>VOS INFORMATIONS</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            
            {/* DELIVERY TYPE */}
            <Text style={styles.fieldLabel}>TYPE DE COMMANDE</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity 
                style={[styles.toggleBtn, deliveryType === 'delivery' && styles.toggleBtnActive]}
                onPress={() => setDeliveryType('delivery')}
              >
                <Ionicons name="bicycle-outline" size={18} color={deliveryType === 'delivery' ? '#000' : Theme.colors.textSecondary} />
                <Text style={[styles.toggleText, deliveryType === 'delivery' && styles.toggleTextActive]}>Livraison</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.toggleBtn, deliveryType === 'pickup' && styles.toggleBtnActive]}
                onPress={() => setDeliveryType('pickup')}
              >
                <Ionicons name="walk-outline" size={18} color={deliveryType === 'pickup' ? '#000' : Theme.colors.textSecondary} />
                <Text style={[styles.toggleText, deliveryType === 'pickup' && styles.toggleTextActive]}>À emporter</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>NOM & PRÉNOM</Text>
            <TextInput style={styles.input} placeholder="Ex: Mohammed Ali" placeholderTextColor={Theme.colors.textSecondary} value={name} onChangeText={setName} />
            
            <Text style={styles.fieldLabel}>TÉLÉPHONE</Text>
            <TextInput style={styles.input} placeholder="Ex: 079 123 45 67" placeholderTextColor={Theme.colors.textSecondary} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

            {deliveryType === 'delivery' && (
              <>
                <Text style={styles.fieldLabel}>ADRESSE DE LIVRAISON</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="Ex: Rue du Moulin 5, 2900 Porrentruy" 
                  placeholderTextColor={Theme.colors.textSecondary} 
                  value={address} 
                  onChangeText={handleAddressChange}
                />

                {/* ZONE DETECTED */}
                {detectedZone && zoneError === '' && (
                  <View style={[styles.zoneBanner, { borderColor: Theme.colors.success }]}>
                    <Ionicons name="checkmark-circle" size={16} color={Theme.colors.success} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.zoneText, { color: Theme.colors.success }]}>
                        ✓ {detectedZone.name} — Livraison offerte
                      </Text>
                      <Text style={styles.zoneSubText}>Minimum atteint • ~{detectedZone.estimatedTime} min</Text>
                    </View>
                  </View>
                )}

                {/* MIN NOT MET */}
                {detectedZone && zoneError === 'min_not_met' && (
                  <View style={[styles.zoneBanner, { borderColor: '#FF9800' }]}>
                    <Ionicons name="alert-circle" size={16} color="#FF9800" />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.zoneText, { color: '#FF9800' }]}>
                        {detectedZone.name}
                      </Text>
                      <Text style={styles.zoneSubText}>
                        Minimum de commande : {detectedZone.minOrder} CHF
                        {' '}(il vous manque {(detectedZone.minOrder - total).toFixed(2)} CHF)
                      </Text>
                    </View>
                  </View>
                )}

                {/* OUT OF ZONE */}
                {address.length > 4 && zoneError === 'out_of_zone' && (
                  <View style={[styles.zoneBanner, { borderColor: Theme.colors.danger }]}>
                    <Ionicons name="close-circle" size={16} color={Theme.colors.danger} />
                    <Text style={[styles.zoneText, { color: Theme.colors.danger, flex: 1 }]}>
                      Adresse hors de notre zone de livraison.
                    </Text>
                  </View>
                )}
              </>
            )}

            <Text style={styles.fieldLabel}>NOTE POUR LA CUISINE (facultatif)</Text>
            <TextInput 
              style={[styles.input, { height: 100, textAlignVertical: 'top' }]} 
              placeholder="Ex: Sans oignons sur le kebab..." 
              placeholderTextColor={Theme.colors.textSecondary}
              value={note}
              onChangeText={setNote}
              multiline
            />

            {/* SUMMARY */}
            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Sous-total</Text><Text style={styles.summaryValue}>{total.toFixed(2)} CHF</Text></View>
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Frais de {deliveryType === 'delivery' ? 'livraison' : 'service'}</Text><Text style={styles.summaryValue}>{deliveryFee.toFixed(2)} CHF</Text></View>
              <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: Theme.colors.border, marginTop: 12, paddingTop: 12 }]}>
                <Text style={[styles.summaryLabel, { fontFamily: Theme.fonts.title, fontSize: 18, color: Theme.colors.text }]}>TOTAL</Text>
                <Text style={[styles.summaryValue, { fontFamily: Theme.fonts.title, fontSize: 20, color: Theme.colors.success }]}>{grandTotal.toFixed(2)} CHF</Text>
              </View>
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity 
              style={[styles.goldBtn, ((!name || !phone) || (deliveryType === 'delivery' && zoneError !== '')) && { opacity: 0.5 }]} 
              onPress={handlePlaceOrder} 
              disabled={!name || !phone || (deliveryType === 'delivery' && zoneError !== '')}
            >
              <Text style={styles.goldBtnText}>CONFIRMER LA COMMANDE</Text>
              <Text style={[styles.goldBtnText, { opacity: 0.7, fontSize: 12 }]}>{grandTotal.toFixed(2)} CHF</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // STEP 1: CART
  return (
    <View style={[styles.container, Platform.OS === 'web' && { alignItems: 'center' }]}>
      <SafeAreaView style={[styles.inner, Platform.OS === 'web' && { width: '100%', maxWidth: 640 }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>VOTRE COMMANDE</Text>
          {items.length > 0 && (
            <TouchableOpacity onPress={clearCart} style={styles.backBtn}>
              <Text style={styles.clearText}>Vider</Text>
            </TouchableOpacity>
          )}
          {items.length === 0 && <View style={{ width: 40 }} />}
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyCart}>
            <Ionicons name="bag-handle-outline" size={64} color={Theme.colors.textSecondary} />
            <Text style={styles.emptyTitle}>Votre panier est vide</Text>
            <Text style={styles.emptySubtitle}>Découvrez nos spécialités et commencez votre sélection</Text>
            <TouchableOpacity style={styles.goldBtn} onPress={() => { router.back(); }}>
              <Text style={styles.goldBtnText}>VOIR LA CARTE</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionLabel}>ARTICLES ({items.length})</Text>
              
              {items.map((item) => (
                <View key={item.id} style={styles.cartItem}>
                  <View style={styles.itemImageBox}>
                    <Image 
                      source={getImageSource(item.image)} 
                      style={styles.itemImage} 
                      contentFit="cover" 
                    />
                  </View>
                  
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {item.note && <Text style={{ fontFamily: Theme.fonts.body, fontSize: 10, color: Theme.colors.success, marginTop: 4, fontStyle: 'italic' }}>{item.note}</Text>}
                    <Text style={styles.itemPrice}>{item.price.toFixed(2)} CHF / unité</Text>
                  </View>

                  <View style={styles.qtyControl}>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.id, -1)}>
                      <Ionicons name={item.quantity === 1 ? 'trash-outline' : 'remove'} size={16} color={item.quantity === 1 ? Theme.colors.danger : Theme.colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{item.quantity}</Text>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.id, 1)}>
                      <Ionicons name="add" size={16} color={Theme.colors.text} />
                    </TouchableOpacity>
                  </View>
                  
                  <Text style={styles.itemTotal}>{(item.price * item.quantity).toFixed(2)}</Text>
                </View>
              ))}

              {/* LOYALTY CARD UI */}
              {settings.loyaltyEnabled && user && (
                <View style={styles.loyaltyCard}>
                  <View style={styles.loyaltyHeader}>
                    <Ionicons name="gift-outline" size={20} color={Theme.colors.success} />
                    <Text style={styles.loyaltyTitle}>CARTE DE FIDÉLITÉ</Text>
                    <Text style={styles.loyaltyPointsText}>{user.loyaltyPoints || 0} / 10</Text>
                  </View>
                  
                  <View style={styles.loyaltyGrid}>
                    {[...Array(10)].map((_, i) => (
                      <View key={i} style={[styles.stamp, (user.loyaltyPoints || 0) > i && styles.stampFilled]}>
                        <Ionicons 
                          name={(user.loyaltyPoints || 0) > i ? "checkmark" : "restaurant-outline"} 
                          size={14} 
                          color={(user.loyaltyPoints || 0) > i ? "#000" : Theme.colors.textSecondary} 
                        />
                      </View>
                    ))}
                  </View>

                  {(user.loyaltyPoints || 0) >= 10 && (
                    <TouchableOpacity 
                      style={[styles.useLoyaltyBtn, useLoyalty && styles.useLoyaltyBtnActive]}
                      onPress={() => setUseLoyalty(!useLoyalty)}
                    >
                      <Ionicons name={useLoyalty ? "checkmark-circle" : "add-circle-outline"} size={20} color={useLoyalty ? "#000" : Theme.colors.success} />
                      <Text style={[styles.useLoyaltyText, useLoyalty && styles.useLoyaltyTextActive]}>
                        {useLoyalty ? "Kebab Gratuit Appliqué ! ✅" : "Utiliser mon Kebab Gratuit 🎁"}
                      </Text>
                    </TouchableOpacity>
                  )}
                  
                  {(user.loyaltyPoints || 0) < 10 && (
                   <Text style={styles.loyaltySubtext}>
                     Encore {10 - (user.loyaltyPoints || 0)} commande(s) pour votre prochain cadeau !
                   </Text>
                  )}
                </View>
              )}

              <View style={styles.summaryBox}>
                <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Sous-total</Text><Text style={styles.summaryValue}>{total.toFixed(2)} CHF</Text></View>
                {deliveryType === 'delivery' && deliveryFee > 0 && (
                  <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Frais de livraison</Text><Text style={styles.summaryValue}>{deliveryFee.toFixed(2)} CHF</Text></View>
                )}
                {useLoyalty && (
                   <View style={styles.summaryRow}>
                     <Text style={[styles.summaryLabel, { color: Theme.colors.success }]}>Remise Fidélité</Text>
                     <Text style={[styles.summaryValue, { color: Theme.colors.success }]}>-12.00 CHF</Text>
                   </View>
                )}
                <View style={[styles.summaryRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Theme.colors.border, marginTop: 12, paddingTop: 12 }]}>
                  <Text style={[styles.summaryLabel, { fontFamily: Theme.fonts.title, fontSize: 20, color: Theme.colors.text }]}>TOTAL</Text>
                  <Text style={[styles.summaryValue, { fontFamily: Theme.fonts.title, fontSize: 22, color: Theme.colors.success }]}>{grandTotal.toFixed(2)} CHF</Text>
                </View>
              </View>

              <View style={{ height: 100 }} />
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity style={styles.goldBtn} onPress={handleGoToInfo}>
                <Text style={styles.goldBtnText}>CONTINUER MA COMMANDE</Text>
                <Text style={[styles.goldBtnText, { opacity: 0.7, fontSize: 12 }]}>{grandTotal.toFixed(2)} CHF</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

function TrackingStep({ icon, label, done, active }: { icon: string, label: string, done: boolean, active: boolean }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={[trackStyles.circle, done && trackStyles.circleDone]}>
        <Ionicons name={icon as any} size={16} color={done ? '#000' : Theme.colors.textSecondary} />
      </View>
      <Text style={[trackStyles.label, active && trackStyles.labelActive]}>{label}</Text>
    </View>
  );
}

const trackStyles = StyleSheet.create({
  circle: { width: 36, height: 36, borderRadius: 18, backgroundColor: Theme.colors.surface, borderWidth: 1, borderColor: Theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  circleDone: { backgroundColor: Theme.colors.success, borderColor: Theme.colors.success },
  label: { fontFamily: Theme.fonts.body, fontSize: 10, color: Theme.colors.textSecondary, marginTop: 4 },
  labelActive: { color: Theme.colors.success, fontFamily: Theme.fonts.bodyMedium },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  inner: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Theme.colors.border },
  headerTitle: { fontFamily: Theme.fonts.logo, fontSize: 20, color: Theme.colors.text, letterSpacing: 4 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  clearText: { fontFamily: Theme.fonts.bodyMedium, fontSize: 13, color: Theme.colors.danger },
  emptyCart: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 16 },
  emptyTitle: { fontFamily: Theme.fonts.title, fontSize: 28, color: Theme.colors.text, letterSpacing: 2 },
  emptySubtitle: { fontFamily: Theme.fonts.body, fontSize: 14, color: Theme.colors.textSecondary, textAlign: 'center' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  sectionLabel: { fontFamily: Theme.fonts.bodyMedium, fontSize: 11, color: Theme.colors.textSecondary, letterSpacing: 2, marginBottom: 16 },
  cartItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12, backgroundColor: Theme.colors.surface, borderRadius: 16, padding: 12, marginBottom: 10 },
  itemImageBox: { width: 66, height: 66, backgroundColor: Theme.colors.background, overflow: 'hidden', borderRadius: 12 },
  itemImage: { width: '100%', height: '100%' },
  itemInfo: { flex: 1 },
  itemName: { fontFamily: Theme.fonts.title, fontSize: 18, color: Theme.colors.text, marginBottom: 4 },
  itemPrice: { fontFamily: Theme.fonts.body, fontSize: 12, color: Theme.colors.textSecondary },
  qtyControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: Theme.colors.background, gap: 4, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 100 },
  qtyBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontFamily: Theme.fonts.bodyBold, fontSize: 14, color: Theme.colors.text, minWidth: 20, textAlign: 'center' },
  itemTotal: { fontFamily: Theme.fonts.title, fontSize: 16, color: Theme.colors.primary, minWidth: 50, textAlign: 'right' },
  summaryBox: { marginTop: 30, paddingTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Theme.colors.border },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { fontFamily: Theme.fonts.body, fontSize: 14, color: Theme.colors.textSecondary },
  summaryValue: { fontFamily: Theme.fonts.bodyMedium, fontSize: 14, color: Theme.colors.text },
  footer: { padding: 16, paddingBottom: Platform.OS === 'ios' ? 30 : 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Theme.colors.border, backgroundColor: Theme.colors.background },
  goldBtn: { backgroundColor: Theme.colors.success, paddingVertical: 18, paddingHorizontal: 24, borderRadius: 100, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: Theme.colors.success, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 8 },
  goldBtnText: { fontFamily: Theme.fonts.bodyBold, fontSize: 16, color: '#000', letterSpacing: 0.5 },
  fieldLabel: { fontFamily: Theme.fonts.bodyMedium, fontSize: 10, color: Theme.colors.textSecondary, letterSpacing: 2, marginBottom: 8, marginTop: 20 },
  input: { backgroundColor: Theme.colors.surface, padding: 16, fontFamily: Theme.fonts.body, fontSize: 14, color: Theme.colors.text, borderWidth: StyleSheet.hairlineWidth, borderColor: Theme.colors.border, borderRadius: 12 },
  toggleRow: { flexDirection: 'row', gap: 12 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, backgroundColor: Theme.colors.surface, borderWidth: 1, borderColor: Theme.colors.border, borderRadius: 12 },
  toggleBtnActive: { backgroundColor: Theme.colors.success, borderColor: Theme.colors.success },
  toggleText: { fontFamily: Theme.fonts.bodyMedium, fontSize: 14, color: Theme.colors.textSecondary },
  toggleTextActive: { color: '#000' },
  // Confirmation
  confirmationScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 },
  confirmationIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: Theme.colors.success, alignItems: 'center', justifyContent: 'center', shadowColor: Theme.colors.success, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 10 },
  confirmTitle: { fontFamily: Theme.fonts.logo, fontSize: 30, color: Theme.colors.text, letterSpacing: 4, textAlign: 'center' },
  confirmOrderId: { fontFamily: Theme.fonts.bodyMedium, fontSize: 14, color: Theme.colors.success, letterSpacing: 2 },
  confirmSubtitle: { fontFamily: Theme.fonts.body, fontSize: 14, color: Theme.colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  trackingBox: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center', marginVertical: 8 },
  trackingLine: { flex: 1, height: 1, backgroundColor: Theme.colors.border },
  infoCard: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Theme.colors.border, paddingVertical: 12 },
  infoCardLabel: { fontFamily: Theme.fonts.bodyMedium, fontSize: 11, color: Theme.colors.textSecondary, letterSpacing: 2 },
  infoCardValue: { fontFamily: Theme.fonts.title, fontSize: 18, color: Theme.colors.text },
  // Zone delivery feedback
  zoneBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 10, padding: 12, borderRadius: 10, borderWidth: 1, backgroundColor: Theme.colors.surface },
  zoneText: { fontFamily: Theme.fonts.bodyMedium, fontSize: 13, marginBottom: 2 },
  zoneSubText: { fontFamily: Theme.fonts.body, fontSize: 12, color: Theme.colors.textSecondary },
  // Loyalty styles
  loyaltyCard: { backgroundColor: '#1A1A1A', padding: 20, borderRadius: 20, borderStyle: 'dotted', borderWidth: 2, borderColor: '#333', marginTop: 20 },
  loyaltyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 10 },
  loyaltyTitle: { fontFamily: Theme.fonts.title, color: Theme.colors.text, fontSize: 16, letterSpacing: 2, flex: 1 },
  loyaltyPointsText: { fontFamily: Theme.fonts.bodyBold, color: Theme.colors.success, fontSize: 12 },
  loyaltyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15, justifyContent: 'center' },
  stamp: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#444', alignItems: 'center', justifyContent: 'center' },
  stampFilled: { backgroundColor: Theme.colors.success, borderColor: Theme.colors.success },
  loyaltySubtext: { fontFamily: Theme.fonts.body, fontSize: 11, color: Theme.colors.textSecondary, textAlign: 'center' , fontStyle: 'italic'},
  useLoyaltyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 12, backgroundColor: Theme.colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Theme.colors.success },
  useLoyaltyBtnActive: { backgroundColor: Theme.colors.success },
  useLoyaltyText: { fontFamily: Theme.fonts.bodyBold, color: Theme.colors.success, fontSize: 13 },
  useLoyaltyTextActive: { color: '#000' },
});
