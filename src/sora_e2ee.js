const RTCPeerConnection = window.RTCPeerConnection;
const RTCSessionDescription = window.RTCSessionDescription;
const RTCIceCandidate = window.RTCIceCandidate;

let ws;
let peerConnection;
let localStream;
let clientId;
let connectionId;

// 対応しているかどうかの判断
const supportsInsertableStreams = !!RTCRtpSender.prototype
  .createEncodedVideoStreams;
if (!supportsInsertableStreams) {
  banner.innerText =
    "このブラウザは Insertable Streams API をサポートしていない。" +
    "Chrome M83 以降で出直してこい。";
}

// ワーカーを起動する
let worker = new Worker("./sora_e2ee_worker.js");

worker.onmessage = (event) => {
  const { operation } = event.data;
  if (operation === "disconnect") {
    disconnect();
  }
};

function onMessage(event) {
  const message = JSON.parse(event.data);
  if (message.type == "offer") {
    connectionId = message.connection_id;
    clientId = message.client_id;
    document.getElementById("localVideo-clientId").textContent =
      message.client_id;

    var config = message.config;
    if (!config) {
      config = {
        iceServers: [],
      };
    }

    var constraints = { optional: [] };

    // ここ大事
    config["forceEncodedVideoInsertableStreams"] = true;
    config["forceEncodedAudioInsertableStreams"] = true;

    peerConnection = new RTCPeerConnection(config, constraints);
    peerConnection.onclose = function (event) {
      console.log(event);
    };

    peerConnection.onerror = function (error) {
      console.log(error);
    };

    var remoteVideos = document.getElementById("remote");

    peerConnection.ontrack = function (event) {
      console.info("--- ontrack ---");
      console.info(event);
      var stream = event.streams[0];

      if (stream.id === "default") {
        return;
      }

      if (stream.id === clientId) {
        return;
      }

      var track = event.track;

      setupReceiverTransform(event.receiver);

      var remoteVideo = document.getElementById("remotevideo_" + stream.id);
      if (remoteVideo) {
        var stream = remoteVideo.srcObject;
        stream.addTrack(track);
      } else {
        remoteVideo = document.createElement("video");
        remoteVideo.id = "remotevideo_" + stream.id;
        remoteVideo.style.border = "1px solid red";
        var stream = new MediaStream();
        stream.addTrack(track);
        remoteVideo.srcObject = stream;
        remoteVideos.appendChild(remoteVideo);
      }

      remoteVideo.play();
    };

    peerConnection.onremovestream = function (event) {
      console.info("--- onremovestream ---");
      console.log(event);
      var remoteVideos = document.getElementById("remote");
      var remoteVideo = document.getElementById(
        "remotevideo_" + event.stream.id
      );
      remoteVideos.removeChild(remoteVideo);
    };

    if (typeof peerConnection.addTrack === "undefined") {
      peerConnection.addStream(localStream);
    } else {
      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
      });
    }

    peerConnection.oniceconnectionstatechange = function (event) {
      console.info("--- oniceconnectionstatechange ---");
      console.log(event);
    };

    peerConnection.onnegotiationneeded = function (event) {
      console.info("--- onnegotiationneeded ---");
      console.log(event);
    };

    peerConnection.onsignalingstatechange = function (event) {
      console.info("--- onsignalingstatechange ---");
      console.log(event);
    };

    var sessionDescription = new RTCSessionDescription(message);
    peerConnection
      .setRemoteDescription(sessionDescription)
      .then(() => {
        createAnswer(peerConnection);
      })
      .catch((reason) => {
        console.error(reason);
      });
  } else if (message.type == "answer") {
    console.info("--- answer ---");
    console.log(message);
  } else if (message.type == "update") {
    console.info("--- update ---");
    console.log(peerConnection.signalingState);
    console.log(message.sdp);
    var sessionDescription = new RTCSessionDescription({
      type: "offer",
      sdp: message.sdp,
    });
    console.log(sessionDescription);
    peerConnection
      .setRemoteDescription(sessionDescription)
      .then(() => {
        console.info("--- setRemoteDescription ---");
        var options = {};
        return peerConnection.createAnswer(options);
      })
      .then((sessionDescription) => {
        console.info("--- createAnswer ---");
        return peerConnection.setLocalDescription(sessionDescription);
      })
      .then(() => {
        console.info("--- setLocalDescription ---");
        var sdp = peerConnection.localDescription.sdp;
        var message = JSON.stringify({ type: "update", sdp: sdp });
        console.info("--- SDP (update) ---");
        console.log(sdp);
        ws.send(message);
      })
      .catch((reason) => {
        console.error(reason);
      });
  } else if (message.type == "ping") {
    // console.info('--- pong ---');
    const message = JSON.stringify({ type: "pong" });
    ws.send(message);
  } else if (message.type == "notify") {
    // console.log('--- notify ---');
    console.log(message);
  } else {
    console.log(message);
  }
}

function createAnswer(peerConnection) {
  var options = {};
  peerConnection
    .createAnswer(options)
    .then((sessionDescription) => {
      console.info("--- setLocalDescription ---");
      return peerConnection.setLocalDescription(sessionDescription);
    })
    .then(() => {
      var sdp = peerConnection.localDescription.sdp;
      var message = JSON.stringify({ type: "answer", sdp: sdp });
      console.info("--- Answer SDP ---");
      console.log(sdp);
      ws.send(message);

      peerConnection.getSenders().forEach((sender) => {
        // sender.track が null の場合が存在するのでその時は排除する
        if (sender.track !== null) {
          setupSenderTransform(sender);
        }
      });

      peerConnection.onicecandidate = onIceCandidate;
    })
    .catch((reason) => {
      console.error(reason);
    });
}

async function setupKey() {
  console.info("--- setupKey ---");

  const masterSecret = window.location.hash;
  const masterKey = new TextEncoder().encode(masterSecret);

  worker.postMessage({
    operation: "setKey",
    masterKey,
  });
}

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
