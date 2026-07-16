import React from "react";
import "@/index.css";
import "@/styles.css";
import { QueryProvider } from "@/hooks/query-provider";

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
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
