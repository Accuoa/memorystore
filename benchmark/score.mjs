export function scoreRun(results) {
  let top1Hits = 0;
  let top5Hits = 0;

  for (const r of results) {
    const ids = (r.top_k_results || []).map((x) => x.id);
    if (ids[0] === r.expected_memory_id) top1Hits++;
    if (ids.slice(0, 5).includes(r.expected_memory_id)) top5Hits++;
  }

  const total = results.length;
  return {
    top1: { hits: top1Hits, total, rate: total === 0 ? 0 : top1Hits / total },
    top5: { hits: top5Hits, total, rate: total === 0 ? 0 : top5Hits / total },
  };
}
