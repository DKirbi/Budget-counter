import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button } from './button';
import { Text } from './text';

describe('Button', () => {
  it('renders its label and fires onPress', async () => {
    const onPress = jest.fn();
    await render(
      <Button onPress={onPress}>
        <Text>Save</Text>
      </Button>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
