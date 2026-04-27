import { describe, it, expect } from 'vitest';
import { evaluateVictory, ownerPopulation, totalWorldPopulation } from './victory';
import { makeCountry } from './testHelpers';

describe('victory', () => {
  const countries = {
    A: makeCountry({ id: 'A', population: 700 }),
    B: makeCountry({ id: 'B', population: 200 }),
    C: makeCountry({ id: 'C', population: 100 }),
  };

  it('totalWorldPopulation sums everyone', () => {
    expect(totalWorldPopulation(countries)).toBe(1000);
  });

  it('ownerPopulation counts only owned territories', () => {
    const ownership = { A: 'A', B: 'A', C: 'C' };
    expect(ownerPopulation('A', ownership, countries)).toBe(900);
    expect(ownerPopulation('C', ownership, countries)).toBe(100);
  });

  it('declares win when player owns >= 60% of population', () => {
    const ownership = { A: 'A', B: 'A', C: 'C' };
    const v = evaluateVictory({
      playerId: 'A',
      homeId: 'A',
      ownership,
      countries,
      date: { year: 1905, month: 3 },
    });
    expect(v.kind).toBe('win');
  });

  it('stays ongoing under threshold', () => {
    // 700 alone is 70% — too much. Use a player with less than 60%.
    const lopsided = {
      A: makeCountry({ id: 'A', population: 100 }),
      B: makeCountry({ id: 'B', population: 500 }),
      C: makeCountry({ id: 'C', population: 400 }),
    };
    const ownership = { A: 'A', B: 'B', C: 'C' };
    const v = evaluateVictory({
      playerId: 'A',
      homeId: 'A',
      ownership,
      countries: lopsided,
      date: { year: 1905, month: 3 },
    });
    expect(v.kind).toBe('ongoing');
  });

  it('declares loss when home country falls', () => {
    const ownership = { A: 'B', B: 'B', C: 'C' };
    const v = evaluateVictory({
      playerId: 'A',
      homeId: 'A',
      ownership,
      countries,
      date: { year: 1905, month: 3 },
    });
    expect(v.kind).toBe('loss');
  });
});
