import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions,
  Modal, Animated, Platform, Alert, StatusBar,
} from 'react-native';
import AppLoader from '../components/AppLoader';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;
const API_URL = 'http://10.161.68.44:5000';

interface Camera {
  id: number;
  camera_name: string;
  location_name: string;
  stream_url: string;
  status: string;
  resolution: string;
  is_recording: boolean;
  last_active: string;
  recording_count: number;
}

// ─── Status helpers ──────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  active: '#10b981',
  maintenance: '#f59e0b',
  inactive: '#ef4444',
};
const getStatusColor = (s: string) => STATUS_COLOR[s] ?? '#64748b';
const getStatusText = (s: string) =>
  ({ active: 'ACTIVE', maintenance: 'MAINT.', inactive: 'OFFLINE' }[s] ?? s.toUpperCase());

const formatTime = (d: string) => {
  if (!d) return 'Never';
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
};
const formatDuration = (s: number) =>
  `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

// ─── Sub-components ────────────────────────────────────────────────────────────

const PulsingDot = ({ color, size = 8 }: { color: string; size?: number }) => {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.5, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, transform: [{ scale: pulse }] }} />
  );
};

const StatPill = ({ icon, label, value, color }: { icon: string; label: string; value: string | number; color: string }) => (
  <View style={s.statPill}>
    <Ionicons name={icon as any} size={14} color={color} />
    <View>
      <Text style={[s.statPillValue, { color }]}>{value}</Text>
      <Text style={s.statPillLabel}>{label}</Text>
    </View>
  </View>
);

// ─── Main Component ────────────────────────────────────────────────────────────

export default function CCTVScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [cameras, setCameras]         = useState<Camera[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [modalVisible, setModalVisible]     = useState(false);
  const [viewMode, setViewMode]       = useState<'grid' | 'list'>('grid');
  const [filterTab, setFilterTab]     = useState<'all' | 'active' | 'live' | 'offline'>('all');
  const [alerts, setAlerts]           = useState<any[]>([]);
  const [showAlerts, setShowAlerts]   = useState(false);
  const [recordings, setRecordings]   = useState<any[]>([]);
  const [modalTab, setModalTab]       = useState<'feed' | 'info' | 'recordings'>('feed');
  const [liveStreams, setLiveStreams]  = useState<any[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(true);
  const videoRef = useRef<any>(null);

  const fadeAnim  = useRef(new Animated.Value(0)).current;

  // ── Data fetching ────────────────────────────────────────────────────────
  const fetchCameras = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/api/cctv/cameras`);
      const d = await r.json();
      setCameras(Array.isArray(d) ? d : []);
    } catch { } finally { setLoading(false); setRefreshing(false); }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/api/cctv/alerts`);
      const d = await r.json();
      setAlerts(Array.isArray(d) ? d : []);
    } catch { }
  }, []);

  const fetchLiveStreams = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/api/streams`);
      const d = await r.json();
      setLiveStreams(Array.isArray(d) ? d : []);
    } catch { }
  }, []);

  const fetchRecordings = async (cameraId: number) => {
    try {
      const r = await fetch(`${API_URL}/api/cctv/cameras/${cameraId}/recordings`);
      const d = await r.json();
      setRecordings(Array.isArray(d) ? d : []);
    } catch { }
  };

  useEffect(() => {
    fetchCameras(); fetchAlerts(); fetchLiveStreams();
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    const iv = setInterval(() => { fetchCameras(); fetchAlerts(); fetchLiveStreams(); }, 10000);
    return () => clearInterval(iv);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchCameras(), fetchAlerts(), fetchLiveStreams()]);
  };

  const openCamera = (cam: Camera) => {
    setSelectedCamera(cam);
    setModalTab('feed');
    setVideoPlaying(true);
    setIsFullscreen(false);
    setModalVisible(true);
    fetchRecordings(cam.id);
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  const isLiveCamera = (cam: Camera) => liveStreams.some(s => s.cameraName === cam.camera_name);

  const filteredCameras = cameras.filter(cam => {
    if (filterTab === 'all')     return true;
    if (filterTab === 'live')    return isLiveCamera(cam);
    if (filterTab === 'active')  return cam.status === 'active';
    if (filterTab === 'offline') return cam.status === 'inactive';
    return true;
  });

  const unreadAlerts   = alerts.filter(a => !a.is_viewed).length;
  const activeLive     = liveStreams.length;
  const activeCount    = cameras.filter(c => c.status === 'active').length;
  const offlineCount   = cameras.filter(c => c.status === 'inactive').length;

  // ── Camera Card (grid) ─────────────────────────────────────────────────────
  const GridCard = ({ camera }: { camera: Camera }) => {
    const live = isLiveCamera(camera);
    const color = live ? '#E63939' : getStatusColor(camera.status);
    return (
      <TouchableOpacity style={s.gridCard} onPress={() => openCamera(camera)} activeOpacity={0.85}>
        {/* Thumbnail */}
        <LinearGradient colors={['#0f172a', '#1e293b']} style={s.thumb}>
          <Ionicons name="videocam" size={32} color="rgba(255,255,255,0.25)" />
          {/* Scanline overlay */}
          <View style={s.scanlines} pointerEvents="none" />
          {/* Status badge */}
          <View style={[s.thumbBadge, { backgroundColor: color + '22', borderColor: color + '66' }]}>
            {live || camera.status === 'active'
              ? <PulsingDot color={color} size={6} />
              : <View style={[s.dot6, { backgroundColor: color }]} />}
            <Text style={[s.thumbBadgeText, { color }]}>{live ? 'LIVE' : getStatusText(camera.status)}</Text>
          </View>
          {camera.is_recording && (
            <View style={s.recBadge}>
              <View style={s.dot6r} />
              <Text style={s.recText}>REC</Text>
            </View>
          )}
          {/* Play overlay */}
          {camera.status === 'active' && (
            <View style={s.playOverlay}>
              <Ionicons name="play-circle" size={36} color="rgba(255,255,255,0.7)" />
            </View>
          )}
        </LinearGradient>
        {/* Info */}
        <View style={s.gridInfo}>
          <Text style={s.gridName} numberOfLines={1}>{camera.camera_name}</Text>
          <View style={s.gridLocRow}>
            <Ionicons name="location-outline" size={10} color="#64748b" />
            <Text style={s.gridLoc} numberOfLines={1}>{camera.location_name}</Text>
          </View>
          <View style={s.gridMeta}>
            <Text style={s.metaChip}>{camera.resolution || '1080p'}</Text>
            <Text style={s.metaChip}>{camera.recording_count || 0} clips</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Camera Row (list) ──────────────────────────────────────────────────────
  const ListRow = ({ camera }: { camera: Camera }) => {
    const live = isLiveCamera(camera);
    const color = live ? '#E63939' : getStatusColor(camera.status);
    return (
      <TouchableOpacity style={s.listRow} onPress={() => openCamera(camera)} activeOpacity={0.85}>
        <View style={[s.listThumb, { borderColor: color + '55' }]}>
          <Ionicons name="videocam" size={22} color={color} />
          {(live || camera.status === 'active') && (
            <View style={[s.listLiveDot, { backgroundColor: color }]} />
          )}
        </View>
        <View style={s.listBody}>
          <Text style={s.listName} numberOfLines={1}>{camera.camera_name}</Text>
          <Text style={s.listLoc} numberOfLines={1}>{camera.location_name}</Text>
          <View style={s.listMeta}>
            <Text style={s.metaChip}>{camera.resolution || '1080p'}</Text>
            <Text style={s.metaChip}>{camera.recording_count || 0} clips</Text>
            <Text style={s.metaChip}>{formatTime(camera.last_active)}</Text>
          </View>
        </View>
        <View style={s.listRight}>
          <View style={[s.listStatus, { backgroundColor: color + '22', borderColor: color + '55' }]}>
            <Text style={[s.listStatusText, { color }]}>{live ? 'LIVE' : getStatusText(camera.status)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#475569" style={{ marginTop: 8 }} />
        </View>
      </TouchableOpacity>
    );
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return <AppLoader message="Loading CCTV feeds…" />;
  }

  // ── Main Render ───────────────────────────────────────────────────────────
  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" />
      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <View style={s.headerLeft}>
            <View style={s.headerIcon}>
              <Ionicons name="videocam" size={16} color="#000" />
            </View>
            <View>
              <Text style={s.headerTitle}>CCTV Monitor</Text>
              <Text style={s.headerSub}>{cameras.length} cameras registered</Text>
            </View>
          </View>
          <View style={s.headerRight}>
            {/* Alerts bell */}
            <TouchableOpacity style={s.iconBtn} onPress={() => setShowAlerts(v => !v)}>
              <Ionicons name="notifications-outline" size={22} color={unreadAlerts > 0 ? '#E63939' : '#94a3b8'} />
              {unreadAlerts > 0 && (
                <View style={s.badge}><Text style={s.badgeText}>{unreadAlerts}</Text></View>
              )}
            </TouchableOpacity>
            {/* View toggle */}
            <TouchableOpacity style={s.iconBtn} onPress={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}>
              <Ionicons name={viewMode === 'grid' ? 'list-outline' : 'grid-outline'} size={22} color="#94a3b8" />
            </TouchableOpacity>
            {/* Start live */}
            <TouchableOpacity style={s.liveBtn} onPress={() => router.push('/live-stream')}>
              <LinearGradient colors={['#E63939', '#b91c1c']} style={s.liveBtnGrad}>
                <PulsingDot color="#fff" size={6} />
                <Text style={s.liveBtnText}>Go Live</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Stats Bar ─────────────────────────────────────────────────── */}
        <View style={s.statsBar}>
          <StatPill icon="videocam-outline" label="Total" value={cameras.length} color="#94a3b8" />
          <View style={s.statDiv} />
          <StatPill icon="checkmark-circle-outline" label="Active" value={activeCount} color="#10b981" />
          <View style={s.statDiv} />
          <StatPill icon="radio-outline" label="Live" value={activeLive} color="#E63939" />
          <View style={s.statDiv} />
          <StatPill icon="close-circle-outline" label="Offline" value={offlineCount} color="#ef4444" />
          <View style={s.statDiv} />
          <StatPill icon="alert-circle-outline" label="Alerts" value={unreadAlerts} color="#f59e0b" />
        </View>

        {/* ── Live Banner ───────────────────────────────────────────────── */}
        {activeLive > 0 && (
          <TouchableOpacity style={s.liveBanner} activeOpacity={0.85}
            onPress={() => Alert.alert('Live Streams', `${activeLive} active broadcast${activeLive > 1 ? 's' : ''} available`)}>
            <LinearGradient colors={['#991b1b', '#E63939']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.liveBannerGrad}>
              <PulsingDot color="#fff" size={10} />
              <View style={{ flex: 1 }}>
                <Text style={s.liveBannerTitle}>{activeLive} Active Live {activeLive === 1 ? 'Stream' : 'Streams'}</Text>
                <Text style={s.liveBannerSub}>Tap to open a live feed</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* ── Alerts Panel ──────────────────────────────────────────────── */}
        {showAlerts && (
          <View style={s.alertsPanel}>
            <View style={s.alertsPanelHeader}>
              <Text style={s.alertsPanelTitle}>Recent Alerts</Text>
              <TouchableOpacity onPress={() => setShowAlerts(false)}>
                <Ionicons name="close" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
              {alerts.length === 0 ? (
                <Text style={{ color: '#64748b', fontSize: 13, alignSelf: 'center' }}>No alerts</Text>
              ) : alerts.slice(0, 8).map(a => (
                <TouchableOpacity key={a.id}
                  style={[s.alertChip, !a.is_viewed && s.alertChipUnread]}
                  onPress={async () => {
                    await fetch(`${API_URL}/api/cctv/alerts/${a.id}/view`, { method: 'PUT' });
                    fetchAlerts();
                  }}>
                  <Ionicons name="alert-circle" size={16} color="#E63939" />
                  <View>
                    <Text style={s.alertChipTitle}>{a.incident_type || 'Motion'}</Text>
                    <Text style={s.alertChipSub}>{a.camera_name} • {formatTime(a.created_at)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Filter Tabs ───────────────────────────────────────────────── */}
        <View style={s.filterBar}>
          {(['all', 'active', 'live', 'offline'] as const).map(tab => (
            <TouchableOpacity key={tab} onPress={() => setFilterTab(tab)}
              style={[s.filterTab, filterTab === tab && s.filterTabActive]}>
              <Text style={[s.filterTabText, filterTab === tab && s.filterTabTextActive]}>
                {tab === 'all' ? `All (${cameras.length})`
                  : tab === 'active' ? `Active (${activeCount})`
                  : tab === 'live' ? `Live (${activeLive})`
                  : `Offline (${offlineCount})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Camera Grid / List ────────────────────────────────────────── */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E63939" />}
        >
          {filteredCameras.length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="videocam-off-outline" size={56} color="#334155" />
              <Text style={s.emptyTitle}>No cameras found</Text>
              <Text style={s.emptySub}>
                {filterTab === 'live' ? 'No live streams right now' : 'Try a different filter'}
              </Text>
            </View>
          ) : viewMode === 'grid' ? (
            <View style={s.gridWrap}>
              {filteredCameras.map(c => <GridCard key={c.id} camera={c} />)}
            </View>
          ) : (
            <View style={s.listWrap}>
              {filteredCameras.map(c => <ListRow key={c.id} camera={c} />)}
            </View>
          )}
        </ScrollView>

      </Animated.View>

      {/* ── Camera Detail Modal ────────────────────────────────────────── */}
      <Modal animationType="slide" transparent={false} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        {selectedCamera && (
          <LinearGradient colors={['#0f172a', '#1e293b']} style={{ flex: 1 }}>
            <StatusBar barStyle="light-content" />

            {/* Modal Header */}
            {!isFullscreen && (
              <View style={[s.modalHeader, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={s.backBtn}>
                  <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={{ flex: 1, marginHorizontal: 12 }}>
                  <Text style={s.modalTitle} numberOfLines={1}>{selectedCamera.camera_name}</Text>
                  <Text style={s.modalSub}>{selectedCamera.location_name}</Text>
                </View>
                {/* Status */}
                {(() => {
                  const live = isLiveCamera(selectedCamera);
                  const color = live ? '#E63939' : getStatusColor(selectedCamera.status);
                  return (
                    <View style={[s.modalStatusBadge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
                      {live ? <PulsingDot color={color} size={6} /> : <View style={[s.dot6, { backgroundColor: color }]} />}
                      <Text style={[s.modalStatusText, { color }]}>{live ? 'LIVE' : getStatusText(selectedCamera.status)}</Text>
                    </View>
                  );
                })()}
              </View>
            )}

            {/* Video Feed */}
            <View style={[s.videoWrap, isFullscreen && s.videoFullscreen]}>
              {selectedCamera.stream_url ? (
                <Video
                  ref={videoRef}
                  source={{ uri: selectedCamera.stream_url }}
                  style={{ width: '100%', height: '100%' }}
                  useNativeControls={false}
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay={videoPlaying}
                />
              ) : (
                <View style={s.noStream}>
                  <Ionicons name="videocam-off-outline" size={52} color="#334155" />
                  <Text style={s.noStreamText}>No Stream Available</Text>
                  <Text style={{ color: '#475569', fontSize: 12, marginTop: 4 }}>Camera may be offline</Text>
                </View>
              )}

              {/* Video overlay controls */}
              <View style={s.videoOverlay}>
                {/* LIVE badge */}
                {isLiveCamera(selectedCamera) && (
                  <View style={s.overlayLiveBadge}>
                    <PulsingDot color="#fff" size={7} />
                    <Text style={s.overlayLiveText}>LIVE</Text>
                  </View>
                )}
                {/* Camera ID top-right */}
                <View style={s.overlayIdBadge}>
                  <Text style={s.overlayIdText}>CAM #{selectedCamera.id}</Text>
                </View>
                {/* Bottom controls row */}
                <View style={s.videoControls}>
                  {/* Play/Pause */}
                  <TouchableOpacity style={s.videoCtrlBtn} onPress={() => setVideoPlaying(v => !v)}>
                    <Ionicons name={videoPlaying ? 'pause' : 'play'} size={22} color="#fff" />
                  </TouchableOpacity>
                  {/* Screenshot */}
                  <TouchableOpacity style={s.videoCtrlBtn} onPress={() => Alert.alert('Screenshot', 'Screenshot saved')}>
                    <Ionicons name="camera-outline" size={20} color="#fff" />
                  </TouchableOpacity>
                  {/* Fullscreen */}
                  <TouchableOpacity style={s.videoCtrlBtn} onPress={() => setIsFullscreen(v => !v)}>
                    <Ionicons name={isFullscreen ? 'contract-outline' : 'expand-outline'} size={20} color="#fff" />
                  </TouchableOpacity>
                  {/* Report */}
                  <TouchableOpacity style={[s.videoCtrlBtn, s.videoCtrlRed]} onPress={() => router.push('/camera')}>
                    <Ionicons name="alert-circle-outline" size={20} color="#fff" />
                    <Text style={s.videoCtrlRedText}>Report</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Modal Tabs */}
            {!isFullscreen && (
              <>
                <View style={s.modalTabs}>
                  {(['feed', 'info', 'recordings'] as const).map(tab => (
                    <TouchableOpacity key={tab} onPress={() => setModalTab(tab)} style={[s.modalTab, modalTab === tab && s.modalTabActive]}>
                      <Ionicons
                        name={tab === 'feed' ? 'play-circle-outline' : tab === 'info' ? 'information-circle-outline' : 'film-outline'}
                        size={15} color={modalTab === tab ? '#E63939' : '#64748b'}
                      />
                      <Text style={[s.modalTabText, modalTab === tab && s.modalTabTextActive]}>
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Tab Content */}
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>

                  {/* ── Feed Tab ─────────────────────────────────────── */}
                  {modalTab === 'feed' && (
                    <View style={s.tabContent}>
                      <Text style={s.sectionLabel}>Quick Actions</Text>
                      <View style={s.quickActions}>
                        {[
                          { icon: 'recording-outline', label: 'Record', color: '#E63939', onPress: () => Alert.alert('Recording', 'Recording started') },
                          { icon: 'download-outline', label: 'Save Clip', color: '#6366f1', onPress: () => Alert.alert('Save', 'Clip saved') },
                          { icon: 'share-outline', label: 'Share', color: '#10b981', onPress: () => Alert.alert('Share', 'Link copied') },
                          { icon: 'mic-outline', label: 'Audio', color: '#f59e0b', onPress: () => Alert.alert('Audio', 'Audio toggled') },
                        ].map(a => (
                          <TouchableOpacity key={a.label} style={s.quickAction} onPress={a.onPress}>
                            <View style={[s.quickActionIcon, { backgroundColor: a.color + '22' }]}>
                              <Ionicons name={a.icon as any} size={20} color={a.color} />
                            </View>
                            <Text style={s.quickActionLabel}>{a.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <TouchableOpacity style={s.incidentBtn} onPress={() => router.push('/camera')}>
                        <Ionicons name="alert-circle-outline" size={18} color="#fff" />
                        <Text style={s.incidentBtnText}>Report Incident from this Camera</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* ── Info Tab ─────────────────────────────────────── */}
                  {modalTab === 'info' && (
                    <View style={s.tabContent}>
                      <Text style={s.sectionLabel}>Camera Details</Text>
                      {[
                        { icon: 'videocam-outline', label: 'Camera ID', value: `#${selectedCamera.id}` },
                        { icon: 'location-outline', label: 'Location', value: selectedCamera.location_name },
                        { icon: 'analytics-outline', label: 'Resolution', value: selectedCamera.resolution || '1080p' },
                        { icon: 'pulse-outline', label: 'Status', value: getStatusText(selectedCamera.status), color: getStatusColor(selectedCamera.status) },
                        { icon: 'time-outline', label: 'Last Active', value: formatTime(selectedCamera.last_active) },
                        { icon: 'film-outline', label: 'Recordings', value: `${selectedCamera.recording_count || 0} clips` },
                        { icon: 'radio-outline', label: 'Currently Streaming', value: isLiveCamera(selectedCamera) ? 'Yes' : 'No', color: isLiveCamera(selectedCamera) ? '#E63939' : '#64748b' },
                      ].map(row => (
                        <View key={row.label} style={s.infoRow}>
                          <View style={s.infoIconWrap}>
                            <Ionicons name={row.icon as any} size={16} color="#64748b" />
                          </View>
                          <Text style={s.infoLabel}>{row.label}</Text>
                          <Text style={[s.infoValue, row.color ? { color: row.color } : {}]}>{row.value}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* ── Recordings Tab ───────────────────────────────── */}
                  {modalTab === 'recordings' && (
                    <View style={s.tabContent}>
                      <Text style={s.sectionLabel}>Recent Recordings</Text>
                      {recordings.length === 0 ? (
                        <View style={s.emptyBox}>
                          <Ionicons name="film-outline" size={40} color="#334155" />
                          <Text style={s.emptyTitle}>No recordings yet</Text>
                        </View>
                      ) : recordings.map(rec => (
                        <View key={rec.id} style={s.recRow}>
                          <View style={s.recIconWrap}>
                            <Ionicons name="videocam-outline" size={20} color="#E63939" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.recDate}>{new Date(rec.start_time).toLocaleDateString()}</Text>
                            <Text style={s.recTime}>{new Date(rec.start_time).toLocaleTimeString()}</Text>
                          </View>
                          <Text style={s.recDur}>{formatDuration(rec.duration)}</Text>
                          <TouchableOpacity style={s.recPlay}>
                            <Ionicons name="play" size={14} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </ScrollView>
              </>
            )}

            {/* Exit fullscreen FAB */}
            {isFullscreen && (
              <TouchableOpacity style={[s.exitFsBtn, { bottom: insets.bottom + 20 }]} onPress={() => setIsFullscreen(false)}>
                <Ionicons name="contract-outline" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </LinearGradient>
        )}
      </Modal>
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  fillCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#94a3b8', marginTop: 12, fontSize: 14 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#E63939', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  headerSub: { color: '#64748b', fontSize: 11, marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: { padding: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', position: 'relative' },
  badge: {
    position: 'absolute', top: 3, right: 3, backgroundColor: '#E63939',
    borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  liveBtn: { borderRadius: 20, overflow: 'hidden' },
  liveBtnGrad: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, gap: 5 },
  liveBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  // Stats
  statsBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  statPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  statPillValue: { fontSize: 15, fontWeight: '800', lineHeight: 18 },
  statPillLabel: { color: '#475569', fontSize: 9, fontWeight: '600', marginTop: 1 },
  statDiv: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.08)' },

  // Live Banner
  liveBanner: { marginHorizontal: 16, marginBottom: 10, borderRadius: 14, overflow: 'hidden' },
  liveBannerGrad: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  liveBannerTitle: { color: '#fff', fontSize: 13, fontWeight: '800' },
  liveBannerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 2 },

  // Alerts panel
  alertsPanel: {
    marginHorizontal: 16, marginBottom: 10, backgroundColor: '#1e293b',
    borderRadius: 14, borderWidth: 1, borderColor: '#334155', paddingVertical: 10,
  },
  alertsPanelHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, marginBottom: 8,
  },
  alertsPanelTitle: { color: '#fff', fontSize: 13, fontWeight: '700' },
  alertChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#0f172a', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: '#334155', minWidth: 160,
  },
  alertChipUnread: { borderColor: '#E63939', backgroundColor: 'rgba(230,57,57,0.08)' },
  alertChipTitle: { color: '#fff', fontSize: 11, fontWeight: '700' },
  alertChipSub: { color: '#64748b', fontSize: 9, marginTop: 2 },

  // Filter tabs
  filterBar: {
    flexDirection: 'row', paddingHorizontal: 16, marginBottom: 10, gap: 6,
  },
  filterTab: {
    flex: 1, paddingVertical: 6, borderRadius: 8, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  filterTabActive: { backgroundColor: 'rgba(230,57,57,0.15)', borderColor: '#E63939' },
  filterTabText: { color: '#64748b', fontSize: 10, fontWeight: '700' },
  filterTabTextActive: { color: '#E63939' },

  // Scroll
  scrollContent: { paddingHorizontal: 16, paddingBottom: 100 },

  // Grid
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  gridCard: {
    width: CARD_WIDTH, backgroundColor: '#1e293b', borderRadius: 16,
    overflow: 'hidden', borderWidth: 1, borderColor: '#334155',
  },
  thumb: { height: 110, justifyContent: 'center', alignItems: 'center' },
  scanlines: {
    ...StyleSheet.absoluteFillObject,
    backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.15) 2px,rgba(0,0,0,0.15) 4px)',
  } as any,
  thumbBadge: {
    position: 'absolute', top: 7, right: 7, flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, borderWidth: 1,
  },
  thumbBadgeText: { fontSize: 9, fontWeight: '800' },
  recBadge: {
    position: 'absolute', top: 7, left: 7, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#E63939', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, gap: 3,
  },
  recText: { color: '#fff', fontSize: 8, fontWeight: '800' },
  playOverlay: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
  dot6: { width: 6, height: 6, borderRadius: 3 },
  dot6r: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  gridInfo: { padding: 10 },
  gridName: { color: '#fff', fontSize: 13, fontWeight: '700' },
  gridLocRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  gridLoc: { color: '#64748b', fontSize: 10, flex: 1 },
  gridMeta: { flexDirection: 'row', gap: 5, marginTop: 6 },
  metaChip: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 5,
    paddingHorizontal: 5, paddingVertical: 2, color: '#64748b', fontSize: 9, fontWeight: '600',
  },

  // List
  listWrap: { gap: 8 },
  listRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b',
    borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#334155', gap: 12,
  },
  listThumb: {
    width: 48, height: 48, borderRadius: 12, borderWidth: 1.5,
    backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center',
  },
  listLiveDot: { position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: 4 },
  listBody: { flex: 1, gap: 2 },
  listName: { color: '#fff', fontSize: 13, fontWeight: '700' },
  listLoc: { color: '#64748b', fontSize: 11 },
  listMeta: { flexDirection: 'row', gap: 5, marginTop: 4, flexWrap: 'wrap' },
  listRight: { alignItems: 'flex-end' },
  listStatus: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, borderWidth: 1 },
  listStatusText: { fontSize: 9, fontWeight: '800' },

  // Empty
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { color: '#475569', fontSize: 15, fontWeight: '700', marginTop: 8 },
  emptySub: { color: '#334155', fontSize: 12 },

  // Modal
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12,
  },
  backBtn: { padding: 6, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)' },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  modalSub: { color: '#64748b', fontSize: 11, marginTop: 2 },
  modalStatusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1,
  },
  modalStatusText: { fontSize: 10, fontWeight: '800' },

  // Video
  videoWrap: { width: '100%', height: height * 0.32, backgroundColor: '#000', position: 'relative' },
  videoFullscreen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99, height: undefined, flex: 1 },
  noStream: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  noStreamText: { color: '#475569', fontSize: 14, fontWeight: '600' },
  videoOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  overlayLiveBadge: {
    position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  overlayLiveText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  overlayIdBadge: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  overlayIdText: { color: '#94a3b8', fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  videoControls: {
    position: 'absolute', bottom: 10, left: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  videoCtrlBtn: {
    backgroundColor: 'rgba(0,0,0,0.65)', padding: 8, borderRadius: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  videoCtrlRed: { backgroundColor: 'rgba(230,57,57,0.85)', marginLeft: 'auto' as any },
  videoCtrlRedText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Modal Tabs
  modalTabs: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  modalTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 11,
  },
  modalTabActive: { borderBottomWidth: 2, borderBottomColor: '#E63939' },
  modalTabText: { color: '#64748b', fontSize: 12, fontWeight: '700' },
  modalTabTextActive: { color: '#E63939' },

  // Tab content
  tabContent: { padding: 16, gap: 14 },
  sectionLabel: { color: '#475569', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 },

  // Quick actions
  quickActions: { flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  quickAction: { flex: 1, alignItems: 'center', gap: 6 },
  quickActionIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  quickActionLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '600' },

  // Incident button
  incidentBtn: {
    backgroundColor: '#E63939', borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  incidentBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  // Info rows
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: '#1e293b',
  },
  infoIconWrap: {
    width: 32, height: 32, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center', alignItems: 'center',
  },
  infoLabel: { color: '#64748b', fontSize: 12, fontWeight: '600', flex: 1 },
  infoValue: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Recording rows
  recRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#1e293b',
  },
  recIconWrap: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(230,57,57,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  recDate: { color: '#fff', fontSize: 12, fontWeight: '700' },
  recTime: { color: '#64748b', fontSize: 10, marginTop: 2 },
  recDur: { color: '#94a3b8', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  recPlay: {
    backgroundColor: '#E63939', width: 28, height: 28, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },

  // Exit fullscreen FAB
  exitFsBtn: {
    position: 'absolute', right: 20, backgroundColor: 'rgba(0,0,0,0.7)',
    width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center',
  },
});