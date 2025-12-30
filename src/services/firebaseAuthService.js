import { initializeApp, getApps } from 'firebase/app'
import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  getRedirectResult,
  getIdToken,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signOut,
} from 'firebase/auth'

function getFirebaseConfig() {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
  const appId = import.meta.env.VITE_FIREBASE_APP_ID

  if (!apiKey || !authDomain || !projectId || !appId) return null

  return {
    apiKey,
    authDomain,
    projectId,
    appId,
  }
}

export function isFirebaseAuthEnabled() {
  return Boolean(getFirebaseConfig())
}

function getFirebaseAuth() {
  const cfg = getFirebaseConfig()
  if (!cfg) return null

  if (getApps().length === 0) {
    initializeApp(cfg)
  }

  const auth = getAuth()
  // Best-effort: finalize any pending redirect sign-in so currentUser is populated.
  // We don't need the credential here; just ensure the auth state settles.
  getRedirectResult(auth).catch(() => null)
  return auth
}

export function onAuthUserChanged(cb) {
  const auth = getFirebaseAuth()
  if (!auth) {
    // Keep it predictable for callers.
    cb(null)
    return () => {}
  }

  return onAuthStateChanged(auth, cb)
}

export async function getFirebaseIdToken() {
  const auth = getFirebaseAuth()
  if (!auth) return null

  const user = auth.currentUser
  if (!user) return null

  try {
    return await getIdToken(user)
  } catch {
    return null
  }
}

export async function signInWithProviderRedirect(providerKey) {
  const auth = getFirebaseAuth()
  if (!auth) throw new Error('Firebase auth is not configured')

  const key = String(providerKey || '').toLowerCase()
  let provider

  if (key === 'google') {
    provider = new GoogleAuthProvider()
  } else if (key === 'facebook') {
    provider = new FacebookAuthProvider()
  } else if (key === 'apple') {
    provider = new OAuthProvider('apple.com')
  } else {
    throw new Error(`Unknown provider: ${providerKey}`)
  }

  // Redirect-based sign-in works well on iOS Safari.
  await signInWithRedirect(auth, provider)
}

export async function signOutUser() {
  const auth = getFirebaseAuth()
  if (!auth) return
  await signOut(auth)
}

export async function signInWithEmailPassword(email, password) {
  const auth = getFirebaseAuth()
  if (!auth) throw new Error('Firebase auth is not configured')

  const e = String(email || '').trim()
  const p = String(password || '')
  if (!e || !p) throw new Error('Email og adgangskode kræves')

  const res = await signInWithEmailAndPassword(auth, e, p)
  return res?.user || null
}

export async function createUserWithEmailPassword(email, password) {
  const auth = getFirebaseAuth()
  if (!auth) throw new Error('Firebase auth is not configured')

  const e = String(email || '').trim()
  const p = String(password || '')
  if (!e || !p) throw new Error('Email og adgangskode kræves')

  const res = await createUserWithEmailAndPassword(auth, e, p)
  return res?.user || null
}
