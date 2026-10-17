import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Bell } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';
import { renderUI } from '../testing';
import { Alert } from './alert';
import { ConfirmDialog } from './alert-dialog';
import { Badge } from './badge';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Field } from './field';
import { Icon } from './icon';
import { Input } from './input';
import { Label } from './label';
import { Progress } from './progress';
import { RadioCard, RadioGroup } from './radio-group';
import { Separator } from './separator';
import { Skeleton } from './skeleton';
import { Stepper } from './stepper';
import { Switch } from './switch';
import { SegmentedControl } from './tabs';
import { Text } from './text';
import { ToggleGroup, ToggleGroupItem } from './toggle-group';

const cls = (el: { props: { className?: string } }) => el.props.className ?? '';

describe('Text', () => {
  it('renders headings with the heading role', async () => {
    await renderUI(<Text variant="h1">Today</Text>);
    expect(screen.getByRole('heading', { name: 'Today' })).toBeOnTheScreen();
  });

  it('lets a caller className override the variant (tailwind-merge)', async () => {
    await renderUI(
      <Text variant="muted" className="text-destructive">
        x
      </Text>,
    );
    expect(cls(screen.getByText('x'))).toContain('text-destructive');
    expect(cls(screen.getByText('x'))).not.toContain('text-muted-foreground');
  });
});

describe('Button', () => {
  it('applies variant classes and pushes label styles to child text', async () => {
    await renderUI(
      <Button variant="destructive" testID="b">
        <Text>Delete</Text>
      </Button>,
    );
    expect(cls(screen.getByTestId('b'))).toContain('bg-destructive');
    expect(cls(screen.getByText('Delete'))).toContain('text-destructive-foreground');
  });

  it('does not fire when disabled and exposes disabled state', async () => {
    const onPress = jest.fn();
    await renderUI(
      <Button disabled onPress={onPress}>
        <Text>Save</Text>
      </Button>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('has a 44px touch height by default and a smaller opt-in', async () => {
    await renderUI(
      <>
        <Button testID="d">
          <Text>a</Text>
        </Button>
        <Button testID="s" size="sm">
          <Text>b</Text>
        </Button>
      </>,
    );
    expect(cls(screen.getByTestId('d'))).toContain('h-11');
    expect(cls(screen.getByTestId('s'))).toContain('h-9');
  });
});

describe('Input & Field', () => {
  it('reports typing and marks invalid state', async () => {
    const onChangeText = jest.fn();
    await renderUI(<Input accessibilityLabel="Name" invalid onChangeText={onChangeText} />);
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Lisbon');
    expect(onChangeText).toHaveBeenCalledWith('Lisbon');
    expect(cls(screen.getByLabelText('Name'))).toContain('border-destructive');
  });

  it('Field shows the description, then swaps it for an announced error', async () => {
    const { rerender } = await renderUI(
      <Field label="Budget" description="Total for the trip">
        <Input accessibilityLabel="Budget" />
      </Field>,
    );
    expect(screen.getByText('Total for the trip')).toBeOnTheScreen();
    await rerender(
      <Field label="Budget" description="Total for the trip" error="Enter an amount">
        <Input accessibilityLabel="Budget" />
      </Field>,
    );
    expect(screen.queryByText('Total for the trip')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount');
  });
});

describe('Card, Badge, Separator, Label, Skeleton', () => {
  it('Card exposes title as a heading', async () => {
    await renderUI(
      <Card>
        <CardHeader>
          <CardTitle>Trip</CardTitle>
          <CardDescription>Lisbon</CardDescription>
        </CardHeader>
        <CardContent>
          <Text>Body</Text>
        </CardContent>
      </Card>,
    );
    expect(screen.getByRole('heading', { name: 'Trip' })).toBeOnTheScreen();
    expect(screen.getByText('Body')).toBeOnTheScreen();
  });

  it.each([
    ['success', 'bg-success', 'text-success-foreground'],
    ['warning', 'bg-warning', 'text-warning-foreground'],
    ['destructive', 'bg-destructive', 'text-destructive-foreground'],
  ] as const)('Badge %s uses its semantic colours', async (variant, bg, text) => {
    await renderUI(
      <Badge variant={variant} testID="badge">
        <Text>label</Text>
      </Badge>,
    );
    expect(cls(screen.getByTestId('badge'))).toContain(bg);
    expect(cls(screen.getByText('label'))).toContain(text);
  });

  it('Separator is decorative (hidden from assistive tech)', async () => {
    await renderUI(<Separator testID="sep" />);
    expect(screen.getByTestId('sep', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.queryByTestId('sep')).toBeNull();
  });

  it('Label renders text', async () => {
    await renderUI(<Label>Amount</Label>);
    expect(screen.getByText('Amount')).toBeOnTheScreen();
  });

  it('Skeleton is decorative: hidden from assistive tech (the loading container announces busy)', async () => {
    await renderUI(<Skeleton className="h-4 w-20" testID="sk" />);
    expect(screen.getByTestId('sk', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.queryByTestId('sk')).toBeNull(); // hidden elements are excluded from default queries
  });
});

describe('Progress', () => {
  it('exposes a clamped value and sizes the indicator', async () => {
    await renderUI(<Progress value={140} testID="p" />);
    expect(screen.getByRole('progressbar')).toHaveProp('aria-valuenow', 100);
  });
});

describe('Switch', () => {
  it('toggles through onCheckedChange and reports state', async () => {
    const onCheckedChange = jest.fn();
    function Harness() {
      const [checked, setChecked] = React.useState(false);
      return (
        <Switch
          checked={checked}
          onCheckedChange={(v) => {
            setChecked(v);
            onCheckedChange(v);
          }}
          accessibilityLabel="Split payment"
        />
      );
    }
    await renderUI(<Harness />);
    const sw = screen.getByRole('switch', { name: 'Split payment' });
    expect(sw).not.toBeChecked();
    await fireEvent.press(sw);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('switch', { name: 'Split payment' })).toBeChecked();
  });
});

describe('SegmentedControl', () => {
  it('selects an option and reports it', async () => {
    const onValueChange = jest.fn();
    await renderUI(
      <SegmentedControl
        value="system"
        onValueChange={onValueChange}
        accessibilityLabel="Theme"
        options={[
          { value: 'system', label: 'System' },
          { value: 'dark', label: 'Dark' },
        ]}
      />,
    );
    expect(screen.getByRole('tab', { name: 'System' })).toBeSelected();
    await fireEvent.press(screen.getByRole('tab', { name: 'Dark' }));
    expect(onValueChange).toHaveBeenCalledWith('dark');
  });
});

describe('ToggleGroup', () => {
  it('marks the selected chip and changes selection', async () => {
    const onValueChange = jest.fn();
    await renderUI(
      <ToggleGroup type="single" value="a" onValueChange={onValueChange}>
        <ToggleGroupItem value="a" testID="a">
          <Text>A</Text>
        </ToggleGroupItem>
        <ToggleGroupItem value="b" testID="b">
          <Text>B</Text>
        </ToggleGroupItem>
      </ToggleGroup>,
    );
    expect(cls(screen.getByTestId('a'))).toContain('bg-primary');
    expect(cls(screen.getByTestId('b'))).not.toContain('bg-primary ');
    await fireEvent.press(screen.getByTestId('b'));
    expect(onValueChange).toHaveBeenCalledWith('b');
  });
});

describe('RadioGroup / RadioCard', () => {
  it('shows title + description and reports the chosen value', async () => {
    const onValueChange = jest.fn();
    await renderUI(
      <RadioGroup value="cascade" onValueChange={onValueChange}>
        <RadioCard value="cascade" selected title="Cascade" description="Comes off tomorrow" />
        <RadioCard
          value="redistribute"
          selected={false}
          title="Redistribute"
          description="Spread over days"
        />
      </RadioGroup>,
    );
    expect(screen.getByText('Comes off tomorrow')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: /Redistribute/ }));
    expect(onValueChange).toHaveBeenCalledWith('redistribute');
  });
});

describe('Stepper', () => {
  function Harness({ min = 1, max = 3 }: { min?: number; max?: number }) {
    const [v, setV] = React.useState(2);
    return (
      <Stepper
        label="days"
        value={v}
        onValueChange={setV}
        min={min}
        max={max}
        format={(n) => `${n} days`}
        testID="st"
      />
    );
  }

  it('increments and decrements within bounds', async () => {
    await renderUI(<Harness />);
    await fireEvent.press(screen.getByLabelText('Increase days'));
    expect(screen.getByText('3 days')).toBeOnTheScreen();
    expect(screen.getByLabelText('Increase days')).toBeDisabled();
    await fireEvent.press(screen.getByLabelText('Decrease days'));
    await fireEvent.press(screen.getByLabelText('Decrease days'));
    expect(screen.getByText('1 days')).toBeOnTheScreen();
    expect(screen.getByLabelText('Decrease days')).toBeDisabled();
  });

  it('is adjustable for screen readers', async () => {
    await renderUI(<Harness />);
    const el = screen.getByRole('adjustable');
    expect(el).toHaveAccessibilityValue({ min: 1, max: 3, now: 2, text: '2 days' });
    await fireEvent(el, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(screen.getByText('3 days')).toBeOnTheScreen();
  });
});

describe('Alert', () => {
  it('announces itself with title and description', async () => {
    await renderUI(
      <Alert variant="warning" icon={Bell} title="Close to the limit" description="€3.20 left" />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/Close to the limit/);
    expect(alert).toHaveTextContent(/€3\.20 left/);
    expect(cls(alert)).toContain('border-warning');
  });
});

describe('Icon', () => {
  it('is hidden from assistive tech unless labelled', async () => {
    await renderUI(
      <View>
        <Icon as={Bell} testID="decor" />
        <Icon as={Bell} aria-label="Notifications" testID="meaningful" />
      </View>,
    );
    expect(screen.queryByTestId('decor')).toBeNull();
    expect(screen.getByLabelText('Notifications')).toBeOnTheScreen();
  });
});

describe('ConfirmDialog', () => {
  function Harness({ onConfirm }: { onConfirm: () => void }) {
    const [open, setOpen] = React.useState(false);
    return (
      <>
        <Button onPress={() => setOpen(true)}>
          <Text>Open</Text>
        </Button>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          destructive
          title="Delete trip?"
          description="Spends go too."
          confirmLabel="Delete"
          onConfirm={onConfirm}
          testID="dlg"
        />
      </>
    );
  }

  it('opens, confirms and closes', async () => {
    const onConfirm = jest.fn();
    await renderUI(<Harness onConfirm={onConfirm} />);
    expect(screen.queryByText('Delete trip?')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByText('Delete trip?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('dlg-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText('Delete trip?')).toBeNull());
  });

  it('cancel closes without confirming', async () => {
    const onConfirm = jest.fn();
    await renderUI(<Harness onConfirm={onConfirm} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Open' }));
    await fireEvent.press(await screen.findByTestId('dlg-cancel'));
    expect(onConfirm).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Delete trip?')).toBeNull());
  });
});
