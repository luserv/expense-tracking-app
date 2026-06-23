# Chiro — Control de Gastos

App de control de gastos **offline-first** para Android y Desktop (Electron). Construida con Expo / React Native.

---

## Requisitos

- Node.js 18+
- pnpm
- Java 21 (`JAVA_HOME` configurado)
- Android SDK (`ANDROID_HOME` configurado)
- Variables de entorno en `.env` (ver sección Environment)

---

## Setup

```bash
# Instalar dependencias
pnpm install

# Electron: reconstruir módulos nativos (una vez o tras pnpm install)
pnpm electron:rebuild
```

---

## Desarrollo

```bash
# Servidor Expo con recarga en caliente (Android + Web)
pnpm start

# Android en emulador/dispositivo
pnpm android

# iOS en emulador/dispositivo
pnpm ios

# Electron: ventana de escritorio (requiere Expo en puerto 8081)
pnpm electron:dev

# Lint
pnpm lint
```

---

## Base de datos (desarrollo local)

```bash
# Crear base de datos SQLite con esquema de contactos de prueba
pnpm sqlite:init

# Ídem anterior + insertar datos de ejemplo
pnpm sqlite:seed
```

---

## Utilidades

```bash
# Generar icon.ico para el empaquetado de Electron
pnpm generate:ico
```

---

## Android — Builds

### Debug (emulador o dispositivo)

```bash
pnpm expo run:android
```

### Release local — APK firmado con keystore de producción

```bash
pnpm expo run:android --variant release
```

APK generado en:
```
android/app/build/outputs/apk/release/app-release.apk
```

### APK via EAS — distribución interna / testers

```bash
pnpm eas build --platform android --profile preview
```

### AAB para Play Store — build en la nube

```bash
pnpm eas build --platform android --profile production
```

### AAB para Play Store — build local

```bash
pnpm eas build --platform android --profile production --local
```

### APK de producción — build local

```bash
pnpm eas build --platform android --profile production-apk --local
```

---

## Desktop — Electron Builds

```bash
# Build genérico (usa la plataforma actual)
pnpm electron:build

# Windows (.exe installer)
pnpm electron:win

# macOS (.dmg)
pnpm electron:mac

# Linux (.AppImage / .deb)
pnpm electron:linux
```

---

## Keystore de producción

El keystore de producción está en `android/app/release.keystore` (no incluido en el repo, gestionado via EAS).

```bash
# Ver / gestionar keystore en EAS
pnpm eas credentials
```

El SHA-1 del keystore debe estar registrado en:
- **Firebase Console** → Project Settings → Android app → Add fingerprint
- **Google Cloud Console** → APIs & Services → Credentials → Android OAuth client

---

## Environment

Crear `.env` en la raíz:

```env
# AdMob
ADMOB_ANDROID_APP_ID=ca-app-pub-XXXXXXXX~XXXXXXXX
ADMOB_IOS_APP_ID=ca-app-pub-XXXXXXXX~XXXXXXXX

# Google OAuth
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=XXXXXXXXX.apps.googleusercontent.com

# App
EXPO_PUBLIC_PAYPAL_ME=https://paypal.me/XXXX
EXPO_PUBLIC_LICENSE_PRICE=X.XX
EXPO_PUBLIC_SUPPORT_EMAIL=support@example.com
```

---

## Arquitectura

Ver `CLAUDE.md` para documentación técnica detallada.
