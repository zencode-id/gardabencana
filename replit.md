# SiagaBot - Emergency Assistant Chatbot

## Overview
SiagaBot is an Expo React Native mobile chatbot app for emergency/disaster assistance in Indonesia. Dark mode UI with quick-action buttons for earthquake info, first aid guides, and shelter locations.

## Architecture
- **Frontend**: Expo Router (file-based routing), single-screen chat UI at `app/index.tsx`
- **Backend**: Express server on port 5000 (landing page + API)
- **State**: Local state with useState (no persistence needed for chat)
- **Styling**: React Native StyleSheet with custom dark theme in `constants/colors.ts`

## Key Files
- `app/index.tsx` - Main chat screen with full UI
- `app/_layout.tsx` - Root layout with providers (fonts, QueryClient, KeyboardProvider)
- `constants/colors.ts` - Dark theme color palette
- `server/index.ts` - Express server entry point

## Theme Colors
- Background: `#0F1419` (deep dark)
- Surface: `#1A1F25`
- Accent: `#10B981` (emerald green)
- User bubbles: emerald green, Bot bubbles: dark surface

## Features
- Chat with pre-built emergency responses
- Quick actions: Info Gempa BMKG, Panduan P3K, Cari Shelter
- Keyword-based responses for: gempa, banjir, kebakaran, tsunami, P3K
- Dark mode UI with green accent
- Typing indicator animation
- Keyboard-aware input

## Workflows
- `Start Backend`: `npm run server:dev` (port 5000)
- `Start Frontend`: `npm run expo:dev` (port 8081)
