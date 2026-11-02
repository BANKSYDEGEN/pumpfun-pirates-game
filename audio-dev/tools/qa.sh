#!/bin/bash
# duration, integrated LUFS, LRA, true peak, sample peak for each file
for f in "$@"; do
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
  r=$(ffmpeg -hide_banner -nostats -i "$f" -af ebur128=peak=true+sample -f null - 2>&1 | awk '/Integrated loudness/{f=1} f&&/I:/{i=$2} f&&/LRA:/{l=$2} /True peak:/{tp=1} tp&&/Peak:/{p=$2; tp=0} /Sample peak:/{sp=1} sp&&/Peak:/{s=$2; sp=0} END{printf "I=%s LUFS  LRA=%s  TP=%s dBTP  SP=%s dBFS", i,l,p,s}')
  printf "%-48s %6.2fs  %s\n" "$(basename "$f")" "$d" "$r"
done
