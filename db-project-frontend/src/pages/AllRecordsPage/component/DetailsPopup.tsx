import WhiteButton from "../../../components/WhiteButton";
import { useState, useEffect } from "react";
import { isValidLocation } from "../../../components/LocationPicker";
import CrimeRecordForm from "../../../components/CrimeRecordForm";
import AgentRecordForm, { type AgentBranchOption } from "../../../components/AgentRecordForm";
import GreenButton from "../../../components/GreenButton";
import MediaGallery from "../../../components/MediaGallery";
import PoliceMediaEditor from "../../../components/PoliceMediaEditor";
import { API_BASE_URL } from "../../../config/constants";
import { checkLocationInsideZone } from "../../../utils/zoneValidation";
import { getJwtAuthHeaders } from "../../../utils/authHeaders";
import type { CrimeMediaItem } from "./AllRecords";

type ZoneOption = {
  id: number;
  name: string;
};

type CrimeTypeOption = {
  id: number;
  name: string;
};

interface UpdateModalProps {
  version: "admin" | "police";
  isOpen: boolean;
  data: any; // FullCrimeDetails for police, AgentDetails for admin
  onClose: () => void;
  onSubmit: (updatedData: any) => Promise<string | void> | string | void;
}

interface MediaOperations {
  toAdd?: Array<{ file: File; caption: string }>;
  toRemove?: number[];
  toUpdate?: Record<number, { visibility?: 'public' | 'police_only'; caption?: string; evidenceMarked?: boolean }>;
}

export default function UpdateModal({ version, isOpen, data, onClose, onSubmit }: UpdateModalProps) {
  const [formData, setFormData] = useState(data);
  const [locationError, setLocationError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [crimeTypes, setCrimeTypes] = useState<CrimeTypeOption[]>([]);
  const [branches, setBranches] = useState<AgentBranchOption[]>([]);
  const [mediaEditMode, setMediaEditMode] = useState(false);
  const [mediaOperations, setMediaOperations] = useState<MediaOperations>({});

  // Get media data for police version
  const crimeMedia = version === "police" ? (data?.media || []) : [];

  // Sync local state when data changes
  useEffect(() => {
    setFormData(data);
    setLocationError("");
    setSubmitError("");
    setIsSaving(false);
  }, [data]);

  useEffect(() => {
    const fetchReferenceData = async () => {
      try {
        if (version === "admin") {
          const response = await fetch(`${API_BASE_URL}/admin/branches`, {
            headers: getJwtAuthHeaders(),
          });
          const data = await response.json().catch(() => null);
          if (response.ok && data?.success) {
            setBranches(Array.isArray(data.data) ? data.data : []);
          }
          return;
        }

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
      } catch (error) {
        console.error("Error fetching update reference data:", error);
      }
    };

    if (isOpen) {
      fetchReferenceData();
    }
  }, [isOpen, version]);

  if (!isOpen || !formData) return null;

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
    setLocationError("");
    setSubmitError("");
  };

  // Media operation handlers for police version
  const handleMediaRemove = (mediaId: number) => {
    setMediaOperations(prev => ({
      ...prev,
      toRemove: [...(prev.toRemove || []), mediaId]
    }));
  };

  const handleMediaUpdate = (mediaId: number, updates: { visibility?: 'public' | 'police_only'; caption?: string; evidenceMarked?: boolean }) => {
    setMediaOperations(prev => ({
      ...prev,
      toUpdate: {
        ...(prev.toUpdate || {}),
        [mediaId]: { ...(prev.toUpdate?.[mediaId] || {}), ...updates }
      }
    }));
  };

  const handleMediaAdd = (files: Array<{ file: File; caption: string }>) => {
    setMediaOperations(prev => ({
      ...prev,
      toAdd: [...(prev.toAdd || []), ...files]
    }));
  };

  const hasMediaChanges = () => {
    return (
      (mediaOperations.toAdd?.length || 0) > 0 ||
      (mediaOperations.toRemove?.length || 0) > 0 ||
      Object.keys(mediaOperations.toUpdate || {}).length > 0
    );
  };

  const handleSave = async () => {
    if (version === "admin" && (!formData.username || !formData.branchId)) {
      setSubmitError("Please provide username and branch before saving.");
      return;
    }

    if (
      version === "police" &&
      !isValidLocation({
        latitude: String(formData.latitude),
        longitude: String(formData.longitude),
      })
    ) {
      setLocationError("Please provide a valid location before saving.");
      return;
    }

    if (version === "police" && !formData.zoneId) {
      setLocationError("Please select a zone before saving.");
      return;
    }

    if (version === "police" && !formData.crimeTypeId) {
      setLocationError("Please select a crime type before saving.");
      return;
    }

    if (version === "police" && !formData.incidentDate) {
      setLocationError("Please select an incident date before saving.");
      return;
    }

    if (version === "police") {
      const zoneCheck = await checkLocationInsideZone(
        formData.zoneId,
        formData.latitude,
        formData.longitude
      );

      if (!zoneCheck.inside) {
        setLocationError(
          zoneCheck.message ||
            "Location must be inside the selected zone boundary. If you change the zone, select a point inside that zone before saving."
        );
        return;
      }
    }

    setIsSaving(true);
    setSubmitError("");

    try {
      // Include media operations in the submission data for police version
      const submitData = version === "police" && hasMediaChanges()
        ? { ...formData, mediaOperations }
        : formData;

      const errorMessage = await onSubmit(submitData);
      if (typeof errorMessage === "string" && errorMessage) {
        setSubmitError(errorMessage);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-4 sm:p-6 rounded-xl w-full max-w-[520px] shadow-xl overflow-y-auto max-h-[90vh]">
        <h2 className="text-xl sm:text-2xl font-semibold mb-4">
          {version === "admin" ? "Update Agent Details" : "Update Crime Record"}
        </h2>

        {version === "police" ? (
          <>
            <CrimeRecordForm
              value={{
                title: formData.title,
                description: formData.description,
                crimeTypeId: formData.crimeTypeId,
                incidentDate: formData.incidentDate,
                zoneId: formData.zoneId,
                latitude: String(formData.latitude),
                longitude: String(formData.longitude),
              }}
              zones={zones}
              crimeTypes={crimeTypes}
              locationError={locationError}
              submitError={submitError}
              onChange={(field, value) => handleChange(field, value)}
              onLocationChange={(location) => {
                setFormData((prev: any) => ({ ...prev, ...location }));
                setLocationError("");
                setSubmitError("");
              }}
            />

            {/* Media Section for Police Version */}
            {crimeMedia.length > 0 || (mediaOperations.toAdd?.length || 0) > 0 && (
              <>
                <hr className="my-4 border-t-2 border-[#d9d9d9]" />
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-[#7d7d7d]">Crime Evidence:</h3>
                  <button
                    onClick={() => setMediaEditMode(!mediaEditMode)}
                    className="text-xs px-3 py-1 rounded-full border border-[#237E54] text-[#237E54] hover:bg-green-50 transition-colors"
                  >
                    {mediaEditMode ? 'View Mode' : 'Edit Media'}
                  </button>
                </div>

                {mediaEditMode ? (
                  <PoliceMediaEditor
                    crimeId={data?.id}
                    media={crimeMedia}
                    onMediaUpdate={handleMediaUpdate}
                    onMediaDelete={handleMediaRemove}
                    onMediaAdd={handleMediaAdd}
                    disabled={isSaving}
                  />
                ) : (
                  <MediaGallery
                    media={crimeMedia}
                    userRole="police"
                    editable={false}
                  />
                )}

                {/* Media Changes Indicator */}
                {hasMediaChanges() && (
                  <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-700">
                      ⚠️ You have pending media changes that will be saved with the update.
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <AgentRecordForm
              value={{
                username: formData.username,
                branchId: formData.branchId,
              }}
              branches={branches}
              onChange={(field, value) => handleChange(field, value)}
            />
            {submitError && (
              <p className="text-red-600 text-xs mt-2 mb-3">{submitError}</p>
            )}
          </>
        )}

        <div className="flex justify-center gap-3 mt-6 pt-4 pb-2 bg-white">
          <WhiteButton label="Cancel" width={150} height={45} onClick={onClose} />
          <GreenButton
            label={isSaving ? "Updating..." : version === "admin" ? "Save" : "Update"}
            width={150}
            height={45}
            onClick={handleSave}
            disabled={isSaving}
            rounded="full"
            type="button"
          />
        </div>
      </div>
    </div>
  );
}
