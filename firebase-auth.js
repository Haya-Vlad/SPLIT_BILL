import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAt65I4tNrymh6bnq63OomY2ZBn1xFb6PA",
  authDomain: "split-e1675.firebaseapp.com",
  projectId: "split-e1675",
  storageBucket: "split-e1675.firebasestorage.app",
  messagingSenderId: "444372080217",
  appId: "1:444372080217:web:aee793ef38fdeda73b0348",
  measurementId: "G-H94DYYPBQQ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

const KEY = "tripsplit-v3";
const btn = document.getElementById("googleProfile");

function getLocalState(){
  try { return JSON.parse(localStorage.getItem(KEY) || '{"profile":null,"trips":[],"month":null,"quickSplits":[]}'); }
  catch { return {profile:null,trips:[],month:null,quickSplits:[]}; }
}
function saveLocalState(state){ localStorage.setItem(KEY, JSON.stringify(state)); }
function toast(msg){
  const el=document.getElementById("toast");
  if(!el)return;
  el.textContent=msg; el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"),2200);
}

function setButton(user){
  if(!btn)return;
  if(user){
    const name=user.displayName || user.email || "Google account";
    btn.textContent=`${name} · Sign out`;
    btn.title=user.email || "Signed in with Google";
  }else{
    btn.textContent="Continue with Google";
    btn.title="Sign in with Google";
  }
}

async function syncStateToCloud(){
  const user=auth.currentUser;
  if(!user)return;
  const state=getLocalState();
  await setDoc(doc(db,"users",user.uid,"appState","main"), {
    profile: state.profile || null,
    trips: state.trips || [],
    quickSplits: state.quickSplits || [],
    month: state.month || null,
    updatedAt: serverTimestamp()
  });
}
window.syncTripSplitState = async ()=>{
  try { await syncStateToCloud(); }
  catch(err){ console.error("TripSplit cloud save failed",err); }
};

async function restoreCloudState(user){
  const snap=await getDoc(doc(db,"users",user.uid,"appState","main"));
  if(!snap.exists())return;
  const cloud=snap.data();
  const local=getLocalState();
  const merged={...local,...cloud,profile:cloud.profile || local.profile};
  saveLocalState(merged);
  window.location.reload();
}

async function googleLogin(){
  try{
    if(auth.currentUser){
      await signOut(auth);
      toast("Signed out of Google");
      return;
    }
    await signInWithPopup(auth,provider);
  }catch(err){
    console.error(err);
    if(err.code === "auth/popup-blocked") toast("Allow pop-ups for TripSplit and try again");
    else if(err.code === "auth/unauthorized-domain") toast("Add this website domain to Firebase Authorized domains");
    else toast("Google sign-in failed. Check Firebase Authentication → Google.");
  }
}

if(btn) btn.onclick=googleLogin;

onAuthStateChanged(auth, async user=>{
  setButton(user);
  if(!user)return;
  const profile={
    name:user.displayName || user.email?.split("@")[0] || "User",
    email:user.email || "",
    photoURL:user.photoURL || "",
    uid:user.uid
  };
  const state=getLocalState();
  state.profile=profile;
  saveLocalState(state);
  try{
    await setDoc(doc(db,"users",user.uid),{
      uid:user.uid,
      name:profile.name,
      email:profile.email,
      photoURL:profile.photoURL,
      updatedAt:serverTimestamp()
    },{merge:true});
    const hasLocalData=(state.trips?.length||0)||(state.quickSplits?.length||0);
    const snap=await getDoc(doc(db,"users",user.uid,"appState","main"));
    if(!hasLocalData && snap.exists()){
      await restoreCloudState(user);
      return;
    }
    await syncStateToCloud();
  }catch(err){
    console.error("Firebase profile/cloud sync failed",err);
    toast("Google login worked, but cloud sync needs Firestore rules");
  }
});
