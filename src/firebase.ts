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
      const db = getFirestore(app);

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
            const res = await fetch("/api/auth/google", {
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

            if (res.ok) {
              window.location.href = "/?page=dashboard";
            } else {
              window.location.href = "/?page=dashboard";
            }
          } catch (err) {
            console.error("Google sign-in error:", err);
            alert("Google Sign-In error: " + (err.message || "Failed to sign in"));
            googleBtn.disabled = false;
            googleBtn.innerHTML = "Sign in with Google";
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
