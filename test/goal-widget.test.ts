import { expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../public/goal-widget.js', import.meta.url), 'utf8');
const getProgress = runInNewContext(`${source}\ngetGoalProgress;`) as (
  current: number, target: number, behavior: string, increment: number
) => { target: number; reached: boolean; hide: boolean };

it('applies goal completion rules consistently after a reload or a large batch', () => {
  expect(getProgress(200, 500, 'double', 100)).toEqual({ target: 500, reached: false, hide: false });
  expect(getProgress(500, 500, 'keep', 100)).toEqual({ target: 500, reached: true, hide: false });
  expect(getProgress(750, 500, 'increase', 100)).toEqual({ target: 800, reached: true, hide: false });
  expect(getProgress(1150, 500, 'double', 100)).toEqual({ target: 2000, reached: true, hide: false });
  expect(getProgress(500, 500, 'hide', 100)).toEqual({ target: 500, reached: true, hide: true });
});
