# Sora JS E2EE ライブラリ

**現在リリース準備中です**

## 現在実験的に Sora Labo でサンプルが利用可能です

[Sora Labo](https://sora-labo.shiguredo.jp/) のダッシュボードの `E2EE マルチストリーム送受信` を触ってみてください。

## 概要

WebRTC SFU Sora 利用時に E2EE をブラウザで実現するためのライブラリです。
これ単体では利用できず Sora JS SDK と合わせて利用します。

## Q&A

- このライブラリのライセンスはなんですか？
    - Apache License 2.0 です
- E2EE を利用するメリットはなんですか？
    - WebRTC SFU 側で音声や映像の解析が困難になります
- E2EE 用の鍵はどうやって生成すればいいですか？
    - E2EE 用の鍵についてはこのライブラリではただの文字列としてしか扱いません
- E2EE に利用する暗号方式は何を採用していますか？
    - AES-GCM 128 を採用しています
- E2EE に利用する暗号鍵を生成する鍵導出関数はなんですか？
    - PBKDF2 を利用します
- E2EE に利用する IV の生成方法はなんですか？
    - PBKDF2 の Salt に SSRC を利用して生成された 96 ビットの値と前半 64 ビットを 0 パディングした 32 ビットのシーケンス番号の XOR を利用します
- E2EE 用の鍵はどうやって利用しますか？
    - sora js sdk のオプションに `{e2ee: "key"}` として渡します
- E2EE 用の鍵は Sora に送られますか？
    - 送られません Sora には `{e2ee: true}` という値のみが送られます
    - この値は E2EE を利用しているかどうかを把握するために利用されます
- E2EE で利用する暗号鍵の利用回数が 2^32-1 回を超えたらどうなりますか？
    - 鍵の更新は行わず切断します
- E2EE はどうやって実現していますか？
    - Insertable Streams を利用して実現しています
- E2EE を利用すると遅くなりますか？
    - 暗号化/復号が入るので遅くはなりますが WebWorker を利用することで可能な範囲で高速化はしています
- 暗号ライブラリは何を利用していますか？
    - WebCrypto を利用しています

## 利用可能環境

**Insertable Streams API が Chrome M83-85 で FieldTrial 中**

- Chrome M83 以降

## 利用技術

- Insertable Streams
    - [WebRTC Insertable Streams \- Chrome Platform Status](https://www.chromestatus.com/feature/6321945865879552)
- WebCrypto
    - [Web Cryptography API](https://www.w3.org/TR/WebCryptoAPI/)
- WebWorker
    - [Web Workers](https://w3c.github.io/workers/)

## 利用方法

現時点ではまだ対応していない `Sora JavaScript SDK` からの利用例。

```javascript
let sora = Sora.connection('wss://sora-labo.shiguredo.jp/signaling');
let channelId = 'shiguredo@sora-labo';
let metadata = {'signaling_key': 'VBmHJ75tjP_NPpHPDwDHfuf84LtNtOx0-ElOZ0qlU7xQ0QtV'};
let sendrecv = sora.sendrecv(channelId, metadata, {e2ee: 'e2ee-secret-key'});

navigator.mediaDevices.getUserMedia({audio: true, video: true})
  .then(mediaStream => {
    // connect
    sendrecv.connect(mediaStream)
      .then(stream => {
        // stream を video.src に追加する等の処理
      });
  })
  .catch(e => {
    console.error(e);
  });

// disconnect
sendrecv.disconnect()
  .then(() => {
    // video を止める等の処理
  });

// event
sendrecv.on('disconnect', function(e) {
  console.error(e);
});
```

## ライセンス

```
Copyright 2020, Shiguredo Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```