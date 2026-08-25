import React, { useState, useCallback, useRef } from 'react';
import { createFilePreview, getFileCategory } from '../services/api';

interface FileWithCaption {
  file: File;
  caption: string;
  preview: string;
  fileType: 'image' | 'video';
}

interface MediaUploaderProps {
  onFilesSelected: (files: FileWithCaption[]) => void;
  maxImages?: number;
  maxVideos?: number;
  maxFileSize?: number;
  disabled?: boolean;
  existingFiles?: FileWithCaption[];
}

const MediaUploader: React.FC<MediaUploaderProps> = ({
  onFilesSelected,
  maxImages = 5,
  maxVideos = 2,
  maxFileSize = 5242880, // 5MB
  disabled = false,
  existingFiles = [],
}) => {
  const [files, setFiles] = useState<FileWithCaption[]>(existingFiles);
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const imageCount = files.filter(f => f.fileType === 'image').length;
  const videoCount = files.filter(f => f.fileType === 'video').length;

  const processFiles = useCallback(async (fileList: FileList) => {
    const newErrors: string[] = [];
    const processedFiles: FileWithCaption[] = [];

    // Convert FileList to array
    const fileArray = Array.from(fileList);

    // Validate total counts
    const currentImages = files.filter(f => f.fileType === 'image').length;
    const currentVideos = files.filter(f => f.fileType === 'video').length;
    const newImages = fileArray.filter(f => f.type.startsWith('image/')).length;
    const newVideos = fileArray.filter(f => f.type.startsWith('video/')).length;

    if (currentImages + newImages > maxImages) {
      newErrors.push(`Maximum ${maxImages} images allowed. You have ${currentImages + newImages}.`);
    }
    if (currentVideos + newVideos > maxVideos) {
      newErrors.push(`Maximum ${maxVideos} videos allowed. You have ${currentVideos + newVideos}.`);
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    // Process each file
    for (const file of fileArray) {
      // Validate individual file
      if (file.size > maxFileSize) {
        newErrors.push(`File "${file.name}" exceeds maximum size of ${maxFileSize / 1024 / 1024}MB.`);
        continue;
      }

      const fileType = getFileCategory(file);
      if (fileType === 'unknown') {
        newErrors.push(`File type "${file.type}" not supported.`);
        continue;
      }

      // TypeScript narrowing - fileType is now 'image' | 'video'
      if (fileType !== 'image' && fileType !== 'video') {
        newErrors.push(`File type "${file.type}" not supported.`);
        continue;
      }

      try {
        const preview = await createFilePreview(file);
        processedFiles.push({
          file,
          caption: '',
          preview,
          fileType: fileType as 'image' | 'video'
        });
      } catch (error) {
        newErrors.push(`Failed to process file "${file.name}".`);
      }
    }

    setErrors(newErrors);

    if (processedFiles.length > 0) {
      const updatedFiles = [...files, ...processedFiles];
      setFiles(updatedFiles);
      onFilesSelected(updatedFiles);
    }
  }, [files, maxImages, maxVideos, maxFileSize, onFilesSelected]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled) return;

    const fileList = e.dataTransfer.files;
    if (fileList.length > 0) {
      processFiles(fileList);
    }
  }, [disabled, processFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList && fileList.length > 0) {
      processFiles(fileList);
    }
    // Reset input value to allow selecting same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processFiles]);

  const handleRemoveFile = useCallback((index: number) => {
    const updatedFiles = files.filter((_, i) => i !== index);
    setFiles(updatedFiles);
    onFilesSelected(updatedFiles);
  }, [files, onFilesSelected]);

  const handleCaptionChange = useCallback((index: number, caption: string) => {
    const updatedFiles = files.map((file, i) =>
      i === index ? { ...file, caption } : file
    );
    setFiles(updatedFiles);
    onFilesSelected(updatedFiles);
  }, [files, onFilesSelected]);

  const openFileDialog = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
          dragActive
            ? 'border-green-500 bg-green-50'
            : 'border-gray-300 hover:border-gray-400'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={handleFileInput}
          className="hidden"
          disabled={disabled}
        />
        <div className="space-y-2">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="text-sm text-gray-600">
            Drag & drop files here, or click to browse
          </p>
          <p className="text-xs text-gray-500">
            Up to {maxImages} images and {maxVideos} videos (max {maxFileSize / 1024 / 1024}MB each)
          </p>
        </div>
      </div>

      {/* File Count Indicator */}
      {files.length > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>{imageCount} / {maxImages} images</span>
          <span>{videoCount} / {maxVideos} videos</span>
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="space-y-1">
          {errors.map((error, index) => (
            <p key={index} className="text-sm text-red-600">
              ⚠️ {error}
            </p>
          ))}
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          {files.map((fileWithCaption, index) => (
            <div
              key={index}
              className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg"
            >
              {/* Preview */}
              <div className="flex-shrink-0">
                {fileWithCaption.fileType === 'image' ? (
                  <img
                    src={fileWithCaption.preview}
                    alt={fileWithCaption.file.name}
                    className="h-16 w-16 object-cover rounded"
                  />
                ) : (
                  <video
                    src={fileWithCaption.preview}
                    className="h-16 w-16 object-cover rounded"
                  />
                )}
              </div>

              {/* File Info & Caption */}
              <div className="flex-grow min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {fileWithCaption.file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {(fileWithCaption.file.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <input
                  type="text"
                  placeholder="Add a caption (optional)"
                  value={fileWithCaption.caption}
                  onChange={(e) => handleCaptionChange(index, e.target.value)}
                  className="mt-2 w-full text-sm border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                  disabled={disabled}
                />
              </div>

              {/* Remove Button */}
              <button
                onClick={() => handleRemoveFile(index)}
                disabled={disabled}
                className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 disabled:opacity-50"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MediaUploader;
