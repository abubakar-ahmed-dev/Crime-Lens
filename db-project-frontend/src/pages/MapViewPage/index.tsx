// MapViewPage/index.tsx
import { useEffect, useContext } from "react";
import MapContainer from "./components/MapContainer";
import CrimeMarkersClusters from "./components/CrimeMarkerCluster";
import { MapProvider, MapContext } from "./components/MapContext";
import SearchBar from "./components/SearchBar";
import { API_BASE_URL } from "../../config/constants";

import "leaflet/dist/leaflet.css";
import "../../assets/leaflet/MarkerCluster.Default.css";
import "../../assets/leaflet/MarkerCluster.css";

const MapContent = () => {
  const {
    filters,
    setFilters,
    radiusMode,
    setRadiusMode,
    radiusValue,
    radiusCenter,
    setRadiusValue,
    setRadiusCenter,
    crimeData,
    setCrimeData,
    searchVersion,
    setSearchVersion,
    highlightZoneLayer,
    setZoneSeverityData
  } = useContext(MapContext);

  // Parse URL on first load to hydrate context
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    setFilters({
      crimeType: params.get("crimeType") ?? "All",
      zoneId: params.get("zoneId") ?? "All",
      dateRange: {
        start: params.get("startDate") ?? "",
        end: params.get("endDate") ?? "",
      },
    });

    const mode = params.get("mode") ?? "basic";
    if (mode === "radius") {
      setRadiusMode(true);
      const lat = params.get("lat");
      const lng = params.get("lng");
      const r = params.get("radius");
      if (lat && lng) setRadiusCenter({ lat: Number(lat), lng: Number(lng) });
      if (r) setRadiusValue(Number(r));
    } else {
      setRadiusMode(false);
    }

    setSearchVersion(v => v + 1);
  }, []);

  // Fetch crimes whenever searchVersion changes
  useEffect(() => {
    let mounted = true;

    async function loadCrimes() {
      try {
        const params = new URLSearchParams();

        if (radiusMode && radiusCenter) {
          params.set("mode", "radius");
          params.set("lat", String(radiusCenter.lat));
          params.set("lng", String(radiusCenter.lng));
          params.set("radius", String(radiusValue));
        } else {
          params.set("mode", "basic");
          if (filters.crimeType && filters.crimeType !== "All") params.set("crimeType", filters.crimeType);
          if (filters.zoneId && filters.zoneId !== "All") params.set("zoneId", filters.zoneId);
          if (filters.dateRange.start) params.set("startDate", filters.dateRange.start);
          if (filters.dateRange.end) params.set("endDate", filters.dateRange.end);
        }

        const res = await fetch(`${API_BASE_URL}/crimes?${params.toString()}`);
        if (!res.ok) throw new Error("Network response was not ok");

        const data = await res.json();
        if (!mounted) return;
        setCrimeData(data);
      } catch (err) {
        console.error("Failed to fetch crimes:", err);
        setCrimeData([]); // no dummy data
      }
    }

    loadCrimes();
    return () => { mounted = false; };
  }, [searchVersion]);

  // Fetch zone severity
  useEffect(() => {
    if (!highlightZoneLayer) return;
    async function loadZoneSeverity() {
      try {
        const params = new URLSearchParams();
        if (filters.crimeType && filters.crimeType !== "All") params.set("crimeType", filters.crimeType);
        if (filters.zoneId && filters.zoneId !== "All") params.set("zoneId", filters.zoneId);
        if (filters.dateRange.start) params.set("startDate", filters.dateRange.start);
        if (filters.dateRange.end) params.set("endDate", filters.dateRange.end);

        const res = await fetch(`${API_BASE_URL}/zones/severity?${params.toString()}`);
        const data = await res.json();
        setZoneSeverityData(data);
      } catch (err) {
        console.error("Failed to fetch zone severity:", err);
        setZoneSeverityData([]);
      }
    }

    loadZoneSeverity();
  }, [highlightZoneLayer, filters, searchVersion]);

  return <CrimeMarkersClusters crimes={crimeData} />;
};

interface MapPageProps {
  embedded?: boolean;
}

const MapPage = ({ embedded = false }: MapPageProps) => {
  return (
    <MapProvider>
      <MapContainer embedded={embedded}>
        
        {!embedded && <SearchBar />}

        <MapContent />
      </MapContainer>
    </MapProvider>
  );
};

export default MapPage;
