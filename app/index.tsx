import React, { useState, useRef, useCallback, useMemo } from "react";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import Colors from "@/constants/colors";

const C = Colors.dark;
const MAX_MOBILE_WIDTH = 480;

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  text: "Halo! Saya SiagaBot, asisten darurat bencana Anda.\n\nSaya terhubung langsung ke data real-time BMKG dan dilengkapi AI untuk membantu Anda.\n\nSilakan ketik pesan atau gunakan tombol aksi cepat di bawah.",
  isUser: false,
  timestamp: new Date(),
};

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

  const isWeb = Platform.OS === "web";
  const isWideScreen = isWeb && windowWidth > MAX_MOBILE_WIDTH;
  const topPadding = isWeb ? 0 : insets.top;
  const bottomPadding = isWeb ? 16 : insets.bottom;

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
            <Text style={styles.headerTitle}>SiagaBot</Text>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Online - BMKG Live</Text>
            </View>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.bmkgBadge}>
            <Text style={styles.bmkgBadgeText}>BMKG</Text>
          </View>
        </View>
      </View>

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
