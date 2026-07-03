import WhiteButton from "../../../components/WhiteButton";
import { useState, useEffect } from "react";
import { isValidLocation } from "../../../components/LocationPicker";
import CrimeRecordForm from "../../../components/CrimeRecordForm";
import GreenButton from "../../../components/GreenButton";
import { API_BASE_URL } from "../../../config/constants";
import { checkLocationInsideZone } from "../../../utils/zoneValidation";

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

export default function UpdateModal({ version, isOpen, data, onClose, onSubmit }: UpdateModalProps) {
  const [formData, setFormData] = useState(data);
  const [locationError, setLocationError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [crimeTypes, setCrimeTypes] = useState<CrimeTypeOption[]>([]);

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

    if (isOpen && version === "police") {
      fetchReferenceData();
    }
  }, [isOpen, version]);

  if (!isOpen || !formData) return null;

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
    setLocationError("");
    setSubmitError("");
  };

  const handleSave = async () => {
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
      const errorMessage = await onSubmit(formData);
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
        ) : (
          <>
            <label className="block mb-1">Username</label>
            <input
              type="text"
              className="border rounded- px-3 py-2 w-full mb-3"
              value={formData.username}
              onChange={(e) => handleChange("username", e.target.value)}
            />

            <label className="block mb-1">Password</label>
            <input
              type="text"
              className="border rounded px-3 py-2 w-full mb-3"
              value={formData.password}
              onChange={(e) => handleChange("password", e.target.value)}
            />

            <label className="block mb-1">Branch ID</label>
            <input
              type="number"
              className="border rounded px-3 py-2 w-full mb-3"
              value={formData.branchId}
              onChange={(e) => handleChange("branchId", Number(e.target.value))}
            />
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
