# Garda Bencana - Emergency Assistant Chatbot

## Overview
Garda Bencana is an Expo React Native web chatbot app for emergency/disaster assistance in Indonesia. Dark mode UI with real-time BMKG data integration for earthquakes and weather warnings, powered by Groq AI (Llama 3.3 70B) with keyword-based fallback. Includes PetaBencana.id integration for real-time multi-hazard disaster reports.

## Architecture
- **Frontend**: Expo Router (file-based routing), single-screen chat UI at `app/index.tsx`
- **Backend**: Express server on port 5000 (landing page + API)
- **AI**: Groq API (Llama 3.3 70B) with keyword-based fallback
- **Data**: Real-time BMKG API (earthquakes, weather) + PetaBencana.id (multi-hazard disaster reports)
- **State**: Local state with useState (no persistence needed for chat)
- **Styling**: React Native StyleSheet with custom dark theme in `constants/colors.ts`

## Key Files
- `app/index.tsx` - Main chat screen with full UI (inverted FlatList, quick actions, keyboard-aware input)
- `app/_layout.tsx` - Root layout with providers (fonts, QueryClient, KeyboardProvider)
- `constants/colors.ts` - Dark theme color palette
- `server/routes.ts` - Backend API routes (BMKG data + smart chat + shelters + PetaBencana.id)
- `server/templates/shelter-map.html` - Leaflet map page for shelter finder
- `server/templates/disaster-map.html` - Leaflet map page for disaster reports
- `components/ShelterFinder.tsx` - Shelter finder modal with map and list
- `components/DisasterMap.tsx` - Disaster map modal showing real PetaBencana.id reports
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
- `GET /api/disasters/reports?disaster=X&admin=X&timeperiod=X` - PetaBencana.id disaster reports
- `GET /disaster-map?lat=X&lng=Y&zoom=X` - Disaster map HTML page

## PetaBencana.id Integration
- API base: `https://data.petabencana.id`
- Disaster types: flood, earthquake, fire, haze, wind, volcano
- Returns real crowdsourced disaster reports (GeoJSON format)
- Reports include: location, description, images, flood depth, verification status
- Default timeperiod: 604800 seconds (7 days)
- User-Agent header: "GardaBencana/1.0"

## Shelter Finder
- Full-screen modal with interactive Leaflet/OpenStreetMap map (dark theme)
- Geolocation to detect user position
- Generated shelter data around user's location (12 shelter types)
- Search/filter shelters by name or type
- Shelter cards with distance, capacity status, facilities
- "Rute Evakuasi" opens Google Maps directions
- Accessible from: "Cari Shelter" quick action, earthquake modal, chat responses

## Disaster Map (Peta Bencana)
- Full-screen modal with dark-themed Leaflet map showing real disaster reports
- Filter by disaster type: Banjir, Gempa, Kebakaran, Asap, Angin, Gunung Berapi
- Report cards with type badge, city, time, description, flood depth, verification status
- Clickable reports focus map on report location
- Detail modal with full description, image, and coordinates
- Data from PetaBencana.id (real crowdsourced reports)

## Chat Features (Groq AI primary, keyword fallback)
- Earthquake data: real-time from BMKG API
- Weather warnings: real-time from BMKG nowcast RSS
- P3K/first aid guides
- Shelter/evacuation guides
- Disaster guides: banjir, kebakaran, tsunami, longsor
- Emergency numbers
- Quick action buttons: Info Gempa, Panduan P3K, Cari Shelter, Peta Bencana

## BMKG Data Sources
- Earthquakes: `https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json`, `gempaterkini.json`, `gempadirasakan.json`
- Weather warnings: `https://www.bmkg.go.id/alerts/nowcast/id` (XML RSS)

## Workflows
- `Start Backend`: `npm run server:dev` (port 5000)
- `Start Frontend`: `npm run expo:dev` (port 8081)
