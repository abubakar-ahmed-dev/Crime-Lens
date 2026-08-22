import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../../config/constants";
import { supabase, useAuth } from "../../../context/AuthContext";
import LocationPicker, { isValidLocation } from "../../../components/LocationPicker";
import GreenButton from "../../../components/GreenButton";
import MediaUploader from "../../../components/MediaUploader";
import { uploadMedia } from "../../../services/api";

type ZoneOption = {
  id: number;
  name: string;
};

type CrimeTypeOption = {
  id: number;
  name: string;
};

type FileWithCaption = {
  file: File;
  caption: string;
  preview: string;
  fileType: 'image' | 'video';
};

type UploadedMediaItem = {
  id: number;
  publicId: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  fileType: 'image' | 'video';
  url: string;
  thumbnailUrl: string;
  width?: number;
  height?: number;
  duration?: number;
  uploadedBy: 'citizen' | 'police';
  uploadedAt: string;
  visibility: 'public' | 'police_only';
  caption?: string;
  evidenceMarked: boolean;
};

type UploadMediaResponse = {
  success: boolean;
  data?: {
    media: UploadedMediaItem[];
    crimeId: number;
    count: number;
  };
  message?: string;
};

export default function ReportCrimeCard() {
  const navigate = useNavigate();
  const { citizen, citizenToken, isCitizenAuthenticated, refreshCitizenSession } = useAuth();

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [hideLocationPicker, setHideLocationPicker] = useState(false);
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [crimeTypes, setCrimeTypes] = useState<CrimeTypeOption[]>([]);
  const [mediaFiles, setMediaFiles] = useState<FileWithCaption[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [formData, setFormData] = useState({
    title: "",
    zone: "",
    crimeTypeId: 0,
    date: "",
    address: "",
    description: "",
    latitude: "",
    longitude: "",
  });

  // Check authentication on mount
  useEffect(() => {
    if (!isCitizenAuthenticated) {
      setShowAuthPrompt(true);
    }
  }, [isCitizenAuthenticated]);

  useEffect(() => {
    const fetchReferenceData = async () => {
      try {
        const [zonesResponse, crimeTypesResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/zones`),
          fetch(`${API_BASE_URL}/crimes/types`),
        ]);

        if (zonesResponse.ok) {
          const zonesData = await zonesResponse.json();
          setZones(Array.isArray(zonesData) ? zonesData : []);
        }

        if (crimeTypesResponse.ok) {
          const crimeTypesData = await crimeTypesResponse.json();
          setCrimeTypes(Array.isArray(crimeTypesData) ? crimeTypesData : []);
        }
      } catch (err) {
        console.error("Error fetching report reference data:", err);
      }
    };

    fetchReferenceData();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    // Check authentication
    if (!isCitizenAuthenticated || !citizen) {
      setError("Please login to submit a crime report");
      navigate("/login-citizen");
      return;
    }

    // Check profile completion
    if (!citizen.isProfileComplete) {
      setError("Please complete your profile first");
      navigate("/complete-profile");
      return;
    }

    // Validate required fields
    if (!formData.title || !formData.zone || !formData.crimeTypeId || !formData.date || !formData.address) {
      setError("Please fill in all required fields");
      return;
    }

    if (!isValidLocation({ latitude: formData.latitude, longitude: formData.longitude })) {
      setError("Please provide a valid location using one of the location options.");
      return;
    }

    setLoading(true);
    setUploadProgress(0);

    try {
      let accessToken = citizenToken || localStorage.getItem("citizen_token");
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.access_token) {
        accessToken = session.access_token;
        localStorage.setItem("citizen_token", session.access_token);
      }

      if (!accessToken) {
        setError("Your session has expired. Please login again.");
        navigate("/login-citizen");
        return;
      }

      // First, upload media if any files are selected
      let mediaData: UploadedMediaItem[] = [];
      if (mediaFiles.length > 0) {
        setUploadProgress(10);

        try {
          setUploadProgress(30);
          // Get fresh token from Supabase session
          let token = citizenToken || localStorage.getItem("citizen_token");
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            token = session.access_token;
          }

          if (!token) {
            setError("Your session has expired. Please login again.");
            setLoading(false);
            setUploadProgress(0);
            return;
          }

          const uploadResult = await uploadMedia(
            mediaFiles.map(f => f.file),
            mediaFiles.map(f => f.caption),
            undefined,
            token
          ) as UploadMediaResponse;

          setUploadProgress(70);

          // Handle the response from uploadMedia
          if (uploadResult && uploadResult.success) {
            mediaData = uploadResult.data?.media || [];
          } else {
            const errorMessage = uploadResult?.message || uploadResult?.message || "Failed to upload media. Please try again.";
            setError(errorMessage);
            setSuccessMsg("");
            setLoading(false);
            setUploadProgress(0);
            return;
          }
        } catch (uploadError: any) {
          console.error("Error uploading media:", uploadError);
          const errorMessage = uploadError?.response?.data?.message || uploadError?.message || "Failed to upload media. Please try again.";
          setError(errorMessage);
          setSuccessMsg("");
          setLoading(false);
          setUploadProgress(0);
          return;
        }
      }

      setUploadProgress(90);

      // Submit crime report with media data
      const requestBody = {
        ...formData,
        mediaData: mediaData.length > 0 ? mediaData : undefined,
      };

      let response = await fetch(
        `${API_BASE_URL}/user/report-crime`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (response.status === 401) {
        await refreshCitizenSession();
        accessToken = localStorage.getItem("citizen_token");

        if (!accessToken) {
          setError("Your session has expired. Please login again.");
          navigate("/login-citizen");
          return;
        }

        response = await fetch(
          `${API_BASE_URL}/user/report-crime`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${accessToken}`,
            },
            body: JSON.stringify(requestBody),
          }
        );
      }

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccessMsg("Crime report submitted successfully!");
        setError("");
        setHideLocationPicker(true);

        // Reset form
        setFormData({
          title: "",
          zone: "",
          crimeTypeId: 0,
          date: "",
          address: "",
          description: "",
          latitude: "",
          longitude: "",
        });
        setMediaFiles([]);
        setUploadProgress(0);

        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          navigate("/citizen-dashboard");
        }, 2000);
      } else {
        setError(data.message || "Failed to submit the report.");
        setSuccessMsg("");
      }
    } catch (err) {
      console.error("Error submitting report:", err);
      setError("Server error. Please try again later.");
      setSuccessMsg("");
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  // Helper function for placeholder color
  const getInputTextColor = (value: string | number) =>
    value ? "text-gray-700" : "text-[#ababab]";

  // Show auth prompt if not authenticated
  if (showAuthPrompt) {
    return (
      <div className="bg-white rounded-2xl shadow-[0_0_5px_rgba(0,0,0,0.08)] p-6 w-full border-2 border-[#e8e8e8] font-outfit text-center">
        <div className="mb-6">
          <svg className="w-16 h-16 mx-auto text-[#237E54]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Authentication Required</h3>
        <p className="text-gray-600 mb-6">Please login or register to submit a crime report.</p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => navigate("/login-citizen")}
            className="px-6 py-2 bg-[#237E54] text-white rounded-lg hover:bg-[#1a6644] transition-colors"
          >
            Login
          </button>
          <button
            onClick={() => navigate("/register")}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Register
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-[0_0_5px_rgba(0,0,0,0.08)] p-4 sm:p-6 w-full border-2 border-[#e8e8e8] font-outfit">
      {/* Success Message */}
      {successMsg && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-600 text-sm font-medium">{successMsg}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm font-medium">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* CRIME INFO */}
        <div>
          <h3 className="font-semibold text-[#7d7d7d] mb-4">Crime Information:</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Crime Type */}
            <div className="flex flex-col">
              <label className="font-medium text-gray-700">
                Crime Type: <span className="text-red-500">*</span>
              </label>

              <select
                name="crimeTypeId"
                value={formData.crimeTypeId}
                onChange={handleChange}
                required
                disabled={loading}
                className={`border border-[#d9d9d9] rounded-md px-3 py-2 text-sm bg-white placeholder:text-[#ababab] focus:outline-none focus:ring-2 focus:ring-green-500 ${getInputTextColor(
                  formData.crimeTypeId
                )}`}
              >
                <option value="">Not Selected</option>
                {crimeTypes.map((crimeType) => (
                  <option key={crimeType.id} value={crimeType.id}>
                    {crimeType.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div className="flex flex-col">
              <label className="font-medium text-gray-700">
                Date of Incident: <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
                disabled={loading}
                className={`border border-[#d9d9d9] rounded-md px-3 py-2 text-sm placeholder:text-[#ababab] focus:outline-none focus:ring-2 focus:ring-green-500 ${getInputTextColor(
                  formData.date
                )}`}
              />
            </div>

            {/* Zone */}
            <div className="flex flex-col">
              <label className="font-medium text-gray-700">
                Zone: <span className="text-red-500">*</span>
              </label>

              <select
                name="zone"
                value={formData.zone}
                onChange={handleChange}
                required
                disabled={loading}
                className={`border border-[#d9d9d9] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${getInputTextColor(
                  formData.zone
                )}`}
              >
                <option value="">Select a zone...</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Address */}
            <div className="flex flex-col">
              <label className="font-medium text-gray-700">
                Address: <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="address"
                placeholder="Enter incident address..."
                value={formData.address}
                onChange={handleChange}
                required
                disabled={loading}
                className={`border border-[#d9d9d9] rounded-md px-3 py-2 text-sm placeholder:text-[#ababab] focus:outline-none focus:ring-2 focus:ring-green-500 ${getInputTextColor(
                  formData.address
                )}`}
              />
            </div>
          </div>

          {/* Title */}
          <div className="flex flex-col mt-6">
            <label className="font-medium text-gray-700">
              Title: <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              placeholder="Enter a short title for the crime..."
              value={formData.title}
              onChange={handleChange}
              required
              disabled={loading}
              className={`border border-[#d9d9d9] rounded-md px-3 py-2 text-sm placeholder:text-[#ababab] focus:outline-none focus:ring-2 focus:ring-green-500 ${getInputTextColor(
                formData.title
              )}`}
            />
          </div>

          {/* Description */}
          <div className="flex flex-col mt-6">
            <label className="font-medium text-gray-700">Description (Optional):</label>
            <textarea
              name="description"
              placeholder="Provide additional details (300 characters max)..."
              value={formData.description}
              onChange={handleChange}
              maxLength={300}
              disabled={loading}
              className={`border border-[#d9d9d9] rounded-md px-3 py-2 text-sm resize-none h-24 placeholder:text-[#ababab] focus:outline-none focus:ring-2 focus:ring-green-500 ${getInputTextColor(
                formData.description
              )}`}
            />
            <p className="text-xs text-gray-500 mt-1">
              {formData.description.length}/300 characters
            </p>
          </div>

          {/* Media Upload Section */}
          <div className="mt-6">
            <h3 className="font-medium text-gray-700 mb-2">Attach Evidence (Optional):</h3>
            <p className="text-xs text-gray-500 mb-4">
              You can add up to 5 images and 2 videos (max 5MB each). All media will be visible to the public by default.
            </p>
            <MediaUploader
              onFilesSelected={(files) => setMediaFiles(files)}
              existingFiles={mediaFiles}
              disabled={loading}
              maxImages={5}
              maxVideos={2}
            />
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-[#7d7d7d] mb-4">Location:</h3>
          {!hideLocationPicker && (
            <LocationPicker
              value={{
                latitude: formData.latitude,
                longitude: formData.longitude,
              }}
              onChange={(location) => {
                setFormData((prev) => ({ ...prev, ...location }));
                setError("");
              }}
              disabled={loading}
            />
          )}
        </div>

        {/* User Info Display */}
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-sm text-gray-600">
            <strong>Submitting as:</strong> {citizen?.fullName} ({citizen?.email})
          </p>
        </div>

        {/* Upload Progress */}
        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-blue-600 font-medium">Uploading media...</p>
              <p className="text-sm text-blue-600">{uploadProgress}%</p>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* SUBMIT BUTTON */}
        <div className="flex justify-center pt-4">
          <GreenButton
            type="submit"
            label={loading ? "Submitting..." : "Submit Report"}
            width={250}
            height={45}
            disabled={loading}
          />
        </div>
      </form>
    </div>
  );
}
