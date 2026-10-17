import { DaysScreen } from '@tbc/screens-native';
import { useRouter } from 'expo-router';

/** Days tab. */
export default function Days() {
  const router = useRouter();
  return (
    <DaysScreen
      onOpenDay={(date) => router.push({ pathname: '/day/[date]', params: { date } })}
      onCreateTrip={() => router.push('/trip/new')}
    />
  );
}
