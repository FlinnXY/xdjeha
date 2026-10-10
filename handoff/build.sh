#!/bin/bash
cd /home/claude/mod/parts && cat $(ls *.js | sort) > /home/claude/Humanitize2.js && node --check /home/claude/Humanitize2.js && echo BUILD_OK && wc -l /home/claude/Humanitize2.js
