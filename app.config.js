/** @type {import('expo/config').ExpoConfig} */
const appJson = require('./app.json');

const GOOGLE_WEB_CLIENT_ID =
  '674563099428-te031jnic99kdf4iel4k92if5m91vaqu.apps.googleusercontent.com';

function googleIosUrlScheme() {
  const scheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME?.trim();
  if (scheme) return scheme;

  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  if (iosClientId?.endsWith('.apps.googleusercontent.com')) {
    const id = iosClientId.replace('.apps.googleusercontent.com', '');
    return `com.googleusercontent.apps.${id}`;
  }

  return null;
}

const plugins = appJson.expo.plugins.filter(
  (plugin) =>
    plugin !== '@react-native-google-signin/google-signin' &&
    !(Array.isArray(plugin) && plugin[0] === '@react-native-google-signin/google-signin')
);

const iosUrlScheme = googleIosUrlScheme();
if (iosUrlScheme) {
  plugins.push([
    '@react-native-google-signin/google-signin',
    { iosUrlScheme },
  ]);
}

module.exports = {
  expo: {
    ...appJson.expo,
    plugins,
    extra: {
      ...appJson.expo.extra,
      googleWebClientId:
        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || GOOGLE_WEB_CLIENT_ID,
      googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
    },
  },
};
