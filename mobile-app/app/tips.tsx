import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, RefreshControl, Dimensions,
  Modal, Animated, Linking, Share, Platform, TextInput
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AppLoader from '../components/AppLoader';

const { width, height } = Dimensions.get('window');

// Safety tips data
const safetyCategories = [
  { id: 'all', name: 'All Tips', icon: 'apps-outline' },
  { id: 'fire', name: 'Fire Safety', icon: 'flame-outline' },
  { id: 'medical', name: 'Medical', icon: 'medkit-outline' },
  { id: 'accident', name: 'Accident', icon: 'car-outline' },
  { id: 'crime', name: 'Crime', icon: 'shield-outline' },
  { id: 'natural', name: 'Natural', icon: 'thunderstorm-outline' },
];

const safetyTips = [
  {
    id: 1,
    title: 'How to Report an Emergency',
    description: 'Learn the proper way to report emergencies through SafeCity+ for fastest response.',
    content: '1. Open the app and tap the SOS button\n2. Take a clear photo or video of the incident\n3. Provide accurate location details\n4. Write a brief description\n5. Submit and wait for confirmation\n\nRemember: The more details you provide, the faster emergency services can respond.',
    category: 'all',
    icon: 'alert-circle',
    color: '#E63939',
    steps: 5,
    urgency: 'High',
    image: 'https://images.unsplash.com/photo-1582139329536-e7284fece509?w=400',
  },
  {
    id: 2,
    title: 'Fire Emergency Protocol',
    description: 'Essential steps to take during a fire emergency.',
    content: '• Stay calm and alert others\n• Call emergency services immediately\n• If safe, use fire extinguisher\n• Evacuate using stairs, never elevators\n• Crawl low under smoke\n• Feel doors for heat before opening\n• Meet at designated assembly point',
    category: 'fire',
    icon: 'flame',
    color: '#f97316',
    steps: 7,
    urgency: 'Critical',
    image: 'https://images.unsplash.com/photo-1582139329536-e7284fece509?w=400',
  },
  {
    id: 3,
    title: 'First Aid - CPR',
    description: 'Learn how to perform CPR correctly in cardiac emergencies.',
    content: '1. Check responsiveness\n2. Call for help immediately\n3. Open airway (head tilt, chin lift)\n4. Check breathing for 10 seconds\n5. Start chest compressions (100-120/min)\n6. Give 2 rescue breaths\n7. Continue until help arrives',
    category: 'medical',
    icon: 'heart',
    color: '#ef4444',
    steps: 7,
    urgency: 'Critical',
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400',
  },
  {
    id: 4,
    title: 'Car Accident Response',
    description: 'What to do immediately after a car accident.',
    content: '• Check for injuries\n• Move to safe location if possible\n• Turn on hazard lights\n• Call police and ambulance\n• Exchange information with others\n• Take photos of damage\n• Report to insurance',
    category: 'accident',
    icon: 'car',
    color: '#3b82f6',
    steps: 7,
    urgency: 'High',
    image: 'https://images.unsplash.com/photo-1546706374-eb7bdfd1a857?w=400',
  },
  {
    id: 5,
    title: 'Crime Prevention Tips',
    description: 'Stay safe with these essential crime prevention tips.',
    content: '• Be aware of your surroundings\n• Avoid walking alone at night\n• Keep valuables out of sight\n• Lock doors and windows\n• Use well-lit routes\n• Trust your instincts\n• Report suspicious activity',
    category: 'crime',
    icon: 'shield',
    color: '#8b5cf6',
    steps: 7,
    urgency: 'Medium',
    image: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=400',
  },
  {
    id: 6,
    title: 'Earthquake Safety',
    description: 'Protect yourself during an earthquake.',
    content: 'DROP: Drop to your hands and knees\nCOVER: Cover your head and neck\nHOLD ON: Hold on until shaking stops\n\nAfter shaking:\n• Check for injuries\n• Expect aftershocks\n• Evacuate if necessary\n• Listen to official updates',
    category: 'natural',
    icon: 'earth',
    color: '#10b981',
    steps: 3,
    urgency: 'High',
    image: 'https://images.unsplash.com/photo-1535398089889-dd807df1df69?w=400',
  },
  {
    id: 7,
    title: 'Medical Emergency Kit',
    description: 'Essential items for your home first aid kit.',
    content: '✓ Adhesive bandages (various sizes)\n✓ Sterile gauze pads\n✓ Medical tape\n✓ Antiseptic wipes\n✓ Scissors and tweezers\n✓ Disposable gloves\n✓ Pain relievers\n✓ Thermometer\n✓ Emergency blanket',
    category: 'medical',
    icon: 'medkit',
    color: '#ef4444',
    steps: 9,
    urgency: 'Low',
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400',
  },
  {
    id: 8,
    title: 'Roadside Emergency',
    description: 'What to do when your vehicle breaks down.',
    content: '• Pull over to safe location\n• Turn on hazard lights\n• Stay inside vehicle if on highway\n• Call for assistance\n• Use reflective triangles\n• Keep emergency supplies\n• Wait for help to arrive',
    category: 'accident',
    icon: 'car',
    color: '#3b82f6',
    steps: 7,
    urgency: 'Medium',
    image: 'https://images.unsplash.com/photo-1546706374-eb7bdfd1a857?w=400',
  },
];

export default function TipsScreen() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTip, setSelectedTip] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    setTimeout(() => setLoading(false), 800);

    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  };

  const getFilteredTips = () => {
    let filtered = safetyTips;
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(tip => tip.category === selectedCategory);
    }
    
    if (searchQuery) {
      filtered = filtered.filter(tip => 
        tip.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tip.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return filtered;
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'Critical': return '#E63939';
      case 'High': return '#f97316';
      case 'Medium': return '#f59e0b';
      case 'Low': return '#10b981';
      default: return '#64748b';
    }
  };

  const handleShare = async (tip: any) => {
    try {
      await Share.share({
        message: `Safety Tip: ${tip.title}\n\n${tip.content}\n\nShared from SafeCity+ App`,
        title: tip.title,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const TipCard = ({ tip }: { tip: any }) => (
    <TouchableOpacity
      style={styles.tipCard}
      onPress={() => {
        setSelectedTip(tip);
        setModalVisible(true);
      }}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={[`${tip.color}20`, `${tip.color}05`]}
        style={styles.tipGradient}
      >
        <View style={styles.tipHeader}>
          <View style={[styles.tipIcon, { backgroundColor: `${tip.color}20` }]}>
            <Ionicons name={tip.icon as any} size={24} color={tip.color} />
          </View>
          <View style={[styles.urgencyBadge, { backgroundColor: `${getUrgencyColor(tip.urgency)}20` }]}>
            <Text style={[styles.urgencyText, { color: getUrgencyColor(tip.urgency) }]}>
              {tip.urgency}
            </Text>
          </View>
        </View>
        
        <Text style={styles.tipTitle}>{tip.title}</Text>
        <Text style={styles.tipDescription} numberOfLines={2}>
          {tip.description}
        </Text>
        
        <View style={styles.tipFooter}>
          <View style={styles.tipStats}>
            <Ionicons name="steps-outline" size={14} color="#64748b" />
            <Text style={styles.tipStatsText}>{tip.steps} steps</Text>
          </View>
          <TouchableOpacity 
            style={styles.readMoreButton}
            onPress={() => {
              setSelectedTip(tip);
              setModalVisible(true);
            }}
          >
            <Text style={styles.readMoreText}>Read More</Text>
            <Ionicons name="arrow-forward" size={14} color="#E63939" />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const CategoryButton = ({ category }: { category: any }) => (
    <TouchableOpacity
      style={[
        styles.categoryButton,
        selectedCategory === category.id && styles.categoryButtonActive,
      ]}
      onPress={() => setSelectedCategory(category.id)}
    >
      <Ionicons
        name={category.icon as any}
        size={18}
        color={selectedCategory === category.id ? '#E63939' : '#94a3b8'}
      />
      <Text
        style={[
          styles.categoryText,
          selectedCategory === category.id && styles.categoryTextActive,
        ]}
      >
        {category.name}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <AppLoader message="Loading safety tips..." />
    );
  }

  const filteredTips = getFilteredTips();

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Safety Tips</Text>
          <Text style={styles.subtitle}>Stay informed, stay safe</Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#64748b" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search tips..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>

        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesScroll}
          contentContainerStyle={styles.categoriesContainer}
        >
          {safetyCategories.map((category) => (
            <CategoryButton key={category.id} category={category} />
          ))}
        </ScrollView>

        {/* Tips Count */}
        <View style={styles.countContainer}>
          <Text style={styles.countText}>
            {filteredTips.length} {filteredTips.length === 1 ? 'Tip' : 'Tips'} Available
          </Text>
        </View>

        {/* Tips Grid */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.tipsContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E63939" />
          }
        >
          {filteredTips.map((tip) => (
            <TipCard key={tip.id} tip={tip} />
          ))}
          
          {filteredTips.length === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons name="bulb-outline" size={60} color="#334155" />
              <Text style={styles.emptyText}>No tips found</Text>
              <Text style={styles.emptySubtext}>Try a different category or search term</Text>
            </View>
          )}
        </ScrollView>

        {/* Tip Detail Modal */}
        <Modal
          animationType="slide"
          transparent={false}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          {selectedTip && (
            <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalClose}>
                  <Ionicons name="arrow-back" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Safety Tip</Text>
                <TouchableOpacity onPress={() => handleShare(selectedTip)} style={styles.modalShare}>
                  <Ionicons name="share-outline" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}>
                <View style={[styles.modalIcon, { backgroundColor: `${selectedTip.color}20` }]}>
                  <Ionicons name={selectedTip.icon} size={48} color={selectedTip.color} />
                </View>
                
                <Text style={styles.modalTipTitle}>{selectedTip.title}</Text>
                
                <View style={styles.modalBadgeContainer}>
                  <View style={[styles.modalUrgencyBadge, { backgroundColor: `${getUrgencyColor(selectedTip.urgency)}20` }]}>
                    <Text style={[styles.modalUrgencyText, { color: getUrgencyColor(selectedTip.urgency) }]}>
                      {selectedTip.urgency} Priority
                    </Text>
                  </View>
                  <View style={styles.modalStepsBadge}>
                    <Ionicons name="steps-outline" size={14} color="#94a3b8" />
                    <Text style={styles.modalStepsText}>{selectedTip.steps} Steps</Text>
                  </View>
                </View>

                <Text style={styles.modalDescription}>{selectedTip.description}</Text>
                
                <View style={styles.divider} />
                
                <Text style={styles.modalContentTitle}>Detailed Instructions:</Text>
                <Text style={styles.modalContentText}>{selectedTip.content}</Text>

                <TouchableOpacity
                  style={styles.emergencyButton}
                  onPress={() => {
                    setModalVisible(false);
                    router.push('/camera');
                  }}
                >
                  <LinearGradient colors={['#E63939', '#b91c1c']} style={styles.emergencyGradient}>
                    <Ionicons name="alert-circle" size={20} color="#fff" />
                    <Text style={styles.emergencyButtonText}>Report Emergency</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
            </LinearGradient>
          )}
        </Modal>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', marginTop: 10, fontSize: 14 },

  // Header
  header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 20 },
  title: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  subtitle: { color: '#94a3b8', fontSize: 14, marginTop: 4 },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingVertical: 12,
    marginLeft: 8,
  },

  // Categories
  categoriesScroll: { maxHeight: 50 },
  categoriesContainer: { paddingHorizontal: 20, gap: 10, paddingBottom: 10 },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  categoryButtonActive: { borderColor: '#E63939', backgroundColor: 'rgba(230, 57, 57, 0.1)' },
  categoryText: { color: '#94a3b8', fontSize: 13, fontWeight: '500' },
  categoryTextActive: { color: '#E63939' },

  // Count
  countContainer: { paddingHorizontal: 20, marginTop: 16, marginBottom: 12 },
  countText: { color: '#64748b', fontSize: 12 },

  // Tips Grid
  tipsContainer: { padding: 16, paddingBottom: 100 },
  tipCard: { marginBottom: 16 },
  tipGradient: { borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#334155' },
  tipHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  tipIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  urgencyBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  urgencyText: { fontSize: 10, fontWeight: 'bold' },
  tipTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  tipDescription: { color: '#94a3b8', fontSize: 13, lineHeight: 18, marginBottom: 12 },
  tipFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  tipStats: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tipStatsText: { color: '#64748b', fontSize: 11 },
  readMoreButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  readMoreText: { color: '#E63939', fontSize: 12, fontWeight: '500' },

  // Empty State
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { color: '#64748b', fontSize: 16, marginTop: 16 },
  emptySubtext: { color: '#475569', fontSize: 12, marginTop: 8 },

  // Modal
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
  },
  modalClose: { padding: 5 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  modalShare: { padding: 5 },
  modalContent: { padding: 20, paddingBottom: 40 },
  modalIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 20 },
  modalTipTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
  modalBadgeContainer: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 20 },
  modalUrgencyBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  modalUrgencyText: { fontSize: 12, fontWeight: 'bold' },
  modalStepsBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1e293b', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  modalStepsText: { color: '#94a3b8', fontSize: 12 },
  modalDescription: { color: '#94a3b8', fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  divider: { height: 1, backgroundColor: '#334155', marginVertical: 20 },
  modalContentTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  modalContentText: { color: '#94a3b8', fontSize: 14, lineHeight: 22 },
  emergencyButton: { marginTop: 30, borderRadius: 12, overflow: 'hidden' },
  emergencyGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, gap: 8 },
  emergencyButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});