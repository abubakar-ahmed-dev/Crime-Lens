import WhiteButton from "../../../components/WhiteButton";
import { useState, useEffect } from "react";
import LocationPicker, { isValidLocation } from "../../../components/LocationPicker";

interface UpdateModalProps {
  version: "admin" | "police";
  isOpen: boolean;
  data: any; // FullCrimeDetails for police, AgentDetails for admin
  onClose: () => void;
  onSubmit: (updatedData: any) => void;
}

export default function UpdateModal({ version, isOpen, data, onClose, onSubmit }: UpdateModalProps) {
  const [formData, setFormData] = useState(data);
  const [locationError, setLocationError] = useState("");

  // Sync local state when data changes
  useEffect(() => {
    setFormData(data);
    setLocationError("");
  }, [data]);

  if (!isOpen || !formData) return null;

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
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

    onSubmit(formData);
  };

  const locationValue = {
    latitude: String(formData.latitude ?? ""),
    longitude: String(formData.longitude ?? ""),
  };
  const defaultMapCenter = isValidLocation(locationValue)
    ? locationValue
    : {
      latitude: "24.899983520748542",
      longitude: "67.05814361572267",
    };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-4 sm:p-6 rounded-xl w-full max-w-[450px] shadow-xl overflow-y-auto max-h-[90vh] sm:max-h-[550px]">
        <h2 className="text-xl sm:text-2xl font-semibold mb-4">
          {version === "admin" ? "Update Agent Details" : "Update Crime Details"}
        </h2>

        {version === "police" ? (
          <>
            <label className="block mb-1">Title</label>
            <input
              type="text"
              className="border rounded px-3 py-2 w-full mb-3"
              value={formData.title}
              onChange={(e) => handleChange("title", e.target.value)}
            />

            <label className="block mb-1">Description</label>
            <textarea
              className="border rounded px-3 py-2 w-full mb-3"
              rows={3}
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
            />

            <label className="block mb-1">Address</label>
            <input
              type="text"
              className="border rounded px-3 py-2 w-full mb-3"
              value={formData.address}
              onChange={(e) => handleChange("address", e.target.value)}
            />

            <label className="block mb-1">Zone</label>
            <input
              type="number"
              className="border rounded px-3 py-2 w-full mb-3"
              value={formData.zoneId}
              onChange={(e) => handleChange("zoneId", Number(e.target.value))}
            />

            <label className="block mb-2 font-medium">Location</label>
            <LocationPicker
              value={locationValue}
              onChange={(location) => {
                setFormData((prev: any) => ({ ...prev, ...location }));
                setLocationError("");
              }}
              defaultMapCenter={defaultMapCenter}
            />
            {locationError && (
              <p className="text-red-600 text-xs mt-2 mb-3">{locationError}</p>
            )}
          </>
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

        <div className="flex justify-center gap-3">
          <WhiteButton label="Cancel" width={150} height={45} onClick={onClose} />
          <button
            onClick={handleSave}
            className="px-15 py-2 bg-blue-700 border-2 border-blue-500 text-white rounded-full hover:bg-blue-800"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
