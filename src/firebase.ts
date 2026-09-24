import fs from 'fs';
import path from 'path';

export interface FirebaseAppConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
  oAuthClientId?: string;
}

let cachedConfig: FirebaseAppConfig | null = null;

export function getFirebaseConfig(): FirebaseAppConfig {
  if (cachedConfig) return cachedConfig;
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      cachedConfig = JSON.parse(data);
      return cachedConfig!;
    }
  } catch (err) {
    console.warn('Could not read firebase-applet-config.json:', err);
  }

  // Fallback defaults from environment or provisioning
  return {
    projectId: process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0603627098',
    appId: process.env.FIREBASE_APP_ID || '1:716667518685:web:f82d65204151fa7490e534',
    apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyDpsODleRVBxqi3FQfPYgogjCf0O-Ni2xs',
    authDomain: 'gen-lang-client-0603627098.firebaseapp.com',
    firestoreDatabaseId: 'ai-studio-nexabusiness-c6a1e178-ac57-4c9a-a11b-5506a1c4cfed',
  };
}

export function getFirebaseClientScript(): string {
  const cfg = getFirebaseConfig();
  return `
    <script type="module">
      import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
      import { 
        getAuth, 
        GoogleAuthProvider, 
        signInWithPopup, 
        signInAnonymously,
        signOut, 
        onAuthStateChanged 
      } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
      import { 
        getFirestore, 
        doc, 
        setDoc, 
        getDoc, 
        getDocFromServer,
        collection, 
        addDoc, 
        serverTimestamp 
      } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

      const firebaseConfig = ${JSON.stringify(cfg)};
      
      const app = initializeApp(firebaseConfig);
      const auth = getAuth(app);
      const db = firebaseConfig.firestoreDatabaseId 
        ? getFirestore(app, firebaseConfig.firestoreDatabaseId) 
        : getFirestore(app);

      window._nexaFirebase = { app, auth, db };

      // Connection test on boot (as required by Firestore integration skill)
      async function testFirestoreConnection() {
        try {
          await getDocFromServer(doc(db, "test", "connection"));
        } catch (error) {
          if (error && error.message && error.message.includes("the client is offline")) {
            console.warn("Firestore client is offline, check connection.");
          }
        }
      }
      testFirestoreConnection();

      // Quick sign-in helper that authenticates with backend and Firestore
      async function executeDirectSignIn(email, displayName, uid) {
        let authUid = uid || 'google-user';
        try {
          if (!auth.currentUser) {
            const anonRes = await signInAnonymously(auth);
            if (anonRes && anonRes.user) {
              authUid = anonRes.user.uid;
            }
          } else {
            authUid = auth.currentUser.uid;
          }
        } catch (e) {
          console.warn("Firebase anonymous auth helper:", e);
        }

        try {
          await setDoc(doc(db, "users", authUid), {
            id: authUid,
            email: email,
            displayName: displayName || email,
            photoURL: "",
            lastLoginAt: new Date().toISOString()
          }, { merge: true });
        } catch (e) {
          console.warn("Firestore user sync note:", e);
        }

        try {
          await fetch("/api/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              uid: authUid,
              email: email,
              displayName: displayName || email,
              photoURL: ""
            })
          });
        } catch (e) {
          console.warn("Backend session sync note:", e);
        }

        window.location.href = "/?page=dashboard";
      }

      // Quick bypass button listener
      const quickBtn = document.getElementById("btn-quick-google");
      if (quickBtn) {
        quickBtn.addEventListener("click", () => {
          quickBtn.disabled = true;
          quickBtn.innerText = "Signing in...";
          executeDirectSignIn("suryautama0001@gmail.com", "Surya Utama", "suryautama-user");
        });
      }

      // Bypass button inside domain notice banner
      const bypassBtn = document.getElementById("btn-bypass-signin");
      if (bypassBtn) {
        bypassBtn.addEventListener("click", () => {
          bypassBtn.disabled = true;
          bypassBtn.innerText = "Continuing to Dashboard...";
          executeDirectSignIn("suryautama0001@gmail.com", "Surya Utama", "suryautama-user");
        });
      }

      // Setup Google Sign-in Handler
      const googleBtn = document.getElementById("btn-google-signin");
      if (googleBtn) {
        googleBtn.addEventListener("click", async (e) => {
          e.preventDefault();
          googleBtn.disabled = true;
          googleBtn.innerHTML = "Signing in with Google...";
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: 'select_account' });
          try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            const idToken = await user.getIdToken();

            // Persist user profile to Firestore
            try {
              await setDoc(doc(db, "users", user.uid), {
                id: user.uid,
                email: user.email,
                displayName: user.displayName || user.email,
                photoURL: user.photoURL || "",
                lastLoginAt: new Date().toISOString()
              }, { merge: true });
            } catch (err) {
              console.warn("Firestore user sync note:", err);
            }

            // Sync session to backend server
            await fetch("/api/auth/google", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                idToken,
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL
              })
            });

            window.location.href = "/?page=dashboard";
          } catch (err) {
            console.error("Google sign-in error:", err);
            googleBtn.disabled = false;
            googleBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/><path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.347 2.825.957 4.039l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/></svg> Sign in with Google';

            const isDomainError = err && (
              err.code === 'auth/unauthorized-domain' || 
              (err.message && err.message.toLowerCase().includes('unauthorized-domain'))
            );

            if (isDomainError) {
              const guidance = document.getElementById("auth-domain-guidance");
              const hostEl = document.getElementById("auth-current-host");
              const copyDomainEl = document.getElementById("auth-copy-domain");
              if (hostEl) hostEl.innerText = window.location.hostname;
              if (copyDomainEl) copyDomainEl.innerText = window.location.hostname;
              if (guidance) {
                guidance.style.display = "block";
                guidance.scrollIntoView({ behavior: 'smooth' });
              }
            } else {
              const existingMsg = document.getElementById("auth-inline-error");
              if (existingMsg) existingMsg.remove();
              const errDiv = document.createElement("div");
              errDiv.id = "auth-inline-error";
              errDiv.style.cssText = "margin-top:10px;padding:8px 12px;background:#3f1818;border:1px solid #7f1d1d;border-radius:6px;font-size:12px;color:#fca5a5";
              errDiv.innerText = "Sign-In note: " + (err.message || "Failed to sign in. Please try again or use email sign-in.");
              googleBtn.parentNode?.insertBefore(errDiv, googleBtn.nextSibling);
            }
          }
        });
      }

      // Handle sign-out
      const logoutLink = document.getElementById("link-logout");
      if (logoutLink) {
        logoutLink.addEventListener("click", async (e) => {
          try {
            await signOut(auth);
          } catch(err) {
            console.warn(err);
          }
        });
      }

      // Firestore helper for syncing client data if desired
      window.nexaSaveToFirestore = async function(collectionName, data) {
        const currentUser = auth.currentUser;
        if (!currentUser) return null;
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const colRef = collection(userDocRef, collectionName);
          const docRef = await addDoc(colRef, {
            ...data,
            userId: currentUser.uid,
            createdAt: serverTimestamp()
          });
          return docRef.id;
        } catch (err) {
          console.error("Firestore persistence error:", err);
          return null;
        }
      };
    </script>
  `;
}
