import { useState } from 'react';

interface UseTMetricDataOptions<T> {
  endpoint: string;
  params?: Record<string, any>;
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
}

export function useTMetricData<T>({ endpoint, params, onSuccess, onError }: UseTMetricDataOptions<T>) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params || {}),
      });

      const result = await response.json();

      if (result.success) {
        setData(result);
        onSuccess?.(result);
      } else {
        const errorMessage = result.error || 'Error desconocido';
        setError(errorMessage);
        onError?.(errorMessage);
      }
    } catch (err) {
      const errorMessage = 'Error al conectarse con el servidor';
      setError(errorMessage);
      onError?.(errorMessage);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    data,
    error,
    fetchData,
    setData,
    setError,
  };
}
