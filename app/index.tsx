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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

const C = Colors.dark;

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  text: "Halo! Saya SiagaBot, asisten darurat Anda. Saya siap membantu Anda dengan informasi bencana, panduan pertolongan pertama, dan pencarian shelter terdekat.\n\nSilakan ketik pesan atau gunakan tombol aksi cepat di bawah.",
  isUser: false,
  timestamp: new Date(),
};

const BOT_RESPONSES: Record<string, string> = {
  gempa:
    "Informasi Gempa Terkini (BMKG):\n\n" +
    "Magnitudo: 5.2 SR\n" +
    "Lokasi: 34 km Tenggara Cianjur, Jawa Barat\n" +
    "Kedalaman: 10 km\n" +
    "Waktu: " + new Date().toLocaleString("id-ID") + "\n\n" +
    "Tidak berpotensi tsunami.\n\n" +
    "Tips Saat Gempa:\n" +
    "1. Berlindung di bawah meja yang kokoh\n" +
    "2. Jauhi jendela dan benda yang bisa jatuh\n" +
    "3. Jika di luar, jauhi gedung dan tiang listrik\n" +
    "4. Setelah gempa, periksa kerusakan dan siap evakuasi",
  p3k:
    "Panduan Pertolongan Pertama (P3K):\n\n" +
    "Luka Ringan:\n" +
    "1. Bersihkan luka dengan air mengalir\n" +
    "2. Oleskan antiseptik (Betadine/Povidone)\n" +
    "3. Tutup dengan perban steril\n\n" +
    "Patah Tulang:\n" +
    "1. Jangan menggerakkan bagian yang patah\n" +
    "2. Stabilkan dengan bidai/splint\n" +
    "3. Kompres es untuk kurangi bengkak\n\n" +
    "Luka Bakar:\n" +
    "1. Siram air dingin mengalir 10-20 menit\n" +
    "2. Jangan pecahkan lepuhan\n" +
    "3. Tutup dengan kain bersih\n\n" +
    "CPR (Resusitasi):\n" +
    "1. Pastikan area aman\n" +
    "2. Tekan dada 30x, napas buatan 2x\n" +
    "3. Ulangi hingga bantuan datang\n\n" +
    "Hubungi 119 untuk ambulans darurat.",
  shelter:
    "Shelter & Posko Terdekat:\n\n" +
    "1. Posko Utama - Balai Desa\n" +
    "   Jl. Raya No. 1 (0.5 km)\n" +
    "   Kapasitas: 200 orang\n" +
    "   Fasilitas: Tenda, MCK, Dapur Umum\n\n" +
    "2. GOR Kecamatan\n" +
    "   Jl. Merdeka No. 45 (1.2 km)\n" +
    "   Kapasitas: 500 orang\n" +
    "   Fasilitas: Tenda, MCK, P3K\n\n" +
    "3. Sekolah SDN 1\n" +
    "   Jl. Pendidikan No. 10 (2.0 km)\n" +
    "   Kapasitas: 150 orang\n" +
    "   Fasilitas: Ruang kelas, MCK\n\n" +
    "Hubungi BPBD: 0800-100-1234\n" +
    "Hotline Darurat: 112",
};

function getDefaultResponse(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("gempa") || lower.includes("earthquake") || lower.includes("bmkg")) {
    return BOT_RESPONSES.gempa;
  }
  if (lower.includes("p3k") || lower.includes("luka") || lower.includes("pertolongan") || lower.includes("first aid")) {
    return BOT_RESPONSES.p3k;
  }
  if (lower.includes("shelter") || lower.includes("posko") || lower.includes("evakuasi") || lower.includes("pengungsian")) {
    return BOT_RESPONSES.shelter;
  }
  if (lower.includes("banjir") || lower.includes("flood")) {
    return "Tips Menghadapi Banjir:\n\n1. Pindahkan barang berharga ke tempat tinggi\n2. Matikan listrik jika air mulai naik\n3. Siapkan tas darurat (dokumen, obat, makanan)\n4. Evakuasi ke tempat yang lebih tinggi\n5. Jangan berjalan di arus air yang deras\n6. Hubungi BPBD atau 112 untuk bantuan\n\nSetelah banjir surut:\n- Bersihkan rumah dari lumpur\n- Periksa instalasi listrik sebelum menyalakan\n- Buang makanan yang terendam";
  }
  if (lower.includes("kebakaran") || lower.includes("fire") || lower.includes("api")) {
    return "Panduan Saat Kebakaran:\n\n1. Segera keluar dari bangunan\n2. Merunduk jika ada asap tebal\n3. Jangan gunakan lift\n4. Tutup hidung dengan kain basah\n5. Jangan membuka pintu yang terasa panas\n6. Hubungi 113 (Pemadam Kebakaran)\n\nJika terjebak:\n- Tutup celah pintu dengan kain basah\n- Beri sinyal dari jendela\n- Tunggu bantuan pemadam";
  }
  if (lower.includes("tsunami")) {
    return "Panduan Evakuasi Tsunami:\n\n1. Segera evakuasi ke dataran tinggi (>30 meter)\n2. Jauhi pantai dan sungai\n3. Jangan menunggu peringatan resmi jika merasakan gempa kuat\n4. Ikuti rambu-rambu evakuasi tsunami\n5. Jangan kembali sampai ada pemberitahuan aman\n\nTanda-tanda tsunami:\n- Gempa kuat di pesisir\n- Air laut surut drastis\n- Suara gemuruh dari laut\n\nHotline BMKG: 021-6546315";
  }
  if (lower.includes("halo") || lower.includes("hai") || lower.includes("hi") || lower.includes("hello")) {
    return "Halo! Saya SiagaBot, siap membantu Anda. Apa yang bisa saya bantu hari ini?\n\nAnda bisa bertanya tentang:\n- Info gempa terkini\n- Panduan P3K\n- Lokasi shelter/posko\n- Tips menghadapi banjir, kebakaran, tsunami";
  }
  return "Terima kasih atas pertanyaan Anda. Untuk informasi lebih lanjut, Anda bisa menggunakan tombol aksi cepat di bawah atau hubungi:\n\n- BPBD: 0800-100-1234\n- Ambulans: 119\n- Pemadam: 113\n- Darurat: 112\n- SAR: 115\n\nSaya siap membantu dengan info gempa, panduan P3K, atau pencarian shelter.";
}

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
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
          <View style={[styles.dot, styles.dot1]} />
          <View style={[styles.dot, styles.dot2]} />
          <View style={[styles.dot, styles.dot3]} />
        </View>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const topPadding = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const bottomPadding = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const invertedMessages = useMemo(
    () => [...messages].reverse(),
    [messages],
  );

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

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

      setTimeout(() => {
        const botResponse = getDefaultResponse(trimmed);
        const botMsg: Message = {
          id: generateId(),
          text: botResponse,
          isUser: false,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMsg]);
        setIsTyping(false);
      }, 800 + Math.random() * 700);
    },
    [],
  );

  const handleQuickAction = useCallback(
    (type: "gempa" | "p3k" | "shelter") => {
      const labels = {
        gempa: "Info Gempa BMKG",
        p3k: "Panduan P3K",
        shelter: "Cari Shelter",
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

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Ionicons name="shield-checkmark" size={22} color={C.accent} />
          </View>
          <View>
            <Text style={styles.headerTitle}>SiagaBot</Text>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Online</Text>
            </View>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.headerButton,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          testID="menu-button"
        >
          <Feather name="more-vertical" size={20} color={C.textSecondary} />
        </Pressable>
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
          contentContainerStyle={styles.chatContent}
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
                testID="chat-input"
              />
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.sendButton,
                inputText.trim()
                  ? { backgroundColor: C.accent, opacity: pressed ? 0.8 : 1 }
                  : { backgroundColor: C.surfaceLight, opacity: 0.5 },
              ]}
              onPress={handleSend}
              disabled={!inputText.trim()}
              testID="send-button"
            >
              <Ionicons
                name="send"
                size={18}
                color={inputText.trim() ? "#fff" : C.textMuted}
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.accent,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  keyboardView: {
    flex: 1,
  },
  chatList: {
    flex: 1,
  },
  chatContent: {
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
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  typingDots: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: C.textMuted,
  },
  dot1: {
    opacity: 0.4,
  },
  dot2: {
    opacity: 0.6,
  },
  dot3: {
    opacity: 0.8,
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
    paddingVertical: Platform.OS === "ios" ? 10 : 4,
    minHeight: 44,
    justifyContent: "center",
  },
  textInput: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: C.text,
    maxHeight: 100,
    lineHeight: 20,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
