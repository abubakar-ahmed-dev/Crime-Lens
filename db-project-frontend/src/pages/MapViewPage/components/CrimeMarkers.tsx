// components/CrimeMarker.tsx
import React from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import type { Crime } from "./types";

import markerIcon2x from "../../../assets/leaflet/marker-icon-2x.png";
import markerIcon from "../../../assets/leaflet/marker-icon.png";
import markerShadow from "../../../assets/leaflet/marker-shadow.png";

export const DefaultIcon = new L.Icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const CrimeMarker: React.FC<{ crime: Crime }> = ({ crime }) => {
  // Defensive check
  if (!crime.latitude || !crime.longitude) return null;

  return (
    <Marker position={[crime.latitude, crime.longitude]} icon={DefaultIcon}>
      <Popup>
        <div className="text-sm">
          <h3 className="font-bold">{crime.title || "No title"}</h3>
          <p><strong>Description:</strong> <br />{crime.description || "No description"}</p>
          <p><strong>Type:</strong> {crime.crimeTypeName}</p>
          <p><strong>Zone:</strong> {crime.zoneName || "N/A"}</p>
          <p><strong>Date:</strong> {crime.incidentDate ? new Date(crime.incidentDate).toLocaleString() : "N/A"}</p>
          <p><strong>Address:</strong> {crime.address || "N/A"}</p>
        </div>
      </Popup>
    </Marker>
  );
};

export default CrimeMarker;
