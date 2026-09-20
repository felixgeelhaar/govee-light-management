/**
 * Business rules of LightGroupService.
 *
 * LightGroupService is pure domain logic: it coordinates the group repository
 * and the light repository, so the only doubles here are in-memory fakes of
 * those two repositories. Nothing is mocked inside the service itself.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { LightGroupService } from "@/backend/domain/services/LightGroupService";
import { Light } from "@/backend/domain/entities/Light";
import { LightGroup } from "@/backend/domain/entities/LightGroup";
import type { ILightGroupRepository } from "@/backend/domain/repositories/ILightGroupRepository";
import type { ILightRepository } from "@/backend/domain/repositories/ILightRepository";
import type { LightState } from "@/backend/domain/value-objects/LightState";

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

/** In-memory stand-in for the persisted group store. */
class InMemoryGroupRepository implements ILightGroupRepository {
  readonly groups = new Map<string, LightGroup>();
  readonly deleted: string[] = [];
  readonly saved: LightGroup[] = [];

  async getAllGroups(): Promise<LightGroup[]> {
    return Array.from(this.groups.values());
  }

  async findGroupById(id: string): Promise<LightGroup | null> {
    return this.groups.get(id) ?? null;
  }

  async findGroupsByName(name: string): Promise<LightGroup[]> {
    return Array.from(this.groups.values()).filter(
      (g) => g.name.toLowerCase() === name.toLowerCase(),
    );
  }

  async saveGroup(group: LightGroup): Promise<void> {
    this.saved.push(group);
    this.groups.set(group.id, group);
  }

  async deleteGroup(groupId: string): Promise<void> {
    this.deleted.push(groupId);
    this.groups.delete(groupId);
  }

  async isGroupNameAvailable(
    name: string,
    excludeId?: string,
  ): Promise<boolean> {
    return !Array.from(this.groups.values()).some(
      (g) => g.name.toLowerCase() === name.toLowerCase() && g.id !== excludeId,
    );
  }
}

/** In-memory stand-in for the device catalogue. Only the lookups matter here. */
class InMemoryLightRepository {
  readonly lights = new Map<string, Light>();

  add(light: Light): Light {
    this.lights.set(`${light.deviceId}::${light.model}`, light);
    return light;
  }

  async getAllLights(): Promise<Light[]> {
    return Array.from(this.lights.values());
  }

  async findLight(deviceId: string, model: string): Promise<Light | null> {
    return this.lights.get(`${deviceId}::${model}`) ?? null;
  }

  async findLightsByName(name: string): Promise<Light[]> {
    return Array.from(this.lights.values()).filter((l) => l.name === name);
  }
}

describe("LightGroupService", () => {
  let groups: InMemoryGroupRepository;
  let lights: InMemoryLightRepository;
  let service: LightGroupService;

  beforeEach(() => {
    groups = new InMemoryGroupRepository();
    lights = new InMemoryLightRepository();
    service = new LightGroupService(
      groups,
      lights as unknown as ILightRepository,
    );
  });

  describe("creating a group", () => {
    it("gathers the named lights into a persisted group", async () => {
      lights.add(makeLight("dev-1", "H6110", "Desk"));
      lights.add(makeLight("dev-2", "H6159", "Shelf"));

      const group = await service.createGroup("Office", [
        { deviceId: "dev-1", model: "H6110" },
        { deviceId: "dev-2", model: "H6159" },
      ]);

      expect(group.name).toBe("Office");
      expect(group.size).toBe(2);
      expect(await groups.findGroupById(group.id)).toBe(group);
    });

    it("rejects a name another group already holds", async () => {
      lights.add(makeLight("dev-1"));
      await service.createGroup("Office", [
        { deviceId: "dev-1", model: "H6110" },
      ]);

      await expect(
        service.createGroup("Office", [{ deviceId: "dev-1", model: "H6110" }]),
      ).rejects.toThrow(/already taken/i);
    });

    it("refuses to build a group around a light the catalogue does not know", async () => {
      await expect(
        service.createGroup("Ghosts", [
          { deviceId: "missing", model: "H6110" },
        ]),
      ).rejects.toThrow(/not found/i);

      expect(groups.saved).toHaveLength(0);
    });

    // KNOWN DEFECT (not fixable from test/): generateGroupId builds the id as
    // `group-<name slugged to [a-z0-9-]>-<Date.now()>`. Two *differently named*
    // groups can slug to the same string — "Kitchen 1" and "Kitchen-1" both
    // become "kitchen-1" — and both names pass the availability check, which
    // compares the raw names. Created within the same millisecond they receive
    // the same id, and saving the second silently overwrites the first in the
    // group store. The documented contract ("Generate a unique ID for a new
    // group") requires an id that cannot collide: a counter, a random suffix,
    // or a uuid. The frozen clock below only makes the collision deterministic;
    // the same clash happens for real in any loop that creates several groups.
    it("gives distinct ids to two groups whose names slug to the same string", async () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
        lights.add(makeLight("dev-1"));

        const first = await service.createGroup("Kitchen 1", [
          { deviceId: "dev-1", model: "H6110" },
        ]);
        const second = await service.createGroup("Kitchen-1", [
          { deviceId: "dev-1", model: "H6110" },
        ]);

        expect(second.id).not.toBe(first.id);
      } finally {
        vi.useRealTimers();
      }
    });

    it("accepts a group with no lights at all", async () => {
      const group = await service.createGroup("Empty", []);

      expect(group.isEmpty).toBe(true);
      expect(groups.saved).toContain(group);
    });
  });

  describe("adding a light to a group", () => {
    it("persists the group with the extra light", async () => {
      const a = lights.add(makeLight("dev-1"));
      lights.add(makeLight("dev-2"));
      const group = LightGroup.create("g1", "Office", [a]);
      await groups.saveGroup(group);
      groups.saved.length = 0;

      await service.addLightToGroup("g1", "dev-2", "H6110");

      const stored = await groups.findGroupById("g1");
      expect(stored?.size).toBe(2);
      expect(groups.saved).toHaveLength(1);
    });

    it("rejects an unknown group", async () => {
      lights.add(makeLight("dev-1"));

      await expect(
        service.addLightToGroup("nope", "dev-1", "H6110"),
      ).rejects.toThrow(/not found/i);
    });

    it("rejects a light the catalogue does not know", async () => {
      await groups.saveGroup(LightGroup.create("g1", "Office", []));

      await expect(
        service.addLightToGroup("g1", "missing", "H6110"),
      ).rejects.toThrow(/not found/i);
    });
  });

  describe("removing a light from a group", () => {
    it("keeps the group when other lights remain", async () => {
      const a = lights.add(makeLight("dev-1"));
      const b = lights.add(makeLight("dev-2"));
      await groups.saveGroup(LightGroup.create("g1", "Office", [a, b]));

      await service.removeLightFromGroup("g1", "dev-1", "H6110");

      const stored = await groups.findGroupById("g1");
      expect(stored?.size).toBe(1);
      expect(stored?.lights[0].deviceId).toBe("dev-2");
      expect(groups.deleted).not.toContain("g1");
    });

    it("deletes the group once its last light is removed", async () => {
      const a = lights.add(makeLight("dev-1"));
      await groups.saveGroup(LightGroup.create("g1", "Office", [a]));

      await service.removeLightFromGroup("g1", "dev-1", "H6110");

      expect(groups.deleted).toContain("g1");
      expect(await groups.findGroupById("g1")).toBeNull();
    });

    it("rejects an unknown group", async () => {
      lights.add(makeLight("dev-1"));

      await expect(
        service.removeLightFromGroup("nope", "dev-1", "H6110"),
      ).rejects.toThrow(/not found/i);
    });

    it("rejects a light the catalogue does not know", async () => {
      await groups.saveGroup(LightGroup.create("g1", "Office", []));

      await expect(
        service.removeLightFromGroup("g1", "missing", "H6110"),
      ).rejects.toThrow(/not found/i);
    });
  });

  describe("renaming a group", () => {
    it("stores the group under its new name, keeping its lights", async () => {
      const a = lights.add(makeLight("dev-1"));
      await groups.saveGroup(LightGroup.create("g1", "Office", [a]));

      await service.updateGroupName("g1", "Studio");

      const stored = await groups.findGroupById("g1");
      expect(stored?.name).toBe("Studio");
      expect(stored?.size).toBe(1);
    });

    it("rejects a name another group already holds", async () => {
      await groups.saveGroup(LightGroup.create("g1", "Office", []));
      await groups.saveGroup(LightGroup.create("g2", "Studio", []));

      await expect(service.updateGroupName("g1", "Studio")).rejects.toThrow(
        /already taken/i,
      );
    });

    it("allows a group to keep its own name", async () => {
      await groups.saveGroup(LightGroup.create("g1", "Office", []));

      await expect(
        service.updateGroupName("g1", "Office"),
      ).resolves.toBeUndefined();
    });

    it("rejects an unknown group", async () => {
      await expect(service.updateGroupName("nope", "Studio")).rejects.toThrow(
        /not found/i,
      );
    });
  });

  describe("updating a group wholesale", () => {
    it("replaces both the name and the membership", async () => {
      const a = lights.add(makeLight("dev-1"));
      lights.add(makeLight("dev-2"));
      await groups.saveGroup(LightGroup.create("g1", "Office", [a]));

      const updated = await service.updateGroup("g1", "Studio", [
        { deviceId: "dev-2", model: "H6110" },
      ]);

      expect(updated.id).toBe("g1");
      expect(updated.name).toBe("Studio");
      expect(updated.lights.map((l) => l.deviceId)).toEqual(["dev-2"]);
      expect((await groups.findGroupById("g1"))?.name).toBe("Studio");
    });

    it("rejects a name another group already holds", async () => {
      await groups.saveGroup(LightGroup.create("g1", "Office", []));
      await groups.saveGroup(LightGroup.create("g2", "Studio", []));

      await expect(service.updateGroup("g1", "Studio", [])).rejects.toThrow(
        /already taken/i,
      );
    });

    it("allows a group to keep its own name while its lights change", async () => {
      const a = lights.add(makeLight("dev-1"));
      await groups.saveGroup(LightGroup.create("g1", "Office", []));

      const updated = await service.updateGroup("g1", "Office", [
        { deviceId: a.deviceId, model: a.model },
      ]);

      expect(updated.size).toBe(1);
    });

    it("rejects a light the catalogue does not know", async () => {
      await groups.saveGroup(LightGroup.create("g1", "Office", []));

      await expect(
        service.updateGroup("g1", "Office", [
          { deviceId: "missing", model: "H6110" },
        ]),
      ).rejects.toThrow(/not found/i);
    });

    it("rejects an unknown group", async () => {
      await expect(service.updateGroup("nope", "Studio", [])).rejects.toThrow(
        /not found/i,
      );
    });
  });

  describe("deleting a group", () => {
    it("removes the group from the store", async () => {
      await groups.saveGroup(LightGroup.create("g1", "Office", []));

      await service.deleteGroup("g1");

      expect(groups.deleted).toContain("g1");
      expect(await groups.findGroupById("g1")).toBeNull();
    });

    it("rejects an unknown group", async () => {
      await expect(service.deleteGroup("nope")).rejects.toThrow(/not found/i);
    });
  });

  describe("querying groups", () => {
    it("lists every saved group", async () => {
      await groups.saveGroup(LightGroup.create("g1", "Office", []));
      await groups.saveGroup(LightGroup.create("g2", "Studio", []));

      expect(await service.getAllGroups()).toHaveLength(2);
    });

    it("finds a group by id, and reports null for an unknown one", async () => {
      await groups.saveGroup(LightGroup.create("g1", "Office", []));

      expect((await service.findGroupById("g1"))?.name).toBe("Office");
      expect(await service.findGroupById("nope")).toBeNull();
    });

    it("finds every group a light belongs to", async () => {
      const a = lights.add(makeLight("dev-1"));
      await groups.saveGroup(LightGroup.create("g1", "Office", [a]));
      await groups.saveGroup(LightGroup.create("g2", "Studio", [a]));
      await groups.saveGroup(LightGroup.create("g3", "Hall", []));

      const found = await service.findGroupsContainingLight("dev-1", "H6110");

      expect(found.map((g) => g.id).sort()).toEqual(["g1", "g2"]);
    });

    it("reports no groups for a light the catalogue does not know", async () => {
      await groups.saveGroup(LightGroup.create("g1", "Office", []));

      expect(
        await service.findGroupsContainingLight("missing", "H6110"),
      ).toEqual([]);
    });
  });
});
