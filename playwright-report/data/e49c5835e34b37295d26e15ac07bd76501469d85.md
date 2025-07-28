# Page snapshot

```yaml
- text: "[plugin:vite:esbuild] Transform failed with 1 error: /Users/stepanzinin/website test/frontend/src/types/index.ts:395:6: ERROR: Expected \";\" but found \"guards\" /Users/stepanzinin/website test/frontend/src/types/index.ts:395:6 Expected \";\" but found \"guards\" 393| } 394| // 395| Type guards for runtime type checking | ^ 396| export function isNonEmptyString(value: unknown): value is NonEmptyString { 397| return typeof value === 'string' && value.length > 0; at failureErrorWithLog (/Users/stepanzinin/website test/node_modules/vite/node_modules/esbuild/lib/main.js:1472:15) at /Users/stepanzinin/website test/node_modules/vite/node_modules/esbuild/lib/main.js:755:50 at responseCallbacks.<computed> (/Users/stepanzinin/website test/node_modules/vite/node_modules/esbuild/lib/main.js:622:9) at handleIncomingPacket (/Users/stepanzinin/website test/node_modules/vite/node_modules/esbuild/lib/main.js:677:12) at Socket.readFromStdout (/Users/stepanzinin/website test/node_modules/vite/node_modules/esbuild/lib/main.js:600:7) at Socket.emit (node:events:507:28) at addChunk (node:internal/streams/readable:559:12) at readableAddChunkPushByteMode (node:internal/streams/readable:510:3) at Readable.push (node:internal/streams/readable:390:5) at Pipe.onStreamRead (node:internal/stream_base_commons:189:23 Click outside, press Esc key, or fix the code to dismiss. You can also disable this overlay by setting"
- code: server.hmr.overlay
- text: to
- code: "false"
- text: in
- code: vite.config.ts
- text: .
```