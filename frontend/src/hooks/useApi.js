import { useState, useCallback } from "react";

/**
 * Generic hook for API calls with loading + error state.
 *
 * Usage:
 *   const { data, loading, error, execute } = useApi(api.getListings);
 *   useEffect(() => { execute(); }, []);
 */
export default function useApi(apiFn) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFn(...args);
      setData(res.data);
      return res.data;
    } catch (err) {
      const msg = err.response?.data?.error ||
                  err.response?.data?.detail ||
                  err.message ||
                  "Something went wrong.";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiFn]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset, setData };
}
