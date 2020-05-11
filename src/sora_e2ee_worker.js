let masterKey;
let material;

const deriveKeyMap = new Map();
const seqNumMap = new Map();
const writeIVMap = new Map();

const seqNumLength = 4;
const ssrcLength = 4;

const paddingLength = 8;

// VP8 のみ
// TODO(nakai): VP9 / AV1 も将来的に対応も考える
const unencryptedBytes = {
  // I フレーム
  key: 10,
  // 非 I フレーム
  delta: 3,
  // オーディオ
  undefined: 1,
};

function getSeqNum(ssrc) {
  return seqNumMap.get(ssrc) || 0;
}

function setSeqNum(ssrc, seqNum) {
  return seqNumMap.set(ssrc, seqNum);
}

async function generateDeriveKey(ssrc, ssrcData) {
  let deriveKey = deriveKeyMap.get(ssrc);
  if (!deriveKey) {
    deriveKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: ssrcData,
        // TODO(v): 定数化
        iterations: 10000,
        hash: "SHA-256",
      },
      material,
      {
        name: "AES-GCM",
        // TODO(v): 定数化
        length: 128,
      },
      false,
      ["encrypt", "decrypt"]
    );
    deriveKeyMap.set(ssrc, deriveKey);
  }
  return deriveKey;
}

async function generateIV(ssrc, ssrcData, seqNumData) {
  let writeIV = writeIVMap.get(ssrc);
  if (!writeIV) {
    const writeIVBuffer = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: ssrcData,
        // TODO(v): 定数化
        iterations: 10000,
        hash: { name: "SHA-384" },
      },
      material,
      // IV は 96 ビットなので
      // TODO(v): 定数化
      96
    );
    writeIV = new Uint8Array(writeIVBuffer);
    writeIVMap.set(ssrc, writeIV);
  }

  const seqNumDataWithPadding = new Uint8Array(paddingLength + seqNumLength);
  seqNumDataWithPadding.set(new Uint8Array(seqNumData.buffer), paddingLength);
  const iv = new Uint8Array(seqNumDataWithPadding.byteLength);
  // TODO(v): xor 関数化
  for (let i = 0; i < seqNumDataWithPadding.byteLength; i++) {
    iv[i] = seqNumDataWithPadding[i] ^ writeIV[i];
  }

  return iv;
}

async function encryptFunction(encodedFrame, controller) {
  const ssrc = encodedFrame.synchronizationSource;
  const ssrcData = Uint32Array.of(ssrc);

  const currentSeqNum = getSeqNum(ssrc);
  // seqNum が 32bit 以上の場合は停止する
  // TODO(v): 定数化
  if (currentSeqNum >= 2 ** 32) {
    postMessage({ operation: "disconnect" });
  }
  const seqNumData = Uint32Array.of(currentSeqNum);

  const currentDeriveKey = await generateDeriveKey(ssrc, ssrcData);
  const currentIV = await generateIV(ssrc, ssrcData, seqNumData);

  crypto.subtle
    .encrypt(
      {
        name: "AES-GCM",
        iv: currentIV,
        // 暗号化されていない部分
        additionalData: new Uint8Array(
          encodedFrame.data,
          0,
          unencryptedBytes[encodedFrame.type]
        ),
      },
      currentDeriveKey,
      new Uint8Array(encodedFrame.data, unencryptedBytes[encodedFrame.type])
    )
    .then((cipherText) => {
      const newData = new ArrayBuffer(
        unencryptedBytes[encodedFrame.type] +
          cipherText.byteLength +
          ssrcData.byteLength +
          seqNumData.byteLength
      );
      const newUint8 = new Uint8Array(newData);
      // 暗号化しない先頭の N バイトをコピーする
      newUint8.set(
        new Uint8Array(
          encodedFrame.data,
          0,
          unencryptedBytes[encodedFrame.type]
        )
      );
      // 暗号化したものを暗号化していない N バイトの後ろに追加
      newUint8.set(
        new Uint8Array(cipherText),
        unencryptedBytes[encodedFrame.type]
      );
      // ssrc を後ろに追加
      newUint8.set(
        new Uint8Array(ssrcData.buffer),
        unencryptedBytes[encodedFrame.type] + cipherText.byteLength,
        ssrcData.byteLength
      );
      // seqNum を後ろに追加
      newUint8.set(
        new Uint8Array(seqNumData.buffer),
        unencryptedBytes[encodedFrame.type] +
          cipherText.byteLength +
          ssrcData.byteLength,
        seqNumData.byteLength
      );

      encodedFrame.data = newData;

      controller.enqueue(encodedFrame);
    });

  setSeqNum(ssrc, currentSeqNum + 1);
}

async function decryptFunction(encodedFrame, controller) {
  const ssrcDataAndSeqNumData = encodedFrame.data.slice(
    encodedFrame.data.byteLength - (ssrcLength + seqNumLength),
    encodedFrame.data.byteLength
  );
  const ssrcBuffer = ssrcDataAndSeqNumData.slice(0, ssrcLength);
  const ssrcData = new Uint32Array(ssrcBuffer);
  const seqNumBuffer = ssrcDataAndSeqNumData.slice(
    ssrcLength,
    ssrcDataAndSeqNumData.byteLength
  );
  const seqNumData = new Uint32Array(seqNumBuffer);

  // ssrc, seqNum は 32 bit の想定
  const ssrc = ssrcData[0];
  // TODO(v): 使ってない？
  const seqNum = seqNumData[0];

  const currentDeriveKey = await generateDeriveKey(ssrc, ssrcData);
  const currentIV = await generateIV(ssrc, ssrcData, seqNumData);

  const cipherTextStart = unencryptedBytes[encodedFrame.type];
  const cipherTextLength =
    encodedFrame.data.byteLength -
    (unencryptedBytes[encodedFrame.type] + ssrcLength + seqNumLength);

  crypto.subtle
    .decrypt(
      {
        name: "AES-GCM",
        iv: currentIV,
        // 先頭の N バイトは暗号化されていない
        additionalData: new Uint8Array(
          encodedFrame.data,
          0,
          unencryptedBytes[encodedFrame.type]
        ),
      },
      currentDeriveKey,
      // 先頭の N バイト以外は暗号化されてる
      new Uint8Array(encodedFrame.data, cipherTextStart, cipherTextLength)
    )
    .then((plainText) => {
      const newData = new ArrayBuffer(
        unencryptedBytes[encodedFrame.type] + plainText.byteLength
      );
      const newUint8 = new Uint8Array(newData);

      newUint8.set(
        new Uint8Array(
          encodedFrame.data,
          0,
          unencryptedBytes[encodedFrame.type]
        )
      );
      newUint8.set(
        new Uint8Array(plainText),
        unencryptedBytes[encodedFrame.type]
      );

      encodedFrame.data = newData;

      controller.enqueue(encodedFrame);
    })
    .catch((e) => {
      // console.error(e);
      // console.error('[error] seqNum: ' + seqNum);
      if (encodedFrame.type === undefined) {
        // 音声は暗号化はいると聞けたものじゃないので置き換える
        const newData = new ArrayBuffer(3);
        const newUint8 = new Uint8Array(newData);

        // Opus サイレンスフレーム
        newUint8.set([0xd8, 0xff, 0xfe]);
        encodedFrame.data = newData;
      } else {
        // 映像が正常じゃないため PLI ストームが発生してしまう
        // そのため 320x240 の真っ黒な画面に置き換える
        const newData = new ArrayBuffer(60);
        const newUint8 = new Uint8Array(newData);

        // TODO(v): 定数化？
        // prettier-ignore
        newUint8.set([0xb0, 0x05, 0x00, 0x9d, 0x01, 0x2a, 0xa0, 0x00, 0x5a, 0x00,
                  0x39, 0x03, 0x00, 0x00, 0x1c, 0x22, 0x16, 0x16, 0x22, 0x66,
                  0x12, 0x20, 0x04, 0x90, 0x40, 0x00, 0xc5, 0x01, 0xe0, 0x7c,
                  0x4d, 0x2f, 0xfa, 0xdd, 0x4d, 0xa5, 0x7f, 0x89, 0xa5, 0xff,
                  0x5b, 0xa9, 0xb4, 0xaf, 0xf1, 0x34, 0xbf, 0xeb, 0x75, 0x36,
                  0x95, 0xfe, 0x26, 0x96, 0x60, 0xfe, 0xff, 0xba, 0xff, 0x40,
                ]);
        encodedFrame.data = newData;
      }

      controller.enqueue(encodedFrame);
    });
}

onmessage = async (event) => {
  const { operation } = event.data;
  if (operation === "encrypt") {
    const { readableStream, writableStream } = event.data;
    const transformStream = new TransformStream({
      transform: encryptFunction,
    });
    readableStream.pipeThrough(transformStream).pipeTo(writableStream);
  } else if (operation === "decrypt") {
    const { readableStream, writableStream } = event.data;
    const transformStream = new TransformStream({
      transform: decryptFunction,
    });
    readableStream.pipeThrough(transformStream).pipeTo(writableStream);
  } else if (operation === "setKey") {
    masterKey = event.data.masterKey;
    material = await crypto.subtle.importKey(
      "raw",
      masterKey,
      "PBKDF2",
      false,
      ["deriveBits", "deriveKey"]
    );
  } else if (operation === "clear") {
    deriveKeyMap.clear();
    seqNumMap.clear();
    writeIVMap.clear();
  }
};
