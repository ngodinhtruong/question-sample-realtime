const io = require("socket.io-client");

const URL = "http://54.179.212.38:3000";
const PAGE_URL = "http://54.179.212.38:3000/receiver.html?sessionId=129305";
const TOTAL_USERS = 500;

let success = 0;
let failed = 0;
let totalLatency = 0;
let latencies = [];
let bytesSent = 0;

function getSessionIdFromUrl(url) {
  const match = url.match(/sessionId=(\d+)/);
  if (!match) throw new Error("No sessionId in URL");
  return match[1];
}

function generateQuestion(min = 300, max = 500) {
  const length = Math.floor(Math.random() * (max - min + 1)) + min;
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ";
  let result = "";

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
}

async function submitOneUser(i, SESSION_ID) {
  return new Promise((resolve) => {
    const startedAt = Date.now();

    const payload = {
      sessionId: SESSION_ID,
      name: "user_" + i,
      question: generateQuestion()
    };

    bytesSent += JSON.stringify(payload).length;

    const socket = io(URL, {
      transports: ["websocket"],
      timeout: 5000
    });

    let finished = false;

    function done(ok, reason = "") {
      if (finished) return;
      finished = true;

      const latency = Date.now() - startedAt;

      if (ok) {
        success++;
        latencies.push(latency);
        totalLatency += latency;
        console.log(`✅ user_${i} success - ${latency}ms`);
      } else {
        failed++;
        console.log(`❌ user_${i} failed - ${reason}`);
      }

      socket.disconnect();
      resolve();
    }

    socket.on("connect", () => {
      // Chờ server ACK rồi mới tính là success
      socket.emit("submit-question", payload, (response) => {
        if (response && response.success) {
          done(true);
        } else {
          done(false, "Server did not confirm submit-question");
        }
      });

      // timeout nếu server không ack
      setTimeout(() => {
        done(false, "Ack timeout");
      }, 5000);
    });

    socket.on("connect_error", (err) => {
      done(false, "connect_error: " + err.message);
    });

    socket.on("error", (err) => {
      done(false, "error: " + (err?.message || err));
    });
  });
}

async function runTest() {
  try {
    const SESSION_ID = getSessionIdFromUrl(PAGE_URL);
    console.log("🔥 Using sessionId:", SESSION_ID);

    const startTime = Date.now();

    const tasks = [];
    for (let i = 0; i < TOTAL_USERS; i++) {
      tasks.push(submitOneUser(i, SESSION_ID));
    }

    await Promise.all(tasks);

    const totalTime = (Date.now() - startTime) / 1000;
    const avgLatency = latencies.length
      ? (totalLatency / latencies.length).toFixed(2)
      : 0;

    const maxLatency = latencies.length ? Math.max(...latencies) : 0;
    const minLatency = latencies.length ? Math.min(...latencies) : 0;
    const rps = totalTime > 0 ? (success / totalTime).toFixed(2) : 0;

    console.log("\n===== LOAD TEST RESULT =====");
    console.log("🌐 URL:", URL);
    console.log("🆔 Session:", SESSION_ID);
    console.log("👥 Total Users:", TOTAL_USERS);
    console.log("⏱ Total Time:", totalTime.toFixed(2), "s");

    console.log("\n📊 RESULT:");
    console.log("✅ Success:", success);
    console.log("❌ Failed:", failed);

    console.log("\n⚡ PERFORMANCE:");
    console.log("🚀 Req/sec:", rps);
    console.log("📶 Avg Latency:", avgLatency, "ms");
    console.log("📉 Min Latency:", minLatency, "ms");
    console.log("📈 Max Latency:", maxLatency, "ms");

    console.log("\n🌐 NETWORK:");
    console.log("📦 Total Sent:", (bytesSent / 1024).toFixed(2), "KB");

    console.log("\n============================\n");
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

runTest();