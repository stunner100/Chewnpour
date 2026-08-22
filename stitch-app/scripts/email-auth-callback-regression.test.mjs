import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const authContextSource = await fs.readFile(
  path.join(root, 'src', 'contexts', 'AuthContext.jsx'),
  'utf8'
);

const signUpStart = authContextSource.indexOf('const signUp = async');
const signInStart = authContextSource.indexOf('const signIn = async');
const socialStart = authContextSource.indexOf('const signInWithGoogle = async');

if (signUpStart === -1 || signInStart === -1 || socialStart === -1) {
  throw new Error('Could not locate auth function boundaries in AuthContext.jsx.');
}

const signUpBlock = authContextSource.slice(signUpStart, signInStart);
const signInBlock = authContextSource.slice(signInStart, socialStart);
const socialBlock = authContextSource.slice(socialStart);

if (/betterSignUp\.email\(\{[\s\S]*callbackURL/s.test(signUpBlock)) {
  throw new Error('Email signup should not send callbackURL to Better Auth.');
}

if (/betterSignIn\.email\(\{[\s\S]*callbackURL/s.test(signInBlock)) {
  throw new Error('Email sign-in should not send callbackURL to Better Auth.');
}

if (/betterSignIn\.social\(/.test(socialBlock)) {
  throw new Error('Google social sign-in must not use XHR betterSignIn.social.');
}

if (!/\/api\/auth\/google-start/.test(socialBlock) || !/callbackURL/.test(socialBlock)) {
  throw new Error('Google social sign-in should still send callbackURL through google-start.');
}

console.log('email-auth-callback-regression.test.mjs passed');
