const util = require("../../node_modules/util/util.js");

// Axios in cicero-core expects util.TextEncoder/TextDecoder constructors.
if (typeof globalThis.TextEncoder === "function" && typeof util.TextEncoder !== "function") {
  util.TextEncoder = globalThis.TextEncoder;
}

if (typeof globalThis.TextDecoder === "function" && typeof util.TextDecoder !== "function") {
  util.TextDecoder = globalThis.TextDecoder;
}

module.exports = util;
module.exports.default = util;
