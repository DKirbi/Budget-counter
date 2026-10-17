import { ScanScreen } from '@tbc/screens-native';
import { useRouter } from 'expo-router';

/** Scan a batch of bills (push). Opening a bill from the list pushes the review screen on top. */
export default function Scan() {
  const router = useRouter();
  return (
    <ScanScreen
      onOpenReceipt={(id) => router.push({ pathname: '/receipt/[id]', params: { id } })}
      onDone={() => router.back()}
      onCreateTrip={() => router.push('/trip/new')}
    />
  );
}
