// import Verification from "./component/Verification";
import { useSelector } from "react-redux";
import { type RootState } from "../../store";
import { API_BASE_URL } from "../../config/constants";

// src/pages/UploadPage.tsx
import React, { useState } from "react";
import axios from "axios";
import UploadFile from "./component/UploadFile";
import { toast, Toaster } from "react-hot-toast";

const UploadPage: React.FC<{ }> = ({ }) => {

    const role = useSelector((state: RootState) => state.currentRole.role);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [resultStats, setResultStats] = useState<{
    total: number;
    inserted: number;
    duplicates: number;
    invalid: number;
  } | null>(null);

  // Drag & Drop Handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // File selection
  const handleFileSelect = (file: File) => {
    if (file.type !== "text/csv") {
      toast.error("Only CSV files are allowed.");
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      toast.error("File size exceeds 1 MB.");
      return;
    }
    setSelectedFile(file);
    setFileName(file.name);
    setFileSize(`${(file.size / 1024).toFixed(2)} KB`);
    setResultStats(null); // reset previous results
  };

  // Upload
  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file first.");
      return;
    }

    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await axios.post(`${API_BASE_URL}/admin/upload-crimes`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const stats = response.data.stats;
      if (!stats) throw new Error("No stats returned from server");

      setResultStats(stats);
      toast.success("Upload completed successfully!");
    } catch (err: any) {
      console.error("Upload error:", err);
      const msg =
        err.response?.data?.message ||
        err.response?.statusText ||
        err.message ||
        "Upload failed. Please try again.";
      toast.error(msg);
    } finally {
      setIsUploading(false);
    }
  };

  // Upload Another File
  const handleUploadAnother = () => {
    setSelectedFile(null);
    setFileName(null);
    setFileSize(null);
    setResultStats(null);
  };

  return (
    <>
      <UploadFile
        fileName={fileName}
        fileSize={fileSize}
        isDragging={isDragging}
        isUploading={isUploading}
        resultStats={resultStats}
        onFileSelect={handleFileSelect}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onUpload={handleUpload}
        onUploadAnother={handleUploadAnother}
        version={role}
      />
      <Toaster position="top-right" />
    </>
  );
};

export default UploadPage;
