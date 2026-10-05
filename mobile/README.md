# Second Brain mobile app

Expo Router and TypeScript client for receiving shared web links, selecting a
folder, and rendering the processed Feynman summary and adaptive diagram.

This app lives in the regular `mobile/` folder of `CloudKai/secondBrain`, alongside
`web/` and `backend/`. Clone the main repository and run the commands below from
`mobile/`. Mobile changes are committed and pushed from the repository root.

## Configure the backend

Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_BASE_URL` to an address
the simulator or device can reach. Android Emulator uses
`http://10.0.2.2:8000` by default; iOS Simulator uses
`http://127.0.0.1:8000` by default. A physical device needs your computer's LAN
IP address.

## Run a development build

The native share receiver does not work in Expo Go. Generate and run a custom
development build:

```bash
npm install
npx expo prebuild
npm run ios
# or: npm run android
```

After the native app is installed, start Metro with `npm start`. Open a webpage
in another app, choose Share, and select **Second Brain**.

## Checks

```bash
npx tsc --noEmit
npm run lint
npx expo-doctor
```
