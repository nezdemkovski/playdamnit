import { useGetApiCatalog, type GamePlatform } from "@playdamnit/api-client";
import { useMemo } from "react";

/**
 * The platforms to offer when logging a game: the ones IGDB lists for it first, then the local
 * ones (Steam Deck, Steam Machine, Steam Frame) that no catalog game carries.
 */
export const usePlayPlatforms = (gamePlatforms: GamePlatform[]) => {
  const lookups = useGetApiCatalog({ query: { staleTime: 60 * 60 * 1000 } });
  return useMemo(() => {
    const seen = new Set(gamePlatforms.map((p) => p.id));
    return [
      ...gamePlatforms,
      ...(lookups.data?.localPlatforms ?? []).filter((p) => !seen.has(p.id)),
    ];
  }, [gamePlatforms, lookups.data]);
};

/** id → platform for showing the platform of a library entry */
export const usePlatformNames = () => {
  const lookups = useGetApiCatalog({ query: { staleTime: 60 * 60 * 1000 } });
  return useMemo(() => {
    const map = new Map<number, GamePlatform>();
    for (const p of [...(lookups.data?.platforms ?? []), ...(lookups.data?.localPlatforms ?? [])]) {
      map.set(p.id, p);
    }
    return map;
  }, [lookups.data]);
};
