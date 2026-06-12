import type { Point } from '../utils/Grid';

export interface Resource extends Point {
  kind: 'food';
  amount: number;
}
