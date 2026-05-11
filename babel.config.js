module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'nativewind/babel',
      'react-native-reanimated/plugin',
    ],
    overrides: [
      {
        exclude: /node_modules\/react-native-url-polyfill/,
      },
    ],
  };
};