import type { Metadata } from "next";
import {
  Courier_Prime,
  Great_Vibes,
  Inter,
  Playfair_Display,
} from "next/font/google";
import { BUSINESS_NAME } from "@/lib/brand";
import "./globals.css";

// Serif display for H1/H2 and the Invoice wordmark; body copy stays sans.
// The italic face is what the Invoice's large wordmark draws.
const display = Playfair_Display({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Invoice-only faces: a typewriter body and a script "Thank You". They load
// through the same pipeline and are resolved from these variables at paint
// time, so a failed load falls back instead of blocking the render.
const invoiceBody = Courier_Prime({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-invoice-body",
  display: "swap",
});

const invoiceScript = Great_Vibes({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-invoice-script",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: BUSINESS_NAME,
    template: `%s · ${BUSINESS_NAME}`,
  },
  description: `Portofolio, harga, dan ketersediaan ${BUSINESS_NAME} — pemesanan lewat WhatsApp.`,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body
        className={`${sans.variable} ${display.variable} ${invoiceBody.variable} ${invoiceScript.variable} bg-cream font-sans text-espresso antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
