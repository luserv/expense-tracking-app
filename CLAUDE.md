# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm install
npm run start            # Expo dev server (Android + Web)
npm run android          # Run on Android emulator/device
npm run lint             # ESLint

# Electron (Desktop)
npm run electron:rebuild # Rebuild native modules (run once or after npm install)
npm run electron:dev     # Electron dev mode (Expo must be running on port 8081)
npm run electron:win     # Build Windows installer
npm run electron:mac     # Build macOS installer
npm run electron:linux   # Build Linux installer

# Database
npm run sqlite:seed      # Seed local SQLite with sample data
```

## Architecture

This is an **offline-first expense tracker** (control de gastos) targeting Android (via Expo/React Native) and Desktop (via Electron). Uses Expo Router for file-based navigation.

### Domain model

Three SQLite tables, defined in `utils/dbInit.ts` (shared schema):

- **account** — wallets/accounts (`account_id`, `name`, `currency`)
- **category** — transaction categories (`category_id`, `name`, `color`, `icon`, `type: income|expense`)
- **expense** — transactions (`expense_id`, `description`, `amount`, `date: YYYY-MM-DD`, `type: income|expense`, FK to category + account)

Dates are stored as ISO `YYYY-MM-DD` in the DB. The UI displays and accepts `DD/MM/YYYY`; conversion happens at the screen level.

### Platform split

Metro's extension convention drives which file is used per platform:

| File | Used on |
|------|---------|
| `utils/db.native.ts` | Android — wraps `expo-sqlite` sync API in Promises |
| `utils/db.ts` | Web/Electron — proxies calls via `window.electronDB` (IPC bridge) |
| `app/login.native.tsx` | Android — uses `@react-native-google-signin/google-signin` (native SDK) |
| `app/login.tsx` | Web/Electron — uses Firebase `signInWithPopup` / Electron OAuth window |
| `components/AdBanner.tsx` | Native — `react-native-google-mobile-ads` |
| `components/AdBanner.web.tsx` | Web/Electron — stub |

### SQLite layer

Both platforms expose the same async interface (`getAllAsync`, `getFirstAsync`, `runAsync`, `execAsync`). Schema is initialized from `utils/dbInit.ts`. On Electron, the main process (`electron/main.js`) holds the `better-sqlite3` connection and exposes it via IPC handlers (`db:exec`, `db:run`, `db:getAll`, `db:getFirst`). The preload script (`electron/preload.js`) bridges these as `window.electronDB`.

Electron DB file: `app.getPath('userData')/gastos.db` (persists across updates).

### State management

`utils/context.tsx` — `ExpensesProvider` / `useExpenses` — all CRUD for expenses, categories, and accounts. All operations call `db.*` directly; no network calls for data. Key methods: `fetchExpenses(year, month)`, `createExpense`, `updateExpense`, `deleteExpense`, `getExpense`, `getCategories`, `createCategory`, `getAccounts`, `createAccount`, `getMonthSummary(year, month)`, `searchExpenses`.

### Auth

`utils/authContext.tsx` — `AuthProvider` / `useAuth` — Firebase Google Sign-In with a guest mode fallback persisted via `AsyncStorage`. A `licenses/{uid}` Firestore document controls the `licensed` flag (gates ad removal). The root layout wraps the app in `AuthGate`, which redirects unauthenticated non-guest users to `/login`.

Provider nesting in `app/_layout.tsx`:
```
I18nProvider → AuthProvider → ExpensesProvider → GestureHandlerRootView → AuthGate
```

### Screens

| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/(tabs)/index.tsx` | Month selector, income/expense/balance summary, transaction list, add modal |
| `/config` | `app/(tabs)/config.tsx` | Language, categories, accounts, DB backup, user/upgrade |
| `/expense/[id]` | `app/expense/[id].tsx` | Edit or delete a transaction |
| `/login` | `app/login.tsx` / `login.native.tsx` | Google OAuth + guest mode |

### i18n

`utils/i18n.tsx` — `I18nProvider` / `useI18n` — two languages (es/en), auto-detected from `Intl.DateTimeFormat`. Language stored via `localStorage` (web) or `expo-secure-store` (native). Translation keys: `t.tabs.*`, `t.common.*`, `t.expenses.*`, `t.summary.*`, `t.config.*`.

### Environment

`app.config.js` reads from `.env`:
- `ADMOB_ANDROID_APP_ID`
- `ADMOB_IOS_APP_ID`
- `EXPO_PUBLIC_PAYPAL_ME`
- `EXPO_PUBLIC_LICENSE_PRICE`
- `EXPO_PUBLIC_SUPPORT_EMAIL`
