export const COMMUNITY_TYPENAME = "Community";

export interface CommunityType {
    id: string;
    uid: string;
    name: string;
    amFollowing: boolean;
    followPrice: number;
    description: string;
    followers: number;
    timeCreated: string;
}

export const exampleCommunity: CommunityType = {
    id: "bett",
    uid: "betty",
    name: "Those named Bett",
    amFollowing: false,
    followPrice: 50,
    description: "Everyone named Bett in the area",
    followers: 20,
    timeCreated: "1613999698186",
};
