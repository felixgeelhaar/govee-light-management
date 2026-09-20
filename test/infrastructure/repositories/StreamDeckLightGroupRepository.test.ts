/**
 * StreamDeckLightGroupRepository — the adapter that persists light groups in
 * Stream Deck's global settings.
 *
 * This is an infrastructure adapter, so the boundary being faked is the
 * Stream Deck settings API itself (an in-memory settings bag). The domain
 * objects that travel across it are real.
 *
 * The storage envelope is `{ version, groups }` under the key
 * `govee_v1_lightGroups`; the current version is "1.1" and "1.0" is a legacy
 * version that must be migrated rather than discarded — a bug there silently
 * drops every group a user ever saved.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import streamDeck from "@elgato/streamdeck";
import { StreamDeckLightGroupRepository } from "@/backend/infrastructure/repositories/StreamDeckLightGroupRepository";
import { LightGroup } from "@/backend/domain/entities/LightGroup";
import { Light } from "@/backend/domain/entities/Light";
import type { LightState } from "@/backend/domain/value-objects/LightState";

const STORAGE_KEY = "govee_v1_lightGroups";
const CURRENT_VERSION = "1.1";

const settingsApi = streamDeck.settings as unknown as {
  getGlobalSettings: ReturnType<typeof vi.fn>;
  setGlobalSettings: ReturnType<typeof vi.fn>;
};

const makeLight = (
  deviceId: string,
  model = "H6110",
  name = deviceId,
): Light => {
  const state: LightState = {
    isOn: false,
    isOnline: true,
    brightness: undefined,
    color: undefined,
    colorTemperature: undefined,
  };
  return Light.create(deviceId, model, name, state);
};

describe("StreamDeckLightGroupRepository", () => {
  let repository: StreamDeckLightGroupRepository;
  /** The fake Stream Deck global settings bag. */
  let globalSettings: Record<string, unknown>;

  const storedEnvelope = (): { version: string; groups: unknown[] } =>
    globalSettings[STORAGE_KEY] as { version: string; groups: unknown[] };

  beforeEach(() => {
    globalSettings = {};
    settingsApi.getGlobalSettings.mockImplementation(
      async () => globalSettings,
    );
    settingsApi.setGlobalSettings.mockImplementation(
      async (next: Record<string, unknown>) => {
        globalSettings = next;
      },
    );
    repository = new StreamDeckLightGroupRepository();
  });

  describe("an empty or absent store", () => {
    it("reports no groups when nothing has ever been saved", async () => {
      expect(await repository.getAllGroups()).toEqual([]);
    });

    it("reports no groups when the settings bag holds unrelated keys only", async () => {
      globalSettings = { apiKey: "secret" };

      expect(await repository.getAllGroups()).toEqual([]);
    });
  });

  describe("the serialize / deserialize round trip", () => {
    it("returns a saved group with its identity, name and lights intact", async () => {
      const group = LightGroup.create("g1", "Office", [
        makeLight("dev-1", "H6110", "Desk"),
        makeLight("dev-2", "H6159", "Shelf"),
      ]);

      await repository.saveGroup(group);
      const [restored] = await repository.getAllGroups();

      expect(restored.id).toBe("g1");
      expect(restored.name).toBe("Office");
      expect(
        restored.lights.map((l) => [l.deviceId, l.model, l.name]).sort(),
      ).toEqual([
        ["dev-1", "H6110", "Desk"],
        ["dev-2", "H6159", "Shelf"],
      ]);
    });

    it("stamps the stored envelope with the current storage version", async () => {
      await repository.saveGroup(LightGroup.create("g1", "Office", []));

      expect(storedEnvelope().version).toBe(CURRENT_VERSION);
    });

    it("keeps every other global setting when it writes", async () => {
      globalSettings = { apiKey: "secret" };

      await repository.saveGroup(LightGroup.create("g1", "Office", []));

      expect(globalSettings.apiKey).toBe("secret");
    });

    it("replaces a group saved under an id it already holds", async () => {
      await repository.saveGroup(
        LightGroup.create("g1", "Office", [makeLight("dev-1")]),
      );
      await repository.saveGroup(
        LightGroup.create("g1", "Studio", [
          makeLight("dev-1"),
          makeLight("dev-2"),
        ]),
      );

      const all = await repository.getAllGroups();
      expect(all).toHaveLength(1);
      expect(all[0].name).toBe("Studio");
      expect(all[0].size).toBe(2);
    });

    it("keeps groups saved under different ids side by side", async () => {
      await repository.saveGroup(LightGroup.create("g1", "Office", []));
      await repository.saveGroup(LightGroup.create("g2", "Studio", []));

      expect((await repository.getAllGroups()).map((g) => g.id).sort()).toEqual(
        ["g1", "g2"],
      );
    });

    it("round-trips a group that holds no lights", async () => {
      await repository.saveGroup(LightGroup.create("g1", "Empty", []));

      const [restored] = await repository.getAllGroups();
      expect(restored.isEmpty).toBe(true);
    });
  });

  describe("migrating a v1.0 store", () => {
    const legacyStore = () => {
      globalSettings = {
        apiKey: "secret",
        [STORAGE_KEY]: {
          version: "1.0",
          groups: [
            {
              id: "g1",
              name: "Office",
              lights: [{ deviceId: "dev-1", model: "H6110", name: "Desk" }],
            },
            { id: "g2", name: "Studio", lights: [] },
          ],
        },
      };
    };

    it("keeps every group a v1.0 store held", async () => {
      legacyStore();

      const all = await repository.getAllGroups();

      expect(all.map((g) => g.name).sort()).toEqual(["Office", "Studio"]);
      expect(all.find((g) => g.id === "g1")?.lights[0].name).toBe("Desk");
    });

    it("finds a group in a v1.0 store by id", async () => {
      legacyStore();

      expect((await repository.findGroupById("g2"))?.name).toBe("Studio");
    });

    it("persists the version bump as soon as the store is read", async () => {
      legacyStore();

      await repository.getAllGroups();

      expect(storedEnvelope().version).toBe(CURRENT_VERSION);
      expect(storedEnvelope().groups).toHaveLength(2);
    });

    it("writes the migrated groups back under the current version", async () => {
      legacyStore();

      await repository.saveGroup(LightGroup.create("g3", "Hall", []));

      expect(storedEnvelope().version).toBe(CURRENT_VERSION);
      expect(storedEnvelope().groups).toHaveLength(3);
    });
  });

  describe("a store written by a version this code does not know", () => {
    it("starts fresh rather than deserializing an unrecognised shape", async () => {
      globalSettings = {
        [STORAGE_KEY]: {
          version: "9.9",
          groups: [{ id: "g1", name: "From The Future", lights: [] }],
        },
      };

      expect(await repository.getAllGroups()).toEqual([]);
    });

    it("starts fresh when the envelope carries no version at all", async () => {
      globalSettings = {
        [STORAGE_KEY]: {
          groups: [{ id: "g1", name: "Unversioned", lights: [] }],
        },
      };

      expect(await repository.getAllGroups()).toEqual([]);
    });
  });

  describe("looking groups up", () => {
    beforeEach(async () => {
      await repository.saveGroup(
        LightGroup.create("g1", "Office", [makeLight("dev-1")]),
      );
      await repository.saveGroup(LightGroup.create("g2", "Studio", []));
    });

    it("finds a group by id", async () => {
      expect((await repository.findGroupById("g1"))?.name).toBe("Office");
    });

    it("reports null for an id it does not hold", async () => {
      expect(await repository.findGroupById("nope")).toBeNull();
    });

    it("matches a name regardless of case", async () => {
      const found = await repository.findGroupsByName("oFFiCe");

      expect(found.map((g) => g.id)).toEqual(["g1"]);
    });

    it("reports no match for a name it does not hold", async () => {
      expect(await repository.findGroupsByName("Hall")).toEqual([]);
    });
  });

  describe("name availability", () => {
    beforeEach(async () => {
      await repository.saveGroup(LightGroup.create("g1", "Office", []));
    });

    it("refuses a name another group already holds, whatever its case", async () => {
      expect(await repository.isGroupNameAvailable("office")).toBe(false);
    });

    it("allows an unused name", async () => {
      expect(await repository.isGroupNameAvailable("Hall")).toBe(true);
    });

    it("lets a group keep its own name when it is excluded", async () => {
      expect(await repository.isGroupNameAvailable("Office", "g1")).toBe(true);
    });
  });

  describe("deleting", () => {
    it("removes the named group and leaves the others", async () => {
      await repository.saveGroup(LightGroup.create("g1", "Office", []));
      await repository.saveGroup(LightGroup.create("g2", "Studio", []));

      await repository.deleteGroup("g1");

      expect((await repository.getAllGroups()).map((g) => g.id)).toEqual([
        "g2",
      ]);
    });

    it("leaves the store untouched when the group is not there", async () => {
      await repository.saveGroup(LightGroup.create("g1", "Office", []));
      settingsApi.setGlobalSettings.mockClear();

      await expect(repository.deleteGroup("nope")).resolves.toBeUndefined();

      expect(settingsApi.setGlobalSettings).not.toHaveBeenCalled();
      expect(await repository.getAllGroups()).toHaveLength(1);
    });
  });

  describe("when the Stream Deck settings API fails to write", () => {
    const boom = new Error("settings unavailable");

    /** Every error in the chain, so a re-wrap cannot hide the root cause. */
    const causeChain = (error: unknown): unknown[] => {
      const chain: unknown[] = [];
      let current: unknown = error;
      while (current instanceof Error && current.cause !== undefined) {
        chain.push(current.cause);
        current = current.cause;
      }
      return chain;
    };

    it("reports a save failure and keeps the underlying error reachable", async () => {
      settingsApi.setGlobalSettings.mockRejectedValue(boom);

      const error = await repository
        .saveGroup(LightGroup.create("g1", "Office", []))
        .catch((e: unknown) => e);

      expect((error as Error).message).toContain("Failed to save group");
      expect(causeChain(error)).toContain(boom);
    });

    it("reports a delete failure and keeps the underlying error reachable", async () => {
      await repository.saveGroup(LightGroup.create("g1", "Office", []));
      settingsApi.setGlobalSettings.mockRejectedValue(boom);

      const error = await repository.deleteGroup("g1").catch((e: unknown) => e);

      expect((error as Error).message).toContain("Failed to delete group");
      expect(causeChain(error)).toContain(boom);
    });
  });

  describe("when the Stream Deck settings API fails to read", () => {
    const boom = new Error("settings unavailable");

    // getStorage rethrows, so each caller's own fail-safe applies: a failed
    // read no longer reads as "you have no groups".

    it("treats a name as taken while it cannot read the store", async () => {
      settingsApi.getGlobalSettings.mockRejectedValue(boom);

      expect(await repository.isGroupNameAvailable("Office")).toBe(false);
    });

    it("does not wipe the saved groups when one read fails before a save", async () => {
      await repository.saveGroup(LightGroup.create("g1", "Office", []));
      await repository.saveGroup(LightGroup.create("g2", "Studio", []));

      // One transient read failure, after which the API recovers.
      settingsApi.getGlobalSettings.mockRejectedValueOnce(boom);
      const error = await repository
        .saveGroup(LightGroup.create("g3", "Hall", []))
        .catch((e: unknown) => e);

      // The save fails and says so, rather than writing an envelope built
      // from a store it could not read. Retrying is the caller's call: a
      // repository that silently re-attempted the write would hide exactly
      // the outage the caller needs to know about.
      expect((error as Error).message).toContain("Failed to save group");

      // What matters: the groups the user already had are still there.
      expect((await repository.getAllGroups()).map((g) => g.id).sort()).toEqual(
        ["g1", "g2"],
      );
    });
  });
});
