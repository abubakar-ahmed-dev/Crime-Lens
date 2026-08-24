import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { CrimeMedia, MediaUpdate } from '../pages/MapViewPage/components/types';
import MediaUploader from './MediaUploader';
import MediaGallery from './MediaGallery';
import MediaVisibilityToggle from './MediaVisibilityToggle';
import { addMediaToCrime, removeMediaFromCrime, updateMedia, validateMediaFiles } from '../services/api';

interface PoliceMediaEditorProps {
  crimeId: number;
  media: CrimeMedia[];
  onMediaUpdate?: (mediaId: number, updates: MediaUpdate) => void;
  onMediaAdd?: (files: Array<{ file: File; caption: string }>) => void;
  onMediaDelete?: (mediaId: number) => void;
  onCancel?: () => void;
  disabled?: boolean;
}

type EditMode = 'view' | 'add' | 'edit';

interface FileWithCaption {
  file: File;
  caption: string;
  preview: string;
  fileType: 'image' | 'video';
}

const PoliceMediaEditor: React.FC<PoliceMediaEditorProps> = ({
  crimeId,
  media,
  onMediaUpdate,
  onMediaAdd,
  onMediaDelete,
  onCancel,
}) => {
  const [editMode, setEditMode] = useState<EditMode>('view');
  const [newFiles, setNewFiles] = useState<FileWithCaption[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const debounceTimeoutsRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const handleAddMedia = useCallback(async () => {
    if (newFiles.length === 0) return;

    setIsSaving(true);
    setErrors([]);

    try {
      // Validate new files only (File array)
      const files = newFiles.map(f => f.file);
      const validation = validateMediaFiles(files, {
        maxImages: 5,
        maxVideos: 2,
        maxFileSize: 5242880
      });

      if (!validation.valid) {
        setErrors([validation.error || 'Validation failed']);
        setIsSaving(false);
        return;
      }

      setUploadProgress(10);

      // If parent provides onMediaAdd callback, use it (for VerificationCard)
      // Otherwise, upload directly (for AllRecordsPage)
      if (onMediaAdd) {
        // Convert FileWithCaption to expected format
        const filesData = newFiles.map(f => ({
          file: f.file,
          caption: f.caption
        }));
        onMediaAdd(filesData);
        setNewFiles([]);
        setEditMode('view');
      } else {
        // Direct upload for AllRecordsPage
        const filesArray = newFiles.map(f => f.file);
        const captions = newFiles.map(f => f.caption);

        const result = await addMediaToCrime(crimeId, filesArray, captions);

        setUploadProgress(90);

        if (result.success) {
          setErrors(['Media added successfully']);
          setNewFiles([]);
          setEditMode('view');
        } else {
          setErrors([result.message || 'Failed to upload media']);
        }
      }
    } catch {
      setErrors(['Failed to upload media. Please try again.']);
    } finally {
      setUploadProgress(100);
      setIsSaving(false);
    }
  }, [crimeId, newFiles, onMediaAdd]);

  const handleRemoveMedia = useCallback(async (mediaId: number) => {
    setIsSaving(true);
    setErrors([]);

    try {
      setUploadProgress(10);

      const result = await removeMediaFromCrime(crimeId, mediaId);

      setUploadProgress(90);

      if (result.success) {
        // Call both callbacks if provided
        if (onMediaUpdate) {
          onMediaUpdate(mediaId, { visibility: 'removed' } as any);
        }
        if (onMediaDelete) {
          onMediaDelete(mediaId);
        }

        setErrors(['Media removed successfully']);
      } else {
        setErrors([result.message || 'Failed to remove media']);
      }
    } catch {
      setErrors(['Failed to remove media. Please try again.']);
    } finally {
      setUploadProgress(100);
      setIsSaving(false);
    }
  }, [crimeId, onMediaUpdate, onMediaDelete]);

  const handleUpdateMedia = useCallback(async (mediaId: number, updates: MediaUpdate) => {
    // Optimistic update - call parent immediately
    if (onMediaUpdate) {
      onMediaUpdate(mediaId, updates);
    }

    // Then make API call silently
    try {
      const result = await updateMedia(mediaId, updates);

      if (!result.success) {
        // Rollback on error
        setErrors([result.message || 'Failed to update media']);
        // Revert on error by calling parent with original values
        if (onMediaUpdate) {
          const originalMedia = media.find(m => m.id === mediaId);
          if (originalMedia) {
            if (updates.visibility !== undefined) {
              onMediaUpdate(mediaId, { visibility: originalMedia.visibility });
            }
            if (updates.caption !== undefined) {
              onMediaUpdate(mediaId, { caption: originalMedia.caption });
            }
            if (updates.evidenceMarked !== undefined) {
              onMediaUpdate(mediaId, { evidenceMarked: originalMedia.evidenceMarked });
            }
          }
        }
      }
    } catch {
      setErrors(['Failed to update media. Please try again.']);
      // Revert on error
      if (onMediaUpdate) {
        const originalMedia = media.find(m => m.id === mediaId);
        if (originalMedia) {
          if (updates.visibility !== undefined) {
            onMediaUpdate(mediaId, { visibility: originalMedia.visibility });
          }
          if (updates.caption !== undefined) {
            onMediaUpdate(mediaId, { caption: originalMedia.caption });
          }
          if (updates.evidenceMarked !== undefined) {
            onMediaUpdate(mediaId, { evidenceMarked: originalMedia.evidenceMarked });
          }
        }
      }
    }
  }, [media, onMediaUpdate]);

  // Debounced caption update handler
  const handleCaptionChange = useCallback((mediaId: number, newCaption: string) => {
    // Clear existing timeout for this media item
    if (debounceTimeoutsRef.current[mediaId]) {
      clearTimeout(debounceTimeoutsRef.current[mediaId]);
    }

    // Optimistic update - call parent immediately
    if (onMediaUpdate) {
      onMediaUpdate(mediaId, { caption: newCaption });
    }

    // Set new timeout to call API after 500ms of no typing
    debounceTimeoutsRef.current[mediaId] = setTimeout(async () => {
      try {
        const result = await updateMedia(mediaId, { caption: newCaption });
        if (!result.success) {
          setErrors([result.message || 'Failed to update caption']);
          // Revert on error
          const originalMedia = media.find(m => m.id === mediaId);
          if (originalMedia && onMediaUpdate) {
            onMediaUpdate(mediaId, { caption: originalMedia.caption });
          }
        }
      } catch {
        setErrors(['Failed to update caption. Please try again.']);
        const originalMedia = media.find(m => m.id === mediaId);
        if (originalMedia && onMediaUpdate) {
          onMediaUpdate(mediaId, { caption: originalMedia.caption });
        }
      }
    }, 500);
  }, [media, onMediaUpdate]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimeoutsRef.current).forEach(timeout => {
        clearTimeout(timeout);
      });
    };
  }, []);

  const handleSaveAllChanges = useCallback(async () => {
    setIsSaving(true);
    setErrors([]);

    try {
      // All individual changes already applied
      // This function can be used for batch operations if needed
      setEditMode('view');
    } catch {
      setErrors(['Failed to save changes. Please try again.']);
    } finally {
      setIsSaving(false);
    }
  }, []);

  const handleFilesSelected = useCallback((files: FileWithCaption[]) => {
    setNewFiles(files);
  }, []);

  const handleCancelAdd = useCallback(() => {
    setNewFiles([]);
    setEditMode('view');
  }, []);

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Media Management</h2>
        <div className="flex space-x-2">
          {editMode === 'view' ? (
            <>
              <button
                onClick={() => setEditMode('add')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                disabled={isSaving}
              >
                Add Media
              </button>
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Close
              </button>
            </>
          ) : (
            <>
              <button
                onClick={editMode === 'add' ? handleAddMedia : handleSaveAllChanges}
                disabled={isSaving || (editMode === 'add' && newFiles.length === 0)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {isSaving ? `Saving... ${uploadProgress}%` : 'Save Changes'}
              </button>
              <button
                onClick={editMode === 'add' ? handleCancelAdd : () => setEditMode('view')}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                disabled={isSaving}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          {errors.map((error, index) => (
            <p key={index} className="text-sm text-red-600">
              ⚠️ {error}
            </p>
          ))}
        </div>
      )}

      {/* Current Media */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Current Media ({media.length})
        </h3>
        {media.length > 0 ? (
          <MediaGallery
            media={media}
            userRole="police"
            onMediaDelete={editMode === 'view' ? handleRemoveMedia : undefined}
            editable={editMode === 'view'}
          />
        ) : (
          <p className="text-gray-500 text-center py-8">No media attached to this crime</p>
        )}
      </div>

      {/* Individual Media Edit Controls */}
      {editMode === 'view' && media.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Quick Edit</h3>
          {media.map((item) => (
            <div key={item.id} className="p-4 bg-gray-50 rounded-lg space-y-3">
              <div className="flex items-start space-x-4">
                {/* Thumbnail */}
                {item.fileType === 'image' ? (
                  <img
                    src={item.thumbnailUrl || item.url}
                    alt={item.caption || item.originalName}
                    className="w-20 h-20 object-cover rounded"
                  />
                ) : (
                  <div className="w-20 h-20 bg-gray-200 rounded flex items-center justify-center">
                    <svg className="h-8 w-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                    </svg>
                  </div>
                )}

                <div className="flex-grow space-y-2">
                  <p className="text-sm font-medium text-gray-900">{item.originalName}</p>

                  {/* Visibility Toggle */}
                  <MediaVisibilityToggle
                    visibility={item.visibility}
                    onVisibilityChange={(newVisibility) =>
                      handleUpdateMedia(item.id, { visibility: newVisibility })
                    }
                  />

                  {/* Caption Edit */}
                  <div>
                    <label className="text-sm text-gray-600">Caption:</label>
                    <input
                      type="text"
                      value={item.caption || ''}
                      onChange={(e) =>
                        handleCaptionChange(item.id, e.target.value)
                      }
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      placeholder="Add a caption..."
                    />
                  </div>

                  {/* Evidence Toggle */}
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`evidence-${item.id}`}
                      checked={item.evidenceMarked}
                      onChange={(e) =>
                        handleUpdateMedia(item.id, { evidenceMarked: e.target.checked })
                      }
                      className="rounded"
                    />
                    <label htmlFor={`evidence-${item.id}`} className="text-sm text-gray-700">
                      Mark as Evidence
                    </label>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add New Media Section */}
      {editMode === 'add' && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Add New Media</h3>
          <MediaUploader
            onFilesSelected={handleFilesSelected}
            existingFiles={newFiles}
          />
        </div>
      )}
    </div>
  );
};

export default PoliceMediaEditor;
