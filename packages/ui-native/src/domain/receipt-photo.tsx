/**
 * ReceiptPhoto — the photo of a bill, or a placeholder when there is none (typed in by hand, or the file is gone).
 * @module domain/receipt-photo
 */
import * as React from 'react';
import { Image, View } from 'react-native';
import { ReceiptText } from 'lucide-react-native';
import { cn } from '../lib/cn';
import { Icon } from '../primitives/icon';
import { Text } from '../primitives/text';

/** Props for {@link ReceiptPhoto}. */
export interface ReceiptPhotoProps {
  /** Local file or data URI. */
  uri?: string;
  /** Accessible description, e.g. the shop name. */
  label?: string;
  className?: string;
}

/**
 * Bill photo, 4:5, letterboxed so nothing is cropped.
 * @example
 * <ReceiptPhoto uri={receipt.imageUri} label={receipt.data.merchant} />
 */
export function ReceiptPhoto({ uri, label, className }: ReceiptPhotoProps) {
  const [failed, setFailed] = React.useState(false);
  const show = uri && !failed;
  return (
    <View
      testID="receipt-photo"
      className={cn(
        'aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-muted',
        className,
      )}
    >
      {show ? (
        <Image
          source={{ uri }}
          resizeMode="contain"
          accessibilityLabel={label ? `Photo of the bill from ${label}` : 'Photo of the bill'}
          onError={() => setFailed(true)}
          className="h-full w-full"
        />
      ) : (
        <View className="items-center gap-2 px-6">
          <Icon as={ReceiptText} size={32} className="text-muted-foreground" />
          <Text variant="muted" className="text-center">
            {uri ? 'The photo is no longer on this device.' : 'Entered by hand — no photo.'}
          </Text>
        </View>
      )}
    </View>
  );
}
