# Contacts App

This Expo project manages contacts using a **local SQLite database**, making it designed for **100% offline functionality**.

---

## Setup

The database runs completely locally and will automatically create `contacts.db` on your device/emulator.

**Development:**

```bash
npm install
npm run start
```

_(Optional)_ If you want to seed the database with initial sample data in your local environment, run:

```bash
npm run sqlite:seed
```

---

## Architecture

This project was specifically designed to be an offline-first mobile app using:

- **Expo & React Native**
- **Expo SQLite** (for database handling)
- **Local Context API** (for state management without external fetches)

For more technical details on how the database handles state, check out `ARCHITECTURE.md`.

---

## Notes

- Data is fully local and offline-capable.
- The `data/` directory (where `contacts.db` lives in the emulated environment) should be in `.gitignore`.
