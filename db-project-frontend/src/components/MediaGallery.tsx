import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import type { CrimeMedia } from '../pages/MapViewPage/components/types.tsx';
import { getWorkingThumbnailUrl } from '../utils/thumbnailUtils';

interface MediaGalleryProps {
  media: CrimeMedia[];
  userRole?: 'citizen' | 'police' | 'admin';
  onMediaDelete?: (mediaId: number) => void;
  editable?: boolean;
}

const MediaGallery: React.FC<MediaGalleryProps> = ({
  media,
  userRole = 'citizen',
  onMediaDelete,
  editable = false,
}) => {
  const [selectedMediaIndex, setSelectedMediaIndex] = useState<number | null>(null);
  const [showLightbox, setShowLightbox] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  // Create or get portal root for lightbox
  React.useEffect(() => {
    let root = document.getElementById('media-gallery-portal');
    if (!root) {
      root = document.createElement('div');
      root.id = 'media-gallery-portal';
      document.body.appendChild(root);
    }
    setPortalRoot(root);
    return () => {
      // Don't remove root on unmount as other instances might need it
    };
  }, []);

  // Filter media based on user role
  const visibleMedia = media.filter(m => m.visibility === 'public' || userRole !== 'citizen');

  const handleMediaClick = (index: number) => {
    setSelectedMediaIndex(index);
    setShowLightbox(true);
  };

  const handleCloseLightbox = () => {
    setShowLightbox(false);
    setSelectedMediaIndex(null);
  };

  const handlePrevious = () => {
    if (selectedMediaIndex !== null) {
      setSelectedMediaIndex((selectedMediaIndex - 1 + visibleMedia.length) % visibleMedia.length);
    }
  };

  const handleNext = () => {
    if (selectedMediaIndex !== null) {
      setSelectedMediaIndex((selectedMediaIndex + 1) % visibleMedia.length);
    }
  };

  const handleDelete = (mediaId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMediaDelete && window.confirm('Are you sure you want to delete this media?')) {
      onMediaDelete(mediaId);
    }
  };

  const handleImageError = (mediaId: number) => {
    // Silently handle image load errors
    const mediaItem = visibleMedia.find(m => m.id === mediaId);
    if (mediaItem) {
      // Could log to error tracking service in production
    }
  };

  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());
  const [fallbackUrls, setFallbackUrls] = useState<Record<number, string>>({});

  if (visibleMedia.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No media available</p>
      </div>
    );
  }

  const selectedMedia = selectedMediaIndex !== null ? visibleMedia[selectedMediaIndex] : null;

  return (
    <>
      {/* Media Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        {visibleMedia.map((item, index) => {
          const thumbnailSrc = getWorkingThumbnailUrl(item);

          return (
          <div
            key={item.id}
            className="relative group cursor-pointer aspect-square"
            onClick={() => handleMediaClick(index)}
          >
            {/* Thumbnail */}
            {item.fileType === 'image' ? (
              !failedImages.has(item.id) ? (
                <img
                  src={fallbackUrls[item.id] || getWorkingThumbnailUrl(item)}
                  alt={item.caption || item.originalName}
                  className="w-full h-full object-cover rounded-lg"
                  onError={() => {
                    handleImageError(item.id);
                    setFailedImages(prev => new Set(prev).add(item.id));
                    // Fallback to full URL if thumbnail fails
                    if (!fallbackUrls[item.id] && item.url) {
                      setFallbackUrls(prev => ({ ...prev, [item.id]: item.url }));
                    }
                  }}
                />
              ) : (
                // Fallback placeholder when image fails to load
                <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <svg className="h-8 w-8 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-xs">Image unavailable</p>
                  </div>
                </div>
              )
            ) : (
              <div className="relative w-full h-full">
                {/* For videos, use img tag with thumbnailUrl (should be JPG of first frame) */}
                <img
                  src={thumbnailSrc}
                  alt={item.caption || item.originalName}
                  className="w-full h-full object-cover rounded-lg"
                  onError={() => handleImageError(item.id)}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-lg">
                  <svg className="h-8 w-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            )}

            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-grey bg-opacity-0 group-hover:bg-opacity-30 transition-opacity rounded-lg">
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </div>
            </div>

            {/* Delete Button (editable mode) */}
            {editable && onMediaDelete && (
              <button
                onClick={(e) => handleDelete(item.id, e)}
                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          );
        })}
      </div>

      {/* Lightbox with Portal to break out of Leaflet popup */}
      {showLightbox && selectedMedia && portalRoot && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black bg-opacity-95 flex items-center justify-center">
          {/* Close Button */}
          <button
            onClick={handleCloseLightbox}
            className="absolute top-4 right-4 z-[100001] text-white hover:text-gray-300 bg-black/50 rounded-full p-2 transition-colors"
          >
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Navigation Buttons */}
          {visibleMedia.length > 1 && (
            <>
              <button
                onClick={handlePrevious}
                className="absolute left-4 z-[100001] text-white hover:text-gray-300 bg-black/50 rounded-full p-3 transition-colors"
              >
                <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={handleNext}
                className="absolute right-4 z-[100001] text-white hover:text-gray-300 bg-black/50 rounded-full p-3 transition-colors"
              >
                <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {/* Media Content */}
          <div className="w-full h-full flex flex-col items-center justify-center p-4 md:p-8">
            {selectedMedia.fileType === 'image' ? (
              <img
                src={selectedMedia.url}
                alt={selectedMedia.caption || selectedMedia.originalName}
                className="max-w-full max-h-[80vh] object-contain mx-auto rounded-lg shadow-2xl"
              />
            ) : (
              <video
                src={selectedMedia.url}
                controls
                className="max-w-full max-h-[80vh] mx-auto rounded-lg shadow-2xl"
              />
            )}

            {/* Caption */}
            {selectedMedia.caption && (
              <div className="mt-4 text-center text-white">
                <p className="text-lg">{selectedMedia.caption}</p>
                {userRole !== 'citizen' && (
                  <div className="mt-2 flex items-center justify-center space-x-4 text-sm">
                    {selectedMedia.visibility === 'police_only' && (
                      <span className="bg-blue-600 px-3 py-1 rounded">Police Only</span>
                    )}
                    {selectedMedia.evidenceMarked && (
                      <span className="bg-yellow-500 px-3 py-1 rounded">Evidence</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Counter */}
          {visibleMedia.length > 1 && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-[100001] text-white text-sm bg-black/70 px-4 py-2 rounded-full">
              {selectedMediaIndex! + 1} / {visibleMedia.length}
            </div>
          )}
        </div>,
        portalRoot
      )}
    </>
  );
};

export default MediaGallery;
