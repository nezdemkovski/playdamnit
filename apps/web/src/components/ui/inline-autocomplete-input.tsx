import React, { useState, useRef, useEffect, KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

interface InlineAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function InlineAutocompleteInput({
  value,
  onChange,
  onSelect,
  suggestions = [],
  placeholder = "",
  className,
  disabled = false,
  autoFocus = false,
}: InlineAutocompleteInputProps) {
  const [currentSuggestion, setCurrentSuggestion] = useState<string>("");
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [showSuggestion, setShowSuggestion] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const [textWidth, setTextWidth] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [inputWidth, setInputWidth] = useState(0);

  // Get filtered suggestions that match the current input
  const filteredSuggestions = suggestions.filter(
    (suggestion) =>
      suggestion.toLowerCase().startsWith(value.trim().toLowerCase()) &&
      suggestion.toLowerCase() !== value.trim().toLowerCase(),
  );

  // Find the best matching suggestion
  useEffect(() => {
    if (!value || value.length < 1 || filteredSuggestions.length === 0) {
      setCurrentSuggestion("");
      setSuggestionIndex(0);
      return;
    }

    const validIndex = Math.min(suggestionIndex, filteredSuggestions.length - 1);
    setSuggestionIndex(validIndex);
    setCurrentSuggestion(filteredSuggestions[validIndex] || "");
  }, [value, suggestions, suggestionIndex, filteredSuggestions.length]);

  // Measure text width and input width for smart positioning
  useEffect(() => {
    if (!inputRef.current || !value) {
      setTextWidth(0);
      return;
    }

    // Create a temporary canvas to measure text width
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return;

    // Get the computed style of the input to match font properties
    const computedStyle = window.getComputedStyle(inputRef.current);
    context.font = `${computedStyle.fontSize} ${computedStyle.fontFamily}`;

    // Measure the width of the typed text
    const width = context.measureText(value).width;
    setTextWidth(width);

    // Get input width for overflow calculations
    const inputRect = inputRef.current.getBoundingClientRect();
    setInputWidth(inputRect.width);
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!currentSuggestion) return;

    switch (e.key) {
      case "Tab":
      case "Enter":
        if (currentSuggestion && showSuggestion) {
          e.preventDefault();
          acceptSuggestion();
        }
        break;
      case "ArrowDown":
        e.preventDefault();
        if (filteredSuggestions.length > 1) {
          setSuggestionIndex((prev) => (prev + 1) % filteredSuggestions.length);
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (filteredSuggestions.length > 1) {
          setSuggestionIndex(
            (prev) => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length,
          );
        }
        break;
      case "Escape":
        setShowSuggestion(false);
        setCurrentSuggestion("");
        break;
      case "ArrowRight":
        // Accept suggestion with right arrow if cursor is at the end
        if (
          inputRef.current &&
          inputRef.current.selectionStart === value.length &&
          currentSuggestion
        ) {
          e.preventDefault();
          acceptSuggestion();
        }
        break;
    }
  };

  const acceptSuggestion = () => {
    if (!currentSuggestion) return;

    setIsAnimating(true);
    const newValue = currentSuggestion;
    onChange(newValue);
    onSelect?.(newValue);
    setCurrentSuggestion("");
    setShowSuggestion(true);

    // Reset animation after a short delay
    setTimeout(() => setIsAnimating(false), 150);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setShowSuggestion(true);
    setSuggestionIndex(0);
  };

  const handleFocus = () => {
    setShowSuggestion(true);
  };

  const getCompletionText = () => {
    if (!currentSuggestion || !value || !showSuggestion) return "";

    const completionPart = currentSuggestion.slice(value.length);

    // If the typed text doesn't end with a space and the completion doesn't start with a space,
    // and we're in the middle of a word, we need to add a space
    const typedText = value.trim();
    const suggestionLower = currentSuggestion.toLowerCase();
    const typedLower = typedText.toLowerCase();

    // Check if we're completing a partial word
    const isPartialWordMatch =
      suggestionLower.startsWith(typedLower) &&
      suggestionLower.length > typedLower.length &&
      suggestionLower[typedLower.length] !== " ";

    // If it's a partial word match, return the completion as is
    if (isPartialWordMatch) {
      return completionPart;
    }

    // If the typed text ends with a space, return completion as is
    if (value.endsWith(" ")) {
      return completionPart;
    }

    // If the completion starts with a space, return as is
    if (completionPart.startsWith(" ")) {
      return completionPart;
    }

    // Otherwise, we might need to add a space
    // Check if the current suggestion has the typed text as a complete word
    const words = currentSuggestion.split(" ");
    const typedWords = typedText.split(" ");
    const lastTypedWord = typedWords[typedWords.length - 1];

    // Find if the last typed word matches a complete word in the suggestion
    const matchingWordIndex = words.findIndex((word) =>
      word.toLowerCase().startsWith(lastTypedWord.toLowerCase()),
    );

    if (matchingWordIndex !== -1) {
      const matchingWord = words[matchingWordIndex];
      const isCompleteWordMatch = matchingWord.toLowerCase() === lastTypedWord.toLowerCase();

      if (isCompleteWordMatch && matchingWordIndex < words.length - 1) {
        // Complete word match, add space before the rest
        const remainingWords = words.slice(matchingWordIndex + 1);
        return " " + remainingWords.join(" ");
      } else if (!isCompleteWordMatch) {
        // Partial word match, complete the word first
        const wordCompletion = matchingWord.slice(lastTypedWord.length);
        const remainingWords = words.slice(matchingWordIndex + 1);
        return wordCompletion + (remainingWords.length > 0 ? " " + remainingWords.join(" ") : "");
      }
    }

    return completionPart;
  };

  const getPaddingLeft = () => {
    if (!inputRef.current) return 0;
    const computedStyle = window.getComputedStyle(inputRef.current);
    return parseInt(computedStyle.paddingLeft, 10) || 0;
  };

  const getPaddingRight = () => {
    if (!inputRef.current) return 0;
    const computedStyle = window.getComputedStyle(inputRef.current);
    return parseInt(computedStyle.paddingRight, 10) || 0;
  };

  // Calculate available space for completion text
  const getAvailableSpace = () => {
    const paddingLeft = getPaddingLeft();
    const paddingRight = getPaddingRight();
    const indicatorWidth = 80; // Approximate width of the TAB indicator
    const usedSpace = paddingLeft + textWidth + paddingRight + indicatorWidth;
    return Math.max(0, inputWidth - usedSpace);
  };

  // Truncate completion text if it's too long
  const getTruncatedCompletionText = () => {
    const completionText = getCompletionText();
    if (!completionText || !inputRef.current) return completionText;

    const availableSpace = getAvailableSpace();
    if (availableSpace <= 0) return "";

    // Create canvas to measure text
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return completionText;

    const computedStyle = window.getComputedStyle(inputRef.current);
    context.font = `${computedStyle.fontSize} ${computedStyle.fontFamily}`;

    // If the text fits, return it as is
    const textWidth = context.measureText(completionText).width;
    if (textWidth <= availableSpace) return completionText;

    // Find the longest text that fits with ellipsis
    const ellipsis = "...";
    const ellipsisWidth = context.measureText(ellipsis).width;
    const maxTextWidth = availableSpace - ellipsisWidth;

    if (maxTextWidth <= 0) return "";

    // Binary search for the longest fitting text
    let left = 0;
    let right = completionText.length;
    let bestFit = "";

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const testText = completionText.slice(0, mid);
      const testWidth = context.measureText(testText).width;

      if (testWidth <= maxTextWidth) {
        bestFit = testText;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return bestFit ? bestFit + ellipsis : "";
  };

  const hasMultipleSuggestions = filteredSuggestions.length > 1;
  const shouldShowIndicator = currentSuggestion && showSuggestion;
  const truncatedCompletion = getTruncatedCompletionText();

  return (
    <div className="relative">
      {/* Actual input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className={cn(
          "relative w-full transition-all duration-150",
          isAnimating && "scale-[1.01]",
          className,
        )}
      />

      {/* Completion text overlay */}
      {shouldShowIndicator && truncatedCompletion && (
        <div
          className={cn(
            "absolute inset-y-0 flex items-center pointer-events-none transition-opacity duration-200",
            "whitespace-nowrap overflow-hidden",
            showSuggestion ? "opacity-60" : "opacity-0",
          )}
          style={{
            left: `${getPaddingLeft() + textWidth}px`,
            right: `${getPaddingRight() + 80}px`, // Reserve space for indicator
            fontSize: inputRef.current
              ? window.getComputedStyle(inputRef.current).fontSize
              : "inherit",
            fontFamily: inputRef.current
              ? window.getComputedStyle(inputRef.current).fontFamily
              : "inherit",
            color: "rgb(156 163 175)", // gray-400
          }}
        >
          <span className="truncate">{truncatedCompletion}</span>
        </div>
      )}

      {/* Enhanced indicator */}
      {shouldShowIndicator && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
          <div
            className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-all duration-200",
              "bg-gray-600/90 text-gray-200 shadow-sm backdrop-blur-sm",
              isAnimating && "scale-110",
            )}
          >
            {/* Multiple suggestions indicator */}
            {hasMultipleSuggestions && (
              <div className="flex items-center gap-0.5 mr-1">
                <svg
                  width="8"
                  height="8"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 15l-6-6-6 6" />
                </svg>
                <span className="text-[9px] font-medium">
                  {suggestionIndex + 1}/{filteredSuggestions.length}
                </span>
                <svg
                  width="8"
                  height="8"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
            )}

            {/* Tab icon */}
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="opacity-80"
            >
              <rect x="3" y="6" width="18" height="12" rx="2" ry="2" />
              <path d="M7 10h4" />
              <path d="M7 14h2" />
            </svg>
            <span className="text-[10px] font-medium">TAB</span>
          </div>
        </div>
      )}

      {/* Subtle helper text for multiple suggestions */}
      {hasMultipleSuggestions && shouldShowIndicator && (
        <div className="absolute -bottom-5 right-0 text-[10px] text-gray-500 pointer-events-none">
          ↑↓ navigate • Tab/Enter accept • Esc dismiss
        </div>
      )}
    </div>
  );
}
