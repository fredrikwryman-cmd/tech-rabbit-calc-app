/**
 * babel-preset-expo innehaller react-native-worklets-pluginet som Reanimated 4
 * behover. Det ska ligga sist, vilket presetet sjalv ser till.
 */
module.exports = function (api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
