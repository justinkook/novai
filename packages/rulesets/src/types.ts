export interface Ruleset {
  name: string;
  description: string;
  stats: string[];
  skills: Record<string, string[]>;
  combatRules: CombatRules;
  statCheckRules: StatCheckRules;
}

export interface CombatRules {
  initiative: string;
  actions: string[];
  attackRoll: string;
  damageRoll: string;
  criticalHit: string;
  deathSaves: string;
}

export interface StatCheckRules {
  checkFormat: string;
  difficultyClasses: Record<string, number>;
  outcomes: Record<string, string>;
}

export interface DiceRoll {
  dice: string;
  modifier: number;
  result: number;
  total: number;
}

export interface StatCheck {
  stat: string;
  difficulty: number;
  roll: DiceRoll;
  success: boolean;
  outcome: string;
}
