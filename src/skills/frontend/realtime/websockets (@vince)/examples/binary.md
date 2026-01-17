# WebSocket - Binary Data Patterns

> Binary data transfer over WebSocket including file uploads. See [core.md](core.md) for basic patterns.

---

## Pattern 12: File Upload Over WebSocket

Chunked binary file upload with progress tracking.

```typescript
// lib/websocket-file-upload.ts

const CHUNK_SIZE = 64 * 1024; // 64KB chunks

interface UploadProgress {
  fileId: string;
  fileName: string;
  totalChunks: number;
  uploadedChunks: number;
  percentage: number;
}

interface FileUploadOptions {
  socket: WebSocket;
  file: File;
  onProgress: (progress: UploadProgress) => void;
  onComplete: (fileId: string) => void;
  onError: (error: string) => void;
}

export async function uploadFileOverWebSocket(options: FileUploadOptions): Promise<void> {
  const { socket, file, onProgress, onComplete, onError } = options;

  if (socket.readyState !== WebSocket.OPEN) {
    onError("WebSocket is not connected");
    return;
  }

  const fileId = crypto.randomUUID();
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  // Send file metadata first
  socket.send(JSON.stringify({
    type: "file_upload_start",
    fileId,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    totalChunks,
  }));

  // Set binary type for sending chunks
  socket.binaryType = "arraybuffer";

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    const arrayBuffer = await chunk.arrayBuffer();

    // Create header: 36 bytes for UUID + 4 bytes for chunk index
    const header = new ArrayBuffer(40);
    const headerView = new DataView(header);

    // Write fileId as bytes (simplified - in practice use proper UUID encoding)
    const encoder = new TextEncoder();
    const fileIdBytes = encoder.encode(fileId);
    new Uint8Array(header).set(fileIdBytes.slice(0, 36), 0);

    // Write chunk index
    headerView.setUint32(36, chunkIndex);

    // Combine header and chunk
    const message = new Uint8Array(40 + arrayBuffer.byteLength);
    message.set(new Uint8Array(header), 0);
    message.set(new Uint8Array(arrayBuffer), 40);

    socket.send(message);

    onProgress({
      fileId,
      fileName: file.name,
      totalChunks,
      uploadedChunks: chunkIndex + 1,
      percentage: Math.round(((chunkIndex + 1) / totalChunks) * 100),
    });
  }

  // Send completion message
  socket.send(JSON.stringify({
    type: "file_upload_complete",
    fileId,
  }));

  onComplete(fileId);
}
```

### Usage

```typescript
// components/file-uploader.tsx
import { useRef, useState } from "react";
import { uploadFileOverWebSocket, type UploadProgress } from "../lib/websocket-file-upload";

interface FileUploaderProps {
  socket: WebSocket;
}

export function FileUploader({ socket }: FileUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setError(null);

    await uploadFileOverWebSocket({
      socket,
      file,
      onProgress: setProgress,
      onComplete: (fileId) => {
        console.log(`Upload complete: ${fileId}`);
        setProgress(null);
      },
      onError: setError,
    });
  };

  return (
    <div>
      <input type="file" ref={fileInputRef} />
      <button onClick={handleUpload} disabled={!!progress}>
        Upload
      </button>

      {progress && (
        <div>
          Uploading {progress.fileName}: {progress.percentage}%
          ({progress.uploadedChunks}/{progress.totalChunks} chunks)
        </div>
      )}

      {error && <div style={{ color: "red" }}>{error}</div>}
    </div>
  );
}
```

**Why good:** Chunked upload handles large files, progress tracking for UX, binary data for efficiency, metadata sent as JSON for readability, proper error handling
