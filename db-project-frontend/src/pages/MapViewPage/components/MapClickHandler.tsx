// components/MapClickHandler.tsx
import { useMapEvents } from "react-leaflet";
import { useContext } from "react";
import { MapContext } from "./MapContext";

const MapClickHandler = () => {
    const { radiusMode, setRadiusCenter, radiusValue } = useContext(MapContext);

    useMapEvents({
        click(e) {
            if (!radiusMode) return;

            // Prevent clicks coming from overlay controls: check if target is inside a known UI
            // (You already block propagation; this is extra safety.)
            // Set selected point
            const searchBar = (window as any).searchBarRef?.current;
            if (searchBar && searchBar.contains(e.originalEvent.target as Node)) {
                return;
            }
            const lat = e.latlng.lat;
            const lng = e.latlng.lng;
            setRadiusCenter({ lat, lng });

            // Update URL to reflect new center (no fetch)
            const params = new URLSearchParams(window.location.search);
            params.set("mode", "radius");
            params.set("lat", String(lat));
            params.set("lng", String(lng));
            params.set("radius", String(radiusValue ?? 500));

            const newUrl = `/map?${params.toString()}`;
            window.history.pushState({}, "", newUrl);
        },
    });

    return null;
};

export default MapClickHandler;
