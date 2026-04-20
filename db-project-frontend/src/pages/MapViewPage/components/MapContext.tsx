// // MapViewPage/components/MapContext.tsx
import React, { createContext, useState } from "react";
import type { Crime } from "./types";
import type { LatLngExpression } from "leaflet";

export interface MapFilters {
  crimeType: string;
  zoneId: string;
  dateRange: {
    start: string;
    end: string;
  };
}

export interface ZoneSeverity {
  zoneId: number;
  zoneName: string;
  totalSeverity: number; // sum of crimes in that zone
  cordinates: LatLngExpression[];
}

interface MapContextType {
  // Filters
  filters: MapFilters;
  setFilters: React.Dispatch<React.SetStateAction<MapFilters>>;

  // Radius Search Controls
  radiusMode: boolean;
  setRadiusMode: React.Dispatch<React.SetStateAction<boolean>>;

  radiusValue: number;
  setRadiusValue: React.Dispatch<React.SetStateAction<number>>;

  // Radius center (click point)
  radiusCenter: { lat: number; lng: number } | null;
  setRadiusCenter: React.Dispatch<
    React.SetStateAction<{ lat: number; lng: number } | null>
  >;

  // Crime Data
  crimeData: Crime[];
  setCrimeData: React.Dispatch<React.SetStateAction<Crime[]>>;

  // Search trigger version - increment to run a new fetch
  searchVersion: number;
  setSearchVersion: React.Dispatch<React.SetStateAction<number>>;

  highlightZoneLayer: boolean;
  setHighlightZoneLayer: React.Dispatch<React.SetStateAction<boolean>>;

  zoneSeverityData: ZoneSeverity[];
  setZoneSeverityData: React.Dispatch<React.SetStateAction<ZoneSeverity[]>>;
}

export const MapContext = createContext<MapContextType>({
  // Default values
  filters: {
    crimeType: "All",
    zoneId: "All",
    dateRange: { start: "", end: "" },
  },
  setFilters: () => { },

  radiusMode: false,
  setRadiusMode: () => { },

  radiusValue: 500,
  setRadiusValue: () => { },

  radiusCenter: null,
  setRadiusCenter: () => { },

  crimeData: [],
  setCrimeData: () => { },

  searchVersion: 0,
  setSearchVersion: () => { },

    // Highlight Zone Layer
  highlightZoneLayer: false,
  setHighlightZoneLayer: () => {},

  // Zone Severity Data
  zoneSeverityData: [],
  setZoneSeverityData: () => {},
});

export const MapProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [filters, setFilters] = useState<MapFilters>({
    crimeType: "All",
    zoneId: "All",
    dateRange: { start: "", end: "" },
  });

  const [radiusMode, setRadiusMode] = useState<boolean>(false);
  const [radiusValue, setRadiusValue] = useState<number>(500);

  const [highlightZoneLayer, setHighlightZoneLayer] = useState(false);
  const [zoneSeverityData, setZoneSeverityData] = useState<ZoneSeverity[]>([]);

  const [radiusCenter, setRadiusCenter] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const [crimeData, setCrimeData] = useState<Crime[]>([]);

  const [searchVersion, setSearchVersion] = useState<number>(0);

  return (
    <MapContext.Provider
      value={{
        filters,
        setFilters,
        radiusMode,
        setRadiusMode,
        radiusValue,
        setRadiusValue,
        radiusCenter,
        setRadiusCenter,
        crimeData,
        setCrimeData,
        searchVersion,
        setSearchVersion,
        highlightZoneLayer,
        setHighlightZoneLayer,
        zoneSeverityData,
        setZoneSeverityData,
      }}
    >
      {children}
    </MapContext.Provider>
  );
};

