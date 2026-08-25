export const getJwtAuthHeaders = (headers: Record<string, string> = {}) => {
  const token = localStorage.getItem("token");

  if (!token) return headers;

  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  };
};
