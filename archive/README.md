# Original CD-ROM files — April 2004

`spiros-safari-park-original-cd-2004.zip` preserves the complete `CD_ROM/`
directory supplied with this project: the packaged Windows game (`spiro.exe`),
Python 2.3/Pygame dependencies, original images, recordings, and font.

This is an archive of the supplied directory, not a sector-level disc image.
All 61 files were verified byte-for-byte against that directory before its loose
copy was removed. The ZIP retains the `CD_ROM/` top-level directory, file
modification times, and stored Unix permissions. The original executable was
not run as part of archival verification.

The archive is committed here so the original artifact and restoration stay
together. Treat it as immutable reference material, not runtime game assets.
Neither browser edition loads anything from it.

## Verify

From the repository root:

```sh
(cd archive && shasum -a 256 -c SHA256SUMS)
```

`SHA256SUMS` records the checksum of the ZIP itself. The original executable's
SHA-256 is:

```text
a8b088ea5350e8af34f4779b28ec859eaf958b4f1f0b4e107b44416d77aab4f7
```

## Restore

From the repository root, with no existing `CD_ROM/` directory:

```sh
unzip archive/spiros-safari-park-original-cd-2004.zip
```

This recreates `CD_ROM/`, which remains ignored by Git. To repeat the static
Python recovery, follow `recovery/README.md` after extraction. You can remove the
extracted directory again when finished; retain this committed archive.

For public deployment, publish only the root redirect and the `v1/` and `v2/`
directories. This historical archive need not be hosted with the playable site.
Archival inclusion does not establish redistribution rights for the bundled
third-party libraries, font, or music.
