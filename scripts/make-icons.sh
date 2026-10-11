#!/usr/bin/env bash
# Regenera icons/icon-{16,32,48,128}.png (requiere ImageMagick). Dibujado a 512px y reducido.
set -euo pipefail
cd "$(dirname "$0")/.."
magick -size 512x512 xc:none \
  -fill '#1f56b5' -draw 'roundrectangle 0,0 511,511 112,112' \
  -fill '#2f7cf0' -draw 'roundrectangle 0,0 511,300 112,112' \
  -stroke white -strokewidth 36 -draw 'line 104,160 408,160' \
  -draw 'line 104,256 408,256' -draw 'line 104,352 408,352' \
  -stroke '#1b3f8f' -strokewidth 20 -fill '#ffd54a' \
  -draw 'circle 328,160 328,208' -draw 'circle 192,256 192,304' -draw 'circle 296,352 296,400' \
  /tmp/browser-tune-icon.png
for s in 16 32 48 128; do
  magick /tmp/browser-tune-icon.png -resize ${s}x${s} -depth 8 icons/icon-$s.png
done
