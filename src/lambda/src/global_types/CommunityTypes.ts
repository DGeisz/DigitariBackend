export const COMMUNITY_TYPENAME = "Community";

export const COMMUNITY_NAME_MAX_LEN = 50;
export const COMMUNITY_DESCRIPTION_MAX_LEN = 400;

export interface CommunityType {
    id: string;
    uid: string;
    name: string;
    amFollowing: boolean;
    description: string;
    followers: number;
    timeCreated: string;
}