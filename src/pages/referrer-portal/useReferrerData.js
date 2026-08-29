import { useCallback, useEffect, useState } from 'react';

/**
 * Load referrer portal data with consistent loading / error / empty handling.
 *
 * Every screen in this portal previously rendered hardcoded constants, so it could
 * never be wrong. Now that the data is real, each screen has to say honestly which
 * of four states it is in — loading, failed, not linked to a profile, or loaded —
 * instead of showing a number that looks authoritative and isn't.
 *
 * @param {() => Promise<any>} fetcher  API call to run
 * @param {any[]} deps                  re-fetch when these change
 */
export default function useReferrerData(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetcher();
      setData(res);
    } catch (e) {
      setError(e?.message || 'Could not load your data. Please try again.');
      setData(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  return {
    data,
    loading,
    error,
    reload: load,
    // The backend returns linked:false when this login has no referrer profile.
    notLinked: Boolean(data) && data.linked === false,
  };
}
