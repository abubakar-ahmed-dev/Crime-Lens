// MapViewPage/components/CrimeMarkersClusters.tsx
import React from "react";
import MarkerClusterGroup from "react-leaflet-markercluster";
import type { Crime } from "./types";
import CrimeMarker from "./CrimeMarkers";

const CrimeMarkersClusters: React.FC<{ crimes: Crime[]; userRole?: "admin" | "police" | "user" | null }> = ({ crimes, userRole }) => {
  return (
    <MarkerClusterGroup chunkedLoading>
      {crimes.map((crime) => (
        <CrimeMarker key={crime.id} crime={crime} userRole={userRole} />
      ))}
    </MarkerClusterGroup>
  );
};

export default CrimeMarkersClusters;

