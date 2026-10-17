/**
 * ReceiptReviewScreen — look at one scanned bill, answer what looked odd, count it.
 *
 * This is where the "odd bill" rules become questions: a bill from a different day, outside the trip,
 * a possible duplicate, a date that reads two ways, a total that could not be read… Each question has
 * one-tap answers. When the problem is about *reading* the bill, the user chooses between finishing it
 * with AI (after a per-use confirmation) or filling in the missing parts by hand — staying offline.
 * @module screens/ReceiptReviewScreen
 */
import {
  AI_KEY_NAME,
  AI_PROVIDERS,
  AiError,
  type AnalyzeContext,
  type IssueCode,
  type Minor,
  type Receipt,
  type ReceiptData,
  type ReceiptDecisions,
  type SpendTag,
  aiCouldHelp,
  categorize,
  chosenTrip,
  diffDays,
  addDays,
  formatDayLabel,
  formatMoney,
  getTagMeta,
  merchantKey,
  mergeAiWithOcr,
  offerableSplit,
  parseAmount,
  planBudgeting,
  readReceiptWithAi,
  toInputString,
} from '@tbc/core';
import {
  useActiveTrip,
  useAiQuota,
  useBudget,
  useBudgetActions,
  useReceipt,
  useReceiptSpends,
  useToday,
} from '@tbc/core/react';
import {
  Alert,
  AmountInput,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Icon,
  Input,
  ReceiptIssueCard,
  ReceiptPhoto,
  Screen,
  ScreenHeader,
  Stepper,
  Switch,
  TagPicker,
  Text,
} from '@tbc/ui-native';
import { ReceiptText, Sparkles, Trash2 } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';
import { useScanServices } from '../lib/services';

/** Props for {@link ReceiptReviewScreen}. */
export interface ReceiptReviewScreenProps {
  receiptId: string;
  /** Called after counting, saving, keeping as a copy or deleting. */
  onDone: () => void;
}

/**
 * Review / edit one bill.
 * @example
 * <ReceiptReviewScreen receiptId={id} onDone={() => router.back()} />
 */
export function ReceiptReviewScreen({ receiptId, onDone }: ReceiptReviewScreenProps) {
  const receipt = useReceipt(receiptId);
  if (!receipt) {
    return (
      <Screen testID="screen-receipt">
        <ScreenHeader title="Bill" />
        <EmptyState
          icon={ReceiptText}
          title="Bill not found"
          description="It may have been deleted."
          testID="receipt-not-found"
        />
      </Screen>
    );
  }
  return <ReviewForm key={receipt.id} receipt={receipt} onDone={onDone} />;
}

/** The bill's JSON with the user's typed-in shop and total applied. */
function withEdits(data: ReceiptData, merchant: string, total: Minor | null): ReceiptData {
  const { merchant: _shop, total: _total, ...rest } = data;
  const shop = merchant.trim();
  return {
    ...rest,
    ...(shop ? { merchant: shop } : {}),
    ...(total !== null && total > 0 ? { total } : {}),
  };
}

/** Decisions to start from: what was already settled when the bill was saved. */
function initialDecisions(receipt: Receipt): ReceiptDecisions {
  const settled =
    receipt.date !== null &&
    (receipt.status !== 'needs-attention' || receipt.date !== receipt.data.date);
  return { acknowledged: receipt.acknowledged, ...(settled ? { date: receipt.date } : {}) };
}

function ReviewForm({ receipt, onDone }: { receipt: Receipt; onDone: () => void }) {
  const services = useScanServices();
  const actions = useBudgetActions();
  const today = useToday();
  const activeTrip = useActiveTrip();
  const trips = useBudget((s) => s.trips);
  const receipts = useBudget((s) => s.receipts);
  const merchantRules = useBudget((s) => s.merchantRules);
  const aiSettings = useBudget((s) => s.settings.ai);
  const quota = useAiQuota();
  const spends = useReceiptSpends(receipt.id);

  const baseTrip =
    (receipt.tripId ? trips.find((t) => t.id === receipt.tripId) : undefined) ?? activeTrip;
  const billCurrency = receipt.data.currency ?? baseTrip?.currency ?? 'EUR';

  const [merchant, setMerchant] = React.useState(receipt.data.merchant ?? '');
  const [totalText, setTotalText] = React.useState(
    receipt.data.total ? toInputString(receipt.data.total, billCurrency) : '',
  );
  const [totalTouched, setTotalTouched] = React.useState(false);
  const [foreignText, setForeignText] = React.useState('');
  const [tag, setTag] = React.useState<SpendTag>(receipt.tag);
  const [decisions, setDecisions] = React.useState<ReceiptDecisions>(() =>
    initialDecisions(receipt),
  );
  const [splitOn, setSplitOn] = React.useState(false);
  const [remember, setRemember] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [aiAsk, setAiAsk] = React.useState(false);
  const [aiBusy, setAiBusy] = React.useState(false);
  const [aiError, setAiError] = React.useState<AiError | null>(null);
  const [aiDone, setAiDone] = React.useState(false);
  const [byHand, setByHand] = React.useState(false);

  // ── what the checks say about the bill as it looks right now ───────────────────────────────
  const total = parseAmount(totalText, billCurrency);
  const edited = withEdits(receipt.data, merchant, total);
  const ctx: AnalyzeContext = { today, trip: baseTrip, trips, receipts, selfId: receipt.id };
  const trip = chosenTrip(ctx, decisions);
  const foreignAmount = trip ? parseAmount(foreignText, trip.currency) : null;
  const effective: ReceiptDecisions = {
    ...decisions,
    ...(totalTouched && total !== null && total > 0 ? { total } : {}),
    ...(foreignAmount !== null && foreignAmount > 0 ? { amountInTripCurrency: foreignAmount } : {}),
  };
  const plan = planBudgeting(edited, ctx, effective);
  const category = categorize(edited, merchantRules);
  const split = offerableSplit(category, plan.amount);
  const parts = splitOn && split ? split : plan.amount ? [{ amount: plan.amount, tag }] : [];
  const needsForeign = !!trip && !!edited.currency && edited.currency !== trip.currency;
  const shopKey = merchantKey(edited.merchant);
  const counted = spends.reduce((n, s) => n + s.amount, 0);

  const acknowledged = effective.acknowledged ?? [];
  const date = plan.date;
  const dateInTrip = !!trip && !!date && date >= trip.startDate && date <= trip.endDate;

  // ── actions ────────────────────────────────────────────────────────────────────────────────
  const saveEdits = () =>
    actions.updateReceipt(receipt.id, {
      replaceData: edited,
      tag,
      date: plan.date,
      acknowledged,
    });

  const guard = (fn: () => void) => () => {
    try {
      setError(null);
      fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  };

  const count = guard(() => {
    if (!plan.canBudget || !plan.tripId || !plan.date || parts.length === 0) return;
    saveEdits();
    actions.budgetReceipt(receipt.id, {
      tripId: plan.tripId,
      date: plan.date,
      parts,
      acknowledged,
    });
    if (remember && shopKey && !splitOn) actions.setMerchantRule(shopKey, tag);
    onDone();
  });
  const saveForLater = guard(() => {
    saveEdits();
    onDone();
  });
  const keepCopy = guard(() => {
    saveEdits();
    actions.unbudgetReceipt(receipt.id, 'archive');
    onDone();
  });
  const remove = () => {
    const removed = actions.deleteReceipt(receipt.id);
    setConfirmDelete(false);
    onDone();
    if (removed.imageUri) void services.images.remove(removed.imageUri).catch(() => undefined);
  };

  const acknowledge = (code: IssueCode) =>
    setDecisions((d) => ({ ...d, acknowledged: [...new Set([...(d.acknowledged ?? []), code])] }));

  // ── AI: only when the user asks, and only after a per-use confirmation ───────────────────────
  const provider = AI_PROVIDERS.find((p) => p.id === aiSettings.provider);
  const aiOn = aiSettings.provider !== 'none';
  const showAiCard =
    !!receipt.imageUri &&
    receipt.data.source !== 'ai' &&
    !byHand &&
    !aiDone &&
    aiCouldHelp(plan.issues);

  const runAi = async () => {
    setAiAsk(false);
    setAiBusy(true);
    setAiError(null);
    try {
      if (quota.remaining <= 0)
        throw new AiError(
          'LIMIT_REACHED',
          'You reached the daily AI limit you set. Change it in Settings or fill in the bill yourself.',
        );
      const apiKey = await services.secrets.get(AI_KEY_NAME);
      const image = await services.images.encodeForAi(receipt.imageUri!);
      const read = await readReceiptWithAi({
        settings: aiSettings,
        apiKey,
        image,
        today,
        ...(receipt.rawText ? { ocrText: receipt.rawText } : {}),
        ...(baseTrip ? { tripCurrency: baseTrip.currency } : {}),
        ...(services.fetch ? { fetch: services.fetch } : {}),
      });
      const merged = mergeAiWithOcr(read, receipt.data);
      actions.recordAiUse(today);
      actions.updateReceipt(receipt.id, { replaceData: merged });
      setMerchant(merged.merchant ?? '');
      setTotalText(
        merged.total ? toInputString(merged.total, merged.currency ?? billCurrency) : '',
      );
      setTotalTouched(false);
      setDecisions({ acknowledged: [] });
      setAiDone(true);
    } catch (e) {
      setAiError(
        e instanceof AiError
          ? e
          : new AiError('HTTP', 'AI could not read this bill. Try again or fill it in yourself.'),
      );
    } finally {
      setAiBusy(false);
    }
  };

  // ── view ───────────────────────────────────────────────────────────────────────────────────
  const statusAlert =
    receipt.status === 'budgeted'
      ? ({
          variant: 'success',
          title: `Counted · ${formatMoney(counted, trip?.currency ?? billCurrency)}${receipt.date ? ` on ${formatDayLabel(receipt.date)}` : ''}`,
        } as const)
      : receipt.status === 'archived'
        ? ({ variant: 'info', title: 'Kept as a digital copy — not counted' } as const)
        : ({
            variant: 'warning',
            title: 'Not counted yet',
            description: plan.canBudget
              ? 'Everything checks out. Count it when you are ready.'
              : 'Answer what is marked below, then count it.',
          } as const);

  const unresolved = plan.issues.filter((i) => !i.resolved && i.severity === 'decision').length;
  const label = (() => {
    if (receipt.status === 'budgeted') return 'Save changes';
    return plan.amount && trip ? `Count ${formatMoney(plan.amount, trip.currency)}` : 'Count it';
  })();

  return (
    <Screen edges={['bottom']} testID="screen-receipt">
      <ScreenHeader
        title={edited.merchant ?? 'Bill'}
        subtitle={`${receipt.data.source === 'ai' ? 'Read by AI' : receipt.data.source === 'manual' ? 'Typed in' : 'Read on this device'}${edited.time ? ` · ${edited.time}` : ''}`}
      />

      <Alert testID="review-status" {...statusAlert} />

      {error ? (
        <Alert
          variant="destructive"
          title="Could not save"
          description={error}
          testID="review-error"
        />
      ) : null}

      {plan.issues.length > 0 ? (
        <View className="gap-3" testID="review-issues">
          {plan.issues.map((issue) => (
            <ReceiptIssueCard
              key={issue.code}
              issue={issue}
              selectedDate={decisions.date ?? null}
              onChooseDate={(d) => setDecisions((x) => ({ ...x, date: d }))}
              onChooseTrip={(tripId) => setDecisions((x) => ({ ...x, tripId }))}
              onAcknowledge={acknowledge}
              onKeepAsCopy={keepCopy}
            />
          ))}
        </View>
      ) : null}

      {showAiCard ? (
        <View className="gap-3 rounded-xl border border-border bg-card p-3" testID="review-ai-card">
          <View className="flex-row items-start gap-3">
            <Icon as={Sparkles} size={20} className="mt-0.5 text-primary" />
            <View className="flex-1 gap-1">
              <Text variant="small" className="leading-5">
                Some parts could not be read
              </Text>
              <Text variant="muted">
                {aiOn
                  ? `Let AI look at the photo, or fill in the missing parts yourself and stay offline. ${quota.remaining} of ${quota.limit} AI reads left today.`
                  : 'Fill in the missing parts below. You can also turn on AI reading in Settings → Bills & AI.'}
              </Text>
            </View>
          </View>
          {aiError ? (
            <Alert
              variant="destructive"
              testID="review-ai-error"
              title={AI_ERROR_TITLE[aiError.code]}
              description={`${aiError.message}${aiError.retryAfterSec ? ` Try again in about ${Math.ceil(aiError.retryAfterSec / 60)} min.` : ''}`}
            />
          ) : null}
          <View className="flex-row flex-wrap gap-2">
            {aiOn ? (
              <Button
                size="sm"
                onPress={() => setAiAsk(true)}
                disabled={aiBusy || quota.remaining <= 0}
                testID="review-ai"
              >
                <Icon as={Sparkles} size={16} className="text-primary-foreground" />
                <Text>{aiBusy ? 'Reading…' : 'Finish with AI'}</Text>
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onPress={() => setByHand(true)}
              testID="review-by-hand"
            >
              <Text>I'll fill it in</Text>
            </Button>
          </View>
        </View>
      ) : null}
      {aiDone ? (
        <Alert
          variant="success"
          testID="review-ai-done"
          title="AI read this bill"
          description="Check the shop, total and day below before counting it."
        />
      ) : null}

      <View className="self-center" style={{ width: 240 }}>
        <ReceiptPhoto
          {...(receipt.imageUri ? { uri: receipt.imageUri } : {})}
          {...(edited.merchant ? { label: edited.merchant } : {})}
        />
      </View>

      <Field label="Shop">
        <Input
          accessibilityLabel="Shop"
          placeholder="Where was it?"
          value={merchant}
          onChangeText={setMerchant}
          testID="review-merchant"
        />
      </Field>

      <Field
        label={`Total on the bill${edited.currency && trip && edited.currency !== trip.currency ? ` (${edited.currency})` : ''}`}
      >
        <AmountInput
          accessibilityLabel="Total on the bill"
          value={totalText}
          onChangeText={(t) => {
            setTotalText(t);
            setTotalTouched(true);
          }}
          currency={billCurrency}
          testID="review-total"
        />
      </Field>

      {needsForeign && trip ? (
        <Field
          label={`What you paid in ${trip.currency}`}
          description="From your card statement or the exchange rate you used."
        >
          <AmountInput
            accessibilityLabel={`Amount in ${trip.currency}`}
            value={foreignText}
            onChangeText={setForeignText}
            currency={trip.currency}
            testID="review-foreign"
          />
        </Field>
      ) : null}

      {trip && dateInTrip && date ? (
        <Field label="Day">
          <Stepper
            label="day"
            testID="review-day"
            min={0}
            max={diffDays(trip.startDate, trip.endDate)}
            value={diffDays(trip.startDate, date)}
            onValueChange={(i) => setDecisions((d) => ({ ...d, date: addDays(trip.startDate, i) }))}
            format={() => `${formatDayLabel(date)}${date === today ? ' · today' : ''}`}
          />
        </Field>
      ) : null}

      <Field
        label="Category"
        {...(category.source !== 'default' && tag === category.tag
          ? {
              description:
                category.source === 'user-rule'
                  ? 'Remembered for this shop.'
                  : 'Suggested from the shop name and items.',
            }
          : {})}
      >
        <TagPicker value={tag} onValueChange={setTag} />
      </Field>

      {split ? (
        <View className="flex-row items-center justify-between rounded-xl border border-border bg-card p-3">
          <View className="flex-1 pr-3">
            <Text variant="small" className="leading-5">
              Split by category
            </Text>
            <Text variant="caption" testID="review-split-hint">
              {split
                .map(
                  (p) =>
                    `${getTagMeta(p.tag).label} ${formatMoney(p.amount, trip?.currency ?? billCurrency)}`,
                )
                .join(' · ')}
            </Text>
          </View>
          <Switch
            checked={splitOn}
            onCheckedChange={setSplitOn}
            accessibilityLabel="Split by category"
            testID="review-split"
          />
        </View>
      ) : null}

      {shopKey && !splitOn && merchantRules[shopKey] !== tag ? (
        <View className="flex-row items-center justify-between rounded-xl border border-border bg-card p-3">
          <View className="flex-1 pr-3">
            <Text variant="small" className="leading-5">
              Always file {edited.merchant} under {getTagMeta(tag).label}
            </Text>
            <Text variant="caption">Applies to future bills from this shop.</Text>
          </View>
          <Switch
            checked={remember}
            onCheckedChange={setRemember}
            accessibilityLabel="Remember this category for this shop"
            testID="review-remember"
          />
        </View>
      ) : null}

      <View className="gap-3">
        <Button onPress={count} disabled={!plan.canBudget} testID="review-count">
          <Text>{label}</Text>
        </Button>
        {!plan.canBudget ? (
          <Text variant="caption" testID="review-blocked-hint">
            {unresolved > 0
              ? `${unresolved} ${unresolved === 1 ? 'thing needs' : 'things need'} an answer before this can be counted.`
              : 'A trip, a day and a total are needed before this can be counted.'}
          </Text>
        ) : null}
        {receipt.status !== 'budgeted' ? (
          <Button variant="outline" onPress={saveForLater} testID="review-save">
            <Text>Save for later</Text>
          </Button>
        ) : null}
        {receipt.status !== 'archived' ? (
          <Button variant="outline" onPress={keepCopy} testID="review-archive">
            <Text>
              {receipt.status === 'budgeted'
                ? 'Stop counting, keep a copy'
                : "Keep a copy, don't count"}
            </Text>
          </Button>
        ) : null}
        <Button variant="ghost" onPress={() => setConfirmDelete(true)} testID="review-delete">
          <Icon as={Trash2} size={20} className="text-destructive" />
          <Text className="text-destructive">Delete this bill</Text>
        </Button>
      </View>

      <ConfirmDialog
        testID="confirm-ai"
        open={aiAsk}
        onOpenChange={setAiAsk}
        title={`Send this photo to ${provider?.label ?? 'the AI service'}?`}
        description={`The photo of this bill and the text read from it are sent over the internet with your own API key. ${provider?.note ?? ''} Nothing is sent without this confirmation. ${quota.remaining} of ${quota.limit} AI reads left today.`}
        confirmLabel="Send and read"
        onConfirm={() => void runAi()}
      />
      <ConfirmDialog
        testID="confirm-delete-receipt"
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        destructive
        title="Delete this bill?"
        description={
          receipt.status === 'budgeted'
            ? 'The photo, the digital copy and the spend it created will be deleted.'
            : 'The photo and the digital copy will be deleted.'
        }
        confirmLabel="Delete"
        onConfirm={remove}
      />
    </Screen>
  );
}

const AI_ERROR_TITLE: Record<AiError['code'], string> = {
  NOT_CONFIGURED: 'AI is switched off',
  NO_KEY: 'Add your API key first',
  LIMIT_REACHED: 'Daily AI limit reached',
  RATE_LIMITED: 'Free AI quota used up',
  UNAUTHORIZED: 'The API key was rejected',
  MODEL_NOT_FOUND: 'That AI model is not available',
  NETWORK: 'No connection',
  BAD_RESPONSE: 'AI sent an unreadable answer',
  HTTP: 'AI could not read this bill',
};
