/**
 * Custom ESLint plugin for Hydroscope architecture compliance
 * Enforces stateless bridge architecture and prevents violations
 */

import noBridgeState from './no-bridge-state.js';
import enforceBridgeInterfaces from './enforce-bridge-interfaces.js';

export default {
  rules: {
    'no-bridge-state': noBridgeState,
    'enforce-bridge-interfaces': enforceBridgeInterfaces,
  },
  configs: {
    recommended: {
      plugins: ['hydroscope-architecture'],
      rules: {
        'hydroscope-architecture/no-bridge-state': 'error',
        'hydroscope-architecture/enforce-bridge-interfaces': 'error',
      },
    },
  },
};