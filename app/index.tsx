import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  Platform,
  StatusBar,
  useWindowDimensions,
  ActivityIndicator,
  Modal,
  Animated,
  Share,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Network from "expo-network";
import * as Speech from "expo-speech";
import { Audio } from "expo-av";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import Colors from "@/constants/colors";
import ShelterFinder from "@/components/ShelterFinder";
import DisasterMap from "@/components/DisasterMap";
import ReportDisaster from "@/components/ReportDisaster";
import { getOfflineResponse } from "@/constants/offline-kb";

const C = Colors.dark;
const MAX_MOBILE_WIDTH = 480;
const POLL_INTERVAL = 60000;

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface GempaData {
  Tanggal: string;
  Jam: string;
  DateTime: string;
  Coordinates: string;
  Lintang: string;
  Bujur: string;
  Magnitude: string;
  Kedalaman: string;
  Wilayah: string;
  Potensi?: string;
  Dirasakan?: string;
  Shakemap?: string;
}

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const past = new Date(dateStr);
  const diffMs = now.getTime() - past.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Baru saja";
  if (diffMin < 60) return `${diffMin} menit yang lalu`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} jam yang lalu`;
  return `${Math.floor(diffHr / 24)} hari yang lalu`;
}

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  text: "Halo! Saya Garda Bencana, asisten darurat bencana Anda.\n\nSaya terhubung langsung ke data real-time BMKG dan dilengkapi AI untuk membantu Anda.\n\nSilakan ketik pesan atau gunakan tombol aksi cepat di bawah.",
  isUser: false,
  timestamp: new Date(),
};

function EarthquakeModal({
  visible,
  gempa,
  onClose,
  onShelter,
  lastUpdated,
  onRefresh,
  isRefreshing,
}: {
  visible: boolean;
  gempa: GempaData | null;
  onClose: () => void;
  onShelter: () => void;
  lastUpdated: Date | null;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  if (!gempa) return null;

  const mag = parseFloat(gempa.Magnitude);
  const isTsunami = gempa.Potensi?.toLowerCase().includes("berpotensi tsunami") || false;
  const noTsunami = gempa.Potensi?.toLowerCase().includes("tidak berpotensi") || !isTsunami;

  const magColor = mag >= 7 ? "#EF4444" : mag >= 5 ? "#F59E0B" : "#10B981";

  const handleShare = async () => {
    const text = `Info Gempa BMKG\n\nMagnitudo: M${gempa.Magnitude}\nLokasi: ${gempa.Wilayah}\nWaktu: ${gempa.Tanggal}, ${gempa.Jam}\nKedalaman: ${gempa.Kedalaman}\nKoordinat: ${gempa.Lintang}, ${gempa.Bujur}\nStatus: ${gempa.Potensi || "-"}\n${gempa.Dirasakan ? `Dirasakan: ${gempa.Dirasakan}` : ""}\n\nSumber: BMKG - via Garda Bencana`;
    try {
      if (Platform.OS === "web") {
        if (navigator.share) {
          await navigator.share({ title: "Info Gempa BMKG", text });
        } else {
          await navigator.clipboard.writeText(text);
        }
      } else {
        await Share.share({ message: text });
      }
    } catch {}
  };

  const depthText = gempa.Kedalaman;
  const depthNum = parseInt(depthText);
  const depthLabel =
    depthNum <= 10 ? "Sangat Dangkal" :
    depthNum <= 60 ? "Dangkal" :
    depthNum <= 300 ? "Menengah" : "Dalam";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <View style={modalStyles.header}>
            <View style={modalStyles.headerLeft}>
              <MaterialCommunityIcons name="earth" size={22} color={C.accent} />
              <Text style={modalStyles.headerTitle}>Info Gempa BMKG</Text>
            </View>
            <View style={modalStyles.headerRight}>
              <Pressable
                onPress={onRefresh}
                style={({ pressed }) => [
                  modalStyles.refreshBtn,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                {isRefreshing ? (
                  <ActivityIndicator size="small" color={C.textSecondary} />
                ) : (
                  <Feather name="refresh-cw" size={18} color={C.textSecondary} />
                )}
              </Pressable>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  modalStyles.closeBtn,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Ionicons name="close" size={22} color={C.textSecondary} />
              </Pressable>
            </View>
          </View>

          {lastUpdated && (
            <Text style={modalStyles.updateText}>
              Data diperbarui {timeAgo(lastUpdated.toISOString())}
            </Text>
          )}

          <View style={modalStyles.scrollContent}>
            <View style={modalStyles.mainCard}>
              <View style={modalStyles.terkiniContainer}>
                <View style={[modalStyles.terkiniBadge, { backgroundColor: magColor + "22", borderColor: magColor + "44" }]}>
                  <Text style={[modalStyles.terkiniText, { color: magColor }]}>TERKINI</Text>
                </View>
              </View>

              <Text style={[modalStyles.magnitude, { color: magColor }]}>
                M {gempa.Magnitude}
              </Text>

              <View style={modalStyles.coordRow}>
                <Ionicons name="location" size={14} color={C.accent} />
                <Text style={modalStyles.coordText}>
                  {gempa.Lintang}, {gempa.Bujur}
                </Text>
              </View>

              <Text style={modalStyles.wilayah}>{gempa.Wilayah}</Text>

              <View
                style={[
                  modalStyles.tsunamiBadge,
                  noTsunami
                    ? { backgroundColor: "#10B98118", borderColor: "#10B98133" }
                    : { backgroundColor: "#EF444418", borderColor: "#EF444433" },
                ]}
              >
                <Ionicons
                  name={noTsunami ? "checkmark-circle" : "warning"}
                  size={16}
                  color={noTsunami ? "#10B981" : "#EF4444"}
                />
                <Text
                  style={[
                    modalStyles.tsunamiText,
                    { color: noTsunami ? "#10B981" : "#EF4444" },
                  ]}
                >
                  {noTsunami ? "Tidak Berpotensi Tsunami" : "Berpotensi Tsunami"}
                </Text>
              </View>
            </View>

            <View style={modalStyles.detailRow}>
              <View style={modalStyles.detailCard}>
                <View style={modalStyles.detailIconContainer}>
                  <Ionicons name="time-outline" size={18} color={C.accent} />
                </View>
                <Text style={modalStyles.detailLabel}>WAKTU KEJADIAN</Text>
                <Text style={modalStyles.detailValue}>{gempa.Jam}</Text>
                <Text style={modalStyles.detailSub}>{gempa.Tanggal}</Text>
              </View>
              <View style={modalStyles.detailCard}>
                <View style={modalStyles.detailIconContainer}>
                  <MaterialCommunityIcons name="arrow-collapse-down" size={18} color={C.accent} />
                </View>
                <Text style={modalStyles.detailLabel}>KEDALAMAN</Text>
                <Text style={modalStyles.detailValue}>{gempa.Kedalaman}</Text>
                <Text style={modalStyles.detailSub}>{depthLabel}</Text>
              </View>
            </View>

            {gempa.Dirasakan && (
              <View style={modalStyles.feltCard}>
                <View style={modalStyles.feltHeader}>
                  <MaterialCommunityIcons name="pulse" size={18} color={C.warning} />
                  <Text style={modalStyles.feltLabel}>DIRASAKAN (SKALA MMI)</Text>
                </View>
                <Text style={modalStyles.feltValue}>{gempa.Dirasakan}</Text>
              </View>
            )}

            <View style={modalStyles.actionRow}>
              <Pressable
                style={({ pressed }) => [
                  modalStyles.shareBtn,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={handleShare}
              >
                <Ionicons name="share-outline" size={18} color={C.text} />
                <Text style={modalStyles.shareBtnText}>Bagikan</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  modalStyles.shelterBtn,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={() => {
                  onClose();
                  onShelter();
                }}
              >
                <Ionicons name="location" size={18} color="#fff" />
                <Text style={modalStyles.shelterBtnText}>Cari Shelter</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function NotificationBanner({
  gempa,
  onPress,
  onDismiss,
}: {
  gempa: GempaData;
  onPress: () => void;
  onDismiss: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(-120)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 9,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(slideAnim, {
        toValue: -120,
        duration: 300,
        useNativeDriver: true,
      }).start(() => onDismiss());
    }, 8000);

    return () => clearTimeout(timer);
  }, [onDismiss, slideAnim]);

  const mag = parseFloat(gempa.Magnitude);
  const magColor = mag >= 7 ? "#EF4444" : mag >= 5 ? "#F59E0B" : "#10B981";

  return (
    <Animated.View
      style={[
        notifStyles.banner,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Pressable style={notifStyles.bannerContent} onPress={onPress}>
        <View style={notifStyles.bannerLeft}>
          <View style={[notifStyles.magCircle, { backgroundColor: magColor + "22", borderColor: magColor }]}>
            <Text style={[notifStyles.magText, { color: magColor }]}>M{gempa.Magnitude}</Text>
          </View>
          <View style={notifStyles.bannerInfo}>
            <Text style={notifStyles.bannerTitle}>Gempa Terbaru Terdeteksi</Text>
            <Text style={notifStyles.bannerSub} numberOfLines={1}>
              {gempa.Wilayah}
            </Text>
          </View>
        </View>
        <Pressable onPress={onDismiss} hitSlop={10}>
          <Ionicons name="close" size={18} color={C.textMuted} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

interface DisasterNotif {
  id: string;
  type: string;
  typeLabel: string;
  text: string;
  city: string;
  createdAt: string;
  floodDepth: number | null;
}

const DISASTER_COLORS: Record<string, string> = {
  flood: "#3B82F6",
  earthquake: "#F59E0B",
  fire: "#EF4444",
  haze: "#8B5CF6",
  wind: "#06B6D4",
  volcano: "#F97316",
};

const DISASTER_ICONS: Record<string, string> = {
  flood: "water",
  earthquake: "earth",
  fire: "flame",
  haze: "cloud",
  wind: "thunderstorm",
  volcano: "triangle",
};

function DisasterNotifBanner({
  report,
  onPress,
  onDismiss,
}: {
  report: DisasterNotif;
  onPress: () => void;
  onDismiss: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const color = DISASTER_COLORS[report.type] || "#10B981";
  const iconName = DISASTER_ICONS[report.type] || "alert-circle";

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 9,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(slideAnim, {
        toValue: -120,
        duration: 300,
        useNativeDriver: true,
      }).start(() => onDismiss());
    }, 10000);

    return () => clearTimeout(timer);
  }, [onDismiss, slideAnim]);

  return (
    <Animated.View
      style={[
        disasterNotifStyles.banner,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={[disasterNotifStyles.bannerContent, { borderColor: color + "33" }]}>
        <Pressable style={disasterNotifStyles.bannerLeft} onPress={onPress}>
          <View style={[disasterNotifStyles.iconCircle, { backgroundColor: color + "22", borderColor: color }]}>
            <Ionicons name={iconName as any} size={18} color={color} />
          </View>
          <View style={disasterNotifStyles.bannerInfo}>
            <Text style={[disasterNotifStyles.bannerTitle, { color }]}>
              {report.typeLabel} — Laporan Baru
            </Text>
            <Text style={disasterNotifStyles.bannerSub} numberOfLines={1}>
              {report.city || "Indonesia"}{report.floodDepth ? ` • ${report.floodDepth}cm` : ""}
            </Text>
          </View>
        </Pressable>
        <Pressable onPress={onDismiss} hitSlop={10}>
          <Ionicons name="close" size={18} color={C.textMuted} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

function MessageBubble({ 
  message, 
  onSpeak,
  isSpeaking
}: { 
  message: Message;
  onSpeak?: (messageId: string, text: string) => void;
  isSpeaking: boolean;
}) {
  return (
    <View
      style={[
        styles.bubbleRow,
        message.isUser ? styles.bubbleRowUser : styles.bubbleRowBot,
      ]}
    >
      {!message.isUser && (
        <View style={styles.avatarContainer}>
          <Ionicons name="shield-checkmark" size={18} color={C.accent} />
        </View>
      )}
      <View style={styles.bubbleContainer}>
        <View
          style={[
            styles.bubble,
            message.isUser ? styles.userBubble : styles.botBubble,
          ]}
        >
          <Text
            style={[
              styles.bubbleText,
              message.isUser ? styles.userBubbleText : styles.botBubbleText,
            ]}
            selectable
          >
            {message.text}
          </Text>
          <View style={styles.bubbleFooter}>
            <Text
              style={[
                styles.timestamp,
                message.isUser ? styles.timestampUser : styles.timestampBot,
              ]}
            >
              {formatTime(message.timestamp)}
            </Text>
            {!message.isUser && onSpeak && (
              <Pressable 
                onPress={() => onSpeak(message.id, message.text)}
                style={({ pressed }) => [
                  styles.speakerBtn,
                  { opacity: pressed ? 0.6 : 1 }
                ]}
              >
                <Ionicons 
                  name={isSpeaking ? "volume-high" : "volume-medium"} 
                  size={16} 
                  color={isSpeaking ? C.accent : C.textMuted} 
                />
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

function TypingIndicator() {
  return (
    <View style={[styles.bubbleRow, styles.bubbleRowBot]}>
      <View style={styles.avatarContainer}>
        <Ionicons name="shield-checkmark" size={18} color={C.accent} />
      </View>
      <View style={[styles.bubble, styles.botBubble, styles.typingBubble]}>
        <View style={styles.typingDots}>
          <ActivityIndicator size="small" color={C.accent} />
          <Text style={styles.typingText}>Memproses...</Text>
        </View>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const conversationHistory = useRef<{ role: string; content: string }[]>([]);

  const [latestGempa, setLatestGempa] = useState<GempaData | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showShelterFinder, setShowShelterFinder] = useState(false);
  const [showDisasterMap, setShowDisasterMap] = useState(false);
  const [showReportDisaster, setShowReportDisaster] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [lastGempaId, setLastGempaId] = useState<string>("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [disasterNotif, setDisasterNotif] = useState<DisasterNotif | null>(null);
  const [showDisasterBanner, setShowDisasterBanner] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const lastDisasterIds = useRef<Set<string>>(new Set());
  const disasterInitialized = useRef(false);

  // Deteksi Jaringan Offline/Online yang lebih robust
  useEffect(() => {
    async function checkNetwork() {
      try {
        const state = await Network.getNetworkStateAsync();
        console.log("Network State Check:", state);
        
        // Robust logic: Offline jika tidak terkoneksi (Wi-Fi/Data mati) 
        // ATAU Internet tidak reachable (Wi-Fi nyala tapi tidak ada paket data / DNS gagal)
        const offline = state.isConnected === false || state.isInternetReachable === false;
        
        // Hanya update jika berubah untuk menghindari re-render yang tidak perlu
        setIsOffline((prev) => {
          if (prev !== offline) {
            console.log(`Network status changed: ${prev} -> ${offline}`);
            return offline;
          }
          return prev;
        });
      } catch (err) {
        console.error("Failed to get network state:", err);
      }
    }

    // Cek awal
    checkNetwork();

    // Listener untuk perubahan status jaringan
    const subscription = Network.addNetworkStateListener((state) => {
      console.log("Network State Listener:", state);
      const offline = state.isConnected === false || state.isInternetReachable === false;
      setIsOffline(offline);
    });

    // Fallback: Polling setiap 15 detik karena listener kadang telat di Android/Emulator
    const interval = setInterval(checkNetwork, 15000);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, []);

  const isWeb = Platform.OS === "web";
  const isWideScreen = isWeb && windowWidth > MAX_MOBILE_WIDTH;
  const topPadding = isWeb ? 0 : insets.top;
  const bottomPadding = isWeb ? 16 : insets.bottom;

  const fetchLatestGempa = useCallback(async (showNotif = true) => {
    try {
      const url = new URL("/api/bmkg/gempa-terbaru", getApiUrl());
      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success && data.data) {
        const gempa: GempaData = data.data;
        const gempaId = `${gempa.DateTime}_${gempa.Magnitude}_${gempa.Coordinates}`;
        setLatestGempa(gempa);
        setLastUpdated(new Date());

        if (showNotif && lastGempaId && gempaId !== lastGempaId) {
          setShowBanner(true);
          
          // Injeksi ke Chat
          const alertMsg: Message = {
            id: generateId(),
            text: `🚨 ALERT GEMPA BARU\n\nMagnitudo: M${gempa.Magnitude}\nLokasi: ${gempa.Wilayah}\nWaktu: ${gempa.Jam}\nStatus: ${gempa.Potensi || "Sedang diperbarui"}\n\nTetap tenang dan waspada. Klik ikon peta di pojok kanan atas untuk info detail.`,
            isUser: false,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, alertMsg]);

          if (Platform.OS !== "web") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
        }
        setLastGempaId(gempaId);
      }
    } catch (e: any) {
      console.error("Failed to fetch earthquake data:", e);
      // Trigger Fail-to-Offline jika error network
      if (e.message?.includes("Network request failed") || e.message?.includes("UnknownHostException")) {
        console.log("Gempa fetch failed due to network. Forcing offline mode.");
        setIsOffline(true);
      }
    }
  }, [lastGempaId]);

  useEffect(() => {
    fetchLatestGempa(false);
    const interval = setInterval(() => fetchLatestGempa(true), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchLatestGempa]);

  useEffect(() => {
    if (lastGempaId) {
      const interval = setInterval(() => fetchLatestGempa(true), POLL_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [lastGempaId, fetchLatestGempa]);

  const handleRefreshGempa = useCallback(async () => {
    setIsRefreshing(true);
    await fetchLatestGempa(false);
    setIsRefreshing(false);
  }, [fetchLatestGempa]);

  const fetchDisasterReports = useCallback(async () => {
    try {
      const url = new URL("/api/disasters/reports", getApiUrl());
      url.searchParams.set("timeperiod", "3600");
      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) {
        const reports: any[] = data.data || [];
        const currentIds = new Set<string>(reports.map((r: any) => r.id));

        if (disasterInitialized.current && reports.length > 0) {
          const newReports = reports
            .filter((r: any) => !lastDisasterIds.current.has(r.id))
            .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          if (newReports.length > 0) {
            const latest = newReports[0];
            setDisasterNotif({
              id: latest.id,
              type: latest.type,
              typeLabel: latest.typeLabel,
              text: latest.text,
              city: latest.city,
              createdAt: latest.createdAt,
              floodDepth: latest.floodDepth,
            });
            setShowDisasterBanner(true);
            
            // Injeksi semua laporan baru ke Chat
            newReports.forEach(report => {
              const alertMsg: Message = {
                id: generateId(),
                text: `🚨 LAPORAN BENCANA: ${report.typeLabel.toUpperCase()}\n\nLokasi: ${report.city || "Indonesia"}\nLaporan: ${report.text}${report.floodDepth ? `\nKedalaman Air: ${report.floodDepth}cm` : ""}\n\nKami telah meneruskan informasi ini ke unit terkait. Tetap waspada!`,
                isUser: false,
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, alertMsg]);
            });

            if (Platform.OS !== "web") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
          }
        }

        lastDisasterIds.current = currentIds;
        disasterInitialized.current = true;
      }
    } catch (e: any) {
      console.error("Failed to fetch disaster reports:", e);
      // Trigger Fail-to-Offline jika error network
      if (e.message?.includes("Network request failed") || e.message?.includes("UnknownHostException")) {
        console.log("Disaster fetch failed due to network. Forcing offline mode.");
        setIsOffline(true);
      }
    }
  }, []);

  useEffect(() => {
    fetchDisasterReports();
    const interval = setInterval(fetchDisasterReports, 120000);
    return () => clearInterval(interval);
  }, [fetchDisasterReports]);

  const invertedMessages = useMemo(
    () => [...messages].reverse(),
    [messages],
  );

  const sendToApi = useCallback(async (text: string) => {
    try {
      const res = await apiRequest("POST", "/api/chat", {
        message: text,
        history: conversationHistory.current,
      });
      const data = await res.json();
      return data.reply as string;
    } catch (e: any) {
      console.error("Chat API error:", e);
      // Trigger Fail-to-Offline jika error network
      if (e.message?.includes("Network request failed") || e.message?.includes("UnknownHostException")) {
        setIsOffline(true);
        return getOfflineResponse(text); // Langsung kirim balasan offline jika fetch gagal
      }
      return "Maaf, terjadi kesalahan koneksi ke server. Silakan coba lagi.";
    }
  }, []);

  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const handleSpeak = useCallback(async (messageId: string, text: string) => {
    if (speakingMessageId === messageId) {
      await Speech.stop();
      setSpeakingMessageId(null);
      return;
    }

    if (speakingMessageId) {
      await Speech.stop();
    }

    setSpeakingMessageId(messageId);
    Speech.speak(text, {
      language: "id-ID",
      pitch: 1.0,
      rate: 1.0,
      onDone: () => setSpeakingMessageId(null),
      onError: () => setSpeakingMessageId(null),
    });
  }, [speakingMessageId]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isTyping) return;

      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const userMsg: Message = {
        id: generateId(),
        text: trimmed,
        isUser: true,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInputText("");
      setIsTyping(true);

      conversationHistory.current.push({ role: "user", content: trimmed });
      
      let reply = "";
      if (isOffline) {
        // Simulasi delay sedikit untuk feel "berpikir" meski offline
        await new Promise(resolve => setTimeout(resolve, 600));
        reply = getOfflineResponse(trimmed);
      } else {
        reply = await sendToApi(trimmed);
      }

      conversationHistory.current.push({ role: "assistant", content: reply });
      if (conversationHistory.current.length > 20) {
        conversationHistory.current = conversationHistory.current.slice(-20);
      }

      const botMsg: Message = {
        id: generateId(),
        text: reply,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);

      // Auto-speak in voice mode
      if (isVoiceMode) {
        handleSpeak(botMsg.id, reply);
      }
    },
    [isTyping, sendToApi, isOffline, isVoiceMode, handleSpeak],
  );

  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startVoiceInput = useCallback(async () => {
    if (Platform.OS === 'web') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        if (!recognitionRef.current) {
          recognitionRef.current = new SpeechRecognition();
          recognitionRef.current.continuous = false;
          recognitionRef.current.interimResults = true;
          recognitionRef.current.lang = 'id-ID';

          recognitionRef.current.onresult = (event: any) => {
            const transcript = Array.from(event.results)
              .map((result: any) => result[0])
              .map((result: any) => result.transcript)
              .join('');
            setInputText(transcript);
          };

          recognitionRef.current.onend = () => {
            setIsRecording(false);
          };
          
          recognitionRef.current.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            setIsRecording(false);
          };
        }
        
        try {
          recognitionRef.current.start();
          setIsRecording(true);
        } catch (e) {
          console.error('Failed to start speech recognition:', e);
        }
      } else {
        alert("Browser Anda tidak mendukung Voice Input. Silakan gunakan Chrome/Edge.");
      }
    } else {
      // Native Implementation using expo-av + Whisper
      try {
        if (recordingRef.current) {
          await recordingRef.current.stopAndUnloadAsync().catch(() => {});
          recordingRef.current = null;
        }

        const permission = await Audio.requestPermissionsAsync();
        if (permission.status !== 'granted') {
          alert("Izin mikrofon diperlukan untuk fitur ini.");
          return;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        recordingRef.current = recording;
        setIsRecording(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (err) {
        console.error('Failed to start recording', err);
        setIsRecording(false);
      }
    }
  }, []);

  const stopVoiceInput = useCallback(async () => {
    if (Platform.OS === 'web') {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        setIsRecording(false);
      }
    } else {
      const recording = recordingRef.current;
      if (!recording) return;
      
      try {
        setIsRecording(false);
        recordingRef.current = null; // Nullify immediately to prevent double-stop

        const status = await recording.getStatusAsync();
        if (status.canRecord) {
          await recording.stopAndUnloadAsync();
        }
        
        const uri = recording.getURI();

        if (uri) {
          setIsTranscribing(true);
          const formData = new FormData();
          // @ts-ignore
          formData.append('file', {
            uri,
            type: 'audio/m4a',
            name: 'recording.m4a',
          });

          // @ts-ignore
          const res = await apiRequest("POST", "/api/voice/transcribe", formData);
          
          const data = await res.json();
          if (data.success && data.text) {
            setInputText(data.text);
          } else {
            console.error("Transcription failed:", data.error);
          }
        }
      } catch (err) {
        console.error('Failed to stop recording', err);
      } finally {
        setIsTranscribing(false);
      }
    }
  }, []);

  const handleQuickAction = useCallback(
    (type: "gempa" | "p3k" | "shelter" | "bencana" | "lapor") => {
      if (type === "shelter") {
        setShowShelterFinder(true);
        return;
      }
      if (type === "bencana") {
        setShowDisasterMap(true);
        return;
      }
      if (type === "lapor") {
        setShowReportDisaster(true);
        return;
      }
      const labels = {
        gempa: "Berikan info gempa terbaru dari BMKG",
        p3k: "Berikan panduan pertolongan pertama (P3K) lengkap",
        banjir: "Bagaimana rute evakuasi banjir di Pasuruan?",
        angin: "Apa panduan keselamatan saat ada angin puting beliung?",
        shelter: "",
        bencana: "",
        lapor: "",
      };
      sendMessage((labels as any)[type] || "");
    },
    [sendMessage],
  );

  const handleShelterFromModal = useCallback(() => {
    setShowShelterFinder(true);
  }, []);

  const handleSend = useCallback(() => {
    sendMessage(inputText);
    inputRef.current?.focus();
  }, [inputText, sendMessage]);

  const renderItem = useCallback(
    ({ item }: { item: Message }) => (
      <MessageBubble 
        message={item} 
        onSpeak={item.isUser ? undefined : handleSpeak} 
        isSpeaking={speakingMessageId === item.id}
      />
    ),
    [handleSpeak, speakingMessageId],
  );

  const keyExtractor = useCallback((item: Message) => item.id, []);

  const chatContent = (
    <View style={[styles.chatContainer, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Ionicons name="shield-checkmark" size={22} color={C.accent} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Garda Bencana</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, isOffline && { backgroundColor: "#EF4444" }]} />
              <Text style={[styles.statusText, isOffline && { color: "#EF4444" }]}>
                {isOffline ? "Mode Darurat (Offline)" : "Online - BMKG Live"}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.headerRight}>
          {!isOffline && (
            <Pressable
              style={({ pressed }) => [
                styles.gempaHeaderBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={() => {
                handleRefreshGempa();
                setShowModal(true);
              }}
              testID="gempa-notif-btn"
            >
              <MaterialCommunityIcons name="earth" size={18} color={C.accent} />
              {latestGempa && (
                <View style={styles.gempaDot} />
              )}
            </Pressable>
          )}
          <Pressable
            style={({ pressed }) => [
              styles.gempaHeaderBtn,
              { opacity: pressed ? 0.7 : 1, backgroundColor: isVoiceMode ? C.accent : C.quickAction },
            ]}
            onPress={() => setIsVoiceMode(!isVoiceMode)}
          >
            <Ionicons name={isVoiceMode ? "volume-high" : "volume-mute"} size={18} color={isVoiceMode ? "#fff" : C.accent} />
          </Pressable>
          <View style={[styles.bmkgBadge, isOffline && { backgroundColor: "#EF444422", borderColor: "#EF444444" }]}>
            <Text style={[styles.bmkgBadgeText, isOffline && { color: "#EF4444" }]}>
              {isOffline ? "LOCAL" : "BMKG"}
            </Text>
          </View>
        </View>
      </View>

      {showBanner && latestGempa && (
        <NotificationBanner
          gempa={latestGempa}
          onPress={() => {
            setShowBanner(false);
            setShowModal(true);
          }}
          onDismiss={() => setShowBanner(false)}
        />
      )}

      {showDisasterBanner && disasterNotif && !showBanner && (
        <DisasterNotifBanner
          report={disasterNotif}
          onPress={() => {
            setShowDisasterBanner(false);
            setShowDisasterMap(true);
          }}
          onDismiss={() => setShowDisasterBanner(false)}
        />
      )}

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <FlatList
          data={invertedMessages}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          inverted
          style={styles.chatList}
          contentContainerStyle={styles.chatContentPadding}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={isTyping ? <TypingIndicator /> : null}
        />

        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(bottomPadding, 8) },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.quickActions}
            contentContainerStyle={styles.quickActionsContent}
          >
            <Pressable
              style={({ pressed }) => [
                styles.quickActionBtn,
                { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] },
              ]}
              onPress={() => handleQuickAction("gempa")}
              disabled={isTyping}
              testID="quick-gempa"
            >
              <MaterialCommunityIcons
                name="earth"
                size={16}
                color={C.quickActionText}
              />
              <Text style={styles.quickActionLabel}>Info Gempa</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.quickActionBtn,
                { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] },
              ]}
              onPress={() => handleQuickAction("p3k")}
              disabled={isTyping}
              testID="quick-p3k"
            >
              <MaterialCommunityIcons
                name="medical-bag"
                size={16}
                color={C.quickActionText}
              />
              <Text style={styles.quickActionLabel}>Panduan P3K</Text>
            </Pressable>

            {isOffline && (
              <>
                <Pressable
                  style={({ pressed }) => [
                    styles.quickActionBtn,
                    { backgroundColor: "#3B82F622", borderColor: "#3B82F644", opacity: pressed ? 0.7 : 1 },
                  ]}
                  onPress={() => (handleQuickAction as any)("banjir")}
                  disabled={isTyping}
                >
                  <MaterialCommunityIcons name="water" size={16} color="#3B82F6" />
                  <Text style={[styles.quickActionLabel, { color: "#3B82F6" }]}>Banjir Pasuruan</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.quickActionBtn,
                    { backgroundColor: "#EF444422", borderColor: "#EF444444", opacity: pressed ? 0.7 : 1 },
                  ]}
                  onPress={() => (handleQuickAction as any)("angin")}
                  disabled={isTyping}
                >
                  <MaterialCommunityIcons name="weather-tornado" size={16} color="#EF4444" />
                  <Text style={[styles.quickActionLabel, { color: "#EF4444" }]}>Puting Beliung</Text>
                </Pressable>
              </>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.quickActionBtn,
                { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] },
              ]}
              onPress={() => handleQuickAction("shelter")}
              disabled={isTyping}
              testID="quick-shelter"
            >
              <Ionicons
                name="location"
                size={16}
                color={C.quickActionText}
              />
              <Text style={styles.quickActionLabel}>Cari Shelter</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.quickActionBtn,
                { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] },
              ]}
              onPress={() => handleQuickAction("bencana")}
              disabled={isTyping}
              testID="quick-bencana"
            >
              <Ionicons
                name="map"
                size={16}
                color={C.quickActionText}
              />
              <Text style={styles.quickActionLabel}>Peta Bencana</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.quickActionBtn,
                { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] },
              ]}
              onPress={() => handleQuickAction("lapor")}
              disabled={isTyping}
              testID="quick-lapor"
            >
              <Ionicons
                name="megaphone"
                size={16}
                color={C.quickActionText}
              />
              <Text style={styles.quickActionLabel}>Lapor</Text>
            </Pressable>
          </ScrollView>

          <View style={styles.inputRow}>
            <View style={styles.inputContainer}>
              <TextInput
                ref={inputRef}
                style={styles.textInput}
                placeholder="Ketik pesan darurat..."
                placeholderTextColor={C.textMuted}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
                returnKeyType="default"
                editable={!isTyping}
                testID="chat-input"
              />
            </View>
            <Pressable
            style={({ pressed }) => [
              styles.sendButton,
              {
                backgroundColor: inputText.trim() ? C.accent : (isRecording ? "#EF4444" : C.inputBg),
                opacity: (pressed || isTyping) ? 0.7 : 1,
                borderWidth: inputText.trim() ? 0 : 1,
                borderColor: C.border,
              },
            ]}
            onPress={inputText.trim() ? handleSend : (isRecording ? stopVoiceInput : startVoiceInput)}
            disabled={isTyping || isTranscribing}
          >
            {isTyping || isTranscribing ? (
              <ActivityIndicator size="small" color={C.text} />
            ) : (
              <Ionicons
                name={inputText.trim() ? "send" : (isRecording ? "stop" : "mic")}
                size={20}
                color={inputText.trim() ? "#fff" : (isRecording ? "#fff" : C.textMuted)}
              />
            )}
          </Pressable>
          </View>

          <Text style={styles.disclaimer}>
            Sumber data: BMKG | AI: Groq
          </Text>
        </View>
      </KeyboardAvoidingView>

      <EarthquakeModal
        visible={showModal}
        gempa={latestGempa}
        onClose={() => setShowModal(false)}
        onShelter={handleShelterFromModal}
        lastUpdated={lastUpdated}
        onRefresh={handleRefreshGempa}
        isRefreshing={isRefreshing}
      />

      <ShelterFinder
        visible={showShelterFinder}
        onClose={() => setShowShelterFinder(false)}
      />

      <DisasterMap
        visible={showDisasterMap}
        onClose={() => setShowDisasterMap(false)}
      />

      <ReportDisaster
        visible={showReportDisaster}
        onClose={() => setShowReportDisaster(false)}
      />
    </View>
  );

  if (isWideScreen) {
    return (
      <View style={styles.webWrapper}>
        <StatusBar barStyle="light-content" />
        <View style={styles.phoneFrame}>
          {chatContent}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fullScreen}>
      <StatusBar barStyle="light-content" />
      {chatContent}
    </View>
  );
}

const notifStyles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1A2332",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#F59E0B33",
    ...Platform.select({
      web: {
        boxShadow: "0 4px 20px rgba(245, 158, 11, 0.15)",
      },
      default: {
        shadowColor: "#F59E0B",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 8,
      },
    }),
  },
  bannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  magCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  magText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  bannerInfo: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#F59E0B",
  },
  bannerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    marginTop: 1,
  },
});

const disasterNotifStyles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 99,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1A2332",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    ...Platform.select({
      web: {
        boxShadow: "0 4px 20px rgba(59, 130, 246, 0.15)",
      },
      default: {
        shadowColor: "#3B82F6",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 8,
      },
    }),
  },
  bannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  bannerInfo: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  bannerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    marginTop: 1,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: C.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    paddingBottom: Platform.OS === "web" ? 34 : 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  updateText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textMuted,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  mainCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
  },
  terkiniContainer: {
    marginBottom: 12,
  },
  terkiniBadge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  terkiniText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
  },
  magnitude: {
    fontSize: 56,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
  },
  coordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  coordText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
  wilayah: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: C.textSecondary,
    textAlign: "center",
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  tsunamiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
  },
  tsunamiText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  detailRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  detailCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  detailIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.quickAction,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: C.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: C.text,
    marginBottom: 2,
  },
  detailSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
  feltCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
  },
  feltHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  feltLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: C.textMuted,
    letterSpacing: 0.5,
  },
  feltValue: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  shareBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  shareBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  shelterBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: C.accent,
  },
  shelterBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: C.background,
  },
  webWrapper: {
    flex: 1,
    backgroundColor: "#080C10",
    alignItems: "center",
    justifyContent: "center",
  },
  phoneFrame: {
    width: MAX_MOBILE_WIDTH,
    height: "100%",
    maxHeight: 860,
    borderRadius: Platform.OS === "web" ? 24 : 0,
    overflow: "hidden",
    borderWidth: Platform.OS === "web" ? 1 : 0,
    borderColor: C.border,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.quickAction,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.quickActionBorder,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.accent,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.accent,
  },
  gempaHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.quickAction,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.quickActionBorder,
  },
  gempaDot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F59E0B",
    borderWidth: 1.5,
    borderColor: C.surface,
  },
  bmkgBadge: {
    backgroundColor: C.quickAction,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.quickActionBorder,
  },
  bmkgBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: C.accent,
    letterSpacing: 1,
  },
  keyboardView: {
    flex: 1,
  },
  chatList: {
    flex: 1,
  },
  chatContentPadding: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 12,
  },
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  bubbleRowUser: {
    justifyContent: "flex-end",
  },
  bubbleRowBot: {
    justifyContent: "flex-start",
  },
  avatarContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.quickAction,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  userBubble: {
    backgroundColor: C.userBubble,
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: C.botBubble,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
  },
  userBubbleText: {
    color: C.userBubbleText,
  },
  botBubbleText: {
    color: C.botBubbleText,
  },
  timestamp: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  timestampUser: {
    color: "rgba(255,255,255,0.7)",
    textAlign: "right" as const,
  },
  timestampBot: {
    color: C.textMuted,
  },
  typingBubble: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  typingDots: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  typingText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textMuted,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  quickActions: {
    marginBottom: 10,
  },
  quickActionsContent: {
    flexDirection: "row",
    gap: 8,
  },
  quickActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: C.quickAction,
    borderWidth: 1,
    borderColor: C.quickActionBorder,
  },
  quickActionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: C.quickActionText,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  inputContainer: {
    flex: 1,
    backgroundColor: C.inputBg,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    minHeight: 44,
    justifyContent: "center",
  },
  textInput: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: C.text,
    maxHeight: 100,
    lineHeight: 20,
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  disclaimer: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: C.textMuted,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 2,
  },
  bubbleContainer: {
    flexShrink: 1,
    maxWidth: "85%",
  },
  bubbleFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
    gap: 8,
  },
  speakerBtn: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
});
