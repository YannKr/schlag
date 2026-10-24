// https://docs.expo.dev/versions/latest/config/babel/
//
// @mediapipe/tasks-vision 0.10.35+ loads its WASM glue with
// `import(url.toString())` when it runs inside a module worker. Metro rejects
// an import() whose argument is not a string literal, so the web export fails.
// The camera hook runs MediaPipe on the main thread, where the library adds a
// <script> tag instead, so that branch is never taken. Mark the call with
// Metro's ignore comment so Metro leaves it to the browser.
function metroIgnoreDynamicImports({ types: t }) {
  return {
    visitor: {
      CallExpression(path) {
        const [source] = path.node.arguments;
        if (path.node.callee.type === 'Import' && source && !t.isStringLiteral(source)) {
          t.addComment(source, 'leading', ' @metro-ignore ');
        }
      },
    },
  };
}

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    overrides: [
      {
        // A function, not a RegExp: Expo also loads this config without a
        // filename (for its cache key), and Babel rejects a RegExp then.
        test: (filename) =>
          !!filename && /node_modules[\\/]@mediapipe[\\/]tasks-vision[\\/]/.test(filename),
        plugins: [metroIgnoreDynamicImports],
      },
    ],
  };
};
