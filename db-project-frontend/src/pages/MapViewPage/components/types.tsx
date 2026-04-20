// MapViewPage/components/types.ts

export interface Crime {
  id: number;
  crimeTypeId: number;
  crimeTypeName: string; // from backend
  status: string;
  incidentDate: string;  // from backend
  latitude: number;      // from backend
  longitude: number;     // from backend

  // Optional frontend-only fields if you want
  title?: string;
  description?: string;
  zoneName?: string;
  address?: string;
}


export type Zone = {
  zoneId: number;
  zoneName: string;
  severity: number;
  color: string;
  polygon: GeoJSON.Polygon | GeoJSON.MultiPolygon;
};
