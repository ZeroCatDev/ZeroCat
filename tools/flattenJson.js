function flattenJson(json) {
  const result = {};

  function recurse(current, property) {
    if (Object(current) !== current) {
      result[property] = current;
    } else if (Array.isArray(current)) {
      for (let i = 0; i < current.length; i++) {
        recurse(current[i], property + "." + i);
      }
      // 这里的修复，确保可以处理空数组
      if (current.length === 0) {
        result[property] = [];
      }
    } else {
      for (const p in current) {
        recurse(current[p], property ? property + "." + p : p);
      }
    }
  }

  recurse(json, "");
  return result;
}

// 示例 JSON
const json = {};

// 转换
const flattened = flattenJson(json);
console.log(flattened);
