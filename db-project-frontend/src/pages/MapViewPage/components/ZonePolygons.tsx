// MapViewPage/components/ZonePolygon.tsx
import React, { useContext, useEffect, useState } from "react";
import { MapContext } from "./MapContext";
// import type { ZoneSeverity } from "./MapContext";
import { Polygon, Tooltip } from "react-leaflet";

const ZonePolygon: React.FC = () => {
  const { highlightZoneLayer, zoneSeverityData } = useContext(MapContext);
  const [maxSeverity, setMaxSeverity] = useState(0);

  useEffect(() => {
    if (zoneSeverityData.length > 0) {
      setMaxSeverity(Math.max(...zoneSeverityData.map(z => z.totalSeverity)));
    }
  }, [zoneSeverityData]);

  const getColor = (zoneId: number) => {
    const z = zoneSeverityData.find(z => z.zoneId === zoneId);
    if (!z || z.totalSeverity === 0) return "#ccc"; // grey
    const ratio = z.totalSeverity / (maxSeverity || 1);
    if (ratio <= 0.25) return "#00FF00";
    if (ratio <= 0.5) return "#FFFF00";
    if (ratio <= 0.75) return "#FFA500";
    return "#FF0000";
  };

  if (!highlightZoneLayer || zoneSeverityData.length === 0) return null;

  return (
    <>
      {zoneSeverityData.map(zone => (
        <Polygon
          key={zone.zoneId}
          positions={zone.cordinates as any}
          pathOptions={{ color: getColor(zone.zoneId), fillOpacity: 0.5, weight: 1 }}
        >
          <Tooltip sticky>
            <div>
              <strong>{zone.zoneName}</strong>
              <br />
              Severity: {zone.totalSeverity}
            </div>
          </Tooltip>
        </Polygon>
      ))}
    </>
  );
};

export default ZonePolygon;
