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
  TextInput,
  Linking,
} from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { getApiUrl } from "@/lib/query-client";
import Colors from "@/constants/colors";

const C = Colors.dark;

function getShelterMapHtml(lat: number, lng: number): string {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0F1419;overflow:hidden}
#map{width:100%;height:100vh}
.leaflet-container{background:#0F1419}
.custom-popup .leaflet-popup-content-wrapper{background:#1A1F25;color:#E7E9EA;border:1px solid #2F3740;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,sans-serif}
.custom-popup .leaflet-popup-tip{background:#1A1F25;border:1px solid #2F3740}
.popup-name{font-weight:700;font-size:13px;margin-bottom:4px}
.popup-info{font-size:11px;color:#8B98A5}
.popup-cap{display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;margin-top:4px}
.cap-tersedia{background:#10B98122;color:#10B981}
.cap-terbatas{background:#F59E0B22;color:#F59E0B}
.cap-penuh{background:#EF444422;color:#EF4444}
</style>
</head><body>
<div id="map"></div>
<script>
var lat=${lat},lng=${lng};
var map=L.map('map',{center:[lat,lng],zoom:14,zoomControl:false,attributionControl:false});
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:19}).addTo(map);
L.control.zoom({position:'topright'}).addTo(map);
var userIcon=L.divIcon({html:'<div style="width:16px;height:16px;background:#3B82F6;border:3px solid #fff;border-radius:50%;box-shadow:0 0 10px rgba(59,130,246,0.5);"></div>',iconSize:[16,16],iconAnchor:[8,8],className:''});
var shelterIcon=L.divIcon({html:'<div style="width:32px;height:32px;background:#10B981;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);"><svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2L2 12h3v8h6v-6h2v6h6v-8h3L12 2z"/></svg></div>',iconSize:[32,32],iconAnchor:[16,32],popupAnchor:[0,-32],className:''});
L.marker([lat,lng],{icon:userIcon}).addTo(map).bindPopup('<div class="popup-name">Lokasi Anda</div>');
window.addEventListener('message',function(e){
try{var d=JSON.parse(e.data);
if(d.type==='shelters'){d.shelters.forEach(function(s){
var capClass=s.capacity==='Kapasitas Tersedia'?'cap-tersedia':s.capacity==='Kapasitas Terbatas'?'cap-terbatas':'cap-penuh';
var popup='<div class="popup-name">'+s.name+'</div><div class="popup-info">'+s.distance+' \\u2022 '+s.type+'</div><div class="popup-cap '+capClass+'">'+s.capacity+'</div>';
L.marker([s.lat,s.lng],{icon:shelterIcon}).addTo(map).bindPopup(popup,{className:'custom-popup'});
})}
if(d.type==='focus')map.setView([d.lat,d.lng],16);
if(d.type==='route'){var rl=L.polyline([[lat,lng],[d.lat,d.lng]],{color:'#10B981',weight:3,dashArray:'8, 8',opacity:0.8}).addTo(map);map.fitBounds(rl.getBounds(),{padding:[40,40]})}
}catch(err){}
});
if(window.parent!==window)window.parent.postMessage(JSON.stringify({type:'map-ready'}),'*');
<\/script></body></html>`;
}

interface Shelter {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  distance: string;
  distanceKm: number;
  capacity: string;
  facilities: string;
}

function CapacityBadge({ capacity }: { capacity: string }) {
  const isAvailable = capacity === "Kapasitas Tersedia";
  const isLimited = capacity === "Kapasitas Terbatas";
  const color = isAvailable ? "#10B981" : isLimited ? "#F59E0B" : "#EF4444";
  const icon = isAvailable ? "checkmark-circle" : isLimited ? "alert-circle" : "close-circle";

  return (
    <View style={[capStyles.badge, { backgroundColor: color + "18", borderColor: color + "33" }]}>
      <Ionicons name={icon as any} size={12} color={color} />
      <Text style={[capStyles.text, { color }]}>{capacity}</Text>
    </View>
  );
}

const capStyles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  text: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});

function ShelterCard({
  shelter,
  onRoute,
  onFocus,
}: {
  shelter: Shelter;
  onRoute: (s: Shelter) => void;
  onFocus: (s: Shelter) => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        cardStyles.container,
        { opacity: pressed ? 0.8 : 1 },
      ]}
      onPress={() => onFocus(shelter)}
    >
      <View style={cardStyles.header}>
        <View style={cardStyles.iconContainer}>
          <Ionicons name="home" size={18} color={C.accent} />
        </View>
        <View style={cardStyles.info}>
          <View style={cardStyles.nameRow}>
            <Text style={cardStyles.name} numberOfLines={1}>{shelter.name}</Text>
            <CapacityBadge capacity={shelter.capacity} />
          </View>
          <View style={cardStyles.metaRow}>
            <View style={cardStyles.metaItem}>
              <Ionicons name="navigate" size={12} color={C.textMuted} />
              <Text style={cardStyles.metaText}>{shelter.distance}</Text>
            </View>
            <Text style={cardStyles.dot}>•</Text>
            <Text style={cardStyles.metaText}>{shelter.type}</Text>
          </View>
          <Text style={cardStyles.facilities} numberOfLines={1}>
            {shelter.facilities}
          </Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [
          cardStyles.routeBtn,
          { opacity: pressed ? 0.7 : 1 },
        ]}
        onPress={() => onRoute(shelter)}
      >
        <MaterialCommunityIcons name="navigation-variant" size={16} color={C.accent} />
        <Text style={cardStyles.routeBtnText}>Rute Evakuasi</Text>
      </Pressable>
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 10,
  },
  header: {
    flexDirection: "row",
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.quickAction,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.quickActionBorder,
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  name: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: C.text,
    flex: 1,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 3,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textMuted,
  },
  dot: {
    fontSize: 12,
    color: C.textMuted,
  },
  facilities: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
  routeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: C.quickAction,
    borderWidth: 1,
    borderColor: C.quickActionBorder,
  },
  routeBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: C.accent,
  },
});

export default function ShelterFinder({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [userLat, setUserLat] = useState(-6.2);
  const [userLng, setUserLng] = useState(106.816);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const webviewRef = useRef<WebView | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const getUserLocation = useCallback(() => {
    if (Platform.OS === "web" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLat(pos.coords.latitude);
          setUserLng(pos.coords.longitude);
          setLocationError(false);
        },
        () => {
          setLocationError(true);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setLocationError(true);
    }
  }, []);

  const sendToMap = useCallback((data: any) => {
    const payload = JSON.stringify(data);
    if (Platform.OS === "web" && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(payload, "*");
    } else if (Platform.OS !== "web" && webviewRef.current) {
      const script = `
        try {
          window.dispatchEvent(new MessageEvent('message', { data: '${payload}' }));
        } catch(e) {}
        true;
      `;
      webviewRef.current.injectJavaScript(script);
    }
  }, []);

  const fetchShelters = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL("/api/shelters/nearby", getApiUrl());
      url.searchParams.set("lat", userLat.toString());
      url.searchParams.set("lng", userLng.toString());
      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) {
        setShelters(data.data);
        if (mapLoaded && Platform.OS === "web") {
          sendToMap({
            type: "shelters",
            shelters: data.data,
          });
        }
      }
    } catch (e) {
      console.error("Failed to fetch shelters:", e);
    }
    setLoading(false);
  }, [userLat, userLng, mapLoaded, sendToMap]);

  useEffect(() => {
    if (visible) {
      getUserLocation();
    }
  }, [visible, getUserLocation]);

  useEffect(() => {
    if (visible) {
      fetchShelters();
    }
  }, [visible, fetchShelters]);

  useEffect(() => {
    if (Platform.OS === "web" && visible) {
      const handleMessage = (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "map-ready") {
            setMapLoaded(true);
            if (shelters.length > 0) {
              sendToMap({ type: "shelters", shelters });
            }
          }
        } catch {}
      };
      window.addEventListener("message", handleMessage);
      return () => window.removeEventListener("message", handleMessage);
    }
  }, [visible, shelters, sendToMap]);

  const handleRoute = useCallback((shelter: Shelter) => {
    if (Platform.OS === "web") {
      const mapsUrl = `https://www.google.com/maps/dir/${userLat},${userLng}/${shelter.lat},${shelter.lng}`;
      window.open(mapsUrl, "_blank");
    } else {
      const mapsUrl = `https://www.google.com/maps/dir/${userLat},${userLng}/${shelter.lat},${shelter.lng}`;
      Linking.openURL(mapsUrl);
    }
  }, [userLat, userLng]);

  const handleFocus = useCallback((shelter: Shelter) => {
    sendToMap({ type: "focus", lat: shelter.lat, lng: shelter.lng });
  }, [sendToMap]);

  const filteredShelters = searchQuery
    ? shelters.filter(
        (s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.type.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : shelters;

  const mapHtml = getShelterMapHtml(userLat, userLng);

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
          <Text style={s.headerTitle}>Cari Shelter</Text>
          <Pressable
            style={({ pressed }) => [s.refreshBtn, { opacity: pressed ? 0.6 : 1 }]}
            onPress={fetchShelters}
          >
            <Feather name="refresh-cw" size={18} color={C.textSecondary} />
          </Pressable>
        </View>

        <View style={s.searchContainer}>
          <Ionicons name="search" size={18} color={C.textMuted} />
          <TextInput
            style={[s.searchInput, Platform.OS === "web" && { outlineStyle: "none" as any }]}
            placeholder="Cari area atau shelter terdekat..."
            placeholderTextColor={C.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={s.mapContainer}>
          {Platform.OS === "web" ? (
            <iframe
              ref={iframeRef as any}
              srcDoc={mapHtml}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                borderRadius: 0,
              }}
              title="Shelter Map"
            />
          ) : (
             <WebView
              ref={webviewRef}
              source={{ html: mapHtml }}
              style={{ flex: 1, backgroundColor: "transparent" }}
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data.type === "map-ready") {
                    setMapLoaded(true);
                    if (shelters.length > 0) {
                      sendToMap({ type: "shelters", shelters });
                    }
                  }
                } catch {}
              }}
              javaScriptEnabled={true}
              scrollEnabled={false}
            />
          )}

          {locationError && (
            <View style={s.locationErrorBanner}>
              <Ionicons name="location-outline" size={14} color="#F59E0B" />
              <Text style={s.locationErrorText}>
                Lokasi tidak tersedia. Menampilkan area default.
              </Text>
            </View>
          )}
        </View>

        <View style={s.listSection}>
          <View style={s.listHeader}>
            <Text style={s.listTitle}>Shelter Terdekat</Text>
            <View style={s.countBadge}>
              <Text style={s.countText}>{filteredShelters.length} Ditemukan</Text>
            </View>
          </View>

          {loading ? (
            <View style={s.loadingContainer}>
              <ActivityIndicator size="large" color={C.accent} />
              <Text style={s.loadingText}>Mencari shelter terdekat...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredShelters}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <ShelterCard
                  shelter={item}
                  onRoute={handleRoute}
                  onFocus={handleFocus}
                />
              )}
              contentContainerStyle={s.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
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
    paddingVertical: 12,
    paddingTop: Platform.OS === "web" ? 12 : 50,
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
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.text,
  },
  mapContainer: {
    height: 220,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.border,
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
  locationErrorBanner: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#F59E0B18",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#F59E0B33",
  },
  locationErrorText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#F59E0B",
  },
  listSection: {
    flex: 1,
    marginTop: 12,
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
    fontSize: 12,
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
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "web" ? 34 : 20,
  },
});
