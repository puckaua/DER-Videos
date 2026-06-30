/**
 * pages/_app.js
 * Wrapper global do Next.js — importa o CSS global.
 */

import "../styles/globals.css";

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
