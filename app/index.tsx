import { Redirect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

/** Entry route — sends users to the correct stack before tabs can mount. */
export default function Index() {
  const { session, isLoading, role, roles } = useAuth();

  if (isLoading) return null;

  if (!session) return <Redirect href="/(auth)/login" />;
  if (!role && roles.length === 0) return <Redirect href="/(auth)/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
