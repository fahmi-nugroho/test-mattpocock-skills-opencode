import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

// Serif display for H1/H2 only; body copy stays sans.
const display = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Makeup Artist",
  description: "Portfolio, prices, and availability — booking via WhatsApp.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body
        className={`${sans.variable} ${display.variable} bg-cream font-sans text-espresso antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
