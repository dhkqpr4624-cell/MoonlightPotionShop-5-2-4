/** 서랍 안 재료 더미 (재료마다 다른 그림). 이전 버전 재료는 병·항아리 그림을 가운데에 */
import type { Ingredient } from "../../data/ingredients.ts";
import { EnergyHerbPile } from "./HerbArt.tsx";
import { FeatherGrassPile, WindShardPile } from "./WindArt.tsx";
import { IngredientArt } from "./PotionArt.tsx";

export function IngredientPile({ ing, width, height, picked }: { ing: Ingredient; width: number; height: number; picked: boolean }) {
  if (ing.id === "featherGrass") return <FeatherGrassPile width={width} height={height} picked={picked} />;
  if (ing.id === "windShard") return <WindShardPile width={width} height={height} picked={picked} />;
  if (ing.kind === "herb") return <EnergyHerbPile width={width} height={height} picked={picked} />;
  return (
    <span className="drawer-legacy">
      <IngredientArt ingredient={ing} size={Math.min(width, height) * 0.7} />
    </span>
  );
}
