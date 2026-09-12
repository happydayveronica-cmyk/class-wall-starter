const TEACHER_EMAILS = [
  "happydayveronica@gmail.com"
];

// Firebase 로그인 토큰을 확인해 실제 교사 계정인지 검사합니다.
async function verifyTeacher(idToken) {
  const firebaseApiKey = process.env.FIREBASE_API_KEY;
  if (!firebaseApiKey) {
    throw new Error("FIREBASE_API_KEY 환경변수가 필요합니다.");
  }

  const response = await fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(firebaseApiKey),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: idToken })
    }
  );

  if (!response.ok) return false;
  const data = await response.json();
  const email = data.users && data.users[0] && data.users[0].email;
  return Boolean(email && TEACHER_EMAILS.includes(email.toLowerCase()));
}

// OpenAI 응답에서 최종 텍스트만 안전하게 꺼냅니다.
function getResponseText(data) {
  if (typeof data.output_text === "string") return data.output_text.trim();

  const texts = [];
  (data.output || []).forEach(function (item) {
    (item.content || []).forEach(function (content) {
      if (content.type === "output_text" && content.text) texts.push(content.text);
    });
  });
  return texts.join("\n").trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST 요청만 사용할 수 있습니다." });
  }

  try {
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!idToken || !(await verifyTeacher(idToken))) {
      return res.status(403).json({ error: "교사 계정만 AI 코멘트를 만들 수 있습니다." });
    }

    const memoText = typeof req.body?.memoText === "string" ? req.body.memoText.trim() : "";
    if (memoText.length < 5 || memoText.length > 500) {
      return res.status(400).json({ error: "게시물 내용을 확인해 주세요." });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return res.status(500).json({ error: "OPENAI_API_KEY 환경변수가 필요합니다." });
    }

    // uid나 이메일은 보내지 않고 게시물 본문만 OpenAI에 전달합니다.
    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + openaiApiKey
      },
      body: JSON.stringify({
        model: "gpt-5-nano",
        instructions: "당신은 초등·중등 교실 담벼락의 따뜻한 AI 선생님입니다. 게시물의 좋은 점을 먼저 구체적으로 짚고, 생각을 넓히는 질문이나 제안 하나를 덧붙이세요. 평가하거나 꾸짖지 말고, 쉬운 한국어로 2문장 이내로 작성하세요. 개인정보를 추측하거나 언급하지 마세요.",
        input: memoText,
        max_output_tokens: 160,
        store: false
      })
    });

    const data = await openaiResponse.json();
    if (!openaiResponse.ok) {
      console.error("OpenAI API 오류:", data.error?.message || openaiResponse.status);
      return res.status(502).json({ error: "AI 서비스 응답을 받지 못했습니다." });
    }

    const comment = getResponseText(data);
    if (!comment) {
      return res.status(502).json({ error: "AI 코멘트가 비어 있습니다." });
    }

    return res.status(200).json({ comment: comment.slice(0, 500) });
  } catch (error) {
    console.error("AI 코멘트 처리 오류:", error.message);
    return res.status(500).json({ error: "AI 코멘트를 처리하는 중 오류가 발생했습니다." });
  }
}
