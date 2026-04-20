// src/services/api.js
import axios from "axios";
import { API_BASE_URL } from "../config/constants"; // make sure this exists

// Example: API_BASE_URL = `${API_BASE_URL}`
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// helper to attach token for future requests
export const setAuthToken = (token) => {
  if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete api.defaults.headers.common["Authorization"];
};

export const loginUser = async (username, password) => {
  const res = await api.post("/auth/login", { username, password });
  return res.data; // { success, token, user, ... }
};

// add other API helpers as needed, example:
// export const fetchCrimes = () => api.get("/crimes");

export default api;
