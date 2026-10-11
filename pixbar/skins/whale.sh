# whale — pixbar's default creature. 15 x 10, four beat frames + idle, traced off
# a 128x128 GIF (4 frames at 5fps, one pixel every 6px — the module
# size is the gcd of every ink run, measured rather than guessed).
#
# The whale is also built into the mod (WHALE in hooks/scene.ts), so it still swims
# when no skin file can be read. This file is the same whale in skin form: an example
# of the format, kept identical to the built-in one by a test. Change both together.
SKIN_NAME="whale"
HABITAT='sea'              # swims; clawd sets land
NFRAMES=4                  # beat frames; index 4 is the parked idle pose
W=15                       # sprite width in pixels; canvas is W+2 (gap + tick)
SKIN_BASE='247;147;26'     # #F7931A
SKIN_GAUGE='216;105;94'    # #D8695E  context window, fills bottom-up
SKIN_CREAM='250;249;245'   # #FAF9F5  uncommitted worktree
IDLE_FRAME=4               # the parked rest pose
FAST_A=1; FAST_B=0         # 54px apart: the only pair that swings body AND fluke

# The fluke. The one part that reads as "the animal's business end", so it is
# what an uncommitted worktree paints.
DIRTY=(
  "000000000001111" "000000000001111" "000000000001111" "000000000001111" "000000000001111"
  "000000000001111" "000000000001111" "000000000001111" "000000000001111" "000000000001111"
)

FRAMES=(
  # 0 - tail down
  "000000000000000" "000000000000000" "111111111110111" "111111111111111" "110111111111110"
  "111111111111100" "111111111111100" "000001111110110" "111111111100011" "000001100000011"
  # 1 - rest, body up
  "000000000000011" "111111111110111" "111111111111110" "110111111111100" "111111111111100"
  "111111111111110" "000001111110111" "111111111100011" "000001100000000" "000000000000000"
  # 2 - tail up
  "000000000000011" "000000000000011" "111111111110110" "111111111111100" "110111111111100"
  "111111111111110" "111111111111111" "000001111110111" "111111111100000" "000001100000000"
  # 3 - rest, body down
  "000000000000000" "000000000000011" "111111111110111" "111111111111110" "110111111111100"
  "111111111111100" "111111111111110" "000001111110111" "111111111100011" "000001100000000"
  # 4 - idle: the rest pose, one blank row above and none below is the closest
  #     a 9-row whale gets to centred in 10 rows
  "000000000000000" "000000000000011" "111111111110111" "111111111111110" "110111111111100"
  "111111111111100" "111111111111110" "000001111110111" "111111111100011" "000001100000000"
)
