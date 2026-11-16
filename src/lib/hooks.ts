// Small hooks shared by screens.

import { useState } from 'react';

/**
 * State for a text field that starts as `value` and goes back to it
 * whenever `value` itself changes (the saved ZIP code changed elsewhere),
 * while leaving the customer free to type in between.
 */
export function useFollowing(value: string): [string, (next: string) => void] {
  const [text, setText] = useState(value);
  const [followed, setFollowed] = useState(value);
  if (followed !== value) {
    setFollowed(value);
    setText(value);
  }
  return [text, setText];
}
