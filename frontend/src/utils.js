// utils.js

function generateEldritchName() {
  const prefixes = ['Cth', 'Azath', 'Nyarl', 'Yog', 'Shub', 'Dagon', 'Hastur', 'Ithaqua', 'Tsath'];
  const suffixes = ['ulhu', 'oth', 'athotep', 'Sothoth', 'Niggurath', 'ogtha', 'oggua', 'ogga'];

  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];

  return prefix + suffix;
}

export { generateEldritchName };
