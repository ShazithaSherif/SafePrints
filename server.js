const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 30e6 });

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || "safeprint123";
const STATS_FILE = path.join(__dirname, "stats.json");

let stats = {
  totalVisits: 0,
  totalPrintsCompleted: 0,
  totalPagesSecured: 0,
};
if (fs.existsSync(STATS_FILE)) {
  stats = JSON.parse(fs.readFileSync(STATS_FILE, "utf8"));
}

function saveStats() {
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
}

app.use(
  "/vendor/html5-qrcode.min.js",
  express.static(path.join(__dirname, "node_modules", "html5-qrcode", "html5-qrcode.min.js"))
);

app.get(["/", "/print"], (req, res) => {
  stats.totalVisits += 1;
  saveStats();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get(["/shop", "/counter"], (req, res) => {
  stats.totalVisits += 1;
  saveStats();
  res.sendFile(path.join(__dirname, "public", "shop.html"));
});

app.get(["/admin", "/stats"], (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(403).send("Access Denied. Invalid Admin Key.");
  }
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.use(express.static(path.join(__dirname, "public")));

const activeShops = {};

function generateFourDigitCode() {
  let code;
  do {
    code = Math.floor(1000 + Math.random() * 9000).toString();
  } while (activeShops[code]);
  return code;
}

function broadcastAdminStats() {
  const activeShopCount = Object.keys(activeShops).length;
  const activeCustomerCount = Object.values(activeShops).filter(
    (s) => s.customerSocketId !== null
  ).length;

  io.to("admin-room").emit("stats-update", {
    ...stats,
    activeShops: activeShopCount,
    activeCustomers: activeCustomerCount,
  });
}

io.on("connection", (socket) => {
  socket.on("join-admin", (key) => {
    if (key === ADMIN_KEY) {
      socket.join("admin-room");
      broadcastAdminStats();
    }
  });

  socket.on("register-shop", async () => {
    const code = generateFourDigitCode();
    activeShops[code] = {
      shopSocketId: socket.id,
      customerSocketId: null,
      pendingJob: null,
    };
    socket.shopCode = code;

    const host = socket.handshake.headers.host || `localhost:${PORT}`;
    const protocol = host.includes("localhost") ? "http" : "https";
    const pairUrl = `${protocol}://${host}/?code=${code}`;
    const qrDataUrl = await QRCode.toDataURL(pairUrl, { width: 150, margin: 1 });

    socket.emit("shop-code-assigned", { code, qrDataUrl });
    broadcastAdminStats();
  });

  socket.on("pair-with-shop", (enteredCode) => {
    const code = String(enteredCode).trim();
    const shop = activeShops[code];

    if (!shop) {
      return socket.emit("pair-error", "Invalid or expired QR/PIN! Refresh counter screen.");
    }
    if (shop.customerSocketId && shop.customerSocketId !== socket.id) {
      return socket.emit("pair-error", "Another customer is currently connected to this counter.");
    }

    shop.customerSocketId = socket.id;
    socket.pairedShopCode = code;

    socket.emit("pair-success", code);
    io.to(shop.shopSocketId).emit("customer-connected");
    broadcastAdminStats();
  });

  socket.on("submit-encrypted-job", (jobData) => {
    const code = socket.pairedShopCode;
    const shop = activeShops[code];
    if (!shop) return;

    shop.pendingJob = jobData;

    clearTimeout(shop.expiryTimer);
    shop.expiryTimer = setTimeout(() => {
      if (activeShops[code] && activeShops[code].pendingJob) {
        activeShops[code].pendingJob = null;
        io.to(shop.shopSocketId).emit("job-expired");
        socket.emit("job-expired");
      }
    }, 180000);

    io.to(shop.shopSocketId).emit("job-ready-for-approval", {
      fileCount: jobData.fileCount || 1,
      copies: jobData.copies,
      colorMode: jobData.colorMode,
    });

    socket.emit("job-waiting-approval");
  });

  socket.on("approve-print", () => {
    const code = socket.shopCode;
    const shop = activeShops[code];
    if (!shop || !shop.pendingJob) return;

    const jobToRelease = shop.pendingJob;
    shop.pendingJob = null;
    clearTimeout(shop.expiryTimer);

    socket.emit("execute-silent-print", jobToRelease);
  });

  socket.on("print-completed-and-wiped", (totalItemsPrinted) => {
    const code = socket.shopCode;
    const shop = activeShops[code];

    stats.totalPrintsCompleted += 1;
    stats.totalPagesSecured += Number(totalItemsPrinted) || 1;
    saveStats();
    broadcastAdminStats();

    if (shop && shop.customerSocketId) {
      io.to(shop.customerSocketId).emit("print-wiped-confirmed");
    }
  });

  socket.on("revoke-job", () => {
    const code = socket.pairedShopCode;
    const shop = activeShops[code];
    if (shop) {
      shop.pendingJob = null;
      clearTimeout(shop.expiryTimer);
      io.to(shop.shopSocketId).emit("job-revoked");
      socket.emit("job-revoked");
    }
  });

  socket.on("disconnect", () => {
    if (socket.shopCode && activeShops[socket.shopCode]) {
      const customerId = activeShops[socket.shopCode].customerSocketId;
      if (customerId) io.to(customerId).emit("shop-disconnected");
      clearTimeout(activeShops[socket.shopCode].expiryTimer);
      delete activeShops[socket.shopCode];
    }
    if (socket.pairedShopCode && activeShops[socket.pairedShopCode]) {
      const shop = activeShops[socket.pairedShopCode];
      shop.customerSocketId = null;
      shop.pendingJob = null;
      io.to(shop.shopSocketId).emit("customer-disconnected");
    }
    broadcastAdminStats();
  });
});

server.listen(PORT, () => {
  console.log(`SafePrints running on port ${PORT}`);
});
