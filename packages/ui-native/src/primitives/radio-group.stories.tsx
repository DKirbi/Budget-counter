import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Controlled } from '../storybook';
import { RadioCard, RadioGroup } from './radio-group';

/**
 * `RadioGroup` + `RadioCard`: large, descriptive single-choice cards — used for the overspend rule, where the
 * consequence of each choice needs a sentence of explanation.
 */
const meta = {
  title: 'Primitives/RadioGroup',
  component: RadioGroup,
  args: { value: 'cascade', onValueChange: () => undefined },
  render: (args) => (
    <Controlled value={args.value}>
      {(value, setValue) => (
        <RadioGroup {...args} value={value} onValueChange={setValue} className="gap-3">
          <RadioCard
            value="cascade"
            selected={value === 'cascade'}
            title="Take it from tomorrow"
            description="Overspend reduces the next day only."
            testID="rule-cascade"
          />
          <RadioCard
            value="redistribute"
            selected={value === 'redistribute'}
            title="Spread it out"
            description="Split the overspend over all remaining days."
            testID="rule-redistribute"
          />
        </RadioGroup>
      )}
    </Controlled>
  ),
} satisfies Meta<typeof RadioGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId('rule-redistribute'));
    await expect(canvas.getByTestId('rule-redistribute')).toHaveAttribute('aria-checked', 'true');
    await expect(canvas.getByTestId('rule-cascade')).toHaveAttribute('aria-checked', 'false');
  },
};
