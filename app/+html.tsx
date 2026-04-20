import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Web-only HTML shell for Expo Router. Loads the Signal font stack:
 *  - Inter: display/body (free Neue Haas Grotesk analogue).
 *  - DSEG7 Classic: seven-segment timer digits (from jsdelivr).
 * Sets the paper background at the document level so there's no flash
 * of white before React mounts.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/dseg@0.46.0/css/dseg.min.css"
        />

        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: globalCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const globalCss = `
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  background: #FAFAF7;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
#root, body > div:first-child {
  height: 100%;
  background: #FAFAF7;
}
* { box-sizing: border-box; }

/* Expo Router web ignores tabBarStyle.height; force a readable tab bar. */
[role="tablist"] {
  min-height: 72px !important;
  padding-top: 10px !important;
  padding-bottom: 16px !important;
  flex: 0 0 auto !important;
}
[role="tablist"] [role="tab"] {
  padding-top: 4px !important;
  padding-bottom: 4px !important;
}
`;
