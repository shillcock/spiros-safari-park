#!/usr/bin/env python3
"""Statically recover Python 2.3 code from the original py2exe executable.

Run with the pinned dependencies in requirements.txt. This does not execute the
Windows program or its embedded Python code. Outputs go beside this script.
"""
from pathlib import Path
import hashlib
import struct

import pefile
from uncompyle6.main import decompile
from xdis.disasm import disco
from xdis.magics import by_version, magic2int
from xdis.unmarshal import load_code

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = Path(__file__).resolve().parent
EXE = ROOT / "CD_ROM" / "spiro.exe"


def main():
    pe = pefile.PE(str(EXE))
    resources = [
        entry for entry in pe.DIRECTORY_ENTRY_RESOURCE.entries
        if str(entry.name) == "PYTHONSCRIPT"
    ]
    if len(resources) != 1:
        raise ValueError("Expected exactly one PYTHONSCRIPT resource")
    data = resources[0].directory.entries[0].directory.entries[0].data.struct
    resource = pe.get_data(data.OffsetToData, data.Size)
    # py2exe header: tag, optimize, unbuffered, marshaled-size; then a
    # NUL-terminated archive name followed by a marshaled list of code objects.
    tag, optimize, unbuffered, declared_size = struct.unpack_from("<4I", resource)
    if tag != 0x78563412:
        raise ValueError(f"Unexpected py2exe resource tag: {tag:#x}")
    archive_end = resource.index(b"\0", 16)
    payload = resource[archive_end + 1:]
    magic = magic2int(by_version["2.3"])
    codes = load_code(payload, magic)
    expected = {"boot_common.py": "boot_common.py", "spiro.pyw": "spiro.py"}
    for code in codes:
        basename = code.co_filename.replace("\\", "/").rsplit("/", 1)[-1]
        name = expected[basename]
        with (OUTPUT / name).open("w") as out:
            decompile(code, bytecode_version=(2, 3), out=out, magic_int=magic)
        with (OUTPUT / (name + ".dis")).open("w") as out:
            disco((2, 3), code, timestamp=None, out=out, magic_int=magic)
        print(f"Recovered {code.co_filename} -> {name}")
    print(f"Executable SHA-256: {hashlib.sha256(EXE.read_bytes()).hexdigest()}")
    print(f"Resource: {len(resource)} bytes; payload: {len(payload)} bytes; "
          f"declared size: {declared_size}; optimize: {optimize}; "
          f"unbuffered: {unbuffered}")


if __name__ == "__main__":
    main()
