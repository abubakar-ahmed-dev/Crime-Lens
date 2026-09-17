// src/components/locationValidation.ts
// Location helpers shared by form components. Kept out of LocationPicker.tsx
// so that file only exports its component (react-refresh/only-export-components).

export type LocationValue = {
  latitude: string;
  longitude: string;
};

export const isValidLocation = (value: LocationValue) => {
  const lat = Number(value.latitude);
  const lng = Number(value.longitude);
  return (
    value.latitude !== "" &&
    value.longitude !== "" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 23 &&
    lat <= 26 &&
    lng >= 65 &&
    lng <= 68
  );
};
