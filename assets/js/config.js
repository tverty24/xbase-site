// Address of the xbase-server backend (see /server).
// - On localhost or a LAN IP (previewing on this PC or a phone on the same Wi-Fi),
//   it points at port 8080 on that same host, so local testing needs no editing here.
// - Everywhere else (the live site), it points at the deployed backend URL below —
//   update PROD_API_BASE once you know your Render service's URL.
(function () {
  var PROD_API_BASE = "https://xbase-server.onrender.com";
  var host = window.location.hostname;
  var isLocal = host === "localhost" || host === "127.0.0.1" ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host);
  window.XBASE_API_BASE = isLocal ? "http://" + host + ":8080" : PROD_API_BASE;
})();
