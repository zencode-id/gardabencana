import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Modal,
  ScrollView,
  Linking,
  Alert,
} from "react-native";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";

const C = Colors.dark;

interface ReportDisasterProps {
  visible: boolean;
  onClose: () => void;
}

const DISASTER_TYPES = [
  { key: "flood", label: "Banjir", icon: "water" as const, color: "#3B82F6", emoji: "💧" },
  { key: "earthquake", label: "Gempabumi", icon: "earth" as const, color: "#F59E0B", emoji: "🌍" },
  { key: "fire", label: "Kebakaran", icon: "fire" as const, color: "#EF4444", emoji: "🔥" },
  { key: "haze", label: "Kabut Asap", icon: "weather-fog" as const, color: "#8B5CF6", emoji: "🌫️" },
  { key: "wind", label: "Angin Kencang", icon: "weather-windy" as const, color: "#06B6D4", emoji: "💨" },
  { key: "volcano", label: "Gunung Api", icon: "volcano" as const, color: "#F97316", emoji: "🌋" },
];

const CHANNELS = [
  {
    key: "whatsapp",
    label: "WhatsApp",
    subtitle: "Chat langsung dengan bot",
    icon: "logo-whatsapp" as const,
    iconType: "ionicon" as const,
    color: "#25D366",
    url: "https://wa.me/6281115588888",
  },
  {
    key: "telegram",
    label: "Telegram",
    subtitle: "Kirim laporan via Telegram",
    icon: "paper-plane" as const,
    iconType: "ionicon" as const,
    color: "#0088CC",
    url: "https://t.me/petaborat",
  },
  {
    key: "twitter",
    label: "X (Twitter)",
    subtitle: "Tweet @PetaBencana",
    icon: "logo-twitter" as const,
    iconType: "ionicon" as const,
    color: "#1DA1F2",
    url: "https://twitter.com/intent/tweet?text=@petaborat%20",
  },
  {
    key: "web",
    label: "PetaBencana.id",
    subtitle: "Buka peta & lapor langsung",
    icon: "globe" as const,
    iconType: "feather" as const,
    color: "#10B981",
    url: "https://petabencana.id",
  },
];

const STEPS = [
  { num: "1", text: "Pilih jenis bencana yang terjadi" },
  { num: "2", text: "Pilih channel pelaporan" },
  { num: "3", text: "Ikuti instruksi bot untuk melengkapi laporan" },
  { num: "4", text: "Laporan akan muncul di peta bencana" },
];

export default function ReportDisaster({ visible, onClose }: ReportDisasterProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [step, setStep] = useState<"type" | "channel">("type");

  useEffect(() => {
    if (!visible) {
      setSelectedType(null);
      setStep("type");
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    setSelectedType(null);
    setStep("type");
    onClose();
  }, [onClose]);

  const handleSelectType = useCallback((type: string) => {
    setSelectedType(type);
    setStep("channel");
    if (Platform.OS !== "web") {
      import("expo-haptics").then((Haptics) =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      );
    }
  }, []);

  const handleBack = useCallback(() => {
    setStep("type");
    setSelectedType(null);
  }, []);

  const handleOpenChannel = useCallback(
    (channel: (typeof CHANNELS)[number]) => {
      const selectedDisaster = DISASTER_TYPES.find((d) => d.key === selectedType);
      let url = channel.url;

      if (channel.key === "twitter" && selectedDisaster) {
        url = `https://twitter.com/intent/tweet?text=@petaborat%20${encodeURIComponent(selectedDisaster.label)}`;
      }
      if (channel.key === "whatsapp" && selectedDisaster) {
        url = `https://wa.me/6281115588888?text=${encodeURIComponent(`Lapor ${selectedDisaster.label}`)}`;
      }

      Linking.openURL(url).catch(() => {
        if (Platform.OS === "web") {
          window.open(url, "_blank");
        } else {
          Alert.alert("Gagal Membuka", "Tidak dapat membuka aplikasi. Silakan coba channel lain.");
        }
      });

      if (Platform.OS !== "web") {
        import("expo-haptics").then((Haptics) =>
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        );
      }
    },
    [selectedType],
  );

  const selectedDisaster = DISASTER_TYPES.find((d) => d.key === selectedType);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <View style={s.container}>
        <View style={s.header}>
          <Pressable
            style={({ pressed }) => [s.backBtn, { opacity: pressed ? 0.6 : 1 }]}
            onPress={step === "channel" ? handleBack : handleClose}
          >
            <Ionicons name="arrow-back" size={22} color={C.text} />
          </Pressable>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>
              {step === "type" ? "Lapor Bencana" : "Pilih Channel"}
            </Text>
            <Text style={s.headerSub}>via PetaBencana.id</Text>
          </View>
          <Pressable
            style={({ pressed }) => [s.closeBtn, { opacity: pressed ? 0.6 : 1 }]}
            onPress={handleClose}
          >
            <Ionicons name="close" size={22} color={C.text} />
          </Pressable>
        </View>

        <ScrollView
          style={s.content}
          contentContainerStyle={s.contentInner}
          showsVerticalScrollIndicator={false}
        >
          {step === "type" && (
            <>
              <View style={s.infoCard}>
                <View style={s.infoIconRow}>
                  <MaterialCommunityIcons name="information" size={20} color={C.accent} />
                  <Text style={s.infoTitle}>Cara Melapor</Text>
                </View>
                <View style={s.stepsContainer}>
                  {STEPS.map((st) => (
                    <View key={st.num} style={s.stepRow}>
                      <View style={s.stepNum}>
                        <Text style={s.stepNumText}>{st.num}</Text>
                      </View>
                      <Text style={s.stepText}>{st.text}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <Text style={s.sectionTitle}>Pilih Jenis Bencana</Text>

              <View style={s.typeGrid}>
                {DISASTER_TYPES.map((dt) => (
                  <Pressable
                    key={dt.key}
                    style={({ pressed }) => [
                      s.typeCard,
                      {
                        borderColor: selectedType === dt.key ? dt.color : C.border,
                        opacity: pressed ? 0.8 : 1,
                        transform: [{ scale: pressed ? 0.96 : 1 }],
                      },
                    ]}
                    onPress={() => handleSelectType(dt.key)}
                    testID={`report-type-${dt.key}`}
                  >
                    <View style={[s.typeIconWrap, { backgroundColor: dt.color + "20" }]}>
                      <Text style={s.typeEmoji}>{dt.emoji}</Text>
                    </View>
                    <Text style={s.typeLabel}>{dt.label}</Text>
                    <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {step === "channel" && selectedDisaster && (
            <>
              <View style={s.selectedBadge}>
                <View style={[s.selectedIcon, { backgroundColor: selectedDisaster.color + "20" }]}>
                  <Text style={{ fontSize: 24 }}>{selectedDisaster.emoji}</Text>
                </View>
                <View>
                  <Text style={s.selectedLabel}>Melaporkan</Text>
                  <Text style={[s.selectedType, { color: selectedDisaster.color }]}>
                    {selectedDisaster.label}
                  </Text>
                </View>
              </View>

              <Text style={s.sectionTitle}>Pilih Channel Pelaporan</Text>

              <View style={s.channelList}>
                {CHANNELS.map((ch) => (
                  <Pressable
                    key={ch.key}
                    style={({ pressed }) => [
                      s.channelCard,
                      {
                        opacity: pressed ? 0.8 : 1,
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                      },
                    ]}
                    onPress={() => handleOpenChannel(ch)}
                    testID={`report-channel-${ch.key}`}
                  >
                    <View style={[s.channelIcon, { backgroundColor: ch.color + "20" }]}>
                      {ch.iconType === "feather" ? (
                        <Feather name={ch.icon as any} size={22} color={ch.color} />
                      ) : (
                        <Ionicons name={ch.icon as any} size={22} color={ch.color} />
                      )}
                    </View>
                    <View style={s.channelInfo}>
                      <Text style={s.channelLabel}>{ch.label}</Text>
                      <Text style={s.channelSub}>{ch.subtitle}</Text>
                    </View>
                    <View style={[s.channelArrow, { backgroundColor: ch.color + "15" }]}>
                      <Ionicons name="open-outline" size={16} color={ch.color} />
                    </View>
                  </Pressable>
                ))}
              </View>

              <View style={s.noteCard}>
                <Feather name="info" size={16} color={C.textSecondary} />
                <Text style={s.noteText}>
                  Anda akan diarahkan ke channel resmi PetaBencana.id. Ikuti instruksi dari bot
                  untuk melengkapi laporan Anda. Laporan yang terverifikasi akan muncul di peta bencana.
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "web" ? 67 : 0,
    paddingBottom: 14,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  headerSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.accent,
    marginTop: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 16,
    paddingBottom: Platform.OS === "web" ? 50 : 34,
  },
  infoCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.accent + "30",
  },
  infoIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: C.accent,
  },
  stepsContainer: {
    gap: 10,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.accent + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: C.accent,
  },
  stepText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: C.text,
    marginBottom: 12,
  },
  typeGrid: {
    gap: 10,
  },
  typeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    gap: 12,
  },
  typeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  typeEmoji: {
    fontSize: 22,
  },
  typeLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  selectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  selectedIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
  selectedType: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginTop: 2,
  },
  channelList: {
    gap: 10,
  },
  channelCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
  },
  channelIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  channelInfo: {
    flex: 1,
  },
  channelLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  channelSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    marginTop: 2,
  },
  channelArrow: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  noteCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    lineHeight: 18,
  },
});
