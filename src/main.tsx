/**
 * Vite 기반 KPubData Studio 애플리케이션의 브라우저 진입점.
 *
 * DOM에서 루트 컨테이너를 찾은 뒤 React 19 `createRoot` API로 앱을 마운트한다.
 * 개발 중 부작용을 더 엄격하게 확인하기 위해 `StrictMode`로 전체 앱을 감싼다.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import "./globals.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container not found");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
