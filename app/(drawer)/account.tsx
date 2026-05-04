import { Redirect } from 'expo-router';

/** Account routes redirect to unified Settings (Part 2). */
export default function AccountRedirect() {
  return <Redirect href="/settings" />;
}
