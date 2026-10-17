import { CreateTripScreen } from '@tbc/screens-native';
import { useRouter } from 'expo-router';

/** New trip (modal). After creating, return to the Today tab. */
export default function NewTrip() {
  const router = useRouter();
  return <CreateTripScreen onDone={() => router.dismissTo('/')} />;
}
