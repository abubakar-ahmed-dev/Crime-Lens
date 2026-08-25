import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import GreenButton from "./GreenButton";
import markerIcon2x from "../assets/leaflet/marker-icon-2x.png";
import markerIcon from "../assets/leaflet/marker-icon.png";
import markerShadow from "../assets/leaflet/marker-shadow.png";

export type LocationValue = {
  latitude: string;
  longitude: string;
};

type LocationMode = "manual" | "current" | "map";

type LocationPickerProps = {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  disabled?: boolean;
  defaultMapCenter?: LocationValue;
};

const DEFAULT_CENTER = {
  latitude: "24.899983520748542",
  longitude: "67.05814361572267",
};

const pickerIcon = new L.Icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const isValidLocation = (value: LocationValue) => {
  const lat = Number(value.latitude);
  const lng = Number(value.longitude);
  return (
    value.latitude !== "" &&
    value.longitude !== "" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 23 &&
    lat <= 26 &&
    lng >= 65 &&
    lng <= 68
  );
};

const formatCoord = (value: number) => value.toFixed(6);

const MapClickSetter = ({
  onPick,
}: {
  onPick: (value: LocationValue) => void;
}) => {
  useMapEvents({
    click(e) {
      onPick({
        latitude: formatCoord(e.latlng.lat),
        longitude: formatCoord(e.latlng.lng),
      });
    },
  });

  return null;
};

export default function LocationPicker({
  value,
  onChange,
  disabled,
  defaultMapCenter = DEFAULT_CENTER,
}: LocationPickerProps) {
  const [mode, setMode] = useState<LocationMode>("manual");
  const [mapSelection, setMapSelection] = useState<LocationValue>(value);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (value.latitude && value.longitude) {
      setMapSelection(value);
    }
  }, [value]);

  const mapCenter = useMemo(() => {
    const source = isValidLocation(value)
      ? value
      : isValidLocation(defaultMapCenter)
        ? defaultMapCenter
        : DEFAULT_CENTER;
    return [Number(source.latitude), Number(source.longitude)] as [number, number];
  }, [defaultMapCenter, value]);

  const selectedPosition = isValidLocation(mapSelection)
    ? ([Number(mapSelection.latitude), Number(mapSelection.longitude)] as [number, number])
    : mapCenter;

  const setModeExclusive = (nextMode: LocationMode) => {
    setMode(nextMode);
    setMessage("");
    if (nextMode === "map") {
      const initialSelection = isValidLocation(value) ? value : defaultMapCenter;
      setMapSelection(initialSelection);
    }
  };

  const useCurrentLocation = () => {
    setMode("current");
    setMessage("");

    if (!navigator.geolocation) {
      setMessage("Current location is not supported by this browser.");
      onChange({ latitude: "", longitude: "" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({
          latitude: formatCoord(position.coords.latitude),
          longitude: formatCoord(position.coords.longitude),
        });
      },
      () => {
        setMessage("Unable to get current location. Please allow location access.");
        onChange({ latitude: "", longitude: "" });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleManualChange = (field: keyof LocationValue, nextValue: string) => {
    setMode("manual");
    setMessage("");
    onChange({ ...value, [field]: nextValue });
  };

  const applyMapSelection = () => {
    onChange(mapSelection);
    setMessage("Location selected from map.");
  };

  return (
    <div className="border border-[#d9d9d9] rounded-lg p-3 bg-white flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setModeExclusive("manual")}
          className={`rounded-full border px-3 py-2 text-sm font-outfit ${
            mode === "manual"
              ? "border-[#237E54] bg-green-50 text-[#145332]"
              : "border-[#d9d9d9] text-gray-500"
          }`}
        >
          Enter Lat/Lon
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={useCurrentLocation}
          className={`rounded-full border px-3 py-2 text-sm font-outfit ${
            mode === "current"
              ? "border-[#237E54] bg-green-50 text-[#145332]"
              : "border-[#d9d9d9] text-gray-500"
          }`}
        >
          Current Location
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setModeExclusive("map")}
          className={`rounded-full border px-3 py-2 text-sm font-outfit ${
            mode === "map"
              ? "border-[#237E54] bg-green-50 text-[#145332]"
              : "border-[#d9d9d9] text-gray-500"
          }`}
        >
          Select from Map
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          type="number"
          step="0.000001"
          value={value.latitude}
          onChange={(e) => handleManualChange("latitude", e.target.value)}
          disabled={disabled || mode !== "manual"}
          placeholder="Latitude"
          className="border border-[#d9d9d9] rounded-md px-3 py-2 text-sm placeholder:text-[#ababab] focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
        />
        <input
          type="number"
          step="0.000001"
          value={value.longitude}
          onChange={(e) => handleManualChange("longitude", e.target.value)}
          disabled={disabled || mode !== "manual"}
          placeholder="Longitude"
          className="border border-[#d9d9d9] rounded-md px-3 py-2 text-sm placeholder:text-[#ababab] focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
        />
      </div>

      {mode === "map" && (
        <div className="relative z-0 flex flex-col gap-3">
          <div className="relative z-0 h-64 overflow-hidden rounded-lg border border-[#d9d9d9]">
            <MapContainer
              center={mapCenter}
              zoom={13}
              scrollWheelZoom
              zoomAnimation={false}
              fadeAnimation={false}
              markerZoomAnimation={false}
              style={{ width: "100%", height: "100%" }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
              <MapClickSetter onPick={setMapSelection} />
              <Marker position={selectedPosition} icon={pickerIcon} />
            </MapContainer>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              Click on the map, then set the selected location.
            </p>
            <GreenButton
              label="Set Location"
              width={150}
              height={38}
              type="button"
              onClick={applyMapSelection}
              disabled={disabled}
            />
          </div>
        </div>
      )}

      {message && <p className="text-sm text-[#237E54] font-outfit">{message}</p>}
    </div>
  );
}

export { isValidLocation };
