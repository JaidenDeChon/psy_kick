/** Wilson score confidence interval (95%). Honest at small n. */
export function wilsonInterval(hits: number, n: number) {
  if (n === 0) return { lower: 0, upper: 1 }
  const z = 1.96
  const phat = hits / n
  const denominator = 1 + (z * z) / n
  const center = (phat + (z * z) / (2 * n)) / denominator
  const margin = (z / denominator) * Math.sqrt((phat * (1 - phat)) / n + (z * z) / (4 * n * n))
  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
  }
}

/** Binomial coefficient (log-space to avoid integer overflow). */
function binomialCoeff(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  if (k === 0 || k === n) return 1
  let result = 0
  for (let i = 0; i < k; i++) {
    result += Math.log(n - i) - Math.log(i + 1)
  }
  return Math.exp(result)
}

/** One-sided binomial p-value vs chance null p₀ = 0.25.
 *  P(hits ≥ observed | no ability). Stays large at small n — that is correct. */
export function binomialPValue(hits: number, n: number, p0 = 0.25): number {
  let p = 0
  for (let k = hits; k <= n; k++) {
    p += binomialCoeff(n, k) * Math.pow(p0, k) * Math.pow(1 - p0, n - k)
  }
  return Math.min(1, p)
}

export interface RunningStats {
  n: number
  hits: number
  hitRate: number
  wilsonLower: number
  wilsonUpper: number
  pValue: number
  baseline: 0.25
}

export function computeStats(hits: number, n: number): RunningStats {
  const interval = wilsonInterval(hits, n)
  return {
    n,
    hits,
    hitRate: n > 0 ? hits / n : 0,
    wilsonLower: interval.lower,
    wilsonUpper: interval.upper,
    pValue: n > 0 ? binomialPValue(hits, n) : 1,
    baseline: 0.25,
  }
}
