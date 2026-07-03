import { API_BASE_URL } from "../config/constants";

type ZoneLocationCheck = {
  inside: boolean;
  message?: string;
};

export const checkLocationInsideZone = async (
  zoneId: number | string,
  latitude: number | string,
  longitude: number | string
): Promise<ZoneLocationCheck> => {
  const response = await fetch(`${API_BASE_URL}/zones/${zoneId}/contains`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latitude, longitude }),
  });
  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.success) {
    return {
      inside: false,
      message: data?.message || "Unable to validate the selected zone location.",
    };
  }

  return {
    inside: Boolean(data.inside),
    message: data.message,
  };
};
