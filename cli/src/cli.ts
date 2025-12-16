#!/usr/bin/env node

import { defineCommand, runMain } from 'citty'
import { runCheck } from './commands/check.js'
import { runGenerateMain, runGenerateTarget } from './commands/generate.js'

runMain(defineCommand({
  meta: {
    name: 'binkit',
    version: '1.0.0',
    description: 'BinKit - The Binary Toolkit',
  },
  subCommands: {
    check: defineCommand({
      meta: {
        name: 'check',
        description: 'Check for unpublished versions',
      },
      run: runCheck,
    }),
    main: defineCommand({
      meta: {
        name: 'main',
        description: 'Generate main package only',
      },
      args: {
        name: {
          type: 'positional',
          description: 'Tool name',
          required: true,
        },
        version: {
          type: 'positional',
          description: 'Upstream version',
          required: true,
        },
      },
      run: ({ args }) => runGenerateMain(args.name as string, args.version as string),
    }),
    target: defineCommand({
      meta: {
        name: 'target',
        description: 'Generate target package and download binaries',
      },
      args: {
        name: {
          type: 'positional',
          description: 'Tool name',
          required: true,
        },
        version: {
          type: 'positional',
          description: 'Upstream version',
          required: true,
        },
      },
      run: ({ args }) => runGenerateTarget(args.name as string, args.version as string),
    }),
  },
}))
