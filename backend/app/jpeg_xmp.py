from __future__ import annotations

from io import BytesIO
from xml.sax.saxutils import escape

from PIL import Image, ImageOps

XMP_HEADER = b"http://ns.adobe.com/xap/1.0/\x00"


def ensure_jpeg(image_bytes: bytes, max_width: int | None = None, max_height: int | None = None, quality: int = 94) -> bytes:
    if image_bytes.startswith(b"\xff\xd8") and not max_width and not max_height and quality == 94:
        return image_bytes

    with Image.open(BytesIO(image_bytes)) as image:
        image = ImageOps.exif_transpose(image)
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")

        if max_width or max_height:
            target = (max_width or image.width, max_height or image.height)
            image.thumbnail(target, Image.Resampling.LANCZOS)

        output = BytesIO()
        image.save(output, format="JPEG", quality=max(60, min(98, quality)), optimize=True)
        return output.getvalue()


def build_apple_xmp(content_id: str) -> str:
    escaped_id = escape(content_id, {'"': "&quot;"})
    return f"""<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Live Motion Studio">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description
      rdf:about=""
      xmlns:ApplePhoto="http://ns.apple.com/2015/02/26/photokit/"
      ApplePhoto:ContentIdentifier="{escaped_id}"/>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>"""


def inject_xmp_packet(jpeg_bytes: bytes, xmp: str) -> bytes:
    if not jpeg_bytes.startswith(b"\xff\xd8"):
        raise ValueError("image must be a JPEG")

    clean = _strip_existing_xmp(jpeg_bytes)
    payload = XMP_HEADER + xmp.encode("utf-8")
    segment_length = len(payload) + 2
    if segment_length > 0xFFFF:
        raise ValueError("XMP payload is too large for a JPEG APP1 segment")

    segment = b"\xff\xe1" + segment_length.to_bytes(2, "big") + payload
    insert_at = _find_insertion_offset(clean)
    return clean[:insert_at] + segment + clean[insert_at:]


def _strip_existing_xmp(data: bytes) -> bytes:
    chunks = [data[:2]]
    offset = 2

    while offset + 4 <= len(data):
        if data[offset] != 0xFF:
            chunks.append(data[offset:])
            return b"".join(chunks)

        marker = data[offset + 1]
        if marker == 0xDA:
            chunks.append(data[offset:])
            return b"".join(chunks)

        if 0xD0 <= marker <= 0xD9 or marker == 0x01:
            chunks.append(data[offset : offset + 2])
            offset += 2
            continue

        length = int.from_bytes(data[offset + 2 : offset + 4], "big")
        end = offset + 2 + length
        if length < 2 or end > len(data):
            chunks.append(data[offset:])
            return b"".join(chunks)

        payload = data[offset + 4 : end]
        is_xmp = marker == 0xE1 and payload.startswith(XMP_HEADER)
        if not is_xmp:
            chunks.append(data[offset:end])

        offset = end

    chunks.append(data[offset:])
    return b"".join(chunks)


def _find_insertion_offset(data: bytes) -> int:
    offset = 2

    while offset + 4 <= len(data) and data[offset] == 0xFF:
        marker = data[offset + 1]
        if not (0xE0 <= marker <= 0xEF) and marker != 0xFE:
            break

        length = int.from_bytes(data[offset + 2 : offset + 4], "big")
        end = offset + 2 + length
        if length < 2 or end > len(data):
            break

        offset = end

    return offset
