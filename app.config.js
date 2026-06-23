import 'dotenv/config';

export default {
  expo: {
    name: "Chiro",
    slug: "chiro-app",
    version: "1.0.1",
    scheme: "chiro",
    orientation: "portrait",
    platforms: ["android", "web"],
    icon: "./assets/Chiro/chiro-simbolo-azul-1024.png",
    android: {
      package: "com.luserv.chiro",
      googleServicesFile: "./google-services.json",
      adaptiveIcon: {
        foregroundImage: "./assets/Chiro/chiro-adaptive-fg-1024.png",
        monochromeImage: "./assets/Chiro/chiro-adaptive-mono-1024.png",
        backgroundColor: "#ffffff"
      }
    },
    web: {
      favicon: "./assets/Chiro/chiro-simbolo-azul-512.png"
    },
    plugins: [
      [
        "react-native-google-mobile-ads",
        {
          androidAppId: process.env.ADMOB_ANDROID_APP_ID,
          iosAppId: process.env.ADMOB_IOS_APP_ID,
        }
      ],
      "@react-native-google-signin/google-signin",
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
