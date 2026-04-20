// /components/RadiusVisual.tsx

import { Marker, Circle } from "react-leaflet";
import { useContext } from "react";
import { MapContext } from "./MapContext";
import L from "leaflet";
import Icon from "../../../assets/leaflet/marker-icon-2x-red.png";

const redIcon = new L.Icon({
  iconUrl: Icon,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  className: "radius-marker",
});

const RadiusVisual = () => {
  const { radiusCenter, radiusValue } = useContext(MapContext);

  if (!radiusCenter) return null;

  return (
    <>
      <Marker position={[radiusCenter.lat, radiusCenter.lng]} icon={redIcon} />
      <Circle
        center={[radiusCenter.lat, radiusCenter.lng]}
        radius={radiusValue}
        pathOptions={{ color: "red", fillColor: "red", fillOpacity: 0.2 }}
      />
    </>
  );
};

export default RadiusVisual;
