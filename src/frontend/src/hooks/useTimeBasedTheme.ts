import { type DaisyTheme, themeService } from "@/services/themeService";
import { useEffect, useState } from "react";

export function useTimeBasedTheme() {
  const [timeBasedTheme, setTimeBasedTheme] = useState<DaisyTheme>(() =>
    themeService.getTimeBasedTheme(),
  );

  useEffect(() => {
    const tick = () => setTimeBasedTheme(themeService.getTimeBasedTheme());
    const intervalId = window.setInterval(tick, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  return {
    isDaytime: timeBasedTheme === "lofi",
    timeBasedTheme,
  };
}
