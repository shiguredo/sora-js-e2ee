declare class SoraE2EE {
    worker: Worker | null;
    constructor();
    startWorker(): void;
    setupKey(): void;
    setupSenderTransform(sender: RTCRtpSender): void;
    setupReceiverTransform(receiver: RTCRtpReceiver): void;
}
export default SoraE2EE;
