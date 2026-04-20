declare module "../services/api" {
  export const loginUser: (username: string, password: string) => Promise<any>;
  export const setAuthToken: (token: string | null) => void;
  const api: any;
  export default api;
}
