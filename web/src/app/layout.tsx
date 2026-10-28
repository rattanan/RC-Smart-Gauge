import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "RC Smart Gauge",
  description:
    "Internet-connected RC drift telemetry dashboard. Native 3D drive view, synthetic sound and secure ESP32 telemetry.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
