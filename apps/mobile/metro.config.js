// Metro (the app's bundler). The app is its own npm project (not a workspace), so it keeps its
// own React / React Native versions apart from the web app's. It still uses the shared code in
// packages/shared: `@school/shared/<path>` resolves to packages/shared/src/<path>.ts.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const appModules = path.resolve(projectRoot, "node_modules");
const sharedSrc = path.resolve(projectRoot, "../../packages/shared/src");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [...(config.watchFolders ?? []), sharedSrc];
config.resolver.nodeModulesPaths = [appModules];

// React and React Native always come from this app's node_modules, never from the repo root
// (where the web app keeps a different React version).
const PINNED = /^(react|react-dom|react-native)(\/.*)?$/;

// See src/stubs/topic-subscription.js: Expo Go (Android) has no topic-subscription module.
const topicStub = path.resolve(projectRoot, "src/stubs/topic-subscription.js");

const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolve ?? context.resolveRequest;
  if (moduleName.startsWith("@school/shared/")) {
    const file = path.join(sharedSrc, moduleName.slice("@school/shared/".length));
    return context.resolveRequest(context, file, platform);
  }
  if (
    moduleName.endsWith("TopicSubscriptionModule") &&
    context.originModulePath.includes(`${path.sep}expo-notifications${path.sep}`)
  ) {
    return { type: "sourceFile", filePath: topicStub };
  }
  if (PINNED.test(moduleName)) {
    return resolve({ ...context, originModulePath: path.join(appModules, "index.js") }, moduleName, platform);
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
