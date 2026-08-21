import React, { useState } from 'react';

interface MediaVisibilityToggleProps {
  visibility: 'public' | 'police_only';
  onVisibilityChange: (newVisibility: 'public' | 'police_only') => void;
  disabled?: boolean;
}

const MediaVisibilityToggle: React.FC<MediaVisibilityToggleProps> = ({
  visibility,
  onVisibilityChange,
  disabled = false,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleToggle = () => {
    if (!disabled) {
      const newVisibility = visibility === 'public' ? 'police_only' : 'public';
      onVisibilityChange(newVisibility);
    }
  };

  return (
    <div className="relative inline-block">
      <div className="flex items-center space-x-2">
        <span className="text-sm text-gray-600">Visibility:</span>

        <button
          onClick={handleToggle}
          disabled={disabled}
          className={`
            relative inline-flex h-6 w-11 items-center rounded-full transition-colors
            ${visibility === 'public' ? 'bg-green-500' : 'bg-blue-600'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <span
            className={`
              inline-block h-4 w-4 transform rounded-full bg-white transition-transform
              ${visibility === 'public' ? 'translate-x-1' : 'translate-x-6'}
            `}
          />
        </button>

        <span className={`text-sm font-medium ${
          visibility === 'public' ? 'text-green-600' : 'text-blue-600'
        }`}>
          {visibility === 'public' ? 'Public' : 'Police Only'}
        </span>

        {/* Info Icon */}
        <div
          className="relative"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <svg className="h-4 w-4 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>

          {/* Tooltip */}
          {showTooltip && (
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded shadow-lg whitespace-nowrap z-10">
              {visibility === 'public'
                ? 'Visible to everyone on public map'
                : 'Only visible to police and admin'}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
            </div>
          )}
        </div>
      </div>

      {/* Status Badge */}
      <div className={`mt-2 text-xs ${
        visibility === 'public' ? 'text-green-600' : 'text-blue-600'
      }`}>
        {visibility === 'public' ? (
          <span className="flex items-center">
            <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
            Public View
          </span>
        ) : (
          <span className="flex items-center">
            <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            Police View Only
          </span>
        )}
      </div>
    </div>
  );
};

export default MediaVisibilityToggle;
