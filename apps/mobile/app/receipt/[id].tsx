import { ReceiptReviewScreen } from '@tbc/screens-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

/** Review / edit one scanned bill (push). */
export default function Receipt() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return <ReceiptReviewScreen receiptId={id} onDone={() => router.back()} />;
}
