import { describe, it, expect } from 'vitest';
import { SnapshotOption } from '@/backend/domain/value-objects/SnapshotOption';

describe('SnapshotOption Value Object', () => {
  describe('create', () => {
    it('creates a snapshot option with the provided values', () => {
      const option = SnapshotOption.create(7, 42, 'My Scene');
      expect(option.id).toBe(7);
      expect(option.paramId).toBe(42);
      expect(option.name).toBe('My Scene');
    });

    it('trims whitespace from the name', () => {
      const option = SnapshotOption.create(1, 1, '  Party Mode  ');
      expect(option.name).toBe('Party Mode');
    });

    it('throws when the id is not an integer', () => {
      expect(() => SnapshotOption.create(1.5, 1, 'Scene')).toThrow(
        'Snapshot ID must be an integer',
      );
    });

    it('throws when the param id is not an integer', () => {
      expect(() => SnapshotOption.create(1, 1.5, 'Scene')).toThrow(
        'Snapshot param ID must be an integer',
      );
    });

    it('throws when the name is empty', () => {
      expect(() => SnapshotOption.create(1, 1, '')).toThrow(
        'Snapshot name is required',
      );
    });

    it('throws when the name is only whitespace', () => {
      expect(() => SnapshotOption.create(1, 1, '   ')).toThrow(
        'Snapshot name is required',
      );
    });
  });

  describe('Equality', () => {
    it('returns true for snapshots with identical fields', () => {
      const a = SnapshotOption.create(1, 2, 'Scene');
      const b = SnapshotOption.create(1, 2, 'Scene');
      expect(a.equals(b)).toBe(true);
    });

    it('returns false when the id differs', () => {
      const a = SnapshotOption.create(1, 2, 'Scene');
      const b = SnapshotOption.create(9, 2, 'Scene');
      expect(a.equals(b)).toBe(false);
    });

    it('returns false when the param id differs', () => {
      const a = SnapshotOption.create(1, 2, 'Scene');
      const b = SnapshotOption.create(1, 3, 'Scene');
      expect(a.equals(b)).toBe(false);
    });

    it('returns false when the name differs', () => {
      const a = SnapshotOption.create(1, 2, 'Scene A');
      const b = SnapshotOption.create(1, 2, 'Scene B');
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('Serialization', () => {
    it('serializes to a plain { id, paramId, name } object', () => {
      const option = SnapshotOption.create(1, 2, 'Scene');
      expect(option.toJSON()).toEqual({ id: 1, paramId: 2, name: 'Scene' });
    });
  });
});
