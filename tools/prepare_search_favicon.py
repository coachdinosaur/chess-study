#!/usr/bin/env python3
"""Create a square Google Search favicon for the deployed Pages artifact.

The source app icon is intentionally left unchanged. This script centers its
RGBA pixels on a transparent square canvas whose size is a multiple of 48,
then updates the deployed copy of index.html to use the stable /favicon.png
URL.
"""

from __future__ import annotations

import binascii
import math
from pathlib import Path
import struct
import zlib

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
BYTES_PER_PIXEL = 4


def paeth(left: int, up: int, upper_left: int) -> int:
    estimate = left + up - upper_left
    left_distance = abs(estimate - left)
    up_distance = abs(estimate - up)
    upper_left_distance = abs(estimate - upper_left)
    if left_distance <= up_distance and left_distance <= upper_left_distance:
        return left
    if up_distance <= upper_left_distance:
        return up
    return upper_left


def make_chunk(chunk_type: bytes, payload: bytes) -> bytes:
    checksum = binascii.crc32(chunk_type + payload) & 0xFFFFFFFF
    return (
        struct.pack(">I", len(payload))
        + chunk_type
        + payload
        + struct.pack(">I", checksum)
    )


def read_rgba_rows(source_path: Path) -> tuple[int, int, list[bytes]]:
    data = source_path.read_bytes()
    if not data.startswith(PNG_SIGNATURE):
        raise ValueError(f"{source_path} is not a PNG file")

    offset = len(PNG_SIGNATURE)
    ihdr: bytes | None = None
    compressed_parts: list[bytes] = []
    while offset < len(data):
        length = struct.unpack(">I", data[offset : offset + 4])[0]
        chunk_type = data[offset + 4 : offset + 8]
        payload = data[offset + 8 : offset + 8 + length]
        offset += 12 + length
        if chunk_type == b"IHDR":
            ihdr = payload
        elif chunk_type == b"IDAT":
            compressed_parts.append(payload)
        elif chunk_type == b"IEND":
            break

    if ihdr is None or not compressed_parts:
        raise ValueError("The source PNG is missing required chunks")

    width, height, bit_depth, color_type, compression, filter_method, interlace = (
        struct.unpack(">IIBBBBB", ihdr)
    )
    if (bit_depth, color_type, compression, filter_method, interlace) != (
        8,
        6,
        0,
        0,
        0,
    ):
        raise ValueError(
            "Expected a non-interlaced 8-bit RGBA PNG; "
            f"got bit_depth={bit_depth}, color_type={color_type}, interlace={interlace}"
        )

    stride = width * BYTES_PER_PIXEL
    filtered = zlib.decompress(b"".join(compressed_parts))
    expected_length = height * (stride + 1)
    if len(filtered) != expected_length:
        raise ValueError(
            f"Unexpected decoded PNG length: {len(filtered)}; expected {expected_length}"
        )

    rows: list[bytes] = []
    previous = bytearray(stride)
    position = 0
    for _ in range(height):
        filter_type = filtered[position]
        position += 1
        encoded = filtered[position : position + stride]
        position += stride
        decoded = bytearray(stride)
        for index, value in enumerate(encoded):
            left = decoded[index - BYTES_PER_PIXEL] if index >= BYTES_PER_PIXEL else 0
            up = previous[index]
            upper_left = (
                previous[index - BYTES_PER_PIXEL] if index >= BYTES_PER_PIXEL else 0
            )
            if filter_type == 0:
                predictor = 0
            elif filter_type == 1:
                predictor = left
            elif filter_type == 2:
                predictor = up
            elif filter_type == 3:
                predictor = (left + up) // 2
            elif filter_type == 4:
                predictor = paeth(left, up, upper_left)
            else:
                raise ValueError(f"Unsupported PNG filter type: {filter_type}")
            decoded[index] = (value + predictor) & 0xFF
        rows.append(bytes(decoded))
        previous = decoded

    return width, height, rows


def write_square_png(
    output_path: Path,
    width: int,
    height: int,
    rows: list[bytes],
) -> int:
    canvas_size = math.ceil(max(width, height) / 48) * 48
    left_padding = (canvas_size - width) // 2
    top_padding = (canvas_size - height) // 2
    transparent_row = bytes(canvas_size * BYTES_PER_PIXEL)
    output_rows = [transparent_row for _ in range(canvas_size)]
    source_stride = width * BYTES_PER_PIXEL

    for source_y, source_row in enumerate(rows):
        destination = bytearray(transparent_row)
        start = left_padding * BYTES_PER_PIXEL
        destination[start : start + source_stride] = source_row
        output_rows[top_padding + source_y] = bytes(destination)

    raw_output = b"".join(b"\x00" + row for row in output_rows)
    output_ihdr = struct.pack(
        ">IIBBBBB", canvas_size, canvas_size, 8, 6, 0, 0, 0
    )
    output_png = (
        PNG_SIGNATURE
        + make_chunk(b"IHDR", output_ihdr)
        + make_chunk(b"IDAT", zlib.compress(raw_output, level=9))
        + make_chunk(b"IEND", b"")
    )
    output_path.write_bytes(output_png)

    written_width, written_height = struct.unpack(">II", output_png[16:24])
    if written_width != written_height or written_width < 48:
        raise ValueError(
            f"Generated favicon is invalid: {written_width}x{written_height}"
        )
    return canvas_size


def update_index(index_path: Path, canvas_size: int) -> None:
    html = index_path.read_text(encoding="utf-8")
    old = '''  <link rel="icon" type="image/png" href="./assets/pieces/app_icon.png">
  <link rel="apple-touch-icon" href="./assets/pieces/app_icon.png">'''
    new = f'''  <link rel="icon" type="image/png" sizes="{canvas_size}x{canvas_size}" href="/favicon.png">
  <link rel="apple-touch-icon" href="/favicon.png">'''
    if old not in html:
        raise ValueError("Expected favicon markup was not found in index.html")
    index_path.write_text(html.replace(old, new, 1), encoding="utf-8")


def main() -> None:
    source_path = Path("assets/pieces/app_icon.png")
    output_path = Path("favicon.png")
    index_path = Path("index.html")

    width, height, rows = read_rgba_rows(source_path)
    canvas_size = write_square_png(output_path, width, height, rows)
    update_index(index_path, canvas_size)
    print(f"Generated {output_path}: {canvas_size}x{canvas_size}")


if __name__ == "__main__":
    main()
