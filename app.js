import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA7aenT69jFp56LZwtAGOkqYew3VgVCB9E",
  authDomain: "class-wall-e4b66.firebaseapp.com",
  projectId: "class-wall-e4b66",
  storageBucket: "class-wall-e4b66.firebasestorage.app",
  messagingSenderId: "600192168603",
  appId: "1:600192168603:web:265d006c7b6923085c4c3e"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const memosCollection = collection(db, "memos");
const auth = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();
let currentUser = null;

// ===================================================
// 우리 반 담벼락 - 시작점
//
// 메모를 쓰면 올린 순서대로 담벼락에 붙습니다.
// 지금은 데이터가 아래 배열에만 들어 있어서,
// 브라우저를 새로고침하면 전부 사라집니다.
// ===================================================


// --- 메모 목록 ---
// createdAt 은 메모를 쓴 시각(밀리초)입니다. 이 값으로 순서를 정합니다.
let memos = [];


// ===================================================
// 데이터를 다루는 함수 세 개
// 백엔드 1 시간에 이 세 개가 Firestore를 쓰는 코드로 바뀝니다.
// ===================================================

// 메모를 읽어 옵니다.
// 백엔드 1: 여기가 Firestore에서 가져오는 코드로 바뀝니다.
//           순서는 orderBy("createdAt") 으로 맞춥니다.
async function loadMemos() {
  const memosQuery = query(memosCollection, orderBy("createdAt", "asc"));
  const snapshot = await getDocs(memosQuery);

  memos = snapshot.docs.map(function (memoDoc) {
    return {
      id: memoDoc.id,
      ...memoDoc.data()
    };
  });

  return memos;
}

// 메모를 새로 씁니다.
// 백엔드 2: 여기에 "누가 썼는지"(uid)를 함께 저장하게 됩니다.
async function addMemo(text) {
  // 5글자 이상일 때만 저장되도록 확인합니다.
  if (text.length < 5) {
    throw new Error("메모는 5글자 이상이어야 합니다.");
  }

  const memoData = {
    text: text,
    createdAt: Date.now(),
    userName: currentUser ? (currentUser.displayName || "익명") : "익명"
  };

  if (currentUser && currentUser.uid) {
    memoData.uid = currentUser.uid;
  }

  await addDoc(memosCollection, memoData);
}

// 메모를 지웁니다.
// 백엔드 2: 지금은 누구든 남의 메모를 지울 수 있습니다. 이걸 막는 것이 과제입니다.
async function deleteMemo(id) {
  await deleteDoc(doc(db, "memos", id));
}


// ===================================================
// 로그인 및 사용자 영역
// ===================================================

const userArea = document.getElementById("userArea");

// 사용자 영역을 그립니다 (로그인/로그아웃 버튼)
function renderUserArea() {
  if (!userArea) return;
  userArea.innerHTML = "";

  if (currentUser) {
    // 로그인 상태: 사용자 뱃지와 로그아웃 버튼
    const badge = document.createElement("span");
    badge.className = "user-badge";
    badge.textContent = (currentUser.displayName || "선생님") + "님";

    const logoutButton = document.createElement("button");
    logoutButton.textContent = "로그아웃";
    logoutButton.onclick = async function () {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("로그아웃 실패:", error);
        alert("로그아웃 중 오류가 발생했습니다.");
      }
    };

    userArea.appendChild(badge);
    userArea.appendChild(logoutButton);
  } else {
    // 로그아웃 상태: Google 로그인 버튼
    const loginButton = document.createElement("button");
    loginButton.textContent = "Google 로그인";
    loginButton.onclick = async function () {
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (error) {
        console.error("로그인 실패:", error);
        alert("로그인에 실패했습니다. 팝업 차단 여부를 확인해 주세요.");
      }
    };

    userArea.appendChild(loginButton);
  }
}

// 로그인 상태 변경 감지
onAuthStateChanged(auth, function (user) {
  currentUser = user;
  renderUserArea();
});


// ===================================================
// 화면 그리기
// ===================================================

async function render() {
  const wall = document.getElementById("wall");
  wall.innerHTML = "";

  try {
    const loadedMemos = await loadMemos();
    loadedMemos.forEach(function (memo) {
      wall.appendChild(makeMemo(memo));
    });
  } catch (error) {
    console.error("메모를 불러오지 못했습니다.", error);
    wall.textContent = "메모를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }
}

// 메모 한 장 만들기
function makeMemo(memo) {
  const div = document.createElement("div");
  div.className = "memo";

  // 상단 헤더: 작성자 및 삭제 버튼
  const header = document.createElement("div");
  header.className = "memo-header";

  const authorDiv = document.createElement("div");
  authorDiv.className = "author";

  const dot = document.createElement("span");
  dot.className = "author-dot";
  authorDiv.appendChild(dot);

  const name = document.createElement("span");
  name.textContent = memo.userName || "익명";
  authorDiv.appendChild(name);
  header.appendChild(authorDiv);

  const del = document.createElement("button");
  del.className = "del-btn";
  del.textContent = "×";
  del.title = "삭제";
  del.addEventListener("click", async function () {
    try {
      await deleteMemo(memo.id);
      await render();
    } catch (error) {
      console.error("메모를 지우지 못했습니다.", error);
      alert("메모를 지우지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  });
  header.appendChild(del);
  div.appendChild(header);

  // 메모 본문
  const span = document.createElement("span");
  span.className = "memo-text";
  span.textContent = memo.text;
  div.appendChild(span);

  return div;
}


// ===================================================
// 메모 쓰는 칸
// 엔터를 누르면 담벼락에 붙습니다 (줄바꿈은 Shift + 엔터)
// ===================================================

const input = document.getElementById("input");

input.addEventListener("keydown", async function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();

    const text = input.value.trim();
    if (text === "") return;

    // 5글자 이상 입력 확인
    if (text.length < 5) {
      alert("메모를 5글자 이상 입력해 주세요.");
      return;
    }

    try {
      await addMemo(text);
      input.value = "";
      await render();
    } catch (error) {
      console.error("메모를 저장하지 못했습니다.", error);
      alert("메모를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  }
});


// 첫 화면 그리기
renderUserArea();
render();
input.focus();
