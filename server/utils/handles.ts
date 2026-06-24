const ADJECTIVES = [
  'quiet', 'amber', 'deep', 'still', 'clear', 'soft', 'cold', 'vast',
  'faint', 'pale', 'dark', 'dim', 'wide', 'bare', 'calm', 'gray',
]

const NOUNS = [
  'cedar', 'basin', 'ridge', 'delta', 'field', 'mesa', 'shore', 'reach',
  'vale', 'creek', 'stone', 'heath', 'pass', 'dune', 'grove', 'plain',
]

export function generateHandle(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  const num = Math.floor(Math.random() * 900) + 100
  return `${adj}_${noun}_${num}`
}

export function generateReferenceNumber(): string {
  const part1 = Math.floor(Math.random() * 9000) + 1000
  const part2 = Math.floor(Math.random() * 900) + 100
  return `${part1}—${part2}` // em-dash
}
