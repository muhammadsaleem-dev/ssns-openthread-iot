#!/bin/bash
# Wrapper to hide annoying JLinkARM.dll error spam on Apple Silicon
/Applications/Nordic\ Semiconductor/bin/nrfjprog "$@" 2>&1 | grep --line-buffered -v "\[error\] \[SeggerBackend\]"
exit ${PIPESTATUS[0]}
