import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MarketPro",
  description: "Website marketing copy. DeepSeek for strategy, Ollama Cloud for everyday drafts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
