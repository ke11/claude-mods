# clawd — pixbar's land creature. 21 x 10, four working poses + idle.
#
# The creature itself is 16 wide, traced by measurement rather than by eye:
# module 26.375px, every silhouette edge on an integer multiple, symmetric about
# column 7.5. Columns 16-20 are the wand and its sparkle, which exist only while
# Claude is working.
#
# The eyes narrow to > < on the working poses and open to a plain bar when idle.
# They are the one part of the body that moves while the rest is frozen, and they
# get away with it because they sit inside the silhouette rather than on its edge:
# nothing shifts, so nothing competes with the sparkle for attention. A state
# change, not a motion.
SKIN_NAME="clawd"
NFRAMES=4                  # working poses; index 4 is the parked idle pose
W=21
SKIN_BASE='203;123;95'     # #CB7B5F  sampled off the source art
SKIN_GAUGE='154;90;68'    # #9A5A44  clawd in shadow: it darkens from the feet up as context fills.
                           #          Not red (read as bleeding), not grey: its own terracotta, shaded.
SKIN_CREAM='250;249;245'   # #FAF9F5  uncommitted worktree
SKIN_INK2='122;115;106'    # the wand. The sticker draws it BLACK, which is
                           # invisible on a dark bar - the value has to invert
                           # so the stick still reads as an object being held.
SKIN_INK3='242;201;119'    # #F2C977  the sparkle, sampled off the sticker
SKIN_INK4='251;234;184'    # #FBEAB8  its bright tone. The sticker mixes gold and
                           # WHITE squares; pure white here would read as the
                           # cream a dirty worktree paints, so this stays in the
                           # gold family and only lifts the value.
IDLE_FRAME=4
FAST_A=0; FAST_B=2         # no wand <-> full burst: the largest change there is
HABITAT='land'             # clawd walks: the mod draws it on land, not in the sea
RIDE='skateboard'          # and skates while it answers; at rest the board leans beside it

# The hands - the two nubs the wide bar puts outside the body, cols 0-1 and
# 14-15. They take the role the whale's fluke has: what an uncommitted worktree
# paints. Hands, not feet, because uncommitted work is something Clawd is
# HOLDING; and being the outermost pixels they stay legible at a glance even
# when the context gauge has flooded everything behind them.
#
# The wand and sparkle are accent ink, so git and the gauge never touch them.
DIRTY=(
  "000000000000000000000" "000000000000000000000" "000000000000000000000"
  "000000000000000000000" "110000000000001100000" "110000000000001100000"
  "000000000000000000000" "000000000000000000000" "000000000000000000000"
  "000000000000000000000"
)

# The beat is the wand coming out and the particles building: empty hand, spark,
# full burst, scattering. The particle field is cols 16-20 over rows 0-8 and every
# frame scatters it differently, so it twinkles rather than pulses - at one frame
# a second a field that only grew and shrank read as a throb. Two tones alternate
# inside it for the same reason.
#
# THE BODY DOES NOT MOVE. Hands, feet and the arm bar are byte-identical in all
# five frames; only the tail columns and, at idle, the eyes differ. An earlier
# build walked the legs and swung the free arm underneath the wand, and the two
# motions fought: at 1 fps the eye cannot follow a gait and a sparkle at once, and
# the twitching feet stole attention from the thing that was actually changing.
FRAMES=(
  # 0 - default body: the hand is empty
  "001111111111110000000" "001101111110110000000" "001110111101110000000" "001101111110110000000"
  "111111111111111100000" "111111111111111100000" "001111111111110000000" "001111111111110000000"
  "000101000010100000000" "000101000010100000000"
  # 1 - the wand lights: a first pair of motes at the tip
  "001111111111110000000" "001101111110110000000" "001110111101110000030" "001101111110110000400"
  "111111111111111122340" "111111111111111100030" "001111111111110000000" "001111111111110000000"
  "000101000010100000000" "000101000010100000000"
  # 2 - full burst: 16 motes, both tones, gaps between every one
  "001111111111110000030" "001101111110110000403" "001110111101110003040" "001101111110110000304"
  "111111111111111122430" "111111111111111100340" "001111111111110003030" "001111111111110000403"
  "000101000010100000030" "000101000010100000000"
  # 3 - scattering: fewer motes, thrown further out
  "001111111111110000003" "001101111110110000300" "001110111101110000040" "001101111110110000003"
  "111111111111111122300" "111111111111111100040" "001111111111110000300" "001111111111110000003"
  "000101000010100000030" "000101000010100000000"
  # 4 - idle: no wand, and the eyes open back up to a plain bar
  "001111111111110000000" "001111111111110000000" "001101111110110000000" "001101111110110000000"
  "111111111111111100000" "111111111111111100000" "001111111111110000000" "001111111111110000000"
  "000101000010100000000" "000101000010100000000"
)
