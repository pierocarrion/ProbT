"use client";

import { useState, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import { queryClient } from "@/hooks/use-api";
import { AssetProvider } from "@/hooks/use-asset-context";

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <AssetProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            {children}
            {mounted && <Toaster position="bottom-right" richColors closeButton />}
          </TooltipProvider>
        </QueryClientProvider>
      </AssetProvider>
    </ThemeProvider>
  );
}
