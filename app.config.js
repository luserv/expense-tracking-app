import 'dotenv/config';

export default {
  expo: {
    name: "Chiro",
    slug: "chiro-app",
    version: "1.0.0",
    scheme: "chiro",
    orientation: "portrait",
    platforms: ["android", "web"],
    android: {
      package: "com.luserv.chiro",
      googleServicesFile: "./google-services.json"
    },
    plugins: [
      [
        "react-native-google-mobile-ads",
        {
          androidAppId: process.env.ADMOB_ANDROID_APP_ID,
          iosAppId: process.env.ADMOB_IOS_APP_ID,
        }
      ],
      "expo-font",
      "expo-router",
      "expo-web-browser"
    ],
    extra: {
      eas: {
        projectId: "0f50dcc0-b0dc-4d9d-a8cd-c712f8eb8df0"
      }
    }
  }
};
