import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const modulePath = path.join(root, 'src', 'lib', 'protectedRouteState.js');
const { resolveProtectedRouteState } = await import(pathToFileURL(modulePath).href);

const loadingWithoutUser = resolveProtectedRouteState({
  loading: true,
  user: null,
  profile: null,
  profileReady: false,
  pathname: '/dashboard',
});

if (loadingWithoutUser.type !== 'loading') {
  throw new Error('Expected protected route to stay loading when auth is pending and no user is available.');
}

const loadingWithUserButNoProfile = resolveProtectedRouteState({
  loading: true,
  user: { id: 'user_123' },
  profile: null,
  profileReady: false,
  pathname: '/dashboard',
});

if (loadingWithUserButNoProfile.type !== 'render') {
  throw new Error('Expected protected route to render children when the session user exists but the profile is still hydrating.');
}

const readyWithProfile = resolveProtectedRouteState({
  loading: false,
  user: { id: 'user_123' },
  profile: { onboardingCompleted: false },
  profileReady: true,
  pathname: '/dashboard',
});

if (readyWithProfile.type !== 'render') {
  throw new Error('Expected protected route to render once profile data is ready for an authenticated user.');
}

console.log('protected-route-auth-bootstrap-regression.test.mjs passed');
