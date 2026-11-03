// HEIC çözme işi ayrı bir iş parçacığında yapılır; iş bitince parça kapanır ve
// çözücünün kullandığı bellek (≈250 MB) sunucuya geri verilir.
const { parentPort, workerData } = require('worker_threads');
const { heicToJpegSync } = require('./imagefix');

heicToJpegSync(Buffer.from(workerData))
  .then((out) => parentPort.postMessage({ ok: true, data: out }, [out.buffer]))
  .catch((e) => parentPort.postMessage({ ok: false, error: e.message }));
