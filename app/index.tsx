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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import Colors from "@/constants/colors";

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
  }, []);

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

function MessageBubble({ message }: { message: Message }) {
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
        <Text
          style={[
            styles.timestamp,
            message.isUser ? styles.timestampUser : styles.timestampBot,
          ]}
        >
          {formatTime(message.timestamp)}
        </Text>
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
  const [showBanner, setShowBanner] = useState(false);
  const [lastGempaId, setLastGempaId] = useState<string>("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
        }
        setLastGempaId(gempaId);
      }
    } catch (e) {
      console.error("Failed to fetch earthquake data:", e);
    }
  }, [lastGempaId]);

  useEffect(() => {
    fetchLatestGempa(false);
    const interval = setInterval(() => fetchLatestGempa(true), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

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
    } catch (e) {
      console.error("Chat API error:", e);
      return "Maaf, terjadi kesalahan koneksi ke server. Silakan coba lagi.";
    }
  }, []);

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
      const reply = await sendToApi(trimmed);
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
    },
    [isTyping, sendToApi],
  );

  const handleQuickAction = useCallback(
    (type: "gempa" | "p3k" | "shelter") => {
      const labels = {
        gempa: "Berikan info gempa terbaru dari BMKG",
        p3k: "Berikan panduan pertolongan pertama (P3K) lengkap",
        shelter: "Bagaimana cara mencari shelter atau posko pengungsian terdekat?",
      };
      sendMessage(labels[type]);
    },
    [sendMessage],
  );

  const handleShelterFromModal = useCallback(() => {
    sendMessage("Bagaimana cara mencari shelter atau posko pengungsian terdekat?");
  }, [sendMessage]);

  const handleSend = useCallback(() => {
    sendMessage(inputText);
    inputRef.current?.focus();
  }, [inputText, sendMessage]);

  const renderItem = useCallback(
    ({ item }: { item: Message }) => <MessageBubble message={item} />,
    [],
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
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Online - BMKG Live</Text>
            </View>
          </View>
        </View>
        <View style={styles.headerRight}>
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
          <View style={styles.bmkgBadge}>
            <Text style={styles.bmkgBadgeText}>BMKG</Text>
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
          <View style={styles.quickActions}>
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
          </View>

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
                inputText.trim() && !isTyping
                  ? { backgroundColor: C.accent, opacity: pressed ? 0.8 : 1 }
                  : { backgroundColor: C.surfaceLight, opacity: 0.5 },
              ]}
              onPress={handleSend}
              disabled={!inputText.trim() || isTyping}
              testID="send-button"
            >
              <Ionicons
                name="send"
                size={18}
                color={inputText.trim() && !isTyping ? "#fff" : C.textMuted}
              />
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
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: C.quickAction,
    borderWidth: 1,
    borderColor: C.quickActionBorder,
  },
  quickActionLabel: {
    fontSize: 12,
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
});
