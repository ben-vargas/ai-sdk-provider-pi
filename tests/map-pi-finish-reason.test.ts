import { describe, expect, it } from 'vitest';

import { mapPiFinishReason } from '../src/map-pi-finish-reason.js';

describe('mapPiFinishReason', () => {
  it('maps all known stop reasons', () => {
    expect(mapPiFinishReason('stop')).toEqual({ unified: 'stop', raw: 'stop' });
    expect(mapPiFinishReason('length')).toEqual({ unified: 'length', raw: 'length' });
    expect(mapPiFinishReason('toolUse')).toEqual({ unified: 'tool-calls', raw: 'toolUse' });
    expect(mapPiFinishReason('error')).toEqual({ unified: 'error', raw: 'error' });
    expect(mapPiFinishReason('aborted')).toEqual({ unified: 'other', raw: 'aborted' });
  });
});
