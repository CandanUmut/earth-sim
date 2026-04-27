/**
 * Tech tree. Eight discrete unlocks across four branches. Each node costs
 * gold and may require a prerequisite. Effects are read in the appropriate
 * place — economy.ts for cost discounts, combat.ts for combat strength,
 * tick.ts for auto-recruit.
 */

export type TechBranch = 'military' | 'economy' | 'logistics' | 'diplomacy';

export type TechNodeId =
  | 'mil_drill'
  | 'mil_combined_arms'
  | 'eco_banking'
  | 'eco_treasury'
  | 'log_conscription' // unlocks auto-recruit
  | 'log_naval'
  | 'dip_espionage'
  | 'dip_statecraft';

export type TechNode = {
  id: TechNodeId;
  branch: TechBranch;
  name: string;
  description: string;
  cost: number; // gold
  prereq?: TechNodeId;
};

export const TECH_NODES: TechNode[] = [
  {
    id: 'mil_drill',
    branch: 'military',
    name: 'Drill Manuals',
    description: '+10 % combat strength.',
    cost: 250,
  },
  {
    id: 'mil_combined_arms',
    branch: 'military',
    name: 'Combined Arms',
    description: '+25 % combat strength on top of Drill Manuals.',
    cost: 500,
    prereq: 'mil_drill',
  },
  {
    id: 'eco_banking',
    branch: 'economy',
    name: 'Banking',
    description: '+25 % gold income.',
    cost: 250,
  },
  {
    id: 'eco_treasury',
    branch: 'economy',
    name: 'Treasury Reform',
    description: '−25 % recruit cost on every troop type.',
    cost: 500,
    prereq: 'eco_banking',
  },
  {
    id: 'log_conscription',
    branch: 'logistics',
    name: 'Conscription Office',
    description: 'Auto-recruit: surplus gold each tick is spent on troops.',
    cost: 300,
  },
  {
    id: 'log_naval',
    branch: 'logistics',
    name: 'Naval Engineers',
    description: 'Naval hops cost the same as land hops.',
    cost: 500,
    prereq: 'log_conscription',
  },
  {
    id: 'dip_espionage',
    branch: 'diplomacy',
    name: 'Espionage',
    description: 'Reveals foreign nations’ gold and tech.',
    cost: 250,
  },
  {
    id: 'dip_statecraft',
    branch: 'diplomacy',
    name: 'Statecraft',
    description: 'Alliance proposals 2× more likely to be accepted.',
    cost: 500,
    prereq: 'dip_espionage',
  },
];

const NODE_BY_ID: Record<TechNodeId, TechNode> = TECH_NODES.reduce(
  (acc, n) => {
    acc[n.id] = n;
    return acc;
  },
  {} as Record<TechNodeId, TechNode>,
);

export function getNode(id: TechNodeId): TechNode {
  return NODE_BY_ID[id];
}

export function isUnlockable(
  id: TechNodeId,
  unlocked: TechNodeId[],
  gold: number,
): boolean {
  const node = NODE_BY_ID[id];
  if (!node) return false;
  if (unlocked.includes(id)) return false;
  if (node.prereq && !unlocked.includes(node.prereq)) return false;
  return gold >= node.cost;
}

// ---- Effect helpers (read by other modules) ----

export function combatTechMultiplier(unlocked: TechNodeId[]): number {
  let m = 1;
  if (unlocked.includes('mil_drill')) m *= 1.1;
  if (unlocked.includes('mil_combined_arms')) m *= 1.25;
  return m;
}

export function goldIncomeMultiplier(unlocked: TechNodeId[]): number {
  let m = 1;
  if (unlocked.includes('eco_banking')) m *= 1.25;
  return m;
}

export function recruitCostMultiplier(unlocked: TechNodeId[]): number {
  if (unlocked.includes('eco_treasury')) return 0.75;
  return 1;
}

export function autoRecruitUnlocked(unlocked: TechNodeId[]): boolean {
  return unlocked.includes('log_conscription');
}

export function navalCostUnit(unlocked: TechNodeId[]): number {
  return unlocked.includes('log_naval') ? 1 : 2;
}

export function canEspionage(unlocked: TechNodeId[]): boolean {
  return unlocked.includes('dip_espionage');
}

export function statecraftMultiplier(unlocked: TechNodeId[]): number {
  return unlocked.includes('dip_statecraft') ? 2.0 : 1.0;
}
