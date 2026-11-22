# Aerial Mobile

**Aerial Mobile** is the mobile companion app for Fortnite Save the World (STW) commanders, built with React Native and Expo. It ports the core STW and account features from the desktop **Aerial Launcher** into a fast, portable mobile client.

---

## 📱 Features

1. **STW Mission Alerts (`/alerts`)**
   * Live alerts feed directly ingested from `stw.news/api/v1/missions`.
   * Public zero-authentication stream ensures alerts always load.
   * Instant filter chips: **V-Bucks Only**, **Twine Peaks**, **Canny Valley**, **Plankerton**, **Stonewood**.
   * Real-time calculation of today's total available V-Bucks across all zones.

2. **Daily Quests Tracker & Reroll (`/quests`)**
   * Inspect active daily quests from the Epic Games campaign profile.
   * View live completion progress (e.g., 4 / 6 Arcade Machines destroyed).
   * One-tap quest reroll to maximize 60 and 100 V-Bucks yields.

3. **Friends & Requests Management (`/friends`)**
   * Real-time friends list with online/away/offline statuses.
   * Fast incoming request actions: **Accept** or **Decline**.
   * Outgoing pending request cancellation.
   * Instant player search and add by Epic Games display name.

4. **Fortnite Item Shop & Gifting (`/shop`)**
   * Live Fortnite catalog feed with prices, rarities, and banners.
   * Filter items across categories (**Featured**, **Daily**, **Special Offers**).
   * In-app Gifting:
     * Friend recipient picker
     * Gift wrap box selection (**Standard**, **Birthday**, **Sweetheart**, **Festive**, **Gold**)
     * Custom gift messages

5. **Secure Epic Authentication (`/account`)**
   * Exchange code authentication directly with Epic Games OAuth.
   * Credentials securely encrypted on-device via `expo-secure-store`.
   * Offline / guest preview mode with mock data fallback.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
cd Aerial-Mobile
npm install
```

### 2. Start Expo Development Server
```bash
npx expo start
```

### 3. Running on Devices
* **Physical iOS or Android Phone:** Scan the QR code with the **Expo Go** app (downloadable from Google Play or Apple App Store).
* **Android Emulator:** Press `a` in the terminal.
* **iOS Simulator (Mac):** Press `i` in the terminal.
* **Web Preview:** Press `w` in the terminal.

---

## 🏗️ Architecture

```
Aerial-Mobile/
├── App.tsx                     # Main navigation & bottom tab controller
├── app.json                    # Expo configuration
├── package.json
├── src/
│   ├── api/
│   │   ├── epic-auth.ts        # Epic Games OAuth & token management
│   │   ├── stw-alerts.ts       # stw.news real-time missions & alert fetcher
│   │   ├── daily-quests.ts     # Epic MCP campaign daily quests & reroll API
│   │   ├── friends.ts          # Epic Friends REST API (list, accept, reject, add)
│   │   └── item-shop.ts        # Fortnite Catalog & Gifting MCP API
│   ├── components/
│   │   ├── Header.tsx          # Top bar with active account indicator
│   │   ├── AlertCard.tsx       # STW alert mission card
│   │   ├── QuestCard.tsx       # Daily quest card with reroll action
│   │   ├── FriendItem.tsx      # Friend list item with status & actions
│   │   └── ShopItemCard.tsx    # Item shop card with gift modal trigger
│   ├── screens/
│   │   ├── AlertsScreen.tsx    # STW News alerts screen (live stw.news stream)
│   │   ├── QuestsScreen.tsx    # Daily quests & reroll manager
│   │   ├── FriendsScreen.tsx   # Friends & request manager
│   │   ├── ShopScreen.tsx      # Fortnite Item Shop & Gifting
│   │   └── AccountScreen.tsx   # Epic account login & settings
│   ├── types/
│   │   └── index.ts            # TypeScript interfaces
│   └── utils/
│       └── storage.ts          # Persistent secure token storage
```
