import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "NextFlow", template: "%s | NextFlow" },
  description: "Visual LLM workflow builder — chain AI models with a drag-and-drop canvas.",
  keywords: ["AI", "LLM", "workflow", "builder", "Gemini", "no-code"],
  openGraph: {
    title: "NextFlow",
    description: "Visual LLM workflow builder",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
    <body>
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}
