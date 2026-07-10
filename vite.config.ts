import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  // GitHub Pages에서는 /kpubdata-studio/ 하위 경로에서 서빙되므로 빌드 시 base를 맞춘다.
  // 로컬 dev 서버는 루트(/)를 사용한다.
  base: command === "build" ? "/kpubdata-studio/" : "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
