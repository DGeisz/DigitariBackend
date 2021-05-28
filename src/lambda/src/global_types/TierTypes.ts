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
    if (ranking >= 100) {
        return TierEnum.Angel;
    } else if (ranking >= 70) {
        return TierEnum.HeartEyes;
    } else if (ranking >= 50) {
        return TierEnum.Sunglasses;
    } else if (ranking >= 35) {
        return TierEnum.Hugging;
    } else if (ranking >= 20) {
        return TierEnum.Grinning;
    } else if (ranking >= 5) {
        return TierEnum.Smiling;
    } else if (ranking >= -5) {
        return TierEnum.SlightlySmiling;
    } else if (ranking >= -10) {
        return TierEnum.Frowning;
    } else if (ranking >= -20) {
        return TierEnum.Steam;
    } else {
        return TierEnum.AngryHorns;
    }
}
/*
 * First return is the hourly wage, second return
 * is the daily wage (max wage)
 */
export function ranking2Wage(ranking: number): [number, number] {
    const tier = ranking2Tier(ranking);

    let dailyWage: number;

    switch (tier) {
        case TierEnum.AngryHorns:
            dailyWage = 10;
            break;
        case TierEnum.Steam:
            dailyWage = 50;
            break;
        case TierEnum.Frowning:
            dailyWage = 200;
            break;
        case TierEnum.SlightlySmiling:
            dailyWage = 400;
            break;
        case TierEnum.Smiling:
            dailyWage = 600;
            break;
        case TierEnum.Grinning:
            dailyWage = 1000;
            break;
        case TierEnum.Hugging:
            dailyWage = 1500;
            break;
        case TierEnum.Sunglasses:
            dailyWage = 2000;
            break;
        case TierEnum.HeartEyes:
            dailyWage = 3000;
            break;
        case TierEnum.Angel:
            dailyWage = 5000;
            break;
    }

    return [dailyWage / 24, dailyWage];
}
