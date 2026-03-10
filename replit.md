# Garda Bencana - Emergency Assistant Chatbot

## Overview
Garda Bencana is an Expo React Native web chatbot app for emergency/disaster assistance in Indonesia. Dark mode UI with real-time BMKG data integration for earthquakes and weather warnings, powered by Groq AI (Llama 3.3 70B) with keyword-based fallback.

## Architecture
- **Frontend**: Expo Router (file-based routing), single-screen chat UI at `app/index.tsx`
- **Backend**: Express server on port 5000 (landing page + API)
- **AI**: Groq API (Llama 3.3 70B) with keyword-based fallback
- **Data**: Real-time BMKG API integration (earthquakes, weather warnings)
- **State**: Local state with useState (no persistence needed for chat)
- **Styling**: React Native StyleSheet with custom dark theme in `constants/colors.ts`

## Key Files
- `app/index.tsx` - Main chat screen with full UI (inverted FlatList, quick actions, keyboard-aware input)
- `app/_layout.tsx` - Root layout with providers (fonts, QueryClient, KeyboardProvider)
- `constants/colors.ts` - Dark theme color palette
- `server/routes.ts` - Backend API routes (BMKG data + smart chat + shelters)
- `server/templates/shelter-map.html` - Leaflet map page for shelter finder
- `components/ShelterFinder.tsx` - Shelter finder modal with map and list
- `server/index.ts` - Express server entry point
- `lib/query-client.ts` - API client with getApiUrl()

## Theme Colors
- Background: `#0F1419` (deep dark)
- Surface: `#1A1F25`
- Accent: `#10B981` (emerald green)
- User bubbles: emerald green, Bot bubbles: dark surface

## Backend API Endpoints
- `GET /api/bmkg/gempa-terbaru` - Latest earthquake from BMKG
- `GET /api/bmkg/gempa-terkini` - Recent M5.0+ earthquakes
- `GET /api/bmkg/gempa-dirasakan` - Felt earthquakes
- `GET /api/bmkg/peringatan-cuaca` - Weather warnings (nowcast RSS)
- `POST /api/chat` - Smart keyword-based chat with real BMKG data
- `GET /api/shelters/nearby?lat=X&lng=Y` - Nearby shelter data
- `GET /shelter-map?lat=X&lng=Y` - Leaflet map HTML page

## Shelter Finder
- Full-screen modal with interactive Leaflet/OpenStreetMap map (dark theme)
- Geolocation to detect user position
- Generated shelter data around user's location (12 shelter types)
- Search/filter shelters by name or type
- Shelter cards with distance, capacity status, facilities
- "Rute Evakuasi" opens Google Maps directions
- Accessible from: "Cari Shelter" quick action, earthquake modal, chat responses

## Chat Features (Groq AI primary, keyword fallback)
- Earthquake data: real-time from BMKG API
- Weather warnings: real-time from BMKG nowcast RSS
- P3K/first aid guides
- Shelter/evacuation guides
- Disaster guides: banjir, kebakaran, tsunami, longsor
- Emergency numbers
- Quick action buttons: Info Gempa, Panduan P3K, Cari Shelter

## BMKG Data Sources
- Earthquakes: `https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json`, `gempaterkini.json`, `gempadirasakan.json`
- Weather warnings: `https://www.bmkg.go.id/alerts/nowcast/id` (XML RSS)

## Workflows
- `Start Backend`: `npm run server:dev` (port 5000)
- `Start Frontend`: `npm run expo:dev` (port 8081)
