import React, { useState } from 'react';
import { CrimeMedia } from '../pages/MapViewPage/components/types';

interface MediaGalleryProps {
  media: CrimeMedia[];
  userRole?: 'citizen' | 'police' | 'admin';
  onMediaUpdate?: (mediaId: number, updates: any) => void;
  onMediaDelete?: (mediaId: number) => void;
  editable?: boolean;
}

const MediaGallery: React.FC<MediaGalleryProps> = ({
  media,
  userRole = 'citizen',
  onMediaUpdate,
  onMediaDelete,
  editable = false,
}) => {
  const [selectedMediaIndex, setSelectedMediaIndex] = useState<number | null>(null);
  const [showLightbox, setShowLightbox] = useState(false);

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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {visibleMedia.map((item, index) => (
          <div
            key={item.id}
            className="relative group cursor-pointer"
            onClick={() => handleMediaClick(index)}
          >
            {/* Thumbnail */}
            {item.fileType === 'image' ? (
              <img
                src={item.thumbnailUrl || item.url}
                alt={item.caption || item.originalName}
                className="w-full h-32 object-cover rounded-lg"
              />
            ) : (
              <div className="relative w-full h-32">
                <video
                  src={item.thumbnailUrl || item.url}
                  className="w-full h-full object-cover rounded-lg"
                  muted
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-lg">
                  <svg className="h-8 w-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            )}

            {/* Visibility Badge (police/admin only) */}
            {userRole !== 'citizen' && item.visibility === 'police_only' && (
              <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
                Police Only
              </div>
            )}

            {/* Evidence Badge */}
            {item.evidenceMarked && (
              <div className="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded">
                Evidence
              </div>
            )}

            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity rounded-lg">
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
                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {showLightbox && selectedMedia && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center">
          {/* Close Button */}
          <button
            onClick={handleCloseLightbox}
            className="absolute top-4 right-4 text-white hover:text-gray-300"
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
                className="absolute left-4 text-white hover:text-gray-300"
              >
                <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={handleNext}
                className="absolute right-4 text-white hover:text-gray-300"
              >
                <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {/* Media Content */}
          <div className="max-w-4xl max-h-[90vh] w-full p-4">
            {selectedMedia.fileType === 'image' ? (
              <img
                src={selectedMedia.url}
                alt={selectedMedia.caption || selectedMedia.originalName}
                className="max-w-full max-h-[85vh] object-contain mx-auto rounded-lg"
              />
            ) : (
              <video
                src={selectedMedia.url}
                controls
                className="max-w-full max-h-[85vh] mx-auto rounded-lg"
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
            <div className="absolute bottom-4 text-white text-sm">
              {selectedMediaIndex! + 1} / {visibleMedia.length}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default MediaGallery;
