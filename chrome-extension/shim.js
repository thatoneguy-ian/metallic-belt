/**
 * shim.js - Injected into the D&D Beyond main world context.
 * Provides a pure JavaScript fallback shim for crypto.randomUUID and crypto.subtle.digest
 * when loaded in unsecure HTTP origins.
 */
(function() {
  // Self-contained compact SHA-256 implementation
  function sha256(ascii) {
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }
    var mathPow = Math.pow;
    var maxWord = mathPow(2, 32);
    var lengthProperty = 'length';
    var i, j;
    var words = [];
    var asciiLength = ascii.length;
    var hash = [];
    var k = [];
    var primeCounter = 0;
    var isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) {
          isComposite[i] = 1;
        }
        if (primeCounter < 8) {
          hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
        }
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    ascii += '\x80';
    while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii[lengthProperty]; i++) {
      j = ascii.charCodeAt(i);
      if (j >> 8) return;
      words[i >> 2] |= j << (24 - (i % 4) * 8);
    }
    words[words[lengthProperty]] = ((asciiLength >>> 29) & 7);
    words[words[lengthProperty]] = (asciiLength << 3);
    for (j = 0; j < words[lengthProperty]; j += 16) {
      var w = [];
      var a = hash[0], b = hash[1], c = hash[2], d = hash[3], e = hash[4], f = hash[5], g = hash[6], h = hash[7];
      for (i = 0; i < 64; i++) {
        if (i < 16) {
          w[i] = words[j + i];
        } else {
          var s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
          var s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
          w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
        }
        var temp1 = (h + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) + ((e & f) ^ (~e & g)) + k[i] + w[i]) | 0;
        var temp2 = ((rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + temp1) | 0; d = c; c = b; b = a; a = (temp1 + temp2) | 0;
      }
      hash[0] = (hash[0] + a) | 0; hash[1] = (hash[1] + b) | 0; hash[2] = (hash[2] + c) | 0; hash[3] = (hash[3] + d) | 0;
      hash[4] = (hash[4] + e) | 0; hash[5] = (hash[5] + f) | 0; hash[6] = (hash[6] + g) | 0; hash[7] = (hash[7] + h) | 0;
    }
    var resultBuf = new Uint8Array(32);
    for (i = 0; i < 8; i++) {
      resultBuf[i * 4] = (hash[i] >>> 24) & 255;
      resultBuf[i * 4 + 1] = (hash[i] >>> 16) & 255;
      resultBuf[i * 4 + 2] = (hash[i] >>> 8) & 255;
      resultBuf[i * 4 + 3] = hash[i] & 255;
    }
    return resultBuf.buffer;
  }

  if (!window.crypto) window.crypto = {};
  if (!window.crypto.subtle) {
    window.crypto.subtle = {
      digest: function(algorithm, data) {
        return new Promise(function(resolve, reject) {
          try {
            if (algorithm.toUpperCase() !== "SHA-256") {
              reject(new Error("Unsupported algorithm: " + algorithm));
              return;
            }
            var binary = "";
            var bytes = new Uint8Array(data);
            var len = bytes.byteLength;
            for (var i = 0; i < len; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            var hashBuf = sha256(binary);
            resolve(hashBuf);
          } catch(e) {
            reject(e);
          }
        });
      }
    };
    console.log("[DDB-Bridge-Shim] Injected window.crypto.subtle.digest SHA-256 fallback shim in main world.");
  }

  if (!window.crypto.randomUUID) {
    window.crypto.randomUUID = function() {
      return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, function(c) {
        return (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16);
      });
    };
    console.log("[DDB-Bridge-Shim] Injected window.crypto.randomUUID fallback shim in main world.");
  }
})();
