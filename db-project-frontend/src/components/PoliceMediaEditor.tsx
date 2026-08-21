import React, { useState, useCallback } from 'react';
import { CrimeMedia, MediaUpdate, MediaOperations } from '../pages/MapViewPage/components/types';
import MediaUploader from './MediaUploader';
import MediaGallery from './MediaGallery';
import MediaVisibilityToggle from './MediaVisibilityToggle';
import { addMediaToCrime, removeMediaFromCrime, updateMedia, buildMediaFormData, validateMediaFiles } from '../services/api';

interface PoliceMediaEditorProps {
  crimeId: number;
  media: CrimeMedia[];
  onMediaUpdate: (updatedMedia: CrimeMedia[]) => void;
  onCancel: () => void;
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
  onCancel,
}) => {
  const [editMode, setEditMode] = useState<EditMode>('view');
  const [mediaChanges, setMediaChanges] = useState<MediaOperations>({
    toUpdate: [],
    toRemove: [],
  });
  const [newFiles, setNewFiles] = useState<FileWithCaption[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleAddMedia = useCallback(async () => {
    if (newFiles.length === 0) return;

    setIsSaving(true);
    setErrors([]);

    try {
      // Validate current media + new files
      const validation = validateMediaFiles(
        [...media, ...newFiles].map(m => m.fileType === 'image' || m.fileType === 'video'
          ? { ...m, file: m.file || new Blob(), caption: m.caption || '', preview: m.preview || '' }
          : m
        )
      );

      if (!validation.valid) {
        setErrors([validation.error || 'Validation failed']);
        setIsSaving(false);
        return;
      }

      setUploadProgress(10);

      // Upload files
      const files = newFiles.map(f => f.file);
      const captions = newFiles.map(f => f.caption);

      const result = await addMediaToCrime(crimeId, files, captions);

      setUploadProgress(90);

      if (result.success) {
        // Update media state with new items
        onMediaUpdate([...media, ...(result.data?.media || [])]);
        setNewFiles([]);
        setEditMode('view');
      } else {
        setErrors([result.message || 'Failed to upload media']);
      }
    } catch (error) {
      setErrors(['Failed to upload media. Please try again.']);
    } finally {
      setUploadProgress(100);
      setIsSaving(false);
    }
  }, [crimeId, media, newFiles, onMediaUpdate]);

  const handleRemoveMedia = useCallback(async (mediaId: number) => {
    setIsSaving(true);
    setErrors([]);

    try {
      setUploadProgress(10);

      const result = await removeMediaFromCrime(crimeId, mediaId);

      setUploadProgress(90);

      if (result.success) {
        const updatedMedia = media.filter(m => m.id !== mediaId);
        onMediaUpdate(updatedMedia);

        // Track in changes
        setMediaChanges(prev => ({
          ...prev,
          toRemove: [...(prev.toRemove || []), mediaId],
        }));
      } else {
        setErrors([result.message || 'Failed to remove media']);
      }
    } catch (error) {
      setErrors(['Failed to remove media. Please try again.']);
    } finally {
      setUploadProgress(100);
      setIsSaving(false);
    }
  }, [crimeId, media, onMediaUpdate]);

  const handleUpdateMedia = useCallback(async (mediaId: number, updates: MediaUpdate) => {
    setIsSaving(true);
    setErrors([]);

    try {
      setUploadProgress(10);

      const result = await updateMedia(mediaId, updates);

      setUploadProgress(90);

      if (result.success) {
        // Update local media state
        const updatedMedia = media.map(m =>
          m.id === mediaId ? { ...m, ...updates } : m
        );
        onMediaUpdate(updatedMedia);

        // Track in changes
        setMediaChanges(prev => ({
          ...prev,
          toUpdate: [
            ...(prev.toUpdate || []),
            { mediaId, ...updates },
          ],
        }));
      } else {
        setErrors([result.message || 'Failed to update media']);
      }
    } catch (error) {
      setErrors(['Failed to update media. Please try again.']);
    } finally {
      setUploadProgress(100);
      setIsSaving(false);
    }
  }, [media, onMediaUpdate]);

  const handleSaveAllChanges = useCallback(async () => {
    setIsSaving(true);
    setErrors([]);

    try {
      // All individual changes already applied
      // This function can be used for batch operations if needed
      setEditMode('view');
    } catch (error) {
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
                    disabled={isSaving}
                  />

                  {/* Caption Edit */}
                  <div>
                    <label className="text-sm text-gray-600">Caption:</label>
                    <input
                      type="text"
                      value={item.caption || ''}
                      onChange={(e) =>
                        handleUpdateMedia(item.id, { caption: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      disabled={isSaving}
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
                      disabled={isSaving}
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
