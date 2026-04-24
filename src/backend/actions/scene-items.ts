import { DynamicSceneOption } from "../domain/value-objects/DynamicSceneOption";
import { DiySceneOption } from "../domain/value-objects/DiySceneOption";

export function buildSceneItems(
  dynamicScenes: DynamicSceneOption[],
  diyScenes: DiySceneOption[],
) {
  return [
    ...dynamicScenes.map((scene) => ({
      label: scene.name,
      value: JSON.stringify({
        kind: "dynamic",
        id: scene.id,
        paramId: scene.paramId,
        name: scene.name,
      }),
    })),
    ...diyScenes.map((scene) => ({
      label: `${scene.name} (DIY)`,
      value: JSON.stringify({
        kind: "diy",
        id: scene.id,
        paramId: scene.paramId,
        name: scene.name,
      }),
    })),
  ];
}
