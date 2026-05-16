const XMP_APP1_HEADER = "http://ns.adobe.com/xap/1.0/\0";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const xmpHeaderBytes = textEncoder.encode(XMP_APP1_HEADER);

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const output = new Uint8Array(size);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return output;
}

function startsWithBytes(bytes: Uint8Array, prefix: Uint8Array): boolean {
  if (bytes.byteLength < prefix.byteLength) {
    return false;
  }

  for (let index = 0; index < prefix.byteLength; index += 1) {
    if (bytes[index] !== prefix[index]) {
      return false;
    }
  }

  return true;
}

function assertJpeg(bytes: Uint8Array): void {
  if (bytes.byteLength < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error("封面必须是 JPEG。请换一张图片，或让浏览器重新截帧。");
  }
}

function segmentLength(bytes: Uint8Array, offset: number): number {
  return bytes[offset + 2] << 8 | bytes[offset + 3];
}

function stripExistingXmp(bytes: Uint8Array): Uint8Array {
  assertJpeg(bytes);

  const chunks: Uint8Array[] = [bytes.slice(0, 2)];
  let offset = 2;

  while (offset + 4 <= bytes.byteLength) {
    if (bytes[offset] !== 0xff) {
      chunks.push(bytes.slice(offset));
      return concatBytes(chunks);
    }

    const marker = bytes[offset + 1];
    if (marker === 0xda) {
      chunks.push(bytes.slice(offset));
      return concatBytes(chunks);
    }

    if (marker >= 0xd0 && marker <= 0xd9 || marker === 0x01) {
      chunks.push(bytes.slice(offset, offset + 2));
      offset += 2;
      continue;
    }

    const length = segmentLength(bytes, offset);
    const end = offset + 2 + length;
    if (length < 2 || end > bytes.byteLength) {
      chunks.push(bytes.slice(offset));
      return concatBytes(chunks);
    }

    const payload = bytes.slice(offset + 4, end);
    const isXmp = marker === 0xe1 && startsWithBytes(payload, xmpHeaderBytes);
    if (!isXmp) {
      chunks.push(bytes.slice(offset, end));
    }

    offset = end;
  }

  if (offset < bytes.byteLength) {
    chunks.push(bytes.slice(offset));
  }

  return concatBytes(chunks);
}

function findInsertionOffset(bytes: Uint8Array): number {
  let offset = 2;

  while (offset + 4 <= bytes.byteLength && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1];
    if (!(marker >= 0xe0 && marker <= 0xef) && marker !== 0xfe) {
      break;
    }

    const length = segmentLength(bytes, offset);
    const end = offset + 2 + length;
    if (length < 2 || end > bytes.byteLength) {
      break;
    }

    offset = end;
  }

  return offset;
}

export function injectXmpPacket(jpeg: Uint8Array, xmp: string): Uint8Array {
  const cleanJpeg = stripExistingXmp(jpeg);
  const xmpBytes = textEncoder.encode(xmp);
  const payload = concatBytes([xmpHeaderBytes, xmpBytes]);
  const segmentLengthValue = payload.byteLength + 2;

  if (segmentLengthValue > 0xffff) {
    throw new Error("XMP 元数据过大，无法写入 JPEG APP1 段。");
  }

  const segment = new Uint8Array(4 + payload.byteLength);
  segment[0] = 0xff;
  segment[1] = 0xe1;
  segment[2] = segmentLengthValue >> 8 & 0xff;
  segment[3] = segmentLengthValue & 0xff;
  segment.set(payload, 4);

  const insertionOffset = findInsertionOffset(cleanJpeg);
  return concatBytes([
    cleanJpeg.slice(0, insertionOffset),
    segment,
    cleanJpeg.slice(insertionOffset)
  ]);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildAndroidMotionXmp(contentId: string, videoBytes: number, presentationTimestampUs = 0): string {
  const id = escapeXml(contentId);

  return `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Live Motion Studio">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description
      rdf:about=""
      xmlns:GCamera="http://ns.google.com/photos/1.0/camera/"
      xmlns:Container="http://ns.google.com/photos/1.0/container/"
      xmlns:Item="http://ns.google.com/photos/1.0/container/item/"
      GCamera:MotionPhoto="1"
      GCamera:MotionPhotoVersion="1"
      GCamera:MotionPhotoPresentationTimestampUs="${presentationTimestampUs}"
      GCamera:MicroVideo="1"
      GCamera:MicroVideoVersion="1"
      GCamera:MicroVideoOffset="${videoBytes}"
      GCamera:MicroVideoPresentationTimestampUs="${presentationTimestampUs}"
      GCamera:MotionPhotoContentIdentifier="${id}">
      <Container:Directory>
        <rdf:Seq>
          <rdf:li rdf:parseType="Resource">
            <Container:Item Item:Mime="image/jpeg" Item:Semantic="Primary" Item:Length="0" Item:Padding="0"/>
          </rdf:li>
          <rdf:li rdf:parseType="Resource">
            <Container:Item Item:Mime="video/mp4" Item:Semantic="MotionPhoto" Item:Length="${videoBytes}" Item:Padding="0"/>
          </rdf:li>
        </rdf:Seq>
      </Container:Directory>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

export function buildAppleLivePhotoXmp(contentId: string): string {
  const id = escapeXml(contentId);

  return `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Live Motion Studio">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description
      rdf:about=""
      xmlns:ApplePhoto="http://ns.apple.com/2015/02/26/photokit/"
      ApplePhoto:ContentIdentifier="${id}"/>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

export async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

export function bytesToText(bytes: Uint8Array): string {
  return textDecoder.decode(bytes);
}

export function mergeJpegAndVideo(jpeg: Uint8Array, video: Uint8Array): Uint8Array {
  return concatBytes([jpeg, video]);
}

export function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
