# usage: rr.sh TAG item...   (TAG dir = /workspace/v7f-gear-work/TAG/fit); renders textured + magenta-body diagnostic, runtime body mask
cd /workspace/v7f-gear-work; B=/workspace/tools/blender/blender; export RES=${RES:-640} TZ_=0.62 DIST=2.5; s=$1; shift
for it in "$@"; do case $it in cloth_coat) export CREAM="#f3efe6" BACK="#c8302c";; cloth_suit) unset CREAM; export BACK="#b3201f";; cloth_shirt) export CREAM="#3a2414" BACK="#f4efe3";; cloth_tank) unset CREAM; export BACK="#f1ede2";; cloth_tshirt) export CREAM="#f3efe6" BACK="#222c4e";; esac; f=$s/fit/${it}_female_hi.glb; [ $s = before ] && f=dec/${it}_female_hi.glb
 python3 b3/mask.py dec/body_female_v7_hi.glb $f b3/body_${it}_${s}.glb >/dev/null; export BODY=b3/body_${it}_${s}.glb
 VIEWS="front q34 back" $B -b -noaudio --python b3/rend3.py -- $f b3/r/${it}_${s} >/dev/null 2>&1 &
 VIEWS="q34 back" POSE=walk:6 $B -b -noaudio --python b3/rend3.py -- $f b3/r/${it}_${s}_walk6 >/dev/null 2>&1 &
 VIEWS="side" POSE=walk:16 $B -b -noaudio --python b3/rend3.py -- $f b3/r/${it}_${s}_walk16 >/dev/null 2>&1 &
 DIAG=1 FLAT=1 VIEWS="front q34 back" $B -b -noaudio --python b3/rend3.py -- $f b3/r/${it}_${s}_dg >/dev/null 2>&1 &
 DIAG=1 FLAT=1 VIEWS="q34 back" POSE=walk:6 $B -b -noaudio --python b3/rend3.py -- $f b3/r/${it}_${s}_dg_walk6 >/dev/null 2>&1 &
 wait; done
