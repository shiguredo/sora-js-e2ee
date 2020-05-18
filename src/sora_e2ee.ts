class SoraE2EE {
  worker: Worker | null;
  masterKey: ArrayBuffer;
  onWorkerDisconnect: Function | null;

  constructor(masterSecret: string) {
    // 対応しているかどうかの判断
    // @ts-ignore トライアル段階の API なので無視する
    const supportsInsertableStreams = !!RTCRtpSender.prototype.createEncodedVideoStreams;
    if (!supportsInsertableStreams) {
      throw new Error("E2EE is not supported in this browser");
    }
    this.worker = null;
    this.masterKey = new TextEncoder().encode(masterSecret);
    this.onWorkerDisconnect = null;
  }
  // worker を起動する
  startWorker(): void {
    // ワーカーを起動する
    const workerScript = atob("WORKER_SCRIPT");
    this.worker = new Worker(URL.createObjectURL(new Blob([workerScript], { type: "application/javascript" })));
    this.worker.onmessage = (event): void => {
      const { operation } = event.data;
      if (operation === "disconnect" && typeof this.onWorkerDisconnect === "function") {
        this.onWorkerDisconnect();
      }
    };
    this.worker.postMessage({
      operation: "setKey",
      masterKey: this.masterKey,
    });
  }
  // worker を終了する
  terminateWorker(): void {
    if (this.worker) {
      this.worker.terminate();
    }
  }
  // worker への登録
  setupSenderTransform(sender: RTCRtpSender): void {
    if (!sender.track) return;
    const senderStreams =
      // @ts-ignore トライアル段階の API なので無視する
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
      // @ts-ignore トライアル段階の API なので無視する
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
