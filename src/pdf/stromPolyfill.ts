// Safari auf dem iPhone kann über einen ReadableStream nicht mit „for await“ laufen, und PDF.js liest so
// den Text einer Seite. Ohne das scheitert auf echten iPhones alles, was den Text braucht (Datum finden,
// Scans erkennen); das WebKit der Browsertests hat es und merkt nichts. Gefunden im Test der iOS-App.
const strom = ReadableStream.prototype as unknown as {
  [Symbol.asyncIterator]?: () => AsyncGenerator<unknown>;
  getReader: () => ReadableStreamDefaultReader<unknown>;
};
strom[Symbol.asyncIterator] ??= async function* (this: typeof strom) {
  const leser = this.getReader();
  try {
    for (;;) {
      const { done, value } = await leser.read();
      if (done) return;
      yield value;
    }
  } finally {
    leser.releaseLock();
  }
};

export {};
