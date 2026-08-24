//VerificationPage/components/VerificationCard.tsx
import { useState, useEffect } from "react";
import WhiteButton from "../../../components/WhiteButton";
import ConfirmationPopup from "./ConfirmationPopup";
import MediaGallery from "../../../components/MediaGallery";
import PoliceMediaEditor from "../../../components/PoliceMediaEditor";
import { API_BASE_URL } from "../../../config/constants";
import { getJwtAuthHeaders } from "../../../utils/authHeaders";
import type { CrimeMedia } from "../../../pages/MapViewPage/components/types";

type VerificationCardProps =
  | {
    version: "admin";
    requestId: string | number;
    branchId: string;
    branchZoneName?: string;
    branchContact: string;
    username: string;
    requestDate: string;
    onContact?: () => void;
    onReject?: (reason?: string) => void;
    onApprove?: () => void;
  }
  | {
    version: "police";
    title: string,
    submissionId: string | number;
    fullName: string;
    contact: string;
    cnic: string;
    crimeTypeId: number | string;
    crimeType: string;
    description: string;
    date: string;
    zone: number;
    zoneName?: string;
    address: string;
    latitude: number | string;
    longitude: number | string;
    media?: CrimeMedia[];
    onContact?: () => void;
    onReject?: (reason?: string) => void;
    onApprove?: (mediaChanges?: MediaChanges) => void;
  };

interface MediaChanges {
  toRemove?: number[];
  visibilityChanges?: Record<number, 'public' | 'police_only'>;
  captionUpdates?: Record<number, string>;
  evidenceMarkedChanges?: Record<number, boolean>;
  toAdd?: Array<{ file: File; caption: string }>;
}

export default function VerificationCard(props: VerificationCardProps) {
  const [openConfirm, setOpenConfirm] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mediaChanges, setMediaChanges] = useState<MediaChanges>({});
  const [editMediaMode, setEditMediaMode] = useState(false);

  // Local state for displayed media (with optimistic updates)
  const [displayedMedia, setDisplayedMedia] = useState<CrimeMedia[]>([]);

  // Get media for police version
  const crimeMedia = props.version === "police" ? (props as any).media || [] : [];

  // Debug: Log media data received
  console.log('[VerificationCard] Media Data:', {
    version: props.version,
    crimeMedia,
    mediaLength: crimeMedia.length,
    sampleMedia: crimeMedia[0] ? {
      id: crimeMedia[0].id,
      fileType: crimeMedia[0].fileType,
      thumbnailUrl: crimeMedia[0].thumbnailUrl,
      url: crimeMedia[0].url,
      visibility: crimeMedia[0].visibility
    } : 'No media'
  });

  // Sync displayedMedia with crimeMedia when props change
  useEffect(() => {
    setDisplayedMedia(crimeMedia);
  }, [crimeMedia]);

  // Copy contact number to clipboard and show snackbar
  const handleContactCopy = async () => {
    const num =
      props.version === "admin"
        ? // @ts-ignore - branchContact exists on admin variant
        (props as any).branchContact
        : // @ts-ignore - contact exists on police variant
        (props as any).contact;

    if (num) {
      try {
        await navigator.clipboard.writeText(num);
      } catch {
        // fallback: create temporary textarea
        const ta = document.createElement("textarea");
        ta.value = num;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
    }

    setShowSnackbar(true);
    setTimeout(() => setShowSnackbar(false), 2500);

    props.onContact?.();
  };

  // Media change handlers for police version
  const handleMediaRemove = (mediaId: number) => {
    setMediaChanges(prev => ({
      ...prev,
      toRemove: [...(prev.toRemove || []), mediaId]
    }));
  };

  const handleVisibilityChange = (mediaId: number, newVisibility: 'public' | 'police_only') => {
    setMediaChanges(prev => ({
      ...prev,
      visibilityChanges: {
        ...(prev.visibilityChanges || {}),
        [mediaId]: newVisibility
      }
    }));

    // Optimistic update - update displayed media immediately
    setDisplayedMedia(prev => prev.map(m =>
      m.id === mediaId ? { ...m, visibility: newVisibility } : m
    ));
  };

  const handleCaptionChange = (mediaId: number, newCaption: string) => {
    setMediaChanges(prev => ({
      ...prev,
      captionUpdates: {
        ...(prev.captionUpdates || {}),
        [mediaId]: newCaption
      }
    }));

    // Optimistic update - update displayed media immediately
    setDisplayedMedia(prev => prev.map(m =>
      m.id === mediaId ? { ...m, caption: newCaption } : m
    ));
  };

  const handleEvidenceMarkChange = (mediaId: number, marked: boolean) => {
    setMediaChanges(prev => ({
      ...prev,
      evidenceMarkedChanges: {
        ...(prev.evidenceMarkedChanges || {}),
        [mediaId]: marked
      }
    }));

    // Optimistic update - update displayed media immediately
    setDisplayedMedia(prev => prev.map(m =>
      m.id === mediaId ? { ...m, evidenceMarked: marked } : m
    ));
  };

  const handleMediaAdd = (files: Array<{ file: File; caption: string }>) => {
    setMediaChanges(prev => ({
      ...prev,
      toAdd: [...(prev.toAdd || []), ...files]
    }));
  };

  const hasMediaChanges = () => {
    return Object.keys(mediaChanges).some(key => {
      const value = mediaChanges[key as keyof MediaChanges];
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      if (value && typeof value === 'object') {
        return Object.keys(value).length > 0;
      }
      return false;
    });
  };

  // Handle Approve
  const handleApproveSubmit = async (updatedValues: any) => {
    setLoading(true);
    setError("");

    try {
      let endpoint = "";
      let body = {};

      if (props.version === "admin") {
        // @ts-ignore
        endpoint = `${API_BASE_URL}/agent/verify/${props.requestId}`;
        body = {
          roleId: 2,
          username: updatedValues.username,
          branchId: Number(updatedValues.branchId),
        }; // Default to police officer role
      } else {
        // @ts-ignore
        endpoint = `${API_BASE_URL}/user/approve/${props.submissionId}`;
        body = {
          address: updatedValues.address || "",
          zoneId: Number(updatedValues.zone),
          latitude: Number(updatedValues.latitude),
          longitude: Number(updatedValues.longitude),
          crimeTypeId: Number(updatedValues.crimeTypeId),
          incidentDate: updatedValues.date,
          title: updatedValues.title || "",
          description: updatedValues.description || "",
          mediaChanges: hasMediaChanges() ? mediaChanges : undefined,
        };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: getJwtAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setOpenConfirm(false);
        // Pass media changes to parent component
        props.onApprove?.(hasMediaChanges() ? mediaChanges : undefined);
      } else {
        setError(result.message || "Failed to approve");
      }
    } catch (err) {
      console.error("Approval Error:", err);
      setError("Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle Reject
  const handleRejectSubmit = async () => {
    const reason = "";

    setLoading(true);
    setError("");

    try {
      let endpoint = "";

      if (props.version === "admin") {
        // @ts-ignore
        endpoint = `${API_BASE_URL}/agent/reject/${props.requestId}`;
      } else {
        // @ts-ignore
        endpoint = `${API_BASE_URL}/user/reject/${props.submissionId}`;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: getJwtAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ reason }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setShowRejectConfirm(false);
        props.onReject?.(reason);
      } else {
        setError(result.message || "Failed to reject");
      }
    } catch (err) {
      console.error("Rejection Error:", err);
      setError("Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#ffffff] rounded-2xl shadow-[0_0_5px_rgba(0,0,0,0.08)] p-6 w-full flex flex-col gap-y-3 font-outfit border-2 border-[#e8e8e8] relative">
      {/* Admin Version */}
      {props.version === "admin" ? (
        <>
          <h3 className="font-semibold text-gray-700 mb-2">Agent Info:</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 text-sm text-gray-800">
            <p>
              <span className="font-semibold">Branch:</span>{" "}
              {props.branchZoneName ? `${props.branchId} - ${props.branchZoneName}` : props.branchId}
            </p>
            <p>
              <span className="font-semibold">Branch Contact #:</span>{" "}
              {props.branchContact}
            </p>
            <p>
              <span className="font-semibold">Username:</span> {props.username}
            </p>
            <p>
              <span className="font-semibold">Request Date:</span>{" "}
              {props.requestDate}
            </p>
          </div>
        </>
      ) : (
        <>
          {/* Police Version */}
          <h3 className="font-semibold text-[#7d7d7d]">Personal Info:</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 text-sm text-gray-800">
            <p>
              <span className="font-semibold">Full Name:</span> {props.fullName}
            </p>
            <p>
              <span className="font-semibold">CNIC:</span> {props.cnic}
            </p>
            <p>
              <span className="font-semibold">Contact #:</span> {props.contact}
            </p>
          </div>

          <hr className="my-4 border-t-2 border-[#d9d9d9]" />

          <h3 className="font-semibold text-[#7d7d7d]">Crime Info:</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 text-sm text-gray-800">
            <p>
              <span className="font-semibold">Title:</span>{" "}
              {props.title || "--"}
            </p>
            <p>
              <span className="font-semibold">Crime Type:</span>{" "}
              {props.crimeType}
            </p>
            <p>
              <span className="font-semibold">Date:</span> {props.date}
            </p>
            <p>
              <span className="font-semibold">Zone:</span>{" "}
              {props.zoneName ? `${props.zone} - ${props.zoneName}` : props.zone}
            </p>
            <p>
              <span className="font-semibold">Address:</span>{" "}
              {props.address || "--"}
            </p>
            <p>
              <span className="font-semibold">Description:</span>{" "}
              {props.description || "--"}
            </p>
          </div>

          {/* Media Section for Police Version */}
          {crimeMedia.length > 0 && (
            <>
              <hr className="my-4 border-t-2 border-[#d9d9d9]" />
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-[#7d7d7d]">Attached Evidence:</h3>
                <button
                  onClick={() => setEditMediaMode(!editMediaMode)}
                  className="text-xs px-3 py-1 rounded-full border border-[#237E54] text-[#237E54] hover:bg-green-50 transition-colors"
                >
                  {editMediaMode ? 'View Mode' : 'Edit Media'}
                </button>
              </div>

              {editMediaMode ? (
                <PoliceMediaEditor
                  crimeId={Number(props.submissionId)}
                  media={displayedMedia}
                  onMediaUpdate={(mediaId, updates) => {
                    if (updates.visibility) handleVisibilityChange(mediaId, updates.visibility);
                    if (updates.caption !== undefined) handleCaptionChange(mediaId, updates.caption);
                    if (updates.evidenceMarked !== undefined) handleEvidenceMarkChange(mediaId, updates.evidenceMarked);
                  }}
                  onMediaDelete={(mediaId) => handleMediaRemove(mediaId)}
                  onMediaAdd={(files) => handleMediaAdd(files)}
                  disabled={loading}
                />
              ) : (
                <MediaGallery
                  media={displayedMedia}
                  userRole="police"
                  editable={false}
                />
              )}

              {/* Media Changes Indicator */}
              {hasMediaChanges() && (
                <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-700">
                    ⚠️ You have pending media changes that will be applied on approval.
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-600 text-sm font-outfit">{error}</p>
        </div>
      )}

      {/* Footer Buttons */}
      <div className="border-t-2 border-[#d9d9d9] mt-4 pt-6 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
        <div className="w-full lg:w-[240px] xl:w-[280px] shrink-0">
          <WhiteButton
            label="Contact for Verification"
            height={40}
            fullWidth
            onClick={handleContactCopy}
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto lg:justify-end">
          <button
            onClick={() => setShowRejectConfirm(true)}
            disabled={loading}
            className="w-full sm:flex-1 lg:w-[160px] xl:w-[190px] px-6 py-1 bg-[#b80404] hover:bg-red-900 border-2 border-[#b80404] disabled:bg-gray-400 text-white text-sm rounded-full font-normal transition-colors"
            style={{ height: 40 }}
          >
            {loading ? "Processing..." : "Reject"}
          </button>
          <button
            onClick={() => setOpenConfirm(true)}
            disabled={loading}
            className="w-full sm:flex-1 lg:w-[160px] xl:w-[190px] px-6 py-1 bg-linear-to-r from-[#145332] to-[#237E54] border-2 border-[#237E54] hover:from-[#145332] hover:to-[#145332] disabled:bg-gray-400 text-white text-sm rounded-full font-normal transition-colors"
            style={{ height: 40 }}
          >
            {loading ? "Processing..." : "Approve"}
          </button>
        </div>
      </div>

      {/* Approve popup */}
      <ConfirmationPopup
        {...props} // contains version and the rest
        isOpen={openConfirm}
        onClose={() => setOpenConfirm(false)} //
        onApprove={(updatedValues) => {
          handleApproveSubmit(updatedValues);
        }}
        onReject={() => {
          setOpenConfirm(false);
        }}
      />

      {/* Reject confirm modal (for main card Reject button) */}
      {showRejectConfirm && (
        <div className="fixed inset-0 bg-black/30 flex justify-center items-center z-40 p-4">
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg w-full max-w-[380px] animate-fadeIn">
            <h3 className="text-xl font-semibold mb-4 text-gray-700 flex justify-center">
              Are you sure you want to reject?
            </h3>

            <div className="flex justify-center gap-2">
              <WhiteButton
                label="Cancel"
                width={120}
                height={40}
                onClick={() => setShowRejectConfirm(false)}
              />
              <button
                onClick={() => handleRejectSubmit()}
                disabled={loading}
                className="px-6 py-1 bg-[#b80404] hover:bg-red-900 border-2 border-[#b80404] disabled:bg-gray-400 text-white text-sm rounded-full font-normal transition-colors"
                style={{ width: 120, height: 40 }}
              >
                {loading ? "Processing..." : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top-right white snackbar (slides in/out) */}
      <div
        className={`fixed top-6 right-[-420px] z-50 transition-all duration-500 ease-out`}
        style={{
          right: showSnackbar ? 20 : -420,
        }}
        aria-hidden={!showSnackbar}
      >
        <div
          className="bg-white shadow-[0_0_5px_rgba(0,0,0,0.08)] rounded-xl px-6 py-5 flex flex-col items-center"
          style={{ minWidth: 220 }}
        >
          {/* green circled check */}
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              border: "3px solid #16a34a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#fff",
            }}
          >
            {/* simple check svg */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 22"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M20 6L9 17L4 12"
                stroke="#16a34a"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="mt-2 text-sm text-gray-800 font-medium">
            Contact No. copied to clipboard.
          </div>
        </div>
      </div>

      {/* minor keyframe for reject modal fade (kept local) */}
      <style>{`
        .animate-fadeIn {
          animation: fadeIn 0.18s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
