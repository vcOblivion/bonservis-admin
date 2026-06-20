import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  collection,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  updateDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAKWAEYepx0PdQt2kWv_jXizRoX3h4OXJo",
  authDomain: "bonservis-43b06.firebaseapp.com",
  projectId: "bonservis-43b06",
  storageBucket: "bonservis-43b06.firebasestorage.app",
  messagingSenderId: "1078264725921",
  appId: "1:1078264725921:web:9c251fabecd9ad2ae18be0",
};

const $ = (selector) => document.querySelector(selector);

const loginView = $("#login-view");
const panelView = $("#panel-view");
const loginForm = $("#login-form");
const loginError = $("#login-error");
const searchInput = $("#search");
const statusText = $("#status");
const countText = $("#count");
const newsList = $("#news-list");
const configWarning = $("#config-warning");

let auth = null;
let db = null;
let allNews = [];

const configMissing = Object.values(firebaseConfig).some((value) =>
  String(value).startsWith("PASTE_"),
);

if (configMissing) {
  loginForm.querySelector("button").disabled = true;
  loginError.textContent = "Firebase Web App config girilmeden panel acilmaz.";
  configWarning.textContent =
    "admin/app.js icindeki firebaseConfig degerlerini Firebase Console Web App config ile degistir.";
  configWarning.classList.remove("hidden");
} else {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  onAuthStateChanged(auth, async (user) => {
    loginView.classList.toggle("hidden", Boolean(user));
    panelView.classList.toggle("hidden", !user);
    if (user) {
      await loadNews();
    }
  });
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!auth) return;

  loginError.textContent = "";
  const submitButton = loginForm.querySelector("button");
  submitButton.disabled = true;

  try {
    await signInWithEmailAndPassword(
      auth,
      $("#email").value.trim(),
      $("#password").value,
    );
  } catch (error) {
    loginError.textContent = humanAuthError(error);
  } finally {
    submitButton.disabled = false;
  }
});

$("#sign-out").addEventListener("click", () => {
  if (auth) {
    signOut(auth);
  }
});

$("#refresh").addEventListener("click", loadNews);
searchInput.addEventListener("input", renderNews);

async function loadNews() {
  if (!db) return;

  statusText.textContent = "Yukleniyor...";
  countText.textContent = "";
  newsList.textContent = "";

  try {
    const newsQuery = query(
      collection(db, "news"),
      orderBy("publishedAt", "desc"),
      limit(150),
    );
    const snapshot = await getDocs(newsQuery);
    allNews = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }));
    statusText.textContent = "Hazir";
    renderNews();
  } catch (error) {
    statusText.textContent = "Haberler alinamadi";
    newsList.textContent = error.message;
  }
}

function renderNews() {
  const term = normalize(searchInput.value);
  const items = allNews.filter((item) => matchesSearch(item, term));
  newsList.textContent = "";
  countText.textContent = `${items.length} / ${allNews.length}`;

  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "notice";
    empty.textContent = "Sonuc yok.";
    newsList.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const item of items) {
    fragment.append(createNewsRow(item));
  }
  newsList.append(fragment);
}

function createNewsRow(item) {
  const row = document.createElement("article");
  row.className = "news-row";

  const main = document.createElement("div");
  main.className = "row-main";

  const title = document.createElement("p");
  title.className = "title";
  title.textContent = item.title || "Baslik yok";

  const meta = document.createElement("div");
  meta.className = "row-meta";
  meta.append(
    pill(item.sourceName || item.source || "Kaynak yok"),
    pill(relativeTime(item.publishedAt)),
    pill(formatTeams(item.relatedTeams)),
    pill(item.hidden === true ? "Gizli" : "Gorunur", item.hidden === true),
  );

  main.append(title, meta);

  const actions = document.createElement("div");
  actions.className = "row-actions";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = item.hidden === true ? "secondary" : "";
  toggle.textContent = item.hidden === true ? "Goster" : "Gizle";
  toggle.addEventListener("click", () => setHidden(item, item.hidden !== true));

  actions.append(toggle);
  row.append(main, actions);
  return row;
}

function pill(text, hiddenState = null) {
  const element = document.createElement("span");
  element.className = "pill";
  if (hiddenState === true) element.classList.add("hidden-state");
  if (hiddenState === false) element.classList.add("visible");
  element.textContent = text;
  return element;
}

async function setHidden(item, hidden) {
  const buttons = [...newsList.querySelectorAll("button")];
  buttons.forEach((button) => {
    button.disabled = true;
  });

  try {
    await updateDoc(doc(db, "news", item.id), { hidden });
    item.hidden = hidden;
    statusText.textContent = hidden ? "Haber gizlendi" : "Haber gosterildi";
    renderNews();
  } catch (error) {
    statusText.textContent = `Guncellenemedi: ${error.message}`;
  } finally {
    buttons.forEach((button) => {
      button.disabled = false;
    });
  }
}

function matchesSearch(item, term) {
  if (!term) return true;
  return [
    item.title,
    item.aiSummary,
    item.playerName,
    item.sourceName,
    item.source,
    ...(Array.isArray(item.relatedTeams) ? item.relatedTeams : []),
  ].some((value) => normalize(value).includes(term));
}

function normalize(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR");
}

function formatTeams(teams) {
  if (!Array.isArray(teams) || teams.length === 0) {
    return "Takim yok";
  }
  return teams.slice(0, 4).join(", ");
}

function relativeTime(value) {
  const date = toDate(value);
  if (!date) return "Tarih yok";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 1) return "simdi";
  if (diffMinutes < 60) return `${diffMinutes} dk once`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} sa once`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays} gun once`;

  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function humanAuthError(error) {
  switch (error.code) {
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "E-posta veya sifre hatali.";
    case "auth/too-many-requests":
      return "Cok fazla deneme yapildi. Biraz bekle.";
    default:
      return error.message || "Giris yapilamadi.";
  }
}
