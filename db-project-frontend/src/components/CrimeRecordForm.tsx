import LocationPicker, { isValidLocation } from "./LocationPicker";

export type CrimeRecordFormValue = {
  title: string;
  description: string;
  crimeTypeId: string | number;
  incidentDate: string;
  zoneId: string | number;
  latitude: string;
  longitude: string;
};

type Option = {
  id: number;
  name: string;
};

type CrimeRecordFormProps = {
  value: CrimeRecordFormValue;
  zones: Option[];
  crimeTypes: Option[];
  locationError?: string;
  submitError?: string;
  onChange: (field: keyof CrimeRecordFormValue, value: string | number) => void;
  onLocationChange: (location: { latitude: string; longitude: string }) => void;
};

export default function CrimeRecordForm({
  value,
  zones,
  crimeTypes,
  locationError,
  submitError,
  onChange,
  onLocationChange,
}: CrimeRecordFormProps) {
  const locationValue = {
    latitude: String(value.latitude ?? ""),
    longitude: String(value.longitude ?? ""),
  };
  const defaultMapCenter = isValidLocation(locationValue)
    ? locationValue
    : {
        latitude: "24.899983520748542",
        longitude: "67.05814361572267",
      };

  return (
    <>
      <div className="border-b pb-4">
        <h3 className="font-semibold text-gray-800 mb-3">Crime Info</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div className="bg-gray-50 p-3 rounded-lg">
            <label className="text-xs font-medium text-gray-700">Zone</label>
            <select
              value={value.zoneId}
              onChange={(e) => onChange("zoneId", Number(e.target.value))}
              className="w-full text-sm bg-gray-100 mt-1 p-2 rounded border"
            >
              <option value="">Select zone</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.id} - {zone.name}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <label className="text-xs font-medium text-gray-700">Crime Type</label>
            <select
              value={value.crimeTypeId}
              onChange={(e) => onChange("crimeTypeId", Number(e.target.value))}
              className="w-full text-sm bg-gray-100 mt-1 p-2 rounded border"
            >
              <option value="">Select crime type</option>
              {crimeTypes.map((crimeType) => (
                <option key={crimeType.id} value={crimeType.id}>
                  {crimeType.name}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <label className="text-xs font-medium text-gray-700">Date</label>
            <input
              type="date"
              value={value.incidentDate}
              onChange={(e) => onChange("incidentDate", e.target.value)}
              className="w-full text-sm bg-gray-100 mt-1 p-2 rounded border"
            />
          </div>
        </div>

        <div className="bg-gray-50 p-3 rounded-lg mb-3">
          <label className="text-xs font-medium text-gray-700">Title</label>
          <textarea
            value={value.title}
            onChange={(e) => onChange("title", e.target.value)}
            className="w-full text-sm bg-gray-100 mt-1 p-2 rounded border h-20 resize-none"
          />
        </div>

        <div className="bg-gray-50 p-3 rounded-lg mb-3">
          <label className="text-xs font-medium text-gray-700">Description</label>
          <textarea
            value={value.description}
            onChange={(e) => onChange("description", e.target.value)}
            className="w-full text-sm bg-gray-100 mt-1 p-2 rounded border h-20 resize-none"
          />
        </div>
      </div>

      <div className="border-b pb-4 bg-green-50 p-3 rounded-lg">
        <h3 className="font-semibold text-green-900 mb-3">Location</h3>
        <LocationPicker
          value={locationValue}
          onChange={onLocationChange}
          defaultMapCenter={defaultMapCenter}
        />
        {locationError && (
          <p className="text-red-600 text-xs mt-2">{locationError}</p>
        )}
        {submitError && (
          <p className="text-red-600 text-xs mt-2">{submitError}</p>
        )}
      </div>
    </>
  );
}
