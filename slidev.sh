#!/bin/bash

# Pass all arguments to the bun command
bun packages/slidev/node/cli.ts "$@"

# example: slidev.sh --port 3030 --base /foo/ --viteFsAllow /Users/bran/localProjects/slidev/