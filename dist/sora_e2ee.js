/**
 * sora-e2ee
 * WebRTC SFU Sora JavaScript E2EE Library
 * @version: 2020.3.0-dev
 * @author: Shiguredo Inc.
 * @license: Apache-2.0
 **/

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.SoraE2EE = factory());
}(this, (function () { 'use strict';

  class SoraE2EE {
      constructor(masterSecret) {
          // 対応しているかどうかの判断
          // @ts-ignore トライアル段階の API なので無視する
          const supportsInsertableStreams = !!RTCRtpSender.prototype.createEncodedStreams;
          if (!supportsInsertableStreams) {
              throw new Error("E2EE is not supported in this browser");
          }
          this.worker = null;
          this.masterKey = new TextEncoder().encode(masterSecret);
          this.onWorkerDisconnect = null;
      }
      // worker を起動する
      startWorker() {
          // ワーカーを起動する
          const workerScript = atob("bGV0IG1hc3RlcktleSxtYXRlcmlhbDtjb25zdCBkZXJpdmVLZXlNYXA9bmV3IE1hcCxzZXFOdW1NYXA9bmV3IE1hcCx3cml0ZUlWTWFwPW5ldyBNYXAsc2VxTnVtTGVuZ3RoPTQsc3NyY0xlbmd0aD00LHBhZGRpbmdMZW5ndGg9OCx1bmVuY3J5cHRlZEJ5dGVzPXtrZXk6MTAsZGVsdGE6Myx1bmRlZmluZWQ6MX07ZnVuY3Rpb24gZ2V0U2VxTnVtKGEpe3JldHVybiBzZXFOdW1NYXAuZ2V0KGEpfHwwfWZ1bmN0aW9uIHNldFNlcU51bShhLGIpe3NlcU51bU1hcC5zZXQoYSxiKX1hc3luYyBmdW5jdGlvbiBnZW5lcmF0ZURlcml2ZUtleShhLGIpe2xldCBjPWRlcml2ZUtleU1hcC5nZXQoYSk7cmV0dXJuIGN8fChjPWF3YWl0IGNyeXB0by5zdWJ0bGUuZGVyaXZlS2V5KHtuYW1lOiJQQktERjIiLHNhbHQ6YixpdGVyYXRpb25zOjFlNCxoYXNoOiJTSEEtMjU2In0sbWF0ZXJpYWwse25hbWU6IkFFUy1HQ00iLGxlbmd0aDoxMjh9LCExLFsiZW5jcnlwdCIsImRlY3J5cHQiXSksZGVyaXZlS2V5TWFwLnNldChhLGMpKSxjfWFzeW5jIGZ1bmN0aW9uIGdlbmVyYXRlSVYoYSxiLGMpe2xldCBkPXdyaXRlSVZNYXAuZ2V0KGEpO2lmKCFkKXtjb25zdCBjPWF3YWl0IGNyeXB0by5zdWJ0bGUuZGVyaXZlQml0cyh7bmFtZToiUEJLREYyIixzYWx0OmIsaXRlcmF0aW9uczoxZTQsaGFzaDp7bmFtZToiU0hBLTM4NCJ9fSxtYXRlcmlhbCw5Nik7ZD1uZXcgVWludDhBcnJheShjKSx3cml0ZUlWTWFwLnNldChhLGQpfWNvbnN0IGU9bmV3IFVpbnQ4QXJyYXkocGFkZGluZ0xlbmd0aCtzZXFOdW1MZW5ndGgpO2Uuc2V0KG5ldyBVaW50OEFycmF5KGMuYnVmZmVyKSxwYWRkaW5nTGVuZ3RoKTtjb25zdCBmPW5ldyBVaW50OEFycmF5KGUuYnl0ZUxlbmd0aCk7Zm9yKGxldCBnPTA7ZzxlLmJ5dGVMZW5ndGg7ZysrKWZbZ109ZVtnXV5kW2ddO3JldHVybiBmfWFzeW5jIGZ1bmN0aW9uIGVuY3J5cHRGdW5jdGlvbihhLGIpe2NvbnN0IGM9YS5zeW5jaHJvbml6YXRpb25Tb3VyY2UsZD1VaW50MzJBcnJheS5vZihjKSxlPWdldFNlcU51bShjKTtlPj00Mjk0OTY3Mjk2JiZwb3N0TWVzc2FnZSh7b3BlcmF0aW9uOiJkaXNjb25uZWN0In0pO2NvbnN0IGY9VWludDMyQXJyYXkub2YoZSksZz1hd2FpdCBnZW5lcmF0ZURlcml2ZUtleShjLGQpLGg9YXdhaXQgZ2VuZXJhdGVJVihjLGQsZiksaT1hd2FpdCBjcnlwdG8uc3VidGxlLmVuY3J5cHQoe25hbWU6IkFFUy1HQ00iLGl2OmgsYWRkaXRpb25hbERhdGE6bmV3IFVpbnQ4QXJyYXkoYS5kYXRhLDAsdW5lbmNyeXB0ZWRCeXRlc1thLnR5cGVdKX0sZyxuZXcgVWludDhBcnJheShhLmRhdGEsdW5lbmNyeXB0ZWRCeXRlc1thLnR5cGVdKSksaj1uZXcgQXJyYXlCdWZmZXIodW5lbmNyeXB0ZWRCeXRlc1thLnR5cGVdK2kuYnl0ZUxlbmd0aCtkLmJ5dGVMZW5ndGgrZi5ieXRlTGVuZ3RoKSxrPW5ldyBVaW50OEFycmF5KGopO2suc2V0KG5ldyBVaW50OEFycmF5KGEuZGF0YSwwLHVuZW5jcnlwdGVkQnl0ZXNbYS50eXBlXSkpLGsuc2V0KG5ldyBVaW50OEFycmF5KGkpLHVuZW5jcnlwdGVkQnl0ZXNbYS50eXBlXSksay5zZXQobmV3IFVpbnQ4QXJyYXkoZC5idWZmZXIpLHVuZW5jcnlwdGVkQnl0ZXNbYS50eXBlXStpLmJ5dGVMZW5ndGgpLGsuc2V0KG5ldyBVaW50OEFycmF5KGYuYnVmZmVyKSx1bmVuY3J5cHRlZEJ5dGVzW2EudHlwZV0raS5ieXRlTGVuZ3RoK2QuYnl0ZUxlbmd0aCksYS5kYXRhPWosYi5lbnF1ZXVlKGEpLHNldFNlcU51bShjLGUrMSl9YXN5bmMgZnVuY3Rpb24gZGVjcnlwdEZ1bmN0aW9uKGEsYil7Y29uc3QgYz1hLmRhdGEuc2xpY2UoYS5kYXRhLmJ5dGVMZW5ndGgtKHNzcmNMZW5ndGgrc2VxTnVtTGVuZ3RoKSxhLmRhdGEuYnl0ZUxlbmd0aCksZD1jLnNsaWNlKDAsc3NyY0xlbmd0aCksZT1uZXcgVWludDMyQXJyYXkoZCksZj1jLnNsaWNlKHNzcmNMZW5ndGgsYy5ieXRlTGVuZ3RoKSxnPW5ldyBVaW50MzJBcnJheShmKSxoPWVbMF0saT1hd2FpdCBnZW5lcmF0ZURlcml2ZUtleShoLGUpLGo9YXdhaXQgZ2VuZXJhdGVJVihoLGUsZyksaz11bmVuY3J5cHRlZEJ5dGVzW2EudHlwZV0sbD1hLmRhdGEuYnl0ZUxlbmd0aC0odW5lbmNyeXB0ZWRCeXRlc1thLnR5cGVdK3NzcmNMZW5ndGgrc2VxTnVtTGVuZ3RoKTtsZXQgbTt0cnl7bT1hd2FpdCBjcnlwdG8uc3VidGxlLmRlY3J5cHQoe25hbWU6IkFFUy1HQ00iLGl2OmosYWRkaXRpb25hbERhdGE6bmV3IFVpbnQ4QXJyYXkoYS5kYXRhLDAsdW5lbmNyeXB0ZWRCeXRlc1thLnR5cGVdKX0saSxuZXcgVWludDhBcnJheShhLmRhdGEsayxsKSl9Y2F0Y2goYyl7aWYoYS50eXBlPT09dm9pZCAwKXtjb25zdCBiPW5ldyBBcnJheUJ1ZmZlcigzKSxjPW5ldyBVaW50OEFycmF5KGIpO2Muc2V0KFsyMTYsMjU1LDI1NF0pLGEuZGF0YT1ifWVsc2V7Y29uc3QgYj1uZXcgQXJyYXlCdWZmZXIoNjApLGM9bmV3IFVpbnQ4QXJyYXkoYik7Yy5zZXQoWzE3Niw1LDAsMTU3LDEsNDIsMTYwLDAsOTAsMCw1NywzLDAsMCwyOCwzNCwyMiwyMiwzNCwxMDIsMTgsMzIsNCwxNDQsNjQsMCwxOTcsMSwyMjQsMTI0LDc3LDQ3LDI1MCwyMjEsNzcsMTY1LDEyNywxMzcsMTY1LDI1NSw5MSwxNjksMTgwLDE3NSwyNDEsNTIsMTkxLDIzNSwxMTcsNTQsMTQ5LDI1NCwzOCwxNTAsOTYsMjU0LDI1NSwxODYsMjU1LDY0XSksYS5kYXRhPWJ9cmV0dXJuIHZvaWQgYi5lbnF1ZXVlKGEpfWNvbnN0IG49bmV3IEFycmF5QnVmZmVyKHVuZW5jcnlwdGVkQnl0ZXNbYS50eXBlXSttLmJ5dGVMZW5ndGgpLG89bmV3IFVpbnQ4QXJyYXkobik7by5zZXQobmV3IFVpbnQ4QXJyYXkoYS5kYXRhLDAsdW5lbmNyeXB0ZWRCeXRlc1thLnR5cGVdKSksby5zZXQobmV3IFVpbnQ4QXJyYXkobSksdW5lbmNyeXB0ZWRCeXRlc1thLnR5cGVdKSxhLmRhdGE9bixiLmVucXVldWUoYSl9b25tZXNzYWdlPWFzeW5jIGE9Pntjb25zdHtvcGVyYXRpb246Yn09YS5kYXRhO2lmKCJlbmNyeXB0Ij09PWIpe2NvbnN0e3JlYWRhYmxlU3RyZWFtOmIsd3JpdGFibGVTdHJlYW06Y309YS5kYXRhLGQ9bmV3IFRyYW5zZm9ybVN0cmVhbSh7dHJhbnNmb3JtOmVuY3J5cHRGdW5jdGlvbn0pO2IucGlwZVRocm91Z2goZCkucGlwZVRvKGMpfWVsc2UgaWYoImRlY3J5cHQiPT09Yil7Y29uc3R7cmVhZGFibGVTdHJlYW06Yix3cml0YWJsZVN0cmVhbTpjfT1hLmRhdGEsZD1uZXcgVHJhbnNmb3JtU3RyZWFtKHt0cmFuc2Zvcm06ZGVjcnlwdEZ1bmN0aW9ufSk7Yi5waXBlVGhyb3VnaChkKS5waXBlVG8oYyl9ZWxzZSJzZXRLZXkiPT09Yj8obWFzdGVyS2V5PWEuZGF0YS5tYXN0ZXJLZXksbWF0ZXJpYWw9YXdhaXQgY3J5cHRvLnN1YnRsZS5pbXBvcnRLZXkoInJhdyIsbWFzdGVyS2V5LCJQQktERjIiLCExLFsiZGVyaXZlQml0cyIsImRlcml2ZUtleSJdKSk6ImNsZWFyIj09PWImJihkZXJpdmVLZXlNYXAuY2xlYXIoKSxzZXFOdW1NYXAuY2xlYXIoKSx3cml0ZUlWTWFwLmNsZWFyKCkpfTsK");
          this.worker = new Worker(URL.createObjectURL(new Blob([workerScript], { type: "application/javascript" })));
          this.worker.onmessage = (event) => {
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
      terminateWorker() {
          if (this.worker) {
              this.worker.terminate();
          }
      }
      // worker への登録
      setupSenderTransform(sender) {
          if (!sender.track)
              return;
          // @ts-ignore トライアル段階の API なので無視する
          const senderStreams = sender.createEncodedStreams();
          const readableStream = senderStreams.readableStream || senderStreams.readable;
          const writableStream = senderStreams.writableStream || senderStreams.writable;
          if (this.worker) {
              this.worker.postMessage({
                  operation: "encrypt",
                  readableStream: readableStream,
                  writableStream: writableStream,
              }, [readableStream, writableStream]);
          }
      }
      // worker への登録
      setupReceiverTransform(receiver) {
          // @ts-ignore トライアル段階の API なので無視する
          const receiverStreams = receiver.createEncodedStreams();
          const readableStream = receiverStreams.readableStream || receiverStreams.readable;
          const writableStream = receiverStreams.writableStream || receiverStreams.writable;
          if (this.worker) {
              this.worker.postMessage({
                  operation: "decrypt",
                  readableStream: readableStream,
                  writableStream: writableStream,
              }, [readableStream, writableStream]);
          }
      }
      static version() {
          // @ts-ignore
          return '2020.3.0-dev';
      }
  }

  return SoraE2EE;

})));
