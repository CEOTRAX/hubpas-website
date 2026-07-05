// Extracted JavaScript from admin.html for syntax validation
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js"
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  startAfter,
  getCountFromServer,
  getAggregateFromServer,
  sum
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js"

const firebaseConfig = {
  apiKey: "AIzaSyCMTs10x-2tnzivvx5PW7d9r3KdfncUKpo",
  authDomain: "dmap-50136.firebaseapp.com",
  projectId: "dmap-50136",
  storageBucket: "dmap-50136.firebasestorage.app",
  messagingSenderId: "695873306591",
  appId: "1:695873306591:web:c51485253a7c7d9849ce6a"
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

const els = {
  signoutBtn: document.getElementById('signout-btn'),
  loginForm: document.getElementById('login-form'),
  loginBtn: document.getElementById('login-btn'),
  email: document.getElementById('email'),
  password: document.getElementById('password'),
  loginError: document.getElementById('login-error'),
  authCard: document.getElementById('auth-card'),
  notAdmin: document.getElementById('not-admin'),
  app: document.getElementById('app'),
  side: document.getElementById('admin-side'),
  adminEmail: document.getElementById('admin-email'),
  viewTitle: document.getElementById('view-title'),
  viewSub: document.getElementById('view-sub'),
  viewOverview: document.getElementById('view-overview'),
  viewTable: document.getElementById('view-table'),
  viewRevenue: document.getElementById('view-revenue'),
  viewSettings: document.getElementById('view-settings'),
  mUsers: document.getElementById('m-users'),
  mEvents: document.getElementById('m-events'),
  mPurchases: document.getElementById('m-purchases'),
  mGross: document.getElementById('m-gross'),
  mCommission: document.getElementById('m-commission'),
  trendSub: document.getElementById('trend-sub'),
  sparkWrap: document.getElementById('spark-wrap'),
  topEvents: document.getElementById('top-events'),
  collPill: document.getElementById('coll-pill'),
  collHelp: document.getElementById('coll-help'),
  collTable: document.getElementById('coll-table'),
  collName: document.getElementById('coll-name'),
  collGo: document.getElementById('coll-go'),
  docId: document.getElementById('doc-id'),
  loadBtn: document.getElementById('load-btn'),
  newBtn: document.getElementById('new-btn'),
  createBtn: document.getElementById('create-btn'),
  prevBtn: document.getElementById('prev-btn'),
  nextBtn: document.getElementById('next-btn'),
  pageInfo: document.getElementById('page-info'),
  purchasesColl: document.getElementById('purchases-coll'),
  commissionRate: document.getElementById('commission-rate'),
  recalcBtn: document.getElementById('recalc-btn'),
  copyUidBtn: document.getElementById('copy-uid-btn'),
  uidText: document.getElementById('uid-text'),
  copyUidBtn2: document.getElementById('copy-uid-btn2'),
  uidText2: document.getElementById('uid-text2'),
  modal: document.getElementById('modal'),
  modalTitle: document.getElementById('modal-title'),
  modalSub: document.getElementById('modal-sub'),
  modalError: document.getElementById('modal-error'),
  json: document.getElementById('json'),
  saveBtn: document.getElementById('save-btn'),
  deleteBtn: document.getElementById('delete-btn'),
  resetBtn: document.getElementById('reset-btn'),
  formContainer: document.getElementById('form-container'),
  jsonContainer: document.getElementById('json-container'),
  formFields: document.getElementById('form-fields'),
  toggleJsonBtn: document.getElementById('toggle-json-btn'),
  toggleFormBtn: document.getElementById('toggle-form-btn')
}

const VIEWS = {
  overview: { title: 'Overview', sub: 'High-level insights across your platform.' },
  events: { title: 'Events', sub: 'Browse and edit event documents.' },
  users: { title: 'Users', sub: 'Browse and edit user profile documents (Firestore users collection).' },
  wallets: { title: 'Wallets', sub: 'Browse and edit wallet documents and balances.' },
  sponsors: { title: 'Sponsors', sub: 'Browse sponsor records and placements.' },
  chats: { title: 'Chats', sub: 'Browse chat threads and messages (Firestore).' },
  revenue: { title: 'Revenue', sub: 'Track gross revenue and commission performance.' },
  settings: { title: 'Settings', sub: 'Admin access and configuration.' }
}

const COLLECTIONS = {
  users: 'users',
  events: 'events',
  wallets: 'wallets',
  sponsors: 'sponsors',
  chats: 'chats'
}

let currentView = 'overview'
let currentCollectionKey = 'users'
let currentCollection = collection(db, COLLECTIONS.users)
let lastDoc = null
let hasMore = false
let editing = null
let currentUser = null
let purchasesCollectionName = localStorage.getItem('hubpas_admin_purchasesColl') || 'purchases'
let commissionRate = Number(localStorage.getItem('hubpas_admin_commissionRate') || '0.05')

// Test the problematic template literal
const key = 'test'
const error = 'test error'
console.log(`Error creating field for key "${key}": ${error}`)

console.log('JavaScript syntax validation passed!')