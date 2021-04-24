export enum TierEnum {
    AngryHorns = -3,
    Steam,
    Frowning,
    SlightlySmiling,
    Smiling,
    Grinning,
    Hugging,
    Sunglasses,
    HeartEyes,
    Angel,
}

export function ranking2Tier(ranking: number): TierEnum {
    if (ranking > 100) {
        return TierEnum.Angel;
    } else if (ranking > 70) {
        return TierEnum.HeartEyes;
    } else if (ranking > 50) {
        return TierEnum.Sunglasses;
    } else if (ranking > 35) {
        return TierEnum.Hugging;
    } else if (ranking > 20) {
        return TierEnum.Grinning;
    } else if (ranking > 5) {
        return TierEnum.Smiling;
    } else if (ranking > -5) {
        return TierEnum.SlightlySmiling;
    } else if (ranking > -10) {
        return TierEnum.Frowning;
    } else if (ranking > -20) {
        return TierEnum.Steam;
    } else {
        return TierEnum.AngryHorns;
    }
}
