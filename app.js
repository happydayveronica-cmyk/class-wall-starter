import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  setDoc,
  updateDoc
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

// ===================================================
// 교사 계정 지정 및 권한 관리
// ===================================================

// 여기에 등록된 이메일로 로그인하면 교사(teacher) 권한이 자동으로 부여됩니다.
const TEACHER_EMAILS = [
  "happydayveronica@gmail.com"
];

let currentUser = null;
let currentRole = "guest";       // 'teacher', 'student', 'guest'
let currentStatus = "pending";   // 'approved', 'pending'

// 사용자의 역할(교사/학생)과 승인 상태를 불러옵니다
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
      // 2) 기존 가입된 사용자: Firestore의 역할 및 승인 상태 확인
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
    console.error("사용자 정보를 불러오지 못했습니다.", error);
    currentRole = "student";
    currentStatus = "pending";
  }
}

// 교사용: 학생 가입 승인 처리
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

// 교사용: 학생 가입 승인 취소(대기) 처리
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

// 교사용 학생 승인 관리 패널 그리기
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
  studentList.innerHTML = "<p style='font-size:13px; color:#888;'>학생 목록을 불러오는 중...</p>";

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

// 사용자 권한 상태에 따른 UI 요소 제어
function updateUIByRole() {
  const writer = document.getElementById("writer");
  const approvalNotice = document.getElementById("approvalNotice");
  const teacherPanel = document.getElementById("teacherPanel");

  if (currentRole === "teacher") {
    // 교사: 모든 권한 및 관리자 패널 표시
    if (writer) writer.style.display = "block";
    if (approvalNotice) approvalNotice.style.display = "none";
    if (teacherPanel) teacherPanel.style.display = "block";
    renderTeacherPanel();
  } else if (currentRole === "student") {
    // 학생
    if (teacherPanel) teacherPanel.style.display = "none";
    if (currentStatus === "approved") {
      // 승인된 학생: 작성 가능
      if (writer) writer.style.display = "block";
      if (approvalNotice) approvalNotice.style.display = "none";
    } else {
      // 미승인 학생: 작성 불가 및 대기 안내 표시
      if (writer) writer.style.display = "none";
      if (approvalNotice) approvalNotice.style.display = "block";
    }
  } else {
    // 비로그인 사용자
    if (writer) writer.style.display = "block";
    if (approvalNotice) approvalNotice.style.display = "none";
    if (teacherPanel) teacherPanel.style.display = "none";
  }
}


// ===================================================
// 우리 반 담벼락 - 시작점
// ===================================================

let memos = [];

// 메모를 읽어 옵니다.
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
async function addMemo(text) {
  if (!currentUser) {
    throw new Error("로그인한 사용자만 메모를 작성할 수 있습니다.");
  }

  // 학생인 경우 교사의 승인을 받았는지 검사
  if (currentRole === "student" && currentStatus !== "approved") {
    throw new Error("선생님의 승인을 받은 학생만 메모를 작성할 수 있습니다.");
  }

  // 5글자 이상일 때만 저장되도록 확인합니다
  if (text.length < 5) {
    throw new Error("메모는 5글자 이상이어야 합니다.");
  }

  const memoData = {
    text: text,
    createdAt: Date.now(),
    userName: currentUser.displayName || "익명",
    uid: currentUser.uid
  };

  await addDoc(memosCollection, memoData);
}

// 메모를 지웁니다.
async function deleteMemo(id) {
  await deleteDoc(doc(db, "memos", id));
}


// ===================================================
// 로그인 및 사용자 영역 그리기
// ===================================================

const userArea = document.getElementById("userArea");

function renderUserArea() {
  if (!userArea) return;
  userArea.innerHTML = "";

  if (currentUser) {
    // 역할 뱃지 표시
    const roleBadge = document.createElement("span");
    roleBadge.className = "user-badge";
    roleBadge.style.marginRight = "6px";
    if (currentRole === "teacher") {
      roleBadge.textContent = "👨‍🏫 교사 (teacher)";
      roleBadge.style.backgroundColor = "#e8f3ff";
      roleBadge.style.color = "#1b64da";
    } else if (currentStatus === "approved") {
      roleBadge.textContent = "🎒 학생 (승인됨)";
      roleBadge.style.backgroundColor = "#d3f9d8";
      roleBadge.style.color = "#2b8a3e";
    } else {
      roleBadge.textContent = "⏳ 학생 (승인 대기)";
      roleBadge.style.backgroundColor = "#fff3bf";
      roleBadge.style.color = "#d9480f";
    }

    // 사용자 이름
    const nameSpan = document.createElement("span");
    nameSpan.textContent = (currentUser.displayName || "사용자") + "님";
    nameSpan.style.marginRight = "8px";
    nameSpan.style.fontWeight = "600";

    // 로그아웃 버튼
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

    userArea.appendChild(roleBadge);
    userArea.appendChild(nameSpan);
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
onAuthStateChanged(auth, async function (user) {
  currentUser = user;
  if (user) {
    await loadUserRole(user);
  } else {
    currentRole = "guest";
    currentStatus = "pending";
  }
  renderUserArea();
  updateUIByRole();
  render();
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

  // 교사(teacher)만 삭제할 수 있습니다
  if (currentRole === "teacher") {
    const del = document.createElement("button");
    del.className = "del-btn";
    del.textContent = "×";
    del.title = "삭제 (교사 전용 권한)";
    del.addEventListener("click", async function () {
      try {
        await deleteMemo(memo.id);
        await render();
      } catch (error) {
        console.error("메모를 지우지 못했습니다.", error);
        alert("메모를 지우지 못했습니다. 교사 권한이 필요합니다.");
      }
    });
    header.appendChild(del);
  }

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
// ===================================================

const input = document.getElementById("input");

input.addEventListener("keydown", async function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();

    const text = input.value.trim();
    if (text === "") return;

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
updateUIByRole();
render();
input.focus();


// ===================================================
// 담벼락 하단 분필 피하기 게임
// ===================================================

const gameCanvas = document.getElementById("chalkGame");
const gameContext = gameCanvas.getContext("2d");
const gameOverlay = document.getElementById("gameOverlay");
const gameStartButton = document.getElementById("gameStartButton");
const gameMessageTitle = document.getElementById("gameMessageTitle");
const gameMessageText = document.getElementById("gameMessageText");
const currentScore = document.getElementById("currentScore");
const bestScore = document.getElementById("bestScore");
const moveLeftButton = document.getElementById("moveLeft");
const moveRightButton = document.getElementById("moveRight");
const rabbitImage = new Image();
rabbitImage.src = "assets/rabbit-player.png";

const gameKeys = { left: false, right: false };
const rabbit = { x: 382, y: 310, width: 76, height: 96, speed: 380 };
let chalks = [];
let gameRunning = false;
let gameAnimation = null;
let lastFrameTime = 0;
let chalkTimer = 0;
let gameScore = 0;
let highScore = 0;

// 게임판의 칠판 배경과 토끼를 그립니다.
function drawGame() {
  gameContext.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
  gameContext.fillStyle = "#174a3a";
  gameContext.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

  gameContext.strokeStyle = "rgba(255, 255, 255, 0.07)";
  gameContext.lineWidth = 2;
  for (let x = 140; x < gameCanvas.width; x += 140) {
    gameContext.beginPath();
    gameContext.moveTo(x, 0);
    gameContext.lineTo(x, gameCanvas.height);
    gameContext.stroke();
  }

  chalks.forEach(function (chalk) {
    gameContext.save();
    gameContext.translate(chalk.x + chalk.width / 2, chalk.y + chalk.height / 2);
    gameContext.rotate(chalk.angle);
    gameContext.fillStyle = chalk.color;
    gameContext.shadowColor = "rgba(0, 0, 0, 0.25)";
    gameContext.shadowBlur = 5;
    gameContext.fillRect(-chalk.width / 2, -chalk.height / 2, chalk.width, chalk.height);
    gameContext.restore();
  });

  if (rabbitImage.complete) {
    gameContext.drawImage(rabbitImage, rabbit.x, rabbit.y, rabbit.width, rabbit.height);
  }
}

// 분필과 토끼가 닿았는지 여유 있게 확인합니다.
function isChalkHit(chalk) {
  const padding = 12;
  return chalk.x < rabbit.x + rabbit.width - padding &&
    chalk.x + chalk.width > rabbit.x + padding &&
    chalk.y < rabbit.y + rabbit.height - padding &&
    chalk.y + chalk.height > rabbit.y + padding;
}

function finishChalkGame() {
  gameRunning = false;
  cancelAnimationFrame(gameAnimation);
  highScore = Math.max(highScore, Math.floor(gameScore));
  bestScore.textContent = "최고 " + highScore;
  gameMessageTitle.textContent = "분필에 맞았어요!";
  gameMessageText.textContent = "이번 점수는 " + Math.floor(gameScore) + "점이에요. 다시 도전해 보세요.";
  gameStartButton.textContent = "다시 하기";
  gameOverlay.hidden = false;
}

function addFallingChalk() {
  const colors = ["#ffffff", "#ffd43b", "#74c0fc", "#ffa8a8"];
  chalks.push({
    x: Math.random() * (gameCanvas.width - 42),
    y: -40,
    width: 14,
    height: 38,
    speed: 190 + Math.min(gameScore * 2, 190) + Math.random() * 70,
    angle: (Math.random() - 0.5) * 0.8,
    color: colors[Math.floor(Math.random() * colors.length)]
  });
}

// 매 화면마다 토끼와 분필의 위치를 계산합니다.
function updateChalkGame(time) {
  if (!gameRunning) return;
  const delta = Math.min((time - lastFrameTime) / 1000, 0.04);
  lastFrameTime = time;

  if (gameKeys.left) rabbit.x -= rabbit.speed * delta;
  if (gameKeys.right) rabbit.x += rabbit.speed * delta;
  rabbit.x = Math.max(0, Math.min(gameCanvas.width - rabbit.width, rabbit.x));

  chalkTimer -= delta;
  if (chalkTimer <= 0) {
    addFallingChalk();
    chalkTimer = Math.max(0.28, 0.82 - gameScore / 180);
  }

  chalks.forEach(function (chalk) { chalk.y += chalk.speed * delta; });
  if (chalks.some(isChalkHit)) {
    drawGame();
    finishChalkGame();
    return;
  }

  chalks = chalks.filter(function (chalk) { return chalk.y < gameCanvas.height + 50; });
  gameScore += delta * 10;
  currentScore.textContent = "점수 " + Math.floor(gameScore);
  drawGame();
  gameAnimation = requestAnimationFrame(updateChalkGame);
}

function startChalkGame() {
  chalks = [];
  rabbit.x = (gameCanvas.width - rabbit.width) / 2;
  gameScore = 0;
  chalkTimer = 0.7;
  currentScore.textContent = "점수 0";
  gameOverlay.hidden = true;
  gameRunning = true;
  lastFrameTime = performance.now();
  gameAnimation = requestAnimationFrame(updateChalkGame);
}

function setMoveKey(direction, pressed) {
  gameKeys[direction] = pressed;
}

window.addEventListener("keydown", function (event) {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    if (gameRunning) event.preventDefault();
    setMoveKey(event.key === "ArrowLeft" ? "left" : "right", true);
  }
});

window.addEventListener("keyup", function (event) {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    setMoveKey(event.key === "ArrowLeft" ? "left" : "right", false);
  }
});

function connectMoveButton(button, direction) {
  button.addEventListener("pointerdown", function (event) {
    event.preventDefault();
    setMoveKey(direction, true);
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener("pointerup", function () { setMoveKey(direction, false); });
  button.addEventListener("pointercancel", function () { setMoveKey(direction, false); });
}

if (gameCanvas) {
  rabbitImage.addEventListener("load", drawGame);
  gameStartButton.addEventListener("click", startChalkGame);
  connectMoveButton(moveLeftButton, "left");
  connectMoveButton(moveRightButton, "right");
  drawGame();
}
