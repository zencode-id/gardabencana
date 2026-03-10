import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Modal,
  FlatList,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { getApiUrl } from "@/lib/query-client";
import Colors from "@/constants/colors";

const C = Colors.dark;

interface DisasterReport {
  id: string;
  type: string;
  typeLabel: string;
  text: string;
  title: string;
  imageUrl: string | null;
  source: string;
  status: string;
  createdAt: string;
  lng: number;
  lat: number;
  city: string;
  regionCode: string;
  floodDepth: number | null;
}

type DisasterFilter = "" | "flood" | "earthquake" | "fire" | "haze" | "wind" | "volcano";

const FILTERS: { key: DisasterFilter; label: string; icon: string; color: string }[] = [
  { key: "", label: "Semua", icon: "layers-outline", color: "#10B981" },
  { key: "flood", label: "Banjir", icon: "water", color: "#3B82F6" },
  { key: "earthquake", label: "Gempa", icon: "earth", color: "#F59E0B" },
  { key: "fire", label: "Kebakaran", icon: "flame", color: "#EF4444" },
  { key: "haze", label: "Asap", icon: "cloud", color: "#8B5CF6" },
  { key: "wind", label: "Angin", icon: "thunderstorm", color: "#06B6D4" },
  { key: "volcano", label: "Gunung", icon: "triangle", color: "#F97316" },
];

function getDisasterColor(type: string): string {
  const colors: Record<string, string> = {
    flood: "#3B82F6",
    earthquake: "#F59E0B",
    fire: "#EF4444",
    haze: "#8B5CF6",
    wind: "#06B6D4",
    volcano: "#F97316",
  };
  return colors[type] || "#10B981";
}

function getDisasterIcon(type: string): string {
  const icons: Record<string, string> = {
    flood: "water",
    earthquake: "earth",
    fire: "flame",
    haze: "cloud",
    wind: "thunderstorm",
    volcano: "triangle",
  };
  return icons[type] || "alert-circle";
}

function timeAgoShort(dateStr: string): string {
  const now = new Date();
  const past = new Date(dateStr);
  const diffMs = now.getTime() - past.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Baru saja";
  if (diffMin < 60) return `${diffMin}m lalu`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}j lalu`;
  return `${Math.floor(diffHr / 24)}h lalu`;
}

function ReportCard({ report, onPress }: { report: DisasterReport; onPress: () => void }) {
  const color = getDisasterColor(report.type);
  const iconName = getDisasterIcon(report.type);

  return (
    <Pressable
      style={({ pressed }) => [
        cardStyles.container,
        { opacity: pressed ? 0.8 : 1, borderLeftColor: color },
      ]}
      onPress={onPress}
    >
      <View style={cardStyles.header}>
        <View style={[cardStyles.iconWrap, { backgroundColor: color + "18" }]}>
          <Ionicons name={iconName as any} size={18} color={color} />
        </View>
        <View style={cardStyles.headerInfo}>
          <View style={cardStyles.titleRow}>
            <View style={[cardStyles.typeBadge, { backgroundColor: color + "18", borderColor: color + "33" }]}>
              <Text style={[cardStyles.typeText, { color }]}>{report.typeLabel}</Text>
            </View>
            <Text style={cardStyles.time}>{timeAgoShort(report.createdAt)}</Text>
          </View>
          <Text style={cardStyles.city} numberOfLines={1}>
            {report.city || "Indonesia"}
          </Text>
        </View>
      </View>

      {report.text ? (
        <Text style={cardStyles.text} numberOfLines={2}>
          {report.text}
        </Text>
      ) : null}

      <View style={cardStyles.footer}>
        {report.floodDepth && (
          <View style={cardStyles.depthBadge}>
            <MaterialCommunityIcons name="waves" size={12} color="#3B82F6" />
            <Text style={cardStyles.depthText}>{report.floodDepth} cm</Text>
          </View>
        )}
        <View style={cardStyles.sourceBadge}>
          <Text style={cardStyles.sourceText}>{report.source}</Text>
        </View>
        {report.status === "confirmed" && (
          <View style={[cardStyles.statusBadge, { backgroundColor: "#10B98118" }]}>
            <Ionicons name="checkmark-circle" size={10} color="#10B981" />
            <Text style={[cardStyles.statusText, { color: "#10B981" }]}>Terverifikasi</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 3,
  },
  header: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  typeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  time: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.textMuted,
  },
  city: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  text: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  footer: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },
  depthBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "#3B82F618",
    borderRadius: 6,
  },
  depthText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#3B82F6",
  },
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: C.quickAction,
    borderRadius: 6,
  },
  sourceText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: C.textMuted,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
});

export default function DisasterMap({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [reports, setReports] = useState<DisasterReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<DisasterFilter>("");
  const [selectedReport, setSelectedReport] = useState<DisasterReport | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const fetchReports = useCallback(async (filter: DisasterFilter) => {
    setLoading(true);
    try {
      const url = new URL("/api/disasters/reports", getApiUrl());
      url.searchParams.set("timeperiod", "604800");
      if (filter) url.searchParams.set("disaster", filter);
      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) {
        setReports(data.data);
      }
    } catch (e) {
      console.error("Failed to fetch disaster reports:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (visible) {
      fetchReports(activeFilter);
      setSelectedReport(null);
    }
  }, [visible, activeFilter, fetchReports]);

  useEffect(() => {
    if (Platform.OS === "web" && visible) {
      const handleMessage = (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "map-ready") {
            setMapReady(true);
          }
        } catch {}
      };
      window.addEventListener("message", handleMessage);
      return () => window.removeEventListener("message", handleMessage);
    }
  }, [visible]);

  useEffect(() => {
    if (mapReady && reports.length > 0 && Platform.OS === "web") {
      sendToMap({ type: "disaster-reports", reports });
    }
  }, [mapReady, reports]);

  const sendToMap = useCallback((data: any) => {
    if (Platform.OS === "web" && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(JSON.stringify(data), "*");
    }
  }, []);

  const handleFilterChange = useCallback((filter: DisasterFilter) => {
    setActiveFilter(filter);
    setMapReady(false);
  }, []);

  const handleReportPress = useCallback((report: DisasterReport) => {
    setSelectedReport(report);
    sendToMap({ type: "focus", lat: report.lat, lng: report.lng });
  }, [sendToMap]);

  const centerLat = reports.length > 0 ? reports[0].lat : -2.5;
  const centerLng = reports.length > 0 ? reports[0].lng : 118;
  const mapUrl = `${getApiUrl()}/disaster-map?lat=${centerLat}&lng=${centerLng}&zoom=5`;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={s.container}>
        <View style={s.header}>
          <Pressable
            style={({ pressed }) => [s.backBtn, { opacity: pressed ? 0.6 : 1 }]}
            onPress={onClose}
          >
            <Ionicons name="arrow-back" size={22} color={C.text} />
          </Pressable>
          <Text style={s.headerTitle}>Peta Bencana</Text>
          <Pressable
            style={({ pressed }) => [s.refreshBtn, { opacity: pressed ? 0.6 : 1 }]}
            onPress={() => fetchReports(activeFilter)}
          >
            <Feather name="refresh-cw" size={18} color={C.textSecondary} />
          </Pressable>
        </View>

        <View style={s.filterRow}>
          <FlatList
            horizontal
            data={FILTERS}
            keyExtractor={(item) => item.key}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.filterContent}
            renderItem={({ item }) => {
              const isActive = item.key === activeFilter;
              return (
                <Pressable
                  style={[
                    s.filterChip,
                    isActive && { backgroundColor: item.color + "22", borderColor: item.color + "44" },
                  ]}
                  onPress={() => handleFilterChange(item.key)}
                >
                  <Ionicons
                    name={item.icon as any}
                    size={14}
                    color={isActive ? item.color : C.textMuted}
                  />
                  <Text
                    style={[
                      s.filterLabel,
                      isActive && { color: item.color },
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>

        <View style={s.mapContainer}>
          {Platform.OS === "web" ? (
            <iframe
              ref={iframeRef as any}
              src={mapUrl}
              style={{ width: "100%", height: "100%", border: "none" }}
              title="Disaster Map"
            />
          ) : (
            <View style={s.mapPlaceholder}>
              <MaterialCommunityIcons name="map-marker-radius" size={48} color={C.accent} />
              <Text style={s.mapPlaceholderText}>Peta tersedia di versi web</Text>
            </View>
          )}
        </View>

        <View style={s.listSection}>
          <View style={s.listHeader}>
            <Text style={s.listTitle}>Laporan Bencana</Text>
            <View style={s.countBadge}>
              <Text style={s.countText}>{reports.length} Laporan (7 hari)</Text>
            </View>
          </View>

          {loading ? (
            <View style={s.loadingContainer}>
              <ActivityIndicator size="large" color={C.accent} />
              <Text style={s.loadingText}>Memuat data bencana...</Text>
            </View>
          ) : reports.length === 0 ? (
            <View style={s.emptyContainer}>
              <Ionicons name="checkmark-circle" size={48} color={C.accent} />
              <Text style={s.emptyTitle}>Tidak Ada Laporan</Text>
              <Text style={s.emptyText}>
                Tidak ada laporan bencana {activeFilter ? FILTERS.find(f => f.key === activeFilter)?.label.toLowerCase() : ""} dalam 7 hari terakhir.
              </Text>
            </View>
          ) : (
            <FlatList
              data={reports}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <ReportCard report={item} onPress={() => handleReportPress(item)} />
              )}
              contentContainerStyle={s.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>

        {selectedReport && (
          <Modal
            visible={!!selectedReport}
            animationType="fade"
            transparent
            onRequestClose={() => setSelectedReport(null)}
          >
            <View style={detailStyles.overlay}>
              <View style={detailStyles.card}>
                <View style={detailStyles.header}>
                  <View style={[detailStyles.typeBadge, { backgroundColor: getDisasterColor(selectedReport.type) + "22" }]}>
                    <Ionicons name={getDisasterIcon(selectedReport.type) as any} size={16} color={getDisasterColor(selectedReport.type)} />
                    <Text style={[detailStyles.typeText, { color: getDisasterColor(selectedReport.type) }]}>
                      {selectedReport.typeLabel}
                    </Text>
                  </View>
                  <Pressable onPress={() => setSelectedReport(null)}>
                    <Ionicons name="close" size={22} color={C.textSecondary} />
                  </Pressable>
                </View>

                <Text style={detailStyles.city}>{selectedReport.city || "Indonesia"}</Text>
                <Text style={detailStyles.time}>
                  {new Date(selectedReport.createdAt).toLocaleString("id-ID")}
                </Text>

                {selectedReport.text ? (
                  <Text style={detailStyles.text}>{selectedReport.text}</Text>
                ) : null}

                {selectedReport.imageUrl && (
                  <View style={detailStyles.imageContainer}>
                    <Image
                      source={{ uri: selectedReport.imageUrl }}
                      style={detailStyles.image}
                      resizeMode="cover"
                    />
                  </View>
                )}

                <View style={detailStyles.metaRow}>
                  {selectedReport.floodDepth && (
                    <View style={detailStyles.metaBadge}>
                      <MaterialCommunityIcons name="waves" size={14} color="#3B82F6" />
                      <Text style={detailStyles.metaLabel}>Kedalaman: {selectedReport.floodDepth} cm</Text>
                    </View>
                  )}
                  <View style={detailStyles.metaBadge}>
                    <Ionicons name="location" size={14} color={C.accent} />
                    <Text style={detailStyles.metaLabel}>
                      {selectedReport.lat.toFixed(4)}, {selectedReport.lng.toFixed(4)}
                    </Text>
                  </View>
                </View>

                <Text style={detailStyles.source}>
                  Sumber: PetaBencana.id • {selectedReport.source}
                </Text>
              </View>
            </View>
          </Modal>
        )}
      </View>
    </Modal>
  );
}

const detailStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: C.background,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  typeText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  city: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: C.text,
    marginBottom: 4,
  },
  time: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textMuted,
    marginBottom: 12,
  },
  text: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  imageContainer: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
  },
  image: {
    width: "100%",
    height: 180,
    borderRadius: 12,
  },
  metaRow: {
    gap: 8,
    marginBottom: 12,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: C.textSecondary,
  },
  source: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.textMuted,
    textAlign: "center",
  },
});

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
    paddingVertical: 12,
    paddingTop: Platform.OS === "web" ? 67 : 50,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  filterRow: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  filterContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  filterLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: C.textMuted,
  },
  mapContainer: {
    height: 200,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  mapPlaceholderText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textMuted,
  },
  listSection: {
    flex: 1,
    marginTop: 8,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  listTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: C.quickAction,
    borderWidth: 1,
    borderColor: C.quickActionBorder,
  },
  countText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: C.accent,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textMuted,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textMuted,
    textAlign: "center",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "web" ? 34 : 20,
  },
});
