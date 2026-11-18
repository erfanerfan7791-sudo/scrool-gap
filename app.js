const rows = document.getElementById("rankingRows");
const form = document.getElementById("joinForm");
const message = document.getElementById("formMessage");
const button = document.getElementById("joinButton");

function showMessage(text, type = "") {
  message.textContent = text;
  message.className = `message ${type}`;
}

async function loadLeaderboard() {
  try {
    const [leaderboardResponse, statsResponse] = await Promise.all([
      fetch("/api/leaderboard"),
      fetch("/api/stats")
    ]);
    if (!leaderboardResponse.ok || !statsResponse.ok) throw new Error("خطا در دریافت داده‌ها");
    const leaderboard = await leaderboardResponse.json();
    const stats = await statsResponse.json();
    document.getElementById("memberCount").textContent = stats.memberCount.toLocaleString("fa-IR");
    rows.replaceChildren();

    if (!leaderboard.members.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 4;
      td.className = "empty";
      td.textContent = "هنوز عضوی ثبت نشده؛ اولین نفر باش!";
      tr.appendChild(td);
      rows.appendChild(tr);
      return;
    }

    leaderboard.members.forEach((member, index) => {
      const tr = document.createElement("tr");
      const values = [
        index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : (index + 1).toLocaleString("fa-IR"),
        member.name,
        member.eitaaId,
        Number(member.points).toLocaleString("fa-IR")
      ];
      values.forEach(value => {
        const td = document.createElement("td");
        td.textContent = value;
        tr.appendChild(td);
      });
      rows.appendChild(tr);
    });
  } catch (error) {
    rows.innerHTML = '<tr><td colspan="4" class="empty">فعلاً اتصال به دیتابیس برقرار نیست. تنظیمات سرور را بررسی کن.</td></tr>';
    document.getElementById("memberCount").textContent = "—";
  }
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  const name = document.getElementById("memberName").value.trim();
  const eitaaId = document.getElementById("memberId").value.trim();
  button.disabled = true;
  button.textContent = "در حال ثبت…";
  showMessage("");

  try {
    const response = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, eitaaId })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "ثبت‌نام انجام نشد.");
    form.reset();
    showMessage("ثبت‌نامت با موفقیت انجام شد ❤️", "success");
    await loadLeaderboard();
  } catch (error) {
    showMessage(error.message || "خطایی رخ داد.", "error");
  } finally {
    button.disabled = false;
    button.textContent = "ثبت‌نام";
  }
});

loadLeaderboard();
