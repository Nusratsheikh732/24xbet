export interface MissionMilestone {
  id: string;
  target: number;
  rewardName: string;
  rewardCount: number;
  bonus: number;
}

export interface Mission {
  title: string;
  milestones: MissionMilestone[];
}

export const NEW_MEMBER_MISSION: Mission = {
  title: 'New Member Daily Mission',
  milestones: [
    { id: 'm-5000', target: 5000, rewardName: 'Ramadan Wishing Wheel', rewardCount: 1, bonus: 10 },
    { id: 'm-10000', target: 10000, rewardName: 'Lucky red envelope rain', rewardCount: 1, bonus: 15 },
    { id: 'm-30000', target: 30000, rewardName: 'Lucky red envelope rain', rewardCount: 1, bonus: 30 },
    { id: 'm-60000', target: 60000, rewardName: 'S GoldenEgg', rewardCount: 1, bonus: 50 },
    { id: 'm-100000', target: 100000, rewardName: 'S GoldenEgg', rewardCount: 1, bonus: 100 },
  ],
};
