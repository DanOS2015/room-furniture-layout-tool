import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline support when served over HTTPS (or localhost, which counts as secure).
// Guarded three ways on purpose: the feature test keeps jsdom happy in the
// tests, the protocol check skips file:// and plain-http LAN dev where
// registration is blocked by design, and the catch swallows the rest - none of
// this is worth breaking the app over.
if (
  "serviceWorker" in navigator &&
  (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  });
}
