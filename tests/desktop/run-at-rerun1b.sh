#!/usr/bin/env bash
# run-at-rerun1b.sh — AT19 boundary probe: an approximate restore whose
# fallback has NO block (all heading candidates renamed -> reason 'top',
# blockId null) must still scroll and show nav.return.approx. Discriminates
# the blockId-null path from the heading/ancestor fallback path.
AT_GROUP=rerun1b
export AT_EVIDENCE="${AT_EVIDENCE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/artifacts/70-verification/evidence/at-rerun}"
source "$(dirname "${BASH_SOURCE[0]}")/acceptance-lib.sh"
group_header "AT19 approx-top boundary probe (wp-34b)"
ensure_helper
fix_conditions
reset_data

A19B="$INPUTS/at19b"
mkdir -p "$A19B"
cp "$FIXTURES/reader-min/reader-min.md" "$A19B/doc.md"

launch_app "$A19B/doc.md"
sleep 2
dismiss_modal "at19b-prompt-a" 3
wheel 640 400 5 4
sleep 3
shot "at19-r2-h-before-heading-rewrite.png"
terminate_app
db_dump "AT19b after seed exit (expect positions row)"

python3 - "$A19B/doc.md" <<'PY'
import sys
p = sys.argv[1]
text = open(p, encoding='utf-8').read()
assert '块公式：' in text
text = text.replace('# PaperStack 阅读样例（wp-19 冒烟）', '# PaperStack 阅读样例（修订版）')
text = text.replace('## 数学公式', '## 数学（修订版）')
text = text.replace('块公式：', '块公式（改写）：')
open(p, 'w', encoding='utf-8').write(text)
print('headings + anchor rewritten -> top fallback')
PY

launch_app
sleep 3.5
dismiss_modal "at19b-prompt-b" 3
shot "at19-r2-i-approx-top-label.png"
terminate_app
db_dump "AT19b after top-fallback exit"

group_footer
