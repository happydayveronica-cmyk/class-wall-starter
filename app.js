import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
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
// --- 교사로 지정할 이메일 목록 ---
// 여기에 등록된 계정으로 로그인하면 교사(teacher) 권한이 자동으로 부여됩니다.
const TEACHER_EMAILS = [
  "happydayveronica@gmail.com"
];

let currentUser = null;
let currentRole = "guest";       // 'teacher', 'student', 'guest'
let currentStatus = "pending";   // 'approved', 'pending'

// 사용자의 역할과 승인 상태를 불러옵니다
async function loadUserRole(user) {
  if (!user) {
    currentRole = "guest";
    currentStatus = "pending";
    return;
  }

  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    const isTeacherEmail = user.email && TEACHER_EMAILS.includes(user.email.toLowerCase());

    if (isTeacherEmail) {
      // 1) 지정된 교사 계정: 자동으로 교사 및 승인 상태 부여
      currentRole = "teacher";
      currentStatus = "approved";
      await setDoc(userRef, {
        role: "teacher",
        status: "approved",
        name: user.displayName || "선생님",
        email: user.email || ""
      }, { merge: true });
    } else if (userSnap.exists()) {
      // 2) 기존 사용자: Firestore에 저장된 역할과 승인 상태 확인
      const data = userSnap.data();
      currentRole = data.role || "student";
      currentStatus = data.status || "pending";
    } else {
      // 3) 새로운 학생: 기본적으로 '승인 대기(pending)' 상태로 등록
      currentRole = "student";
      currentStatus = "pending";
      await setDoc(userRef, {
        role: "student",
        status: "pending",
        name: user.displayName || "학생",
        email: user.email || "",
        createdAt: Date.now()
      });
    }
  } catch (error) {
    console.error("사용자 정보 조회 실패:", error);
    currentRole = "student";
    currentStatus = "pending";
  }
}

// 교사용: 학생 승인 처리 함수
async function approveStudent(studentId) {
  try {
    await updateDoc(doc(db, "users", studentId), {
      status: "approved"
    });
    alert("학생 승인이 완료되었습니다.");
    await renderTeacherPanel();
  } catch (error) {
    console.error("학생 승인 실패:", error);
    alert("학생 승인 처리에 실패했습니다.");
  }
}

// 교사용: 학생 승인 취소(대기) 처리 함수
async function revokeStudent(studentId) {
  try {
    await updateDoc(doc(db, "users", studentId), {
      status: "pending"
    });
    alert("학생 승인이 취소되었습니다.");
    await renderTeacherPanel();
  } catch (error) {
    console.error("학생 승인 취소 실패:", error);
    alert("승인 취소 처리에 실패했습니다.");
  }
}

// 교사용 학생 승인 관리 패널 렌더링
async function renderTeacherPanel() {
  const teacherPanel = document.getElementById("teacherPanel");
  const studentList = document.getElementById("studentList");
  const pendingCount = document.getElementById("pendingCount");

  if (!teacherPanel || !studentList) return;

  if (currentRole !== "teacher") {
    teacherPanel.style.display = "none";
    return;
  }

  teacherPanel.style.display = "block";
  studentList.innerHTML = "<p style='font-size:13px; color:#888;'>목록 불러오는 중...</p>";

  try {
    const usersSnapshot = await getDocs(collection(db, "users"));
    const students = [];
    usersSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.role === "student") {
        students.push({ id: docSnap.id, ...data });
      }
    });

    studentList.innerHTML = "";

    const pendingStudents = students.filter(s => s.status !== "approved");
    if (pendingCount) {
      pendingCount.textContent = "대기 " + pendingStudents.length + "명";
    }

    if (students.length === 0) {
      studentList.innerHTML = "<p style='font-size:13px; color:#888;'>가입한 학생이 없습니다.</p>";
      return;
    }

    students.forEach(student => {
      const item = document.createElement("div");
      item.className = "student-item";

      const info = document.createElement("div");
      info.className = "student-info";

      const name = document.createElement("span");
      name.textContent = student.name || "익명 학생";
      name.style.fontWeight = "600";

      const statusBadge = document.createElement("span");
      statusBadge.className = "student-status " + (student.status === "approved" ? "status-approved" : "status-pending");
      statusBadge.textContent = student.status === "approved" ? "승인됨" : "승인 대기";

      info.appendChild(name);
      info.appendChild(statusBadge);

      const actionBtn = document.createElement("button");
      if (student.status === "approved") {
        actionBtn.className = "btn-revoke";
        actionBtn.textContent = "승인 취소";
        actionBtn.onclick = () => revokeStudent(student.id);
      } else {
        actionBtn.className = "btn-approve";
        actionBtn.textContent = "승인하기";
        actionBtn.onclick = () => approveStudent(student.id);
      }

      item.appendChild(info);
      item.appendChild(actionBtn);
      studentList.appendChild(item);
    });
  } catch (error) {
    console.error("학생 목록 불러오기 실패:", error);
    studentList.innerHTML = "<p style='font-size:13px; color:#e03131;'>학생 목록을 불러오지 못했습니다.</p>";
  }
}

// 사용자 권한에 따라 화면 요소 제어
function updateUIByRole() {
  const writer = document.getElementById("writer");
  const approvalNotice = document.getElementById("approvalNotice");
  const teacherPanel = document.getElementById("teacherPanel");

  if (currentRole === "teacher") {
    if (writer) writer.style.display = "block";
    if (approvalNotice) approvalNotice.style.display = "none";
    if (teacherPanel) teacherPanel.style.display = "block";
    renderTeacherPanel();
  } else if (currentRole === "student") {
    if (teacherPanel) teacherPanel.style.display = "none";
    if (currentStatus === "approved") {
      // 승인된 학생
      if (writer) writer.style.display = "block";
      if (approvalNotice) approvalNotice.style.display = "none";
    } else {
      // 미승인 학생
      if (writer) writer.style.display = "none";
      if (approvalNotice) approvalNotice.style.display = "block";
    }
  } else {
    // 게스트
    if (writer) writer.style.display = "block";
    if (approvalNotice) approvalNotice.style.display = "none";
    if (teacherPanel) teacherPanel.style.display = "none";
  }
}

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
  if (!currentUser) {
      alert("로그인 후 메모를 작성할 수 있습니다. 상단의 Google 로그인을 먼저 해주세요.");
      return;
    }

    if (currentRole === "student" && currentStatus !== "approved") {
      alert("선생님의 승인 후 메모를 작성할 수 있습니다. 승인을 기다려 주세요.");
      return;
    }

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
