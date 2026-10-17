/**
 * ScanScreen — scan a batch of paper bills, one after another.
 *
 * The evening ritual: take photos (or pick several from the library) and each bill is read on the device,
 * checked, and either filed on the day printed on it or put in the inbox with the question that needs
 * answering. Nothing is sent anywhere; AI is only offered later, per bill, on the review screen.
 * @module screens/ScanScreen
 */
import {
  type Minor,
  RECEIPT_SCHEMA_VERSION,
  formatDayLabel,
  formatMoney,
  getTagMeta,
} from '@tbc/core';
import { useActiveTrip, useBudget, useBudgetStore, useToday } from '@tbc/core/react';
import {
  Alert,
  Button,
  EmptyState,
  Icon,
  ScanResultRow,
  type ScanResultState,
  Screen,
  ScreenHeader,
  Separator,
  Text,
} from '@tbc/ui-native';
import { Camera, Image as ImageIcon, Luggage, PencilLine } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';
import { scanPhoto } from '../lib/scan';
import { useScanServices } from '../lib/services';

/** Props for {@link ScanScreen}. */
export interface ScanScreenProps {
  /** Open one bill (to answer its question, or to look at what was read). */
  onOpenReceipt: (id: string) => void;
  /** Leave the screen. */
  onDone: () => void;
  onCreateTrip: () => void;
}

interface Row {
  key: number;
  state: ScanResultState;
  title: string;
  detail?: string;
  amount?: Minor | null;
  currency?: string;
  receiptId?: string;
}

/**
 * Scan screen.
 * @example
 * <ScanScreen onOpenReceipt={(id) => router.push(`/receipt/${id}`)} onDone={() => router.back()} onCreateTrip={…} />
 */
export function ScanScreen({ onOpenReceipt, onDone, onCreateTrip }: ScanScreenProps) {
  const services = useScanServices();
  const store = useBudgetStore();
  const trip = useActiveTrip();
  const today = useToday();
  const [ocrSupported, setOcrSupported] = React.useState<boolean | null>(null);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const receipts = useBudget((s) => s.receipts);
  const spends = useBudget((s) => s.spends);
  const counter = React.useRef(0);
  const mounted = React.useRef(true);

  React.useEffect(() => {
    mounted.current = true;
    void services.ocr.isSupported().then(
      (ok) => mounted.current && setOcrSupported(ok),
      () => mounted.current && setOcrSupported(false),
    );
    return () => {
      mounted.current = false;
    };
  }, [services]);

  const patchRow = (key: number, patch: Partial<Row>) =>
    mounted.current && setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  /** Scan photos one by one, so a bill filed earlier is known when the next one is checked for duplicates. */
  const run = async (uris: string[]) => {
    if (!trip || uris.length === 0) return;
    setBusy(true);
    setNotice(null);
    for (const uri of uris) {
      counter.current += 1;
      const key = counter.current;
      setRows((rs) => [...rs, { key, state: 'reading', title: `Bill ${key}` }]);
      try {
        const r = await scanPhoto(uri, {
          services,
          store,
          today,
          ocrSupported: ocrSupported === true,
        });
        patchRow(key, {
          state: r.filed ? 'filed' : 'attention',
          title: r.title ?? `Bill ${key}`,
          detail: r.detail,
          amount: r.filed ? r.amount : (r.receipt.data.total ?? null),
          currency: r.receipt.data.currency ?? trip.currency,
          receiptId: r.receipt.id,
        });
      } catch {
        patchRow(key, { state: 'failed', detail: 'The photo could not be saved' });
      }
    }
    if (mounted.current) setBusy(false);
  };

  const camera = async () => {
    const uri = await services.picker.capture();
    if (uri) await run([uri]);
    else setNotice('No photo taken.');
  };
  const library = async () => {
    const uris = await services.picker.pick();
    if (uris.length > 0) await run(uris);
    else setNotice('No photos chosen.');
  };
  const byHand = () => {
    if (!trip) return;
    const receipt = store.getState().actions.saveReceipt({
      data: { schemaVersion: RECEIPT_SCHEMA_VERSION, source: 'manual', items: [], confidence: 0 },
      rawText: '',
      tripId: trip.id,
      date: null,
      tag: 'other',
    });
    onOpenReceipt(receipt.id);
  };

  if (!trip) {
    return (
      <Screen testID="screen-scan">
        <ScreenHeader title="Scan bills" />
        <EmptyState
          icon={Luggage}
          title="Create a trip first"
          description="Bills are counted against a trip, on the day printed on them."
          action={
            <Button onPress={onCreateTrip} testID="scan-create-trip">
              <Text>Create a trip</Text>
            </Button>
          }
        />
      </Screen>
    );
  }

  // The list follows the store: a bill answered on the review screen turns from "Needs you" to "Filed",
  // and a deleted one disappears.
  const view = rows.flatMap((r): Row[] => {
    if (!r.receiptId) return [r];
    const live = receipts.find((x) => x.id === r.receiptId);
    if (!live) return [];
    if (r.state !== 'attention' || live.status === 'needs-attention') return [r];
    const counted = spends.filter((s) => s.receiptId === live.id).reduce((n, s) => n + s.amount, 0);
    return [
      {
        ...r,
        state: 'filed',
        detail:
          live.status === 'archived'
            ? 'Kept as a copy'
            : `${formatDayLabel(live.date ?? today)} · ${getTagMeta(live.tag).label}`,
        amount: live.status === 'budgeted' ? counted : (r.amount ?? null),
      },
    ];
  });
  const filed = view.filter((r) => r.state === 'filed');
  const waiting = view.filter((r) => r.state === 'attention' || r.state === 'failed');
  const added = filed.reduce((n, r) => n + (r.amount ?? 0), 0);
  const finished = view.length > 0 && !busy;

  return (
    <Screen testID="screen-scan" edges={['bottom']}>
      <ScreenHeader title="Scan bills" subtitle={`${trip.name} · read on this device`} />

      {ocrSupported === false ? (
        <Alert
          variant="info"
          testID="scan-no-ocr"
          title="Reading text needs the installed app"
          description="This build cannot read text on the device (Expo Go and the web cannot). Photos are still saved: fill them in by hand, or let AI read them if you set it up."
        />
      ) : null}

      <View className="gap-3">
        <Button onPress={camera} disabled={busy} testID="scan-camera">
          <Icon as={Camera} size={20} className="text-primary-foreground" />
          <Text>{rows.length > 0 ? 'Scan another bill' : 'Take a photo of a bill'}</Text>
        </Button>
        <Button variant="outline" onPress={library} disabled={busy} testID="scan-library">
          <Icon as={ImageIcon} size={20} />
          <Text>Choose photos</Text>
        </Button>
        <Button variant="ghost" onPress={byHand} disabled={busy} testID="scan-manual">
          <Icon as={PencilLine} size={20} />
          <Text>Type a bill in</Text>
        </Button>
      </View>

      {notice ? (
        <Text variant="muted" testID="scan-notice">
          {notice}
        </Text>
      ) : null}

      {view.length > 0 ? (
        <View className="rounded-xl border border-border bg-card px-3" testID="scan-results">
          {view.map((r, i) => (
            <React.Fragment key={r.key}>
              {i > 0 ? <Separator /> : null}
              <ScanResultRow
                testID={`scan-result-${r.key}`}
                state={r.state}
                title={r.title}
                {...(r.detail ? { detail: r.detail } : {})}
                {...(r.amount !== undefined ? { amount: r.amount } : {})}
                {...(r.currency ? { currency: r.currency } : {})}
                {...(r.receiptId ? { onPress: () => onOpenReceipt(r.receiptId!) } : {})}
              />
            </React.Fragment>
          ))}
        </View>
      ) : null}

      {finished ? (
        <Alert
          testID="scan-summary"
          variant={waiting.length === 0 ? 'success' : 'warning'}
          title={
            waiting.length === 0
              ? `All ${filed.length} filed · ${formatMoney(added, trip.currency)} added`
              : `${filed.length} filed${filed.length > 0 ? ` · ${formatMoney(added, trip.currency)} added` : ''} · ${waiting.length} need${waiting.length === 1 ? 's' : ''} you`
          }
          description={
            waiting.length === 0
              ? 'They are on the Bills timeline, under the day printed on each.'
              : 'Open the ones marked “Needs you” to answer what looked odd. They are saved in your inbox either way.'
          }
        />
      ) : null}

      {rows.length > 0 ? (
        <Button
          variant={finished ? 'default' : 'secondary'}
          onPress={onDone}
          disabled={busy}
          testID="scan-done"
        >
          <Text>Done</Text>
        </Button>
      ) : null}
    </Screen>
  );
}
