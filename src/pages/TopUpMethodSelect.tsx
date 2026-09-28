import { Navigate, useSearchParams } from 'react-router';

/** Old links continue into the shared invoice-verifying inline top-up flow. */
export default function TopUpMethodSelect() {
  const [searchParams] = useSearchParams();
  return <Navigate to={`/balance${searchParams.size ? `?${searchParams}` : ''}`} replace />;
}
