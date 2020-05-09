// このコードはライブラリ実装にむけた参考コードなので最終的には消します

// 対応しているかどうかの判断
const supportsInsertableStreams = !!RTCRtpSender.prototype
  .createEncodedVideoStreams;
if (!supportsInsertableStreams) {
  // 対応していない場合はエラーメッセージを出す
}

// ワーカーを起動する
let worker = new Worker("./sora_e2ee_worker.js");

worker.onmessage = (event) => {
  const { operation } = event.data;
  if (operation === "disconnect") {
    disconnect();
  }
};

// ここは参考のために残してるだけ
function onMessage(event) {
  const message = JSON.parse(event.data);
  if (message.type == "offer") {

    let config = message.config;
    let constraints = { optional: [] };

    // ここで Insertable Streams API の有効を指定する
    config["forceEncodedVideoInsertableStreams"] = true;
    config["forceEncodedAudioInsertableStreams"] = true;

    peerConnection = new RTCPeerConnection(config, constraints);

    peerConnection.ontrack = function (event) {
      // ここで Insertable Streams Receiver に登録する
      setupReceiverTransform(event.receiver);
    };
  }
}

function createAnswer(peerConnection) {
  let options = {};
  peerConnection
    .createAnswer(options)
    .then((sessionDescription) => {
      return peerConnection.setLocalDescription(sessionDescription);
    })
    .then(() => {
      let sdp = peerConnection.localDescription.sdp;
      let message = JSON.stringify({ type: "answer", sdp: sdp });
      ws.send(message);

      peerConnection.getSenders().forEach((sender) => {
        // sender.track が null の場合が存在するのでその時は排除する
        if (sender.track !== null) {
          // ここで Insertable Streams の sender ワーカーに登録する
          setupSenderTransform(sender);
        }
      });

      peerConnection.onicecandidate = onIceCandidate;
    })
    .catch((reason) => {
      console.error(reason);
    });
}

// location.hash から鍵を生成して worker に送るコード
async function setupKey() {
  console.info("--- setupKey ---");

  const masterSecret = window.location.hash;
  const masterKey = new TextEncoder().encode(masterSecret);

  worker.postMessage({
    operation: "setKey",
    masterKey,
  });
}

// worker への登録
function setupSenderTransform(sender) {
  const senderStreams =
    sender.track.kind === "video"
      ? sender.createEncodedVideoStreams()
      : sender.createEncodedAudioStreams();
  worker.postMessage(
    {
      operation: "encrypt",
      readableStream: senderStreams.readableStream,
      writableStream: senderStreams.writableStream,
    },
    [senderStreams.readableStream, senderStreams.writableStream]
  );
}

// worker への登録
function setupReceiverTransform(receiver) {
  const receiverStreams =
    receiver.track.kind === "video"
      ? receiver.createEncodedVideoStreams()
      : receiver.createEncodedAudioStreams();
  worker.postMessage(
    {
      operation: "decrypt",
      readableStream: receiverStreams.readableStream,
      writableStream: receiverStreams.writableStream,
    },
    [receiverStreams.readableStream, receiverStreams.writableStream]
  );
}
