import type { DiceRoll, Ruleset, StatCheck } from './types';

export const DND_5E_RULESET: Ruleset = {
  name: 'D&D 5e',
  description: 'Dungeons & Dragons 5th Edition rules',
  stats: [
    'strength',
    'dexterity',
    'constitution',
    'intelligence',
    'wisdom',
    'charisma',
  ],
  skills: {
    strength: ['athletics'],
    dexterity: ['acrobatics', 'sleight-of-hand', 'stealth'],
    constitution: [],
    intelligence: ['arcana', 'history', 'investigation', 'nature', 'religion'],
    wisdom: [
      'animal-handling',
      'insight',
      'medicine',
      'perception',
      'survival',
    ],
    charisma: ['deception', 'intimidation', 'performance', 'persuasion'],
  },
  combatRules: {
    initiative: 'd20 + dexterity modifier',
    actions: ['action', 'bonus-action', 'reaction', 'move'],
    attackRoll: 'd20 + proficiency + ability modifier',
    damageRoll: 'weapon/spell damage + ability modifier',
    criticalHit: 'natural 20',
    deathSaves: '3 successes to stabilize, 3 failures to die',
  },
  statCheckRules: {
    checkFormat: 'd20 + ability modifier + proficiency (if applicable)',
    difficultyClasses: {
      very_easy: 5,
      easy: 10,
      medium: 15,
      hard: 20,
      very_hard: 25,
      nearly_impossible: 30,
    },
    outcomes: {
      critical_success: 'Natural 20 - exceptional result',
      success: 'Meet or exceed DC - desired outcome',
      failure: 'Below DC - unfavorable outcome',
      critical_failure: 'Natural 1 - complication or setback',
    },
  },
};

export function rollD20(modifier: number = 0): DiceRoll {
  const result = Math.floor(Math.random() * 20) + 1;
  return {
    dice: 'd20',
    modifier,
    result,
    total: result + modifier,
  };
}

export function makeStatCheck(
  stat: string,
  difficulty: number,
  modifier: number = 0
): StatCheck {
  const roll = rollD20(modifier);
  const success = roll.total >= difficulty;

  let outcome = '';
  if (roll.result === 20) {
    outcome = 'Critical success!';
  } else if (roll.result === 1) {
    outcome = 'Critical failure!';
  } else if (success) {
    outcome = 'Success!';
  } else {
    outcome = 'Failure!';
  }

  return {
    stat,
    difficulty,
    roll,
    success,
    outcome,
  };
}

export function getDifficultyClass(
  level: keyof typeof DND_5E_RULESET.statCheckRules.difficultyClasses
): number {
  const difficulty = DND_5E_RULESET.statCheckRules.difficultyClasses[level];
  if (difficulty === undefined) {
    return 15; // Default to medium difficulty
  }
  return difficulty;
}
