class SoraE2EE {
  worker: Worker | null;

  constructor() {
    this.worker = null;
  }
  // worker を起動する
  startWorker(): void {
    // 対応しているかどうかの判断
    // @ts-ignore
    const supportsInsertableStreams = !!RTCRtpSender.prototype.createEncodedVideoStreams;
    if (!supportsInsertableStreams) {
      // TODO(yuito): エラー対応する
      throw new Error("Error");
    }

    // ワーカーを起動する
    const workerScript = atob("WORKER_SCRIPT");
    this.worker = new Worker(URL.createObjectURL(new Blob([workerScript], { type: "application/javascript" })));
  }

  // location.hash から鍵を生成して worker に送るコード
  setupKey(): void {
    const masterSecret = window.location.hash;
    const masterKey = new TextEncoder().encode(masterSecret);

    if (this.worker) {
      this.worker.postMessage({
        operation: "setKey",
        masterKey,
      });
    }
  }
  // worker への登録
  setupSenderTransform(sender: RTCRtpSender): void {
    if (!sender.track) return;
    const senderStreams =
      // @ts-ignore
      sender.track.kind === "video" ? sender.createEncodedVideoStreams() : sender.createEncodedAudioStreams();
    if (this.worker) {
      this.worker.postMessage(
        {
          operation: "encrypt",
          readableStream: senderStreams.readableStream,
          writableStream: senderStreams.writableStream,
        },
        [senderStreams.readableStream, senderStreams.writableStream]
      );
    }
  }
  // worker への登録
  setupReceiverTransform(receiver: RTCRtpReceiver): void {
    const receiverStreams =
      // @ts-ignore
      receiver.track.kind === "video" ? receiver.createEncodedVideoStreams() : receiver.createEncodedAudioStreams();
    if (this.worker) {
      this.worker.postMessage(
        {
          operation: "decrypt",
          readableStream: receiverStreams.readableStream,
          writableStream: receiverStreams.writableStream,
        },
        [receiverStreams.readableStream, receiverStreams.writableStream]
      );
    }
  }
}

export default SoraE2EE;
