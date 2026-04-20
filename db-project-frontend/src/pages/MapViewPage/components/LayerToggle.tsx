// MapViewPage/components/LayerToggle.tsx
import React, { useContext } from "react";
import { MapContext } from "./MapContext";

const LayerToggle: React.FC = () => {
  const { highlightZoneLayer, setHighlightZoneLayer } = useContext(MapContext);

  return (
    <div className="absolute bottom-4 right-2 sm:bottom-5 sm:right-5 z-1000">
      <button
        className="px-3 py-1.5 sm:px-6 sm:py-2 font-semibold bg-linear-to-r from-[#145332] to-[#237E54] border-2 border-[#237E54] hover:from-[#145332] hover:to-[#145332] rounded-xl sm:rounded-2xl text-xs sm:text-md text-[#FFFFFF] shadow"
        onClick={() => setHighlightZoneLayer(prev => !prev)}
      >
        {highlightZoneLayer ? "Hide Zones" : "Highlight Zones"}
      </button>
    </div>
  );
};

export default LayerToggle;
