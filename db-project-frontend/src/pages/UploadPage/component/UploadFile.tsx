// src/components/UploadFile.tsx
import React from "react";
// import Sidebar from "../../components/Sidebar";
import GreenButton from "../../../components/GreenButton"; // ✅ import your button component
import WhiteButton from "../../../components/WhiteButton"; // ✅ import your button component

interface UploadFileProps {
    fileName: string | null;
    fileSize: string | null;
    isDragging: boolean;
    isUploading: boolean;
    resultStats: {
        total: number;
        inserted: number;
        duplicates: number;
        invalid: number;
    } | null;
    onFileSelect: (file: File) => void;
    onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
    onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
    onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
    onUpload: () => void;
    onUploadAnother: () => void;
    version: "admin" | "police" | "user" | null;
}

const UploadFile: React.FC<UploadFileProps> = ({
    fileName,
    fileSize,
    isDragging,
    isUploading,
    resultStats,
    onFileSelect,
    onDragOver,
    onDragLeave,
    onDrop,
    onUpload,
    onUploadAnother,
}) => {
    return (
        <div className="flex flex-col md:flex-row min-h-screen">
            <div className="flex-1 w-full p-4 sm:p-6 md:p-8 relative min-w-0">
                {/* Loader Overlay */}
                {isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50">
                        <div className="bg-green-400/30 backdrop-blur-lg rounded-2xl shadow-2xl p-10 flex flex-col items-center border border-white/30">
                            <div className="animate-spin animate-pulse border-4 border-white border-t-green-500 rounded-full w-14 h-14 mb-6"></div>
                            <p className="text-white text-lg font-medium tracking-wide">
                                Processing file...
                            </p>
                            <p className="text-white/80 text-sm mt-1">Please wait a moment</p>
                        </div>
                    </div>
                )}

                {/* Upload Card */}
                <div className="bg-white rounded-2xl shadow-md p-4 sm:p-8 mt-4 sm:mt-8 max-w-xl mx-auto w-full">
                    <h2 className="text-xl sm:text-2xl font-semibold mb-4">Bulk CSV Upload</h2>
                    <p className="text-gray-500 mb-6">
                        Upload a CSV file to insert multiple crime records at once.
                    </p>

                    {/* Drag & Drop Area */}
                    <div
                        className={`border-2 border-dashed rounded-xl p-6 sm:p-12 text-center cursor-pointer mb-2 ${isDragging ? "border-green-500 bg-green-50" : "border-gray-300"
                            }`}
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                        onClick={() => document.getElementById("fileInput")?.click()}
                    >
                        <p className="text-gray-400">
                            Drag & drop your CSV file here, or click to select
                        </p>
                        <input
                            type="file"
                            id="fileInput"
                            accept=".csv"
                            className="hidden"
                            onChange={(e) =>
                                e.target.files && onFileSelect(e.target.files[0])
                            }
                        />
                    </div>

                    <p className="text-sm text-gray-400 mb-1">
                        Max file size allowed: 1 MB, Format Supported: CSV
                    </p>

                    {/* Selected File Info */}
                    {fileName && (
                        <p className="text-sm text-gray-500 mt-6 mb-4">
                            File: {fileName} {fileSize && `(${fileSize})`}
                        </p>
                    )}
                    {/* ✅ Upload Button using GreenButton */}
                    {fileName && !resultStats && !isUploading && (
                        <div className="flex justify-center mt-2">
                            <GreenButton
                                label="Start Processing File"
                                width={undefined}
                                onClick={onUpload}
                            />
                        </div>
                    )}

                    {/* Result Summary */}
                    {resultStats && (
                        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
                            <div className="bg-green-50 rounded-xl p-4 text-center">
                                <p className="text-gray-400 text-sm">Total Records</p>
                                <p className="font-semibold text-lg">{resultStats.total}</p>
                            </div>
                            <div className="bg-green-100 rounded-xl p-4 text-center">
                                <p className="text-gray-400 text-sm">Inserted</p>
                                <p className="font-semibold text-lg">{resultStats.inserted}</p>
                            </div>
                            <div className="bg-yellow-100 rounded-xl p-4 text-center">
                                <p className="text-gray-400 text-sm">Duplicates</p>
                                <p className="font-semibold text-lg">{resultStats.duplicates}</p>
                            </div>
                            <div className="bg-red-100 rounded-xl p-4 text-center">
                                <p className="text-gray-400 text-sm">Invalid</p>
                                <p className="font-semibold text-lg">{resultStats.invalid}</p>
                            </div>
                        </div>
                    )}

                    {/* Upload Another Button */}
                    {resultStats && (
                        <div className="mt-6 sm:mt-8 flex justify-center">
                            <WhiteButton
                                label="Upload Another File"
                                width={undefined}
                                onClick={onUploadAnother}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UploadFile;

