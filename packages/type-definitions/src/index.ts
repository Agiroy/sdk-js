/**
 * Copyright (c) 2018-2022, BOTLabs GmbH.
 *
 * This source code is licensed under the BSD 4-Clause "Original" license
 * found in the LICENSE file in the root directory of this source tree.
 */

import type { OverrideBundleDefinition } from '@polkadot/types/types'

import { types8 } from './types_8.js'
import { types9 } from './types_9.js'
import { types10 } from './types_10.js'
import { types12 } from './types_12.js'
import { types17 } from './types_17.js'
import { types18 } from './types_18.js'
import { types19 } from './types_19.js'
import { types20 } from './types_20.js'
import { types21 } from './types_21.js'
import { types23 } from './types_23.js'
import { types25 } from './types_25.js'
import { types2700 } from './types_2700.js'
import { types10720 } from './types_10720.js'
import { types10900 } from './types_10900.js'

import runtime from './runtime.js'
import rpc from './rpc.js'

// Export type definitions
export {
  types8,
  types9,
  types10,
  types12,
  types17,
  types18,
  types19,
  types20,
  types21,
  types23,
  types25,
  types2700,
  types10720,
  types10900,
  // TODO: Change to types10900 when deployed to Spiritnet
  types10720 as latest,
}

// Export runtime APIs definitions
export { runtime }

// Export custom RPC definitions
export { rpc }

// Export complete package
export const typeBundleForPolkadot: OverrideBundleDefinition = {
  types: [
    {
      minmax: [0, 8],
      types: types8,
    },
    {
      minmax: [9, 9],
      types: types9,
    },
    {
      minmax: [10, 11],
      types: types10,
    },
    {
      minmax: [12, 16],
      types: types12,
    },
    {
      minmax: [17, 17],
      types: types17,
    },
    {
      minmax: [18, 18],
      types: types18,
    },
    {
      minmax: [19, 19],
      types: types19,
    },
    {
      minmax: [20, 20],
      types: types20,
    },
    {
      minmax: [21, 22],
      types: types21,
    },
    {
      minmax: [23, 24],
      types: types23,
    },
    {
      minmax: [25, 2699],
      types: types25,
    },
    {
      minmax: [2700, 10710],
      types: types2700,
    },
    {
      minmax: [10720, 10899],
      types: types10720,
    },
    {
      minmax: [10900, undefined],
      types: types10900,
    },
  ],
  runtime,
  rpc,
}