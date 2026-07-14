import React from "react";
import "@/index.css";
import "@/styles.css";

export const metadata = {
  title: "CreativeLead",
  description: "CreativeLead Enterprise Internal Tool",
  icons: {
    icon: "/logo.png",
  },
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
