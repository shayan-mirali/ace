#!/usr/bin/env sh
# Wraps src/page.html (the single source of truth) in a document skeleton so
# it opens straight from disk. src/page.html stays skeleton-free because that
# is the form the Artifact host expects — same file, both targets.
#
#   sh build.sh    ->  index.html
set -e
cd "$(dirname "$0")"

SRC=src/page.html
MARK='<!-- ============================ BOOT'

# everything above the first markup block is head material
# (title, font links, stylesheet); everything from it down is body
N=$(grep -n "$MARK" "$SRC" | head -1 | cut -d: -f1)
[ -n "$N" ] || { echo "build: marker not found in $SRC" >&2; exit 1; }

{
  printf '%s\n' \
    '<!doctype html>' \
    '<html lang="en">' \
    '<head>' \
    '<meta charset="utf-8">' \
    '<meta name="viewport" content="width=device-width,initial-scale=1">' \
    '<meta name="description" content="Ace Developers builds web platforms and mobile apps. Crafting digital futures with precision code.">' \
    '<meta name="theme-color" content="#03060e">' \
    '<meta property="og:title" content="Ace Developers">' \
    '<meta property="og:description" content="Crafting digital futures with precision code.">' \
    '<meta property="og:type" content="website">'
  head -n "$((N - 1))" "$SRC"
  printf '%s\n' '</head>' '<body>'
  tail -n "+$N" "$SRC"
  printf '%s\n' '</body>' '</html>'
} > index.html

echo "built index.html ($(wc -c < index.html) bytes)"
