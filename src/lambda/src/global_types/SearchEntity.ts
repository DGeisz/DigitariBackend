export enum SearchEntityEnum {
    user,
    community,
}

export interface SearchEntityType {
    id: string;
    name: string;
    followers: number;
    entityType: SearchEntityEnum;
}

export const exampleUserEntity: SearchEntityType = {
    id: "whosagooduser",
    name: "Dern Cern",
    followers: 123,
    entityType: SearchEntityEnum.user,
};

export const exampleCommunityEntity: SearchEntityType = {
    id: "whosagoodcommunity",
    name: "Dank Vapers",
    followers: 3459,
    entityType: SearchEntityEnum.community,
};
