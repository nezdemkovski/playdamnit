import React, { useState, useRef, useEffect } from "react";
import { Search, Star, Calendar, Gamepad2, Plus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { InlineAutocompleteInput } from "./inline-autocomplete-input";
import { Badge } from "./badge";
import {
  Game,
  useGetApiGamesSearch,
  useGetApiGamesAutocomplete,
  usePostApiUserByUsernameGames,
} from "@playdamnit/api-client";

interface InlineGameSearchProps {
  username: string;
  onGameAdded?: () => void;
  className?: string;
  placeholder?: string;
}

export function InlineGameSearch({
  username,
  onGameAdded,
  className,
  placeholder = "Search and add games...",
}: InlineGameSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const addGameMutation = usePostApiUserByUsernameGames();

  // Search results
  const { data: searchResults, isLoading } = useGetApiGamesSearch(
    {
      q: searchQuery,
      per_page: 8,
      page: 1,
    },
    {
      query: {
        enabled: searchQuery.length > 2,
        queryKey: ["games", "search", searchQuery],
      },
    },
  );

  // Autocomplete for inline suggestions
  const { data: autocompleteResults } = useGetApiGamesAutocomplete(
    {
      q: searchQuery,
      type: "simple",
      limit: 10,
    },
    {
      query: {
        enabled: searchQuery.length >= 1,
        queryKey: ["games", "autocomplete", searchQuery],
      },
    },
  );

  const suggestions = autocompleteResults?.suggestions?.map((s: any) => s.value || s.display) || [];
  const games = searchResults?.results || [];

  // Handle clicking outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Open dropdown when typing
  useEffect(() => {
    if (searchQuery.length > 2) {
      setIsOpen(true);
      setSelectedIndex(0);
    } else {
      setIsOpen(false);
    }
  }, [searchQuery]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || games.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % games.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + games.length) % games.length);
        break;
      case "Enter":
        if (games[selectedIndex]) {
          e.preventDefault();
          handleGameSelect(games[selectedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSearchQuery("");
        break;
    }
  };

  const handleGameSelect = async (game: Game) => {
    try {
      await addGameMutation.mutateAsync({
        username,
        data: {
          gameId: game.id,
          status: "want_to_play",
          rating: 0,
          platformId: game.platforms?.[0]?.id || 1,
        },
      });

      setSearchQuery("");
      setIsOpen(false);
      onGameAdded?.();
    } catch (error) {
      console.error("Failed to add game:", error);
    }
  };

  const handleClear = () => {
    setSearchQuery("");
    setIsOpen(false);
  };

  const formatSource = (source?: string) => {
    switch (source) {
      case "typesense":
        return "Local";
      case "sqlite":
        return "Local";
      case "igdb":
        return "IGDB";
      default:
        return source || "Unknown";
    }
  };

  return (
    <div ref={searchRef} className={cn("relative", className)} onKeyDown={handleKeyDown}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-playdamnit-light/40 z-20" />
        <InlineAutocompleteInput
          value={searchQuery}
          onChange={setSearchQuery}
          suggestions={suggestions}
          placeholder={placeholder}
          className="w-full rounded-lg border border-playdamnit-purple/30 bg-playdamnit-dark/50 backdrop-blur-sm py-2.5 pl-10 pr-10 text-playdamnit-light placeholder-playdamnit-light/40 focus:border-playdamnit-cyan focus:outline-none focus:ring-1 focus:ring-playdamnit-cyan transition-all duration-200"
        />
        {searchQuery && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-playdamnit-light/40 hover:text-playdamnit-light transition-colors z-20"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-playdamnit-dark/95 backdrop-blur-md border border-playdamnit-purple/30 rounded-lg shadow-2xl shadow-playdamnit-purple/10 z-50 max-h-96 overflow-hidden">
          {isLoading ? (
            <div className="p-4 flex items-center justify-center text-playdamnit-light/60">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Searching...
            </div>
          ) : games.length > 0 ? (
            <>
              {/* Search metadata */}
              {(searchResults as any)?.meta && (
                <div className="px-4 py-2 border-b border-playdamnit-purple/20 text-xs text-playdamnit-light/60">
                  Found {(searchResults as any).meta.total} games
                  {(searchResults as any).meta.sources && (
                    <span className="ml-2">
                      • Sources: {(searchResults as any).meta.sources.join(", ")}
                    </span>
                  )}
                </div>
              )}

              {/* Games list */}
              <div className="max-h-80 overflow-y-auto">
                {games.map((game, index) => (
                  <button
                    key={game.id}
                    onClick={() => handleGameSelect(game)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 text-left transition-all duration-150",
                      "hover:bg-playdamnit-purple/10 focus:bg-playdamnit-purple/10 focus:outline-none",
                      index === selectedIndex && "bg-playdamnit-purple/20",
                      addGameMutation.isPending && "opacity-50 pointer-events-none",
                    )}
                  >
                    {/* Game Cover */}
                    <div className="relative w-12 h-16 rounded overflow-hidden bg-playdamnit-dark flex-shrink-0">
                      {game.cover?.url ? (
                        <img
                          src={game.cover.url.replace("t_thumb", "t_cover_small")}
                          alt={game.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-playdamnit-light/30">
                          <Gamepad2 className="w-4 h-4" />
                        </div>
                      )}
                      {game.totalRating && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                          <div className="flex items-center justify-center">
                            <Star className="w-2 h-2 text-yellow-400 mr-0.5" />
                            <span className="text-[10px] text-white font-medium">
                              {(game.totalRating / 10).toFixed(1)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Game Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-playdamnit-light line-clamp-1 mb-1">
                        {game.name}
                      </h3>

                      <div className="flex items-center gap-2 text-xs text-playdamnit-light/60 mb-1">
                        {game.firstReleaseDate && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(game.firstReleaseDate * 1000).getFullYear()}</span>
                          </div>
                        )}
                        {game.platforms?.[0] && (
                          <div className="flex items-center gap-1">
                            <Gamepad2 className="w-3 h-3" />
                            <span className="truncate">{game.platforms[0].name}</span>
                          </div>
                        )}
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1 py-0",
                            (game as any).source === "igdb" && "border-blue-500/30 text-blue-400",
                            (game as any).source === "sqlite" &&
                              "border-green-500/30 text-green-400",
                            (game as any).source === "typesense" &&
                              "border-purple-500/30 text-purple-400",
                          )}
                        >
                          {formatSource((game as any).source)}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {game.genres?.slice(0, 2).map((genre) => (
                          <Badge
                            key={genre.id}
                            variant="outline"
                            className="text-[10px] bg-playdamnit-purple/10 border-playdamnit-purple/30 text-playdamnit-light/70 px-1 py-0"
                          >
                            {genre.name}
                          </Badge>
                        ))}
                        {game.genres && game.genres.length > 2 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-playdamnit-purple/10 border-playdamnit-purple/30 text-playdamnit-light/70 px-1 py-0"
                          >
                            +{game.genres.length - 2}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Add button */}
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-playdamnit-cyan/20 flex items-center justify-center group-hover:bg-playdamnit-cyan/30 transition-colors">
                        <Plus className="w-4 h-4 text-playdamnit-cyan" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : searchQuery.length > 2 ? (
            <div className="p-4 text-center text-playdamnit-light/60">
              No games found for &quot;{searchQuery}&quot;
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
