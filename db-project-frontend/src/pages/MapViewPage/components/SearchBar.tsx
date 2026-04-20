// MapViewPage/components/SearchBar.tsx

import React, { useState, useContext, useEffect, useRef } from "react";
import { MapContext } from "./MapContext";
import { API_BASE_URL } from "../../../config/constants";

const SearchBar: React.FC = () => {
  const {
    filters,
    setFilters,
    radiusMode,
    setRadiusMode,
    radiusValue,
    setRadiusValue,
    radiusCenter,
    setRadiusCenter,
    setSearchVersion,
  } = useContext(MapContext);

  const [mode, setMode] = useState<"basic" | "radius">(
    () =>
      (new URLSearchParams(window.location.search).get("mode") as any) ??
      "basic"
  );

  const searchBarRef = useRef<HTMLDivElement>(null);

  const [crimeTypes, setCrimeTypes] = useState<string[]>(["All"]);
  const [zones, setZones] = useState<{ id: number | ""; name: string }[]>([
    { id: "", name: "All Zones" },
  ]);

  useEffect(() => {
    const fetchCrimeTypes = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/crimes/types`);
        const data = await res.json();
        setCrimeTypes(["All", ...data.map((ct: any) => ct.name)]);
      } catch (err) {
        console.error("Error fetching crime types:", err);
      }
    };

    const fetchZones = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/zones`);
        const data = await res.json();
        setZones([{ id: "", name: "All Zones" }, ...data]);
      } catch (err) {
        console.error("Error fetching zones:", err);
      }
    };

    fetchCrimeTypes();
    fetchZones();
  }, []);

  useEffect(() => {
    (window as any).searchBarRef = searchBarRef;
  }, []);

  const pushUrlFromContext = (extra?: { mode?: string }) => {
    const params = new URLSearchParams();

    if (
      (extra && extra.mode === "radius") ||
      (extra === undefined && radiusMode)
    ) {
      params.set("mode", "radius");
      if (radiusCenter) {
        params.set("lat", String(radiusCenter.lat));
        params.set("lng", String(radiusCenter.lng));
      }
      params.set("radius", String(radiusValue));
    } else {
      params.set("mode", "basic");
      if (filters.crimeType && filters.crimeType !== "All")
        params.set("crimeType", filters.crimeType);
      if (filters.zoneId && filters.zoneId !== "All Zones")
        params.set("zoneId", filters.zoneId);
      if (filters.dateRange.start)
        params.set("startDate", filters.dateRange.start);
      if (filters.dateRange.end)
        params.set("endDate", filters.dateRange.end);
    }

    const newUrl = `/map?${params.toString()}`;
    window.history.pushState({}, "", newUrl);
  };

  const handleSearch = () => {
    setRadiusMode(mode === "radius");
    pushUrlFromContext({ mode });
    setSearchVersion((v) => v + 1);
  };

  const handleReset = () => {
    setFilters({
      crimeType: "All",
      zoneId: "All",
      dateRange: { start: "", end: "" },
    });
    setRadiusMode(false);
    setRadiusValue(0);
    setRadiusCenter(null);
    setMode("basic");
    window.history.pushState({}, "", "/map");
    setSearchVersion((v) => v + 1);
  };

  const switchMode = (newMode: "basic" | "radius") => {
    setMode(newMode);
    if (newMode === "basic") {
      setRadiusMode(false);
      setRadiusCenter(null);
      setRadiusValue(0);
    } else {
      setRadiusMode(true);
      if (!radiusValue) setRadiusValue(500);
    }
  };

  return (
    <div
      ref={searchBarRef}
      className="absolute top-2 left-2 right-2 lg:left-1/2 lg:right-auto lg:transform lg:-translate-x-1/2 z-1000 max-w-full lg:max-w-[1100px] lg:w-[1100px]"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col lg:flex-row font-medium text-[14px] w-full bg-[rgba(255,255,255,0.95)] shadow-lg rounded-2xl lg:rounded-full overflow-hidden p-2 lg:p-2 gap-2 lg:gap-0">
        
        {/* Mode Selector */}
        <div className="flex-none relative w-full lg:w-40 shrink-0">
          <select
            className="appearance-none w-full text-[17px] text-center h-full px-4 py-2 
            bg-linear-to-r from-[#145332] to-[#237E54] text-white font-medium 
            rounded-full focus:outline-none border border-gray-300"
            value={mode}
            onChange={(e) => switchMode(e.target.value as "basic" | "radius")}
          >
            <option className="bg-[#145332] text-white" value="basic">
              Basic
            </option>
            <option className="bg-[#145332] text-white" value="radius">
              Radius
            </option>
          </select>

          <div className="pointer-events-none text-[22px] absolute inset-y-0 right-4 flex items-center text-white">
            ▾
          </div>
        </div>

        {/* Filters */}
        <div className="flex-1 flex flex-wrap items-center justify-center py-1 lg:mt-2 lg:mb-2 px-2 lg:px-4 gap-2 bg-[rgba(255,255,255,0)] min-w-0">
          
          {mode === "basic" ? (
            <>
              <span className="shrink-0">Show:</span>

              <select
                className="pl-2 mx-0.5 h-8 min-w-0 max-w-full rounded-full shadow-[0px_0px_5px_rgba(0,0,0,0.3)] border-none focus:outline-none pr-4 text-sm"
                value={filters.crimeType}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, crimeType: e.target.value }))
                }
              >
                {crimeTypes.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>

              <span className="shrink-0 hidden lg:inline">Crimes in:</span>
              <span className="shrink-0 lg:hidden">Zone:</span>

              <select
                className="pl-2 mx-0.5 h-8 min-w-0 max-w-[140px] lg:max-w-none rounded-full shadow-[0px_0px_5px_rgba(0,0,0,0.3)] border-none focus:outline-none pr-4 text-sm"
                value={filters.zoneId}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, zoneId: e.target.value }))
                }
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>

              <span className="shrink-0">From:</span>

              <input
                type="date"
                className="p-1.5 lg:p-2 mx-0.5 w-28 lg:w-32 h-8 rounded-full shadow-[0px_0px_5px_rgba(0,0,0,0.3)] border-none focus:outline-none text-sm min-w-0"
                value={filters.dateRange.start}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    dateRange: { ...prev.dateRange, start: e.target.value },
                  }))
                }
              />

              <span className="shrink-0">to</span>

              <input
                type="date"
                className="p-1.5 lg:p-2 w-28 lg:w-32 ml-0.5 h-8 rounded-full shadow-[0px_0px_5px_rgba(0,0,0,0.3)] border-none focus:outline-none text-sm min-w-0"
                value={filters.dateRange.end}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    dateRange: { ...prev.dateRange, end: e.target.value },
                  }))
                }
              />
            </>
          ) : (
            <>
              <span className="shrink-0 text-xs lg:text-sm">Within</span>

              <input
                type="number"
                className="p-1.5 lg:p-2 text-center h-8 rounded-full shadow-[0px_0px_5px_rgba(0,0,0,0.3)] border-none focus:outline-none w-16 lg:w-20 text-sm"
                value={radiusValue}
                onChange={(e) => setRadiusValue(Number(e.target.value))}
              />

              <span className="shrink-0 text-xs lg:text-sm">m of</span>

              <div className="flex gap-1 flex-wrap">
                <input
                  type="number"
                  placeholder="lat"
                  className="p-1.5 lg:p-2 h-8 rounded-full shadow-[0px_0px_5px_rgba(0,0,0,0.3)] border-none focus:outline-none w-20 lg:w-24 text-sm min-w-0"
                  value={radiusCenter?.lat ?? ""}
                  onChange={(e) =>
                    setRadiusCenter((prev) => ({
                      lat: Number(e.target.value),
                      lng: prev?.lng ?? 0,
                    }))
                  }
                />

                <span className="shrink-0">,</span>

                <input
                  type="number"
                  placeholder="lng"
                  className="p-1.5 lg:p-2 h-8 rounded-full shadow-[0px_0px_5px_rgba(0,0,0,0.3)] border-none focus:outline-none w-20 lg:w-24 text-sm min-w-0"
                  value={radiusCenter?.lng ?? ""}
                  onChange={(e) =>
                    setRadiusCenter((prev) => ({
                      lat: prev?.lat ?? 0,
                      lng: Number(e.target.value),
                    }))
                  }
                />
              </div>
            </>
          )}
        </div>

        {/* Buttons */}
        <div className="flex-none flex shrink-0">
          <button
            className="px-6 py-2 rounded-l-full text-[15px] font-medium text-white bg-linear-to-r from-[#145332] to-[#1B6842] border border-r-[#679981] hover:from-[#145332] hover:to-[#145332] cursor-pointer"
            onClick={handleSearch}
          >
            Search
          </button>
          <button
            className="px-6 py-2 rounded-r-full text-[15px] font-medium text-white bg-linear-to-r from-[#1B6842] to-[#237E54] border border-l-0 hover:from-[#145332] hover:to-[#145332] cursor-pointer"
            onClick={handleReset}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchBar;