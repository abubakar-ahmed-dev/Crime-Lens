// components/CrimeMarker.tsx
import React from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import type { Crime, CrimeMedia } from "./types";
import MediaGallery from "../../../components/MediaGallery";

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

const CrimeMarker: React.FC<{ crime: Crime; userRole?: "admin" | "police" | "user" | null }> = ({ crime, userRole }) => {
  // Defensive check
  if (!crime.latitude || !crime.longitude) return null;

  // Determine user role for visibility filtering - use passed userRole prop
  const effectiveUserRole = userRole === 'admin' || userRole === 'police' ? 'staff' : 'citizen';

  // Filter media by visibility
  const getFilteredMedia = (): CrimeMedia[] => {
    if (!crime.media || crime.media.length === 0) return [];

    if (effectiveUserRole === 'staff') {
      // Police/admin see all media
      return crime.media;
    } else {
      // Citizens only see public media
      return crime.media.filter(m => m.visibility === 'public');
    }
  };

  const filteredMedia = getFilteredMedia();
  const publicMediaCount = crime.media?.filter(m => m.visibility === 'public').length || 0;
  const policeOnlyMediaCount = (crime.mediaCount || 0) - publicMediaCount;

  return (
    <Marker position={[crime.latitude, crime.longitude]} icon={DefaultIcon}>
      <Popup>
        <div className="text-sm max-w-xs">
          <h3 className="font-bold text-base mb-2">{crime.title || "No title"}</h3>

          {/* Media Section */}
          {filteredMedia.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-700">
                  {filteredMedia.length} media item{filteredMedia.length !== 1 ? 's' : ''}
                </span>
                {effectiveUserRole === 'staff' && policeOnlyMediaCount > 0 && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 ml-2 rounded-full">
                    🔒 {policeOnlyMediaCount} police only
                  </span>
                )}
              </div>

              {/* Media Gallery with full functionality */}
              <MediaGallery
                media={filteredMedia}
                userRole={effectiveUserRole === 'staff' ? 'police' : 'citizen'}
                editable={false}
              />
            </div>
          )}

          {/* Crime Details */}
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
