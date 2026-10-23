// The standard Expo setup, written out so it also applies to the shared code in
// packages/shared (outside this folder).
module.exports = function (api) {
  api.cache(true);
  return { presets: ["babel-preset-expo"] };
};
