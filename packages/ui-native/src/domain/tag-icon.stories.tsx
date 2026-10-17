import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { SPEND_TAGS } from '@tbc/core';
import { View } from 'react-native';
import { TagIcon } from './tag-icon';

/** The coloured category glyph. Each category has its own hue in the tokens, checked for 3:1 contrast on the tile. */
const meta = {
  title: 'Domain/TagIcon',
  component: TagIcon,
  args: { tag: 'food', size: 'md' },
  argTypes: {
    tag: { control: 'select', options: SPEND_TAGS.map((t) => t.id) },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
  },
} satisfies Meta<typeof TagIcon>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllTags: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <View className="flex-row flex-wrap gap-3">
      {SPEND_TAGS.map((t) => (
        <TagIcon key={t.id} tag={t.id} />
      ))}
    </View>
  ),
};
