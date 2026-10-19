import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "ClipForge — do vídeo longo ao próximo corte",
  description:
    "Cortes verticais com narrativa, edição não destrutiva e decisões transparentes.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
