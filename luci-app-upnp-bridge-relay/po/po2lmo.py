#!/usr/bin/env python3

import sys
import struct


def sfhash(key):
    h = 0
    for c in key:
        h = (h * 16777619) ^ ord(c)
    return h & 0xFFFFFFFF


def parse_po(path):
    entries = []
    msgid = None
    msgstr = None
    in_msgid = False
    in_msgstr = False
    msgid_lines = []
    msgstr_lines = []

    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")

            if line.startswith("msgid "):
                if msgid is not None and msgstr is not None:
                    if msgstr:
                        entries.append((msgid, msgstr))
                in_msgid = True
                in_msgstr = False
                msgid_lines = [line[6:]]
                msgstr_lines = []
            elif line.startswith("msgstr "):
                in_msgid = False
                in_msgstr = True
                msgstr_lines = [line[7:]]
            elif line.startswith('"') and in_msgid:
                msgid_lines.append(line)
            elif line.startswith('"') and in_msgstr:
                msgstr_lines.append(line)
            else:
                if msgid is not None and msgstr is not None:
                    if msgstr:
                        entries.append((msgid, msgstr))
                in_msgid = False
                in_msgstr = False
                msgid = None
                msgstr = None
                msgid_lines = []
                msgstr_lines = []
                continue

            if in_msgid and msgid_lines:
                raw = "".join(
                    l.strip().strip('"') for l in msgid_lines
                )
                msgid = raw.replace("\\n", "\n").replace("\\t", "\t").replace('\\"', '"').replace("\\\\", "\\")
            if in_msgstr and msgstr_lines:
                raw = "".join(
                    l.strip().strip('"') for l in msgstr_lines
                )
                msgstr = raw.replace("\\n", "\n").replace("\\t", "\t").replace('\\"', '"').replace("\\\\", "\\")

    if msgid is not None and msgstr is not None:
        if msgstr:
            entries.append((msgid, msgstr))

    return entries


def compile_lmo(entries, output_path):
    data = bytearray()
    table = []

    for msgid, msgstr in entries:
        key_offset = len(data)
        key_bytes = msgid.encode("utf-8") + b"\x00"
        data.extend(key_bytes)

        val_offset = len(data)
        val_bytes = msgstr.encode("utf-8") + b"\x00"
        data.extend(val_bytes)

        h = sfhash(msgid)
        table.append((h, key_offset, len(key_bytes) - 1, val_offset, len(val_bytes) - 1))

    table.sort(key=lambda e: e[0])

    with open(output_path, "wb") as f:
        for h, ko, kl, vo, vl in table:
            f.write(struct.pack(">IHHHH", h, ko, kl, vo, vl))
        f.write(bytes(data))


def main():
    if len(sys.argv) != 3:
        print("Usage: %s <input.po> <output.lmo>" % sys.argv[0], file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    entries = parse_po(input_path)
    compile_lmo(entries, output_path)


if __name__ == "__main__":
    main()
