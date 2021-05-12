export function tier2convoReward(tier: number): number {
    switch (tier) {
        case -3:
            return 2;
        case -2:
            return 4;
        case -1:
            return 15;
        case 0:
            return 30;
        case 1:
            return 45;
        case 2:
            return 75;
        case 3:
            return 100;
        case 4:
            return 250;
        case 5:
            return 600;
        case 6:
            return 1500;
        default:
            return 0;
    }
}

export function tier2responseCost(tier: number): number {
    switch (tier) {
        case -3:
            return 1;
        case -2:
            return 2;
        case -1:
            return 5;
        case 0:
            return 10;
        case 1:
            return 15;
        case 2:
            return 25;
        case 3:
            return 35;
        case 4:
            return 85;
        case 5:
            return 200;
        case 6:
            return 500;
        default:
            return 0;
    }
}
