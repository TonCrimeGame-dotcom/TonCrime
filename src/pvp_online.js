
import { tryMatch } from "./pvp.js";

export function startMatchmaking(mode, onMatch) {
  console.log("matchmaking started");

  const interval = setInterval(async () => {
    await tryMatch(mode, (data) => {
      clearInterval(interval);
      onMatch(data);
    });
  }, 1500);

  return () => clearInterval(interval);
}
