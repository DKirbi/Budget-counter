import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card';
import { Text } from './text';

/** Surface for grouped content. Compose `CardHeader`, `CardContent` and `CardFooter` as in shadcn. */
const meta = { title: 'Primitives/Card', component: Card } satisfies Meta<typeof Card>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Lisbon long weekend</CardTitle>
        <CardDescription>7 days · €700 · €100 per day</CardDescription>
      </CardHeader>
      <CardContent>
        <Text>Unspent money carries over to the next day.</Text>
      </CardContent>
      <CardFooter>
        <Button variant="outline">
          <Text>Edit trip</Text>
        </Button>
      </CardFooter>
    </Card>
  ),
};
