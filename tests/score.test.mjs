import { describe, it, expect } from 'vitest';
import { scoreRun } from '../benchmark/score.mjs';

describe('scoreRun', () => {
  it('counts top-1 hit when expected id is at index 0', () => {
    const results = [
      {
        question_id: 1,
        expected_memory_id: 42,
        top_k_results: [{ id: 42 }, { id: 7 }, { id: 9 }, { id: 1 }, { id: 12 }],
      },
    ];
    const summary = scoreRun(results);
    expect(summary.top1.hits).toBe(1);
    expect(summary.top1.total).toBe(1);
    expect(summary.top1.rate).toBe(1.0);
    expect(summary.top5.hits).toBe(1);
    expect(summary.top5.rate).toBe(1.0);
  });

  it('counts top-5 hit but not top-1 when expected id is at index 3', () => {
    const results = [
      {
        question_id: 1,
        expected_memory_id: 42,
        top_k_results: [{ id: 9 }, { id: 7 }, { id: 1 }, { id: 42 }, { id: 12 }],
      },
    ];
    const summary = scoreRun(results);
    expect(summary.top1.hits).toBe(0);
    expect(summary.top5.hits).toBe(1);
  });

  it('counts no hit when expected id is missing from top_k_results', () => {
    const results = [
      {
        question_id: 1,
        expected_memory_id: 42,
        top_k_results: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
      },
    ];
    const summary = scoreRun(results);
    expect(summary.top1.hits).toBe(0);
    expect(summary.top5.hits).toBe(0);
  });

  it('aggregates correctly across multiple results', () => {
    const results = [
      { question_id: 1, expected_memory_id: 1, top_k_results: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }] },
      { question_id: 2, expected_memory_id: 99, top_k_results: [{ id: 1 }, { id: 2 }, { id: 99 }, { id: 4 }, { id: 5 }] },
      { question_id: 3, expected_memory_id: 50, top_k_results: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }] },
      { question_id: 4, expected_memory_id: 7, top_k_results: [{ id: 7 }, { id: 8 }, { id: 9 }] },
    ];
    const summary = scoreRun(results);
    expect(summary.top1).toEqual({ hits: 2, total: 4, rate: 0.5 });
    expect(summary.top5).toEqual({ hits: 3, total: 4, rate: 0.75 });
  });

  it('handles empty input', () => {
    const summary = scoreRun([]);
    expect(summary.top1).toEqual({ hits: 0, total: 0, rate: 0 });
    expect(summary.top5).toEqual({ hits: 0, total: 0, rate: 0 });
  });
});
