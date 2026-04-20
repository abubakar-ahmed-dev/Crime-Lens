// MapViewPage/components/MapContainer.tsx
import React from "react";
import {
  MapContainer as LeafletMap,
  TileLayer,
  ZoomControl,
} from "react-leaflet";
import { useNavigate } from "react-router-dom";
import MapClickHandler from "./MapClickHandler";
import RadiusVisual from "./RadiusVisual";
import ZonePolygon from "./ZonePolygons";
import LayerToggle from "./LayerToggle";

interface MapContainerProps {
  children: React.ReactNode;
  embedded?: boolean;
}

const MapContainer: React.FC<MapContainerProps> = ({
  children,
  embedded = false,
}: MapContainerProps) => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate("/dashboard");
  };

  return (
    <div className={embedded ? "w-full h-full" : "w-screen h-screen"}>
      {!embedded && (
        <button
          onClick={handleBack}
          className="
  absolute 
  bottom-4 left-4          /* default (sm & md) → bottom-left */
  lg:top-7 lg:left-4       /* lg+ → top-left */
  lg:bottom-auto           /* reset bottom */
  z-1000 
  bg-white hover:bg-gray-100 
  text-[#237E54] font-semibold 
  py-1.5 px-3 sm:py-2 sm:px-4 
  rounded-full shadow-sm 
  transition-colors duration-200 
  flex items-center gap-1.5 sm:gap-2 
  cursor-pointer text-sm sm:text-base
"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      )}
      <LeafletMap
        center={[24.920017, 67.061234]}
        zoom={12}
        scrollWheelZoom={true}
        zoomControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        <ZoomControl position="bottomright" />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <MapClickHandler /> {/* listens for clicks */}
        <RadiusVisual /> {/* shows marker + circle */}
        <ZonePolygon />
        <LayerToggle />
        {/* Render markers, clusters, layers */}
        {children}
      </LeafletMap>
      <style>{`
        .leaflet-control-zoom {
          margin-bottom: 70px !important;
        }
      `}</style>
    </div>
  );
};

export default MapContainer;
