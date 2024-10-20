// @author: ykchenc
// @date: 2024-10-18

function sourcesSort(mediaSources, rules) {
  return mediaSources.sort((a, b) => {
    for (let key in rules) {
      let ruleVal = rules[key];
      let aVal = getNestedValue(a, key);
      let bVal = getNestedValue(b, key);
      if (Array.isArray(ruleVal)) {
        for (let i in ruleVal) {
          let rule = ruleVal[i];
          const hasRuleA = rule instanceof RegExp ? aVal.match(rule) : aVal.includes(rule);
          const hasRuleB = rule instanceof RegExp ? bVal.match(rule) : bVal.includes(rule);
          if (hasRuleA && !hasRuleB) return -1;
          if (!hasRuleA && hasRuleB) return 1;
        }
      } else {
        if (aVal < bVal) { return ruleVal === 'asc' ? -1 : 1; }
        if (aVal > bVal) { return ruleVal === 'asc' ? 1 : -1; }
      }
    }
    return 0;
  });
}
function getNestedValue(obj, path) {
  let current = obj;
  const keys = path.split('.');
  for (let i in keys) {
    let key = keys[i];
    if (key.includes(':length')) {
      const type = key.split(':')[0];
      return (current || []).filter(stream => stream.Type === type).length;
    }
    if (Array.isArray(current)) {
      current = current.find(item => item.Type === key);
      if (current === undefined) {
        return undefined;
      }
    } else if (current && current.hasOwnProperty(key)) {
      current = current[key];
    } else {
      return undefined;
    }
  }
  return current;
}

export default {
  sourcesSort,
};