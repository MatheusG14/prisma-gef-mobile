/**
 * Prisma Firebase client — dynamic imports (falha de CDN não quebra o parse do módulo).
 * API pública: window.PrismaFirebase (inalterada).
 */
const FB = 'https://www.gstatic.com/firebasejs/13.3.0';

const config = window.PRISMA_FIREBASE_CONFIG || {};
const requiredConfigKeys = ['apiKey', 'authDomain', 'projectId', 'messagingSenderId', 'appId'];
const missingConfigKeys = requiredConfigKeys.filter((key) => !String(config[key] || '').trim());
const observers = new Set();

let app;
let auth;
let database;
let currentUser = null;
let authStateSettled = false;
let persistenceMode = 'local';
let resolveAuthState;
let rejectAuthState;
let sdk = null;

const authStateReady = new Promise((resolve, reject) => {
  resolveAuthState = resolve;
  rejectAuthState = reject;
});

function assertConfig() {
  if (missingConfigKeys.length) {
    throw new Error(
      `Configuração Firebase incompleta. Defina no build/hospedagem: ${missingConfigKeys.join(', ')}.`
    );
  }
}

function assertSdk() {
  if (!sdk) {
    throw new Error(
      'SDK do Firebase não carregou (cdn gstatic.com). Verifique rede, adblock e se o site está em HTTPS.'
    );
  }
}

function serializeState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new TypeError('Os dados financeiros estão em um formato inválido.');
  }
  const serialized = JSON.stringify(state);
  const byteLength = new TextEncoder().encode(serialized).length;
  if (byteLength > 800000) {
    throw new Error('Os dados excedem o limite seguro de sincronização. Reduza o histórico antes de sincronizar.');
  }
  return JSON.parse(serialized);
}

function stateReference(uid) {
  return sdk.doc(database, 'users', uid, 'appData', 'state');
}
function profileReference(uid) {
  return sdk.doc(database, 'users', uid);
}
function consentReference(uid) {
  return sdk.doc(database, 'users', uid, 'appData', 'consent');
}

async function loadSdk() {
  try {
    const [appMod, authMod, fsMod] = await Promise.all([
      import(`${FB}/firebase-app.js`),
      import(`${FB}/firebase-auth.js`),
      import(`${FB}/firebase-firestore.js`)
    ]);
    sdk = {
      getApp: appMod.getApp,
      getApps: appMod.getApps,
      initializeApp: appMod.initializeApp,
      browserLocalPersistence: authMod.browserLocalPersistence,
      browserSessionPersistence: authMod.browserSessionPersistence,
      inMemoryPersistence: authMod.inMemoryPersistence,
      confirmPasswordReset: authMod.confirmPasswordReset,
      createUserWithEmailAndPassword: authMod.createUserWithEmailAndPassword,
      getAuth: authMod.getAuth,
      onAuthStateChanged: authMod.onAuthStateChanged,
      sendPasswordResetEmail: authMod.sendPasswordResetEmail,
      setPersistence: authMod.setPersistence,
      signInWithEmailAndPassword: authMod.signInWithEmailAndPassword,
      signOut: authMod.signOut,
      updateProfile: authMod.updateProfile,
      GoogleAuthProvider: authMod.GoogleAuthProvider,
      signInWithPopup: authMod.signInWithPopup,
      signInWithRedirect: authMod.signInWithRedirect,
      getRedirectResult: authMod.getRedirectResult,
      doc: fsMod.doc,
      getDoc: fsMod.getDoc,
      getFirestore: fsMod.getFirestore,
      initializeFirestore: fsMod.initializeFirestore,
      persistentLocalCache: fsMod.persistentLocalCache,
      persistentMultipleTabManager: fsMod.persistentMultipleTabManager,
      memoryLocalCache: fsMod.memoryLocalCache,
      onSnapshot: fsMod.onSnapshot,
      runTransaction: fsMod.runTransaction,
      serverTimestamp: fsMod.serverTimestamp,
      setDoc: fsMod.setDoc,
      writeBatch: fsMod.writeBatch
    };
    return sdk;
  } catch (error) {
    const err = new Error(
      'Não foi possível baixar o SDK do Firebase (gstatic.com). Verifique sua conexão, desative bloqueadores para este site e tente novamente.',
      { cause: error }
    );
    window.PrismaFirebaseLoadError = err;
    throw err;
  }
}

const ready = (async () => {
  assertConfig();
  await loadSdk();
  assertSdk();

  app = sdk.getApps().length ? sdk.getApp() : sdk.initializeApp(config);
  auth = sdk.getAuth(app);

  try {
    database = sdk.initializeFirestore(app, {
      localCache: sdk.persistentLocalCache({
        tabManager: sdk.persistentMultipleTabManager()
      })
    });
  } catch (firestorePersistenceError) {
    try {
      database = sdk.getFirestore(app);
    } catch (_) {
      try {
        database = sdk.initializeFirestore(app, { localCache: sdk.memoryLocalCache() });
      } catch (memoryCacheError) {
        database = sdk.getFirestore(app);
        console.warn('Firestore sem cache local explícito.', memoryCacheError);
      }
    }
    console.warn('Persistência offline do Firestore indisponível.', firestorePersistenceError);
  }

  try {
    await sdk.setPersistence(auth, sdk.browserLocalPersistence);
    persistenceMode = 'local';
  } catch (localPersistenceError) {
    try {
      await sdk.setPersistence(auth, sdk.browserSessionPersistence);
      persistenceMode = 'session';
      console.warn('Persistência local de auth bloqueada; usando sessão.', localPersistenceError);
    } catch (sessionPersistenceError) {
      try {
        await sdk.setPersistence(auth, sdk.inMemoryPersistence);
        persistenceMode = 'memory';
        console.warn('Auth apenas em memória nesta página.', sessionPersistenceError);
      } catch (memoryPersistenceError) {
        persistenceMode = 'none';
        console.warn('Sem persistência de auth.', memoryPersistenceError);
      }
    }
  }

  sdk.onAuthStateChanged(
    auth,
    (user) => {
      currentUser = user;
      if (!authStateSettled) {
        authStateSettled = true;
        resolveAuthState(user);
      }
      observers.forEach((observer) => observer(user));
    },
    (error) => {
      if (!authStateSettled) {
        authStateSettled = true;
        rejectAuthState(error);
      }
      observers.forEach((observer) => observer(null, error));
    }
  );

  await authStateReady;
  return { app, auth, database, persistenceMode };
})();

function requireCurrentUser(uid) {
  if (!currentUser || currentUser.uid !== uid) {
    throw new Error('A sessão Firebase expirou. Entre novamente para continuar.');
  }
}

async function saveProfile(user, { created = false } = {}) {
  await ready;
  requireCurrentUser(user.uid);
  const reference = profileReference(user.uid);
  const profile = {
    displayName: String(user.displayName || '').trim(),
    email: String(user.email || '').trim(),
    photoURL: user.photoURL || null,
    updatedAt: sdk.serverTimestamp()
  };
  if (created) profile.createdAt = sdk.serverTimestamp();
  await sdk.setDoc(reference, profile, { merge: true });
}

async function updateDisplayName(name) {
  await ready;
  if (!currentUser) throw new Error('Nenhuma conta autenticada.');
  const displayName = String(name || '').trim();
  if (displayName.length < 2) throw new Error('O nome deve ter pelo menos 2 caracteres.');
  await sdk.updateProfile(currentUser, { displayName });
  await saveProfile(currentUser);
}

async function register(email, password, displayName) {
  await ready;
  const cred = await sdk.createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await sdk.updateProfile(cred.user, { displayName: String(displayName).trim() });
  }
  await saveProfile(cred.user, { created: true });
  return cred.user;
}

async function login(email, password) {
  await ready;
  const cred = await sdk.signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

async function resetPassword(email) {
  await ready;
  await sdk.sendPasswordResetEmail(auth, email);
}

async function applyPasswordReset(oobCode, newPassword) {
  await ready;
  await sdk.confirmPasswordReset(auth, oobCode, newPassword);
}

async function logout() {
  await ready;
  await sdk.signOut(auth);
}

async function loadUserData(uid) {
  await ready;
  requireCurrentUser(uid);
  const [profileSnap, stateSnap, consentSnap] = await Promise.all([
    sdk.getDoc(profileReference(uid)),
    sdk.getDoc(stateReference(uid)),
    sdk.getDoc(consentReference(uid))
  ]);
  return {
    profile: profileSnap.exists() ? profileSnap.data() : null,
    state: stateSnap.exists() ? stateSnap.data()?.data || null : null,
    revision: stateSnap.exists() ? stateSnap.data()?.revision || null : null,
    consent: consentSnap.exists() ? consentSnap.data() : null
  };
}

async function saveState(uid, state, expectedRevision = null) {
  await ready;
  requireCurrentUser(uid);
  const data = serializeState(state);
  const reference = stateReference(uid);

  const nextRevision = await sdk.runTransaction(database, async (transaction) => {
    const snap = await transaction.get(reference);
    const currentRevision = snap.exists() ? Number(snap.data().revision) || 0 : 0;
    if (expectedRevision != null && currentRevision !== Number(expectedRevision)) {
      const conflict = new Error('Conflito de revisão ao salvar o estado no Firestore.');
      conflict.code = 'prisma/revision-conflict';
      conflict.currentRevision = currentRevision;
      throw conflict;
    }
    const revision = currentRevision + 1;
    transaction.set(reference, {
      schemaVersion: 1,
      data,
      revision,
      updatedAt: sdk.serverTimestamp()
    });
    return revision;
  });

  return nextRevision;
}

function watchState(uid, onChange, onError) {
  if (!sdk || !database) {
    if (typeof onError === 'function') onError(new Error('Firebase não inicializado.'));
    return () => {};
  }
  requireCurrentUser(uid);
  return sdk.onSnapshot(
    stateReference(uid),
    (snapshot) => {
      if (!snapshot.exists()) return;
      const payload = snapshot.data();
      onChange(payload.data, payload.revision || null);
    },
    onError
  );
}

async function saveConsent(uid, preferences) {
  await ready;
  requireCurrentUser(uid);
  await sdk.setDoc(
    consentReference(uid),
    {
      essentialAccepted: true,
      communicationsConsent: Boolean(preferences.communicationsConsent),
      analyticsConsent: Boolean(preferences.analyticsConsent),
      openFinanceConsent: Boolean(preferences.openFinanceConsent),
      updatedAt: sdk.serverTimestamp()
    },
    { merge: true }
  );
}

async function deleteAccount(password) {
  await ready;
  if (!currentUser) throw new Error('Nenhuma conta autenticada.');
  const passwordProvider = currentUser.providerData.find((provider) => provider.providerId === 'password');
  if (passwordProvider) {
    if (!password) throw new Error('Confirme sua senha para excluir a conta.');
    const { EmailAuthProvider, reauthenticateWithCredential, deleteUser } = await import(
      `${FB}/firebase-auth.js`
    );
    const credential = EmailAuthProvider.credential(currentUser.email, password);
    await reauthenticateWithCredential(currentUser, credential);
    const batch = sdk.writeBatch(database);
    batch.delete(stateReference(currentUser.uid));
    batch.delete(consentReference(currentUser.uid));
    batch.delete(profileReference(currentUser.uid));
    await batch.commit();
    await deleteUser(currentUser);
    return;
  }
  throw new Error('A exclusão segura desta conta requer reautenticação pelo provedor de login.');
}

function onUserChanged(observer) {
  observers.add(observer);
  if (authStateSettled) queueMicrotask(() => observer(currentUser));
  return () => observers.delete(observer);
}


async function loginWithGoogle() {
  await ready;
  const provider = new sdk.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  provider.addScope('profile');
  provider.addScope('email');
  try {
    const cred = await sdk.signInWithPopup(auth, provider);
    const user = cred.user;
    // Garante perfil no Firestore na primeira entrada
    try {
      const snap = await sdk.getDoc(profileReference(user.uid));
      if (!snap.exists()) {
        await saveProfile(user, { created: true });
      } else {
        await saveProfile(user);
      }
    } catch (profileError) {
      console.warn('Perfil Google: sincronização parcial', profileError);
    }
    return user;
  } catch (error) {
    // Popup bloqueado → redirect
    if (error && (error.code === 'auth/popup-blocked' || error.code === 'auth/operation-not-supported-in-this-environment')) {
      await sdk.signInWithRedirect(auth, provider);
      return null;
    }
    throw error;
  }
}

async function completeGoogleRedirectIfAny() {
  try {
    await ready;
    const result = await sdk.getRedirectResult(auth);
    if (result && result.user) {
      const user = result.user;
      try {
        const snap = await sdk.getDoc(profileReference(user.uid));
        if (!snap.exists()) await saveProfile(user, { created: true });
        else await saveProfile(user);
      } catch (_) {}
      return user;
    }
  } catch (error) {
    console.warn('Google redirect result:', error);
    window.PrismaFirebaseLoadError = window.PrismaFirebaseLoadError || error;
  }
  return null;
}

function publishApi() {
  window.PrismaFirebase = Object.freeze({
    ready,
    onUserChanged,
    getCurrentUser: async () => {
      await ready;
      return currentUser;
    },
    getIdToken: async (forceRefresh = false) => {
      await ready;
      return currentUser ? currentUser.getIdToken(forceRefresh) : null;
    },
    getPersistenceMode: async () => {
      await ready;
      return persistenceMode;
    },
    register,
    login,
    loginWithGoogle,
    completeGoogleRedirectIfAny,
    resetPassword,
    applyPasswordReset,
    logout,
    saveProfile,
    updateDisplayName,
    loadUserData,
    saveState,
    watchState,
    saveConsent,
    deleteAccount,
    isConfigured: missingConfigKeys.length === 0,
    missingConfigKeys: missingConfigKeys.slice()
  });
  window.dispatchEvent(new Event('prisma-firebase-ready'));
}

// Publica a API imediatamente (isConfigured) e deixa ready resolver em background.
publishApi();

ready.catch((error) => {
  console.error('Falha ao inicializar Firebase:', error);
  window.PrismaFirebaseLoadError = error;
  if (!authStateSettled) {
    authStateSettled = true;
    try {
      rejectAuthState(error);
    } catch (_) {}
  }
});
