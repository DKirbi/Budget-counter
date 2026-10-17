// react-hook-form resolves zod validation asynchronously and then sets state outside RNTL's act() boundary.
// The flow tests already `await waitFor(...)` for the visible result, so that one warning is noise that hides real
// failures. Filter it for the two form screens and the MiniApp shell they navigate through; every other act() warning still surfaces.
const originalError = console.error;
console.error = (...args) => {
  const message = typeof args[0] === 'string' ? args[0] : '';
  if (
    message.includes('not wrapped in act(') &&
    /CreateTripScreen|LogSpendScreen|MiniApp/.test(`${message} ${args[1] ?? ''}`)
  )
    return;
  originalError(...args);
};
