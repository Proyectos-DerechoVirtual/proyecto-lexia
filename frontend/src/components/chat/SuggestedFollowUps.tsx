interface SuggestedFollowUpsProps {
  suggestions: string[];
  onSelect: (text: string) => void;
}

export function SuggestedFollowUps({ suggestions, onSelect }: SuggestedFollowUpsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4 px-1">
      {suggestions.map((suggestion, index) => (
        <button
          key={index}
          onClick={() => onSelect(suggestion)}
          className="border border-[#64c27b] text-[#64c27b] bg-white rounded-full px-3 py-1.5 text-xs hover:bg-[#64c27b] hover:text-white transition-all duration-200 text-left leading-snug shadow-sm hover:shadow-md"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
