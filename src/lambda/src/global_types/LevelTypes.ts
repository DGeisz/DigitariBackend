import { XXHash32 } from "ts-xxhash";
import { makePrettyNumber, UserType } from "./UserTypes";

export enum LevelTaskType {
    FollowUsers,
    FollowComms,
    FollowUsersOrComms,
    CollectCoin,
    CreatePosts,
    BuyBolts,
    Invite,
    NewResponse,
    SuccessfulConvos,
    CreateCommunities,
    SpendCoinCreatingPosts,
    EarnCoinFromPosts,
    CreateProfilePic,
    CreateBio,
    CreateBioLink,
    UpgradeWallet,
    ConvoStreak,
}

export interface LevelTask {
    task: LevelTaskType;
    quantity: number;
}

export enum LevelRewardType {
    Coin,
    MaxFollowers,
    MaxFollowing,
    MaxPostRecipients,
    Invites,
    ProfilePic,
    Bio,
    ProfileLink,
}

export interface LevelReward {
    reward: LevelRewardType;
    quantity: number;
}

export interface Level {
    level: number;
    tasks: LevelTask[];
    rewards: LevelReward[];
    cost: number;
}

export const LEVEL_COST_MULTIPLIER = 1.2;
export const LEVEL_REACH_MULTIPLIER = 1.3;

export function calculateLevel(level: number): Level {
    /*
     * Start off with the built in levels
     */
    switch (level) {
        case 1: {
            return {
                level,
                tasks: [
                    {
                        task: LevelTaskType.FollowUsersOrComms,
                        quantity: 1,
                    },
                    {
                        task: LevelTaskType.CollectCoin,
                        quantity: 100,
                    },
                ],
                rewards: [
                    {
                        reward: LevelRewardType.MaxFollowing,
                        quantity: 4,
                    },
                    {
                        reward: LevelRewardType.MaxFollowers,
                        quantity: 2,
                    },
                    {
                        reward: LevelRewardType.MaxPostRecipients,
                        quantity: 2,
                    },
                    {
                        reward: LevelRewardType.Coin,
                        quantity: 800,
                    },
                ],
                cost: 30,
            };
        }
        case 2: {
            return {
                level,
                tasks: [
                    {
                        task: LevelTaskType.FollowUsers,
                        quantity: 2,
                    },
                    {
                        task: LevelTaskType.FollowComms,
                        quantity: 1,
                    },
                    {
                        task: LevelTaskType.CreatePosts,
                        quantity: 1,
                    },
                ],
                rewards: [
                    {
                        reward: LevelRewardType.MaxFollowing,
                        quantity: 2,
                    },
                    {
                        reward: LevelRewardType.MaxPostRecipients,
                        quantity: 3,
                    },
                    {
                        reward: LevelRewardType.Invites,
                        quantity: 10,
                    },
                    {
                        reward: LevelRewardType.Coin,
                        quantity: 800,
                    },
                ],
                cost: 70,
            };
        }
        case 3: {
            return {
                level,
                tasks: [
                    {
                        task: LevelTaskType.BuyBolts,
                        quantity: 20,
                    },
                    {
                        task: LevelTaskType.Invite,
                        quantity: 3,
                    },
                    {
                        task: LevelTaskType.CreatePosts,
                        quantity: 2,
                    },
                ],
                rewards: [
                    {
                        reward: LevelRewardType.MaxFollowers,
                        quantity: 7,
                    },
                    {
                        reward: LevelRewardType.MaxPostRecipients,
                        quantity: 5,
                    },
                    {
                        reward: LevelRewardType.ProfilePic,
                        quantity: 1,
                    },
                    {
                        reward: LevelRewardType.Coin,
                        quantity: 800,
                    },
                ],
                cost: 80,
            };
        }
        case 4: {
            return {
                level,
                tasks: [
                    {
                        task: LevelTaskType.NewResponse,
                        quantity: 4,
                    },
                    {
                        task: LevelTaskType.CreateProfilePic,
                        quantity: 1,
                    },
                    {
                        task: LevelTaskType.SuccessfulConvos,
                        quantity: 2,
                    },
                ],
                rewards: [
                    {
                        reward: LevelRewardType.MaxFollowing,
                        quantity: 4,
                    },
                    {
                        reward: LevelRewardType.MaxFollowers,
                        quantity: 5,
                    },
                    {
                        reward: LevelRewardType.MaxPostRecipients,
                        quantity: 10,
                    },
                    {
                        reward: LevelRewardType.Coin,
                        quantity: 800,
                    },
                ],
                cost: 100,
            };
        }
        case 5: {
            return {
                level,
                tasks: [
                    {
                        task: LevelTaskType.CreateCommunities,
                        quantity: 1,
                    },
                    {
                        task: LevelTaskType.SpendCoinCreatingPosts,
                        quantity: 1200,
                    },
                    {
                        task: LevelTaskType.UpgradeWallet,
                        quantity: 1200,
                    },
                ],
                rewards: [
                    {
                        reward: LevelRewardType.MaxFollowers,
                        quantity: 15,
                    },
                    {
                        reward: LevelRewardType.MaxPostRecipients,
                        quantity: 15,
                    },
                    {
                        reward: LevelRewardType.Bio,
                        quantity: 1,
                    },
                    {
                        reward: LevelRewardType.Coin,
                        quantity: 1200,
                    },
                ],
                cost: 200,
            };
        }
        case 6: {
            return {
                level,
                tasks: [
                    {
                        task: LevelTaskType.CreateBio,
                        quantity: 1,
                    },
                    {
                        task: LevelTaskType.ConvoStreak,
                        quantity: 10,
                    },
                    {
                        task: LevelTaskType.EarnCoinFromPosts,
                        quantity: 1000,
                    },
                ],
                rewards: [
                    {
                        reward: LevelRewardType.MaxPostRecipients,
                        quantity: 20,
                    },
                    {
                        reward: LevelRewardType.MaxFollowing,
                        quantity: 10,
                    },
                    {
                        reward: LevelRewardType.Invites,
                        quantity: 15,
                    },
                    {
                        reward: LevelRewardType.Coin,
                        quantity: 1200,
                    },
                ],
                cost: 400,
            };
        }
        case 7: {
            return {
                level,
                tasks: [
                    {
                        task: LevelTaskType.BuyBolts,
                        quantity: 80,
                    },
                    {
                        task: LevelTaskType.Invite,
                        quantity: 5,
                    },
                    {
                        task: LevelTaskType.FollowUsersOrComms,
                        quantity: 10,
                    },
                ],
                rewards: [
                    {
                        reward: LevelRewardType.MaxPostRecipients,
                        quantity: 20,
                    },
                    {
                        reward: LevelRewardType.MaxFollowers,
                        quantity: 20,
                    },
                    {
                        reward: LevelRewardType.MaxFollowing,
                        quantity: 10,
                    },
                    {
                        reward: LevelRewardType.Coin,
                        quantity: 1200,
                    },
                ],
                cost: 650,
            };
        }
        case 8: {
            return {
                level,
                tasks: [
                    {
                        task: LevelTaskType.ConvoStreak,
                        quantity: 25,
                    },
                    {
                        task: LevelTaskType.UpgradeWallet,
                        quantity: 1900,
                    },
                    {
                        task: LevelTaskType.CollectCoin,
                        quantity: 5000,
                    },
                ],
                rewards: [
                    {
                        reward: LevelRewardType.MaxPostRecipients,
                        quantity: 30,
                    },
                    {
                        reward: LevelRewardType.MaxFollowers,
                        quantity: 40,
                    },
                    {
                        reward: LevelRewardType.ProfileLink,
                        quantity: 1,
                    },
                    {
                        reward: LevelRewardType.Coin,
                        quantity: 1900,
                    },
                ],
                cost: 800,
            };
        }
        case 9: {
            return {
                level,
                tasks: [
                    {
                        task: LevelTaskType.CreateBioLink,
                        quantity: 1,
                    },
                    {
                        task: LevelTaskType.SpendCoinCreatingPosts,
                        quantity: 2000,
                    },
                    {
                        task: LevelTaskType.NewResponse,
                        quantity: 15,
                    },
                ],
                rewards: [
                    {
                        reward: LevelRewardType.MaxPostRecipients,
                        quantity: 30,
                    },
                    {
                        reward: LevelRewardType.MaxFollowers,
                        quantity: 30,
                    },
                    {
                        reward: LevelRewardType.MaxFollowing,
                        quantity: 5,
                    },
                    {
                        reward: LevelRewardType.Coin,
                        quantity: 1900,
                    },
                ],
                cost: 1000,
            };
        }
        case 10: {
            return {
                level,
                tasks: [
                    {
                        task: LevelTaskType.ConvoStreak,
                        quantity: 40,
                    },
                    {
                        task: LevelTaskType.FollowUsersOrComms,
                        quantity: 5,
                    },
                    {
                        task: LevelTaskType.CreateCommunities,
                        quantity: 2,
                    },
                ],
                rewards: [
                    {
                        reward: LevelRewardType.MaxPostRecipients,
                        quantity: 40,
                    },
                    {
                        reward: LevelRewardType.MaxFollowers,
                        quantity: 50,
                    },
                    {
                        reward: LevelRewardType.Invites,
                        quantity: 3,
                    },
                    {
                        reward: LevelRewardType.Coin,
                        quantity: 1900,
                    },
                ],
                cost: 1000,
            };
        }
    }

    return {
        level,
        tasks: selectThreeTasks(level).map((task) => ({
            task,
            quantity: taskQuantity(task, level),
        })),
        rewards: [
            {
                reward: LevelRewardType.MaxFollowers,
                quantity: makePrettyNumber(
                    100 * LEVEL_REACH_MULTIPLIER ** (level - START_LEVEL)
                ),
            },
            {
                reward: LevelRewardType.MaxPostRecipients,
                quantity: makePrettyNumber(
                    80 * LEVEL_REACH_MULTIPLIER ** (level - START_LEVEL)
                ),
            },
            !!(level % 5)
                ? {
                      reward: LevelRewardType.MaxFollowing,
                      quantity: 5,
                  }
                : {
                      reward: LevelRewardType.Invites,
                      quantity: 3,
                  },
            {
                reward: LevelRewardType.Coin,
                quantity: makePrettyNumber(
                    2000 * LEVEL_COST_MULTIPLIER ** (level - START_LEVEL)
                ),
            },
        ],
        cost: makePrettyNumber(
            1000 * LEVEL_COST_MULTIPLIER ** (level - START_LEVEL)
        ),
    };
}

const LEVEL_HASH_SEED = "level";

export function selectThreeTasks(level: number): LevelTaskType[] {
    const hash = XXHash32.hash(LEVEL_HASH_SEED)
        .update(level.toString())
        .digest()
        .toNumber();

    const possibleTasks: LevelTaskType[] = [
        LevelTaskType.BuyBolts,
        LevelTaskType.CollectCoin,
        LevelTaskType.NewResponse,
        LevelTaskType.SuccessfulConvos,
        LevelTaskType.CreatePosts,
        LevelTaskType.SpendCoinCreatingPosts,
        LevelTaskType.FollowUsersOrComms,
    ];

    const finalTasks = [];

    for (let i = 0; i < 3; i++) {
        const index = Math.floor(hash / 10 ** i) % possibleTasks.length;

        finalTasks.push(possibleTasks[index]);
        possibleTasks.splice(index, 1);
    }

    return finalTasks;
}

const START_LEVEL = 10;

function taskQuantity(task: LevelTaskType, level: number): number {
    switch (task) {
        case LevelTaskType.BuyBolts:
            return (level - START_LEVEL) * 250 + 100;
        case LevelTaskType.CollectCoin:
            return (level - START_LEVEL) * 500 + 1000;
        case LevelTaskType.NewResponse:
            return (level - START_LEVEL) * 5 + 15;
        case LevelTaskType.SuccessfulConvos:
            return makePrettyNumber((level - START_LEVEL) * 3.5 + 10);
        case LevelTaskType.CreatePosts:
            return makePrettyNumber((level - START_LEVEL) * 4.5 + 10);
        case LevelTaskType.SpendCoinCreatingPosts:
            return (level - START_LEVEL) * 500 + 1000;
        case LevelTaskType.FollowUsersOrComms:
            return 3;
    }

    return 0;
}

export function getTaskProgress(task: LevelTask, user: UserType): number {
    switch (task.task) {
        case LevelTaskType.FollowUsers: {
            return user.levelUsersFollowed;
        }
        case LevelTaskType.FollowComms: {
            return user.levelsCommsFollowed;
        }
        case LevelTaskType.FollowUsersOrComms: {
            return user.levelsCommsFollowed + user.levelUsersFollowed;
        }
        case LevelTaskType.CollectCoin: {
            return user.levelCoinCollected;
        }
        case LevelTaskType.CreatePosts: {
            return user.levelPostsCreated;
        }
        case LevelTaskType.BuyBolts: {
            return user.levelPostBoltsBought;
        }
        case LevelTaskType.Invite: {
            return user.levelInvitedAndJoined;
        }
        case LevelTaskType.NewResponse: {
            return user.levelNewResponses;
        }
        case LevelTaskType.SuccessfulConvos: {
            return user.levelSuccessfulConvos;
        }
        case LevelTaskType.CreateCommunities: {
            return user.levelCommsCreated;
        }
        case LevelTaskType.SpendCoinCreatingPosts: {
            return user.levelCoinSpentOnPosts;
        }
        case LevelTaskType.EarnCoinFromPosts: {
            return user.levelCoinEarnedFromPosts;
        }
        case LevelTaskType.CreateProfilePic: {
            return !!user.imgUrl ? 1 : 0;
        }
        case LevelTaskType.CreateBio: {
            return !!user.bio ? 1 : 0;
        }
        case LevelTaskType.CreateBioLink: {
            return !!user.link ? 1 : 0;
        }
        case LevelTaskType.UpgradeWallet: {
            return Math.min(user.maxWallet, task.quantity);
        }
        case LevelTaskType.ConvoStreak: {
            return Math.min(user.ranking, task.quantity);
        }
    }
}

/**
 * Gets whether the task is completed
 */
export function taskCompleted(task: LevelTask, user: UserType): boolean {
    return getTaskProgress(task, user) >= task.quantity;
}

export function levelTasksComplete(level: Level, user: UserType): boolean {
    return level.tasks.every((task) => taskCompleted(task, user));
}
