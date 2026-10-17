import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { ReceiptPhoto } from './receipt-photo';

// A 1×1 grey PNG keeps the story offline and deterministic.
const GREY =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** The photo of a bill, letterboxed 4:5. Falls back to a note when there is no photo or the file is gone. */
const meta = {
  title: 'Domain/ReceiptPhoto',
  component: ReceiptPhoto,
  decorators: [
    (Story) => (
      <View className="w-64">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof ReceiptPhoto>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithPhoto: Story = { args: { uri: GREY, label: 'Pastelaria Central' } };
export const TypedByHand: Story = {};
