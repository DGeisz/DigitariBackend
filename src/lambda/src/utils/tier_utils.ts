export function tier2convoReward(tier: number): number {
    switch (tier) {
        case -3:
            return 2;
        case -2:
            return 4;
        case -1:
            return 10;
        case 0:
            return 20;
        case 1:
            return 40;
        case 2:
            return 80;
        case 3:
            return 120;
        case 4:
            return 200;
        case 5:
            return 300;
        case 6:
            return 400;
        default:
            return 0;
    }
}

export function tier2responseCost(tier: number): number {
    switch (tier) {
        case -3:
            return 10;
        case -2:
            return 20;
        case -1:
            return 50;
        case 0:
            return 100;
        case 1:
            return 150;
        case 2:
            return 200;
        case 3:
            return 250;
        case 4:
            return 300;
        case 5:
            return 350;
        case 6:
            return 400;
        default:
            return 0;
    }
}
