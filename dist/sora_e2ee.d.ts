declare class SoraE2EE {
    worker: Worker | null;
    masterKey: ArrayBuffer;
    onWorkerDisconnect: Function | null;
    constructor(masterSecret: string);
    startWorker(): void;
    terminateWorker(): void;
    setupSenderTransform(sender: RTCRtpSender): void;
    setupReceiverTransform(receiver: RTCRtpReceiver): void;
    static version(): string;
}
export default SoraE2EE;
