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
  await addDoc(memosCollection, {
    text: text,
    createdAt: Date.now()
  });
}

// 메모를 지웁니다.
// 백엔드 2: 지금은 누구든 남의 메모를 지울 수 있습니다. 이걸 막는 것이 과제입니다.
async function deleteMemo(id) {
  await deleteDoc(doc(db, "memos", id));
}


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

  const del = document.createElement("button");
  del.textContent = "×";
  del.addEventListener("click", async function () {
    try {
      await deleteMemo(memo.id);
      await render();
    } catch (error) {
      console.error("메모를 지우지 못했습니다.", error);
      alert("메모를 지우지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  });
  div.appendChild(del);

  const span = document.createElement("span");
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
render();
input.focus();
