import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "blobatar/motion.css";
import "blobatar/gaze.css";
import "./globals.css";

// next/font self-hosts these at build time: no runtime requests to third parties.
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000"),
  title: { default: "datblob — temporary, private chat", template: "%s · datblob" },
  description:
    "Spin up a chat, share a link, talk, and let it pop. datblob conversations are ephemeral by design and permanently deleted when they end.",
  applicationName: "datblob",
  referrer: "no-referrer",
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: {
    title: "datblob — temporary, private chat",
    description: "Chats that exist for a moment, then disappear for good.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#141417",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
