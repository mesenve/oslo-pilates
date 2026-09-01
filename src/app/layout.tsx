import { DM_Sans, Playfair_Display } from "next/font/google";
import type { Metadata } from "next";
import { StudioProvider } from "@/components/studio-provider";
import { STUDIO_NAME } from "@/lib/studio";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-dm-sans",
});

const playfair = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  variable: "--font-playfair",
});

export const metadata: Metadata = {
  title: STUDIO_NAME,
  description: "Oslo Pilates öğrenci ve hoca paneli",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: [{ url: "/favicon-32.png", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      className={`${dmSans.variable} ${playfair.variable} min-h-dvh antialiased`}
    >
      <body className="flex min-h-dvh flex-col font-sans">
        <StudioProvider>{children}</StudioProvider>
      </body>
    </html>
  );
}
