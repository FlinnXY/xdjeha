#!/bin/bash
# Concatenates parts/*.js (in filename order) into the single-file mod.
# Output: handoff/Humanitize2.js and a copy at the repository root (the file served by jsDelivr).
set -e
cd "$(dirname "$0")"
cat $(ls parts/*.js | sort) > Humanitize2.js
node --check Humanitize2.js
cp Humanitize2.js ../Humanitize2.js
echo BUILD_OK && wc -l Humanitize2.js
