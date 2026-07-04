// VerificationPage/components/ConfirmationPopup.tsx
import { useEffect, useState } from "react";
import WhiteButton from "../../../components/WhiteButton";
import { isValidLocation } from "../../../components/LocationPicker";
import CrimeRecordForm from "../../../components/CrimeRecordForm";
import AgentRecordForm, { type AgentBranchOption } from "../../../components/AgentRecordForm";
import { API_BASE_URL } from "../../../config/constants";
import { checkLocationInsideZone } from "../../../utils/zoneValidation";
import { getJwtAuthHeaders } from "../../../utils/authHeaders";

type ZoneOption = {
  id: number;
  name: string;
};

type CrimeTypeOption = {
  id: number;
  name: string;
};

interface ConfirmationPopupProps {
  version: "admin" | "police";
  isOpen: boolean;
  onClose: () => void;

  requestId?: string | number;
  branchId?: string;
  username?: string;

  title?: string;
  submissionId?: string | number;
  fullName?: string;
  contact?: string;
  cnic?: string;
  crimeTypeId?: number | string;
  crimeType?: string;
  description?: string;
  date?: string;
  zone?: number;
  address?: string;
  latitude?: number | string;
  longitude?: number | string;

  onApprove?: (updatedData: any) => void;
  onReject?: () => void;
}

const buildInitialFormData = (initialData: Partial<ConfirmationPopupProps>) => ({
  branchId: initialData.branchId || "",
  username: initialData.username || "",
  title: initialData.title || "",
  fullName: initialData.fullName || "",
  contact: initialData.contact || "",
  cnic: initialData.cnic || "",
  crimeTypeId: initialData.crimeTypeId?.toString() || "",
  crimeType: initialData.crimeType || "",
  description: initialData.description || "",
  date: initialData.date || "",
  zone: initialData.zone || "",
  address: initialData.address || "",
  latitude: initialData.latitude?.toString() || "",
  longitude: initialData.longitude?.toString() || "",
});

export default function ConfirmationPopup({
  version,
  isOpen,
  onClose,
  onApprove,
  onReject,
  ...initialData
}: ConfirmationPopupProps) {
  const [formData, setFormData] = useState(buildInitialFormData(initialData));
  const [locationError, setLocationError] = useState("");
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [crimeTypes, setCrimeTypes] = useState<CrimeTypeOption[]>([]);
  const [branches, setBranches] = useState<AgentBranchOption[]>([]);

  useEffect(() => {
    if (isOpen) {
      setFormData(buildInitialFormData(initialData));
      setLocationError("");
    }
  }, [
    isOpen,
    initialData.branchId,
    initialData.username,
    initialData.title,
    initialData.fullName,
    initialData.contact,
    initialData.cnic,
    initialData.crimeTypeId,
    initialData.crimeType,
    initialData.description,
    initialData.date,
    initialData.zone,
    initialData.address,
    initialData.latitude,
    initialData.longitude,
  ]);

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
        console.error("Error fetching approval reference data:", error);
      }
    };

    if (isOpen) {
      fetchReferenceData();
    }
  }, [isOpen, version]);

  if (!isOpen) return null;

  const handleCrimeFieldChange = (field: string, value: string | number) => {
    const mappedField =
      field === "zoneId" ? "zone" : field === "incidentDate" ? "date" : field;
    setFormData((prev) => ({ ...prev, [mappedField]: value }));
    setLocationError("");
  };

  const handleSubmit = async () => {
    if (version === "admin") {
      if (!formData.username || !formData.branchId) {
        setLocationError("Please provide username and branch before approval.");
        return;
      }

      onApprove?.(formData);
      return;
    }

    if (
      version === "police" &&
      !isValidLocation({
        latitude: String(formData.latitude),
        longitude: String(formData.longitude),
      })
    ) {
      setLocationError("Please provide a valid location before approval.");
      return;
    }

    if (version === "police" && !formData.zone) {
      setLocationError("Please select a zone before approval.");
      return;
    }

    if (version === "police" && !formData.crimeTypeId) {
      setLocationError("Please select a crime type before approval.");
      return;
    }

    if (version === "police" && !formData.date) {
      setLocationError("Please select an incident date before approval.");
      return;
    }

    if (version === "police") {
      const zoneCheck = await checkLocationInsideZone(
        formData.zone,
        formData.latitude,
        formData.longitude
      );

      if (!zoneCheck.inside) {
        setLocationError(
          zoneCheck.message ||
            "Location must be inside the selected zone boundary. If you change the zone, select a point inside that zone before approval."
        );
        return;
      }
    }

    onApprove?.(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 backdrop-blur-sm">
      <div className="bg-white w-[520px] pb-0 pl-6 pr-6 pt-0 rounded-2xl shadow-xl animate-fadeIn font-outfit max-h-[85vh] overflow-y-auto">
        <h2 className="text-2xl font-semibold mb-6 pt-6 sticky top-0 bg-white pb-3">
          {version === "admin"
            ? "Confirm Agent Request Details"
            : "Approve Crime Report"}
        </h2>

        <div className="flex flex-col gap-4">
          {version === "admin" ? (
            <>
              <AgentRecordForm
                value={{
                  username: formData.username,
                  branchId: formData.branchId,
                }}
                branches={branches}
                onChange={(field, value) => {
                  setFormData((prev) => ({ ...prev, [field]: value }));
                  setLocationError("");
                }}
              />
              {locationError && (
                <p className="text-red-600 text-xs mt-2">{locationError}</p>
              )}
            </>
          ) : (
            <CrimeRecordForm
              value={{
                title: formData.title,
                description: formData.description,
                crimeTypeId: formData.crimeTypeId,
                incidentDate: formData.date,
                zoneId: formData.zone,
                latitude: String(formData.latitude),
                longitude: String(formData.longitude),
              }}
              zones={zones}
              crimeTypes={crimeTypes}
              locationError={locationError}
              onChange={handleCrimeFieldChange}
              onLocationChange={(location) => {
                setFormData((prev) => ({ ...prev, ...location }));
                setLocationError("");
              }}
            />
          )}
        </div>

        <div className="flex justify-center mt-6 pb-6 gap-3 bg-white pt-4">
          <WhiteButton label="Cancel" width={150} height={45} onClick={onClose} />

          <button
            onClick={handleSubmit}
            className="px-6 py-1 bg-linear-to-r from-[#145332] to-[#237E54] border-2 border-[#237E54] hover:from-[#145332] hover:to-[#145332] disabled:bg-gray-400 text-white text-sm rounded-full font-normal transition-colors"
            style={{ width: 300, height: 45 }}
          >
            Approve
          </button>
        </div>

        <style>{`
          .inputBox {
            width: 100%;
            padding: 10px 14px;
            border-radius: 8px;
            border: 1.5px solid #d0d0d0;
            font-size: 14px;
            font-family: inherit;
          }
          .animate-fadeIn {
            animation: fadeIn 0.25s ease-out;
          }
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </div>
    </div>
  );
}
